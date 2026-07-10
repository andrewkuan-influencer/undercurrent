/** JSON response helper for server route handlers. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Accept an array or a comma-separated string, return a clean string list. */
export function normalizeList(input: unknown): string[] {
  const parts = Array.isArray(input)
    ? input.map((x) => String(x))
    : typeof input === 'string'
      ? input.split(',')
      : []
  return parts.map((s) => s.trim()).filter((s) => s.length > 0)
}
