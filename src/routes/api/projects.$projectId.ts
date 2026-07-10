import { createFileRoute } from '@tanstack/react-router'
import { desc, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { projects, questions } from '../../db/schema'
import { json } from '../../server/http'

export const Route = createFileRoute('/api/projects/$projectId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rows = await db
          .select({
            id: projects.id,
            name: projects.name,
            description: projects.description,
            audiences: projects.audiences,
            topics: projects.topics,
          })
          .from(projects)
          .where(eq(projects.id, params.projectId))
          .limit(1)
        const project = rows[0]
        if (!project) return json({ error: 'project not found' }, 404)

        const projectQuestions = await db
          .select({
            id: questions.id,
            question: questions.question,
            status: questions.status,
            parentQuestionId: questions.parentQuestionId,
            createdAt: questions.createdAt,
          })
          .from(questions)
          .where(eq(questions.projectId, params.projectId))
          .orderBy(desc(questions.createdAt))

        return json({ project, questions: projectQuestions })
      },
    },
  },
})
