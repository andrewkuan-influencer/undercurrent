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

  const load = () =>
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

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
