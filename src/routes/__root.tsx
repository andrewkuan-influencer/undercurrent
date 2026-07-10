import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Undercurrent' },
    ],
  }),
  component: RootComponent,
})

// Plain, unbranded styling: system typography, generous spacing, neutral rules.
// A colour system and brand pass come later.
const GLOBAL_CSS = `
  :root { --measure: 46rem; color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.55;
    color: #16181d;
    background: #fbfbfa;
  }
  a { color: inherit; }
  .site-header {
    border-bottom: 1px solid rgba(0,0,0,0.12);
    padding: 1rem 1.5rem;
  }
  .site-header a { font-weight: 600; letter-spacing: 0.02em; text-decoration: none; }
  .container { max-width: 60rem; margin: 0 auto; padding: 2rem 1.5rem 5rem; }
  .prose { max-width: var(--measure); }
  h1, h2, h3 { line-height: 1.2; }
  h2 {
    font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em;
    color: #565b64; margin: 2.5rem 0 0.75rem;
  }
  label { display: block; font-size: 0.85rem; color: #565b64; margin-bottom: 0.25rem; }
  input[type="text"], textarea, select {
    width: 100%; font: inherit; padding: 0.5rem 0.6rem;
    border: 1px solid rgba(0,0,0,0.25); border-radius: 6px; background: #fff; color: inherit;
  }
  textarea { min-height: 4.5rem; resize: vertical; }
  button {
    font: inherit; padding: 0.5rem 0.9rem; border: 1px solid rgba(0,0,0,0.35);
    border-radius: 6px; background: #16181d; color: #fff; cursor: pointer;
  }
  button.secondary { background: #fff; color: #16181d; }
  button:disabled { opacity: 0.5; cursor: default; }
  ul.clean { list-style: none; padding: 0; margin: 0; }
  .card {
    border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; padding: 1rem 1.15rem;
    background: #fff; margin-bottom: 0.75rem;
  }
  .muted { color: #565b64; }
  .pill {
    display: inline-block; font-size: 0.72rem; padding: 0.1rem 0.45rem;
    border: 1px solid rgba(0,0,0,0.2); border-radius: 999px; margin-left: 0.4rem;
  }
  .tags { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.35rem; }
  .tag { font-size: 0.75rem; padding: 0.1rem 0.5rem; border: 1px solid rgba(0,0,0,0.18); border-radius: 4px; }
  blockquote {
    margin: 0.5rem 0; padding-left: 0.9rem; border-left: 3px solid rgba(0,0,0,0.25);
    font-style: italic;
  }
  sup a { text-decoration: none; font-size: 0.7em; }
  .stack > * + * { margin-top: 0.6rem; }
  @media (prefers-color-scheme: dark) {
    body { color: #e9eaec; background: #14151a; }
    .site-header { border-color: rgba(255,255,255,0.14); }
    input[type="text"], textarea, select { background: #1d1f26; border-color: rgba(255,255,255,0.25); }
    .card { background: #1a1c22; border-color: rgba(255,255,255,0.14); }
    button { background: #e9eaec; color: #14151a; border-color: rgba(255,255,255,0.3); }
    button.secondary { background: #1d1f26; color: #e9eaec; }
    .muted, h2 { color: #a2a7b0; }
  }
`

function RootComponent() {
  return (
    <RootDocument>
      <header className="site-header">
        <Link to="/">Undercurrent</Link>
      </header>
      <div className="container">
        <Outlet />
      </div>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
