import { and, eq } from 'drizzle-orm'
import { auth } from './auth'
import { db } from '../db/client'
import { projects, questions } from '../db/schema'

/**
 * Resolve the signed-in user from a request's cookies, or null. Data API routes
 * use this to reject unauthenticated callers (PRD 8, 9.3); the public shared
 * report endpoint is the only data route that skips it.
 */
export async function requireUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user ?? null
}

/**
 * True when the user owns the project. Projects are scoped per user (a future
 * sharing model extends this check to owner-or-shared); legacy NULL-owner rows
 * are invisible to everyone.
 */
export async function ownsProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1)
  return rows.length > 0
}

/** The project a question belongs to, or null when the question does not exist. */
export async function projectIdOfQuestion(
  questionId: string,
): Promise<string | null> {
  const rows = await db
    .select({ projectId: questions.projectId })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1)
  return rows[0]?.projectId ?? null
}
