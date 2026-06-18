# fairtrade presentation — as-built information architecture

> **What this is:** the single-page presentation for the fairtrade design system, as it stands
> today. This is a state reference, not a build plan: it describes the page that exists so a fresh
> agent can find their way around it. The page was once a build spec; that spec is spent and this
> file replaces it. Roadmap and open items live in [`HANDOFF.md`](./HANDOFF.md); foundations and
> copy rules live in [`DESIGN.md`](./DESIGN.md) and [`NEUROINCLUSIVE.md`](./NEUROINCLUSIVE.md). Keep
> each doc to its scope; this one owns the IA and the page-level conventions.

## how the page is built

The whole page renders from React. `index.html` is just `<div id="root">` plus the Atkinson
Google Fonts links and a tiny inline script that reads `?theme=light` / `?cap` from the URL.
`src/main.jsx` mounts `src/App.jsx`, which composes everything.

There are no HTML partials. The earlier `src/sections/*.html` files, the `<Raw>` injector,
`src/icons.js` / `paintIcons`, and the `MutationObserver` that repainted icons are all gone.
Sections live as components:

- `src/sections-react/*.jsx` — one file per documentation section, numbered by render position:
  `00-defs` (`Defs`), `01-nav` (`NavBar`), `24-color`, `26-type`, `28-spacing`, `30-icons`,
  `34-controls`, `36-states`, `42-badges`, `44-trails`, `48-conversation`, `50-canvas`,
  `52-forms`, `54-overlays`, `62-a11y`, `64-tokens`. `_tokens.jsx` holds the shared
  `CopyBtn` / `Swatch` / `TokenTable` helpers the section files import.
- `src/DocSections.jsx` — `GroupOpener`, `StartSection`, `MotionSection`, `PrinciplesSection`,
  `VoiceSection`, `ResourcesSection`.
- `src/ComponentSections.jsx` — `DataTableSection`, `PaginationSection`, `AccordionSection`,
  `TimelineSection`, `ToastSection`, `DateRangeSection`.
- inline in `App.jsx` — `Hero`, `Philosophy`, `Cards` (the sections that need the ascii effects).

Icons are `lucide-react` everywhere. Brand marks are inline `<symbol>` elements in `00-defs.jsx`
(`#logo`, `#b-claude`, `#b-gemini`, `#b-opencode`, `#b-cursor`), referenced by `<use href="#...">`;
the path data was lifted from Simple Icons but inlined, so there is no icon-package dependency.

`src/index.css` is the single stylesheet. Its Tailwind `@source` globs point at
`./sections-react` and `./App.jsx` (not the deleted `./sections`).

## page shape (render order)

`App.jsx` renders, top to bottom:

1. `Defs` — the invisible SVG symbol sheet.
2. `NavBar` — the fixed top header (`.nav`).
3. `Hero` (`<section id="top">`, inner `id="brand"`) — full-screen.
4. `Philosophy` (`<section id="manifesto">`) — full-screen.
5. `.docs` — a two-column grid: the sticky `Rail` plus `<main class="docs-main">` holding every
   documentation section.
6. `InUseShell` (`<section id="inuse">`, stage `id="inuse-stage"`) — full-screen.
7. `<footer class="foot">`.

Inside `.docs-main` the order is:

- `StartSection` (`#start`)
- group **foundations** (`GroupOpener id="foundations"`): principles, voice, color, typography,
  spacing, icons, motion, controls, states
- group **components** (`GroupOpener id="components"`): badges, trails, cards, conversation,
  timeline, canvas, forms, overlays, data-table, pagination, accordion, toast, date-range
- group **using the system** (`GroupOpener id="using"`): a11y, tokens, resources

Section `id`s (from the `RAIL` array in `App.jsx`, which is the source of truth for the rail and
the command palette): `start`, `principles`, `voice`, `color`, `typography`, `spacing`, `icons`,
`motion`, `controls`, `states`, `badges`, `trails`, `cards`, `conversation`, `timeline`, `canvas`,
`forms`, `overlays`, `data-table`, `pagination`, `accordion`, `toast`, `date-range`, `a11y`,
`tokens`, `resources`. The in-use stage anchors are `inuse` (the section) and `inuse-stage`.

## the full-screen top experiences

The top of the page is two immersive, full-viewport screens before the docs begin.

**Hero crop (`#top`).** Screen 1 is the wheat crop: one ascii video sampled at runtime from
`src/assets/wheat.mp4` via `AsciiVideo`. It emits a one-time per-column density profile of its lower
body (`onColumns`), lifted into state as `seeds`. The hero has no solid background, so the body's
dotted grid shows through.

**Brand (`#brand`).** Screen 2 sits right after the crop (no overlap) and holds three layered ascii
elements plus the wordmark, each with a scroll-in reveal driven by one `.grow` class
(IntersectionObserver on `#brand`): a dim full-section soil texture (`AsciiSoilField`, behind
everything incl. the wordmark, fades up); the **roots** (`AsciiRoots ramp fill fan`, seeded from the
wheat `seeds`) which fan narrow-at-top to full-width-at-bottom as sparse root-like strands and grow
downward on reveal; and the `fairtrade` wordmark (`.hero-word`, plain white, no glow, the
`role="img"` element) pinned at the bottom, wiping in left-to-right. Reduced-motion shows everything
at once (`.grown`). A returning visitor (2nd visit, `localStorage` `ft-seen`) gets a faint top-right
`.hero-skip` jump-to-docs button.

**Philosophy (`#manifesto`).** Minimalist: one short centered statement
(`legible before clever, restrained before decorated.`) that fades + rises in on scroll
(`.philos.reveal`), over a dark ground tiled edge-to-edge with ~30 ascii peasant portraits
(`AsciiImage`, the `PHILOS_ARTS` grid, two source faces alternating). A cursor-following spotlight (a
pure delayed-lerp follow, dim, glides off-screen on leave) reveals the portrait field behind the
text. No reveal on touch. The H1 lives here.

## the one H1

The page has a single `<h1>`: the Philosophy statement
(`legible before clever, restrained before decorated.`, `.philos-lead`). Every group opener is an
`<h2>` (`.group h2`); every section title is an `<h2 class="label">`. Do not add a second H1 or a
competing display heading.

## the rail (`Rail`, `.page-rail`)

A sticky "on this page" index, left of the content column on wide viewports, built from the same
`RAIL` array that defines the sections. It has four zones rendered as non-link group dividers
plus their links:

- **foundations** — principles → states
- **components** — badges → date-range
- **using the system** — a11y, tokens, resources
- **in use** — the live-demos zone pointing at `#inuse` / `#inuse-stage`

Active state is color plus the `>` marker only (`.rail-link.active` is `--amber` with the
`::before` `>` in `--amber-dim`); no pill, no progress bar, no numbered TOC. The active item is
driven by the scroll-spy (below).

## the zone-gated header

The header is not always visible. A scroll listener in `App.jsx` toggles `.nav--hidden`
(which translates the bar off the top) by zone:

- **hidden** over the hero and philosophy (the top splash)
- **shown** across the documentation, from `#start` onward
- **hidden** again over the in-use stage

The in-use stage carries its own sticky top app-switcher banner (`.iu-bar`) that visually
replaces the header at the same height, so there is no separate persistent chrome there. There
is no live in-nav breadcrumb. The nav's four group links (`foundations`, `components`,
`using the system`, `in use`) get an `active` class via `data-spy`, driven by the current
section's owning group.

## scroll behaviour

`html` uses `scroll-snap-type: y proximity` (NOT mandatory - that skipped the docs and trapped the
user in philosophy) with `scroll-behavior: smooth` and `overscroll-behavior-y: none`. Snap targets:
`.hero-crop`, `.hero-grow`, `.philos` (with `scroll-snap-stop: always`) and `.docs` (at its start, so
it is never skipped). `.iu` is deliberately NOT a snap target - a snap point there traps the short
footer below it out of reach. For the "any scroll advances one section" feel across the splash, `Hero`
adds a wheel handler scoped to the top zone that jumps crop -> roots -> philosophy one section per
gesture; below philosophy the docs scroll natively.

**Scroll-spy** is a rAF-throttled scroll/resize listener, not an `IntersectionObserver`. On each
frame it walks the section ids in order and sets the active item to the **last** section whose top
has crossed a fold line (`--nav-h` + 120px below the viewport top); at the bottom of the page it
snaps to the final id. This replaced the earlier observer that got stuck early.

## the in-use showcase (`InUseShell`)

A full-viewport stage hosting the three sibling apps, switched by a tablist in the sticky
`.iu-bar` banner (click, arrow-key roving, or number keys 1/2/3), with an expand control for
true browser fullscreen. The three apps are `transcript-browser` (`TranscriptApp`), `village`
(`CommonsApp`) and `peasant` (`GraphApp`). The old left app-rail is gone.

`TranscriptApp` uses the transcript viewer's split layout: a left outline of user turns, the
centre transcript, and a right filters rail. `AsciiImage` takes a `fit` prop and derives its ink
from the resolved theme, so there are no black wells and nothing is invisible in light mode; card
thumbnails adapt to the theme the same way.

## doc-primitive conventions

Documentation sections are assembled from a small set of plain-JSX/CSS primitives. All share:
square corners (radius 0 everywhere), hairline `--bd` borders, lowercase mono chrome, amber
accent, tabular numbers, left alignment, the global focus ring, no shadows (the faint amber
`--glow` on bold/headings is the only depth), no rounded pills, no gradients.

- **`.band`** — the section shell: `<section class="band" id="…">` → `<h2 class="label">` (title)
  → `<div class="sub">` (one subtitle) → body. Nothing above the title.
- **`.specimen`** — the frame a live example sits in: `--surface` body with a `.specimen-bar`
  strip (`.specimen-cap` caption, e.g. `example`) on `--surface-2`.
- **`.cmp`** — do / don't comparison pairs. Two cards (`.cmp-do` / `.cmp-dont`), each a
  `.cmp-tag` (lucide `check` in `--olive` for do, `x` in `--clay` for don't — meaning never relies
  on color alone), `.cmp-body`, and a `.cmp-note` rule line.
- **`.dtable`** (wrapped in `.dtable-wrap` for `overflow-x`) — the reference table: `.dt-name`
  token, `.dt-val` value (tabular), `.dt-role` role. This is what color, spacing, motion, tokens
  and component spec tables use.
- **`.callout`** — a short amber-tinted note for an a11y contract or a hard rule; leads with a
  lucide icon.
- **`.copy-token`** — the inline copy affordance on token rows. A `clipboard` icon button, square,
  `--target-min`, borderless until hover; on click `App.jsx`'s delegated handler copies the
  `data-copy` value, swaps to a `check` for ~1.2s, and fires the toast (`copied …`). `aria-label`
  is set automatically from `data-copy` by the mount-time `labelIconA11y` pass.

## tokens (quick map)

All tokens live in `src/index.css` `:root` (dark default) with a `[data-theme="light"]` override
block. Names are stable across the three apps; only values and fonts change.

- **spacing** `--sp-1..8` = 4 / 8 / 12 / 16 / 24 / 32 / 40 / 56.
- **type** `--fs-label:14` `--fs-sm:14` `--fs-body:16` `--fs-md:18` `--fs-lg:22` `--fs-xl:28`
  `--fs-hero:40` `--fs-display:52`, hard floor `--fs-min:16`; group/section/sub sizes are
  `clamp()`ed.
- **icons** `--ic-sm:14` `--ic-md:16` `--ic-lg:18`; control height `--control-h:36`.
- **radius** 0 everywhere; borders are one hairline `--bd` plus `--bd-strong`.
- **color** `--canvas` / `--surface` / `--surface-2` / `--surface-hover`; ink ramp
  `--ink` / `--ink-2` / `--ink-3` / `--ink-4` (and `--ink-5`); `--rule` / `--rule-strong`; amber
  set `--amber` / `--amber-bright` / `--amber-dim`; earthy accents `--teal` / `--olive` / `--clay`
  / `--mauve`; diff `--add-*` / `--del-*`. Light `--canvas` / `--surface` are `#fbfaf7` / `#fdfcfa`.
- **z-index** `--z-*` scale; **motion** `--dur-1..3` (all ≤ 200ms) plus `--dur-entrance:900ms`
  (one-shot hero/section reveal, off under reduced-motion).
- **fonts** Atkinson Hyperlegible Mono (`--font-display` and `--font-mono`) and Atkinson
  Hyperlegible (`--font-body`), both from Google Fonts in `index.html`.

There is no `--mark` token and no `--tb-*` tokens in this repo.

## gates

All green. `pnpm build` runs `scripts/contrast.mjs` (pure-JS WCAG contrast over both themes;
functional borders / icons / focus ≥ 3:1, text ≥ 4.5:1) then `vite build`. `scripts/validate.mjs`
is a 20-check puppeteer gate (icons painted, one h1, heading outline, copy-tokens labelled,
decorative icons `aria-hidden`, scroll-spy, the zone header gating, the command palette, dialog
focus-trap, theme toggle, 0 overflow at 360/390/768/1024/1440, reduced-motion, no console errors).
`build-storybook` plus `scripts/sbsmoke.mjs` load every story including `play()` with 0 real
errors. QA-only puppeteer
helpers: `findover`, `shoot` (uses `?cap`), `shootdemo`, `viewport`, `imgdiff`, `diag`, `fullpage`.
CI is `.github/workflows/ci.yml` (4 gates) plus `deploy.yml` (GitHub Pages, nesting storybook into
`dist/storybook`).

## writing rules (for editing the docs)

Clear, plain prose; accurate to the code; invent nothing. Prefer hyphens over em dashes and avoid
middot separators (the system bans them). Chrome copy is lowercase mono; reading prose is
sentence-case and literal. Keep examples in real data vocabulary (providers, turns, tokens,
redaction states, collectives).
