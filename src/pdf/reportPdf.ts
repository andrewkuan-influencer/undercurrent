import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { InsightView, RenderedSourceView } from '../ui/insightView'

/**
 * Render a report to a PDF with pdf-lib (PRD 4.6). Pure JS, no native or font
 * dependencies, so it bundles cleanly for the serverless function. Lays out the
 * six components plus the verified sources list; plain typography (brand pass
 * deferred). Text is sanitised to WinAnsi since the standard fonts cannot encode
 * arbitrary Unicode.
 */

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 48
const BODY = 11
const LINE = 15
const INK = rgb(0.086, 0.094, 0.114)
const MUTED = rgb(0.34, 0.36, 0.39)
const RULE = rgb(0.79, 0.8, 0.82)

/** Standard PDF fonts are WinAnsi; map common Unicode down and drop the rest. */
function ascii(text: string): string {
  return text
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[  ]/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of ascii(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    lines.push(current)
  }
  return lines
}

export async function renderReportPdf(input: {
  question: string
  insight: InsightView
  sources: RenderedSourceView[]
}): Promise<Uint8Array> {
  const { question, insight, sources } = input
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const width = A4[0] - MARGIN * 2

  let page: PDFPage = doc.addPage(A4)
  let y = A4[1] - MARGIN

  const space = (amount: number) => {
    y -= amount
    if (y < MARGIN) {
      page = doc.addPage(A4)
      y = A4[1] - MARGIN
    }
  }

  const indexById = new Map<string, number>()
  sources.forEach((s, i) => indexById.set(s.id, i + 1))
  const refs = (ids: string[]) => {
    const ns = ids.map((id) => indexById.get(id)).filter((n): n is number => !!n)
    return ns.length ? ` [${ns.join(', ')}]` : ''
  }

  const drawText = (
    text: string,
    opts: { size?: number; font?: PDFFont; color?: typeof INK; gap?: number } = {},
  ) => {
    const size = opts.size ?? BODY
    const f = opts.font ?? font
    const lineHeight = size + 4
    for (const line of wrap(text, f, size, width)) {
      if (y < MARGIN) {
        page = doc.addPage(A4)
        y = A4[1] - MARGIN
      }
      page.drawText(line, { x: MARGIN, y: y - size, size, font: f, color: opts.color ?? INK })
      y -= lineHeight
    }
    if (opts.gap) space(opts.gap)
  }

  const eyebrow = (label: string) => {
    space(14)
    page.drawText(ascii(label).toUpperCase(), {
      x: MARGIN,
      y: y - 8,
      size: 8,
      font: bold,
      color: MUTED,
    })
    y -= 8
    page.drawLine({
      start: { x: MARGIN, y: y - 3 },
      end: { x: MARGIN + width, y: y - 3 },
      thickness: 0.5,
      color: RULE,
    })
    space(12)
  }

  // Title.
  drawText(question, { size: 18, font: bold, gap: 6 })

  eyebrow('Headline reframe')
  drawText(insight.headline.reframe + refs(insight.headline.citations), { size: 13, gap: 6 })
  drawText(`Obvious. ${insight.headline.obvious}`, { gap: 4 })
  drawText(`Unexpected. ${insight.headline.unexpected}`, { gap: 4 })
  drawText(`Interesting. ${insight.headline.interesting}`, { gap: 2 })

  eyebrow('Topic breakdown')
  for (const t of insight.topicBreakdown) {
    drawText(`${t.topic}. ${t.summary}${refs(t.citations)}`, { gap: 4 })
  }

  eyebrow('Tensions')
  for (const t of insight.tensions) {
    drawText(`${t.tension}${refs(t.citations)}`, { gap: 4 })
  }

  eyebrow('Consumer voice')
  for (const c of insight.consumerVoice) {
    drawText(`${c.observation}${refs(c.citations)}`, { gap: 2 })
    if (c.verbatim) drawText(`"${c.verbatim}"`, { color: MUTED, gap: 4 })
  }

  eyebrow('Suggested creator angles')
  for (const a of insight.creatorAngles) {
    drawText(`${a.angle}. ${a.rationale}${refs(a.citations)}`, { gap: 4 })
  }

  eyebrow('Verified sources')
  sources.forEach((s, i) => {
    const meta = [s.channel, s.voice ?? '', s.verifiedLive ? 'verified' : '']
      .filter(Boolean)
      .join(' / ')
    drawText(`[${i + 1}] ${s.title ?? s.url ?? 'Untitled source'} (${meta})`, {
      font: bold,
      gap: 0,
    })
    if (s.url) drawText(s.url, { size: 9, color: MUTED, gap: 4 })
  })

  return doc.save()
}
