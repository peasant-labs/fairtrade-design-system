# fairtrade design system

One visual identity across **peasant** (local web), **village** (the commons), and
**transcript-browser** (the shared viewer), presented as a **single-page design-system site**
(modeled on wise.design, in the locked Caves-of-Qud identity): a full-screen hero, a minimalist
philosophy screen, and 20 documented sections in three groups, with a sticky on-this-page rail
and scroll-spy. Built with **Vite + React + Tailwind v4**.

> **Working on this? Start at [`HANDOFF.md`](./HANDOFF.md)** - the single entry point (current state,
> roadmap, architecture, gates, locked rules). The page is interactive end-to-end (cmd-k palette, modal dialog,
> tablists, menus), ships a typed `src/ui/*` component library in **Storybook**, and a full-screen "in use"
> showcase of the three apps. Gates: `pnpm build` (contrast) + `node scripts/validate.mjs` (20-check) +
> `pnpm build-storybook` + `node scripts/sbsmoke.mjs`. Use **agent teams + workflows**.

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
- `?cap` is a review-only capture mode that shrinks the full-screen hero/philosophy so the whole page
  fits one screenshot (see `HANDOFF.md` -> rendering).

## structure

- [`../index.html`](../index.html) - Vite shell (fonts + theme/cap preload + favicon + `#root`); the body is just `<div id="root">`.
- `../src/App.jsx` - composition root: imports and renders the React section modules from `src/sections-react`
  plus `DocSections.jsx` and `ComponentSections.jsx`, plus the inline Hero / Philosophy / Cards sections; owns
  the interactive `CommandPalette.jsx` / `Dialog.jsx`, the sticky rail + scroll-spy, the zone-gated nav, and the
  delegated handlers (theme, copy-token, cmd-k palette, dialog open).
- `../src/sections-react/*.jsx` - one component module per documented section (numbered, mirroring the old
  partial names): `00-defs` (Defs: inline brand `<symbol>`s), `01-nav` (NavBar), `24-color`, `26-type`,
  `28-spacing`, `30-icons`, `34-controls`, `36-states`, `42-badges`, `44-trails`, `48-conversation`, `50-canvas`,
  `52-forms`, `54-overlays`, `62-a11y`, `64-tokens`; `_tokens.jsx` holds the shared CopyBtn / Swatch / TokenTable helpers.
- `../src/DocSections.jsx` - GroupOpener, StartSection, MotionSection, PrinciplesSection, VoiceSection, ResourcesSection.
- `../src/ComponentSections.jsx` - DataTableSection, PaginationSection, AccordionSection, TimelineSection, ToastSection, DateRangeSection.
- `../src/ui/*` - the typed (JSDoc) component library (Button, Input, Switch, Chip, Card, Tabs, Menu,
  Tooltip, DataTable, Pagination, Accordion, ...) reusing the `index.css` classes; barrel `index.js`.
- `../src/mockups/inuse/*` - the full-screen "in use" showcase (`InUseShell` + the three app demos).
- `../.storybook/` - Storybook (SB10 + Vite): `main.js` + `preview.jsx` (theme/a11y/viewport wiring).
- `../scripts/` - `contrast.mjs` (gate, run by `pnpm build`), `validate.mjs` (20-check interactive gate),
  `sbsmoke.mjs` (storybook play-test smoke), plus QA tools `findover.mjs` (overflow), `shoot.mjs` / `shootdemo.mjs`
  (screenshots), `viewport.mjs`, `imgdiff.mjs`, `diag.mjs`, `fullpage.mjs`.
- `../src/index.css` - Tailwind v4: design tokens in `:root` / `[data-theme="light"]`, the base layer,
  the component classes + tier-2 families + the in-use namespaces, and the doc-primitives. single source
  of truth for styling. its `@source` globs point at `./sections-react` + `./App.jsx`.
- `../src/effects.jsx` - image->ascii / halftone / duotone filters (AsciiImage, AsciiVideo, AsciiRoots:
  the wheat hero, the procedural roots, peasant portraits).
- `llm/` - the docs: [`HANDOFF.md`](./HANDOFF.md) (entry: state + roadmap + gates),
  [`DESIGN.md`](./DESIGN.md) (system spec), [`PRESENTATION.md`](./PRESENTATION.md) (single-page build spec),
  [`NEUROINCLUSIVE.md`](./NEUROINCLUSIVE.md) (accessibility defaults),
  [`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md) (the deferred multi-app rollout).

## the page (information architecture)

The top is two full-screen experiences before the docs begin:

- **hero** (`#top`) - one ascii wheat **video** (the crop) with procedural ascii **roots** growing out of its
  base into a big "fairtrade" wordmark in the system font.
- **philosophy** (`#manifesto`) - minimalist: a short centered statement over a cursor-following spotlight that
  reveals a tiled field of ascii portraits behind the text.

Then the documented sections, in three groups (each reads overview -> live specimen ->
anatomy / do-don't / specs + token tables -> a quiet accessibility note):

- **foundations** - principles, voice, color, typography, spacing & layout, iconography, motion,
  controls, **states** (disabled/loading/error/etc.).
- **components** - badges & states, trails & tabs, cards & rows, conversation window, timeline, canvas &
  dialog, forms & empty states, **overlays** (tooltip, dropdown menu, command palette, avatar/kbd/tag),
  **data table** (sortable/selectable), **pagination** (numbered), **accordion**, toast host, date range.
- **using the system** - accessibility & neuroinclusive, tokens reference, resources.
- **in use** - a full-screen workspace (`InUseShell`) whose sticky **top app-switcher banner** switches between
  live, feature-complete demos of the three apps: the transcript viewer, the village commons, and peasant's
  code-map + analytics.

The header (nav) is **gated by zone**: hidden over the hero + philosophy splash, shown across the docs (from
"start here" onward), and hidden again over the in-use stage (which carries its own sticky top app-switcher
banner instead - the old left app-rail is gone). Scrolling uses `scroll-snap-type: y proximity` +
`scroll-behavior: smooth`; only the hero, philosophy, and in-use stage snap.

## at a glance

- **themes:** dark (default, deep near-black) + light (genuinely white, warm paper), token-driven;
  glow is dark-only; amber is a scarce accent.
- **type:** Atkinson Hyperlegible Mono (display + chrome + code) + Atkinson Hyperlegible (reading prose).
- **icons:** lucide-react for UI; brand marks are inline `<symbol>`s in `00-defs.jsx`; the wheat logo is the brand. vector only.
- **standardized:** one 4/8 spacing scale, one type scale, one control height, one border token, radius 0.
- **neuroinclusive by default:** 16px floor, 1.5 line-height, capped measure, >=3:1 borders, global
  focus ring, tabular numbers, static-first motion. (see `NEUROINCLUSIVE.md`.)

## rollout

A shared token layer is the source of truth: the intent is that token names stay constant across the three
apps so only values + fonts change and components reflavor in place, then the system fans out across every
screen. **Caveat:** that "token-names-preserved" premise is not actually true in the repo today (the apps
still carry separate token namespaces); reconciling them is deferred work gated on owner approval. See
[`DESIGN.md`](./DESIGN.md), [`HANDOFF.md`](./HANDOFF.md), and [`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md).
