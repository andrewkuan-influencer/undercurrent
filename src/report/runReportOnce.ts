import { eq, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '../db/client'
import {
  projects,
  questions,
  resultCitations,
  results,
  uploadedFiles,
} from '../db/schema'
import { DEFAULT_RECENCY_WINDOW_DAYS } from '../gather/config'
import { runGather, type GatherStats } from '../gather/gather'
import type { ProjectContext } from '../gather/plan'
import type { ModelError } from '../models/openrouter'
import { Retrieval } from '../retrieval'
import type {
  InvalidModelOutputError,
  UnknownCitationError,
} from '../synthesis/errors'
import { synthesize, type WorkingSetItem } from '../synthesis/synthesize'
import { reverifyWorkingSet } from '../verify/reverify'
import { DbError, NoEvidenceError } from './errors'

/** Storage cap for the frozen citation snapshot. */
const SNAPSHOT_EXCERPT_LIMIT = 2000

/**
 * Whether a query embedder is available. The embedding model is a deferred
 * decision (PRD 12), so there is none yet and the document channel is skipped.
 */
const HAS_EMBEDDER = false

const dbOp = <A>(thunk: () => Promise<A>): Effect.Effect<A, DbError> =>
  Effect.tryPromise({
    try: thunk,
    catch: (cause) => new DbError({ reason: String(cause) }),
  })

export interface RunReportResult {
  readonly resultId: string
  readonly gather: GatherStats
}

/**
 * One end-to-end run over the two-stage pipeline (PRD 5.1). Insert the question,
 * run the agentic gather loop to assemble a working set in the ledger,
 * re-verify stale members, then make the single synthesis call and freeze the
 * citations. Returns the new result id and the gather stats.
 *
 * The two write paths stay separate (PRD 6.4): gather owns sources,
 * question_sources, and retrieval_memory; this function owns results and
 * result_citations.
 */
export const runReportOnce = (
  questionText: string,
  projectId: string,
  recencyWindowDays: number = DEFAULT_RECENCY_WINDOW_DAYS,
): Effect.Effect<
  RunReportResult,
  | DbError
  | NoEvidenceError
  | ModelError
  | InvalidModelOutputError
  | UnknownCitationError,
  Retrieval
> =>
  Effect.gen(function* () {
    // Load the project context for planning.
    const projectRows = yield* dbOp(() =>
      db
        .select({
          name: projects.name,
          description: projects.description,
          audiences: projects.audiences,
          topics: projects.topics,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1),
    )
    const project = projectRows[0]
    if (!project) {
      return yield* new DbError({ reason: `project ${projectId} not found` })
    }
    const docCountRows = yield* dbOp(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(uploadedFiles)
        .where(eq(uploadedFiles.projectId, projectId)),
    )
    const projectContext: ProjectContext = {
      name: project.name,
      description: project.description,
      audiences: project.audiences ?? [],
      topics: project.topics ?? [],
      hasDocuments: (docCountRows[0]?.count ?? 0) > 0,
    }

    // Insert the question, recording its recency window.
    const questionRows = yield* dbOp(() =>
      db
        .insert(questions)
        .values({ projectId, question: questionText, recencyWindowDays })
        .returning({ id: questions.id }),
    )
    const question = questionRows[0]
    if (!question) {
      return yield* new DbError({ reason: 'question insert returned no row' })
    }
    const questionId = question.id

    // Gather stage: the agentic loop assembles the working set in the ledger.
    const { workingSet, stats } = yield* runGather(
      questionId,
      questionText,
      projectContext,
      recencyWindowDays,
      HAS_EMBEDDER,
    ).pipe(
      // A planning failure ends the run; surface it as a NoEvidenceError so the
      // caller has one failure shape for "nothing to synthesise".
      Effect.catchTag('PlanError', (error) =>
        Effect.zipRight(
          Effect.logError(`gather: planning failed (${error.reason})`),
          new NoEvidenceError({ questionId }),
        ),
      ),
    )
    if (workingSet.length === 0) {
      return yield* new NoEvidenceError({ questionId })
    }

    // Re-verify stale working-set members before synthesis (no model call).
    yield* reverifyWorkingSet(workingSet)

    // Synthesis stage reads the assembled working set. Citation validation is
    // the hard rule: an unknown id fails before any write.
    const forSynthesis: WorkingSetItem[] = workingSet.map((s) => ({
      id: s.id,
      channel: s.channel,
      title: s.title,
      url: s.url,
      excerpt: s.excerpt,
    }))
    const { insight, citations } = yield* synthesize(questionText, forSynthesis)

    // Write results.insight (JSONB) and one frozen result_citations row per
    // citation (synthesis write path).
    const snapshotById = new Map(workingSet.map((s) => [s.id, s]))
    const resultId = yield* dbOp(() =>
      db.transaction(async (tx) => {
        const [result] = await tx
          .insert(results)
          .values({ questionId, insight, iterationCount: stats.rounds })
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

    return { resultId, gather: stats }
  })
