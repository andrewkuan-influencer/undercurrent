import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { loadSharedResult } from '../../report/run'
import { renderReportPdf } from '../../pdf/reportPdf'
import type { InsightView } from '../../ui/insightView'
import { json } from '../../server/http'

/** Public PDF export of a report by share token (PRD 4.6). */
export const Route = createFileRoute('/api/share/$token/pdf')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const exit = await Effect.runPromiseExit(loadSharedResult(params.token))
        if (exit._tag === 'Failure') return json({ error: 'failed to load' }, 500)
        const shared = exit.value
        if (!shared) return json({ error: 'not found' }, 404)

        const pdf = await renderReportPdf({
          question: shared.question,
          insight: shared.insight as InsightView,
          sources: shared.sources,
        })
        return new Response(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), {
          headers: {
            'content-disposition': 'attachment; filename="undercurrent-report.pdf"',
          },
        })
      },
    },
  },
})
