import { randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '../db/client'
import {
  questionSources,
  questions,
  resultCitations,
  results,
  sources,
  uploadedFiles,
} from '../db/schema'
import { sql } from 'drizzle-orm'
import { DEFAULT_RECENCY_WINDOW_DAYS } from '../gather/config'
import { runGather } from '../gather/gather'
import type { ProjectContext } from '../gather/plan'
import { projects } from '../db/schema'
import { Retrieval } from '../retrieval'
import { synthesize, type WorkingSetItem } from '../synthesis/synthesize'
import { reverifyWorkingSet } from '../verify/reverify'
import type { WorkingSetSource } from '../gather/gather'
import { DbError, NoEvidenceError } from './errors'

/** The lifecycle a question moves through, polled by the run status view. */
export const QuestionStatus = {
  Gathering: 'gathering',
  Synthesising: 'synthesising',
  Complete: 'complete',
  Failed: 'failed',
} as const

const SNAPSHOT_EXCERPT_LIMIT = 2000

/** A query embedder now exists (PRD 7b), so the document channel is active. */
const HAS_EMBEDDER = true

const dbOp = <A>(thunk: () => Promise<A>): Effect.Effect<A, DbError> =>
  Effect.tryPromise({
    try: thunk,
    catch: (cause) => new DbError({ reason: String(cause) }),
  })

const setStatus = (questionId: string, status: string) =>
  dbOp(() =>
    db.update(questions).set({ status }).where(eq(questions.id, questionId)),
  )

export interface CreateQuestionInput {
  readonly projectId: string
  readonly question: string
  readonly recencyWindowDays?: number
  readonly parentQuestionId?: string
}

/**
 * Create a question in the 'gathering' state, ready for a background run. For a
 * dive-deeper follow-up (parentQuestionId set), inherit the parent's
 * question_sources so the child reads the parent's evidence from the shared
 * ledger at no extra retrieval cost (PRD 4.5, 6.5).
 */
export const createQuestion = (
  input: CreateQuestionInput,
): Effect.Effect<string, DbError> =>
  dbOp(() =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .insert(questions)
        .values({
          projectId: input.projectId,
          question: input.question,
          recencyWindowDays:
            input.recencyWindowDays ?? DEFAULT_RECENCY_WINDOW_DAYS,
          parentQuestionId: input.parentQuestionId ?? null,
          status: QuestionStatus.Gathering,
        })
        .returning({ id: questions.id })
      if (!row) throw new Error('question insert returned no row')

      if (input.parentQuestionId) {
        const inherited = await tx
          .select({
            sourceId: questionSources.sourceId,
            relevance: questionSources.relevance,
          })
          .from(questionSources)
          .where(eq(questionSources.questionId, input.parentQuestionId))
        if (inherited.length > 0) {
          await tx.insert(questionSources).values(
            inherited.map((link) => ({
              questionId: row.id,
              sourceId: link.sourceId,
              relevance: link.relevance,
            })),
          )
        }
      }
      return row.id
    }),
  )

const loadProjectContext = (
  projectId: string,
): Effect.Effect<ProjectContext, DbError> =>
  Effect.gen(function* () {
    const rows = yield* dbOp(() =>
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
    const project = rows[0]
    if (!project) return yield* new DbError({ reason: `project ${projectId} not found` })
    const docCount = yield* dbOp(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(uploadedFiles)
        .where(eq(uploadedFiles.projectId, projectId)),
    )
    return {
      name: project.name,
      description: project.description,
      audiences: project.audiences ?? [],
      topics: project.topics ?? [],
      hasDocuments: (docCount[0]?.count ?? 0) > 0,
    }
  })

/** Load the assembled working set for a question (inherited + newly gathered). */
const loadWorkingSet = (
  questionId: string,
): Effect.Effect<WorkingSetSource[], DbError> =>
  Effect.map(
    dbOp(() =>
      db
        .select({
          id: sources.id,
          channel: sources.channel,
          title: sources.title,
          url: sources.url,
          excerpt: sources.excerpt,
          voice: sources.voice,
          relevance: questionSources.relevance,
          undated: sources.undated,
          lastVerifiedAt: sources.lastVerifiedAt,
        })
        .from(questionSources)
        .innerJoin(sources, eq(sources.id, questionSources.sourceId))
        .where(eq(questionSources.questionId, questionId)),
    ),
    (rows) =>
      rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        title: r.title,
        url: r.url,
        excerpt: r.excerpt ?? '',
        voice: r.voice,
        relevance: r.relevance ?? 0,
        undated: r.undated,
        lastVerifiedAt: r.lastVerifiedAt,
      })),
  )

/**
 * Run one question end-to-end in the background, updating its status as it goes
 * (PRD 5.1, 5.5). Gather assembles the working set in the ledger, it is
 * re-verified, then synthesis writes the report and freezes citations. Any
 * failure is caught and recorded as 'failed' so the poller always converges.
 */
export const runForQuestion = (
  questionId: string,
): Effect.Effect<void, never, Retrieval> => {
  const program = Effect.gen(function* () {
    const questionRows = yield* dbOp(() =>
      db
        .select({
          question: questions.question,
          projectId: questions.projectId,
          recencyWindowDays: questions.recencyWindowDays,
        })
        .from(questions)
        .where(eq(questions.id, questionId))
        .limit(1),
    )
    const question = questionRows[0]
    if (!question) return yield* new DbError({ reason: `question ${questionId} not found` })
    const recency = question.recencyWindowDays ?? DEFAULT_RECENCY_WINDOW_DAYS

    const projectContext = yield* loadProjectContext(question.projectId)

    yield* setStatus(questionId, QuestionStatus.Gathering)
    const { stats } = yield* runGather(
      questionId,
      question.question,
      question.projectId,
      projectContext,
      recency,
      HAS_EMBEDDER,
    )

    // Synthesis reads the assembled working set from the ledger (inherited +
    // newly gathered), not gather's in-memory return.
    const workingSet = yield* loadWorkingSet(questionId)
    if (workingSet.length === 0) return yield* new NoEvidenceError({ questionId })

    yield* reverifyWorkingSet(workingSet)

    yield* setStatus(questionId, QuestionStatus.Synthesising)
    const forSynthesis: WorkingSetItem[] = workingSet.map((s) => ({
      id: s.id,
      channel: s.channel,
      title: s.title,
      url: s.url,
      excerpt: s.excerpt,
    }))
    const { insight, citations } = yield* synthesize(question.question, forSynthesis)

    const snapshotById = new Map(workingSet.map((s) => [s.id, s]))
    const shareToken = randomUUID()
    yield* dbOp(() =>
      db.transaction(async (tx) => {
        const [result] = await tx
          .insert(results)
          .values({ questionId, insight, iterationCount: stats.rounds, shareToken })
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
      }),
    )

    yield* setStatus(questionId, QuestionStatus.Complete)
  })

  return program.pipe(
    Effect.catchAll((error) =>
      Effect.zipRight(
        Effect.logError(`run ${questionId} failed: ${JSON.stringify(error)}`),
        setStatus(questionId, QuestionStatus.Failed).pipe(Effect.ignore),
      ),
    ),
  )
}

export interface RenderedSource {
  readonly id: string
  readonly url: string | null
  readonly title: string | null
  readonly excerpt: string | null
  readonly channel: string
  readonly voice: string | null
  readonly verifiedLive: boolean
}

export interface RenderedResult {
  readonly resultId: string
  readonly insight: unknown
  readonly sources: RenderedSource[]
  readonly shareToken: string | null
}

/** The verified sources list for a result, built from frozen citation snapshots. */
const citedSources = (resultId: string): Effect.Effect<RenderedSource[], DbError> =>
  Effect.map(
    dbOp(() =>
      db
        .select({
          sourceId: resultCitations.sourceId,
          snapshotUrl: resultCitations.snapshotUrl,
          snapshotTitle: resultCitations.snapshotTitle,
          snapshotExcerpt: resultCitations.snapshotExcerpt,
          channel: sources.channel,
          voice: sources.voice,
          verifiedLive: sources.verifiedLive,
        })
        .from(resultCitations)
        .innerJoin(sources, eq(sources.id, resultCitations.sourceId))
        .where(eq(resultCitations.resultId, resultId)),
    ),
    (cites) => {
      const byId = new Map<string, RenderedSource>()
      for (const c of cites) {
        if (byId.has(c.sourceId)) continue
        byId.set(c.sourceId, {
          id: c.sourceId,
          url: c.snapshotUrl,
          title: c.snapshotTitle,
          excerpt: c.snapshotExcerpt,
          channel: c.channel,
          voice: c.voice,
          verifiedLive: c.verifiedLive,
        })
      }
      return [...byId.values()]
    },
  )

/**
 * Render a completed result: the stored insight plus the verified sources list,
 * built from the frozen citation snapshots (PRD 5.1, 4.3). Returns null if the
 * question has no result yet.
 */
export const loadRenderedResult = (
  questionId: string,
): Effect.Effect<RenderedResult | null, DbError> =>
  Effect.gen(function* () {
    const resultRows = yield* dbOp(() =>
      db
        .select({
          id: results.id,
          insight: results.insight,
          shareToken: results.shareToken,
        })
        .from(results)
        .where(eq(results.questionId, questionId))
        .orderBy(desc(results.createdAt))
        .limit(1),
    )
    const result = resultRows[0]
    if (!result) return null
    return {
      resultId: result.id,
      insight: result.insight,
      shareToken: result.shareToken,
      sources: yield* citedSources(result.id),
    }
  })

export interface SharedResult {
  readonly resultId: string
  readonly question: string
  readonly insight: unknown
  readonly sources: RenderedSource[]
}

/**
 * Render a result by its public share token (PRD 4.6). Powers the read-only
 * shared link and the PDF export. Returns null for an unknown token.
 */
export const loadSharedResult = (
  token: string,
): Effect.Effect<SharedResult | null, DbError> =>
  Effect.gen(function* () {
    const rows = yield* dbOp(() =>
      db
        .select({
          id: results.id,
          insight: results.insight,
          question: questions.question,
        })
        .from(results)
        .innerJoin(questions, eq(questions.id, results.questionId))
        .where(eq(results.shareToken, token))
        .limit(1),
    )
    const result = rows[0]
    if (!result) return null
    return {
      resultId: result.id,
      question: result.question,
      insight: result.insight,
      sources: yield* citedSources(result.id),
    }
  })
