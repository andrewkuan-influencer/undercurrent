import 'dotenv/config'
import { Effect } from 'effect'
import { EMBEDDING_DIMENSION } from '../src/config/embedding'
import { sql } from '../src/db/client'
import {
  Retrieval,
  RetrievalLive,
  type RetrievalError,
  type RetrievedItem,
} from '../src/retrieval'

/**
 * Eyeball script (npm run retrieve:test). Runs one hard-coded query against each
 * channel and prints the normalised results, so we can judge retrieval quality
 * by hand. No agent logic, no scoring, no ledger writes.
 */

const QUERY = 'sustainable fashion resale among gen z'

function printItems(channel: string, items: ReadonlyArray<RetrievedItem>): void {
  console.log(`\n=== ${channel}: ${items.length} item(s) ===`)
  items.forEach((item, i) => {
    const when = item.publishedAt ? item.publishedAt.toISOString() : 'undated'
    const excerpt = item.content.replace(/\s+/g, ' ').trim().slice(0, 200)
    console.log(`\n[${i + 1}] ${item.title ?? '(no title)'}`)
    console.log(`    url:        ${item.url ?? '(none)'}`)
    console.log(`    published:  ${when}`)
    console.log(`    identifier: ${JSON.stringify(item.identifier)}`)
    console.log(`    excerpt:    ${excerpt}${excerpt.length === 200 ? '…' : ''}`)
  })
}

function printError(channel: string, error: RetrievalError): void {
  console.log(`\n=== ${channel}: ${error._tag} ===`)
  console.log(`    ${JSON.stringify(error)}`)
}

const runChannel = (
  channel: string,
  eff: Effect.Effect<ReadonlyArray<RetrievedItem>, RetrievalError>,
) =>
  eff.pipe(
    Effect.map((items) => printItems(channel, items)),
    Effect.catchAll((error) => Effect.sync(() => printError(channel, error))),
  )

const program = Effect.gen(function* () {
  const retrieval = yield* Retrieval

  yield* runChannel(
    'web (tavily)',
    retrieval.searchWeb(QUERY, { timeRange: 'month', maxResults: 3 }),
  )

  yield* runChannel(
    'reddit',
    retrieval.searchReddit(QUERY, { timeRange: 'year', maxResults: 3 }),
  )

  // The doc channel needs a query vector. The embedding model is deferred
  // (PRD 12), so pass a placeholder unit vector purely to exercise the pgvector
  // query path. With no documents uploaded it returns EmptyResults, which is
  // the honest outcome to display for now.
  const placeholder = Array.from({ length: EMBEDDING_DIMENSION }, (_, i) =>
    i === 0 ? 1 : 0,
  )
  yield* runChannel(
    'doc (pgvector)',
    retrieval.searchDocuments(
      QUERY,
      '00000000-0000-0000-0000-000000000000',
      { queryEmbedding: placeholder, limit: 3 },
    ),
  )
})

Effect.runPromise(program.pipe(Effect.provide(RetrievalLive)))
  .catch((err) => {
    console.error('retrieve:test failed:', err)
    process.exitCode = 1
  })
  .finally(() => sql.end())
