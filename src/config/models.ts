/**
 * Model allocation (PRD 5.4, CLAUDE.md). The main model does the planning call
 * and the single synthesis call; the lightweight model does all per-item,
 * high-volume work. Slugs are OpenRouter model ids; this is the one place they
 * are defined. All model calls go through OpenRouter on the Influencer key,
 * never a provider directly.
 *
 * If OpenRouter rejects a slug, changing it here is the only edit needed.
 */
export const MAIN_MODEL = 'anthropic/claude-sonnet-4.6'
export const LIGHTWEIGHT_MODEL = 'anthropic/claude-haiku-4.5'
