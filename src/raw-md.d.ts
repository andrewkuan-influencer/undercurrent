// Vite `?raw` imports: markdown loaded as a string, baked into the bundle at
// build time. Prompts stay as standalone files under prompts/ (CLAUDE.md), but
// are imported this way so they ship inside the serverless function rather than
// being read from the filesystem at runtime (which fails on Vercel).
declare module '*.md?raw' {
  const content: string
  export default content
}
