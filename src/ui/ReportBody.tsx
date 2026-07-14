import type { InsightView, RenderedSourceView } from './insightView'
import { SECTION_TONES, type SectionTone } from './reportTheme'

/** Colour-coded uppercase section label, so the report reads as a designed document. */
function Eyebrow({ tone, children }: { tone: SectionTone; children: string }) {
  return (
    <div>
      <span className="eyebrow" style={{ color: tone.fg, background: tone.bg }}>
        {children}
      </span>
    </div>
  )
}

/**
 * The read-only rendering of the six report components plus the verified sources
 * list (PRD 4.3). Shared by the question page and the public shared page so both
 * render identically. Citation superscripts link to the sources by position.
 */
export function ReportBody({
  insight,
  sources,
}: {
  insight: InsightView
  sources: RenderedSourceView[]
}) {
  const indexById = new Map<string, number>()
  sources.forEach((s, i) => indexById.set(s.id, i + 1))

  const Cites = ({ ids }: { ids: string[] }) => {
    const refs = ids
      .map((id) => indexById.get(id))
      .filter((n): n is number => !!n)
    if (refs.length === 0) return null
    return (
      <sup>
        {refs.map((n) => (
          <span key={n}>
            {' '}
            <a href={`#source-${n}`}>[{n}]</a>
          </span>
        ))}
      </sup>
    )
  }

  return (
    <div className="prose">
      <Eyebrow tone={SECTION_TONES.headline}>Headline reframe</Eyebrow>
      <p style={{ fontSize: '1.35rem', lineHeight: 1.35, fontWeight: 500, letterSpacing: '-0.01em' }}>
        {insight.headline.reframe}
        <Cites ids={insight.headline.citations} />
      </p>
      <div className="stack">
        <div>
          <strong>Obvious.</strong> {insight.headline.obvious}
        </div>
        <div>
          <strong>Unexpected.</strong> {insight.headline.unexpected}
        </div>
        <div>
          <strong>Interesting.</strong> {insight.headline.interesting}
        </div>
      </div>

      <Eyebrow tone={SECTION_TONES.topic}>Topic breakdown</Eyebrow>
      <ul className="clean stack">
        {insight.topicBreakdown.map((t, i) => (
          <li key={i}>
            <strong>{t.topic}.</strong> {t.summary}
            <Cites ids={t.citations} />
          </li>
        ))}
      </ul>

      <Eyebrow tone={SECTION_TONES.tensions}>Tensions</Eyebrow>
      <ul className="clean stack">
        {insight.tensions.map((t, i) => (
          <li key={i}>
            {t.tension}
            <Cites ids={t.citations} />
          </li>
        ))}
      </ul>

      <Eyebrow tone={SECTION_TONES.consumer}>Consumer voice</Eyebrow>
      <ul className="clean stack">
        {insight.consumerVoice.map((c, i) => (
          <li key={i}>
            <div>
              {c.observation}
              <Cites ids={c.citations} />
            </div>
            {c.verbatim ? <blockquote>{c.verbatim}</blockquote> : null}
          </li>
        ))}
      </ul>

      <Eyebrow tone={SECTION_TONES.creator}>Suggested creator angles</Eyebrow>
      <ul className="clean stack">
        {insight.creatorAngles.map((a, i) => (
          <li key={i}>
            <strong>{a.angle}.</strong> {a.rationale}
            <Cites ids={a.citations} />
          </li>
        ))}
      </ul>

      <Eyebrow tone={SECTION_TONES.sources}>Verified sources</Eyebrow>
      <ol className="clean stack">
        {sources.map((s, i) => (
          <li key={s.id} id={`source-${i + 1}`} className="card">
            <div>
              <span className="muted">[{i + 1}]</span>{' '}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title ?? s.url}
                </a>
              ) : (
                <span>{s.title ?? 'Untitled source'}</span>
              )}
              <span className="pill">{s.channel}</span>
              {s.voice ? <span className="pill">{s.voice}</span> : null}
              {s.verifiedLive ? <span className="pill">verified</span> : null}
            </div>
            {s.excerpt ? (
              <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.9rem' }}>
                {s.excerpt.slice(0, 280)}
                {s.excerpt.length > 280 ? '…' : ''}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}
