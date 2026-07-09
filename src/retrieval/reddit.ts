import { Effect } from 'effect'
import {
  DEFAULT_MAX_RESULTS,
  DEFAULT_TIMEOUT_MS,
  REDDIT_USER_AGENT,
} from './constants'
import { EmptyResultsError, ProviderError } from './errors'
import { fetchJson } from './http'
import type { RedditSearchOptions, RetrievedItem } from './types'

export interface RedditCredentials {
  readonly clientId: string
  readonly clientSecret: string
}

interface RedditPost {
  name?: string // fullname, e.g. t3_abc123
  title?: string
  selftext?: string
  url?: string
  permalink?: string
  created_utc?: number
}

interface RedditChild {
  kind?: string
  data?: RedditPost
}

function normalise(d: RedditPost): RetrievedItem | null {
  if (!d.name) return null
  const permalink = d.permalink
    ? `https://www.reddit.com${d.permalink}`
    : (d.url ?? null)
  const selftext = typeof d.selftext === 'string' ? d.selftext.trim() : ''
  return {
    channel: 'reddit',
    url: permalink,
    title: d.title ?? null,
    content: selftext.length > 0 ? selftext : (d.title ?? ''),
    publishedAt:
      typeof d.created_utc === 'number'
        ? new Date(d.created_utc * 1000)
        : null,
    identifier: { kind: 'reddit_fullname', fullname: d.name },
  }
}

/**
 * Reddit search over the app-only OAuth flow (client_credentials grant): fetch
 * a userless token, then hit the search endpoint. `timeRange` maps to Reddit's
 * `t` filter; results are restricted to link posts.
 */
export const searchReddit = (
  credentials: RedditCredentials,
  query: string,
  options: RedditSearchOptions = {},
) =>
  Effect.gen(function* () {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const basic = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`,
    ).toString('base64')

    const tokenJson = yield* fetchJson({
      channel: 'reddit',
      url: 'https://www.reddit.com/api/v1/access_token',
      timeoutMs,
      init: {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': REDDIT_USER_AGENT,
        },
        body: 'grant_type=client_credentials',
      },
    })

    const token = (tokenJson as { access_token?: string }).access_token
    if (!token) {
      return yield* new ProviderError({
        channel: 'reddit',
        reason: 'no access_token in token response',
      })
    }

    const params = new URLSearchParams({
      q: query,
      limit: String(options.maxResults ?? DEFAULT_MAX_RESULTS),
      sort: options.sort ?? 'relevance',
      t: options.timeRange ?? 'all',
      type: 'link',
      raw_json: '1',
    })

    const searchJson = yield* fetchJson({
      channel: 'reddit',
      url: `https://oauth.reddit.com/search?${params.toString()}`,
      timeoutMs,
      init: {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': REDDIT_USER_AGENT,
        },
      },
    })

    const children =
      (searchJson as { data?: { children?: RedditChild[] } }).data?.children ??
      []
    const items = children
      .filter((c) => c.kind === 't3' && c.data)
      .map((c) => normalise(c.data as RedditPost))
      .filter((x): x is RetrievedItem => x !== null)

    if (items.length === 0) {
      return yield* new EmptyResultsError({ channel: 'reddit', query })
    }
    return items
  })
