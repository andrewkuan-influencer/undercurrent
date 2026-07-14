import { createFileRoute } from '@tanstack/react-router'
import { desc, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { projects } from '../../db/schema'
import { requireUser } from '../../auth/guard'
import { json, normalizeList } from '../../server/http'

export const Route = createFileRoute('/api/projects')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await requireUser(request)
        if (!user) return json({ error: 'unauthorized' }, 401)
        // Per-user scoping: only the caller's own projects (PRD 8).
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
          .where(eq(projects.ownerId, user.id))
          .orderBy(desc(projects.createdAt))
        return json(rows)
      },
      POST: async ({ request }) => {
        const user = await requireUser(request)
        if (!user) return json({ error: 'unauthorized' }, 401)
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
            ownerId: user.id,
          })
          .returning({ id: projects.id })
        return json({ id: row!.id }, 201)
      },
    },
  },
})
