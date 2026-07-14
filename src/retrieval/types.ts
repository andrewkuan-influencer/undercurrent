/**
 * The retrieval boundary (PRD 7). Every external provider is reached through
 * this one service and normalised into a single RetrievedItem shape, so a
 * provider can be swapped without touching the rest of the engine.
 *
 * This module does retrieval and normalisation only: no scoring, no
 * deduplication, no ledger writes. It carries the channel-specific identifiers
 * a caller needs to build a stable `source_key` later (PRD 6.3), but does not
 * build the key itself.
 */

export type Channel = 'web' | 'reddit' | 'doc'

/** A time window applied at the provider, scoping results before they return. */
export type TimeRange = 'day' | 'week' | 'month' | 'year'

/**
 * Channel-specific identifier, enough to build the namespaced `source_key`
 * later: canonicalised-URL hash for web, Reddit fullname for reddit,
 * file-content-hash plus chunk index for docs (PRD 6.3).
 */
export type SourceIdentifier =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'reddit_fullname'; readonly fullname: string }
  | {
      readonly kind: 'doc_chunk'
      readonly fileId: string
      readonly chunkIndex: number
      readonly contentHash: string | null
    }

/** The common shape every channel normalises to. */
export interface RetrievedItem {
  readonly channel: Channel
  readonly url: string | null
  readonly title: string | null
  /** Extracted content for web/doc, post body for reddit. May be empty. */
  readonly content: string
  readonly publishedAt: Date | null
  readonly identifier: SourceIdentifier
}

export interface WebSearchOptions {
  readonly timeRange?: TimeRange
  readonly maxResults?: number
  readonly timeoutMs?: number
  /** Restrict the provider's search to these domains (Tavily include_domains). */
  readonly includeDomains?: ReadonlyArray<string>
  /**
   * Channel to stamp on the results. Defaults to 'web'; the reddit channel's
   * Tavily fallback sets 'reddit' so downstream scoring and stats stay honest.
   */
  readonly tagChannel?: Channel
}

export interface RedditSearchOptions {
  readonly timeRange?: TimeRange
  readonly maxResults?: number
  readonly timeoutMs?: number
  readonly sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments'
}

export interface DocumentSearchOptions {
  /**
   * The query embedding. The embedding model and dimension are a deliberately
   * deferred decision (PRD 12), so the caller supplies the vector for now and
   * this service performs only the pgvector cosine search. Its length must
   * equal EMBEDDING_DIMENSION.
   */
  readonly queryEmbedding: ReadonlyArray<number>
  readonly limit?: number
}
