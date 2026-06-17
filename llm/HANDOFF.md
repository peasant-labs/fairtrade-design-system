# handoff — fairtrade design system

## what this is (updated 2026-06-16)

The repo is no longer a flat component gallery. It is a **single-page design-system
presentation** (modeled on wise.design, bound to the locked Caves-of-Qud identity): a hero,
a value-prop, and 20 documented sections in three groups, with a sticky on-this-page rail and
scroll-spy. Build spec: [`PRESENTATION.md`](./PRESENTATION.md). System spec: [`DESIGN.md`](./DESIGN.md).
Accessibility defaults: [`NEUROINCLUSIVE.md`](./NEUROINCLUSIVE.md).

## stack

**Vite + React + Tailwind v4**, run with **pnpm**.
- `pnpm install && pnpm dev` → http://localhost:5173 (or next free port, e.g. 5174).
- `pnpm build` → static `dist/`. `pnpm preview` serves it.
- `?theme=light` deep-links the paper theme. `?fb=off` hides the feedback tool. `?cap` is a
  review-only capture mode (see "rendering" below).
- Fonts: **Atkinson Hyperlegible Mono** (chrome/display/code) + **Atkinson Hyperlegible**
  (reading prose), via Google Fonts in `index.html`.
- Icons: **Lucide** painted by `window.lucide.createIcons()` (UMD, loaded in `index.html`) for the
  `data-lucide` icons in the partials; **lucide-react** for the React pieces (hero/cards/feedback).
  Brand marks are inline `<svg><use href="#b-*">` symbols defined once in `src/sections/00-defs.html`.

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
