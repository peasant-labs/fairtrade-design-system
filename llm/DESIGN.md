# unified visual identity

> **Current state + roadmap: [`HANDOFF.md`](./HANDOFF.md)** (the single entry point). This file is the
> stable system reference (tokens, principles, voice, component families). For how the presentation page
> is built (IA, the on-this-page rail, the doc-primitives), see [`PRESENTATION.md`](./PRESENTATION.md).

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
- **brand marks:** real claude / gemini / opencode / cursor logos, colored via `currentColor`. The path data **originates from [Simple Icons](https://simpleicons.org)** but is **inlined** as `<symbol id="b-claude" | "#b-gemini" | "#b-opencode" | "#b-cursor">` in `src/sections-react/00-defs.jsx` and referenced with `<use href="#...">`. Simple Icons is not a package dependency. (No official OpenAI mark exists; codex falls back to a neutral ink glyph.)

### procedural + filtered ascii imagery (display surfaces only)
Procedurally generated and image-filtered ascii is a deliberate centerpiece, restricted to a few
low-traffic, full-screen or thumbnail display surfaces. It is rendered at runtime by `src/effects.jsx`:

- **hero crop:** an ascii-filtered wheat **video** (`src/assets/wheat.mp4` via `AsciiVideo`) fills the first screen.
- **hero wordmark:** procedural ascii **roots** (`AsciiRoots`) grow out of the crop's base toward the "fairtrade" wordmark (the wordmark itself is set in the system display font, not ascii).
- **philosophy field:** a tiled field of about 30 ascii portraits (`AsciiImage`) on the dark ground, revealed only inside a cursor-following spotlight behind the centered statement.
- **card thumbnails:** `AsciiImage` portraits in the transcript/collective card thumbs.

`AsciiImage` has a `fit` prop and derives its ink from the resolved theme (no black wells, readable in
both themes). Dense, high-traffic reading views (a transcript) stay icon-light: no ascii art there.

---

## hero / brand mark

- The **hero** is the ascii wheat **video**: `src/assets/wheat.mp4` rendered through `AsciiVideo` (see `App.jsx`). Screen 1 is the crop alone; screen 2 grows ascii roots out of its base down into the "fairtrade" wordmark, as one continuous piece (no second/duplicate video).
- The only **inline brand glyph** is `#logo`, a small 5-path stalk `<symbol>` defined in `src/sections-react/00-defs.jsx`. It is used by the nav brand, the footer, and the in-use banner via `<use href="#logo">`. It is not the wheat video and not an external asset.

---

## component families

Ported from the three apps and unified. The live reference is the running page; each family is one
section component. See `src/sections-react/*.jsx` (foundations + most components), `src/ComponentSections.jsx`
(data-table, pagination, accordion, timeline, toast, date-range), and the Hero/Philosophy/Cards defined
inline in `src/App.jsx`. `index.html` is just `<div id="root">`.

- **nav** (`01-nav.jsx`) fixed, sticky. Brand + `#logo`, nav links (active gets a `>` affordance + amber color), search affordance (cmd-k), live status indicator, theme toggle.
- **controls** (`34-controls.jsx`) buttons (primary / secondary / ghost / danger; sm / md / lg / icon), inputs, select, checkbox, all one height.
- **chips & badges** (`42-badges.jsx`) provider marks, outcome states (redacted / partial / failed), token & duration badges (mono, tabular).
- **trails** (`44-trails.jsx`) breadcrumb, step indicator (wizard), tabs (active underline + count), pagination. *Orientation lives here.*
- **cards & rows** (Cards in `App.jsx`) transcript card with ascii thumb, collective card, compact rows.
- **conversation window** (`48-conversation.jsx`) the transcript reading view: sticky header with breadcrumb + title + meta, role-accented turns (user = teal, assistant = amber, each led by an icon), collapsible tool-call rows with tool icons, thinking blocks, unified diff (rail + gutter + sign), code blocks, a persistent footer action bar.
- **canvas** (`50-canvas.jsx`) the map/graph surface: dot-grid background, square nodes (intensity fill, selected = amber), orthogonal structure edges + dashed activity edges, persistent zoom controls, minimap, activity time-strip.
- **dialog / overlays** (`54-overlays.jsx`) scrim + bordered card, header / body / footer, primary action bottom-right.
- **forms & empty states** (`52-forms.jsx`) filter sidebar, form fields, empty state (icon ring + title + body + action).
- **data families** (`ComponentSections.jsx`) data-table, pagination, accordion, timeline, toast, date-range.
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

## rollout

The multi-app rollout (single shared token package; fan the system across peasant / village /
transcript-browser) is gated on owner approval and lives in [`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md)
and [`HANDOFF.md`](./HANDOFF.md). Stay inside unified-identity until then.
