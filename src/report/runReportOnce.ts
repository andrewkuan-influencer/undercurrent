import { Effect, Either } from 'effect'
import { sql } from 'drizzle-orm'
import { db } from '../db/client'
import {
  questionSources,
  questions,
  resultCitations,
  results,
  sources,
} from '../db/schema'
import { Retrieval } from '../retrieval'
import type { RetrievedItem } from '../retrieval'
import { sourceKeyFor } from '../ledger/sourceKey'
import { synthesize, type WorkingSetItem } from '../synthesis/synthesize'
import { DbError, NoEvidenceError } from './errors'

/** How many results to pull per channel in this one fixed round. */
const PER_CHANNEL = 5
/** Storage cap for a source excerpt (the frozen snapshot draws from this). */
const STORED_EXCERPT_LIMIT = 4000
const SNAPSHOT_EXCERPT_LIMIT = 2000

const dbOp = <A>(thunk: () => Promise<A>): Effect.Effect<A, DbError> =>
  Effect.tryPromise({
    try: thunk,
    catch: (cause) => new DbError({ reason: String(cause) }),
  })

/**
 * The simplest possible end-to-end run, deliberately without the agent loop
 * (PRD 5.1 two-stage pipeline, minus gather's agency). Insert the question, run
 * one fixed retrieval round, write every result to the ledger with a namespaced
 * source_key (dedup via ON CONFLICT), link them, make one main-model synthesis
 * call over the stored sources, validate that every citation exists in the
 * working set, then write results.insight and the frozen citation snapshots.
 * Returns the new result id.
 *
 * The two write paths stay separate (PRD 6.4): this gathers into sources and
 * question_sources, then synthesises into results and result_citations.
 */
export const runReportOnce = (questionText: string, projectId: string) =>
  Effect.gen(function* () {
    const retrieval = yield* Retrieval

    // 1. Insert the question.
    const questionRows = yield* dbOp(() =>
      db
        .insert(questions)
        .values({ projectId, question: questionText })
        .returning({ id: questions.id }),
    )
    const question = questionRows[0]
    if (!question) {
      return yield* new DbError({ reason: 'question insert returned no row' })
    }
    const questionId = question.id

    // 2. One fixed retrieval round. Tolerate a channel failing (e.g. Reddit not
    // yet configured): collect what succeeds, only fail if nothing comes back.
    const web = yield* Effect.either(
      retrieval.searchWeb(questionText, {
        maxResults: PER_CHANNEL,
        timeRange: 'year',
      }),
    )
    const reddit = yield* Effect.either(
      retrieval.searchReddit(questionText, {
        maxResults: PER_CHANNEL,
        timeRange: 'year',
      }),
    )
    for (const [channel, outcome] of [
      ['web', web],
      ['reddit', reddit],
    ] as const) {
      if (Either.isLeft(outcome)) {
        yield* Effect.logInfo(
          `retrieval: ${channel} returned no evidence (${outcome.left._tag})`,
        )
      }
    }
    const items: RetrievedItem[] = [
      ...(Either.isRight(web) ? web.right : []),
      ...(Either.isRight(reddit) ? reddit.right : []),
    ]
    if (items.length === 0) {
      return yield* new NoEvidenceError({ questionId })
    }

    // 3. Write every item to the ledger with a namespaced source_key, deduping
    // repeat sightings via INSERT ... ON CONFLICT (source_key) DO UPDATE.
    const workingSet: WorkingSetItem[] = []
    const seenSourceIds = new Set<string>()
    for (const item of items) {
      const sourceKey = sourceKeyFor(item.identifier)
      const excerpt = item.content.replace(/\s+/g, ' ').trim().slice(
        0,
        STORED_EXCERPT_LIMIT,
      )
      const rows = yield* dbOp(() =>
        db
          .insert(sources)
          .values({
            sourceKey,
            channel: item.channel,
            url: item.url,
            title: item.title,
            excerpt,
            publishedAt: item.publishedAt,
            lastSeenAt: new Date(),
          })
          .onConflictDoUpdate({
            target: sources.sourceKey,
            set: {
              seenCount: sql`${sources.seenCount} + 1`,
              lastSeenAt: sql`now()`,
            },
          })
          .returning({
            id: sources.id,
            channel: sources.channel,
            url: sources.url,
            title: sources.title,
            excerpt: sources.excerpt,
          }),
      )
      const row = rows[0]
      if (!row) {
        return yield* new DbError({ reason: 'source upsert returned no row' })
      }
      if (!seenSourceIds.has(row.id)) {
        seenSourceIds.add(row.id)
        workingSet.push({
          id: row.id,
          channel: row.channel,
          title: row.title,
          url: row.url,
          excerpt: row.excerpt ?? '',
        })
        // Link the source to the question (gather write path).
        yield* dbOp(() =>
          db.insert(questionSources).values({ questionId, sourceId: row.id }),
        )
      }
    }

    // 4 + 5. One synthesis call, then the hard citation validation happens inside
    // synthesize: an id not in the working set fails before any write.
    const { insight, citations } = yield* synthesize(questionText, workingSet)

    // 6. Write results.insight (JSONB) and one result_citations row per citation
    // with frozen snapshot fields. This is the synthesis write path.
    const snapshotById = new Map(workingSet.map((s) => [s.id, s]))
    const resultId = yield* dbOp(() =>
      db.transaction(async (tx) => {
        const [result] = await tx
          .insert(results)
          .values({ questionId, insight, iterationCount: 1 })
          .returning({ id: results.id })
        if (!result) throw new Error('result insert returned no row')

        for (const citation of citations) {
          const src = snapshotById.get(citation.sourceId)
          if (!src) throw new Error(`missing snapshot for ${citation.sourceId}`)
          await tx.insert(resultCitations).values({
            resultId: result.id,
            sourceId: citation.sourceId,
            blockType: citation.blockType,
            snapshotUrl: src.url,
            snapshotTitle: src.title,
            snapshotExcerpt: src.excerpt.slice(0, SNAPSHOT_EXCERPT_LIMIT),
          })
        }
        return result.id
      }),
    )

    // 7. Return the result id.
    return resultId
  })
