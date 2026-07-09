import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Effect } from 'effect'
import { ModelError } from '../models/openrouter'

/**
 * Load the synthesis system prompt from prompts/synthesis.md. Prompts live in
 * their own files (CLAUDE.md) so they can be iterated without touching logic.
 */
export const loadSynthesisPrompt: Effect.Effect<string, ModelError> =
  Effect.tryPromise({
    try: () => readFile(join(process.cwd(), 'prompts', 'synthesis.md'), 'utf8'),
    catch: (cause) =>
      new ModelError({ reason: `failed to load synthesis prompt: ${String(cause)}` }),
  })
