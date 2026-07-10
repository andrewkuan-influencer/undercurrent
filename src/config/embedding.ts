/**
 * The embedding dimension is fixed for the life of the project (PRD 5.4, 6.3).
 * Changing it means re-embedding every vector column, so it is defined here,
 * once, and imported everywhere a vector column is declared. Do not hardcode
 * 1536 anywhere else.
 *
 * Set to 1536 for now; revisit deliberately before launch once the embedding
 * model is chosen (PRD 12).
 */
export const EMBEDDING_DIMENSION = 1536

/**
 * The embedding model, fixed for the life of the project alongside the
 * dimension. OpenAI text-embedding-3-small is natively 1536-dim, matching
 * EMBEDDING_DIMENSION. This is a direct OpenAI call (OPENAI_API_KEY), not via
 * OpenRouter, because OpenRouter has no embeddings endpoint: a deliberate,
 * flagged deviation from "OpenRouter for all model calls" (PRD 5.3, 7, 12).
 */
export const EMBEDDING_MODEL = 'text-embedding-3-small'
