/**
 * Recency presets for the question box slider, mapping to recency_window_days
 * on the question (PRD 4.4). Client-safe: no server imports.
 */
export const RECENCY_PRESETS = [
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 91 },
  { label: '6 months', days: 182 },
  { label: '9 months', days: 274 },
  { label: '1 year', days: 365 },
  { label: '2 years', days: 730 },
  { label: '3 years', days: 1095 },
  { label: '5 years', days: 1825 },
] as const

/** Default preset index (1 year). */
export const DEFAULT_RECENCY_INDEX = 5

/**
 * Human label for a stored day count: exact preset match wins, otherwise
 * approximate in years or months so older questions still read naturally.
 */
export function recencyLabel(days: number): string {
  const exact = RECENCY_PRESETS.find((p) => p.days === days)
  if (exact) return exact.label
  if (days >= 365) {
    const years = Math.round(days / 365)
    return years === 1 ? '1 year' : `${years} years`
  }
  if (days >= 28) {
    const months = Math.round(days / 30)
    return months === 1 ? '1 month' : `${months} months`
  }
  return `${days} days`
}
