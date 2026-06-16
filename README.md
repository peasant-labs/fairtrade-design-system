# peasant design system

One visual identity across **peasant** (local web), **village** (the commons), and **transcript-browser** (the shared viewer).

- **[`index.html`](./index.html)** — the live component gallery. Open it in a browser; toggle dark/light with the button in the top-right. Append `?theme=light` to deep-link the light theme.
- **[`DESIGN.md`](./DESIGN.md)** — the system: philosophy, tokens, type, iconography, components, and voice.

## philosophy (the short version)

1. styled, but functional
2. the user always knows where they are (fixed nav, sticky headers, breadcrumbs)
3. tools stay on screen
4. everything aligned, and left-aligned
5. glanceable (icons lead data, not chrome)
6. readable first
7. maximize usability

## at a glance

- **themes:** dark (default, deep) + light (white, low-chroma), token-driven.
- **type:** display + body in a serif-that-resembles-mono; mono reserved for code. *(final face under selection — see the typography section in `index.html`.)*
- **icons:** [Lucide](https://lucide.dev) for UI, [Simple Icons](https://simpleicons.org) for brand marks, the peasant wheat logo for the brand. No ASCII art.
- **standardized:** one 4/8 spacing scale, one type scale, one control height, one border token, radius 0.

## rollout

A single shared `@peasant-labs/theme` token package is the source of truth. Token names are preserved across the apps, so values + fonts change and components reflavor in place; then the system fans out across every screen.
