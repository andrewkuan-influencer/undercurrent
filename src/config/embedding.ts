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
