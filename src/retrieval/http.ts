import { Duration, Effect } from 'effect'
import { ProviderError, RateLimitError, RetrievalTimeoutError } from './errors'
import type { Channel } from './types'

interface FetchJsonArgs {
  readonly channel: Channel
  readonly url: string
  readonly init?: RequestInit
  readonly timeoutMs: number
}

/**
 * Shared HTTP helper for the web and reddit channels. Maps transport outcomes
 * onto the typed error set: 429 to RateLimitError, a timeout to
 * RetrievalTimeoutError, everything else non-ok (and any parse failure) to
 * ProviderError. On timeout the underlying fetch is aborted via the signal
 * Effect.tryPromise provides.
 */
export const fetchJson = ({
  channel,
  url,
  init,
  timeoutMs,
}: FetchJsonArgs): Effect.Effect<
  unknown,
  ProviderError | RateLimitError | RetrievalTimeoutError
> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: (signal) => fetch(url, { ...init, signal }),
      catch: (cause) =>
        new ProviderError({ channel, reason: `request failed: ${String(cause)}` }),
    }).pipe(
      Effect.timeoutFail({
        duration: Duration.millis(timeoutMs),
        onTimeout: () => new RetrievalTimeoutError({ channel, timeoutMs }),
      }),
    )

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after')
      return yield* new RateLimitError({
        channel,
        retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
      })
    }

    if (!response.ok) {
      const body = yield* Effect.promise(() =>
        response.text().catch(() => ''),
      )
      return yield* new ProviderError({
        channel,
        status: response.status,
        reason: body.slice(0, 300) || response.statusText,
      })
    }

    return yield* Effect.tryPromise({
      try: () => response.json() as Promise<unknown>,
      catch: (cause) =>
        new ProviderError({ channel, reason: `invalid JSON: ${String(cause)}` }),
    })
  })
