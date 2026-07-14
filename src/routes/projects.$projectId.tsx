import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_RECENCY_INDEX, RECENCY_PRESETS } from '../ui/recency'
import { timeAgo } from '../ui/time'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectPage,
})

interface ProjectData {
  project: {
    id: string
    name: string
    description: string | null
    audiences: string[] | null
    topics: string[] | null
  }
  questions: Array<{
    id: string
    question: string
    status: string
    parentQuestionId: string | null
    createdAt: string
  }>
}

interface DocumentRow {
  id: string
  fileName: string
  status: string | null
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return '📊'
  if (ext === 'json') return '🧾'
  return '📝'
}

function statusPill(status: string): { className: string; label: string } {
  if (status === 'complete') return { className: 'pill pill-green', label: 'complete' }
  if (status === 'failed') return { className: 'pill pill-coral', label: 'failed' }
  return { className: 'pill pill-blue', label: status }
}

function ProjectPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<ProjectData | null>(null)
  const [question, setQuestion] = useState('')
  const [recencyIdx, setRecencyIdx] = useState(DEFAULT_RECENCY_INDEX)
  const [asking, setAsking] = useState(false)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const load = () =>
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))

  const loadDocuments = () =>
    fetch(`/api/projects/${projectId}/documents`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setDocuments)
      .catch(() => setDocuments([]))

  useEffect(() => {
    void load()
    void loadDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const uploadDocument = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    const body = new FormData()
    body.append('file', file)
    const res = await fetch(`/api/projects/${projectId}/documents`, {
      method: 'POST',
      body,
    })
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      setUploadError(err.error ?? 'upload failed')
      return
    }
    void loadDocuments()
  }

  const ask = async () => {
    if (!question.trim() || asking) return
    setAsking(true)
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId,
        question,
        recencyWindowDays: RECENCY_PRESETS[recencyIdx]!.days,
      }),
    })
    const body = (await res.json()) as { questionId?: string }
    setAsking(false)
    if (body.questionId) {
      void navigate({
        to: '/questions/$questionId',
        params: { questionId: body.questionId },
      })
    }
  }

  if (data === null) return <p className="muted">Loading…</p>

  const { project, questions } = data
  const preset = RECENCY_PRESETS[recencyIdx]!

  return (
    <div>
      {/* Title row */}
      <h1 style={{ marginBottom: '0.25rem' }}>{project.name}</h1>
      {project.description ? (
        <p className="muted" style={{ margin: '0 0 0.25rem', fontSize: 13 }}>
          {project.description}
        </p>
      ) : null}

      {/* Context pills: audiences purple, topics amber */}
      {(project.audiences?.length ?? 0) > 0 || (project.topics?.length ?? 0) > 0 ? (
        <div className="tags">
          {(project.audiences ?? []).map((a) => (
            <span key={`a-${a}`} className="pill pill-audience">
              {a}
            </span>
          ))}
          {(project.topics ?? []).map((t) => (
            <span key={`t-${t}`} className="pill pill-topic">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {/* Question input card */}
      <div className="qcard" style={{ marginTop: '1.6rem' }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask()
            }
          }}
          placeholder="Ask a cultural question about your audience…"
          rows={2}
        />
        <div style={{ padding: '0.35rem 0.1rem 0.15rem' }}>
          <span className="label" style={{ marginBottom: '0.2rem' }}>
            Recency window: {preset.label} · {preset.days} days
          </span>
          <input
            type="range"
            min={0}
            max={RECENCY_PRESETS.length - 1}
            step={1}
            value={recencyIdx}
            onChange={(e) => setRecencyIdx(Number(e.target.value))}
          />
          <div
            className="muted"
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}
          >
            {RECENCY_PRESETS.map((p) => (
              <span key={p.label}>{p.label}</span>
            ))}
          </div>
        </div>
        <div className="qcard-toolbar">
          <span className="muted" style={{ fontSize: 12 }}>
            Enter runs. Shift+Enter for a new line.
          </span>
          <button type="button" onClick={() => void ask()} disabled={asking || !question.trim()}>
            {asking ? 'Running…' : 'Run now'}
          </button>
        </div>
      </div>

      {/* Files */}
      <h2>Files</h2>
      {documents.length > 0 ? (
        <ul className="clean">
          {documents.map((d) => (
            <li key={d.id} className="file-row">
              <span aria-hidden>{fileIcon(d.fileName)}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.fileName}
              </span>
              {d.status === 'ready' ? (
                <span className="pill pill-green">✓ ready</span>
              ) : d.status === 'error' ? (
                <span className="pill pill-coral">✕ error</span>
              ) : (
                <span className="pill pill-blue">
                  <span className="dot dot-blue pulse" style={{ width: 6, height: 6, marginRight: 5 }} />
                  {d.status ?? 'processing'}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ fontSize: 12, margin: '0 0 0.5rem' }}>
          Uploaded documents are searched first in every run.
        </p>
      )}
      <label className="dropzone">
        {uploading ? 'Uploading and embedding…' : '+ Add file · TXT, MD, CSV, JSON'}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.markdown,.csv,.json,text/*"
          style={{ display: 'none' }}
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void uploadDocument(file)
          }}
        />
      </label>
      {uploadError ? (
        <p style={{ color: 'var(--coral)', fontSize: 12, marginTop: '0.4rem' }}>{uploadError}</p>
      ) : null}

      {/* Questions: follow-ups render indented under their parent (3 levels max). */}
      <h2>Questions</h2>
      {questions.length === 0 ? (
        <p className="muted">No questions asked yet.</p>
      ) : (
        <QuestionTree questions={questions} />
      )}
    </div>
  )
}

type QuestionRow = ProjectData['questions'][number]

/**
 * Render root questions newest-first with their follow-up chains indented
 * beneath them (a left rail per level, capped at 3 levels of follow-up).
 */
function QuestionTree({ questions }: { questions: QuestionRow[] }) {
  const byParent = new Map<string, QuestionRow[]>()
  const ids = new Set(questions.map((q) => q.id))
  const roots: QuestionRow[] = []
  for (const q of questions) {
    if (q.parentQuestionId && ids.has(q.parentQuestionId)) {
      const list = byParent.get(q.parentQuestionId) ?? []
      list.push(q)
      byParent.set(q.parentQuestionId, list)
    } else {
      roots.push(q)
    }
  }
  // Children read top-down in creation order; roots stay newest-first.
  for (const list of byParent.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  const renderRow = (q: QuestionRow, depth: number): React.ReactNode => {
    const pill = statusPill(q.status)
    const children = byParent.get(q.id) ?? []
    return (
      <li key={q.id}>
        <div
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: depth > 0 ? '0.55rem 0.9rem' : '0.7rem 1rem',
            marginLeft: Math.min(depth, 3) * 22,
            borderLeft: depth > 0 ? '3px solid var(--blue-light)' : undefined,
            marginBottom: '0.5rem',
          }}
        >
          <span
            className={
              q.status === 'complete'
                ? 'dot dot-green'
                : q.status === 'failed'
                  ? 'dot dot-coral'
                  : 'dot dot-blue pulse'
            }
          />
          <Link
            to="/questions/$questionId"
            params={{ questionId: q.id }}
            style={{
              flex: 1,
              color: 'var(--text)',
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: depth > 0 ? 13 : 14,
            }}
          >
            {depth > 0 ? <span className="muted">↳ </span> : null}
            {q.question}
          </Link>
          <span className={pill.className}>{pill.label}</span>
          <span className="muted" style={{ fontSize: 11, flexShrink: 0 }}>
            {timeAgo(q.createdAt)}
          </span>
        </div>
        {children.length > 0 ? (
          <ul className="clean">{children.map((c) => renderRow(c, depth + 1))}</ul>
        ) : null}
      </li>
    )
  }

  return <ul className="clean">{roots.map((q) => renderRow(q, 0))}</ul>
}
