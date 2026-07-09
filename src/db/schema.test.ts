import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { db, sql } from './client'
import {
  projects,
  questions,
  resultCitations,
  results,
  sources,
} from './schema'

/** Destructure a single returned row, failing loudly if none came back. */
function one<T>(rows: T[]): T {
  const row = rows[0]
  if (!row) throw new Error('expected exactly one row')
  return row
}

/** Sentinel used to roll back the outer transaction once assertions pass. */
class Rollback extends Error {}

/**
 * Walk the error's cause chain for a Postgres SQLSTATE. drizzle wraps driver
 * errors in a DrizzleQueryError whose `.cause` is the underlying PostgresError.
 */
function sqlStateOf(err: unknown): string | undefined {
  let current: unknown = err
  while (current) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string') return code
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

afterAll(async () => {
  await sql.end()
})

describe('evidence ledger schema', () => {
  it('inserts the core rows and enforces the citation FK to sources', async () => {
    const sourceKey = `test:web:${randomUUID()}`

    try {
      await db.transaction(async (tx) => {
        const project = one(
          await tx
            .insert(projects)
            .values({ name: 'Test project' })
            .returning(),
        )
        expect(project.id).toBeTruthy()

        const question = one(
          await tx
            .insert(questions)
            .values({
              projectId: project.id,
              question: 'What is the cultural undercurrent here?',
            })
            .returning(),
        )
        expect(question.projectId).toBe(project.id)

        const source = one(
          await tx
            .insert(sources)
            .values({
              sourceKey,
              channel: 'web',
              url: 'https://example.com/article',
              title: 'Example article',
            })
            .returning(),
        )
        expect(source.id).toBeTruthy()

        const result = one(
          await tx
            .insert(results)
            .values({
              questionId: question.id,
              insight: { headline: 'A test insight', blocks: [] },
            })
            .returning(),
        )
        expect(result.questionId).toBe(question.id)

        // Happy path: a citation that points at a real source is accepted.
        const citation = one(
          await tx
            .insert(resultCitations)
            .values({
              resultId: result.id,
              sourceId: source.id,
              snapshotUrl: 'https://example.com/article',
              snapshotTitle: 'Example article',
              snapshotExcerpt: 'A frozen excerpt at synthesis time.',
            })
            .returning(),
        )
        expect(citation.sourceId).toBe(source.id)

        // The guarantee: a citation pointing at a source id that is not in the
        // ledger is rejected by the foreign key. Postgres raises
        // foreign_key_violation (SQLSTATE 23503). Run it inside a savepoint so
        // the expected failure does not abort the outer transaction.
        let fkError: unknown
        await tx
          .transaction(async (sp) => {
            await sp.insert(resultCitations).values({
              resultId: result.id, // valid: isolates the source_id FK
              sourceId: randomUUID(), // not present in sources
            })
          })
          .catch((err: unknown) => {
            fkError = err
          })

        expect(fkError, 'expected the FK to reject an unknown source id').toBeDefined()
        // 23503 = foreign_key_violation
        expect(sqlStateOf(fkError)).toBe('23503')

        // Leave no rows behind.
        throw new Rollback()
      })
    } catch (err) {
      if (!(err instanceof Rollback)) throw err
    }
  })
})
