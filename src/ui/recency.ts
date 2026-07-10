/**
 * Recency presets for the question box slider, mapping to recency_window_days
 * on the question (PRD 4.4). Client-safe: no server imports.
 */
export const RECENCY_PRESETS = [
  { label: '2 weeks', days: 14 },
  { label: '3 months', days: 91 },
  { label: '1 year', days: 365 },
  { label: '3 years', days: 1095 },
] as const

/** Default preset index (1 year). */
export const DEFAULT_RECENCY_INDEX = 2
