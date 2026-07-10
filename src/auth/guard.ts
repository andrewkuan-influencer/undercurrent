import { auth } from './auth'

/**
 * Resolve the signed-in user from a request's cookies, or null. Data API routes
 * use this to reject unauthenticated callers (PRD 8, 9.3); the public shared
 * report endpoint is the only data route that skips it.
 */
export async function requireUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user ?? null
}
