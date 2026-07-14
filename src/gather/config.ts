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

/** The loop's caps for one run, scaled from the question's recency window. */
export interface LoopBudget {
  readonly maxRounds: number
  readonly maxSources: number
  readonly minSourcesPerFacet: number
}

/**
 * Wider windows earn deeper research: five years has more ground to cover than
 * two weeks. Coverage and saturation stay the primary stop conditions; these
 * budgets are the caps. The base tier equals the constants above, so narrow
 * questions behave exactly as before.
 */
export function loopBudgetFor(recencyWindowDays: number): LoopBudget {
  if (recencyWindowDays <= 31) {
    return {
      maxRounds: MAX_ROUNDS,
      maxSources: MAX_SOURCES,
      minSourcesPerFacet: MIN_SOURCES_PER_FACET,
    }
  }
  if (recencyWindowDays <= 274) {
    return { maxRounds: 6, maxSources: 60, minSourcesPerFacet: 4 }
  }
  if (recencyWindowDays <= 730) {
    return { maxRounds: 8, maxSources: 80, minSourcesPerFacet: 5 }
  }
  return { maxRounds: 10, maxSources: 100, minSourcesPerFacet: 6 }
}

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
