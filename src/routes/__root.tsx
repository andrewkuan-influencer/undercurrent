import '@fontsource-variable/dm-sans'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  redirect,
  useLocation,
  useRouteContext,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { fetchSession, type SessionUser } from '../auth/session'
import { Sidebar } from '../ui/Sidebar'

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
      { title: 'Undercurrent — Cultural & Social Insight' },
    ],
  }),
  component: RootComponent,
})

// Design system per docs/UI.md: DM Sans at a compact 14px base, blue #3C3489 as
// the primary accent, the pill colour system, thin scrollbars, and a fixed
// sidebar plus fluid canvas for the signed-in app. Light-only.
const GLOBAL_CSS = `
  :root {
    --font-sans: "DM Sans Variable", system-ui, -apple-system, sans-serif;
    --bg: #fafafa;
    --surface: #ffffff;
    --border: #e5e5e5;
    --text: #1a1a1a;
    --muted: #888888;
    --blue: #3C3489;
    --blue-light: #EEEDFE;
    --amber: #d97706;
    --amber-light: #fffbeb;
    --purple: #7c3aed;
    --purple-light: #f5f3ff;
    --green: #2d8c5a;
    --green-light: #edfaf3;
    --coral: #e05a44;
    --coral-light: #fff0f0;
    --teal: #0d9488;
    --teal-light: #f0fdfa;
    --rust: #c2410c;
    --measure: 42rem;
    color-scheme: light;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; height: 100%; }
  body {
    margin: 0; height: 100%;
    font-family: var(--font-sans);
    font-size: 14px; font-weight: 400; line-height: 1.5;
    color: var(--text); background: var(--bg);
    -webkit-font-smoothing: antialiased;
  }
  #root, #app { height: 100%; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 99px; }
  ::selection { background: var(--blue-light); }
  a { color: var(--blue); }
  :focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 4px; }

  /* Wordmark */
  .wordmark {
    display: inline-flex; align-items: baseline; gap: 0.45rem;
    font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--text); text-decoration: none; font-size: 0.9rem;
  }
  .wordmark .star { color: var(--muted); letter-spacing: 0; }

  /* App shell: fixed sidebar + fluid canvas */
  .app-shell { display: flex; height: 100vh; }
  .sidebar {
    width: 240px; flex-shrink: 0; display: flex; flex-direction: column;
    background: var(--surface); border-right: 1px solid var(--border);
    box-shadow: 1px 0 3px rgba(0,0,0,0.02);
  }
  .sidebar-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 0.9rem; border-bottom: 1px solid var(--border);
  }
  .sidebar-header .wordmark { font-size: 0.72rem; letter-spacing: 0.18em; }
  .sidebar-body { flex: 1; overflow-y: auto; padding: 0.75rem 0.6rem 1rem; }
  .sidebar-footer {
    border-top: 1px solid var(--border); padding: 0.7rem 0.9rem;
    display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  }
  .proj-row {
    display: flex; align-items: center; justify-content: space-between; gap: 0.4rem;
    width: 100%; padding: 0.45rem 0.6rem; border: 0; border-left: 3px solid transparent;
    border-radius: 6px; background: none; text-align: left; cursor: pointer;
    font: inherit; font-size: 13px; color: var(--text); text-decoration: none;
  }
  .proj-row:hover { background: var(--bg); }
  .proj-row.selected { background: var(--blue-light); border-left-color: var(--blue); }
  .proj-row .count { font-size: 11px; color: var(--muted); }
  .q-row {
    display: flex; align-items: flex-start; gap: 0.45rem;
    padding: 0.35rem 0.5rem 0.35rem 1.1rem; border-radius: 6px;
    font-size: 12px; color: var(--text); text-decoration: none; line-height: 1.35;
  }
  .q-row:hover { background: var(--bg); }
  .q-row .q-text {
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .q-row .q-meta { font-size: 11px; color: var(--muted); }

  .canvas { flex: 1; overflow-y: auto; }
  .canvas-inner { max-width: 48rem; margin: 0 auto; padding: 2rem 2rem 6rem; }

  /* Public pages (sign-in, shared report) */
  .public-header { padding: 1.5rem; text-align: center; }
  .container { max-width: 48rem; margin: 0 auto; padding: 0 1.5rem 5rem; }
  .prose { max-width: var(--measure); }

  h1 { font-size: 20px; font-weight: 600; line-height: 1.25; letter-spacing: -0.01em; text-wrap: balance; margin: 0 0 0.5rem; }
  h2, .label {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;
    color: var(--muted); margin: 2.2rem 0 0.7rem;
  }
  .label { display: block; margin: 0 0 0.4rem; }

  label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; color: var(--muted); margin-bottom: 0.35rem; }
  input[type="text"], input[type="email"], input[type="file"], textarea, select {
    width: 100%; font: inherit; padding: 0.5rem 0.65rem;
    border: 1px solid var(--border); border-radius: 8px;
    background: var(--surface); color: var(--text);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input[type="text"]:focus, input[type="email"]:focus, textarea:focus, select:focus {
    outline: none; border-color: var(--blue);
    box-shadow: 0 0 0 3px rgba(60,52,137,0.12);
  }
  textarea { min-height: 4.5rem; resize: vertical; }
  input[type="range"] { width: 100%; accent-color: var(--blue); }

  button {
    font: inherit; font-size: 13px; font-weight: 500; padding: 0.5rem 1rem;
    border: 1px solid var(--text); border-radius: 8px;
    background: var(--text); color: #fff; cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
  }
  button:hover:not(:disabled) { opacity: 0.85; }
  button.secondary { background: var(--surface); color: var(--text); border-color: var(--border); }
  button.secondary:hover:not(:disabled) { opacity: 1; border-color: var(--text); }
  button.btn-blue { background: var(--blue); border-color: var(--blue); border-radius: 99px; }
  button.btn-pill { border-radius: 99px; padding: 0.3rem 0.8rem; font-size: 12px; }
  button:disabled { opacity: 0.45; cursor: default; background: #d4d4d4; border-color: #d4d4d4; color: #fff; }
  button.secondary:disabled { background: var(--surface); color: var(--muted); }
  a.button-link {
    display: inline-block; text-decoration: none; font-size: 13px; font-weight: 500;
    padding: 0.5rem 1rem; border-radius: 8px;
    background: var(--surface); color: var(--text); border: 1px solid var(--border);
  }
  a.button-link:hover { border-color: var(--text); }

  ul.clean, ol.clean { list-style: none; padding: 0; margin: 0; }
  .card {
    border: 1px solid var(--border); border-radius: 12px; padding: 1.1rem 1.25rem;
    background: var(--surface); margin-bottom: 0.75rem;
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  }
  .muted { color: var(--muted); }

  /* Pill system per docs/UI.md */
  .pill {
    display: inline-block; font-size: 11px; font-weight: 500;
    padding: 3px 10px; border-radius: 99px; margin-left: 0.4rem;
    background: var(--bg); color: var(--muted); border: 1px solid var(--border);
  }
  .pill-audience { background: #EEEDFE; color: #3C3489; border-color: #e0defc; }
  .pill-topic { background: #FAEEDA; color: #633806; border-color: #f3e2c4; }
  .pill-positive { background: #E1F5EE; color: #085041; border-color: #cceee0; }
  .pill-negative { background: #FCEBEB; color: #791F1F; border-color: #f6d8d8; }
  .pill-tension { background: #FAECE7; color: #712B13; border-color: #f3dcd2; }
  .pill-blue { background: var(--blue-light); color: var(--blue); border-color: #e0defc; }
  .pill-green { background: var(--green-light); color: var(--green); border-color: #d3f0e1; }
  .pill-coral { background: var(--coral-light); color: #791F1F; border-color: #f6d8d8; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
  .tags .pill { margin-left: 0; }

  /* Status dots */
  .dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 99px;
    flex-shrink: 0; vertical-align: middle;
  }
  .dot-green { background: var(--green); }
  .dot-blue { background: var(--blue); }
  .dot-grey { background: #c4c4c4; }
  .dot-coral { background: var(--coral); }
  @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .pulse { animation: pulse-dot 1.5s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }

  /* Question input card */
  .qcard {
    border: 1px solid var(--border); border-radius: 12px; background: var(--surface);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04); padding: 0.9rem 1rem 0.7rem;
  }
  .qcard textarea {
    border: none; background: transparent; padding: 0.25rem 0.1rem;
    min-height: 3.2rem; box-shadow: none;
  }
  .qcard textarea:focus { border: none; box-shadow: none; }
  .qcard-toolbar {
    display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
    border-top: 1px solid #f0f0f0; padding-top: 0.7rem; margin-top: 0.5rem;
  }

  /* File dropzone + rows */
  .dropzone {
    display: block; border: 1.5px dashed var(--border); border-radius: 10px;
    padding: 0.9rem; text-align: center; font-size: 12px; color: var(--muted);
    cursor: pointer; transition: border-color 0.15s;
  }
  .dropzone:hover { border-color: var(--blue); color: var(--blue); }
  .file-row {
    display: flex; align-items: center; gap: 0.6rem; font-size: 13px;
    border: 1px solid var(--border); border-radius: 10px; background: var(--surface);
    padding: 0.55rem 0.8rem; margin-bottom: 0.5rem;
  }

  /* Report sections: 3px coloured left border + uppercase 11px title */
  .rsection { border-left: 3px solid var(--border); padding-left: 14px; margin: 1.6rem 0; }
  .rsection-title {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
    font-weight: 600; margin: 0 0 0.55rem;
  }
  blockquote {
    margin: 0.55rem 0; padding: 0.35rem 0 0.35rem 0.9rem;
    border-left: 3px solid var(--purple); background: var(--purple-light);
    border-radius: 0 6px 6px 0; color: #3f3f46; font-style: italic;
  }
  sup a { text-decoration: none; font-size: 0.72em; color: var(--blue); font-weight: 600; }
  .stack > * + * { margin-top: 0.7rem; }
`

function RootComponent() {
  const { user } = useRouteContext({ from: Route.id }) as {
    user: SessionUser | null
  }
  const pathname = useLocation({ select: (l) => l.pathname })
  const shell = user !== null && !isPublicPath(pathname)

  return (
    <RootDocument>
      {shell ? (
        <div className="app-shell">
          <Sidebar user={user} />
          <main className="canvas">
            <div className="canvas-inner">
              <Outlet />
            </div>
          </main>
        </div>
      ) : (
        <div>
          <header className="public-header">
            <Link to="/" className="wordmark">
              <span className="star">✦</span> Undercurrent
            </Link>
          </header>
          <div className="container">
            <Outlet />
          </div>
        </div>
      )}
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
