import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ReportBody } from '../ui/ReportBody'
import type { InsightView, RenderedSourceView } from '../ui/insightView'

export const Route = createFileRoute('/share/$token')({
  component: SharePage,
})

interface SharedData {
  question: string
  insight: InsightView
  sources: RenderedSourceView[]
}

function SharePage() {
  const { token } = Route.useParams()
  const [data, setData] = useState<SharedData | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true)
          return null
        }
        return r.json()
      })
      .then((body) => body && setData(body))
      .catch(() => setNotFound(true))
  }, [token])

  if (notFound) return <p className="muted">This report link is not valid.</p>
  if (!data) return <p className="muted">Loading…</p>

  return (
    <div>
      <h1 className="prose">{data.question}</h1>
      <p
        className="muted"
        style={{
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          flexWrap: 'wrap',
          margin: '0 0 1rem',
        }}
      >
        Shared read-only report.
        <a
          className="button-link"
          style={{ borderRadius: 99, padding: '0.25rem 0.75rem', fontSize: 12 }}
          href={`/api/share/${token}/pdf`}
        >
          Export PDF
        </a>
      </p>
      <ReportBody insight={data.insight} sources={data.sources} />
    </div>
  )
}
