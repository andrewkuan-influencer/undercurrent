import { Data } from 'effect'

/** The planning call failed or returned a plan that did not parse/validate. */
export class PlanError extends Data.TaggedError('PlanError')<{
  readonly reason: string
  readonly raw?: string
}> {}
