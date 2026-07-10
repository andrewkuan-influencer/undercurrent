import { Config, Data, Duration, Effect } from 'effect'
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL } from '../config/embedding'

/** Any failure producing embeddings (config, HTTP, timeout, bad response). */
export class EmbeddingError extends Data.TaggedError('EmbeddingError')<{
  readonly reason: string
  readonly status?: number
}> {}

const ENDPOINT = 'https://api.openai.com/v1/embeddings'
const TIMEOUT_MS = 60_000

/**
 * Embed a batch of texts with the fixed embedding model (PRD 5.3). Direct
 * OpenAI call behind the retrieval/embedding boundary; OpenRouter has no
 * embeddings endpoint. Returns one vector per input, in input order.
 */
export const embedTexts = (
  inputs: ReadonlyArray<string>,
): Effect.Effect<number[][], EmbeddingError> =>
  Effect.gen(function* () {
    if (inputs.length === 0) return []
    const apiKey = yield* Config.string('OPENAI_API_KEY').pipe(
      Effect.mapError(
        (error) => new EmbeddingError({ reason: `configuration error: ${error}` }),
      ),
    )

    const response = yield* Effect.tryPromise({
      try: (signal) =>
        fetch(ENDPOINT, {
          method: 'POST',
          signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: inputs,
            dimensions: EMBEDDING_DIMENSION,
          }),
        }),
      catch: (cause) => new EmbeddingError({ reason: `request failed: ${String(cause)}` }),
    }).pipe(
      Effect.timeoutFail({
        duration: Duration.millis(TIMEOUT_MS),
        onTimeout: () => new EmbeddingError({ reason: 'request timed out' }),
      }),
    )

    if (!response.ok) {
      const body = yield* Effect.promise(() => response.text().catch(() => ''))
      return yield* new EmbeddingError({
        status: response.status,
        reason: body.slice(0, 300) || response.statusText,
      })
    }

    const json = yield* Effect.tryPromise({
      try: () => response.json() as Promise<{ data?: Array<{ index?: number; embedding?: number[] }> }>,
      catch: (cause) => new EmbeddingError({ reason: `invalid JSON: ${String(cause)}` }),
    })
    const data = json.data
    if (!Array.isArray(data) || data.length !== inputs.length) {
      return yield* new EmbeddingError({ reason: 'unexpected embeddings response shape' })
    }
    return [...data]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((d) => d.embedding ?? [])
  })

/** Embed a single query string, failing if no vector comes back. */
export const embedQuery = (
  text: string,
): Effect.Effect<number[], EmbeddingError> =>
  Effect.flatMap(embedTexts([text]), (vectors) => {
    const vector = vectors[0]
    return vector && vector.length > 0
      ? Effect.succeed(vector)
      : Effect.fail(new EmbeddingError({ reason: 'empty embedding for query' }))
  })
