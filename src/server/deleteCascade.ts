import { inArray, eq, sql } from 'drizzle-orm'
import { db } from '../db/client'
import {
  documentChunks,
  projects,
  questionSources,
  questions,
  resultCitations,
  results,
  retrievalMemory,
  uploadedFiles,
} from '../db/schema'

/**
 * App-level cascading deletes. No app-table FK carries ON DELETE, so children
 * are removed in FK-safe order inside one transaction. The `sources` table is
 * the shared evidence ledger and is never touched here: only the link tables
 * (`question_sources`, `result_citations`) and per-question rows go.
 */

/** All question ids in the follow-up subtree rooted at `rootId` (inclusive). */
async function collectQuestionSubtree(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  rootId: string,
): Promise<string[]> {
  const rows = await tx.execute(sql`
    WITH RECURSIVE sub AS (
      SELECT id FROM questions WHERE id = ${rootId}
      UNION ALL
      SELECT q.id FROM questions q JOIN sub s ON q.parent_question_id = s.id
    )
    SELECT id FROM sub
  `)
  return [...rows].map((r) => (r as { id: string }).id)
}

/** Delete question rows and their children in FK-safe order. */
async function deleteQuestionRows(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  // Lock the question rows so an in-flight gather's question_sources insert
  // blocks behind this transaction (then fails its FK) instead of landing
  // between our child-table deletes and the final questions delete.
  await tx
    .select({ id: questions.id })
    .from(questions)
    .where(inArray(questions.id, ids))
    .for('update')
  await tx.delete(resultCitations).where(
    inArray(
      resultCitations.resultId,
      tx.select({ id: results.id }).from(results).where(inArray(results.questionId, ids)),
    ),
  )
  await tx.delete(results).where(inArray(results.questionId, ids))
  await tx.delete(questionSources).where(inArray(questionSources.questionId, ids))
  await tx.delete(retrievalMemory).where(inArray(retrievalMemory.questionId, ids))
  // One statement for parents and children together: the self-referencing FK
  // is NO ACTION, checked after the statement, so no child-first ordering is
  // needed within the delete itself.
  await tx.delete(questions).where(inArray(questions.id, ids))
}

/** Delete a question plus its whole follow-up subtree. */
export async function deleteQuestionSubtree(
  rootId: string,
): Promise<{ deletedIds: string[] }> {
  return db.transaction(async (tx) => {
    const ids = await collectQuestionSubtree(tx, rootId)
    await deleteQuestionRows(tx, ids)
    return { deletedIds: ids }
  })
}

/** Delete a project and everything under it: questions, files, chunks. */
export async function deleteProjectCascade(projectId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Follow-ups always share their parent's project, so a flat select covers
    // every subtree; no recursion needed.
    const rows = await tx
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.projectId, projectId))
    await deleteQuestionRows(tx, rows.map((r) => r.id))

    await tx.delete(documentChunks).where(
      inArray(
        documentChunks.fileId,
        tx
          .select({ id: uploadedFiles.id })
          .from(uploadedFiles)
          .where(eq(uploadedFiles.projectId, projectId)),
      ),
    )
    await tx.delete(uploadedFiles).where(eq(uploadedFiles.projectId, projectId))
    await tx.delete(projects).where(eq(projects.id, projectId))
  })
}
