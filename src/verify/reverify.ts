import { eq } from 'drizzle-orm'
import { Duration, Effect } from 'effect'
import { db } from '../db/client'
import { sources } from '../db/schema'
import type { WorkingSetSource } from '../gather/gather'
import { DbError } from '../report/errors'

/** Re-verify a working-set member only when its check is older than this. */
const STALE_DAYS = 7
const HEAD_TIMEOUT_MS = 8_000

function isStale(lastVerifiedAt: Date | null, now: Date): boolean {
  if (!lastVerifiedAt) return true
  return now.getTime() - lastVerifiedAt.getTime() > STALE_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Cheap liveness check, never a model call (PRD 6.3). Internal documents are
 * always live. For an external URL, an HTTP HEAD tells us whether it still
 * exists: a reached server is treated as live unless it says the resource is
 * gone (404/410); a network failure or timeout counts as not live.
 */
const checkLiveness = (source: WorkingSetSource): Effect.Effect<boolean> => {
  if (source.channel === 'doc' || !source.url) return Effect.succeed(true)
  const url = source.url
  return Effect.tryPromise({
    try: (signal) => fetch(url, { method: 'HEAD', redirect: 'follow', signal }),
    catch: () => new Error('head request failed'),
  }).pipe(
    Effect.timeoutFail({
      duration: Duration.millis(HEAD_TIMEOUT_MS),
      onTimeout: () => new Error('head timed out'),
    }),
    Effect.map((res) => res.status !== 404 && res.status !== 410),
    Effect.orElseSucceed(() => false),
  )
}

export interface ReverifyResult {
  readonly checked: number
  readonly live: number
}

/**
 * Re-verification pass run before synthesis (PRD 5.4). Any working-set source
 * whose last_verified_at is older than seven days gets a liveness check, and its
 * verified_live / last_verified_at are updated. Fresh sources are left alone.
 */
/** Liveness checks run in parallel; each HEAD can take up to HEAD_TIMEOUT_MS. */
const REVERIFY_CONCURRENCY = 8

export const reverifyWorkingSet = (
  workingSet: ReadonlyArray<WorkingSetSource>,
  now: Date = new Date(),
): Effect.Effect<ReverifyResult, DbError> =>
  Effect.gen(function* () {
    const stale = workingSet.filter((s) => isStale(s.lastVerifiedAt, now))
    // Parallelise: a large deep-tier working set would otherwise serialise many
    // multi-second HEAD requests into minutes.
    const results = yield* Effect.all(
      stale.map((source) =>
        Effect.gen(function* () {
          const alive = yield* checkLiveness(source)
          yield* Effect.tryPromise({
            try: () =>
              db
                .update(sources)
                .set({ verifiedLive: alive, lastVerifiedAt: new Date() })
                .where(eq(sources.id, source.id)),
            catch: (cause) => new DbError({ reason: String(cause) }),
          })
          return alive
        }),
      ),
      { concurrency: REVERIFY_CONCURRENCY },
    )
    return { checked: results.length, live: results.filter(Boolean).length }
  })
