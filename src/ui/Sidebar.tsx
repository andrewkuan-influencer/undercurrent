import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { signOut } from '../auth/client'
import type { SessionUser } from '../auth/session'
import { timeAgo } from './time'

/**
 * Fixed 240px sidebar (docs/UI.md): wordmark, a "+ New" project form, the
 * project list with lazily loaded question rows, and the account bar. Selecting
 * a project both navigates to it and toggles its questions open.
 */

interface ProjectRow {
  id: string
  name: string
  description: string | null
}

interface QuestionRow {
  id: string
  question: string
  status: string
  createdAt: string
}

function statusDot(status: string): string {
  if (status === 'complete') return 'dot dot-green'
  if (status === 'failed') return 'dot dot-coral'
  return 'dot dot-blue pulse'
}

export function Sidebar({ user }: { user: SessionUser }) {
  const navigate = useNavigate()
  const pathname = useLocation({ select: (l) => l.pathname })
  const [projects, setProjects] = useState<ProjectRow[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Record<string, QuestionRow[]>>({})
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [audiences, setAudiences] = useState('')
  const [topics, setTopics] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () =>
    fetch('/api/projects')
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]))

  useEffect(() => {
    void load()
  }, [])

  const loadQuestions = (projectId: string) =>
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((body: { questions?: QuestionRow[] }) =>
        setQuestions((prev) => ({ ...prev, [projectId]: body.questions ?? [] })),
      )
      .catch(() => undefined)

  const selectProject = (id: string) => {
    if (expanded === id) {
      setExpanded(null)
    } else {
      setExpanded(id)
      if (!questions[id]) void loadQuestions(id)
    }
    void navigate({ to: '/projects/$projectId', params: { projectId: id } })
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description, audiences, topics }),
    })
    const body = (await res.json().catch(() => null)) as { id?: string } | null
    setSaving(false)
    setName('')
    setDescription('')
    setAudiences('')
    setTopics('')
    setFormOpen(false)
    void load()
    if (body?.id) {
      void navigate({ to: '/projects/$projectId', params: { projectId: body.id } })
    }
  }

  const selectedId = pathname.startsWith('/projects/')
    ? pathname.split('/')[2]
    : null

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/" className="wordmark">
          <span className="star">✦</span> Undercurrent
        </Link>
        <button
          type="button"
          className={formOpen ? 'secondary btn-pill' : 'btn-blue btn-pill'}
          onClick={() => setFormOpen((v) => !v)}
        >
          {formOpen ? 'Cancel' : '+ New'}
        </button>
      </div>

      <div className="sidebar-body">
        {formOpen ? (
          <form onSubmit={create} className="stack" style={{ padding: '0.25rem 0.3rem 0.9rem' }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Client or brief (optional)"
            />
            <input
              type="text"
              value={audiences}
              onChange={(e) => setAudiences(e.target.value)}
              placeholder="Audiences, comma separated"
            />
            <input
              type="text"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Topics, comma separated"
            />
            <button type="submit" className="btn-blue btn-pill" disabled={saving || !name.trim()} style={{ width: '100%' }}>
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </form>
        ) : null}

        <span className="label" style={{ padding: '0 0.6rem', fontSize: 10 }}>
          Projects
        </span>
        {projects === null ? (
          <p className="muted" style={{ fontSize: 12, padding: '0 0.6rem' }}>Loading…</p>
        ) : projects.length === 0 ? (
          <p className="muted" style={{ fontSize: 12, padding: '0 0.6rem' }}>
            No projects yet. Use + New above.
          </p>
        ) : (
          projects.map((p) => (
            <div key={p.id}>
              <button
                type="button"
                className={`proj-row${selectedId === p.id ? ' selected' : ''}`}
                onClick={() => selectProject(p.id)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
                <span className="count">{expanded === p.id ? '−' : '+'}</span>
              </button>
              {expanded === p.id
                ? (questions[p.id] ?? []).map((q) => (
                    <Link
                      key={q.id}
                      to="/questions/$questionId"
                      params={{ questionId: q.id }}
                      className="q-row"
                    >
                      <span className={statusDot(q.status)} style={{ marginTop: 4 }} />
                      <span>
                        <span className="q-text">{q.question}</span>
                        <span className="q-meta">
                          {q.status} · {timeAgo(q.createdAt)}
                        </span>
                      </span>
                    </Link>
                  ))
                : null}
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <span
          className="muted"
          style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={user.email}
        >
          {user.email}
          {user.role ? <span className="pill pill-blue">{user.role}</span> : null}
        </span>
        <button
          type="button"
          className="secondary btn-pill"
          onClick={() => {
            void signOut().then(() => {
              window.location.href = '/signin'
            })
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
