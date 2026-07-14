import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/**
 * Workspace empty state (docs/UI.md): project creation and navigation live in
 * the sidebar, so the canvas just points there and seeds a few question ideas.
 */
const DEMO_QUESTIONS = [
  'How is Gen Z redefining luxury in 2026?',
  'What is driving the backlash against fast fashion among UK consumers?',
  'Why are young men suddenly into skincare?',
]

function HomePage() {
  return (
    <div style={{ textAlign: 'center', paddingTop: '18vh' }}>
      <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden>
        🔍
      </div>
      <h1 style={{ marginTop: '1rem' }}>Select a project to start</h1>
      <p className="muted" style={{ maxWidth: 380, margin: '0 auto' }}>
        Pick a project in the sidebar, or create one with <strong>+ New</strong>.
        Every question runs against live web and Reddit evidence.
      </p>

      <div style={{ maxWidth: 420, margin: '2.5rem auto 0', textAlign: 'left' }}>
        <span className="label">Questions to try</span>
        <ul className="clean stack">
          {DEMO_QUESTIONS.map((q) => (
            <li
              key={q}
              className="muted"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '0.6rem 0.85rem',
                fontSize: 13,
                background: 'var(--surface)',
              }}
            >
              → {q}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
