# handoff — fairtrade design system

> Single entry point for anyone (human or agent) picking this up. State, what's next, how it's built,
> how to verify, and the locked rules. Specs live alongside: [`DESIGN.md`](./DESIGN.md) (the system),
> [`PRESENTATION.md`](./PRESENTATION.md) (the page), [`NEUROINCLUSIVE.md`](./NEUROINCLUSIVE.md) (a11y
> defaults), [`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md) (the deferred multi-app rollout).

## ▶ current state (2026-06-17, branch `tier-2.5-port`)

Everything below is DONE and gated green (`pnpm build`, `validate.mjs` 19/19, 0 overflow, `build-storybook`,
`sbsmoke.mjs`):

- **The presentation page** — a single-page design-system site (hero, value-prop, and ~25 documented
  sections in foundations / components / using-the-system groups) with a sticky on-this-page rail +
  scroll-spy, end-to-end interactive (⌘k command palette, modal dialog, keyboard tablists, dropdown menus).
- **`src/ui/*` component library** — ~20 JSDoc-typed React components (`Button`/`ButtonGroup`/`Segmented`,
  `Input`/`Textarea`/`Select`/`Field`, `Checkbox`/`Radio`/`RadioGroup`, `Switch`, `Chip`/`FilterChip`/
  `StatusDot`/`CountBadge`, `Card`/`CardImg`/`Row`/`MetaItem`, `Tabs`, `Breadcrumb`/`Steps`, `Pager`,
  `Pagination`, `Menu`, `Tooltip`/`Popover`, `Avatar`/`AvatarGroup`/`Kbd`/`Tag`, `EmptyState`,
  `Feedback{Skeleton,Progress,Spinner,Toast,Panel}`, `DataTable`, `Accordion`, + `Dialog`/`CommandPalette`
  re-exports) — each REUSES the existing `index.css` class names (zero new CSS, zero visual change for the
  ports). Barrel: `src/ui/index.js`.
- **Storybook** (SB10 + Vite8, `.storybook/`) — one `*.stories.jsx` per component (146 stories), `addon-a11y`
  (axe) + `addon-themes` (data-theme toggle) + project viewports/backgrounds, `play()` interaction tests on
  the interactive components. `pnpm storybook` to view, `pnpm build-storybook` to compile.
- **New tier-2 components on the page** — `DataTable` (sortable/selectable, `.tbl-*`), `Pagination`
  (numbered + ellipsis, `.pgn-*`), `Accordion` (`.acc-*`), with live showcase sections
  (`src/ComponentSections.jsx`) in the components group.
- **The "in use" showcase, full-screen** — a full-bleed workspace shell (`src/mockups/inuse/`, ns `.iu-*`)
  whose left app-rail switches between the three apps (click / keys 1·2·3 / a real Fullscreen-API expand),
  each rendering inside with its own internal nav and reflecting the real functionality of the actual apps
  in the parent folder: `TranscriptApp` (the transcript-browser viewer — 5 tabs, per-tool renderers,
  thinking, phases, checkpoints, outline/filters rail, list↔graph, search, annotations, scorecard);
  commons `CommonsExplore`+`CommonsManage` (village — explore + filters, transcript detail w/ label popover
  + approval bar, profiles, CLI-first publish, collectives + governance + review queue + redaction diff,
  contribute); peasant `GraphMap`+`GraphAnalytics` (hand-rolled SVG code-map + node-selection rail + legend
  + time-strip, lane git-graph, change detail, and the analytics dashboard). All charts/graphs hand-rolled
  in SVG — no chart libraries.
- **Deferred QA nits addressed** — filter-rail text-edge alignment, empty-state inset, start-subhead orphan,
  theme-aware color/token tables (added a `light` column), shorter commons summaries. (Badge-state-chip
  text already clears AA per the contrast gate; tokens are locked.)

## ▶ what's next (roadmap)

1. **Render the page FROM the `src/ui/*` components** ("one source of truth"): the components exist and keep
   the class names, so the static `src/sections/*.html` partials can be swapped for `<Button/>` etc.
   incrementally. Intentionally deferred (highest risk to the verified layout); do it screen by screen with
   the gates green each step.
2. **Optional further tier-2**: steps/timeline per-turn renderers, a date/range control, a toast host.
   Optionally make the color swatches/`.dt-sw` theme-aware (today they paint literal DARK hex by the locked
   rule even in light theme; the value columns already document both themes).
3. **Visual-regression in CI** for Storybook (Chromatic or the test-runner) — the `play()` tests + a11y
   addon are authored; only headless CI execution is missing.
4. **The multi-app rollout** ([`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md)) — still **deferred** until
   approved. Stay inside `unified-identity` until then.
5. Cosmetic: the in-use code-map view top-aligns its content, leaving whitespace at the bottom of a tall
   window — fine for a dashboard, easy to stretch edge-to-edge if wanted.

**How to work here (proven loop):** big agent teams + workflows — design/build fan-out (one agent per
component/view) → you integrate the shared files (`index.css`, `App.jsx`) → `pnpm build` → parallel
screenshot QA → fix → `validate.mjs`. Keep all gates green every pass.

## what this is

A **single-page design-system presentation** (modeled on wise.design, bound to the locked Caves-of-Qud
identity), not a flat component gallery. Built with **Vite 8 + React 19 + Tailwind v4**, run with **pnpm**.
One visual identity across **peasant** (local analytics), **village** (the commons), and
**transcript-browser** (the shared viewer).

## stack / run

```bash
pnpm install
pnpm dev --port 5180   # the page (or next free port)
pnpm build             # contrast gate + static dist/
pnpm preview           # serve dist/
pnpm storybook         # the component library (port 6006)
pnpm build-storybook   # compile every component + story
```

- `?theme=light` deep-links the paper theme. `?fb=off` hides the feedback tool. `?cap` is a review-only
  capture mode that shrinks the full-screen hero/intro so the whole page fits one screenshot.
- Fonts: **Atkinson Hyperlegible Mono** (chrome/display/code) + **Atkinson Hyperlegible** (reading prose),
  via Google Fonts in `index.html`.
- Icons: **bundled Lucide** (no CDN) — `src/icons.js` `paintIcons()` converts the partials' `<i data-lucide>`
  to `<svg>` (re-run by a MutationObserver); **lucide-react** for React pieces. Brand marks are inline
  `<svg><use href="#b-*">` symbols in `00-defs.html`.

## architecture

- **`src/sections/*.html`** — one HTML partial per documented section (numbered for order), injected as raw
  markup via a **memoized** `<Raw>` (renders once — do NOT un-memoize; React resetting innerHTML clobbers the
  painted lucide svgs + detaches captured refs). Order: `00-defs` · `01-nav` · `10-start` ·
  `15-group-foundations` · `20-principles` · `22-voice` · `24-color` · `26-type` · `28-spacing` · `30-icons` ·
  `32-motion` · `34-controls` · `36-states` · `40-group-components` · `42-badges` · `44-trails` ·
  `48-conversation` · `50-canvas` · `52-forms` · `54-overlays` · `60-group-using` · `62-a11y` · `64-tokens` ·
  `66-resources`.
- **`src/App.jsx`** — composition root. Injects the partials in order, interleaving the React sections
  (`Hero`, `Intro`, `Cards`; `DataTableSection`/`PaginationSection`/`AccordionSection` from
  `src/ComponentSections.jsx`), then renders `<InUseShell>` **full-bleed, outside the `.docs` grid**. Also:
  the `Rail` (sticky on-this-page index from the `RAIL` array), the scroll-spy, nav-reveal, the delegated
  handlers (theme toggle, `[data-copy]` copy-token, ⌘k palette, dialog trigger, tablists, dropdown menus),
  scroll-reveal, and the dev feedback tool.
- **`src/index.css`** — the single styling source of truth: tokens in `:root` / `[data-theme="light"]` (do
  NOT rename; values re-theme), the base layer, the component classes, the doc-primitives, the tier-2
  families (`bs-`/`is-`/`sw-`/`fb-`/`chipx-`/`tbl-`/`pgn-`/`acc-`), and the in-use namespaces
  (`iu-`/`txn-`/`cex-`/`cmg-`/`gmp-`/`gan-`). Tailwind v4 `@source "./sections"` + `@source "./App.jsx"`.
- **`src/ui/*`** — the typed component library (above). **`src/mockups/inuse/*`** — the full-screen showcase
  (`InUseShell` + `TranscriptApp` + `CommonsApp`/`CommonsExplore`/`CommonsManage` + `GraphApp`/`GraphMap`/
  `GraphAnalytics`). **`.storybook/`** — `main.js` + `preview.jsx`.
- **`src/effects.jsx`** — image→ascii / halftone / duotone filters (wheat hero, peasant portraits).
  **`vite.config.js`** — react + tailwind plugins + the `/feedback` dev middleware.

## doc-primitives (in `index.css`, reuse them; do not reinvent)

`.docs` (rail + content grid) · `.page-rail`/`.rail-link`/`.rail-group` (sticky index, active = amber + `>`) ·
`.specimen` (+`.specimen-bar`/`.specimen-cap`/`.specimen-body`) · `.cmp`/`.cmp-card.cmp-do|.cmp-dont` do/don't
· `.dtable` (+`.dt-name`/`.dt-val`/`.dt-role`/`.dt-sw`) token/spec/props tables · `.copy-token` (`data-copy`
handled in `App.jsx`) · `.anatomy`/`.anatomy-legend`/`.anatomy-num` · `.ruler` · `.icongrid`/`.icontile` ·
`.start-card` · `.reslist`/`.res`. The **first** `.band > .label` is the section title; subsequent
direct-child `.label`s are sub-headings. Section a11y notes use a quieted `.band > .callout`; the amber
`.callout` is reserved for in-component emphasis.

## gates / how to verify (keep all green)

- `pnpm build` — runs `scripts/contrast.mjs` (WCAG contrast, both themes) then compiles. `--rule-strong`
  functional borders must clear 3:1; `--rule` dividers are intentionally sub-3:1 (report-only) — do not "fix".
- `node scripts/validate.mjs "http://localhost:5180/?fb=off"` — 19-check puppeteer-core interactive gate
  (icons painted, exactly one h1, heading outline, scroll-spy, nav-reveal, palette, dialog focus-trap, theme
  toggle, **0 overflow at 360/390/768/1024/1440**, reduced-motion, no console errors).
- `node scripts/findover.mjs <w>` — lists horizontal-overflow offenders at width w.
- `pnpm build-storybook` — compiles every component + story (the type/parse gate for `src/ui/*`).
- `node scripts/sbsmoke.mjs` — serves the built storybook, loads all 146 stories headless, runs their
  `play()` tests, and separates REAL assertion errors from benign resource 404s.
- `node scripts/shoot.mjs <theme> <dir> [ids…]` — per-section crops for QA. `node scripts/shootdemo.mjs
  <theme> <dir>` — drives the in-use app-switcher + sub-nav and crops each demo. `node scripts/diag.mjs` —
  interactive diagnostics.

Gotchas: headless `--screenshot` clips to the window height (window must exceed the page); anchor-scroll
(`#section`) does not settle in headless — capture the real hero at `#top` (no `?cap`) and judge other
sections from `?cap` slices. The shell is **zsh** (no word-splitting of unquoted `$VAR`; quote `--include`
globs for grep). Storybook play tests: components with a `tabIn`/`menuIn` entrance animation fail an instant
`toBeVisible()` (opacity 0 mid-animation) — assert the `[hidden]` attribute / content existence instead; and
`userEvent.keyboard('{Escape}')` only reaches a handler after you `waitFor` the component's auto-focus.

## LOCKED decisions (do not relitigate)

- two themes only: dark default (`--canvas #070706`) + a genuinely-white warm-paper light; palette
  desaturated/earthy (amber `#cba35c` primary; teal/olive/clay/mauve). amber is a **scarce** accent.
- all-lowercase ui chrome; never lowercase user content / code / data values.
- vector icons only (Lucide + Simple Icons brand marks + the wheat logo); every inline `<svg>` carries a
  `viewBox` + `width`/`height`. swatches paint their **literal hex**, never a themed var.
- standardized tokens: 4/8 spacing, one type scale, one control height (36/28), radius 0.
- single elevated page (the owner chose this over multi-page). keep the fairtrade narrative.
- neuroinclusive defaults ship in the tokens (16px floor, 1.5 line-height, 66ch measure, ≥3:1 borders,
  global focus ring, ≥24/44px targets, tabular numbers, static-first motion). See `NEUROINCLUSIVE.md`.

## the user's rules (enforced hard)

1. no decorative cruft, no AI-slop. no em dashes, no `·` middots, no buzzwords, no "not X but Y", no `//`,
   no `>` prefix except the active rail/nav marker, no eyebrow labels, no accent bars on titles.
2. real icons only, consistent sizes.
3. everything aligned, left-aligned, on the grid.
4. equal heights for controls sitting together.
5. sharp tones / contrast; dark deep, light truly white, titles crisp.
6. caves-of-qud flavor, never at the cost of readability.
7. review everything yourself via screenshots before declaring done; spawn parallel QA-reviewers on the crops.
8. namespace classes; avoid generic collisions.

## phase 2 — the rollout (deferred until approved)

Build the shared `@peasant-labs/theme` token package (`transcript-browser/packages/theme/src/tokens.css`
mirrors the names via `--tb-*`). Swap values + fonts, retarget the three apps' globals
(`peasant/web/src/app/globals.css`, `village/frontend/src/app/globals.css`, the viewer's `styles.css`). Token
NAMES are preserved, so components reflavor in place; then fan out screen by screen. Full plan:
[`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md).
