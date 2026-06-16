# peasant design system

One visual identity across **peasant** (local web), **village** (the commons), and **transcript-browser** (the shared viewer). Now a small **Vite + React + Tailwind v4** app: a living component gallery with an in-page feedback tool.

## run

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

- toggle dark/light with the button top-right; deep-link a theme with `?theme=light`.
- the **feedback** button (bottom-right) lets you click any element and leave a comment; comments auto-save to `feedback.md` (gitignored) via a Vite dev middleware. disable the tool with `?fb=off`.
- `pnpm build` → static `dist/`.

## stack / layout

- [`../index.html`](../index.html) — Vite shell (fonts + theme preload + `#root`).
- `../src/index.css` — Tailwind v4: design tokens in `@theme`, base + reused primitives as `@apply` component classes (the hybrid). single source of truth for styling.
- `../src/gallery.html` — the gallery markup (raw HTML blob, not componentized yet).
- `../src/App.jsx` — injects the gallery and runs the feedback tool as React.
- `../vite.config.js` — react + tailwind plugins + the `/feedback` write middleware.
- `llm/` — these docs (`DESIGN.md`, `HANDOFF.md`, this `README.md`).

## philosophy (short)

1. styled, but functional
2. always know where you are (fixed nav, sticky headers, breadcrumbs)
3. tools stay on screen
4. aligned, left-aligned
5. glanceable (icons lead data, not chrome)
6. readable first
7. maximize usability

## at a glance

- **themes:** dark (default, deep near-black) + light (genuinely white, low-chroma), token-driven; glow is dark-only.
- **type:** **Atkinson Hyperlegible Mono** carries the ascii/terminal identity (display + chrome + code); **Atkinson Hyperlegible** (proportional) for reading prose.
- **icons:** [Lucide](https://lucide.dev) for UI, [Simple Icons](https://simpleicons.org) for brand marks, the peasant wheat logo for the brand. vector only, no ascii art.
- **standardized:** one 4/8 spacing scale, one type scale, one control height, one border token, radius 0.

## rollout

A shared token layer is the source of truth; token names are preserved across the apps so values + fonts change and components reflavor in place, then the system fans out across every screen. See [`DESIGN.md`](./DESIGN.md).
