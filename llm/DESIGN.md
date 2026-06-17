# unified visual identity

> **Current priorities: [`NEXT_PHASE.md`](./NEXT_PHASE.md)** (2026-06-17 direction — ascii hero, snap-scroll,
> value-prop art, 1-column layout, spacing cleanup, interactive use-case mockups) and [`IMPROVE.md`](./IMPROVE.md)
> (quality + coverage backlog). This file is the system reference (tokens, principles, rules).

One design system for **peasant** (local web), **village** (the commons), and **transcript-browser** (the shared viewer). The live reference is the single-page presentation site: `pnpm install && pnpm dev` (Vite + React + Tailwind v4), then use the dark/light toggle. For how that page is built (IA, the on-this-page rail, the doc-primitives), see [`PRESENTATION.md`](./PRESENTATION.md); for the stack and file layout, [`HANDOFF.md`](./HANDOFF.md).

> **Read [`NEUROINCLUSIVE.md`](./NEUROINCLUSIVE.md) alongside this.** Because this is a data-heavy
> product, the system is **neuroinclusive by default** (dyslexia / ADHD / autism / low-vision) — not
> via an accessibility toggle. Those rules (16px text floor, 1.5 line-height, capped prose measure,
> prose tracking with mono kept tight, ≥3:1 functional borders, a global focus ring, static-first
> motion, warm-paper light canvas, ≤5 actions, progressive disclosure, persistent orientation,
> tabular data) are baked into the tokens and base layer here and **govern every component**.

---

## philosophy

Read this first. Everything below serves these principles.

1. **styled, but functional.** Craft serves use. Every visual choice earns its place by improving legibility, orientation, or speed — never decoration for its own sake. When in doubt, remove it.
2. **the user always knows where they are.** Regardless of scroll position, orientation is never lost: a fixed/sticky top nav, sticky section and conversation headers, and an origin-aware breadcrumb trail are always present. Navigating back restores scroll and state.
3. **tools stay on screen.** The controls a user needs for the current surface remain visible — action bars, rails, and toolbars don't disappear on scroll. Reaching a tool should never require hunting.
4. **everything is aligned, and left-aligned.** One vertical axis. Labels, values, and content share a left edge. Numbers are tabular. Nothing floats arbitrarily; everything sits on the 4/8 spacing grid.
5. **glanceable.** Iconography carries meaning at a glance — providers, tools, states, and nav all lead with a real icon. Icons make a dense screen scannable in a fraction of a second.
6. **readable first.** Calm contrast, generous-but-not-loose line height, body type that never drops below 15px. Monospace is reserved strictly for code.
7. **maximize usability.** Usability beats flourish at every fork. Hit targets are comfortable, states are obvious, motion is minimal, contrast meets WCAG AA in both themes.

---

## foundations

### themes (two, only)
- **dark** is the default — deep, neutral-warm near-black.
- **light** is genuinely white, low-chroma — a real second mode, not a tint.

Both are token-driven. The same component renders correctly in either by swapping CSS variables. Glow is dark-only.

### color tokens
| token | role |
|---|---|
| `--canvas` / `--surface` / `--surface-2` / `--surface-hover` | page bg → panels → elevated → hover |
| `--ink` / `--ink-2` / `--ink-3` / `--ink-4` | primary → secondary → tertiary → faint |
| `--rule` / `--rule-strong` | hairline border → emphatic border |
| `--amber` (primary accent) / `--amber-bright` / `--amber-dim` | action, highlight, glow |
| `--teal` / `--olive` / `--clay` / `--mauve` | desaturated tile accents: user/info, success/add, danger/del, system |
| `--add-*` / `--del-*` | diff add/del bg, text, rail |

Accents are **desaturated and earthy** — vivid reads as cheap. Semantic meaning never relies on color alone; it always pairs with an icon or label.

### spacing & structure (standardized)
- **spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 40 · 56 (`--sp-1`…`--sp-8`). Every padding, margin, and gap uses it.
- **radius:** `0` everywhere. Square, editorial.
- **borders:** one `--bd` (1px `--rule`) hairline; `--bd-strong` for emphasis. No shadows except a faint amber glow on bold/headings (dark only).
- **controls:** buttons and inputs share one height (`--control-h`, 36px) and identical padding.

---

## typography

- **display + chrome + code:** Atkinson Hyperlegible Mono. The fixed-width face carries the ascii/terminal identity (headings, nav, labels, chips, buttons, code).
- **reading prose:** Atkinson Hyperlegible (proportional), for long-form body text only (paragraphs, descriptions, transcript bodies).
- **scale:** label 13 · sm 13.5 · body 15 · md 18 · lg 22 · xl 28 · hero 38. Body line-height ~1.5.
- **case:** UI chrome is all-lowercase (nav, labels, buttons, headings). **Never lowercase user content** — usernames, transcript text, collective names, and code keep their case.
- **bold** earns a small amber "terminal glow" (dark theme only).
- **numbers** are tabular (`tnum`) in any column, stat, count, or duration.

---

## iconography & imagery

- **vector only. no hand-drawn ASCII art, ever** — it never aligns and never reads. This was tried and retired.
- **UI / tools / status / nav:** [Lucide](https://lucide.dev) (already a dependency in peasant + village). One family, consistent stroke and sizing tokens (`--ic-sm` 14 / `--ic-md` 16 / `--ic-lg` 18).
- **brand marks:** [Simple Icons](https://simpleicons.org) — real claude / gemini / opencode / cursor logos, colored via `currentColor`. (No official OpenAI mark exists; codex falls back to a neutral Lucide glyph.)
- **brand / hero mark:** the real peasant **wheat** logo (`village/frontend/src/app/icon.svg`), as inline SVG, amber stroke, theme-aware.
- **placement:** imagery (the logo) appears on low-traffic, occasional surfaces — hero, the create-collective form, empty states. Dense, high-traffic reading views (a transcript) stay icon-light; there, icons only mark tools, states, and roles.

---

## component families

Ported from the three apps and unified. See `index.html` for each in context.

- **nav** — fixed, sticky. brand + logo, nav links (icon + label, active gets an amber underline), search affordance (⌘k), live status indicator, theme toggle.
- **controls** — buttons (primary / secondary / ghost / danger; sm / md / lg / icon), inputs, select, checkbox — all one height.
- **chips & badges** — provider marks, outcome states (redacted / partial / failed), token & duration badges (mono, tabular).
- **trails** — breadcrumb, step indicator (wizard), tabs (active underline + count), pagination. *Orientation lives here.*
- **cards & rows** — transcript card, collective card, compact rows.
- **conversation window** — the transcript reading view: sticky header with breadcrumb + title + meta, role-accented turns (user = teal, assistant = amber, each led by an icon), collapsible tool-call rows with tool icons, thinking blocks, unified diff (rail + gutter + sign), code blocks, a persistent footer action bar.
- **canvas** — the map/graph surface: dot-grid background, square nodes (intensity fill, selected = amber), orthogonal structure edges + dashed activity edges, persistent zoom controls, minimap, activity time-strip.
- **dialog / window** — scrim + bordered card, header / body / footer, primary action bottom-right.
- **panels & empty states** — filter sidebar, empty state (icon ring + title + body + action).

---

## voice & anti-slop

Copy is plain. Strip the AI tells:
- no em dashes (—), no `·` middot separators
- no buzzwords: delve, leverage, robust, seamless, crucial, elevate, foster, tapestry / landscape / journey, ultimately
- no "it's not just X, it's Y" / "not X, but Y" patterns
- short, declarative, lowercase for chrome

### chrome anti-slop (no fake-terminal decoration)

The mono face already carries the terminal identity. Do not bolt on terminal-vocabulary ornaments; they read as AI slop, not craft.

- **no `//` comment markers** in the UI. Subtitles, captions, and labels are plain text. `//` is never prepended to anything on screen.
- **no `>` prompt prefixes** on titles, headings, section labels, or list bullets. The only allowed `>` is the active-nav affordance (`.nav-links a.active::before`) — that single marker stays; nothing else gets one. Bullets use a plain `-` or a tiny box marker in `--ink-4`.
- **no eyebrow / kicker labels** above a heading. Nothing sits above the title.
- **no decorative captions** under imagery (no museum-plate credits, no source lines).
- a section is **title + subtitle at most**: one heading, one optional sub. Nothing above, nothing below the art.

Functional labels are not eyebrows: form-field labels (`name`, `acceptance mode`), control sub-labels (`default (36px)`), and section titles stay.

---

## rollout

Single shared `@peasant-labs/theme` token package as the source of truth. Token **names** are preserved across the apps (`--ink`, `--rule`, `--surface`, `--mark`, `--canvas`; `--tb-*` mirror in the viewer), so only **values + fonts** change and existing components reflavor in place. Phase 2 fans the system across every screen in all three apps.
