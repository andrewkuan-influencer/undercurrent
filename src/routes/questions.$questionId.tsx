import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { KebabMenu } from '../ui/KebabMenu'
import {
  emitProjectViewed,
  emitQuestionCreated,
  emitQuestionDeleted,
} from '../ui/events'
import { ReportBody } from '../ui/ReportBody'
import { recencyLabel } from '../ui/recency'
import type { InsightView, RenderedSourceView } from '../ui/insightView'

export const Route = createFileRoute('/questions/$questionId')({
  component: QuestionPage,
})

interface QuestionStats {
  web: number
  reddit: number
  doc: number
  queries: number
}

interface QuestionData {
  id: string
  projectId: string
  question: string
  status: string
  recencyWindowDays: number | null
  parentQuestionId: string | null
  errorDetail: string | null
  stats: QuestionStats
  depth: number
  result: {
    resultId: string
    insight: InsightView
    sources: RenderedSourceView[]
    shareToken: string | null
  } | null
}

const RUNNING = new Set(['gathering', 'synthesising'])
const MAX_FOLLOW_UP_DEPTH = 3

function QuestionPage() {
  const { questionId } = Route.useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<QuestionData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevStatus = useRef<string | null>(null)

  // Tell the sidebar which project this question belongs to (auto-expand +
  // refresh). Keyed on the projectId value so it fires once, not per poll.
  const projectId = data?.projectId
  useEffect(() => {
    if (projectId) emitProjectViewed(projectId)
  }, [projectId])

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

      // Fire a system notification when a run finishes while the tab is hidden.
      if (
        prevStatus.current &&
        RUNNING.has(prevStatus.current) &&
        !RUNNING.has(body.status) &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        document.visibilityState === 'hidden'
      ) {
        const note = new Notification(
          body.status === 'complete' ? 'Report ready' : 'Run did not complete',
          { body: body.question.slice(0, 120) },
        )
        note.onclick = () => window.focus()
      }
      prevStatus.current = body.status

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

  const doDelete = async () => {
    setDeleting(true)
    const res = await fetch(`/api/questions/${questionId}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) return
    const body = (await res.json()) as { projectId?: string }
    setConfirmDelete(false)
    const target = body.projectId ?? data.projectId
    emitQuestionDeleted(target)
    void navigate({ to: '/projects/$projectId', params: { projectId: target } })
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '0 0 0.6rem',
        }}
      >
        <Link
          to="/projects/$projectId"
          params={{ projectId: data.projectId }}
          className="muted"
          style={{ fontSize: 12, textDecoration: 'none' }}
        >
          ← Back to project
        </Link>
        <KebabMenu
          label="Question actions"
          items={[
            {
              label: 'Delete',
              tone: 'danger',
              onSelect: () => setConfirmDelete(true),
            },
          ]}
        />
      </div>
      {confirmDelete ? (
        <ConfirmDialog
          title="Delete this question?"
          body="Its report and follow-ups will also be deleted."
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={() => void doDelete()}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
      <h1 className="prose">{data.question}</h1>
      <p className="muted" style={{ fontSize: 12 }}>
        {data.parentQuestionId ? (
          <span className="pill" style={{ marginLeft: 0, marginRight: 6 }}>
            follow-up
          </span>
        ) : null}
        Recency window:{' '}
        {data.recencyWindowDays ? recencyLabel(data.recencyWindowDays) : '?'}.
      </p>

      <StatStrip stats={data.stats} />

      {RUNNING.has(data.status) ? (
        <RunStatus
          status={data.status}
          recencyWindowDays={data.recencyWindowDays}
        />
      ) : data.status === 'failed' ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            This run did not complete. It may have found no usable evidence. You
            can try a broader question or a wider recency window.
          </p>
          {data.errorDetail ? (
            <p
              className="muted"
              style={{
                margin: '0.6rem 0 0',
                fontSize: 11,
                fontFamily: 'ui-monospace, monospace',
                wordBreak: 'break-word',
              }}
            >
              {data.errorDetail}
            </p>
          ) : null}
        </div>
      ) : data.result ? (
        <div>
          <ShareBar shareToken={data.result.shareToken} />
          <ReportBody
            insight={data.result.insight}
            sources={data.result.sources}
          />
          <h2>Dive deeper</h2>
          {data.depth >= MAX_FOLLOW_UP_DEPTH ? (
            <p className="muted" style={{ fontSize: 13 }}>
              Follow-up limit reached. Start a fresh question to go further.
            </p>
          ) : (
            <DiveBox
              questionId={questionId}
              onDive={(id) => {
                emitQuestionCreated(data.projectId)
                void navigate({ to: '/questions/$questionId', params: { questionId: id } })
              }}
            />
          )}
        </div>
      ) : (
        <p className="muted">No report available.</p>
      )}
    </div>
  )
}

/**
 * Evidence summary strip: sources by channel plus queries issued (PRD 5.4).
 * All four counters render from the start of a run (zeros counting up) so the
 * strip never pops in mid-research.
 */
function StatStrip({ stats }: { stats: QuestionStats }) {
  if (!stats) return null
  const item = (n: number, label: string) => (
    <span>
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</strong>{' '}
      <span className="muted">{label}</span>
    </span>
  )
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        gap: '1.25rem',
        flexWrap: 'wrap',
        padding: '0.6rem 1rem',
        fontSize: 13,
        alignItems: 'center',
      }}
    >
      {item(stats.web, stats.web === 1 ? 'website' : 'websites')}
      {item(stats.reddit, 'Reddit')}
      {item(stats.doc, stats.doc === 1 ? 'document' : 'documents')}
      {item(stats.queries, 'queries run')}
    </div>
  )
}

/** No dead air during a run: rotate a playful waiting line every few seconds. */
const WAITING_MESSAGES = [
  'Asking Reddit very nicely…',
  'Reading the comments so you do not have to…',
  'Cross-referencing the group chat of the internet…',
  'Sorting signal from noise…',
  'Politely interviewing the web…',
  'Counting hot takes…',
  'Following the thread, literally…',
  'Checking who actually said what…',
  'Sifting for verbatims worth quoting…',
  'Weighing the obvious against the unexpected…',
  'Chasing the tension in the replies…',
  'Filtering out the bots…',
  'Taking the temperature of culture…',
  'Connecting dots across a hundred tabs…',
]

function RunStatus({
  status,
  recencyWindowDays,
}: {
  status: string
  recencyWindowDays: number | null
}) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [notifyState, setNotifyState] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  )

  useEffect(() => {
    const t = setInterval(
      () => setMsgIdx((i) => (i + 1) % WAITING_MESSAGES.length),
      2500,
    )
    return () => clearInterval(t)
  }, [])

  const wideWindow = (recencyWindowDays ?? 0) >= 365
  const message =
    status === 'gathering'
      ? 'Gathering evidence across the web and Reddit…'
      : 'Writing the report from the evidence…'

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          padding: '0.7rem 1.1rem',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
        }}
      >
        <span className="dot dot-green pulse" />
        <span className="label" style={{ margin: 0, color: 'var(--text)' }}>
          {status === 'gathering' ? 'Agent researching…' : 'Synthesising…'}
        </span>
        {notifyState === 'default' ? (
          <button
            type="button"
            className="secondary btn-pill"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              void Notification.requestPermission().then(setNotifyState)
            }}
          >
            Notify me when done
          </button>
        ) : notifyState === 'granted' ? (
          <span className="muted" style={{ marginLeft: 'auto', fontSize: 11 }}>
            ✓ You will be notified
          </span>
        ) : null}
      </div>
      <div style={{ padding: '0.8rem 1.1rem' }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {message}{' '}
          {wideWindow
            ? 'Wider windows dig deeper, so this can take several minutes.'
            : 'This can take a minute or two.'}{' '}
          You can close this page, the run continues on the server.
        </p>
        <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: 12, fontStyle: 'italic' }}>
          {WAITING_MESSAGES[msgIdx]}
        </p>
      </div>
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
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        margin: '0 0 0.75rem',
      }}
    >
      <button
        type="button"
        className="secondary btn-pill"
        onClick={() => {
          void navigator.clipboard.writeText(shareUrl).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
      >
        {copied ? '✓ Copied' : 'Copy shareable link'}
      </button>
      <a
        className="button-link"
        style={{ borderRadius: 99, padding: '0.3rem 0.8rem', fontSize: 12 }}
        href={`/api/share/${shareToken}/pdf`}
      >
        Export PDF
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
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUp.trim()) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/questions/${questionId}/dive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: followUp }),
    })
    const body = (await res.json()) as { questionId?: string; error?: string }
    setBusy(false)
    if (body.questionId) onDive(body.questionId)
    else if (body.error) setError(body.error)
  }

  return (
    <form onSubmit={submit} className="stack">
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        A follow-up builds on this question's evidence and only retrieves what it
        newly needs.
      </p>
      <textarea
        value={followUp}
        onChange={(e) => setFollowUp(e.target.value)}
        placeholder="e.g. What does this mean for skincare specifically?"
      />
      {error ? (
        <p style={{ color: 'var(--coral)', fontSize: 13, margin: 0 }}>{error}</p>
      ) : null}
      <div>
        <button type="submit" disabled={busy || !followUp.trim()}>
          {busy ? 'Starting…' : 'Ask follow-up'}
        </button>
      </div>
    </form>
  )
}
