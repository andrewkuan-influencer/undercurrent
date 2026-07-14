import '@fontsource-variable/dm-sans'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  redirect,
  useRouteContext,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { signOut } from '../auth/client'
import { fetchSession, type SessionUser } from '../auth/session'

/** Routes reachable without a session: sign-in and the public shared report. */
const PUBLIC_PREFIXES = ['/signin', '/share']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

export const Route = createRootRoute({
  // Gate every route behind auth except the public prefixes (PRD 8).
  beforeLoad: async ({ location }) => {
    const session = await fetchSession()
    if (!session && !isPublicPath(location.pathname)) {
      throw redirect({ to: '/signin' })
    }
    return { user: session?.user ?? null }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Undercurrent' },
    ],
  }),
  component: RootComponent,
})

// Brand pass: DM Sans, a teal accent on a warm-neutral ground, rounded surfaces
// with a soft shadow, and uppercase tracked eyebrow labels. Light-only, matching
// the reference design. Everything is driven through the tokens on :root.
const GLOBAL_CSS = `
  :root {
    --measure: 42rem;
    --font-sans: "DM Sans Variable", system-ui, -apple-system, sans-serif;
    --bg: #fafafa;
    --surface: #ffffff;
    --fg: #1a1a1a;
    --muted: #7c7c85;
    --border: #e5e5e5;
    --teal: #0d9488;
    --teal-strong: #0f766e;
    --teal-light: #f0fdfa;
    --radius: 0.75rem;
    --radius-sm: 0.5rem;
    --shadow: 0 1px 2px rgba(17,24,39,0.04), 0 4px 16px rgba(17,24,39,0.05);
    color-scheme: light;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    font-family: var(--font-sans);
    font-weight: 400;
    line-height: 1.6;
    color: var(--fg);
    background: var(--bg);
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--teal-strong); }
  ::selection { background: #cbfaf0; }
  :focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; border-radius: 4px; }

  .site-header {
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    padding: 0.9rem 1.5rem;
  }
  .brand { display: inline-flex; flex-direction: column; text-decoration: none; line-height: 1.1; }
  .brand-name { font-weight: 700; font-size: 1.15rem; letter-spacing: -0.01em; color: var(--teal-strong); }
  .brand-tag { font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-top: 0.1rem; }

  .container { max-width: 60rem; margin: 0 auto; padding: 2.5rem 1.5rem 6rem; }
  .prose { max-width: var(--measure); }

  h1 { font-size: 2rem; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; text-wrap: balance; margin: 0 0 0.6rem; }
  h1, h2, h3 { line-height: 1.2; }
  h2 {
    font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.09em; font-weight: 600;
    color: var(--muted); margin: 2.5rem 0 0.75rem;
  }

  label { display: block; font-size: 0.82rem; font-weight: 500; color: var(--fg); margin-bottom: 0.3rem; }
  input[type="text"], input[type="file"], textarea, select {
    width: 100%; font: inherit; padding: 0.55rem 0.7rem;
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    background: var(--surface); color: var(--fg);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input[type="text"]:focus, textarea:focus, select:focus {
    outline: none; border-color: var(--teal);
    box-shadow: 0 0 0 3px rgba(13,148,136,0.15);
  }
  textarea { min-height: 4.5rem; resize: vertical; }
  input[type="range"] { width: 100%; accent-color: var(--teal); }

  button {
    font: inherit; font-weight: 500; padding: 0.55rem 1rem; border: 1px solid var(--teal);
    border-radius: var(--radius-sm); background: var(--teal); color: #fff; cursor: pointer;
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  }
  button:hover:not(:disabled) { background: var(--teal-strong); border-color: var(--teal-strong); }
  button.secondary { background: var(--surface); color: var(--teal-strong); border-color: var(--border); }
  button.secondary:hover:not(:disabled) { background: var(--teal-light); border-color: var(--teal); }
  button:disabled { opacity: 0.45; cursor: default; }
  a.button-link {
    display: inline-block; text-decoration: none; font-weight: 500;
    padding: 0.55rem 1rem; border-radius: var(--radius-sm);
    background: var(--surface); color: var(--teal-strong); border: 1px solid var(--border);
  }
  a.button-link:hover { background: var(--teal-light); border-color: var(--teal); }

  ul.clean, ol.clean { list-style: none; padding: 0; margin: 0; }
  .card {
    border: 1px solid var(--border); border-radius: var(--radius); padding: 1.1rem 1.25rem;
    background: var(--surface); box-shadow: var(--shadow); margin-bottom: 0.75rem;
  }
  a.card-link { text-decoration: none; }
  a.card-link:hover .card { border-color: var(--teal); }

  .muted { color: var(--muted); }
  .pill {
    display: inline-block; font-size: 0.7rem; font-weight: 500; padding: 0.12rem 0.5rem;
    border-radius: 999px; margin-left: 0.4rem;
    background: var(--teal-light); color: var(--teal-strong); border: 1px solid #cdefe9;
  }
  .tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
  .tag {
    font-size: 0.74rem; padding: 0.14rem 0.55rem; border-radius: 999px;
    background: #f4f4f5; color: #52525b; border: 1px solid var(--border);
  }
  .eyebrow {
    display: inline-block; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.09em;
    text-transform: uppercase; padding: 0.2rem 0.55rem; border-radius: 6px; margin: 2.5rem 0 0.85rem;
  }
  blockquote {
    margin: 0.6rem 0; padding: 0.4rem 0 0.4rem 0.95rem; border-left: 3px solid var(--teal);
    color: #3f3f46; font-style: italic; background: var(--teal-light); border-radius: 0 6px 6px 0;
  }
  sup a { text-decoration: none; font-size: 0.7em; color: var(--teal-strong); font-weight: 600; }
  .stack > * + * { margin-top: 0.7rem; }

  @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  .status-dot {
    display: inline-block; width: 0.55rem; height: 0.55rem; border-radius: 999px;
    background: var(--teal); margin-right: 0.5rem; vertical-align: middle;
    animation: pulse-dot 1.4s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) { .status-dot { animation: none; } }
`

function RootComponent() {
  const { user } = useRouteContext({ from: Route.id }) as {
    user: SessionUser | null
  }
  return (
    <RootDocument>
      <header
        className="site-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}
      >
        <Link to="/" className="brand">
          <span className="brand-name">Undercurrent</span>
          <span className="brand-tag">Cultural &amp; Social Insight</span>
        </Link>
        {user ? (
          <span
            className="muted"
            style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>{user.email}</span>
            {user.role ? <span className="pill">{user.role}</span> : null}
            <button
              type="button"
              className="secondary"
              style={{ padding: '0.3rem 0.7rem' }}
              onClick={() => {
                void signOut().then(() => {
                  window.location.href = '/signin'
                })
              }}
            >
              Sign out
            </button>
          </span>
        ) : null}
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
