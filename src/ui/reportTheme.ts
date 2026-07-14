/**
 * Accent colours for the six report sections (docs/UI.md, InsightCard): each
 * section gets a 3px coloured left border and a matching uppercase 11px title.
 * Insight blue, tensions rust, quotes purple, creator angles amber, references
 * grey. Client-safe: no imports.
 */
export const SECTION_ACCENTS: Record<
  'headline' | 'topic' | 'tensions' | 'consumer' | 'creator' | 'sources',
  string
> = {
  headline: '#3C3489', // blue, the core insight
  topic: '#2d8c5a', // green
  tensions: '#c2410c', // rust
  consumer: '#7c3aed', // purple, verbatim quotes
  creator: '#d97706', // amber
  sources: '#888888', // grey, references
}
