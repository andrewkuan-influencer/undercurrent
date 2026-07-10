import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { Effect, Exit } from 'effect'
import { db } from '../../../db/client'
import { projects } from '../../../db/schema'
import { RetrievalLive } from '../../../retrieval'
import {
  createQuestion,
  loadRenderedResult,
  runForQuestion,
} from '../../../report/run'

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

/**
 * Dev-only synchronous run: create a question, run it to completion, and print
 * the rendered result. The product UI uses the same run functions but
 * fire-and-forget with status polling.
 */
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
        const projectId = await resolveProjectId(url.searchParams.get('projectId'))
        const recencyParam = Number(url.searchParams.get('recencyDays'))
        const recencyWindowDays =
          Number.isFinite(recencyParam) && recencyParam > 0 ? recencyParam : undefined

        const exit = await Effect.runPromiseExit(
          createQuestion({ projectId, question: questionText, recencyWindowDays }).pipe(
            Effect.flatMap((questionId) =>
              runForQuestion(questionId).pipe(
                Effect.provide(RetrievalLive),
                Effect.flatMap(() => loadRenderedResult(questionId)),
                Effect.map((rendered) => ({ questionId, rendered })),
              ),
            ),
          ),
        )

        if (Exit.isFailure(exit)) {
          console.error('[dev/report] run failed')
          return json({ error: 'run failed' }, 500)
        }

        const body = {
          questionId: exit.value.questionId,
          question: questionText,
          projectId,
          result: exit.value.rendered,
        }
        console.log('[dev/report] rendered:\n', JSON.stringify(body, null, 2))
        return json(body)
      },
    },
  },
})
