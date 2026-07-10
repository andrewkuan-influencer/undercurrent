import { Effect } from 'effect'
import { RetrievalLive } from '../retrieval'
import { runForQuestion } from '../report/run'

/**
 * Kick a question run in the background and return immediately (PRD 5.5). In dev
 * this is fire-and-forget on the long-lived server process; in production it
 * would be a Vercel Queue handler or Workflow. runForQuestion records its own
 * terminal status, so a crash here still converges the poller.
 */
export function startRun(questionId: string): void {
  void Effect.runPromise(
    runForQuestion(questionId).pipe(Effect.provide(RetrievalLive)),
  ).catch((cause) => console.error(`[run] question ${questionId} crashed`, cause))
}
