import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { emitProjectCreated } from '../ui/events'

export const Route = createFileRoute('/projects/new')({
  component: NewProjectPage,
})

/**
 * Canvas create page (replaces the raw inline sidebar form): labelled fields
 * with helper text, posting to the existing projects API and navigating to the
 * new project on success.
 */
function NewProjectPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [audiences, setAudiences] = useState('')
  const [topics, setTopics] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description, audiences, topics }),
    })
    const body = (await res.json().catch(() => null)) as { id?: string; error?: string } | null
    setSaving(false)
    if (!res.ok || !body?.id) {
      setError(body?.error ?? 'Could not create the project. Try again.')
      return
    }
    emitProjectCreated()
    void navigate({ to: '/projects/$projectId', params: { projectId: body.id } })
  }

  const helper = { fontSize: 12, margin: '0.25rem 0 0' } as const

  return (
    <div style={{ maxWidth: 480 }}>
      <h1>New project</h1>
      <p className="muted" style={{ margin: '0 0 1.5rem', fontSize: 13 }}>
        A project holds a client's questions, evidence, and documents in one
        place.
      </p>

      <form onSubmit={submit} className="stack">
        <div>
          <label htmlFor="name">Project name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Spring beauty brief"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="description">Client or brief</label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Glow Cosmetics, spring campaign"
          />
          <p className="muted" style={helper}>
            Optional. Shown under the project title.
          </p>
        </div>
        <div>
          <label htmlFor="audiences">Audiences</label>
          <input
            id="audiences"
            type="text"
            value={audiences}
            onChange={(e) => setAudiences(e.target.value)}
            placeholder="Gen Z, millennial parents"
          />
          <p className="muted" style={helper}>
            Optional, comma separated. Steers the research toward these groups.
          </p>
        </div>
        <div>
          <label htmlFor="topics">Topics</label>
          <input
            id="topics"
            type="text"
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="secondhand fashion, skincare"
          />
          <p className="muted" style={helper}>
            Optional, comma separated. Areas the project keeps coming back to.
          </p>
        </div>
        {error ? (
          <p style={{ color: 'var(--coral)', fontSize: 13, margin: 0 }}>{error}</p>
        ) : null}
        <div>
          <button type="submit" className="btn-blue" disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  )
}
