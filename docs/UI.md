# Undercurrent — UI Documentation

Complete UI reference for every page of the Cultural & Social Insight Engine ("Undercurrent"), as of commit `5ce7c54`.

The app has **two pages**:

| Route | Purpose | Access |
|-------|---------|--------|
| `/` | Public guest home — run limited research, capture leads | Public |
| `/admin` | Admin dashboard — projects, questions, tracking, files | Password-protected (session cookie) |

---

## Global foundations

### Root layout — [app/layout.tsx](../app/layout.tsx)

- Font: **DM Sans** (Google Fonts, weights 300–700) exposed as CSS variable `--font-dm-sans`.
- Page metadata: title *"Undercurrent — Cultural & Social Insight"*.
- Body: `min-h-full flex flex-col`.

### Design tokens — [app/globals.css](../app/globals.css)

CSS variables on `:root`:

| Token | Value | Used for |
|-------|-------|----------|
| `--bg` | `#fafafa` | Page background |
| `--surface` | `#ffffff` | Cards, sidebar |
| `--border` | `#e5e5e5` | All borders, dividers |
| `--text` | `#1a1a1a` | Primary text |
| `--text-muted` | `#888888` | Secondary text, labels |
| `--coral` / `--coral-light` | `#e05a44` / `#fff0f0` | Errors |
| `--green` / `--green-light` | `#2d8c5a` / `#edfaf3` | Tracked status, positive |
| `--amber` / `--amber-light` | `#d97706` / `#fffbeb` | Docs source, topics |
| `--purple` / `--purple-light` | `#7c3aed` / `#f5f3ff` | Reddit source, quotes |
| `--blue` / `--blue-light` | `#3C3489` / `#EEEDFE` | Primary accent, audiences, saved status |
| `--teal` / `--teal-light` | `#0d9488` / `#f0fdfa` | (reserved) |

Base typography: 14px body, line-height 1.5 (guest page uses 1.65). Thin 6px scrollbar. Global animations: `.pulse-dot` (opacity pulse, 1.5s), `.spin` (1s rotation), `.progress-indeterminate` (sliding bar, 1.4s).

### Pill colour system (used across both pages)

| Variant | Background | Text |
|---------|-----------|------|
| Audience / purple | `#EEEDFE` | `#3C3489` |
| Topic / amber | `#FAEEDA` | `#633806` |
| Positive signal | `#E1F5EE` | `#085041` |
| Negative signal | `#FCEBEB` | `#791F1F` |
| Tension | `#FAECE7` | `#712B13` |
| Neutral | `var(--bg)` | `var(--text-muted)` |

Pills: 11px font, `border-radius: 99px`, roughly `3px 10px` padding.

### Reasoning stream colour coding

| Source | Colour | Background |
|--------|--------|------------|
| Reddit | `#7c3aed` (purple) | `#f5f3ff` |
| Web | `#2563eb` (blue) | `#eff6ff` |
| Docs | `#d97706` (amber) | `#fffbeb` |
| Synthesis | `#2d8c5a` (green) | `#edfaf3` |
| Error | `#b91c1c` (red) | `#fef2f2` |

---

## Page 1: `/` — Guest home

Entry: [app/page.tsx](../app/page.tsx) → renders [GuestHome.tsx](../components/GuestHome.tsx), plus [AdminLoginModal.tsx](../components/AdminLoginModal.tsx) when triggered. Visiting `/?auth=required` (redirect target from `/admin` when unauthenticated) auto-opens the login modal.

Single centred column, max-width **640px**, on `#FAFAFA`. Inline styles (not Tailwind) throughout this component.

### Layout, top to bottom

1. **Admin login link** — absolute top-right (`top: 24px; right: 32px`), 13px muted grey, darkens on hover. Opens the admin login modal.

2. **Logo** — `✦ UNDERCURRENT`, 28px, weight 600, 5px letter-spacing, uppercase, centred. The `✦` glyph is grey (`#888`).

3. **Headline** — *"Real audience signals. Sharper creative briefs."* — 20px, weight 500, centred.

4. **Subheadline** — 13px muted, max-width 400px, centred: *"Ask any research question about audiences, trends, and culture — get insights backed by live Reddit data and the web."*

5. **Example chips** — label "Try:" plus 3 left-aligned outlined buttons (12px, 8px radius, `→` prefix). Clicking fills the question, audiences, and topics. The three examples: Spotify Wrapped competition, return-to-office mandates, Oatly vs own-brand oat milk.

6. **Form card** — white, 1px border, 12px radius, 20px padding, sections separated by 1px `#f0f0f0` dividers:
   - **Question textarea** — 3 rows, min-height 80px, `#FAFAFA` background, focus border darkens to `#1a1a1a`. When non-empty, an `×` clear button appears top-right (clears question + audiences + topics). Disabled and greyed when the limit is reached.
   - **Audiences** — uppercase 11px section label; purple pills (`#EEEDFE`/`#3C3489`) each with an `×` remover; "+ Add audience" dashed-border pill button that swaps to an inline pill-shaped input (Enter commits, Escape cancels, blur commits).
   - **Topics** — same pattern with amber pills (`#FAEEDA`/`#633806`).
   - **Sources** — toggle pills for **Reddit** and **Web** (both on by default). Active: `#FEF3C7` background, `#92400E` text, filled dot. Inactive: grey, faded.
   - **Connectors — coming soon** — non-interactive dashed pills for GWI, Brandwatch, Canvas8, Hootsuite, each with a tiny "SOON" tag.
   - **Run button** — full-width, 44px, black (`#1a1a1a`), white text, label "Run Research →" / "Researching…" while running. Disabled (grey) while running, at the limit, or with an empty question.

7. **Search counter** — 12px centred below the card: "N free searches remaining". Guests get **3 free searches** (tracked server-side via `/api/guest/status`; exempt users skip the limit). At zero it turns dark red and reads "0 free searches remaining".

8. **Limit card** (only when the limit is reached) — tension-coloured card (`#FAECE7`, dark rust text): "Demo limit reached", copy asking the visitor to leave an email, a white inner card with an email input and a full-width rust "Request access →" button (POSTs to `/api/guest/email` with `type: "access_request"`).

9. **Reasoning stream** — appears below the form while running (auto-scrolled into view). See the shared ReasoningStream component below.

10. **Result — email-gated** — when a run completes:
    - The **InsightCard** renders but is **blurred (5px)** with pointer events disabled if the visitor hasn't left an email yet (stored in `localStorage.guest_email`).
    - A centred **gate overlay card** (max 340px) floats over it: "✦ Your insight is ready", playful copy ("that's the price of a cup of coffee 🥹"), email input (Enter submits), black "Unlock insight →" button, and a "No spam" footnote. Unlocking POSTs the email (`type: "feedback"`), saves it in localStorage, and removes the blur. Returning visitors with a saved email skip the gate entirely.

11. **Footer** — 12px light grey, centred: "Built for marketing strategists · Built by [Andrew Kuan](LinkedIn) · Powered by live data".

### Admin login modal — [AdminLoginModal.tsx](../components/AdminLoginModal.tsx)

- Full-screen overlay (`rgba(0,0,0,0.4)`), click-outside or Escape closes.
- White card, 16px radius, 32px padding, max-width 360px: circular `✦` icon in a grey disc → title "Admin login" + subtitle "UNDERCURRENT · Restricted access" → uppercase "Password" label + password input (autofocused, Enter submits) → black "Sign in →" button + borderless "Cancel".
- Wrong password: red input border, "Incorrect password. Try again." message, a 0.4s **shake animation** on the card, and the field clears/refocuses. Success routes to `/admin`.

---

## Page 2: `/admin` — Admin dashboard

Entry: [app/admin/page.tsx](../app/admin/page.tsx), guarded by [app/admin/layout.tsx](../app/admin/layout.tsx) — a server component that checks the `admin_session` cookie against the `admin_sessions` collection and redirects to `/?auth=required` if missing/expired.

Layout: full-height flex row — fixed sidebar + fluid main canvas.

### Empty state (no project selected)

Centred in the main canvas: 🔍 emoji (40px), "Select a project to start" heading, hint to use **+ New**, and a "Demo questions to try" list of 3 outlined suggestion rows (German Gen Z vegan meals, UK fashion dupes, US WFH mental health). These rows are display-only.

### Sidebar — [ProjectSidebar.tsx](../components/ProjectSidebar.tsx)

Fixed **240px**, white surface, full height, 1px right edge shadow.

- **Header** — `✦ UNDERCURRENT` wordmark (links back to `/`) + a "+ New" pill button that toggles to "Cancel".
- **New project form** (when open) — "Project name" input (autofocus), optional "Client / brief" input, full-width blue "Create project" pill. On success the project is selected immediately.
- **"PROJECTS" section label** — 10px uppercase.
- **Project list** — each row: project name (13px, truncated) + question count subtitle, and a `+`/`−` expand indicator. Selected row: light-blue background plus a **3px blue left border bar**. Clicking selects *and* toggles expansion.
  - **Expanded questions** (lazy-loaded per project): indented rows with a status dot (**green** = tracked, **blue** = saved, **grey** = run_once), 2-line-clamped question text, and "status · time-ago" metadata.
- **Bottom bar** — a gear-icon "Settings" button (top border above) which opens the **Guest Leads modal**.

#### Guest Leads modal (inside ProjectSidebar)

Overlay + white card (max-width `xl`, max-height 80vh):
- Header: "Guest Leads" title with stats line — "N visitors · N searches · N emails" — and an `×` close button.
- Body: table with **Email / Type / Date / (delete)** columns. Type renders as a pill — blue "Access request" or outlined grey "Notify me". Each row has an `✕` delete button (shows `…` while deleting). Empty state: "No emails collected yet."

### Project workspace — [ProjectWorkspace.tsx](../components/ProjectWorkspace.tsx)

Scrollable canvas, content max-width `3xl`, 32px horizontal padding. Sections top to bottom:

1. **Project title row** — optional emoji (28px), project name (20px semibold), description (13px muted), and a "Configure"/"Done" pill toggle on the right.

2. **Config panel** (when Configure is open) — bordered card containing:
   - "Project name" text input.
   - **TagInput** for Audiences (purple pills) and Topics (amber pills) — Enter or comma commits, blur commits, `×` removes; pills sit inside a rounded input container that gains a blue border on focus.
   - **Sources** toggle pills: Reddit / Web / Docs. Active = solid blue with white text; inactive = outlined grey.
   - **File section** — rendered only when the "docs" source is enabled (see below).
   - Blue "Save config" pill (PATCHes the project).

3. **Context pills** (when config is closed) — read-only row of audience (purple) and topic (amber) pills.

4. **Question input card** — white card with subtle shadow:
   - Borderless 2-row textarea, placeholder *"Ask a cultural question about your audience…"*. **Enter runs** (Shift+Enter for newline).
   - Bottom toolbar (above a divider): source toggle pills (Reddit/Web/Docs, same styling as config), a thin vertical divider, then disabled dashed "coming soon" pills (GWI, Brandwatch, Canvas8, Hootsuite) each with a tiny amber "soon" badge — followed by the **"Run now"** black pill button on the right ("Running…" while active, disabled when empty).

5. **Live reasoning stream** — appears during/after a run (shared component, below).

6. **Error banner** — coral card with the error message, if the run fails.

7. **Fresh result** — an **InsightCard** for the just-completed run, followed by a full-width green **"Track question"** button. After tracking it becomes a green confirmation line: "✓ Tracking — auto-refreshes on schedule". Clicking a follow-up question inside the card loads it into the textarea and clears the result.

8. **Question list** — header "Questions" + note "Auto-checks every 30s" (the workspace polls questions and fires due auto-refreshes on a 30-second timer). Each **QuestionListItem** is a bordered card row:
   - **Collapsed row:** status dot (green/blue/grey; pulses while refreshing or generating) → truncated question + a status pill (`tracked` green / `saved` blue / `run_once` grey), time-ago, and for tracked questions a "next Xm" countdown → right side shows either a pulsing "Generating…" indicator or the overall sentiment label → action buttons:
     - **⏱ interval pill** (tracked only) — opens a dropdown popover to pick the refresh interval: 5 min / 30 min / 2 hours / 12 hours / 1 day / 3 days / 1 week (current option highlighted blue).
     - **↻ refresh** (tracked only) — manual re-run; shows a spinner while running.
     - **× delete** — turns red on hover; deletes the question.
   - **Expanded row** (click anywhere on the row): a "Live research" **toggle switch** (black when on) to flip tracked ↔ saved, then the full **InsightCard** for the latest result.

#### File section (inside config panel)

- **Dropzone** — dashed border box, "+ Add files · PDF, TXT, CSV", opens a file picker (multiple). Border turns blue on hover; shows "Uploading…" during upload.
- **File rows** — type icon (📄 pdf / 📊 csv / 📝 txt), truncated filename, size, and status: green "✓ N chunks" when indexed or red "✕ Error". Below each: a thin progress bar — **indeterminate sliding blue** while processing (polled every 3s), solid green when indexed, solid red on error. Each row has an `×` remove button.

---

## Shared components

### ReasoningStream — [ReasoningStream.tsx](../components/ReasoningStream.tsx)

Used on both pages during agent runs.

- Bordered card. Header strip: pulsing green dot + "AGENT REASONING…" while running (becomes "REASONING TRACE" after).
- Body: max-height 256px, auto-scrolls to the newest event. Each row: timestamp (11px, tabular) → colour-coded source badge (Reddit/Web/Docs/Synthesis/Error, colours per the table above) → humanised message. Raw tool calls are rewritten into readable text, e.g. `search_reddit({...})` → *Searching "vegan" in r/de*, iteration markers → *Thinking (step 2 of 10)…*.
- While running, a footer line shows three staggered pulsing dots plus a **rotating joke waiting message** (cycles every 2s from a pool of 24, e.g. *"Asking Reddit very nicely…"*, *"Stalking Reddit so you don't have to…"*) — ensures no dead air during the ~20s run.

### InsightCard — [InsightCard.tsx](../components/InsightCard.tsx)

The structured result card, used on both pages. White bordered card, 24px padding, sections top to bottom (each `Section` has a 3px coloured left border + matching uppercase 11px title):

1. **Sentiment stat row** — responsive grid (2 cols mobile / 4 desktop). First card = overall, then one per audience segment. Each stat card: score as a percentage (score −1..+1 mapped to 0–100%), 22px semibold, coloured green (> 0.1) / red (< −0.1) / amber (neutral); one-word label below; a **2px coloured top border** matching sentiment polarity.
2. **Topic breakdown** (if present) — horizontal bar chart: topic name, 160px track with a blue (`#3C3489`) fill animated on width, right-aligned percentage. Sorted descending.
3. **Header row** — "TOP PLATFORM" label + neutral pill, and an **"Export PDF"** button on the right.
4. **Insight** (blue accent) — the core strategic paragraph, 14px.
5. **Tensions** (rust accent `#c2410c`) — bullet rows: rust dot, tension text with superscript reference numbers, audience pill on the right.
6. **Language signals** (grey accent) — two wrap rows of pills: positive (teal-green) then negative (red), each with an optional tiny audience label.
7. **Verbatim quotes** (purple accent) — blockquotes with a 3px purple left border: italic quote (original language) with superscript ref, then "source · context" attribution.
8. **Creator angles** (amber accent) — 2-column grid of cards with an amber top border: bold title + refs, format pill (amber), audience pill (purple), 12px description.
9. **Follow-up questions** (blue accent; only when a handler is provided — i.e. admin workspace) — full-width `→`-prefixed outlined buttons that turn blue on hover; clicking loads the question for a new run.
10. **References** (grey accent) — numbered list. Type markers: purple `r/` for Reddit, blue `↗` for web, amber `doc` for uploaded docs. Titles link out when a URL exists; detail text (e.g. subreddit + upvotes) follows.

Includes **normalizers** that tolerate the older DB format (plain string arrays) for tensions, signals, quotes, angles, and references.

**Export PDF** — client-side jsPDF A4 brief: black header band ("Cultural Insight Brief" + date), grey platform bar, then sections (Core Insight, Sentiment, Tensions with rust bullets, Language Signals as tinted rounded blocks, Quotes as purple-edged blocks, numbered Creator Angles with blue number discs, References) and a grey footer on every page with "Influencer Global Group | Cultural & Social Insight Engine" + page numbers. Non-Latin-1 characters are transliterated to keep Helvetica line-measurement correct. Saves as `insight-brief.pdf`.

---

## Legacy (unused) components

- [Builder.tsx](../components/Builder.tsx) and [TrackedList.tsx](../components/TrackedList.tsx) are **not imported anywhere** — remnants of the pre-project-workspace layout (a standalone question builder and a tracked-question list). Safe to delete.
