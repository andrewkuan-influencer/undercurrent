import { Effect } from 'effect'
import { EMBEDDING_DIMENSION } from '../config/embedding'
import { sql } from '../db/client'
import { DEFAULT_DOC_LIMIT } from './constants'
import { EmptyResultsError, ProviderError } from './errors'
import type { DocumentSearchOptions, RetrievedItem } from './types'

interface ChunkRow {
  file_id: string
  chunk_index: number
  chunk_text: string
  content_hash: string | null
  file_name: string | null
}

function normalise(r: ChunkRow): RetrievedItem {
  return {
    channel: 'doc',
    url: null,
    title: r.file_name ?? null,
    content: r.chunk_text ?? '',
    publishedAt: null,
    identifier: {
      kind: 'doc_chunk',
      fileId: r.file_id,
      chunkIndex: r.chunk_index,
      contentHash: r.content_hash ?? null,
    },
  }
}

/**
 * pgvector cosine-similarity search over a project's document chunks. Documents
 * are highest-trust and always in scope (PRD 5.4), so there is no recency
 * filter here. The `<=>` operator is cosine distance; ordering ascending gives
 * nearest-first. The query vector is supplied by the caller (see
 * DocumentSearchOptions) because the embedding model is a deferred decision.
 */
export const searchDocuments = (
  query: string,
  projectId: string,
  options: DocumentSearchOptions,
) =>
  Effect.gen(function* () {
    if (options.queryEmbedding.length !== EMBEDDING_DIMENSION) {
      return yield* new ProviderError({
        channel: 'doc',
        reason: `query embedding has ${options.queryEmbedding.length} dimensions, expected ${EMBEDDING_DIMENSION}`,
      })
    }

    const limit = options.limit ?? DEFAULT_DOC_LIMIT
    const vector = `[${options.queryEmbedding.join(',')}]`

    const rows = yield* Effect.tryPromise({
      try: () =>
        sql<ChunkRow[]>`
          select
            dc.file_id,
            dc.chunk_index,
            dc.chunk_text,
            uf.content_hash,
            uf.file_name
          from document_chunks dc
          join uploaded_files uf on uf.id = dc.file_id
          where uf.project_id = ${projectId}::uuid
            and dc.embedding is not null
          order by dc.embedding <=> ${vector}::vector
          limit ${limit}
        `,
      catch: (cause) =>
        new ProviderError({
          channel: 'doc',
          reason: `query failed: ${String(cause)}`,
        }),
    })

    const items = rows.map(normalise)
    if (items.length === 0) {
      return yield* new EmptyResultsError({ channel: 'doc', query })
    }
    return items
  })
