import { Effect, Schema } from 'effect'
import { MAIN_MODEL } from '../config/models'
import { callModel, type ModelError } from '../models/openrouter'
import { InvalidModelOutputError, UnknownCitationError } from './errors'
import { Insight } from './insight'
import { loadSynthesisPrompt } from './prompt'

/** A source as presented to the model and used to validate its citations. */
export interface WorkingSetItem {
  readonly id: string
  readonly channel: string
  readonly title: string | null
  readonly url: string | null
  readonly excerpt: string
}

/** A validated citation ready to be bound to a stored source. */
export interface BoundCitation {
  readonly sourceId: string
  readonly blockType: string
}

export interface SynthesisOutput {
  readonly insight: Insight
  readonly citations: ReadonlyArray<BoundCitation>
}

/** The model excerpt budget per source, to keep the prompt bounded. */
const EXCERPT_LIMIT = 1200

/** Pull the JSON object out of a model response that may be fenced or padded. */
function extractJson(text: string): string {
  const trimmed = text.trim()
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence && fence[1] !== undefined) return fence[1].trim()
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1)
  }
  return trimmed
}

/**
 * The single synthesis call (PRD 5.1, 5.4). Presents the working set to the main
 * model, parses the JSON insight, then enforces THE rule: every cited id must be
 * in the working set. An unknown id fails hard with UnknownCitationError; nothing
 * is written. No id is ever added or repaired to make output validate.
 */
export const synthesize = (
  questionText: string,
  workingSet: ReadonlyArray<WorkingSetItem>,
): Effect.Effect<
  SynthesisOutput,
  ModelError | InvalidModelOutputError | UnknownCitationError
> =>
  Effect.gen(function* () {
    const systemPrompt = yield* loadSynthesisPrompt

    const sourcesForModel = workingSet.map((s) => ({
      id: s.id,
      channel: s.channel,
      title: s.title,
      url: s.url,
      excerpt: s.excerpt.replace(/\s+/g, ' ').trim().slice(0, EXCERPT_LIMIT),
    }))

    const userContent = [
      `Question: ${questionText}`,
      '',
      'Sources (cite only these ids):',
      JSON.stringify(sourcesForModel, null, 2),
    ].join('\n')

    const raw = yield* callModel({
      model: MAIN_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
    })

    const parsed = yield* Effect.try({
      try: () => JSON.parse(extractJson(raw)) as unknown,
      catch: () =>
        new InvalidModelOutputError({ reason: 'response was not valid JSON', raw }),
    })

    const insight = yield* Schema.decodeUnknown(Insight)(parsed).pipe(
      Effect.mapError(
        (error) =>
          new InvalidModelOutputError({ reason: `schema mismatch: ${error}`, raw }),
      ),
    )

    const known = new Set(workingSet.map((s) => s.id))
    const citations: BoundCitation[] = []
    const seen = new Set<string>()
    for (const block of insight.blocks) {
      for (const id of block.citations) {
        if (!known.has(id)) {
          return yield* new UnknownCitationError({
            citationId: id,
            knownIds: [...known],
          })
        }
        const dedupeKey = `${block.type}::${id}`
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey)
          citations.push({ sourceId: id, blockType: block.type })
        }
      }
    }

    return { insight, citations }
  })
