import { Effect } from 'effect'
import { waitUntil } from '@vercel/functions'
import { RetrievalLive } from '../retrieval'
import { runForQuestion } from '../report/run'

/**
 * Kick a question run in the background and return immediately (PRD 5.5).
 *
 * The gather loop must never finish inside the web request: the handler records
 * the job, calls this, and returns; the loop runs on afterwards and updates the
 * question's status, which the interface polls.
 *
 * In dev the server is a long-lived process, so a fire-and-forget promise runs
 * to completion on its own. On Vercel the request function is frozen the instant
 * the response is sent, which would strand the loop, so we also register it with
 * waitUntil. That keeps the Fluid Compute function alive until the run settles,
 * bounded by the function's maxDuration (configured in vite.config.ts), while
 * active-CPU billing pauses during the loop's model and API waits (PRD 5.5). A
 * run that outgrows a single function is the case for a Workflow; ours finish in
 * a minute or two, well inside the window.
 *
 * runForQuestion records its own terminal status, so a crash here still
 * converges the poller.
 */
export function startRun(questionId: string): void {
  const run = Effect.runPromise(
    runForQuestion(questionId).pipe(Effect.provide(RetrievalLive)),
  ).catch((cause) => console.error(`[run] question ${questionId} crashed`, cause))

  // Only meaningful on Vercel; off-platform waitUntil is a safe no-op, but the
  // guard keeps the intent explicit. The promise above runs either way.
  if (process.env.VERCEL) waitUntil(run)
}
