import type { ReactNode } from 'react'
import type { InsightView, RenderedSourceView } from './insightView'
import { SECTION_ACCENTS } from './reportTheme'

/**
 * The read-only rendering of the six report components plus the verified sources
 * list (PRD 4.3), styled as the InsightCard from docs/UI.md: a white bordered
 * card whose sections carry a 3px coloured left border and a matching uppercase
 * title. Shared by the question page and the public shared page so both render
 * identically. Citation superscripts link to the sources by position.
 */

function Section({
  accent,
  title,
  children,
}: {
  accent: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="rsection" style={{ borderLeftColor: accent }}>
      <h3 className="rsection-title" style={{ color: accent }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Reference type marker per channel: purple r/ for Reddit, blue arrow for web, amber doc. */
function ChannelMark({ channel }: { channel: string }) {
  const mark =
    channel === 'reddit'
      ? { text: 'r/', color: '#7c3aed', bg: '#f5f3ff' }
      : channel === 'doc'
        ? { text: 'doc', color: '#d97706', bg: '#fffbeb' }
        : { text: '↗', color: '#2563eb', bg: '#eff6ff' }
  return (
    <span
      style={{
        display: 'inline-block',
        minWidth: '1.6em',
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 600,
        color: mark.color,
        background: mark.bg,
        borderRadius: 6,
        padding: '1px 5px',
        marginRight: 6,
      }}
    >
      {mark.text}
    </span>
  )
}

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
    <div className="card prose" style={{ padding: '1.5rem 1.5rem 1rem' }}>
      <Section accent={SECTION_ACCENTS.headline} title="Headline reframe">
        <p style={{ fontSize: 16, lineHeight: 1.45, fontWeight: 500, margin: '0 0 0.6rem' }}>
          {insight.headline.reframe}
          <Cites ids={insight.headline.citations} />
        </p>
        <div className="stack" style={{ fontSize: 13 }}>
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
      </Section>

      <Section accent={SECTION_ACCENTS.topic} title="Topic breakdown">
        <ul className="clean stack">
          {insight.topicBreakdown.map((t, i) => (
            <li key={i}>
              <strong>{t.topic}.</strong> {t.summary}
              <Cites ids={t.citations} />
            </li>
          ))}
        </ul>
      </Section>

      <Section accent={SECTION_ACCENTS.tensions} title="Tensions">
        <ul className="clean stack">
          {insight.tensions.map((t, i) => (
            <li key={i} style={{ display: 'flex', gap: '0.55rem' }}>
              <span
                className="dot"
                style={{ background: SECTION_ACCENTS.tensions, marginTop: 6 }}
              />
              <span>
                {t.tension}
                <Cites ids={t.citations} />
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section accent={SECTION_ACCENTS.consumer} title="Consumer voice">
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
      </Section>

      <Section accent={SECTION_ACCENTS.creator} title="Suggested creator angles">
        <ul className="clean stack">
          {insight.creatorAngles.map((a, i) => (
            <li key={i}>
              <strong>{a.angle}.</strong> {a.rationale}
              <Cites ids={a.citations} />
            </li>
          ))}
        </ul>
      </Section>

      <Section accent={SECTION_ACCENTS.sources} title="Verified sources">
        <ol className="clean stack">
          {sources.map((s, i) => (
            <li key={s.id} id={`source-${i + 1}`} style={{ fontSize: 13 }}>
              <div>
                <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  [{i + 1}]
                </span>{' '}
                <ChannelMark channel={s.channel} />
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title ?? s.url}
                  </a>
                ) : (
                  <span>{s.title ?? 'Untitled source'}</span>
                )}
                {s.voice ? <span className="pill">{s.voice}</span> : null}
                {s.verifiedLive ? <span className="pill pill-green">verified</span> : null}
              </div>
              {s.excerpt ? (
                <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: 12 }}>
                  {s.excerpt.slice(0, 280)}
                  {s.excerpt.length > 280 ? '…' : ''}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  )
}
