import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { signOut } from '../auth/client'
import type { SessionUser } from '../auth/session'
import {
  EV_PROJECT_CREATED,
  EV_PROJECT_DELETED,
  EV_PROJECT_VIEWED,
  EV_QUESTION_CREATED,
  EV_QUESTION_DELETED,
  useWindowEvent,
} from './events'
import { recencyLabel } from './recency'
import { timeAgo } from './time'

/**
 * Resizable sidebar (docs/UI.md): wordmark, "+ New", the project list with
 * lazily loaded question rows (follow-ups indented under their parents), and
 * the account bar. Live updates come from the window-event bus (creations,
 * deletions, project views) plus a light poll that only runs while a visible
 * question is still researching; new rows fade in.
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
  parentQuestionId: string | null
  recencyWindowDays: number | null
  createdAt: string
}

/** A question row plus its computed follow-up depth, in parent-first order. */
interface TreeRow {
  q: QuestionRow
  depth: number
}

function statusDot(status: string): string {
  if (status === 'complete') return 'dot dot-green'
  if (status === 'failed') return 'dot dot-coral'
  return 'dot dot-blue pulse'
}

const RUNNING = new Set(['gathering', 'synthesising'])

/** Sidebar width persistence bounds. */
const MIN_WIDTH = 180
const MAX_WIDTH = 420
const DEFAULT_WIDTH = 240
const WIDTH_KEY = 'uc:sidebar-w'

/** Flatten questions into parent-first order with depth, mirroring the canvas tree. */
function toTree(rows: QuestionRow[]): TreeRow[] {
  const ids = new Set(rows.map((q) => q.id))
  const byParent = new Map<string, QuestionRow[]>()
  const roots: QuestionRow[] = []
  for (const q of rows) {
    if (q.parentQuestionId && ids.has(q.parentQuestionId)) {
      const list = byParent.get(q.parentQuestionId) ?? []
      list.push(q)
      byParent.set(q.parentQuestionId, list)
    } else {
      roots.push(q)
    }
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }
  const out: TreeRow[] = []
  const walk = (q: QuestionRow, depth: number) => {
    out.push({ q, depth: Math.min(depth, 3) })
    for (const child of byParent.get(q.id) ?? []) walk(child, depth + 1)
  }
  for (const root of roots) walk(root, 0)
  return out
}

export function Sidebar({ user }: { user: SessionUser }) {
  const navigate = useNavigate()
  const pathname = useLocation({ select: (l) => l.pathname })
  const [projects, setProjects] = useState<ProjectRow[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Record<string, QuestionRow[]>>({})

  // Resizable width, persisted across sessions.
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY))
    if (saved >= MIN_WIDTH && saved <= MAX_WIDTH) setWidth(saved)
  }, [])
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(true)
    const move = (ev: PointerEvent) => {
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, ev.clientX)))
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragging(false)
      const final = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, ev.clientX))
      localStorage.setItem(WIDTH_KEY, String(final))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Fade-in bookkeeping: rows whose id was not in the previous render animate.
  // Null until the first data lands so the initial list does not animate.
  const prevProjectIds = useRef<Set<string> | null>(null)
  const prevQuestionIds = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (projects !== null) prevProjectIds.current = new Set(projects.map((p) => p.id))
  }, [projects])
  useEffect(() => {
    if (Object.keys(questions).length === 0 && prevQuestionIds.current === null) return
    prevQuestionIds.current = new Set(Object.values(questions).flat().map((q) => q.id))
  }, [questions])
  const isNewProject = (id: string) =>
    prevProjectIds.current !== null && !prevProjectIds.current.has(id)
  const isNewQuestion = (id: string) =>
    prevQuestionIds.current !== null && !prevQuestionIds.current.has(id)

  const load = useCallback(
    () =>
      fetch('/api/projects')
        .then((r) => r.json())
        .then(setProjects)
        .catch(() => setProjects([])),
    [],
  )

  // Reload the list when navigating (a new project may have just been created).
  useEffect(() => {
    void load()
  }, [pathname, load])

  const loadQuestions = useCallback(
    (projectId: string) =>
      fetch(`/api/projects/${projectId}`)
        .then((r) => r.json())
        .then((body: { questions?: QuestionRow[] }) =>
          setQuestions((prev) => ({ ...prev, [projectId]: body.questions ?? [] })),
        )
        .catch(() => undefined),
    [],
  )

  // Live updates: pages emit after mutations, we refetch just what changed.
  useWindowEvent(
    EV_PROJECT_CREATED,
    useCallback(() => void load(), [load]),
  )
  useWindowEvent(
    EV_PROJECT_DELETED,
    useCallback(() => void load(), [load]),
  )
  useWindowEvent(
    EV_QUESTION_CREATED,
    useCallback(
      (detail) => {
        if (!detail) return
        setExpanded(detail.projectId)
        void loadQuestions(detail.projectId)
      },
      [loadQuestions],
    ),
  )
  useWindowEvent(
    EV_QUESTION_DELETED,
    useCallback(
      (detail) => {
        if (detail) void loadQuestions(detail.projectId)
      },
      [loadQuestions],
    ),
  )
  // Auto-expand and refresh the project being viewed, so a question opened
  // from anywhere (including a fresh follow-up) is visible in the sidebar.
  useWindowEvent(
    EV_PROJECT_VIEWED,
    useCallback(
      (detail) => {
        if (!detail) return
        setExpanded(detail.projectId)
        void loadQuestions(detail.projectId)
      },
      [loadQuestions],
    ),
  )

  // While any visible question is still researching, poll so status dots move
  // in real time; the interval disappears as soon as nothing is running.
  const anyRunning =
    expanded !== null &&
    (questions[expanded] ?? []).some((q) => RUNNING.has(q.status))
  useEffect(() => {
    if (!anyRunning || !expanded) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void loadQuestions(expanded)
    }, 2500)
    return () => clearInterval(timer)
  }, [anyRunning, expanded, loadQuestions])

  const selectProject = (id: string) => {
    if (expanded === id) {
      setExpanded(null)
    } else {
      setExpanded(id)
      if (!questions[id]) void loadQuestions(id)
    }
    void navigate({ to: '/projects/$projectId', params: { projectId: id } })
  }

  const selectedId = pathname.startsWith('/projects/')
    ? pathname.split('/')[2]
    : null

  return (
    <aside className="sidebar" style={{ width, position: 'relative' }}>
      <div className="sidebar-header">
        <Link to="/" className="wordmark">
          <span className="star">✦</span> Undercurrent
        </Link>
        <Link
          to="/projects/new"
          className="button-link"
          style={{ borderRadius: 99, padding: '0.3rem 0.8rem', fontSize: 12, background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}
        >
          + New
        </Link>
      </div>

      <div className="sidebar-body">
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
            <div key={p.id} className={isNewProject(p.id) ? 'row-new' : undefined}>
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
                ? toTree(questions[p.id] ?? []).map(({ q, depth }) => (
                    <Link
                      key={q.id}
                      to="/questions/$questionId"
                      params={{ questionId: q.id }}
                      className={isNewQuestion(q.id) ? 'q-row row-new' : 'q-row'}
                      style={depth > 0 ? { paddingLeft: 10 + depth * 14 } : undefined}
                    >
                      <span className={statusDot(q.status)} style={{ marginTop: 4 }} />
                      <span style={{ minWidth: 0 }}>
                        <span className="q-text">
                          {depth > 0 ? '↳ ' : ''}
                          {q.question}
                        </span>
                        <span className="q-meta">
                          {q.status}
                          {q.recencyWindowDays
                            ? ` · ${recencyLabel(q.recencyWindowDays)}`
                            : ''}
                          {' · '}
                          {timeAgo(q.createdAt)}
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
          style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={user.email}
        >
          {user.name || user.email}
          {user.role === 'admin' ? <span className="pill pill-blue">admin</span> : null}
        </span>
        <button
          type="button"
          className="secondary btn-pill"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={() => {
            void signOut().then(() => {
              window.location.href = '/signin'
            })
          }}
        >
          Sign out
        </button>
      </div>

      <div
        className={dragging ? 'sidebar-resizer dragging' : 'sidebar-resizer'}
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
      />
    </aside>
  )
}
