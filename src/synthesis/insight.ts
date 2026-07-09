import { Schema } from 'effect'

/**
 * The shape the main model must return. `results.insight` stores this whole
 * object as JSONB (PRD 6.3). Every block carries the source ids it cites; those
 * ids are validated against the working set before anything is written.
 */
export const CitationBlock = Schema.Struct({
  type: Schema.String,
  text: Schema.String,
  citations: Schema.Array(Schema.String),
})
export type CitationBlock = Schema.Schema.Type<typeof CitationBlock>

export const Insight = Schema.Struct({
  summary: Schema.String,
  blocks: Schema.Array(CitationBlock),
})
export type Insight = Schema.Schema.Type<typeof Insight>
