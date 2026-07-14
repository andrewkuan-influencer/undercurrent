import { sql } from 'drizzle-orm'
import { Effect, Either } from 'effect'
import { db } from '../db/client'
import { questionSources, retrievalMemory, sources } from '../db/schema'
import { embedQuery, type EmbeddingError } from '../embedding/embed'
import { sourceKeyFor } from '../ledger/sourceKey'
import { DbError } from '../report/errors'
import { Retrieval } from '../retrieval'
import type { Channel, RetrievalError, RetrievedItem } from '../retrieval'
import {
  MIN_RELEVANCE,
  QUERIES_PER_ROUND,
  RESULTS_PER_QUERY,
  loopBudgetFor,
} from './config'
import { PlanError } from './errors'
import { planStep, type ProjectContext } from './plan'
import { recencyToTimeRange, recencyVerdict } from './recency'
import { scoreAndExtract, type ScoreInput } from './score'
import { facetsCovered, isSaturated } from './sufficiency'

const STORED_EXCERPT_LIMIT = 4000

/** A single planned tool call: one query on one channel for one facet. */
interface PlannedQuery {
  readonly facetId: string
  readonly facetLabel: string
  readonly channel: Channel
  readonly query: string
}

/** A source in the assembled working set handed to re-verification/synthesis. */
export interface WorkingSetSource {
  readonly id: string
  readonly channel: string
  readonly title: string | null
  readonly url: string | null
  readonly excerpt: string
  readonly voice: string | null
  readonly relevance: number
  readonly undated: boolean
  readonly lastVerifiedAt: Date | null
}

export interface GatherStats {
  readonly rounds: number
  readonly totalSources: number
  readonly stopReason: string
  readonly facetCoverage: Record<string, number>
}

export interface GatherOutcome {
  readonly workingSet: WorkingSetSource[]
  readonly stats: GatherStats
}

const dbOp = <A>(thunk: () => Promise<A>): Effect.Effect<A, DbError> =>
  Effect.tryPromise({
    try: thunk,
    catch: (cause) => new DbError({ reason: String(cause) }),
  })

/**
 * The agentic gather loop (PRD 5.4). Plan once with the main model, then loop:
 * retrieve in priority order (documents first, then reddit and web together),
 * recency-filter, score and extract with the lightweight model, dedupe into the
 * ledger, and log every tool call to retrieval_memory. Stop on coverage plus
 * saturation, with hard caps on rounds and total sources as a backstop.
 *
 * Writes the gather side of the ledger only (sources, question_sources,
 * retrieval_memory); synthesis is a separate write path (PRD 6.4).
 */
export const runGather = (
  questionId: string,
  questionText: string,
  projectId: string,
  project: ProjectContext,
  recencyWindowDays: number,
  hasEmbedder: boolean,
): Effect.Effect<GatherOutcome, PlanError | DbError, Retrieval> =>
  Effect.gen(function* () {
    const retrieval = yield* Retrieval
    const now = new Date()
    const timeRange = recencyToTimeRange(recencyWindowDays)
    // Wider windows earn deeper research (more rounds/sources, PRD 5.4).
    const budget = loopBudgetFor(recencyWindowDays)

    // Planning step (main model).
    const plan = yield* planStep(questionText, project, recencyWindowDays)

    // Build the query queue in priority order: documents first, then reddit and
    // web. Documents are skipped when no query embedder is configured (the
    // embedding model is a deferred decision).
    const queue: PlannedQuery[] = []
    let droppedDocQueries = 0
    const channelsInOrder: Channel[] = ['doc', 'reddit', 'web']
    for (const channel of channelsInOrder) {
      for (const facet of plan.facets) {
        const queries = facet.queries[channel] ?? []
        for (const query of queries) {
          if (channel === 'doc' && !hasEmbedder) {
            droppedDocQueries++
            continue
          }
          queue.push({ facetId: facet.id, facetLabel: facet.label, channel, query })
        }
      }
    }
    if (droppedDocQueries > 0) {
      yield* Effect.logInfo(
        `gather: skipped ${droppedDocQueries} document queries (no embedder configured)`,
      )
    }

    const runQuery = (
      pq: PlannedQuery,
    ): Effect.Effect<{ pq: PlannedQuery; items: RetrievedItem[] }> => {
      let search: Effect.Effect<
        ReadonlyArray<RetrievedItem>,
        RetrievalError | EmbeddingError
      >
      if (pq.channel === 'web') {
        search = retrieval.searchWeb(pq.query, { maxResults: RESULTS_PER_QUERY, timeRange })
      } else if (pq.channel === 'reddit') {
        search = retrieval.searchReddit(pq.query, { maxResults: RESULTS_PER_QUERY, timeRange })
      } else {
        // Documents: embed the query, then pgvector search. Fails soft (the
        // embedder needing OPENAI_API_KEY, or no chunks) via Effect.either below.
        search = embedQuery(pq.query).pipe(
          Effect.flatMap((queryEmbedding) =>
            retrieval.searchDocuments(pq.query, projectId, {
              queryEmbedding,
              limit: RESULTS_PER_QUERY,
            }),
          ),
        )
      }
      return Effect.either(search).pipe(
        Effect.map((e) => ({
          pq,
          items: Either.isRight(e) ? [...e.right] : [],
        })),
      )
    }

    // Loop state.
    const facetSources = new Map<string, Set<string>>()
    for (const facet of plan.facets) facetSources.set(facet.id, new Set())
    const runSeen = new Set<string>()
    const workingSet = new Map<string, WorkingSetSource>()
    let rounds = 0
    let stopReason = 'query_queue_empty'

    while (queue.length > 0) {
      if (rounds >= budget.maxRounds) {
        stopReason = 'max_rounds'
        break
      }
      if (workingSet.size >= budget.maxSources) {
        stopReason = 'max_sources'
        break
      }
      rounds++
      const batch = queue.splice(0, QUERIES_PER_ROUND)

      // Retrieve (reddit and web together), then recency-filter before scoring.
      const outcomes = yield* Effect.all(batch.map(runQuery), { concurrency: 4 })
      const candidates: {
        pq: PlannedQuery
        item: RetrievedItem
        undated: boolean
      }[] = []
      for (const outcome of outcomes) {
        for (const item of outcome.items) {
          const verdict = recencyVerdict(item, recencyWindowDays, now)
          if (!verdict.keep) continue
          candidates.push({ pq: outcome.pq, item, undated: verdict.undated })
        }
      }

      // Score and extract with the lightweight model.
      const scoreInputs: ScoreInput[] = candidates.map((c) => ({
        item: c.item,
        facetLabel: c.pq.facetLabel,
      }))
      const scores = yield* scoreAndExtract(questionText, scoreInputs)

      // Dedupe kept items into the ledger and track novelty and coverage.
      const keptPerQuery = new Map<string, number>()
      let roundKept = 0
      let novelKept = 0
      const qKey = (pq: PlannedQuery) => `${pq.facetId}|${pq.channel}|${pq.query}`

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]
        const score = scores[i]
        if (!candidate || !score || score.relevance < MIN_RELEVANCE) continue

        const extracted = (
          score.excerpt.trim().length > 0 ? score.excerpt : candidate.item.content
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, STORED_EXCERPT_LIMIT)

        const rows = yield* dbOp(() =>
          db
            .insert(sources)
            .values({
              sourceKey: sourceKeyFor(candidate.item.identifier),
              channel: candidate.item.channel,
              voice: score.voice,
              url: candidate.item.url,
              title: candidate.item.title,
              excerpt: extracted,
              language: score.language,
              publishedAt: candidate.item.publishedAt,
              undated: candidate.undated,
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
              voice: sources.voice,
              undated: sources.undated,
              lastVerifiedAt: sources.lastVerifiedAt,
            }),
        )
        const row = rows[0]
        if (!row) return yield* new DbError({ reason: 'source upsert returned no row' })

        roundKept++
        keptPerQuery.set(qKey(candidate.pq), (keptPerQuery.get(qKey(candidate.pq)) ?? 0) + 1)
        facetSources.get(candidate.pq.facetId)?.add(row.id)

        if (!runSeen.has(row.id)) {
          runSeen.add(row.id)
          novelKept++
          // Link the source to the question once, at first sighting.
          yield* dbOp(() =>
            db.insert(questionSources).values({
              questionId,
              sourceId: row.id,
              relevance: score.relevance,
            }),
          )
        }

        const existing = workingSet.get(row.id)
        if (!existing || score.relevance > existing.relevance) {
          workingSet.set(row.id, {
            id: row.id,
            channel: row.channel,
            title: row.title,
            url: row.url,
            excerpt: row.excerpt ?? '',
            voice: row.voice,
            relevance: score.relevance,
            undated: row.undated,
            lastVerifiedAt: row.lastVerifiedAt,
          })
        }
      }

      // Log every tool call this round to retrieval_memory with its usefulness.
      for (const pq of batch) {
        const useful = keptPerQuery.get(qKey(pq)) ?? 0
        yield* dbOp(() =>
          db.insert(retrievalMemory).values({
            questionId,
            toolName: pq.channel,
            queryUsed: pq.query,
            usefulResultsCount: useful,
            wasEffective: useful > 0,
          }),
        )
      }

      // Sufficiency: coverage then saturation (PRD 5.4).
      if (facetsCovered(facetSources, budget.minSourcesPerFacet)) {
        stopReason = 'coverage'
        break
      }
      if (isSaturated(roundKept, novelKept)) {
        stopReason = 'saturation'
        break
      }
    }

    const facetCoverage: Record<string, number> = {}
    for (const [facetId, set] of facetSources) facetCoverage[facetId] = set.size

    return {
      workingSet: [...workingSet.values()],
      stats: {
        rounds,
        totalSources: workingSet.size,
        stopReason,
        facetCoverage,
      },
    }
  })
