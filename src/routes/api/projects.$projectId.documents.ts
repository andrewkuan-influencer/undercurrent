import { createFileRoute } from '@tanstack/react-router'
import { desc, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { ownsProject, requireUser } from '../../auth/guard'
import { db } from '../../db/client'
import { uploadedFiles } from '../../db/schema'
import { ingestDocument } from '../../uploads/ingest'
import { json } from '../../server/http'

/** Text formats we can read directly today (PDF/docx extraction is a follow-up). */
function isSupported(file: File): boolean {
  return (
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    file.type === '' ||
    /\.(txt|md|markdown|csv|json)$/i.test(file.name)
  )
}

export const Route = createFileRoute('/api/projects/$projectId/documents')({
  server: {
    handlers: {
      // List a project's uploaded documents.
      GET: async ({ params, request }) => {
        const user = await requireUser(request)
        if (!user) return json({ error: 'unauthorized' }, 401)
        if (!(await ownsProject(user.id, params.projectId))) {
          return json({ error: 'project not found' }, 404)
        }
        const rows = await db
          .select({
            id: uploadedFiles.id,
            fileName: uploadedFiles.fileName,
            status: uploadedFiles.status,
          })
          .from(uploadedFiles)
          .where(eq(uploadedFiles.projectId, params.projectId))
          .orderBy(desc(uploadedFiles.id))
        return json(rows)
      },
      // Upload a document: store metadata, chunk, embed, write document_chunks.
      POST: async ({ params, request }) => {
        const user = await requireUser(request)
        if (!user) return json({ error: 'unauthorized' }, 401)
        if (!(await ownsProject(user.id, params.projectId))) {
          return json({ error: 'project not found' }, 404)
        }
        const form = await request.formData().catch(() => null)
        const file = form?.get('file')
        if (!(file instanceof File)) return json({ error: 'file is required' }, 400)
        if (!isSupported(file)) {
          return json(
            { error: 'unsupported file type; text and markdown only for now' },
            415,
          )
        }
        const content = await file.text()

        const exit = await Effect.runPromiseExit(
          ingestDocument({ projectId: params.projectId, fileName: file.name, content }),
        )
        if (exit._tag === 'Failure') {
          console.error('[documents] ingest failed')
          return json({ error: 'ingest failed (check OPENAI_API_KEY and file)' }, 500)
        }
        return json(exit.value, 201)
      },
    },
  },
})
