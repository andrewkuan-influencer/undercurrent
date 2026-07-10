/** Character-based chunking for uploaded document text, in one place. */
export const CHUNK_SIZE = 1200
export const CHUNK_OVERLAP = 150

/**
 * Split document text into overlapping chunks for embedding (PRD 6.2). Simple
 * character windows with overlap; good enough for retrieval grounding and easy
 * to reason about. Normalises whitespace first.
 */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (clean.length === 0) return []
  const chunks: string[] = []
  let i = 0
  while (i < clean.length) {
    const end = Math.min(i + CHUNK_SIZE, clean.length)
    chunks.push(clean.slice(i, end).trim())
    if (end >= clean.length) break
    i = end - CHUNK_OVERLAP
  }
  return chunks.filter((c) => c.length > 0)
}
