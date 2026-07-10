// Dev-only: load .env into process.env before anything that reads it (db client,
// model/config keys). Must be the first import.
import 'dotenv/config'
import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { Cause, Effect, Exit, Option } from 'effect'
import { db } from '../../../db/client'
import { projects, resultCitations, results } from '../../../db/schema'
import { RetrievalLive } from '../../../retrieval'
import { runReportOnce } from '../../../report/runReportOnce'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Find or create a stable throwaway project for dev runs. */
async function resolveProjectId(provided: string | null): Promise<string> {
  if (provided) return provided
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.name, 'Dev project'))
    .limit(1)
  if (existing[0]) return existing[0].id
  const created = await db
    .insert(projects)
    .values({ name: 'Dev project' })
    .returning({ id: projects.id })
  return created[0]!.id
}

const statusForError = (tag: string): number => {
  switch (tag) {
    case 'NoEvidenceError':
      return 404
    case 'UnknownCitationError':
    case 'InvalidModelOutputError':
    case 'ModelError':
      return 502
    default:
      return 500
  }
}

export const Route = createFileRoute('/api/dev/report')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (process.env.NODE_ENV === 'production') {
          return json({ error: 'not found' }, 404)
        }

        const url = new URL(request.url)
        const questionText = url.searchParams.get('q')
        if (!questionText) {
          return json({ error: 'missing ?q=<question text>' }, 400)
        }
        const projectId = await resolveProjectId(
          url.searchParams.get('projectId'),
        )
        const recencyParam = Number(url.searchParams.get('recencyDays'))
        const recencyDays =
          Number.isFinite(recencyParam) && recencyParam > 0
            ? recencyParam
            : undefined

        const exit = await Effect.runPromiseExit(
          runReportOnce(questionText, projectId, recencyDays).pipe(
            Effect.provide(RetrievalLive),
          ),
        )

        if (Exit.isFailure(exit)) {
          const failure = Option.getOrNull(Cause.failureOption(exit.cause))
          const tag =
            failure && typeof failure === 'object' && '_tag' in failure
              ? String((failure as { _tag: unknown })._tag)
              : 'UnknownError'
          const body = { error: tag, detail: Cause.pretty(exit.cause) }
          console.error('[dev/report] run failed:', body)
          return json(body, statusForError(tag))
        }

        const { resultId, gather } = exit.value

        // Render by resolving the stored result and its frozen citation
        // snapshots (PRD 5.1).
        const [result] = await db
          .select({ insight: results.insight })
          .from(results)
          .where(eq(results.id, resultId))
        const cites = await db
          .select({
            sourceId: resultCitations.sourceId,
            blockType: resultCitations.blockType,
            snapshotUrl: resultCitations.snapshotUrl,
            snapshotTitle: resultCitations.snapshotTitle,
            snapshotExcerpt: resultCitations.snapshotExcerpt,
          })
          .from(resultCitations)
          .where(eq(resultCitations.resultId, resultId))

        const rendered = {
          resultId,
          question: questionText,
          projectId,
          gather,
          insight: result?.insight ?? null,
          citations: cites,
        }
        console.log('[dev/report] rendered:\n', JSON.stringify(rendered, null, 2))
        return json(rendered)
      },
    },
  },
})
