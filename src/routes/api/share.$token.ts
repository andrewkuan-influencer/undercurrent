import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { loadSharedResult } from '../../report/run'
import { json } from '../../server/http'

/**
 * Public read-only report data by share token (PRD 4.6). No auth: this is the
 * one data route reachable without a session, keyed by an unguessable token.
 */
export const Route = createFileRoute('/api/share/$token')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const exit = await Effect.runPromiseExit(loadSharedResult(params.token))
        if (exit._tag === 'Failure') return json({ error: 'failed to load' }, 500)
        if (!exit.value) return json({ error: 'not found' }, 404)
        return json(exit.value)
      },
    },
  },
})
