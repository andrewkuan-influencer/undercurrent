import { Effect, Schema } from 'effect'
import gatherPlanPrompt from '../../prompts/gather-plan.md?raw'
import { MAIN_MODEL } from '../config/models'
import { callModel } from '../models/openrouter'
import { extractJson } from '../models/json'
import { PlanError } from './errors'

/** Context the planner is given about the project the question lives in. */
export interface ProjectContext {
  readonly name: string
  readonly description: string | null
  readonly audiences: ReadonlyArray<string>
  readonly topics: ReadonlyArray<string>
  readonly hasDocuments: boolean
}

const ChannelQueries = Schema.Struct({
  web: Schema.optional(Schema.Array(Schema.String)),
  reddit: Schema.optional(Schema.Array(Schema.String)),
  doc: Schema.optional(Schema.Array(Schema.String)),
})

const PlanFacet = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  queries: ChannelQueries,
})
export type PlanFacet = Schema.Schema.Type<typeof PlanFacet>

const GatherPlan = Schema.Struct({
  facets: Schema.Array(PlanFacet),
  leadChannels: Schema.optional(Schema.Array(Schema.String)),
})
export type GatherPlan = Schema.Schema.Type<typeof GatherPlan>

/**
 * The planning step (PRD 5.4): one main-model call turns the question, recency
 * window, and project context into facets plus per-channel queries. The recency
 * window is injected here so queries are scoped from the outset.
 */
export const planStep = (
  questionText: string,
  project: ProjectContext,
  recencyWindowDays: number,
): Effect.Effect<GatherPlan, PlanError> =>
  Effect.gen(function* () {
    const systemPrompt = gatherPlanPrompt

    const context = {
      question: questionText,
      recencyWindowDays,
      project: {
        name: project.name,
        description: project.description,
        audiences: project.audiences,
        topics: project.topics,
        hasDocuments: project.hasDocuments,
      },
    }

    const raw = yield* callModel({
      model: MAIN_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(context, null, 2) },
      ],
      temperature: 0.4,
    }).pipe(
      Effect.mapError((error) => new PlanError({ reason: error.reason })),
    )

    const parsed = yield* Effect.try({
      try: () => JSON.parse(extractJson(raw)) as unknown,
      catch: () => new PlanError({ reason: 'plan was not valid JSON', raw }),
    })

    const plan = yield* Schema.decodeUnknown(GatherPlan)(parsed).pipe(
      Effect.mapError(
        (error) =>
          new PlanError({ reason: `plan schema mismatch: ${error}`, raw }),
      ),
    )

    if (plan.facets.length === 0) {
      return yield* new PlanError({ reason: 'plan produced no facets', raw })
    }
    return plan
  })
