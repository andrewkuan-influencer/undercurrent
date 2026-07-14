import { Effect } from 'effect'
import synthesisPrompt from '../../prompts/synthesis.md?raw'

/**
 * The synthesis system prompt. Prompts live in their own files (CLAUDE.md) so
 * they can be iterated without touching logic, and are imported with Vite's
 * `?raw` so they ship inside the serverless bundle rather than being read from
 * the filesystem at runtime (which is absent on Vercel).
 */
export const loadSynthesisPrompt: Effect.Effect<string> =
  Effect.succeed(synthesisPrompt)
