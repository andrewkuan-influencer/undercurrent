import { Data } from 'effect'
import type { Channel } from './types'

/** The provider (or our config for it) refused or failed the request. */
export class ProviderError extends Data.TaggedError('ProviderError')<{
  readonly channel: Channel
  readonly status?: number
  readonly reason: string
}> {}

/** The provider returned HTTP 429; back off before retrying. */
export class RateLimitError extends Data.TaggedError('RateLimitError')<{
  readonly channel: Channel
  readonly retryAfterSeconds?: number
}> {}

/** The request did not complete within the configured timeout. */
export class RetrievalTimeoutError extends Data.TaggedError(
  'RetrievalTimeoutError',
)<{
  readonly channel: Channel
  readonly timeoutMs: number
}> {}

/** The request succeeded but returned no items in scope. */
export class EmptyResultsError extends Data.TaggedError('EmptyResultsError')<{
  readonly channel: Channel
  readonly query: string
}> {}

export type RetrievalError =
  | ProviderError
  | RateLimitError
  | RetrievalTimeoutError
  | EmptyResultsError
