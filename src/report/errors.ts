import { Data } from 'effect'

/** A database operation in the run failed. */
export class DbError extends Data.TaggedError('DbError')<{
  readonly reason: string
}> {}

/** Retrieval produced no in-scope sources, so there is nothing to synthesise. */
export class NoEvidenceError extends Data.TaggedError('NoEvidenceError')<{
  readonly questionId: string
}> {}
