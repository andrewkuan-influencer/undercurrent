/**
 * Pull the JSON value out of a model response that may be wrapped in a markdown
 * code fence or padded with prose. Best-effort: returns the most plausible JSON
 * substring, leaving parsing (and its typed failure) to the caller.
 */
export function extractJson(text: string): string {
  const trimmed = text.trim()
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence && fence[1] !== undefined) return fence[1].trim()

  const firstBrace = trimmed.indexOf('{')
  const firstBracket = trimmed.indexOf('[')
  const starts = [firstBrace, firstBracket].filter((i) => i !== -1)
  if (starts.length === 0) return trimmed
  const start = Math.min(...starts)
  const open = trimmed[start]
  const close = open === '{' ? '}' : ']'
  const end = trimmed.lastIndexOf(close)
  if (end > start) return trimmed.slice(start, end + 1)
  return trimmed
}
