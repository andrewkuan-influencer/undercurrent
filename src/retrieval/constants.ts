/**
 * Defaults for the retrieval service, in one place. These are request-shaping
 * knobs (timeouts, page sizes), not the gather-loop thresholds from section 5.4,
 * which live in their own config when that loop is built.
 */
export const DEFAULT_TIMEOUT_MS = 15_000
export const DEFAULT_MAX_RESULTS = 5
export const DEFAULT_DOC_LIMIT = 8

/** Reddit requires a descriptive, unique User-Agent on every request. */
export const REDDIT_USER_AGENT = 'undercurrent/0.1 (Influencer CSI Engine)'
