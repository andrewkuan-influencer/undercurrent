import { createServerFn } from '@tanstack/react-start'

export interface SessionUser {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly role: string | null
}

/**
 * Read the current session on the server (SSR and via RPC on the client). The
 * server-only imports (auth, db) are loaded inside the handler so they never
 * reach the client bundle.
 */
export const fetchSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ user: SessionUser } | null> => {
    const { getRequest } = await import('@tanstack/react-start/server')
    const { auth } = await import('./auth')
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    })
    if (!session) return null
    const u = session.user as {
      id: string
      email: string
      name: string
      role?: string | null
    }
    return { user: { id: u.id, email: u.email, name: u.name, role: u.role ?? null } }
  },
)
