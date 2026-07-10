# UI brand pass: restyle to match undercurrent-nu.vercel.app

> **Status: deferred brief. Apply AFTER milestone 7.** Not to be executed now.
> This is a saved reference for the redesign pass, capturing the target design
> tokens (extracted from the reference site's shipped CSS) and the confirmed
> decisions, so the work can start cleanly later without re-deriving them.

## Context

Milestone 6 shipped the internal UI deliberately "plain and unbranded, no colour
system yet, brand styling in a later pass." This brief is that pass, to run after
milestone 7. The user pointed at a reference deployment
(https://undercurrent-nu.vercel.app/) as the design to match. It applies that
reference's visual language to our existing pages without changing any behaviour,
data flow, or backend.

The reference is a Next.js + Tailwind app; its design tokens were extracted from
its shipped CSS (not guessed):

- Typeface: **DM Sans** (variable, 300-700), self-hosted.
- Ground: `--bg #fafafa`, surfaces `#fff`, ink `#1a1a1a`, muted `#888`, border `#e5e5e5`.
- Brand accent: **teal `#0d9488`**, tint `#f0fdfa`.
- Semantic label pairs (dark text / light bg): teal `#085041`/`#e1f5ee`,
  indigo `#3c3489`/`#eeedfe`, clay `#c2410c`/`#faece7`, red `#791f1f`/`#fcebeb`,
  amber `#633806`/`#fffbeb`.
- Rounded cards (radius .5-1rem), subtle shadows, ~40rem prose column, uppercase
  tracked eyebrow labels.

## Decisions (confirmed with user)

- **Typeface**: self-host DM Sans via `@fontsource-variable/dm-sans`.
- **Themes**: light-only, matching the reference. Remove the existing dark-mode
  media query from `__root.tsx`.
- **Scope**: full restyle in one pass (tokens + font + all three pages + the
  six-component report colour-coding).

## Approach (restyle only, no behaviour change)

All current UI lives in five files; styling is centralised in one global CSS
string in [src/routes/__root.tsx](../src/routes/__root.tsx). The change is mostly
tokens + class polish there, plus small markup/className tweaks in the pages.

### 1. Typeface: self-host DM Sans

- Add `@fontsource-variable/dm-sans` (self-hosted, no external CDN, mirrors how the
  reference ships its font). Import once in `__root.tsx`.
- Set `--font-sans` to `"DM Sans Variable", system-ui, sans-serif` and apply on body.
- Keep a mono stack for ids/source keys only.

### 2. Design tokens in `__root.tsx` GLOBAL_CSS

Replace the current neutral scheme with `:root` custom properties matching the
reference: `--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--teal`,
`--teal-light`, the five semantic label pairs, `--radius` (.75rem), and a soft
shadow token. Style all components through the tokens. **Remove the
`@media (prefers-color-scheme: dark)` block** (light-only, per the reference);
drop `color-scheme: light dark`.

### 3. Component polish (same markup, better styling)

- **Site header**: teal wordmark "Undercurrent" + small tagline "Cultural &
  Social Insight"; hairline border; light ground.
- **Buttons**: primary = teal fill white text; secondary = white with teal border.
- **Inputs / textarea / select / range**: rounded, `--border`, teal focus ring.
- **Cards / pills / tags**: rounded, hairline border, subtle shadow; tags use the
  semantic pairs.
- **Recency slider**: teal track/thumb accent (`accent-color: var(--teal)`).

### 4. Report view — colour-code the six components (highest-impact)

In [src/routes/questions.$questionId.tsx](../src/routes/questions.$questionId.tsx)
`Report`, give each of the six components a coloured eyebrow label using the
reference's semantic pairs, so the report reads as a designed document:

- Headline reframe -> teal; Topic breakdown -> indigo; Tensions -> clay;
  Consumer voice -> teal-dark/emerald; Creator angles -> amber; Sources -> neutral ink.
- Keep the obvious/unexpected/interesting sub-structure, verbatim blockquotes, the
  inline citation superscripts, and the verified-sources list (frozen snapshot
  links) exactly as they work now; only their styling changes.
- Run-status view (`RunStatus`) gets a teal accent and a subtle pulsing dot
  (respecting `prefers-reduced-motion`).

### 5. Pages

Apply the tokens/classes to the projects list ([index.tsx](../src/routes/index.tsx)),
project page ([projects.$projectId.tsx](../src/routes/projects.$projectId.tsx)), and
question page. No structural/routing changes; class and small wrapper tweaks only.

## Files touched

- `src/routes/__root.tsx` (tokens, font import, global component styles) — the bulk.
- `src/routes/index.tsx`, `src/routes/projects.$projectId.tsx`,
  `src/routes/questions.$questionId.tsx` (className/markup polish).
- `package.json` (add `@fontsource-variable/dm-sans`).
- Possibly a small `src/ui/reportTheme.ts` mapping the six components to their
  semantic colour tokens (client-safe constant), imported by the report view.

## Out of scope

No backend, schema, retrieval, synthesis, routing, or data-flow changes. No new
pages. Exports/sharing and auth remain untouched.

## Verification

1. `npm run typecheck` clean.
2. `npm run dev`, load `http://localhost:3000`: confirm DM Sans renders, teal
   accent, rounded cards, styled forms.
3. Open the existing completed "Secondhand fashion" report: confirm the six
   components render with colour-coded labels, verbatims, citation superscripts,
   and clickable verified sources, with no content/behaviour change.
4. Screenshot key pages to compare against the reference's visual language.
