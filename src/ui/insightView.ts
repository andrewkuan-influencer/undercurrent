/**
 * Plain view types for a rendered insight report, shared by the question page,
 * the shared page, and the PDF. Client-safe (no server imports); mirrors the
 * synthesis Insight schema shape.
 */
export interface InsightView {
  headline: {
    reframe: string
    obvious: string
    unexpected: string
    interesting: string
    citations: string[]
  }
  topicBreakdown: Array<{ topic: string; summary: string; citations: string[] }>
  tensions: Array<{ tension: string; citations: string[] }>
  consumerVoice: Array<{
    observation: string
    verbatim: string
    citations: string[]
  }>
  creatorAngles: Array<{ angle: string; rationale: string; citations: string[] }>
}

export interface RenderedSourceView {
  id: string
  url: string | null
  title: string | null
  excerpt: string | null
  channel: string
  voice: string | null
  verifiedLive: boolean
}
