# fairtrade design system

One visual identity across **peasant** (local analytics), **village** (the commons), and
**transcript-browser** (the shared viewer), presented as a **single-page design-system site** in the
locked Caves-of-Qud identity (amber-on-near-black + warm-paper, Atkinson Hyperlegible Mono, lowercase
chrome, square corners). Built with **Vite 8 + React 19 + Tailwind v4**, run with **pnpm**.

The page is a wise.design-style presentation, not a flat gallery: an experiential ascii splash at the
top, the documented system in the middle, and a live, immersive "in use" showcase of the three apps at
the end. It ships a typed component library (`src/ui/*`) with Storybook, and is **neuroinclusive by
default** (the dyslexia / ADHD / autism / low-vision rules are baked into the tokens, not a toggle).

## run

```bash
pnpm install
pnpm dev              # the presentation (http://localhost:5173, or next free port)
pnpm build           # contrast gate + static dist/
pnpm preview         # serve dist/
pnpm storybook       # the component library (http://localhost:6006)
pnpm build-storybook # compile every component + story
```

- Toggle dark/light top-right, or deep-link a theme with `?theme=light`.
- `?fb=off` hides the in-page feedback tool. `?cap` is a review-only capture mode that shrinks the
  full-screen sections so a whole tall section fits one screenshot.

## the page

1. **hero** (`#top`) - an ascii wheat **video** (the crop). It seeds the next screen.
2. **brand** (`#brand`) - a dim ascii **soil** field with **roots** fanning down (narrow at the top,
   full width at the bottom) into a white **fairtrade** wordmark; soil, roots and wordmark each reveal
   on scroll-in.
3. **philosophy** (`#manifesto`) - one statement over a cursor-spotlight that reveals a tiled field of
   ascii portraits behind the text.
4. **documentation** - foundations, components and "using the system", in three groups, with a sticky
   on-this-page rail and scroll-spy. The header is gated by zone (hidden over the splash, shown across
   the docs).
5. **in use** (`#inuse`) - a full-screen workspace whose sticky app-switcher flips between live demos of
   the three apps (transcript viewer, village commons, peasant code-map + analytics).

## at a glance

- **themes:** dark (default, deep near-black) + light (genuinely white, warm paper); token-driven; amber
  is a scarce accent.
- **type:** Atkinson Hyperlegible Mono (display + chrome + code) + Atkinson Hyperlegible (reading prose).
- **icons:** lucide-react for all functional UI; brand marks are inline `<symbol>`s. Procedural + filtered
  **ascii imagery** is an intentional centerpiece on a few low-traffic display surfaces only.
- **standardized:** one 4/8 spacing scale, one type scale (16px floor), one control height, one border
  token, radius 0.

## structure

- `src/App.jsx` - composition root: nav, the hero/brand splash, philosophy, the docs (sticky rail +
  scroll-spy), the in-use showcase, footer.
- `src/sections-react/*.jsx`, `src/DocSections.jsx`, `src/ComponentSections.jsx` - the documented sections.
- `src/ui/*` - the typed component library; Storybook is the source of truth (`pnpm storybook`).
- `src/mockups/inuse/*` - the in-use app demos (hand-rolled SVG, no chart libraries).
- `src/index.css` - the single source of truth for design tokens and styling.
- `src/effects.jsx` - the ascii filters (wheat video, soil, roots, portrait thumbnails).
- `scripts/*` - the gate and QA scripts.

## gates / ci

`pnpm build` runs a pure-JS WCAG contrast gate (both themes) then builds. `scripts/validate.mjs` is a
20-check puppeteer interactive gate (icons, single h1, heading outline, copy-token labels, decorative
icons `aria-hidden`, scroll-spy, zone header gating, command palette, dialog focus-trap, theme toggle, 0
overflow at 360/390/768/1024/1440, reduced-motion, no console errors). `build-storybook` +
`scripts/sbsmoke.mjs` load every story (incl. `play()`). All four run in CI
([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)); `deploy.yml` publishes to GitHub Pages with
Storybook nested under `dist/storybook/`.
