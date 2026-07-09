import { Effect } from 'effect'
import { DEFAULT_MAX_RESULTS, DEFAULT_TIMEOUT_MS } from './constants'
import { EmptyResultsError } from './errors'
import { fetchJson } from './http'
import type { RetrievedItem, WebSearchOptions } from './types'

interface TavilyResult {
  url?: string
  title?: string
  content?: string
  raw_content?: string
  published_date?: string
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function normalise(r: TavilyResult): RetrievedItem | null {
  if (!r.url) return null
  const raw = typeof r.raw_content === 'string' ? r.raw_content.trim() : ''
  return {
    channel: 'web',
    url: r.url,
    title: r.title ?? null,
    content: raw.length > 0 ? raw : (r.content ?? ''),
    publishedAt: toDate(r.published_date),
    identifier: { kind: 'url', url: r.url },
  }
}

/**
 * Tavily web search with content extraction in one call (PRD 7). `timeRange`
 * scopes freshness at the provider. include_raw_content pulls the extracted
 * page body, falling back to the snippet when extraction is unavailable.
 */
export const searchWeb = (
  apiKey: string,
  query: string,
  options: WebSearchOptions = {},
) =>
  Effect.gen(function* () {
    const body = {
      query,
      max_results: options.maxResults ?? DEFAULT_MAX_RESULTS,
      search_depth: 'advanced',
      include_raw_content: true,
      ...(options.timeRange ? { time_range: options.timeRange } : {}),
    }

    const json = yield* fetchJson({
      channel: 'web',
      url: 'https://api.tavily.com/search',
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      init: {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    })

    const results = (json as { results?: TavilyResult[] }).results ?? []
    const items = results
      .map(normalise)
      .filter((x): x is RetrievedItem => x !== null)

    if (items.length === 0) {
      return yield* new EmptyResultsError({ channel: 'web', query })
    }
    return items
  })
