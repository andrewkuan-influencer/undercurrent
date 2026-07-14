import { createFileRoute } from '@tanstack/react-router'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { projects, questions } from '../../db/schema'
import { ownsProject, requireUser } from '../../auth/guard'
import { deleteProjectCascade } from '../../server/deleteCascade'
import { json } from '../../server/http'

export const Route = createFileRoute('/api/projects/$projectId')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const user = await requireUser(request)
        if (!user) return json({ error: 'unauthorized' }, 401)
        // Ownership scoping: 404 for anyone but the owner (PRD 8).
        const rows = await db
          .select({
            id: projects.id,
            name: projects.name,
            description: projects.description,
            audiences: projects.audiences,
            topics: projects.topics,
          })
          .from(projects)
          .where(and(eq(projects.id, params.projectId), eq(projects.ownerId, user.id)))
          .limit(1)
        const project = rows[0]
        if (!project) return json({ error: 'project not found' }, 404)

        const projectQuestions = await db
          .select({
            id: questions.id,
            question: questions.question,
            status: questions.status,
            parentQuestionId: questions.parentQuestionId,
            recencyWindowDays: questions.recencyWindowDays,
            createdAt: questions.createdAt,
          })
          .from(questions)
          .where(eq(questions.projectId, params.projectId))
          .orderBy(desc(questions.createdAt))

        return json({ project, questions: projectQuestions })
      },
      // Deletes the project and everything under it (questions, reports,
      // uploaded documents). Irreversible; the UI double-confirms.
      DELETE: async ({ params, request }) => {
        const user = await requireUser(request)
        if (!user) return json({ error: 'unauthorized' }, 401)
        if (!(await ownsProject(user.id, params.projectId))) {
          return json({ error: 'project not found' }, 404)
        }
        try {
          await deleteProjectCascade(params.projectId)
        } catch (error) {
          console.error(`delete project ${params.projectId} failed`, error)
          return json({ error: 'delete failed' }, 500)
        }
        return json({ deleted: true })
      },
    },
  },
})
