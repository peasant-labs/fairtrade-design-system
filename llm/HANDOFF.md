# handoff — fairtrade design system

> **▶ START HERE (updated 2026-06-17, overnight pass): P1–P6 + the 147-finding LAYOUT_AUDIT are DONE,
> verified, and gated green.** What is left is the carried-over backlog at the bottom of
> [`NEXT_PHASE.md`](./NEXT_PHASE.md) (the `src/ui/*` JSX component port → Storybook, more tier-2 coverage)
> plus a short list of intentionally-deferred minor QA nits (also in NEXT_PHASE). Stay inside
> `unified-identity`; the unification/app rollout ([`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md)) stays
> **deferred**. Older quality backlog: [`IMPROVE.md`](./IMPROVE.md) (tiers 1 + 2 largely DONE).
>
> **Progress (2026-06-16/17, five passes — all build-green + 19/19 validated):**
> - **Tier-1 quality pass DONE** (items 1-13; lucide CDN dropped, github icon fixed).
> - **Tier-2 batch 1 DONE** (states + overlays + chip depth) + a deep interactive bug-fix pass: bundled
>   icons (no CDN), scroll-spy, nav-reveal, command palette (`CommandPalette.jsx`), responsive overflow,
>   ascii hero v1, animation, dark `--ink-3` raised to `#9a9488`, canvas edge fixed.
> - **Interactive components DONE:** modal **dialog** (`Dialog.jsx`, focus-trap/Esc/scrim/return-focus),
>   **tabs** (role=tablist + panels, keyboard), **dropdown menu** (role=menu, keyboard, skips disabled).
>   `<Raw>` is now `memo`-ized (renders once; do not change — it keeps painted icons + refs stable).
> - **NEXT_PHASE P1–P6 DONE (overnight, big-agent-team + workflows):** P1 hero wordmark drawn in
>   wheat-ramp glyphs bottom-right, no container/no alpha (`AsciiWordmark` in `effects.jsx`); P2 proximity
>   snap on the splash sections + a descending-grain scroll cue (reduced-motion static fallback); P3
>   value-prop composed with a framed ascii portrait on a dark media-well (reads in both themes); P4 every
>   multi-column specimen collapsed to ≤2 (most to 1) via shared grid classes; P5 locked 3-tier heading
>   ladder (`--fs-group`/`--fs-section`/`--fs-sub`) + standardized vertical rhythm + one `--band-y` section
>   pad (centered dividers) + rebuilt type-scale; P6 three fully-interactive mockups in a new **"in use"**
>   group at the end — `src/mockups/TranscriptViewer.jsx` (two-pane, expandable tool calls, tab-switching
>   rail), `Commons.jsx` (live filter/sort/search + empty state + ascii cards), `Chart.jsx` (hand-rolled
>   SVG tokens-per-turn / tool-calls toggle, hover+keyboard tooltips). Wired in `App.jsx`; CSS appended to
>   `index.css` under a `mock-` namespace.
> - **LAYOUT_AUDIT + a 25-section dual-theme screenshot QA sweep applied.** Notable real fixes: a
>   **namespace collision** (`.sw` was both the switch control and the color swatch band → swatch renamed
>   `.swc`); light-theme legibility (hero wordmark white-knockout outline, intro portrait dark well,
>   `.card` border raised to the functional `--bd-strong` tier); switch status markers aligned to one
>   column; tooltip no longer overflows its panel; type-scale + spacing-ruler + resources realigned;
>   banned "not X but Y" copy rephrased; `.tc-head .path` truncates so the conversation window never
>   forces page overflow.
> - **Gates:** `pnpm build` runs the contrast gate (green, both themes); `node scripts/validate.mjs` is a
>   **19/19** puppeteer-core interactive gate (now passes with 0 overflow at 360/390/768/1024/1440);
>   `node scripts/shoot.mjs <theme> <outdir> [ids…]` captures per-section crops for QA (emulates
>   reduced-motion so reveal-hidden sections render); `node scripts/findover.mjs <w>` finds overflow
>   offenders; `node scripts/diag.mjs` diagnoses. Storybook deferred ([`STORYBOOK_PLAN.md`](./STORYBOOK_PLAN.md)).
> Run: `pnpm dev` (or `pnpm preview` after build); QA with `node scripts/validate.mjs`.

## what this is (updated 2026-06-16)

The repo is no longer a flat component gallery. It is a **single-page design-system
presentation** (modeled on wise.design, bound to the locked Caves-of-Qud identity): a hero,
a value-prop, and 22 documented sections in three groups (foundations now includes **states**;
components now includes **overlays**), with a sticky on-this-page rail and scroll-spy. Build spec:
[`PRESENTATION.md`](./PRESENTATION.md). System spec: [`DESIGN.md`](./DESIGN.md).
Accessibility defaults: [`NEUROINCLUSIVE.md`](./NEUROINCLUSIVE.md).

## stack

**Vite + React + Tailwind v4**, run with **pnpm**.
- `pnpm install && pnpm dev` → http://localhost:5173 (or next free port, e.g. 5174).
- `pnpm build` → static `dist/`. `pnpm preview` serves it.
- `?theme=light` deep-links the paper theme. `?fb=off` hides the feedback tool. `?cap` is a
  review-only capture mode (see "rendering" below).
- Fonts: **Atkinson Hyperlegible Mono** (chrome/display/code) + **Atkinson Hyperlegible**
  (reading prose), via Google Fonts in `index.html`.
- Icons: **bundled Lucide** (no CDN) — `src/icons.js` `paintIcons()` converts the partials'
  `<i data-lucide>` to `<svg>` (re-run by a MutationObserver); **lucide-react** for the React pieces
  (hero/cards/palette/dialog). Brand marks are inline `<svg><use href="#b-*">` symbols in `00-defs.html`.
- Interactive: a 19-check gate `node scripts/validate.mjs "<url>"`; the page has a ⌘k command palette,
  a modal dialog (focus-trap), keyboard tablists, and dropdown menus (all via delegated handlers in App.jsx).

## architecture (how the page is composed)

- **`src/sections/*.html`** — one HTML partial per section (numbered for order), injected as raw
  markup. This componentizes what used to be one `gallery.html` blob (now unused). Each partial
  owns one `<section class="band" id="...">` (or a `.group` opener) so it can be edited in isolation.
  Order: `00-defs` (svg symbols) · `01-nav` · `10-start` · `15-group-foundations` · `20-principles`
  · `22-voice` · `24-color` · `26-type` · `28-spacing` · `30-icons` · `32-motion` · `34-controls`
  · `40-group-components` · `42-badges` · `44-trails` · `48-conversation` · `50-canvas` · `52-forms`
  · `60-group-using` · `62-a11y` · `64-tokens` · `66-resources`.
- **`src/App.jsx`** — composition root. Imports each partial `?raw` and renders them in order via a
  `<Raw>` injector, interleaving the React sections that need the imagery effects: `Hero` (wheat
  ascii video), `Intro` (value-prop), `Cards` (ascii portraits). Also: the `Rail` (sticky
  on-this-page index, data-driven from the `RAIL` array), the **scroll-spy** (one
  `IntersectionObserver` over the section ids → active rail item + active nav group), delegated
  clicks (theme toggle + `[data-copy]` copy-token), the scroll-reveal, and the feedback tool.
- **`src/index.css`** — the single styling source of truth: design tokens in `:root` /
  `[data-theme="light"]` (do not change names; values re-theme), the base layer, the ported
  component classes, and the **doc-primitives** added for the presentation (see below). Tailwind v4
  `@source "./sections"` scans the partials.
- **`src/effects.jsx`** — image→ascii / halftone / duotone filters (the wheat hero, the peasant
  portraits). `AsciiImage` takes an optional `ink` prop to force a glyph color (the cards use it so
  portraits stay crisp off-white on a dark media-well in both themes).
- **`vite.config.js`** — react + tailwind plugins + the `/feedback` dev middleware (writes
  `feedback.md`, gitignored).

## doc-primitives (in `index.css`, reuse them; do not reinvent)

`.docs` (rail + content grid) · `.page-rail` / `.rail-link` / `.rail-group` (sticky index, active =
amber + `>` marker) · `.specimen` (+`.specimen-bar`/`.specimen-cap`/`.specimen-body`) example frame
· `.cmp` / `.cmp-card.cmp-do|.cmp-dont` do/don't comparison · `.dtable` (+`.dt-name`/`.dt-val`/
`.dt-role`/`.dt-sw` swatch) token/spec/props tables · `.copy-token` copy affordance (`data-copy`
handled in `App.jsx`) · `.anatomy`/`.anatomy-legend`/`.anatomy-num` · `.ruler` spacing ramp ·
`.icongrid`/`.icontile` · `.start-card` · `.reslist`/`.res`. Section title vs in-section sub-heading:
the **first** `.band > .label` is the big section title; **subsequent** direct-child `.label`s are
smaller sub-headings (handled by `:first-child` / `:not(:first-child)`). The recurring section a11y
notes use `.callout` but are quieted (`.band > .callout`); the amber `.callout` is reserved for
in-component emphasis (the dialog).

## rendering / review (read this before screenshotting)

- The page renders in your browser at the dev/preview URL. Tell the user to **hard-refresh (⌘⇧R)**.
- Headless screenshots: the hero + intro are each `min-height: 100vh`, so a tall capture window
  makes them huge and the rest never appears. **Use `?cap`** (sets `[data-cap]`, which shrinks
  hero/intro to a fixed height) plus a tall window so the whole page fits one shot, then slice:
  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
    --hide-scrollbars --force-device-scale-factor=1 --window-size=1440,26000 \
    --virtual-time-budget=14000 --run-all-compositor-stages-before-draw \
    --default-background-color=070706ff --screenshot=shots/full-dark.png \
    "http://localhost:5174/?theme=dark&fb=off&cap=1"
  ```
  For the **real** hero, capture `#top` without `?cap`. Gotchas: headless `--screenshot` clips to the
  window height (not full-page), so the window must exceed the page; anchor-scroll (`#section`) does
  **not** settle in headless, so capture the real hero at `#top` and judge other sections from the
  `?cap` slices; the shell here is **zsh**, which does not word-split unquoted `$VAR` in
  `for x in $VAR` — use an explicit list or `${=VAR}`.

## LOCKED decisions (do not relitigate)

- two themes only: dark default (`--canvas #070706`) + a genuinely-white warm-paper light; palette
  desaturated/earthy (amber `#cba35c` primary; teal/olive/clay/mauve). amber is a **scarce** accent.
- all-lowercase ui chrome; never lowercase user content / code / data values.
- vector icons only (Lucide + Simple Icons brand marks + the wheat logo); every inline `<svg>`
  carries a `viewBox` + `width`/`height`. swatches paint their **literal hex**, never a themed var.
- standardized tokens: 4/8 spacing, one type scale, one control height (36/28), radius 0.
- single elevated page (the owner chose this over multi-page). keep the fairtrade narrative.
- neuroinclusive defaults ship in the tokens (16px floor, 1.5 line-height, 66ch measure, ≥3:1
  borders, global focus ring, ≥24/44px targets, tabular numbers, static-first motion).

## the user's rules (they enforce these hard)

1. no decorative cruft, no AI-slop. no em dashes, no `·` middots, no buzzwords, no "not X but Y",
   no `//`, no `>` prefix except the active rail/nav marker, no eyebrow labels, no accent bars on titles.
2. real icons only, consistent sizes.
3. everything aligned, left-aligned, on the grid.
4. equal heights for controls sitting together.
5. sharp tones / contrast; dark deep, light truly white, titles crisp.
6. caves-of-qud flavor, never at the cost of readability.
7. review everything yourself via screenshots before declaring done; spawn parallel QA-reviewers on
   the crops (it keeps catching real defects).
8. namespace classes; avoid generic collisions.

## phase 2 (the rollout, once approved)

Build the shared `@peasant-labs/theme` token package (`transcript-browser/packages/theme/src/tokens.css`
mirrors the names via `--tb-*`). Swap values + fonts, retarget the three apps' globals
(`peasant/web/src/app/globals.css`, `village/frontend/src/app/globals.css`, the viewer's `styles.css`).
Token NAMES are preserved, so components reflavor in place; then fan out screen by screen.
