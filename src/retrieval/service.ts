import { Config, Context, Effect, Layer } from 'effect'
import type { ConfigError } from 'effect/ConfigError'
import { searchDocuments } from './documents'
import { ProviderError, type RetrievalError } from './errors'
import { searchReddit } from './reddit'
import { searchWeb } from './tavily'
import type {
  Channel,
  DocumentSearchOptions,
  RedditSearchOptions,
  RetrievedItem,
  WebSearchOptions,
} from './types'

/**
 * The single retrieval boundary (PRD 7). One interface, three channel
 * implementations behind it. API keys are read lazily per channel so a missing
 * key only fails the channel that needs it, surfaced as a typed ProviderError.
 */
export interface RetrievalService {
  readonly searchWeb: (
    query: string,
    options?: WebSearchOptions,
  ) => Effect.Effect<ReadonlyArray<RetrievedItem>, RetrievalError>
  readonly searchReddit: (
    query: string,
    options?: RedditSearchOptions,
  ) => Effect.Effect<ReadonlyArray<RetrievedItem>, RetrievalError>
  readonly searchDocuments: (
    query: string,
    projectId: string,
    options: DocumentSearchOptions,
  ) => Effect.Effect<ReadonlyArray<RetrievedItem>, RetrievalError>
}

export class Retrieval extends Context.Tag('undercurrent/Retrieval')<
  Retrieval,
  RetrievalService
>() {}

const missingConfig =
  (channel: Channel) =>
  (error: ConfigError): ProviderError =>
    new ProviderError({ channel, reason: `configuration error: ${error}` })

/** A credential that is unset, blank, or the .env.example placeholder. */
const isPlaceholder = (value: string): boolean =>
  value.trim().length === 0 || value.trim() === '...'

export const RetrievalLive = Layer.succeed(
  Retrieval,
  Retrieval.of({
    searchWeb: (query, options) =>
      Config.string('TAVILY_API_KEY').pipe(
        Effect.mapError(missingConfig('web')),
        Effect.flatMap((apiKey) => searchWeb(apiKey, query, options)),
      ),
    // Hybrid reddit channel: the direct Reddit API when real creds exist,
    // otherwise Tavily restricted to reddit.com. The fallback carries no
    // upvote/structured post data, so the direct API stays preferred (PRD 7);
    // items are tagged channel 'reddit' either way.
    searchReddit: (query, options) =>
      Effect.all([
        Config.string('REDDIT_CLIENT_ID').pipe(Config.withDefault('')),
        Config.string('REDDIT_CLIENT_SECRET').pipe(Config.withDefault('')),
      ]).pipe(
        Effect.mapError(missingConfig('reddit')),
        Effect.flatMap(([clientId, clientSecret]) => {
          if (!isPlaceholder(clientId) && !isPlaceholder(clientSecret)) {
            return searchReddit({ clientId, clientSecret }, query, options)
          }
          return Config.string('TAVILY_API_KEY').pipe(
            Effect.mapError(missingConfig('reddit')),
            Effect.flatMap((apiKey) =>
              searchWeb(apiKey, query, {
                timeRange: options?.timeRange,
                maxResults: options?.maxResults,
                timeoutMs: options?.timeoutMs,
                includeDomains: ['reddit.com'],
                tagChannel: 'reddit',
              }),
            ),
          )
        }),
      ),
    searchDocuments: (query, projectId, options) =>
      searchDocuments(query, projectId, options),
  }),
)
