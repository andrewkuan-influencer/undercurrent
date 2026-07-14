import { createFileRoute } from '@tanstack/react-router'
import { eq, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '../../db/client'
import { questionSources, questions, retrievalMemory, sources } from '../../db/schema'
import { QuestionStatus, loadRenderedResult } from '../../report/run'
import { ownsProject, requireUser } from '../../auth/guard'
import { json } from '../../server/http'

/** Follow-up chains stop 3 levels below the root question. */
export const MAX_FOLLOW_UP_DEPTH = 3

/** How many follow-ups deep a question sits (root = 0), from its parent id. */
export async function questionDepth(
  parentQuestionId: string | null,
): Promise<number> {
  let depth = 0
  let cursor = parentQuestionId
  while (cursor && depth <= MAX_FOLLOW_UP_DEPTH) {
    depth += 1
    const rows = await db
      .select({ parentQuestionId: questions.parentQuestionId })
      .from(questions)
      .where(eq(questions.id, cursor))
      .limit(1)
    cursor = rows[0]?.parentQuestionId ?? null
  }
  return depth
}

export const Route = createFileRoute('/api/questions/$questionId')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const user = await requireUser(request)
        if (!user) return json({ error: 'unauthorized' }, 401)
        const rows = await db
          .select({
            id: questions.id,
            projectId: questions.projectId,
            question: questions.question,
            status: questions.status,
            recencyWindowDays: questions.recencyWindowDays,
            parentQuestionId: questions.parentQuestionId,
            errorDetail: questions.errorDetail,
            createdAt: questions.createdAt,
          })
          .from(questions)
          .where(eq(questions.id, params.questionId))
          .limit(1)
        const question = rows[0]
        if (!question) return json({ error: 'question not found' }, 404)
        // Ownership scoping via the question's project (PRD 8).
        if (!(await ownsProject(user.id, question.projectId))) {
          return json({ error: 'question not found' }, 404)
        }

        // Evidence summary: working-set sources by channel plus queries issued.
        const channelRows = await db
          .select({
            channel: sources.channel,
            count: sql<number>`count(*)::int`,
          })
          .from(questionSources)
          .innerJoin(sources, eq(sources.id, questionSources.sourceId))
          .where(eq(questionSources.questionId, params.questionId))
          .groupBy(sources.channel)
        const queryRows = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(retrievalMemory)
          .where(eq(retrievalMemory.questionId, params.questionId))
        const stats = {
          web: channelRows.find((r) => r.channel === 'web')?.count ?? 0,
          reddit: channelRows.find((r) => r.channel === 'reddit')?.count ?? 0,
          doc: channelRows.find((r) => r.channel === 'doc')?.count ?? 0,
          queries: queryRows[0]?.count ?? 0,
        }

        const depth = await questionDepth(question.parentQuestionId)

        const result =
          question.status === QuestionStatus.Complete
            ? await Effect.runPromise(loadRenderedResult(params.questionId))
            : null

        return json({ ...question, stats, depth, result })
      },
    },
  },
})
