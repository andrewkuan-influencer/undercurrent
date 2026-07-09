import { Config, Data, Duration, Effect } from 'effect'

/** Any failure calling the model through OpenRouter (HTTP, timeout, config). */
export class ModelError extends Data.TaggedError('ModelError')<{
  readonly status?: number
  readonly reason: string
}> {}

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

export interface CallModelOptions {
  readonly model: string
  readonly messages: ReadonlyArray<ChatMessage>
  readonly temperature?: number
  readonly maxTokens?: number
  readonly timeoutMs?: number
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_TIMEOUT_MS = 90_000

/**
 * One chat completion through OpenRouter (PRD 5.3, 7). Returns the assistant
 * message content as a string. All model calls in the engine route through
 * here; never call a provider directly.
 */
export const callModel = (
  options: CallModelOptions,
): Effect.Effect<string, ModelError> =>
  Effect.gen(function* () {
    const apiKey = yield* Config.string('OPENROUTER_API_KEY').pipe(
      Effect.mapError(
        (error) => new ModelError({ reason: `configuration error: ${error}` }),
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
            'X-Title': 'Undercurrent',
          },
          body: JSON.stringify({
            model: options.model,
            messages: options.messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4000,
          }),
        }),
      catch: (cause) => new ModelError({ reason: `request failed: ${String(cause)}` }),
    }).pipe(
      Effect.timeoutFail({
        duration: Duration.millis(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        onTimeout: () => new ModelError({ reason: 'request timed out' }),
      }),
    )

    if (!response.ok) {
      const body = yield* Effect.promise(() => response.text().catch(() => ''))
      return yield* new ModelError({
        status: response.status,
        reason: body.slice(0, 500) || response.statusText,
      })
    }

    const json = yield* Effect.tryPromise({
      try: () => response.json() as Promise<unknown>,
      catch: (cause) => new ModelError({ reason: `invalid JSON envelope: ${String(cause)}` }),
    })

    const content = (
      json as { choices?: Array<{ message?: { content?: unknown } }> }
    ).choices?.[0]?.message?.content

    if (typeof content !== 'string' || content.length === 0) {
      return yield* new ModelError({ reason: 'model returned no content' })
    }
    return content
  })
