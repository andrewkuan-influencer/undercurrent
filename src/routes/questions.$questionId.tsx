import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ReportBody } from '../ui/ReportBody'
import type { InsightView, RenderedSourceView } from '../ui/insightView'

export const Route = createFileRoute('/questions/$questionId')({
  component: QuestionPage,
})

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
    sources: RenderedSourceView[]
    shareToken: string | null
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
        <div>
          <ShareBar shareToken={data.result.shareToken} />
          <ReportBody
            insight={data.result.insight}
            sources={data.result.sources}
          />
          <h2>Dive deeper</h2>
          <DiveBox
            questionId={questionId}
            onDive={(id) =>
              navigate({ to: '/questions/$questionId', params: { questionId: id } })
            }
          />
        </div>
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
      <strong>
        <span className="status-dot" />
        {status === 'gathering' ? 'Gathering' : 'Synthesising'}
      </strong>
      <p className="muted" style={{ margin: '0.35rem 0 0' }}>
        {message} This can take a minute or two. The page updates itself.
      </p>
    </div>
  )
}

function ShareBar({ shareToken }: { shareToken: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!shareToken) return null
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/share/${shareToken}`
      : `/share/${shareToken}`

  return (
    <div className="card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          void navigator.clipboard.writeText(shareUrl).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
      >
        {copied ? 'Copied' : 'Copy shareable link'}
      </button>
      <a className="button-link" href={`/api/share/${shareToken}/pdf`}>
        Download PDF
      </a>
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
