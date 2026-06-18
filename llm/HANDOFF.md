# handoff - fairtrade design system

> Single entry point for whoever (human or agent) picks this up next. Read this top-to-bottom before
> touching anything. Companion specs: [`DESIGN.md`](./DESIGN.md) (the system: tokens, principles, voice),
> [`PRESENTATION.md`](./PRESENTATION.md) (the as-built page IA), [`NEUROINCLUSIVE.md`](./NEUROINCLUSIVE.md)
> (the a11y defaults baked into the tokens), [`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md) (the deferred
> cross-app rollout), [`README.md`](./README.md) (repo orientation).

State: the page is 100% component-driven, all automated gates are green, and the tier-2.5 component
library + Storybook + full-screen app demos are in. The single owner-reviewed item is the hero brand
moment (below). Everything that was done in this repo is the as-built state described in `DESIGN.md` /
`PRESENTATION.md`; the cross-app rollout is deferred (`UNIFICATION_PLAN.md`).

---

## the hero brand moment (`#top` / `#brand`)

The intent: screen 1 is the wheat **crop** (an ascii video); scrolling down, **roots grow out of the
bottom of that crop** and taper into a big **`fairtrade`** wordmark. One crop, one continuous
plant -> roots -> name. The owner rejected several earlier attempts where the roots read as a separate,
faded layer ("not connecting", "duplicating the video", "shouldn't be faded at the start").

**How it works now (Option D - seed the roots from the video):**
- `App.jsx` `Hero()`: `.hero-crop` wraps the wheat `<AsciiVideo className="hero-bg">`; `.hero-grow#brand`
  wraps `.hero-roots-wrap` (`<AsciiRoots cols=300 rows=82 bases=22 overlap=0.24 seeds=… nodes>`) +
  `.hero-foot` (the `.hero-word` "fairtrade").
- **Seed handoff:** `AsciiVideo` takes an `onColumns` callback and emits a **one-time per-column density
  profile** of the wheat's lower body (a band ~30% up from the bottom, after boost/contrast/gamma, so it
  catches the stalk columns rather than the dark bottom edge). `Hero` lifts that profile into state and
  passes it to `AsciiRoots` as `seeds`.
- **AsciiRoots** (`effects.jsx`): when `seeds` are present it **bins the wheat's active width into `bases`
  equal slots and takes the densest column in each** - so the bases span the full width and the lower
  roots don't funnel into a center cone (the owner's prior rejection). It draws a **dense seam band** in
  the top `overlap` rows using the wheat ramp's dense end (`SEAM_DENSE`), then thins to tendrils, with the
  bottom-taper tuned so strands survive down toward the wordmark. A small breathing gap (~18px) sits
  between the shortest tails and the letter caps by design - don't crash the roots into the wordmark.
- **The seam (CSS, `index.css`):** `.hero-grow` is pulled up `margin-top:-20vh` to overlap the crop;
  `.hero-bg`'s mask fades the wheat's **top and bottom** edges (`…#000 15%, #000 84%, transparent`) so the
  wheat dissolves into the dense roots instead of ending on a hard line. `.hero .hero-roots` uses the
  **same cell size** as `.hero-bg` (`clamp(5px,0.95vw,9.5px)`) so root columns register against the stalk
  columns they were seeded from; opacity is 1 (dark) / 0.9 (light).
- **Capture mode:** `[data-cap] .hero-grow { margin-top:-72px }` keeps a proportional overlap so
  `?cap` / `shoot.mjs` review shots show the real seam (the old rule zeroed it and showed a false gap).

**Verifying it / iterating:** screenshot the seam with `node scripts/viewport.mjs <theme> <dir> top brand`
(the **non-`?cap`** real view; `?cap` shrinks the section). The seam is the `brand` anchor. This moment is
owner taste-driven - **review the crops yourself and get the owner's eye before declaring it done.** If
asked to push it further: the remaining levers are the overlap depth (`-20vh`), the wheat-bottom mask fade,
the seam-band depth (`overlap`), and the bottom-taper rate in `AsciiRoots`. The honest fallback the owner
offered before is to **ask for a visual reference** rather than keep re-tuning blind.

## what's next

1. **Hero polish, if the owner wants it** - the moment above is built and gated; any further change is
   taste, not a blocker. Get the owner's eye.
2. **Optional tier-2** - wire the `ToastHost` at the app root so `[data-copy]` copy uses `toast.ok(...)`;
   a horizontal step variant alongside the vertical `Timeline`. Genuinely optional.
3. **The multi-app rollout** ([`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md)) - still **deferred until
   approved**. Stay inside `unified-identity`.

**Proven loop:** fan out reads/builds (one agent per section/view) -> integrate the shared files
(`App.jsx`, `index.css`) -> `pnpm build` -> parallel screenshot QA (both themes via `viewport.mjs` /
`shoot.mjs`) -> fix -> keep every gate green. For full-screen sections prefer `viewport.mjs` (non-`?cap`);
`?cap` shrinks them. Spawn parallel QA reviewers on the crops - pixel-level review catches seams and gaps
an eyeball misses on a downscaled shot.

## what this is

A **single-page design-system presentation** (modeled on wise.design, bound to the locked Caves-of-Qud
identity), not a flat component gallery. **Vite 8 + React 19 + Tailwind v4**, run with **pnpm**. One visual
identity across **peasant** (local analytics), **village** (the commons), **transcript-browser** (the shared
viewer). The top is an experiential splash; the middle is the documented system; the end is a live, immersive
"in use" showcase of the three apps.

## stack / run

```bash
pnpm install
pnpm dev --port 5180   # the page (or next free port)
pnpm build             # contrast gate (scripts/contrast.mjs) + static dist/
pnpm preview           # serve dist/
pnpm storybook         # the component library (port 6006)
pnpm build-storybook   # compile every component + story
```

- `?theme=light` deep-links the paper theme. `?fb=off` hides the dev feedback tool. `?cap` is a review-only
  capture mode that shrinks full-screen sections so a whole tall section fits one screenshot (it keeps a
  proportional hero overlap, but still shrinks - judge the hero seam from non-`?cap` `viewport.mjs` shots).
- Fonts: **Atkinson Hyperlegible Mono** (`--font-display` + `--font-mono`: chrome/display/code) +
  **Atkinson Hyperlegible** (`--font-body`: reading prose), via Google Fonts in `index.html`.
- Icons: **lucide-react** everywhere (no CDN, no `<i data-lucide>`, no `paintIcons`). Decorative glyphs carry
  `aria-hidden` (added in markup, with a one-shot `labelIconA11y` backstop on mount). Brand marks are inline
  `<svg><use href="#b-*">` symbols defined in `<Defs/>` (`src/sections-react/00-defs.jsx`); path data
  originated from Simple Icons but is inlined (not a dependency).

## architecture

- **`src/App.jsx`** - composition root. Renders, in order: `<Defs/>`, `<NavBar/>`, `<Hero/>` (`#top`, inner
  `#brand`), `<Philosophy/>` (`#manifesto`), then `.docs` (`<Rail/>` + `<main class=docs-main>` with the
  section components interleaved with inline `Cards`), then `<InUseShell/>` (`#inuse` + `#inuse-stage`,
  full-bleed outside `.docs`), then `<footer>`. The `RAIL` array drives the sticky on-this-page index +
  scroll-spy. **Effects:** theme apply; one-shot `labelIconA11y`; rAF scroll-spy (last-section-past-fold
  model); **zone header gate** (hidden over splash, shown over docs, hidden over in-use); `data-spy`
  group-active sync; cmd-k palette; `rootClick` delegation (theme toggle, palette, `[data-open-dialog]`,
  `[data-copy]` copy-token); scroll-reveal (reduced-motion-aware); the dev feedback tool. Live
  `CommandPalette`/`Dialog` are `src/CommandPalette.jsx`/`src/Dialog.jsx` (the `src/ui/*` ones are shims).
- **`src/sections-react/*.jsx`** - one component per documented section (names mirror the section numbers):
  `00-defs`->`Defs` `01-nav`->`NavBar` `24-color` `26-type` `28-spacing` `30-icons` `34-controls` `36-states`
  `42-badges` `44-trails` `48-conversation` `50-canvas` `52-forms` `54-overlays` `62-a11y` `64-tokens`, plus
  `_tokens.jsx` (shared `CopyBtn`/`Swatch`/`TokenTable`). `src/DocSections.jsx`: `GroupOpener`/`StartSection`/
  `MotionSection`/`PrinciplesSection`/`VoiceSection`/`ResourcesSection`. `src/ComponentSections.jsx`: the live
  tier-2 showcases (`DataTable`/`Pagination`/`Accordion`/`Timeline`/`Toast`/`DateRange`).
- **`src/ui/*`** - the typed (JSDoc) component library + a `*.stories.jsx` each (Storybook source of truth).
  **`src/mockups/inuse/*`** - `InUseShell` (the immersive shell + sticky top app-switcher banner) +
  `TranscriptApp` (split rail: left outline / centre transcript / right filters), `CommonsApp`/
  `CommonsExplore`/`CommonsManage`, `GraphApp`/`GraphMap`/`GraphAnalytics`. All charts/graphs are hand-rolled
  SVG (no chart libraries). **`.storybook/`** - `main.js` + `preview.jsx`.
- **`src/index.css`** - the single styling source of truth: tokens in `:root` / `[data-theme="light"]`
  (do NOT rename; values re-theme), the base layer, component classes, doc-primitives, the page-shell rules
  (`.hero*`/`.philos*`, scroll-snap + `scroll-behavior`, `.nav.nav--hidden`), the tier-2 families
  (`bs-`/`is-`/`sw-`/`fb-`/`chipx-`/`tbl-`/`pgn-`/`acc-`/`tl-`/`tsx-`/`dr-`), and the in-use namespaces
  (`iu-`/`txn-`/`cex-`/`cmg-`/`gmp-`/`gan-`). `@source "./sections-react"` + `@source "./App.jsx"`
  (`src/ui` + `src/mockups` are NOT in `@source` - they don't rely on Tailwind utilities at runtime here).
- **`src/effects.jsx`** - the ascii filters: `AsciiVideo` (runtime-sampled wheat, with the `onColumns` seam
  profile), `AsciiImage` (image->ascii on canvas; `fit` + theme-adaptive ink), `AsciiArt` (image->ascii
  `<pre>`), `AsciiText`/`AsciiWordmark` (block-font wordmarks), `AsciiRoots` (procedural roots, seeded from
  the wheat columns), `Halftone`, `GlyphField`.

## doc-primitives (in `index.css`, reuse them; do not reinvent)

`.docs` (rail + content grid) · `.page-rail`/`.rail-link`/`.rail-group` (sticky index, active = amber + `>`) ·
`.band` (a section; first `.band > .label` = title, later `.label`s = sub-headings) · `.specimen`
(+`.specimen-bar`/`.specimen-cap`/`.specimen-body`) · `.cmp`/`.cmp-card.cmp-do|.cmp-dont` do/don't ·
`.dtable` (+`.dt-name`/`.dt-val`/`.dt-role`/`.dt-sw`) token/spec/props tables (use `_tokens.jsx`'s
`TokenTable`/`CopyBtn`/`Swatch` for copy-token tables) · `.copy-token` (`data-copy`, handled by `rootClick`) ·
`.anatomy`/`.anatomy-legend`/`.anatomy-num` · `.icongrid`/`.icontile` · `.start-card` · `.reslist`/`.res`.

## gates / how to verify (keep all green)

- `pnpm build` - runs `scripts/contrast.mjs` (pure-JS WCAG contrast, both themes; functional borders/icons/
  focus must clear 3:1, text 4.5:1; structural dividers are intentionally sub-3:1, report-only - do not
  "fix") then compiles.
- `node scripts/validate.mjs "http://localhost:5180/?fb=off"` - **20-check** puppeteer-core interactive gate
  (icons painted, exactly one h1, heading outline, copy-tokens named, decorative icons aria-hidden, scroll-spy,
  zone header gating, cmd-k palette, dialog focus-trap + Esc return, theme toggle, icons persist across toggle,
  0 overflow at 360/390/768/1024/1440, reduced-motion, no console errors).
- `node scripts/findover.mjs <w>` - lists horizontal-overflow offenders at width w.
- `pnpm build-storybook` then `node scripts/sbsmoke.mjs` - compiles + headlessly loads every story, runs their
  `play()` tests, separates real assertion errors from benign 404s.
- Screenshot QA: `node scripts/viewport.mjs <theme> <dir> [anchors…]` (full-viewport, real view - use for the
  full-screen sections + header-gating + the hero seam) · `node scripts/shoot.mjs <theme> <dir> [ids…]`
  (clipped section crops, uses `?cap`) · `node scripts/shootdemo.mjs <theme> <dir>` (drives the in-use
  app-switcher) · `node scripts/imgdiff.mjs <theme> [ids…]` (pixel diff `shots/baseline-*` vs `shots/after-*`)
  · `scripts/diag.mjs` / `scripts/fullpage.mjs`.
- CI: `.github/workflows/ci.yml` runs the 4 gates on push/PR; `deploy.yml` builds + nests Storybook into
  `dist/storybook/` for Pages.

Gotchas: headless capture clips to the window height (window must exceed the section). Anchor-scroll does not
settle in headless - `viewport.mjs` kills snap+smooth for deterministic landing. zsh: no word-splitting of
unquoted `$VAR` (pass ids as separate args; quote grep `--include` globs). Storybook `play()`: components with
an entrance animation fail an instant `toBeVisible()` (assert `[hidden]`/content instead); `userEvent.keyboard`
needs a `waitFor` after auto-focus. Pixel-diffing the tall full-screen sections is **noisy** (sub-pixel capture
drift) - prefer DOM/structural diffing or the deterministic `viewport.mjs` for those.

## LOCKED decisions (do not relitigate)

- two themes only: dark default (`--canvas #070706`) + a genuinely-white warm-paper light (`--canvas #fbfaf7`);
  palette desaturated/earthy (amber `#cba35c` primary; teal/olive/clay/mauve). amber is a **scarce** accent.
- all-lowercase ui chrome; never lowercase user content / code / data values.
- **two-tier imagery:** functional UI / chrome / tools / status / nav are **vector (lucide) only** - no ascii
  there. Procedural + filtered **ascii imagery is intentional** on low-traffic display surfaces (the wheat
  hero video, the roots wordmark, the philosophy portrait field, the card thumbnails). Brand marks are inline
  SVG `<symbol>`s. Every inline `<svg>` carries `viewBox` + `width`/`height`. Swatches paint their **literal
  hex**, never a themed var.
- standardized tokens: 4/8 spacing, one type scale (label14/sm14/body16/md18/lg22/xl28/hero40/display52, 16px
  floor), one control height (36/28), radius 0. Never rename a token; values re-theme.
- single elevated page (the owner chose this over multi-page). keep the fairtrade narrative.
- neuroinclusive defaults ship in the tokens (16px floor, 1.5 line-height, ~66ch measure, ≥3:1 functional
  borders, global focus ring, ≥24/44px targets, tabular numbers, static-first motion). See `NEUROINCLUSIVE.md`.

## the user's rules (enforced hard)

1. no decorative cruft, no AI-slop. no em dashes, no `·` middots, no buzzwords, no "not X but Y", no `//`,
   no `>` prefix except the active rail/nav marker, no eyebrow labels, no accent bars on titles.
2. real icons only, consistent sizes.
3. everything aligned, left-aligned, on the grid.
4. equal heights for controls sitting together.
5. sharp tones / contrast; dark deep, light truly white, titles crisp.
6. caves-of-qud flavor, never at the cost of readability.
7. review everything yourself via screenshots before declaring done; spawn parallel QA-reviewers on the crops.
8. namespace classes; avoid generic collisions. (Lesson: a `.brand` section class once collided with the icon
   `.brand` class and leaked nav styles - section/page classes use distinct namespaces.)

## phase 2 - the rollout (deferred until approved)

Build the shared `@peasant-labs/theme` token package and a shared `@peasant-labs/ui` React package consumed by
the docs site AND the three apps; swap values + fonts; retarget the apps' globals. **The premise "token names
are preserved, only values change" is FALSE today** - there are three live token namespaces to reconcile first.
Full plan + the cross-repo component catalog: [`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md). Stay inside
`unified-identity` until the owner approves the rollout.
