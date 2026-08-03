# unified visual identity

This is the stable system reference: tokens, principles, typography, iconography, voice, and the
component families. It is the design source of truth; the code (`src/index.css`, `src/ui/*`) implements
it and the generated `public/tokens.json` / `public/components.json` mirror it for machine consumers.

One design system, called **fairtrade**, for **peasant** (local web), **village** (the commons), and
**transcript-browser** (the shared viewer). The live reference is the single-page presentation site:
`pnpm install && pnpm dev` (Vite + React + Tailwind v4), then use the dark/light toggle.

> **Read [`NEUROINCLUSIVE.md`](./NEUROINCLUSIVE.md) alongside this.** Because this is a data-heavy
> product, the system is **neuroinclusive by default** (dyslexia / ADHD / autism / low-vision), not via
> an accessibility toggle. Those rules (16px text floor, 1.5 line-height, capped prose measure, prose
> tracking with mono kept tight, functional borders at least 3:1, a global focus ring, static-first
> motion, warm-paper light canvas, at most 5 actions, progressive disclosure, persistent orientation,
> tabular data) are baked into the tokens and base layer here and **govern every component**.

---

## philosophy

Read this first. Everything below serves these principles.

1. **styled, but functional.** Craft serves use. Every visual choice earns its place by improving legibility, orientation, or speed, never decoration for its own sake. When in doubt, remove it.
2. **the user always knows where they are.** Regardless of scroll position, orientation is never lost: a fixed/sticky top nav, sticky section and conversation headers, and an origin-aware breadcrumb trail are always present. Navigating back restores scroll and state.
3. **tools stay on screen.** The controls a user needs for the current surface remain visible. Action bars, rails, and toolbars don't disappear on scroll. Reaching a tool should never require hunting.
4. **everything is aligned, and left-aligned.** One vertical axis. Labels, values, and content share a left edge. Numbers are tabular. Nothing floats arbitrarily; everything sits on the 4/8 spacing grid.
5. **glanceable.** Functional iconography carries meaning at a glance: providers, tools, states, and nav all lead with a real vector icon. Icons make a dense screen scannable in a fraction of a second.
6. **readable first.** Calm contrast, generous-but-not-loose line height, body type that never drops below the 16px floor. Monospace is reserved strictly for code and chrome.
7. **maximize usability.** Usability beats flourish at every fork. Hit targets are comfortable, states are obvious, motion is minimal, contrast meets WCAG AA in both themes.

---

## foundations

### themes (two, only)
- **dark** is the default: deep, neutral-warm near-black.
- **light** is genuinely white, low-chroma, a real second mode, not a tint.

Both are token-driven. The same component renders correctly in either by swapping CSS variables. Glow
is dark-only. Light canvas/surface are `#fbfaf7` / `#fdfcfa`.

### color tokens
| token | role |
|---|---|
| `--canvas` / `--surface` / `--surface-2` / `--surface-hover` | page bg, panels, elevated, hover |
| `--ink` / `--ink-2` / `--ink-3` / `--ink-4` / `--ink-5` | primary, secondary, tertiary, faint-but-text-safe, decoration-only |
| `--rule` / `--rule-strong` | hairline structural divider, functional control border |
| `--amber` (primary accent) / `--amber-bright` / `--amber-dim` | action, highlight, glow |
| `--teal` / `--olive` / `--clay` / `--mauve` | desaturated tile accents: user/info, success/add, danger/del, system |
| `--add-*` / `--del-*` | diff add/del bg, text, rail |

There is no `--mark` token and no `--tb-*` tokens in this repo. Accents are **desaturated and earthy**;
vivid reads as cheap. Semantic meaning never relies on color alone; it always pairs with an icon or
label. `--ink-4` is the faintest text-safe ink (at least 4.5:1); `--ink-5` and `--rule` are
decoration/structure only. `--rule-strong` is the functional control border (at least 3:1).

### spacing & structure (standardized)
- **spacing scale:** 4, 8, 12, 16, 24, 32, 40, 56 (`--sp-1` through `--sp-8`). Every padding, margin, and gap uses it.
- **radius:** `0` everywhere. Square, editorial.
- **borders:** one `--bd` (1px `--rule`) hairline; `--bd-strong` for functional/emphatic edges. No shadows except a faint amber glow on bold/headings (dark only).
- **controls:** buttons and inputs share one height (`--control-h`, 36px) and identical padding.
- **z-index:** a single named scale, `--z-sticky` < `--z-nav` < `--z-dropdown` < `--z-dialog` < `--z-toast` < `--z-tooltip`.
- **breakpoints (desktop-first):** one scale - `xs` < 480 (phone), `sm` 480-767 (large phone / small tablet), `md` 768-1023 (tablet), `lg` 1024-1439 (laptop), `xl` >= 1440 (desktop). Desktop is the canonical, base layout; narrower widths **adapt down** with `max-width` queries off this scale. The majority of users are on desktop; mobile *complements* it and must stay overflow-free, legible, and tappable from 320px up, but the desktop layout is never compromised to serve mobile.

---

## typography

- **display + chrome + code:** Atkinson Hyperlegible Mono (`--font-display` and `--font-mono`). The fixed-width face carries the ascii/terminal identity (headings, nav, labels, chips, buttons, code).
- **reading prose:** Atkinson Hyperlegible proportional (`--font-body`), for long-form body text only (paragraphs, descriptions, transcript bodies).
- Both faces load from Google Fonts in `index.html`.
- **scale (`--fs-*`):** label 14, sm 14, body 16, md 18, lg 22, xl 28, hero 40, display 52. Body line-height is ~1.5. The body floor is **16px** (`--fs-min`); nothing readable drops below it.
- **case:** UI chrome is all-lowercase (nav, labels, buttons, headings). **Never lowercase user content**: usernames, transcript text, collective names, and code keep their case.
- **bold** earns a small amber "terminal glow" (dark theme only).
- **numbers** are tabular (`tnum`) in any column, stat, count, or duration.

---

## iconography & imagery

The system runs a deliberate **two-tier** policy. Functional chrome is vector-only; ascii imagery is a
controlled centerpiece on a handful of low-traffic display surfaces. The two never mix on one element.

### functional UI / chrome / tools / status / nav (vector only)
- [Lucide](https://lucide.dev) (`lucide-react`), one family, consistent stroke and sizing tokens (`--ic-sm` 14 / `--ic-md` 16 / `--ic-lg` 18).
- These carry **no** ascii. Tools, states, roles, breadcrumbs, controls, and nav all lead with a real lucide glyph.
- **brand marks (the brand-logo rule):** when the UI names a company or provider, it **leads with
  that company's real brand mark, never a generic stand-in glyph** (a robot, a git fork, an eye). A
  real mark identifies the provider at a glance; a generic glyph identifies nothing. Marks are
  claude / gemini / openai / cursor / opencode / strike, single-color via `currentColor` (so they re-theme
  on `[data-theme]`), sized off the icon tokens.
  - In the **component library** (`src/ui`), use the self-contained `<BrandMark name="claude" />`
    (aliases resolve: `anthropic`->claude, `google`->gemini, `codex`->openai). It inlines the paths
    so it needs no document-global symbol sheet. `<Tag brand="claude">claude-code</Tag>` is the tag
    shorthand. A mark beside its visible name is decorative; a mark that stands alone as the identity
    passes `label`.
  - In the **presentation page** the marks used there are inlined once as `<symbol id="b-claude" | b-gemini
    | b-opencode | b-cursor>` in `src/sections-react/00-defs.jsx` and referenced via `<use href="#...">`.
  - **provenance + trademark:** Claude, Gemini, OpenAI, Cursor, and opencode path geometry **originates
    from [Simple Icons](https://simpleicons.org)** (CC0; not a package dependency, inlined). Strike's
    geometry is copied unchanged from its [official project favicon](https://github.com/jonathanung/strike-cli-web/blob/9e9550487b0306958baeff83a8ddfe483c42aa7d/public/favicon.svg).
    The [canonical Strike project](https://github.com/jonathanung/strike) is Apache-2.0 licensed, and the
    project has granted permission for this use of its brand mark. Every mark stays small, single-color,
    undistorted, and paired with its provider name
    for nominative identification, never implying endorsement. `opencode`'s mark is provisional upstream;
    be ready to swap or drop it.

### procedural + filtered ascii imagery (display surfaces only)
Procedurally generated and image-filtered ascii is a deliberate centerpiece, restricted to a few
low-traffic, full-screen or thumbnail display surfaces. It is rendered at runtime by `src/effects.jsx`:

- **hero crop:** an ascii-filtered wheat **video** (`src/assets/wheat.mp4` via `AsciiVideo`) fills the first screen.
- **brand section:** a dim full-section ascii **soil** texture (`AsciiSoilField`) behind procedural ascii **roots** (`AsciiRoots`) that fan from narrow-at-top to full-width-at-bottom, seeded from the wheat's columns; below them the "fairtrade" wordmark in the system display font (white, not ascii). The soil/roots/wordmark each reveal on scroll-in.
- **philosophy field:** a tiled field of about 30 ascii portraits (`AsciiImage`) on the dark ground, revealed only inside a cursor-following spotlight behind the centered statement.
- **card thumbnails:** `AsciiImage` portraits in the transcript/collective card thumbs.

`AsciiImage` has a `fit` prop and derives its ink from the resolved theme (no black wells, readable in
both themes). Dense, high-traffic reading views (a transcript) stay icon-light: no ascii art there.

---

## hero / brand mark

- The **hero** is the ascii wheat **video**: `src/assets/wheat.mp4` rendered through `AsciiVideo` (see `src/App.jsx` and `src/effects.jsx`). Screen 1 is the crop; screen 2 (`#brand`) is a dim ascii soil field with roots fanning down into the "fairtrade" wordmark, each layer revealing on scroll-in. The wheat video seeds the roots (`onColumns` -> `seeds`); the roots grow down with a per-branch staggered morph and only then does the wordmark wipe in.
- The only **inline brand glyph** is `#logo`, a small 5-path stalk `<symbol>` defined in `src/sections-react/00-defs.jsx`. It is used by the nav brand and the in-use banner via `<use href="#logo">`. It is not the wheat video and not an external asset.

---

## component families

The component **library** is `src/ui/*.jsx` (24 families, imported from the `src/ui` barrel, each with a
colocated `*.stories.jsx` in Storybook and a generated entry in `public/components.json`). The presentation
page renders the same system: `src/sections-react/*.jsx` (foundations + showcase), `src/ComponentSections.jsx`,
and Hero/Philosophy/Cards inline in `src/App.jsx`. Components emit token-styled classes from `src/index.css`.

- **nav** (`01-nav.jsx`) fixed, sticky. Brand + `#logo`, nav links (active gets a `>` affordance + amber color), search affordance (cmd-k), live status indicator, theme toggle.
- **controls** (`34-controls.jsx`) buttons (primary / secondary / ghost / danger; sm / md / lg / icon), inputs, select, checkbox, all one height.
- **chips & badges** (`42-badges.jsx`) provider marks, outcome states (redacted / partial / failed), token & duration badges (mono, tabular).
- **trails** (`44-trails.jsx`) breadcrumb, step indicator (wizard), tabs (active underline + count), pagination. *Orientation lives here.*
- **cards & rows** (Cards in `App.jsx`) transcript card with ascii thumb, collective card, compact rows.
- **conversation window** (`48-conversation.jsx`) the transcript reading view: sticky header with breadcrumb + title + meta, role-accented turns (user = teal, assistant = amber, each led by an icon), collapsible tool-call rows with tool icons, thinking blocks, unified diff (rail + gutter + sign), code blocks, a persistent footer action bar.
- **canvas** (`50-canvas.jsx`) the map/graph surface: dot-grid background, square nodes (intensity fill, selected = amber), orthogonal structure edges + dashed activity edges, persistent zoom controls, minimap, activity time-strip.
- **dialog / overlays** (`54-overlays.jsx`) scrim + bordered card, header / body / footer, primary action bottom-right.
- **forms & empty states** (`52-forms.jsx`) filter sidebar, form fields, empty state (icon ring + title + body + action).
- **data families** data-table (`DataTable.jsx`, TanStack-Table-backed; same markup/classes), pagination, accordion, timeline, toast, date-range.
- **charts** (`ChartBar.jsx` / `ChartLine.jsx` / `Sparkline.jsx`, Recharts-backed + `chart-shared.jsx`) square bars/lines, token series colours via `currentColor`, hairline grid, mono tabular ticks, swatch+label legend, keyboard a11y, static-first. `--chart-*` tokens map to the earth accents.
- **brand marks** (`BrandMark.jsx`) the real provider logos; see the brand-logo rule under iconography.
- **a11y + tokens** (`62-a11y.jsx`, `64-tokens.jsx`) the accessibility notes and the live token reference; copy helpers live in `_tokens.jsx`.

---

## voice & anti-slop

Copy is plain. Strip the AI tells:
- no em dashes; prefer hyphens
- no middot separators
- no buzzwords: delve, leverage, robust, seamless, crucial, elevate, foster, tapestry / landscape / journey, ultimately
- no "it's not just X, it's Y" / "not X, but Y" patterns
- short, declarative, lowercase for chrome

### chrome anti-slop (no fake-terminal decoration)

The mono face already carries the terminal identity. Do not bolt on terminal-vocabulary ornaments; they
read as AI slop, not craft.

- **no `//` comment markers** in the UI. Subtitles, captions, and labels are plain text. `//` is never prepended to anything on screen.
- **no `>` prompt prefixes** on titles, headings, section labels, or list bullets. The only allowed `>` is the active-nav affordance (`.nav-links a.active::before`); that single marker stays, nothing else gets one. Bullets use a plain `-` or a tiny box marker in `--ink-4`/`--ink-5`.
- **no eyebrow / kicker labels** above a heading. Nothing sits above the title.
- **no decorative captions** under imagery (no museum-plate credits, no source lines).
- a section is **title + subtitle at most**: one heading, one optional sub. Nothing above, nothing below the art.

Functional labels are not eyebrows: form-field labels (`name`, `acceptance mode`), control sub-labels
(`default (36px)`), and section titles stay.

---

## scope

The system currently lives in this single repo, where it is both documented (the presentation page) and
implemented (`src/ui/*`). Its shared token package now ships as
`@peasant-labs/fairtrade-tokens`, exporting the canonical `tokens.css`, `tokens.json`, `fonts.css`,
and `preset.css` artifacts generated from this repo. Consumers in peasant / village /
transcript-browser should build against that package for tokens, fonts, and Tailwind aliases while
this repo remains the source of truth for token values and components.
