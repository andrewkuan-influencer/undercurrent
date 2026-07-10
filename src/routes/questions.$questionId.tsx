import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/questions/$questionId')({
  component: QuestionPage,
})

interface Headline {
  reframe: string
  obvious: string
  unexpected: string
  interesting: string
  citations: string[]
}
interface InsightView {
  headline: Headline
  topicBreakdown: Array<{ topic: string; summary: string; citations: string[] }>
  tensions: Array<{ tension: string; citations: string[] }>
  consumerVoice: Array<{
    observation: string
    verbatim: string
    citations: string[]
  }>
  creatorAngles: Array<{ angle: string; rationale: string; citations: string[] }>
}
interface RenderedSource {
  id: string
  url: string | null
  title: string | null
  excerpt: string | null
  channel: string
  voice: string | null
  verifiedLive: boolean
}
interface QuestionData {
  id: string
  projectId: string
  question: string
  status: string
  recencyWindowDays: number | null
  parentQuestionId: string | null
  result: {
    resultId: string
    insight: InsightView
    sources: RenderedSource[]
  } | null
}

const RUNNING = new Set(['gathering', 'synthesising'])

function QuestionPage() {
  const { questionId } = Route.useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<QuestionData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let active = true
    const poll = async () => {
      const res = await fetch(`/api/questions/${questionId}`)
      if (res.status === 404) {
        if (active) setNotFound(true)
        return
      }
      const body = (await res.json()) as QuestionData
      if (!active) return
      setData(body)
      if (!RUNNING.has(body.status) && timer.current) {
        clearInterval(timer.current)
        timer.current = null
      }
    }
    void poll()
    timer.current = setInterval(poll, 2500)
    return () => {
      active = false
      if (timer.current) clearInterval(timer.current)
    }
  }, [questionId])

  if (notFound) return <p className="muted">Question not found.</p>
  if (data === null) return <p className="muted">Loading…</p>

  return (
    <div>
      <p className="muted">
        <Link to="/projects/$projectId" params={{ projectId: data.projectId }}>
          Back to project
        </Link>
      </p>
      <h1 className="prose">{data.question}</h1>
      <p className="muted">
        {data.parentQuestionId ? 'Follow-up question. ' : ''}
        Recency window: {data.recencyWindowDays ?? '?'} days.
      </p>

      {RUNNING.has(data.status) ? (
        <RunStatus status={data.status} />
      ) : data.status === 'failed' ? (
        <p className="card">
          This run did not complete. It may have found no usable evidence. You can
          try a broader question or a wider recency window.
        </p>
      ) : data.result ? (
        <Report
          insight={data.result.insight}
          sources={data.result.sources}
          questionId={questionId}
          onDive={(id) =>
            navigate({ to: '/questions/$questionId', params: { questionId: id } })
          }
        />
      ) : (
        <p className="muted">No report available.</p>
      )}
    </div>
  )
}

function RunStatus({ status }: { status: string }) {
  const message =
    status === 'gathering'
      ? 'Gathering evidence across the web and Reddit…'
      : 'Writing the report from the evidence…'
  return (
    <div className="card">
      <strong>{status === 'gathering' ? 'Gathering' : 'Synthesising'}</strong>
      <p className="muted" style={{ margin: '0.35rem 0 0' }}>
        {message} This can take a minute or two. The page updates itself.
      </p>
    </div>
  )
}

function Report({
  insight,
  sources,
  questionId,
  onDive,
}: {
  insight: InsightView
  sources: RenderedSource[]
  questionId: string
  onDive: (id: string) => void
}) {
  // Map cited source ids to their position in the sources list for inline refs.
  const indexById = new Map<string, number>()
  sources.forEach((s, i) => indexById.set(s.id, i + 1))

  const Cites = ({ ids }: { ids: string[] }) => {
    const refs = ids.map((id) => indexById.get(id)).filter((n): n is number => !!n)
    if (refs.length === 0) return null
    return (
      <sup>
        {refs.map((n, i) => (
          <span key={n}>
            {i > 0 ? ' ' : ' '}
            <a href={`#source-${n}`}>[{n}]</a>
          </span>
        ))}
      </sup>
    )
  }

  return (
    <div className="prose">
      <h2>Headline reframe</h2>
      <p style={{ fontSize: '1.25rem', lineHeight: 1.4 }}>
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

      <h2>Topic breakdown</h2>
      <ul className="clean stack">
        {insight.topicBreakdown.map((t, i) => (
          <li key={i}>
            <strong>{t.topic}.</strong> {t.summary}
            <Cites ids={t.citations} />
          </li>
        ))}
      </ul>

      <h2>Tensions</h2>
      <ul className="clean stack">
        {insight.tensions.map((t, i) => (
          <li key={i}>
            {t.tension}
            <Cites ids={t.citations} />
          </li>
        ))}
      </ul>

      <h2>Consumer voice</h2>
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

      <h2>Suggested creator angles</h2>
      <ul className="clean stack">
        {insight.creatorAngles.map((a, i) => (
          <li key={i}>
            <strong>{a.angle}.</strong> {a.rationale}
            <Cites ids={a.citations} />
          </li>
        ))}
      </ul>

      <h2>Verified sources</h2>
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

      <h2>Dive deeper</h2>
      <DiveBox questionId={questionId} onDive={onDive} />
    </div>
  )
}

function DiveBox({
  questionId,
  onDive,
}: {
  questionId: string
  onDive: (id: string) => void
}) {
  const [followUp, setFollowUp] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUp.trim()) return
    setBusy(true)
    const res = await fetch(`/api/questions/${questionId}/dive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: followUp }),
    })
    const body = (await res.json()) as { questionId?: string }
    setBusy(false)
    if (body.questionId) onDive(body.questionId)
  }

  return (
    <form onSubmit={submit} className="stack">
      <p className="muted" style={{ margin: 0 }}>
        A follow-up builds on this question's evidence and only retrieves what it
        newly needs.
      </p>
      <textarea
        value={followUp}
        onChange={(e) => setFollowUp(e.target.value)}
        placeholder="e.g. What does this mean for skincare specifically?"
      />
      <div>
        <button type="submit" disabled={busy || !followUp.trim()}>
          {busy ? 'Starting…' : 'Ask follow-up'}
        </button>
      </div>
    </form>
  )
}
