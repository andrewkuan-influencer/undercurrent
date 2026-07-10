import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { DEFAULT_RECENCY_INDEX, RECENCY_PRESETS } from '../ui/recency'

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

function ProjectPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<ProjectData | null>(null)
  const [question, setQuestion] = useState('')
  const [recencyIdx, setRecencyIdx] = useState(DEFAULT_RECENCY_INDEX)
  const [asking, setAsking] = useState(false)
  const [documents, setDocuments] = useState<
    Array<{ id: string; fileName: string; status: string | null }>
  >([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

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

  const uploadDocument = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const input = form.elements.namedItem('file') as HTMLInputElement | null
    const file = input?.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const body = new FormData()
    body.append('file', file)
    const res = await fetch(`/api/projects/${projectId}/documents`, {
      method: 'POST',
      body,
    })
    setUploading(false)
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      setUploadError(err.error ?? 'upload failed')
      return
    }
    form.reset()
    void loadDocuments()
  }

  const ask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return
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
      <p className="muted">
        <Link to="/">Projects</Link> / {project.name}
      </p>
      <h1>{project.name}</h1>
      {project.description ? <p className="prose">{project.description}</p> : null}
      {(project.audiences?.length ?? 0) > 0 || (project.topics?.length ?? 0) > 0 ? (
        <div className="tags">
          {(project.audiences ?? []).map((a) => (
            <span key={`a-${a}`} className="tag">
              audience: {a}
            </span>
          ))}
          {(project.topics ?? []).map((t) => (
            <span key={`t-${t}`} className="tag">
              topic: {t}
            </span>
          ))}
        </div>
      ) : null}

      <h2>Documents</h2>
      {documents.length === 0 ? (
        <p className="muted">
          No documents yet. Uploaded documents are searched first in every run.
        </p>
      ) : (
        <ul className="clean">
          {documents.map((d) => (
            <li key={d.id} className="card">
              {d.fileName}
              <span className="pill">{d.status ?? 'unknown'}</span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={uploadDocument} className="stack prose">
        <div>
          <label htmlFor="file">Upload a document (text or markdown)</label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".txt,.md,.markdown,.csv,.json,text/*"
          />
        </div>
        <div>
          <button type="submit" disabled={uploading}>
            {uploading ? 'Uploading and embedding…' : 'Upload'}
          </button>
          {uploadError ? (
            <span className="muted" style={{ marginLeft: '0.6rem' }}>
              {uploadError}
            </span>
          ) : null}
        </div>
      </form>

      <h2>Ask a question</h2>
      <form onSubmit={ask} className="stack prose">
        <div>
          <label htmlFor="question">Question</label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How is Gen Z thinking about secondhand fashion?"
          />
        </div>
        <div>
          <label htmlFor="recency">
            Recency window: <strong>{preset.label}</strong>{' '}
            <span className="muted">({preset.days} days)</span>
          </label>
          <input
            id="recency"
            type="range"
            min={0}
            max={RECENCY_PRESETS.length - 1}
            step={1}
            value={recencyIdx}
            onChange={(e) => setRecencyIdx(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div
            className="muted"
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}
          >
            {RECENCY_PRESETS.map((p) => (
              <span key={p.label}>{p.label}</span>
            ))}
          </div>
        </div>
        <div>
          <button type="submit" disabled={asking || !question.trim()}>
            {asking ? 'Starting…' : 'Run report'}
          </button>
        </div>
      </form>

      <h2>Questions</h2>
      {questions.length === 0 ? (
        <p className="muted">No questions asked yet.</p>
      ) : (
        <ul className="clean">
          {questions.map((q) => (
            <li key={q.id} className="card">
              <Link to="/questions/$questionId" params={{ questionId: q.id }}>
                {q.question}
              </Link>
              <span className="pill">{q.status}</span>
              {q.parentQuestionId ? <span className="pill">follow-up</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
