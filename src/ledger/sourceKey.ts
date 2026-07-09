import { createHash } from 'node:crypto'
import type { SourceIdentifier } from '../retrieval/types'

/** Tracking params that never change the identity of a page. */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
]

/**
 * Canonicalise a URL so trivially different links collapse to one key:
 * lowercase host, drop the fragment, strip tracking params, sort the remaining
 * query, and remove a trailing slash. Best-effort; returns the input unchanged
 * if it does not parse.
 */
export function canonicaliseUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    u.hostname = u.hostname.toLowerCase()
    u.protocol = u.protocol.toLowerCase()
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p)
    u.searchParams.sort()
    let out = u.toString()
    // Remove a trailing slash on the path (but keep the bare-host root).
    out = out.replace(/\/(?=$|\?)/, (m, offset: number) =>
      offset > u.origin.length ? '' : m,
    )
    return out
  } catch {
    return url
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Build the namespaced, UNIQUE source_key for an item (PRD 6.3). The namespace
 * prefix keeps the three channels from ever colliding: Reddit fullname, a hash
 * of the canonicalised URL for web, file-content-hash plus chunk index for docs.
 */
export function sourceKeyFor(identifier: SourceIdentifier): string {
  switch (identifier.kind) {
    case 'reddit_fullname':
      return `reddit:${identifier.fullname}`
    case 'url':
      return `web:${sha256(canonicaliseUrl(identifier.url))}`
    case 'doc_chunk':
      return `doc:${identifier.contentHash ?? 'nohash'}:${identifier.chunkIndex}`
  }
}
