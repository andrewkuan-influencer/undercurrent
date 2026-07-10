import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '../../db/client'
import { questions } from '../../db/schema'
import { createQuestion } from '../../report/run'
import { requireUser } from '../../auth/guard'
import { json } from '../../server/http'
import { startRun } from '../../server/runBackground'

/**
 * Dive-deeper (PRD 4.5): create a child question linked by parent_question_id.
 * createQuestion inherits the parent's question_sources, so the follow-up builds
 * on the parent's evidence and spends retrieval only on what it newly needs.
 */
export const Route = createFileRoute('/api/questions/$questionId/dive')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        if (!(await requireUser(request))) return json({ error: 'unauthorized' }, 401)
        const body = (await request.json().catch(() => null)) as {
          question?: unknown
          recencyWindowDays?: unknown
        } | null
        const question =
          typeof body?.question === 'string' ? body.question.trim() : ''
        if (!question) return json({ error: 'question is required' }, 400)

        const parentRows = await db
          .select({
            projectId: questions.projectId,
            recencyWindowDays: questions.recencyWindowDays,
          })
          .from(questions)
          .where(eq(questions.id, params.questionId))
          .limit(1)
        const parent = parentRows[0]
        if (!parent) return json({ error: 'parent question not found' }, 404)

        const recencyWindowDays =
          typeof body?.recencyWindowDays === 'number' && body.recencyWindowDays > 0
            ? body.recencyWindowDays
            : (parent.recencyWindowDays ?? undefined)

        const exit = await Effect.runPromiseExit(
          createQuestion({
            projectId: parent.projectId,
            question,
            recencyWindowDays,
            parentQuestionId: params.questionId,
          }),
        )
        if (exit._tag === 'Failure') {
          return json({ error: 'could not create follow-up question' }, 500)
        }
        startRun(exit.value)
        return json({ questionId: exit.value }, 201)
      },
    },
  },
})
