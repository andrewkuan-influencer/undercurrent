/**
 * Colour tones for the six report sections, so the report reads as a designed
 * document rather than a wall of text (PRD 4.3, 4.4). Each tone is a dark-text /
 * light-background pair used for the section's uppercase eyebrow label. Values
 * mirror the reference design's semantic label palette. Client-safe: no imports.
 */
export interface SectionTone {
  readonly fg: string
  readonly bg: string
}

export const SECTION_TONES: Record<
  'headline' | 'topic' | 'tensions' | 'consumer' | 'creator' | 'sources',
  SectionTone
> = {
  headline: { fg: '#0f766e', bg: '#ccfbf1' }, // teal, the hero
  topic: { fg: '#3c3489', bg: '#eeedfe' }, // indigo
  tensions: { fg: '#c2410c', bg: '#faece7' }, // clay
  consumer: { fg: '#065f46', bg: '#ecfdf5' }, // emerald
  creator: { fg: '#633806', bg: '#fffbeb' }, // amber
  sources: { fg: '#3f3f46', bg: '#f4f4f5' }, // neutral ink
}
