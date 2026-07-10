import type { RetrievedItem, TimeRange } from '../retrieval'

/**
 * Map a recency window in days onto the coarse provider time filter, so queries
 * are scoped at the source (PRD 5.4). Returns undefined for very wide windows,
 * meaning no provider filter (the post-retrieval filter still applies).
 */
export function recencyToTimeRange(days: number): TimeRange | undefined {
  if (days <= 1) return 'day'
  if (days <= 7) return 'week'
  if (days <= 31) return 'month'
  if (days <= 366) return 'year'
  return undefined
}

export interface RecencyVerdict {
  /** Keep the item for scoring, or drop it as out of window. */
  readonly keep: boolean
  /** External item with no publish date: kept in scope but flagged. */
  readonly undated: boolean
}

/**
 * The recency filter, applied before scoring (PRD 5.4). Internal documents are
 * always in scope. Dated external items are dropped when older than the window.
 * Undated external items are kept but flagged, never silently dropped.
 */
export function recencyVerdict(
  item: RetrievedItem,
  windowDays: number,
  now: Date,
): RecencyVerdict {
  if (item.channel === 'doc') return { keep: true, undated: false }
  if (item.publishedAt === null) return { keep: true, undated: true }
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000
  return { keep: item.publishedAt.getTime() >= cutoff, undated: false }
}
