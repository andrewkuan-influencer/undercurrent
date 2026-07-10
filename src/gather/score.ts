import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Effect, Schema } from 'effect'
import { LIGHTWEIGHT_MODEL } from '../config/models'
import { extractJson } from '../models/json'
import { callModel } from '../models/openrouter'
import type { RetrievedItem } from '../retrieval'
import { SCORE_BATCH_SIZE } from './config'

/** One candidate to score, with the facet it was retrieved for. */
export interface ScoreInput {
  readonly item: RetrievedItem
  readonly facetLabel: string
}

/** The lightweight model's judgement and clean extraction for one candidate. */
export interface Scored {
  readonly relevance: number
  readonly voice: 'consumer' | 'expert' | null
  readonly language: string | null
  readonly excerpt: string
}

const ScoredItem = Schema.Struct({
  index: Schema.Number,
  relevance: Schema.Number,
  voice: Schema.NullOr(Schema.Literal('consumer', 'expert')),
  language: Schema.NullOr(Schema.String),
  excerpt: Schema.String,
})
const ScoreBatch = Schema.Struct({ items: Schema.Array(ScoredItem) })

/** Content budget per item handed to the model, to bound scoring tokens. */
const CONTENT_LIMIT = 1500

const DROPPED: Scored = {
  relevance: 0,
  voice: null,
  language: null,
  excerpt: '',
}

const loadScorePrompt = Effect.tryPromise({
  try: () => readFile(join(process.cwd(), 'prompts', 'score-extract.md'), 'utf8'),
  catch: (cause) => new Error(`failed to load score prompt: ${String(cause)}`),
}).pipe(Effect.orElseSucceed(() => ''))

function chunk<A>(items: ReadonlyArray<A>, size: number): A[][] {
  const out: A[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function itemForModel(input: ScoreInput, index: number) {
  const content = input.item.content.replace(/\s+/g, ' ').trim().slice(0, CONTENT_LIMIT)
  return {
    index,
    facet: input.facetLabel,
    channel: input.item.channel,
    title: input.item.title,
    url: input.item.url,
    content,
  }
}

/**
 * Score and extract a set of candidates with the lightweight model in batched
 * calls (PRD 5.4). This never fails the run: a batch that errors or returns a
 * malformed shape drops those candidates (relevance 0), which simply keeps them
 * out of the ledger. Results align one-to-one with the input order.
 */
export const scoreAndExtract = (
  questionText: string,
  inputs: ReadonlyArray<ScoreInput>,
): Effect.Effect<Scored[]> =>
  Effect.gen(function* () {
    if (inputs.length === 0) return []
    const systemPrompt = yield* loadScorePrompt

    const batches = chunk([...inputs], SCORE_BATCH_SIZE)
    const results: Scored[] = new Array(inputs.length).fill(DROPPED)

    let offset = 0
    for (const batch of batches) {
      const base = offset
      offset += batch.length

      const payload = {
        question: questionText,
        items: batch.map((input, i) => itemForModel(input, i)),
      }

      const scored = yield* callModel({
        model: LIGHTWEIGHT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        temperature: 0,
      }).pipe(
        Effect.flatMap((raw) =>
          Effect.try(() => JSON.parse(extractJson(raw)) as unknown),
        ),
        Effect.flatMap((parsed) => Schema.decodeUnknown(ScoreBatch)(parsed)),
        Effect.either,
      )

      if (scored._tag === 'Left') {
        yield* Effect.logInfo(
          `score: batch of ${batch.length} dropped (${String(scored.left)})`,
        )
        continue
      }

      for (const entry of scored.right.items) {
        if (entry.index < 0 || entry.index >= batch.length) continue
        results[base + entry.index] = {
          relevance: clamp01(entry.relevance),
          voice: entry.voice,
          language: entry.language,
          excerpt: entry.excerpt,
        }
      }
    }

    return results
  })
