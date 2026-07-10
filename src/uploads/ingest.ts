import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '../db/client'
import { documentChunks, uploadedFiles } from '../db/schema'
import { embedTexts, type EmbeddingError } from '../embedding/embed'
import { DbError } from '../report/errors'
import { chunkText } from './chunk'

export interface IngestInput {
  readonly projectId: string
  readonly fileName: string
  readonly content: string
}

export interface IngestResult {
  readonly fileId: string
  readonly chunks: number
  readonly deduped: boolean
}

const dbOp = <A>(thunk: () => Promise<A>): Effect.Effect<A, DbError> =>
  Effect.tryPromise({
    try: thunk,
    catch: (cause) => new DbError({ reason: String(cause) }),
  })

/**
 * Ingest one uploaded document (PRD 4.1, 6.2): store its metadata in
 * uploaded_files with a content hash, chunk the text, embed the chunks with the
 * fixed embedding model, and write document_chunks. Deduped by (project,
 * content hash) so re-uploading the same file is a no-op. Once written, chunks
 * flow through searchDocuments in the gather loop automatically.
 */
export const ingestDocument = (
  input: IngestInput,
): Effect.Effect<IngestResult, DbError | EmbeddingError> =>
  Effect.gen(function* () {
    const contentHash = createHash('sha256').update(input.content).digest('hex')

    const existing = yield* dbOp(() =>
      db
        .select({ id: uploadedFiles.id })
        .from(uploadedFiles)
        .where(
          and(
            eq(uploadedFiles.projectId, input.projectId),
            eq(uploadedFiles.contentHash, contentHash),
          ),
        )
        .limit(1),
    )
    if (existing[0]) {
      return { fileId: existing[0].id, chunks: 0, deduped: true }
    }

    const chunks = chunkText(input.content)

    const inserted = yield* dbOp(() =>
      db
        .insert(uploadedFiles)
        .values({
          projectId: input.projectId,
          fileName: input.fileName,
          contentHash,
          status: 'processing',
        })
        .returning({ id: uploadedFiles.id }),
    )
    const file = inserted[0]
    if (!file) return yield* new DbError({ reason: 'file insert returned no row' })

    if (chunks.length === 0) {
      yield* dbOp(() =>
        db.update(uploadedFiles).set({ status: 'empty' }).where(eq(uploadedFiles.id, file.id)),
      )
      return { fileId: file.id, chunks: 0, deduped: false }
    }

    const vectors = yield* embedTexts(chunks)
    if (vectors.length !== chunks.length) {
      yield* dbOp(() =>
        db.update(uploadedFiles).set({ status: 'failed' }).where(eq(uploadedFiles.id, file.id)),
      )
      return yield* new DbError({ reason: 'embedding count did not match chunk count' })
    }

    yield* dbOp(() =>
      db.insert(documentChunks).values(
        chunks.map((chunkTextValue, index) => ({
          fileId: file.id,
          chunkIndex: index,
          chunkText: chunkTextValue,
          embedding: vectors[index]!,
        })),
      ),
    )
    yield* dbOp(() =>
      db.update(uploadedFiles).set({ status: 'ready' }).where(eq(uploadedFiles.id, file.id)),
    )

    return { fileId: file.id, chunks: chunks.length, deduped: false }
  })
