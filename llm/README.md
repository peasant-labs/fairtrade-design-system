# fairtrade design system

One visual identity across **peasant** (local web), **village** (the commons), and
**transcript-browser** (the shared viewer), presented as a **single-page design-system site**
(modeled on wise.design, in the locked Caves-of-Qud identity): a hero, a value-prop, and 20
documented sections in three groups, with a sticky on-this-page rail and scroll-spy. Built with
**Vite + React + Tailwind v4**.

> **▶ Working on this? Start at [`NEXT_PHASE.md`](./NEXT_PHASE.md)** (current priorities) and
> [`HANDOFF.md`](./HANDOFF.md) (state + gates). The page is now interactive end-to-end (command
> palette ⌘k, modal dialog, tablist, dropdown menu) and gated by `pnpm build` (contrast) +
> `node scripts/validate.mjs` (19-check interactive). Use **agent teams + workflows**.

## run

```bash
pnpm install
pnpm dev            # http://localhost:5173 (or next free port)
pnpm build          # static dist/
pnpm preview        # serve dist/
```

- toggle dark/light with the button top-right; deep-link a theme with `?theme=light`.
- the **feedback** button (bottom-right) lets you click any element and leave a comment; comments
  auto-save to `feedback.md` (gitignored) via a Vite dev middleware. disable with `?fb=off`.
- `?cap` is a review-only capture mode that shrinks the full-screen hero/intro so the whole page
  fits one screenshot (see `HANDOFF.md` → rendering).

## structure

- [`../index.html`](../index.html) — Vite shell (fonts + theme/cap preload + favicon + `#root`).
- `../src/sections/*.html` — one HTML partial per section (numbered), injected via a **memoized** `<Raw>`.
- `../src/App.jsx` — composition root: injects the partials, renders the React sections (hero, intro,
  cards) + interactive `CommandPalette.jsx` / `Dialog.jsx`, the sticky rail + scroll-spy, nav-reveal,
  and the delegated handlers (theme, copy-token, ⌘k palette, dialog, tablists, dropdown menus).
- `../src/icons.js` — bundled lucide painter (`paintIcons()`); `lucide-react` for React components.
- `../scripts/` — `contrast.mjs` (gate, run by `pnpm build`), `validate.mjs` (19-check interactive gate),
  `diag.mjs` (interactive diagnostics).
- `../src/index.css` — Tailwind v4: design tokens in `:root` / `[data-theme="light"]`, the base layer,
  the ported component classes, and the doc-primitives (specimen / do-don't / token tables / rail /
  copy-token / ruler / anatomy). single source of truth for styling.
- `../src/effects.jsx` — image→ascii / halftone / duotone filters (wheat hero, peasant portraits).
- `llm/` — the docs: [`DESIGN.md`](./DESIGN.md) (system spec), [`PRESENTATION.md`](./PRESENTATION.md)
  (the single-page build spec), [`NEUROINCLUSIVE.md`](./NEUROINCLUSIVE.md) (accessibility defaults),
  [`HANDOFF.md`](./HANDOFF.md) (this stack, in detail), [`inspiration.md`](./inspiration.md).

## the page (information architecture)

- **intro** — hero (wheat ascii + wordmark), value-prop, start-here on-ramp.
- **foundations** — principles, voice, color, typography, spacing & layout, iconography, motion,
  controls, **states** (disabled/loading/error/etc.).
- **components** — badges & states, trails & tabs, cards & rows, conversation window, canvas &
  dialog, forms & empty states, **overlays** (tooltip, dropdown menu, command palette, avatar/kbd/tag).
- **using the system** — accessibility & neuroinclusive, tokens reference, resources.

Each section reads: overview → live specimen → (anatomy / do-don't / specs + token tables) →
a quiet accessibility note.

## at a glance

- **themes:** dark (default, deep near-black) + light (genuinely white, warm paper), token-driven;
  glow is dark-only; amber is a scarce accent.
- **type:** Atkinson Hyperlegible Mono (display + chrome + code) + Atkinson Hyperlegible (reading prose).
- **icons:** Lucide for UI, Simple Icons for brand marks, the wheat logo for the brand. vector only.
- **standardized:** one 4/8 spacing scale, one type scale, one control height, one border token, radius 0.
- **neuroinclusive by default:** 16px floor, 1.5 line-height, capped measure, ≥3:1 borders, global
  focus ring, tabular numbers, static-first motion. (see `NEUROINCLUSIVE.md`.)

## rollout

A shared token layer is the source of truth; token names are preserved across the three apps so only
values + fonts change and components reflavor in place, then the system fans out across every screen.
See [`DESIGN.md`](./DESIGN.md) and [`HANDOFF.md`](./HANDOFF.md).
