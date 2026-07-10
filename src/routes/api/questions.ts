import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { createQuestion } from '../../report/run'
import { requireUser } from '../../auth/guard'
import { json } from '../../server/http'
import { startRun } from '../../server/runBackground'

export const Route = createFileRoute('/api/questions')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await requireUser(request))) return json({ error: 'unauthorized' }, 401)
        const body = (await request.json().catch(() => null)) as {
          projectId?: unknown
          question?: unknown
          recencyWindowDays?: unknown
        } | null
        const projectId = typeof body?.projectId === 'string' ? body.projectId : ''
        const question =
          typeof body?.question === 'string' ? body.question.trim() : ''
        if (!projectId || !question) {
          return json({ error: 'projectId and question are required' }, 400)
        }
        const recencyWindowDays =
          typeof body?.recencyWindowDays === 'number' && body.recencyWindowDays > 0
            ? body.recencyWindowDays
            : undefined

        const exit = await Effect.runPromiseExit(
          createQuestion({ projectId, question, recencyWindowDays }),
        )
        if (exit._tag === 'Failure') {
          return json({ error: 'could not create question' }, 500)
        }
        startRun(exit.value)
        return json({ questionId: exit.value }, 201)
      },
    },
  },
})
