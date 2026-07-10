import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../auth/auth'

/**
 * Better Auth mounts all of its endpoints under /api/auth/* (Google callback,
 * session, sign-out, admin, etc.). This splat route forwards every method to the
 * Better Auth handler (PRD 8).
 */
const handler = ({ request }: { request: Request }) => auth.handler(request)

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
})
