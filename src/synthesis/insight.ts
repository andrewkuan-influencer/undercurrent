import { Schema } from 'effect'

/**
 * The insight report, composed of the six components in PRD 4.3. `results.insight`
 * stores this whole object as JSONB. Every component carries the source ids it
 * cites; those ids are validated against the working set before any write, and
 * the sources list itself is rendered from the frozen citation snapshots.
 *
 * Citation arrays default to empty so a partial model response still decodes;
 * the citation rule is enforced separately on whatever refs are present.
 *
 * Values are the small integer reference numbers the model is shown for each
 * source, not raw ids: the model cites e.g. `3`, and synthesis resolves that
 * ref back to the real source id (a model reliably copies a one or two digit
 * number, but mangles a 36-character UUID). Both a number and its string form
 * are accepted since models are inconsistent about quoting numerics in JSON.
 */
const citations = Schema.optionalWith(
  Schema.Array(Schema.Union(Schema.String, Schema.Number)),
  { default: () => [] },
)

/** Component 1: the headline reframe, through the obvious/unexpected/interesting lens. */
export const Headline = Schema.Struct({
  reframe: Schema.String,
  obvious: Schema.String,
  unexpected: Schema.String,
  interesting: Schema.String,
  citations,
})

/** Component 2: topic breakdown. */
export const TopicBreakdownItem = Schema.Struct({
  topic: Schema.String,
  summary: Schema.String,
  citations,
})

/** Component 3: tensions, framed to provoke rather than conclude. */
export const Tension = Schema.Struct({
  tension: Schema.String,
  citations,
})

/** Component 4: consumer voice, real consumer language with a verbatim quote. */
export const ConsumerVoiceItem = Schema.Struct({
  observation: Schema.String,
  verbatim: Schema.String,
  citations,
})

/** Component 5: suggested creator angles (angles proposed, not named creators). */
export const CreatorAngle = Schema.Struct({
  angle: Schema.String,
  rationale: Schema.String,
  citations,
})

const emptyArray = <A, I>(item: Schema.Schema<A, I>) =>
  Schema.optionalWith(Schema.Array(item), { default: () => [] })

export const Insight = Schema.Struct({
  headline: Headline,
  topicBreakdown: emptyArray(TopicBreakdownItem),
  tensions: emptyArray(Tension),
  consumerVoice: emptyArray(ConsumerVoiceItem),
  creatorAngles: emptyArray(CreatorAngle),
})
export type Insight = Schema.Schema.Type<typeof Insight>

/** The six citing component groups, used to bind and freeze citations. */
export const CITATION_GROUPS = [
  'headline',
  'topic',
  'tension',
  'consumer_voice',
  'creator_angle',
] as const
export type CitationGroup = (typeof CITATION_GROUPS)[number]
