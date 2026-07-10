import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/')({
  component: ProjectsPage,
})

interface ProjectRow {
  id: string
  name: string
  description: string | null
  audiences: string[] | null
  topics: string[] | null
}

function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null)
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description, audiences, topics }),
    })
    setName('')
    setDescription('')
    setAudiences('')
    setTopics('')
    setSaving(false)
    void load()
  }

  return (
    <div>
      <h1>Projects</h1>

      <h2>Your projects</h2>
      {projects === null ? (
        <p className="muted">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="muted">No projects yet. Create one below.</p>
      ) : (
        <ul className="clean">
          {projects.map((p) => (
            <li key={p.id} className="card">
              <Link to="/projects/$projectId" params={{ projectId: p.id }}>
                <strong>{p.name}</strong>
              </Link>
              {p.description ? (
                <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                  {p.description}
                </p>
              ) : null}
              {(p.topics?.length ?? 0) > 0 || (p.audiences?.length ?? 0) > 0 ? (
                <div className="tags">
                  {(p.audiences ?? []).map((a) => (
                    <span key={`a-${a}`} className="tag">
                      audience: {a}
                    </span>
                  ))}
                  {(p.topics ?? []).map((t) => (
                    <span key={`t-${t}`} className="tag">
                      topic: {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <h2>New project</h2>
      <form onSubmit={submit} className="stack prose">
        <div>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Spring beauty brief"
          />
        </div>
        <div>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="audiences">Audiences (comma separated)</label>
          <input
            id="audiences"
            type="text"
            value={audiences}
            onChange={(e) => setAudiences(e.target.value)}
            placeholder="Gen Z, millennial parents"
          />
        </div>
        <div>
          <label htmlFor="topics">Topics (comma separated)</label>
          <input
            id="topics"
            type="text"
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="secondhand fashion, skincare"
          />
        </div>
        <div>
          <button type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  )
}
