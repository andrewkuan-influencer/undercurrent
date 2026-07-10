import { createFileRoute } from '@tanstack/react-router'
import { desc } from 'drizzle-orm'
import { db } from '../../db/client'
import { projects } from '../../db/schema'
import { requireUser } from '../../auth/guard'
import { json, normalizeList } from '../../server/http'

export const Route = createFileRoute('/api/projects')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await requireUser(request))) return json({ error: 'unauthorized' }, 401)
        const rows = await db
          .select({
            id: projects.id,
            name: projects.name,
            description: projects.description,
            audiences: projects.audiences,
            topics: projects.topics,
            createdAt: projects.createdAt,
          })
          .from(projects)
          .orderBy(desc(projects.createdAt))
        return json(rows)
      },
      POST: async ({ request }) => {
        if (!(await requireUser(request))) return json({ error: 'unauthorized' }, 401)
        const body = (await request.json().catch(() => null)) as {
          name?: unknown
          description?: unknown
          audiences?: unknown
          topics?: unknown
        } | null
        const name = typeof body?.name === 'string' ? body.name.trim() : ''
        if (!name) return json({ error: 'name is required' }, 400)
        const [row] = await db
          .insert(projects)
          .values({
            name,
            description:
              typeof body?.description === 'string' && body.description.trim()
                ? body.description.trim()
                : null,
            audiences: normalizeList(body?.audiences),
            topics: normalizeList(body?.topics),
          })
          .returning({ id: projects.id })
        return json({ id: row!.id }, 201)
      },
    },
  },
})
