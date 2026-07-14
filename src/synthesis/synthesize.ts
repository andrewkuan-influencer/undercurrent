import { Effect, Schema } from 'effect'
import { MAIN_MODEL } from '../config/models'
import { callModel, type ModelError } from '../models/openrouter'
import { InvalidModelOutputError, UnknownCitationError } from './errors'
import { Insight, type CitationGroup } from './insight'
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

    // Present each source with a small integer `ref`, never its real id. A model
    // reliably copies a one or two digit number back into a citation array, but
    // mangles a 36-character UUID (dropping a hyphen is enough to fail THE rule).
    // We resolve each ref back to the real id below, so the model never has to
    // transcribe an id at all.
    const refToId = new Map<string, string>()
    const sourcesForModel = workingSet.map((s, i) => {
      const ref = i + 1
      refToId.set(String(ref), s.id)
      return {
        ref,
        channel: s.channel,
        title: s.title,
        url: s.url,
        excerpt: s.excerpt.replace(/\s+/g, ' ').trim().slice(0, EXCERPT_LIMIT),
      }
    })

    const userContent = [
      `Question: ${questionText}`,
      '',
      'Sources (cite only these ref numbers):',
      JSON.stringify(sourcesForModel, null, 2),
    ].join('\n')

    const raw = yield* callModel({
      model: MAIN_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
      // The full six-component report is a large, slow generation over many
      // sources: a generous token ceiling avoids truncated (unparseable) JSON,
      // and a longer timeout avoids cutting the call off mid-write.
      maxTokens: 8000,
      timeoutMs: 150_000,
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

    // Collect every citation across the six components, tagged by which
    // component made it, then enforce THE rule: each ref must resolve to a
    // source in the working set. An unresolvable ref fails hard; nothing is
    // written and no id is repaired to make output validate.
    type Ref = string | number
    const groups: Array<[CitationGroup, ReadonlyArray<Ref>]> = [
      ['headline', insight.headline.citations],
      ...insight.topicBreakdown.map(
        (t) => ['topic', t.citations] as [CitationGroup, ReadonlyArray<Ref>],
      ),
      ...insight.tensions.map(
        (t) => ['tension', t.citations] as [CitationGroup, ReadonlyArray<Ref>],
      ),
      ...insight.consumerVoice.map(
        (c) =>
          ['consumer_voice', c.citations] as [CitationGroup, ReadonlyArray<Ref>],
      ),
      ...insight.creatorAngles.map(
        (a) =>
          ['creator_angle', a.citations] as [CitationGroup, ReadonlyArray<Ref>],
      ),
    ]

    // Normalise "3", 3, "[3]", "ref 3" to the bare digits; an out-of-range ref
    // still returns null and fails hard, so this forgives formatting without
    // weakening the rule.
    const resolveRef = (rawRef: string | number): string | null => {
      const match = String(rawRef).match(/\d+/)
      const key = match ? match[0] : String(rawRef).trim()
      return refToId.get(key) ?? null
    }

    const citations: BoundCitation[] = []
    const seen = new Set<string>()
    for (const [group, refs] of groups) {
      for (const rawRef of refs) {
        const sourceId = resolveRef(rawRef)
        if (!sourceId) {
          return yield* new UnknownCitationError({
            citationId: String(rawRef),
            knownIds: [...refToId.keys()],
          })
        }
        const dedupeKey = `${group}::${sourceId}`
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey)
          citations.push({ sourceId, blockType: group })
        }
      }
    }

    // Persist real source ids in the stored insight, not the model's refs: the
    // ref numbers are only a transcription aid for the model call, and every
    // downstream reader (the report UI, the frozen snapshots) keys off source
    // ids. Every ref resolved above, so this cannot introduce an unknown id.
    const normCites = (refs: ReadonlyArray<string | number>): string[] =>
      refs.map(resolveRef).filter((x): x is string => x !== null)
    const normalized: Insight = {
      headline: { ...insight.headline, citations: normCites(insight.headline.citations) },
      topicBreakdown: insight.topicBreakdown.map((t) => ({
        ...t,
        citations: normCites(t.citations),
      })),
      tensions: insight.tensions.map((t) => ({ ...t, citations: normCites(t.citations) })),
      consumerVoice: insight.consumerVoice.map((c) => ({
        ...c,
        citations: normCites(c.citations),
      })),
      creatorAngles: insight.creatorAngles.map((a) => ({
        ...a,
        citations: normCites(a.citations),
      })),
    }

    return { insight: normalized, citations }
  })
