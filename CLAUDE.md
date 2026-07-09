# CLAUDE.md

## What this project is

Undercurrent (the CSI Engine) is an internal cultural and social insight tool for
Influencer, a marketing and influencer agency. A strategist asks a natural-language
question about a cultural topic and receives a structured insight report grounded in
real, verifiable sources drawn from Reddit, the open web (via Tavily), and documents
uploaded to the project. This is v2, a production rebuild of a hackathon prototype,
in a fresh repository.

The full specification lives in `docs/Undercurrent_Technical_PRD.docx`. When a task
touches architecture, data model, agent behaviour, or cost, read the relevant PRD
section before writing code. Section numbers referenced below are PRD sections.

## The one rule that can never break

Synthesis may only cite sources that already exist in the evidence ledger. Every
citation must resolve to a real row in `sources`, enforced three ways: the foreign
key from `result_citations.source_id` to `sources.id`, validation that rejects any
model-produced citation id not in the working set, and frozen snapshot fields
(`snapshot_url`, `snapshot_title`, `snapshot_excerpt`) captured at synthesis time.
Never weaken any of these to make something work. If a model response cites an
unknown id, that is a hard error, not something to patch over.

## Architecture in one paragraph

Two stages with the evidence ledger between them (section 5.1). The gather stage is
an agentic loop: a planning step produces facets and per-channel queries, retrieval
runs in priority order (project documents first via pgvector, then Reddit and web
together), everything is recency-filtered, then scored, extracted, deduplicated,
and written to the ledger. The loop stops on coverage plus saturation, never on
token count or link count, with hard caps as a backstop (section 5.4). The
synthesis stage reads the assembled working set, re-verifies stale sources with a
cheap liveness check (never a model call), makes one main-model call to write the
report, and binds citations with frozen snapshots.

## Stack (locked, do not substitute)

- TanStack Start + Nitro, TypeScript, deployed to Vercel (Pro). The gather run
  belongs in a Vercel Queue handler or Workflow in production; inline is fine in dev.
- Effect for the backend. Typed errors everywhere; retrieval is mostly failure cases.
- Postgres + pgvector on Neon. Nine tables per the appendix DDL (section 13):
  projects, questions, sources, question_sources, results, result_citations,
  uploaded_files, document_chunks, retrieval_memory.
- OpenRouter for all model calls, on the Influencer key. Never call model
  providers directly.
- Tavily for web search and extraction. Reddit API for social. Both sit behind the
  thin internal retrieval service (section 7); nothing outside that module may call
  an external search provider.

## Model allocation (the main cost lever, section 5.4)

- Sonnet (main model): the planning call and the single synthesis call. Nothing else.
- Haiku (lightweight): all per-item, high-volume work: relevance scoring,
  extraction, classification, the sufficiency check, citation binding.
- Embeddings: one model and one dimension, fixed for the life of the project. The
  dimension is a single constant in one place. Do not introduce a second embedding
  model anywhere.

## Data model rules (section 6.3)

- Dedupe through `source_key` (UNIQUE) with INSERT ... ON CONFLICT bumping
  `seen_count` and `last_seen_at`. Keys are namespaced: Reddit fullname,
  canonicalised-URL hash, or file-content-hash plus chunk index.
- `results.insight` is JSONB. Relational data stays relational; do not put
  relational data into JSON blobs.
- Re-verification is lazy and access-triggered: only when a source joins a working
  set and `last_verified_at` is older than 7 days. It is an HTTP or Reddit API
  liveness check, never a model call.
- Recency: the question's `recency_window_days` feeds the planning step and filters
  retrieval. Internal documents are always in scope. Undated external sources are
  kept but flagged, not dropped.

## Conventions

- Prompts live in a dedicated `prompts/` directory, one file per prompt. They will
  be iterated on heavily; never inline them in logic.
- Loop thresholds (min sources per facet, saturation ratio, max rounds, max
  sources) are named constants in one config file.
- Secrets only in environment variables: DATABASE_URL, OPENROUTER_API_KEY,
  TAVILY_API_KEY, REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET. `.env` is gitignored and
  must stay that way.
- Auth (when built): Better Auth, Google sign-in plus an influencer email
  whitelist auto-provisioning at a baseline role (section 8). Only the shareable
  report route is public.
- Commit at every green moment. Small slices, conventional structure, no
  cleverness where boring works.

## Writing style for anything user-facing

Never use em-dashes or en-dashes in user-facing copy, UI text, or documents. Use
commas, colons, or full stops. Plain, warm, confident language. Reports must
provoke rather than conclude, and consumer voice takes priority over expert voice
(section 4.4).

## When unsure

If a decision is not covered here or in the PRD (for example the embedding model
choice, auth details, or a schema change), stop and ask rather than inventing. The
PRD is the source of truth; if reality forces a deviation, flag it explicitly so
the document can be updated rather than silently drifting.
