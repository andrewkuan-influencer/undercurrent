import { MIN_SOURCES_PER_FACET, SATURATION_RATIO } from './config'

/**
 * Coverage (PRD 5.4): the loop has enough when every planned facet is backed by
 * at least minSourcesPerFacet distinct relevant, in-window sources (scaled from
 * the recency window, defaulting to the base constant). Judged on structure,
 * never on token or link count. An empty plan is never "covered".
 */
export function facetsCovered(
  facetSources: Map<string, Set<string>>,
  minSourcesPerFacet: number = MIN_SOURCES_PER_FACET,
): boolean {
  if (facetSources.size === 0) return false
  for (const set of facetSources.values()) {
    if (set.size < minSourcesPerFacet) return false
  }
  return true
}

/**
 * Saturation (PRD 5.4): a round whose novel sources fall below SATURATION_RATIO
 * of what it kept has stopped paying off. A round that kept nothing gives no
 * saturation signal (it may be a transient retrieval failure), so the loop leans
 * on the query queue and hard caps instead.
 */
export function isSaturated(roundKept: number, novelKept: number): boolean {
  if (roundKept === 0) return false
  return novelKept / roundKept < SATURATION_RATIO
}
