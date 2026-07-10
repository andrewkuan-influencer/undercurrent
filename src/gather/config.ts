/**
 * The gather loop's thresholds, in one place (CLAUDE.md, PRD 5.4). The loop
 * stops on coverage plus saturation, never on token or link count; the hard caps
 * are a cost backstop. Tune these here and nowhere else.
 */

/** Coverage: distinct relevant, in-window sources a facet needs to be "covered". */
export const MIN_SOURCES_PER_FACET = 3

/**
 * Saturation: if a round's novel sources fall below this fraction of what it
 * kept, fresh rounds have stopped paying off and the loop ends.
 */
export const SATURATION_RATIO = 0.25

/** Hard cap on rounds, regardless of coverage or saturation. */
export const MAX_ROUNDS = 4

/** Hard cap on total distinct sources gathered for one question. */
export const MAX_SOURCES = 40

// --- Supporting knobs (pacing and per-item budgets), same file for one home. ---

/** Queries issued per round, popped from the planned-query queue. */
export const QUERIES_PER_ROUND = 6

/** Results requested per query from each channel. */
export const RESULTS_PER_QUERY = 5

/** Minimum Haiku relevance (0..1) for a scored item to be kept as relevant. */
export const MIN_RELEVANCE = 0.5

/** Items sent to the lightweight model per score-and-extract batch. */
export const SCORE_BATCH_SIZE = 6

/** Recency window used when the question does not specify one. */
export const DEFAULT_RECENCY_WINDOW_DAYS = 365
