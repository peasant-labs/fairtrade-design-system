# fairtrade design system

**fairtrade** is an **open-source** design system for building agent products of every kind:
orchestration, analysis, transcripts, pr review, and more. it ships design tokens, a documented
component library, and the rules that keep every screen aligned, glanceable and readable, in a locked
identity (amber on near-black + warm paper, atkinson hyperlegible mono, lowercase chrome, square
corners). built with **vite 8 + react 19 + tailwind v4**, run with **pnpm**.

this repo is the single-page presentation site: a wise.design-style page that reads top to bottom, with
an ascii splash at the top, the documented system in the middle, and a live "in use" showcase at the end
across three example apps (an analytics dashboard, a commons, and a transcript viewer) that exercise the
system's range. it ships a component library (`src/ui/*`) with storybook, and is **neuroinclusive by
default** (the dyslexia / adhd / autism / low-vision rules are baked into the tokens, not a toggle).

## run

```bash
pnpm install
pnpm dev              # the presentation (http://localhost:5180, or next free port)
pnpm build           # contrast gate + static dist/
pnpm preview         # serve dist/
pnpm storybook       # the component library (http://localhost:6006)
pnpm build-storybook # compile every component + story
```

- toggle dark/light top-right, or deep-link a theme with `?theme=light`.
- the in-page comment tool is **dev-only** (it posts to a dev-server endpoint); `?fb=off` hides it in dev.
  `?cap` is a review-only capture mode that shrinks the full-screen sections so a whole tall section fits
  one screenshot.

## the page

1. **hero** (`#top`) - an ascii wheat **video** (the crop). it seeds the next screen.
2. **brand** (`#brand`) - a dim ascii **soil** field with **roots** fanning down (narrow at the top,
   full width at the bottom) into a white **fairtrade** wordmark; soil, roots and wordmark each reveal
   on scroll-in.
3. **philosophy** (`#manifesto`) - one statement over a cursor-spotlight that reveals a tiled field of
   ascii portraits behind the text.
4. **documentation** - foundations, components and "using the system", in three groups, with a sticky
   on-this-page rail and scroll-spy. the header is gated by zone (hidden over the splash, shown across
   the docs).
5. **in use** (`#inuse`) - a full-screen workspace whose sticky app-switcher flips between live demos of
   the three apps (transcript viewer, village commons, peasant code-map + analytics).

## at a glance

- **themes:** dark (default, deep near-black) + light (genuinely white, warm paper); token-driven; amber
  is a scarce accent.
- **type:** atkinson hyperlegible mono (display + chrome + code) + atkinson hyperlegible (reading prose).
- **icons:** lucide-react for all functional ui; brand marks are inline `<symbol>`s. procedural + filtered
  **ascii imagery** is an intentional centerpiece on a few low-traffic display surfaces only.
- **standardized:** one 4/8 spacing scale, one type scale (16px floor), one control height, one border
  token, radius 0.

## structure

- `src/App.jsx` - composition root: nav, the hero/brand splash, philosophy, the docs (sticky rail +
  scroll-spy), and the in-use showcase.
- `src/sections-react/*.jsx`, `src/DocSections.jsx`, `src/ComponentSections.jsx` - the documented sections.
- `src/ui/*` - the typed component library; storybook is the source of truth (`pnpm storybook`). tables
  are tanstack-table-backed (`DataTable`), charts are recharts-backed (`ChartBar` / `ChartLine` /
  `Sparkline`), and provider logos use `BrandMark` - all wrapped so the engines match the system.
- `src/mockups/inuse/*` - the in-use app demos (hand-rolled svg visualizations).
- `src/index.css` - the single source of truth for design tokens and styling.
- `src/effects.jsx` - the ascii filters (wheat video, soil, roots, portrait thumbnails).
- `scripts/*` - the gate and qa scripts.
- machine-readable for agents: `AGENTS.md` (hard rules + commands), `llms.txt`, and generated
  `public/tokens.json` (w3c dtcg) + `public/components.json` + `packages/tokens/*` (kept fresh by
  `pnpm gen:check`).

## gates / ci

`pnpm build` regenerates the machine-readable artifacts then runs a pure-js wcag contrast gate (both
themes) before building; `pnpm gen:check` fails if those artifacts or the token package drift from
their sources.
`scripts/validate.mjs` is a 20-check puppeteer interactive gate (icons, single h1, heading outline,
copy-token labels, decorative icons `aria-hidden`, scroll-spy, zone header gating, command palette, dialog
focus-trap, theme toggle, 0 overflow at 360/390/768/1024/1440, reduced-motion, no console errors).
`build-storybook` + `scripts/sbsmoke.mjs` load every story (incl. `play()`). all run in ci
([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)); `deploy.yml` publishes to github pages with
storybook nested under `dist/storybook/`.

## license

open source under the [MIT license](./LICENSE).
