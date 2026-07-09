import { Data } from 'effect'

/** The model output could not be parsed or did not match the insight schema. */
export class InvalidModelOutputError extends Data.TaggedError(
  'InvalidModelOutputError',
)<{
  readonly reason: string
  readonly raw?: string
}> {}

/**
 * THE rule (CLAUDE.md, PRD 5.1): synthesis cited a source id that is not in the
 * working set. This is a hard error, never patched over. The database FK is the
 * second line of defence; this validation is the first.
 */
export class UnknownCitationError extends Data.TaggedError(
  'UnknownCitationError',
)<{
  readonly citationId: string
  readonly knownIds: ReadonlyArray<string>
}> {}
