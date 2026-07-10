import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '../../db/client'
import { questions } from '../../db/schema'
import { QuestionStatus, loadRenderedResult } from '../../report/run'
import { json } from '../../server/http'

export const Route = createFileRoute('/api/questions/$questionId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rows = await db
          .select({
            id: questions.id,
            projectId: questions.projectId,
            question: questions.question,
            status: questions.status,
            recencyWindowDays: questions.recencyWindowDays,
            parentQuestionId: questions.parentQuestionId,
            createdAt: questions.createdAt,
          })
          .from(questions)
          .where(eq(questions.id, params.questionId))
          .limit(1)
        const question = rows[0]
        if (!question) return json({ error: 'question not found' }, 404)

        const result =
          question.status === QuestionStatus.Complete
            ? await Effect.runPromise(loadRenderedResult(params.questionId))
            : null

        return json({ ...question, result })
      },
    },
  },
})
