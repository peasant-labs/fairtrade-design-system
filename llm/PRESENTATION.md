# fairtrade design system — single-page presentation spec (build-ready)

> **Status (2026-06-17):** this presentation is BUILT and interactive (22 sections, command palette, dialog,
> tablists, menus). The hero, scroll behaviour, value-prop, and per-section layout are being revised per
> [`NEXT_PHASE.md`](./NEXT_PHASE.md); `src/gallery.html` (referenced below) was removed, superseded by the
> `src/sections/*` partials. Read this for the IA + doc-primitive conventions.

This is the build spec for turning the existing component gallery (`src/gallery.html` + `src/App.jsx`) into a top-tier, single long-scroll design-system presentation, modeled on wise.design's structural polish but fully bound to the locked fairtrade identity. It does **not** propose multi-page. It adds the in-page devices that make one scroll read like a serious docs site.

Everything below is expressed in our existing primitives: `.band` sections, `.label`/`.sub`, `.framed` HUD corners, the `>` active-nav marker, the `--sp-*` / `--fs-*` / color tokens already in `src/index.css`. Where a new primitive is needed, it is named and specced. All chrome copy is lowercase mono; all examples use real data vocabulary (providers, turns, tokens, redaction states, collectives).

---

## 0. global frame (applies to the whole page)

- **Two persistent chrome bars, full-bleed:** the existing sticky `.nav` (top, `--nav-h` 56) and sticky `.foot` (bottom). Both stay. Content column stays `--maxw` 1040 centered via the `section` rule.
- **New: a third persistent device — the on-this-page rail** (see §2), docked left of the content column on wide viewports, collapsed into nav on narrow.
- **Breadcrumb/orientation is page-global.** The nav's left zone already carries `fairtrade` + wheat logo; add a live in-nav crumb that mirrors the active section (e.g. `fairtrade / foundations / color`) using the existing `.crumb` primitive, driven by the same scroll-spy as the rail. This is the single source of "where am i" at any scroll position (principle 2).
- **One H1 only** (the intro value-prop). Every group opener is the existing `.group h2`; every section is `.band > .label`. Do not introduce competing display sizes.
- Anti-slop is enforced everywhere: no em dashes, no middots, no buzzwords, no "not X but Y", no `//`, no `>` except the single active-nav marker, no eyebrow labels above a heading, no decorative captions under imagery.

---

## 1. PAGE IA — exact ordered section list

Three meta-zones: **intro**, **foundations** (group), **components** (group), then **system/resources**. Each `section.band` keeps the `label` + optional `sub` contract (title + one subtitle, nothing above, nothing below the art).

### intro zone (no group opener)
1. **hero** (`#top`) — full-screen wheat-ascii splash + wordmark. First impression; sets the terminal identity. *(keep, upgrade per §5)*
2. **intro** (`#intro`) — the H1 value-prop ("receipts for agentic work, kept low to the ground") + two primary actions. States what the system is for.
3. **start here** (`#start`) — *new, short.* one paragraph + a 3-item index ("foundations / components / using the system") with anchor links. Orients a first-time reader before the long scroll, like a docs landing.

### group: foundations — "the principles, type, color and controls everything is built from"
4. **principles** (`#principles`) — the 6 rules every screen follows. *(keep the existing `.principles` grid.)*
5. **voice** (`#voice`) — *new.* the anti-slop / copy rules, shown as a do/don't comparison (see §4). Makes the writing discipline a first-class foundation.
6. **color** (`#color`) — palette as a **token-table-with-swatch** (upgrade the current `.swatches` strip, §4), grouped: canvas/surface ramp, ink ramp, rules, amber set, earthy accents, diff add/del. Each row shows swatch + token name + role + hex (both themes).
7. **typography** (`#type`) — the two Atkinson faces + the type scale. *(keep `.type-faces` + `.type-scale`; add px/token/use columns already present.)*
8. **spacing & layout** (`#spacing`) — *new.* the 4/8 scale (`--sp-1`…`--sp-8`) as a visual ruler + a token table; the `--maxw` column, `--gutter`, control heights, row-height options. This is a standard top-system foundation we lack.
9. **iconography** (`#icons`) — *new.* Lucide UI set (sized `--ic-sm/md/lg`), Simple Icons brand marks (claude/gemini/opencode/cursor + codex fallback), the wheat brand logo. Shows stroke/size rules and the "icons lead data" principle. We have icons everywhere but no foundation page for them.
10. **motion** (`#motion`) — *new, short.* the static-first rule: `--motion-base` 0ms, 150–200ms only under `prefers-reduced-motion: no-preference`, reduced-motion is the base. One small live toggle/specimen. Elevates the system; currently undocumented.
11. **controls** (`#controls`) — buttons (primary/secondary/ghost/danger; sm/md/icon) + inputs/select/checkbox, all one height. *(keep; this is the first section to get FULL component-anatomy treatment, §3.)*

### group: components — "everything we build with, ported from peasant, village & the transcript viewer"
12. **badges, providers & states** (`#badges`) — provider chips + outcome states (redacted/partial/failed) + token/duration/turn badges. *(keep; medium depth.)*
13. **trails & tabs** (`#trails`) — breadcrumb, step wizard, tabs+count, pager. "orientation lives here." *(keep; medium depth.)*
14. **cards & rows** (`#cards`) — transcript card + collective card + compact rows with ascii thumbnails. *(keep, from `App.jsx Cards`; FULL treatment.)*
15. **conversation window** (`#conversation`) — the transcript reading view: phases, role-tinted turns, tool calls, subagents, diffs, checkpoints, footer action bar. *(keep; FULL treatment — this is the system's centerpiece.)*
16. **canvas & dialog** (`#canvas`) — the map/graph surface + a modal. *(keep; medium depth.)*
17. **forms, filters & empty states** (`#forms`) — create-collective form, filter sidebar, empty state. *(keep; medium depth.)*

### group: using the system — "how to build on it without breaking it"
18. **accessibility & neuroinclusive** (`#a11y`) — *new, FULL.* the baked-in defaults (16px floor, 1.5 line-height, 66ch measure, ≥3:1 borders, global focus ring, ≥24/44px targets, tabular numbers, static-first). Reframed from `NEUROINCLUSIVE.md` as a presentation section. This is the single biggest "top-tier" addition.
19. **tokens reference** (`#tokens`) — *new.* one consolidated, searchable-feeling table of every token (spacing, type, color, control, motion) with name + value(dark) + value(light) + role + copy affordance. The canonical reference.
20. **resources** (`#resources`) — *new, short.* repo link, the three apps (peasant/village/transcript-browser), how token names are preserved across apps. Replaces a thin footer-only ending.

> Sections marked FULL (controls, cards, conversation window, accessibility) get the complete anatomy in §3. Everything else gets the lighter treatment. We apply editorial depth **with restraint** — not every section earns do/don't + anatomy.

---

## 2. ON-THIS-PAGE RAIL (sticky section index + scroll-spy)

A sticky left rail that is the page's table of contents, styled to the terminal identity. Adapted from the standard docs "on this page" pattern but bound to lowercase mono chrome and the `>` marker.

**Placement & behavior**
- `position: sticky; top: calc(var(--nav-h) + var(--sp-5))`, left of the `--maxw` content column. On viewports below ~1240px it collapses into a `⌘k`-adjacent "on this page" disclosure in the nav (do not let it crowd the content measure).
- Two-level list mirroring the IA: group labels (`foundations`, `components`, `using the system`) as non-clickable section dividers; section names as anchor links.
- **Scroll-spy:** one `IntersectionObserver` (reuse the pattern already in `App.jsx`, `rootMargin: '-45% 0px -50% 0px'`, pick the topmost intersecting `.band`/`.group`). The active section also updates the in-nav crumb (§0).

**Visual spec (identity-bound)**
- Font: `font-mono`, `--fs-label` (14), lowercase, `--ink-3` default.
- **Active item:** color `--amber`; prefix the existing active-nav affordance `> ` rendered in `--amber-dim` via `::before` (the *only* place `>` is allowed besides nav — reuse the exact rule, do not invent a new marker). On dark, the active label carries the faint amber `text-shadow: var(--glow)`.
- **Hover (inactive):** `--ink-3` → `--ink`, no underline (chrome links stay clean; dotted-underline is reserved for in-prose links).
- A 1px `--rule` hairline runs the full height of the rail on its right edge (hairline, not a heavy bar — no accent bars on titles, that rule was rejected before).
- Group dividers: `--ink-4`, smaller, with `--sp-4` top margin. No icons on rail items (no decorative icons on nav-like chrome).
- Focus: inherits the global `:focus-visible` 3px ring.
- Respect reduced-motion: anchor jumps use `scroll-behavior` already gated by the reduced-motion base; no spy-driven animation.

**Do-not:** no progress bar fill, no dot/line "stepper" decoration, no numbered TOC, no pill/rounded active background (radius 0; active state is color + the `>` marker only).

---

## 3. SECTION ANATOMY

Two canonical internal structures. The outer shell is always: `section.band` → `.label` (title) → optional `.sub` (one subtitle) → body. Nothing above the title, nothing below the section's content.

### 3a. COMPONENT section (full treatment)
Order is fixed so every full component reads the same way:

1. **overview** — `.label` title + `.sub` one-liner (already exists). One short prose paragraph (proportional body, capped at `--measure-prose`) stating what it is and when to use it. No buzzwords.
2. **live specimen** — the component rendered for real inside an **example/specimen frame** (§4) on the `--surface` canvas, with the `.framed` HUD corners where it's a window/canvas/dialog. This is the hero of the section.
3. **anatomy** — the same specimen (or a simplified instance) with **anatomy callouts** (§4): numbered hairline leader lines to a lowercase mono legend listing each part (e.g. for conversation window: `phase divider`, `role tag`, `turn body`, `tool-call header`, `diff rail/gutter/sign`, `checkpoint marker`, `footer action bar`).
4. **variants/states** — a small grid of the component's states (e.g. button: default/hover/focus/disabled/loading; chip: redacted/partial/failed). Each labeled in mono lowercase beneath.
5. **do / don't** — one **do/don't comparison** pair (§4) capturing the single most important usage rule for that component. Only where there's a real rule worth stating; skip if forced.
6. **specs & tokens** — a **spec table** + a **token table** (§4): the exact tokens the component consumes (control height, padding, border, accent), so a builder can rebuild it.
7. **accessibility note** — a short `.callout` (reuse existing `.callout`) listing the a11y contract for that component (target size, focus, color-independent meaning, tabular numbers). Two or three lines, not a wall.

> Apply ALL seven blocks only to: **controls, cards & rows, conversation window**. These are load-bearing and rebuilt most often.

### 3b. COMPONENT section (medium treatment)
For **badges, trails & tabs, canvas & dialog, forms/filters/empty**: blocks 1 (overview), 2 (live specimen), 4 (variants/states), and a one-line accessibility note. Skip anatomy callouts and do/don't unless a specific rule demands it. Keeps depth without bloating the scroll.

### 3c. FOUNDATION section
Order:
1. **overview** — `.label` + `.sub` + one prose paragraph stating the rule.
2. **specimen** — the foundation shown directly: color = swatch grid; type = scale ladder; spacing = visual ruler; icons = icon grid; motion = one toggle demo.
3. **reference table** — the **token-table-with-swatch** (color) or plain **token table** (spacing, type, motion, control) with name + value(s) + role + copy affordance.
4. **rule note** — at most one `.callout` for the hard floor (e.g. "never render reading text below 16px"; "radius is 0 everywhere"). Foundations rarely need do/don't; use it only for **voice** and **accessibility**, where the contrast is the point.

Foundations that get the **full** table treatment: **color, spacing & layout, tokens reference, accessibility**. Lighter (specimen + short note): **principles, motion, iconography**.

---

## 4. DEVICE CATALOG (reusable doc-primitives to build)

Each is radius 0, hairline `--bd` borders, amber accent, mono lowercase chrome, ≥3:1 functional contrast, anti-slop copy. Build these once as classes; reuse across sections.

**`.specimen` — example/specimen frame**
The container every live example sits in. `background: var(--surface)`; `border: var(--bd)`; radius 0; padding `--sp-5`. A thin top strip (`--surface-2`, `border-bottom: var(--bd)`) holds a lowercase mono caption on the left (e.g. `example`) and, on the right, optional controls: a theme-peek toggle and a "copy markup" affordance. When the example is a window/canvas/dialog, add `.framed` for the amber HUD corners. No drop shadows (glow only, dark-only, on bold/headings — not on frames).

**`.cmp` — do / don't comparison cards**
A two-column grid (`cols-2`, stacks on narrow). Each card: `border: var(--bd)`, radius 0. Header row = a lowercase mono tag + a Lucide status icon, color-coded but never color-only:
- do: `--olive` text, `check` icon, label `do`.
- don't: `--clay` text, `x` icon, label `don't`.
Body shows the actual rendered thing (good vs bad), then one short prose line explaining the rule. Used in: voice, controls, cards, conversation window, accessibility. *(Off-identity warning: do NOT use red/green saturated fills — use desaturated `--olive`/`--clay` text + icon. Meaning never relies on color alone.)*

**`.anatomy` — anatomy callout**
The specimen with absolutely-positioned numbered markers (`1`,`2`,`3`… in a small `--ink-4` mono badge, square) connected by 1px `--rule` leader lines to a legend list below or beside. Legend: lowercase mono, two columns (number → part name). Numbers are tabular. No curved connectors; orthogonal/straight leaders only (matches the canvas edge style). Used in the three FULL component sections.

**`.token-table` — token table (with optional swatch)**
A left-aligned table, hairline row rules (`border-bottom: var(--bd)`), no zebra fills. Columns: `[swatch] · token · value (dark) · value (light) · role`. The token name is mono in `--ink`; values are mono tabular in `--ink-2`; role is mono `--ink-3`. The swatch cell (color tables only) is a 16×16 square (radius 0, `border: var(--bd)`) filled with the token. Each token row has a **copy affordance** (below). Header row: lowercase mono `--ink-3`, `border-bottom: var(--bd-strong)`. Give the table `overflow-x: auto` (never cap a table at the prose measure).

**`.spec-table` — spec table**
Same table chassis as token-table but for per-component specs: columns `property · value · note` (e.g. `height · 36px (--control-h) · shared with inputs`; `radius · 0 · square`; `min target · 44px · primary`). Tabular numbers. Used in FULL component "specs & tokens" blocks.

**`.props-table` — props table**
Same chassis, columns `prop · type · default · description`, for the componentized API (forward-looking, since `App.jsx` notes components aren't extracted yet). Mono throughout; `type`/`default` tabular where numeric. Include for controls, cards, conversation window at minimum, even if the prop set is provisional — it signals a real system.

**`.copy-token` — copy-token affordance**
A small inline button at the end of any token/spec row and in the specimen strip. Lucide `clipboard` icon at `--ic-sm`, `--ink-3`, no border until hover (then `border-color: var(--amber-dim)`), 24×24 min target (`--target-min`). On click: copies the token name (`--amber`) or value, swaps icon to `check` for ~1.2s, and fires the existing toast pattern (`.fbk-toast`) with lowercase copy like `copied --amber`. Reuse the clipboard logic already in `App.jsx` (`copyMd`). Square, radius 0.

**`.swatch-row` (color specimen)**
Upgrade of the current `.swatches` strip into a labeled row form: square chip + token name + hex, so it reads as documentation, not decoration. Keep the strip view as the "specimen" and the table as the "reference".

All seven devices share: square corners, hairline borders, lowercase mono chrome, left-aligned, tabular numbers, global focus ring, no shadows (glow excepted), no rounded pills, no gradient fills.

---

## 5. HERO + INTRO (keep + upgrade)

**Hero (`#top`) — keep the wheat ascii, raise the craft.**
- Keep `AsciiVideo` of the wheat (`src/assets/wheat.mp4`) as the full-screen splash and the `fairtrade` wordmark. This *is* the identity; do not replace it with a generic gradient hero (that would violate the terminal identity).
- Upgrade: ensure the ascii fills without overflowing the viewport (the open `it_is_still_overflowing` issue) — clamp `cols` responsively and clip overflow. Add the `.framed` amber HUD corners to the hero canvas to tie it to the windows/canvas/dialog language.
- Keep the single lowercase `scroll` affordance anchoring to `#intro`. No kicker above the wordmark, no caption below the art.
- Dark is the splash default; the wordmark carries the faint amber glow (dark only).

**Intro (`#intro`) — sharpen the value-prop into a top-tier first statement.**
- Keep the H1: `receipts for agentic work, kept low to the ground.` with `agentic work` in `.hl` amber. This is the one H1 on the page.
- Keep the one prose line: `ingest your sessions locally, redact them, and share what's worth sharing.` (proportional body, capped measure). Plain, declarative, no buzzwords.
- Keep ≤2 primary actions (`explore the commons`, `publish a transcript`) — under the ≤5-actions rule.
- **Add a thin orientation handoff:** directly beneath the actions, a quiet mono line `foundations · components · using the system` rendered as three anchor links (no middot — use spacing/`/` not `·`). This is the bridge into the long scroll and previews the rail. *(Correction to the prior instinct: use `/` or whitespace as the separator, never the forbidden middot.)*

---

## 6. WHAT TO ADD (the elevation list)

These are the sections/devices the gallery lacks today that move it from "gallery" to "top design system". Priority order:

1. **on-this-page rail + scroll-spy + in-nav crumb** (§2) — the single biggest structural upgrade; makes one page read like docs.
2. **accessibility & neuroinclusive section** (`#a11y`) — present the baked-in defaults from `NEUROINCLUSIVE.md` as a real section with do/don't and a contract table. Highest-credibility addition.
3. **tokens reference section** (`#tokens`) — one consolidated table of every token with copy affordances. The canonical reference a builder reaches for.
4. **spacing & layout foundation** (`#spacing`) — the 4/8 ruler + control heights + measure caps. Standard foundation we're missing.
5. **iconography foundation** (`#icons`) — Lucide + Simple Icons + wheat logo, with size/stroke rules.
6. **motion foundation** (`#motion`) — static-first rule made explicit.
7. **voice / anti-slop section** (`#voice`) — turn the hard copy rules into a do/don't showcase. Few systems show their writing rules; this is a differentiator and self-evidently on-brand.
8. **per-section anatomy + spec/props/token tables** (§3, §4) on the three FULL components.
9. **start here** (`#start`) and **resources** (`#resources`) bookends so the scroll has a real on-ramp and off-ramp.

Build order for the team: devices first (§4, since everything depends on them) → rail + spy (§2) → new foundation sections (spacing/icons/motion/voice) → upgrade existing sections to the anatomy (§3) → accessibility + tokens reference → bookends.

---

## 7. DO-NOT LIST (reference patterns that violate our identity)

Patterns common in polished design-system sites that builders must NOT copy here:

- **No rounded cards / pills / chips.** Radius is 0 everywhere. Wise-style soft cards are off-identity. Active rail/nav state is color + `>` marker, never a rounded background.
- **No gradients, no glassmorphism on content, no drop shadows.** The only depth is the faint amber `--glow` on bold/headings, dark-only. (The nav's existing backdrop-blur stays; don't extend blur to cards.)
- **No playful / saturated color.** Accents stay desaturated and earthy (`--amber`, `--teal`, `--olive`, `--clay`, `--mauve`). Vivid reads as cheap. Do/don't never uses bright red/green — use `--clay`/`--olive` text + icon.
- **No second display typeface, no large light-weight type.** All chrome/headings are Atkinson Hyperlegible Mono, lowercase, 700 on headings. Proportional Atkinson is for reading prose only.
- **No color-only meaning.** Every state pairs an icon or label with color (redacted/partial/failed all carry a Lucide icon).
- **No decorative scroll devices:** no progress-bar reading indicator, no numbered TOC, no animated step connectors, no parallax. Scroll-spy updates color + the `>` marker, nothing more.
- **No eyebrow/kicker labels above any heading. No accent bar under titles** (explicitly rejected before). No `//` comment markers. No `>` prompt prefixes anywhere except the one active-nav/rail marker. No middot `·` and no em dash `—` separators — use `/` or whitespace.
- **No decorative captions under imagery** (no museum-plate credits under the ascii art). A section is title + one subtitle at most.
- **No motion-by-default.** Reduced-motion is the base; any reveal/transition is gated behind `prefers-reduced-motion: no-preference` and stays 150–200ms.
- **No uncapped prose, no justified text, no centering of body copy.** Everything left-aligned; prose capped at `--measure-prose` (66ch); tables/code get their own `overflow-x` and are never capped.
- **No hand-drawn ASCII UI ornament.** Vector icons only. The ascii effect is reserved for imagery (wheat hero, peasant-portrait thumbnails), never for building UI glyphs.
- **No more than 5 primary actions per view**, and the hero/intro keep ≤2.

---

**Files this spec touches on build:** section markup in `src/gallery.html`; the hero/intro/cards React in `src/App.jsx`; new device classes + rail + scroll-spy styles in `src/index.css`; tokens already defined there are the source of truth for every table. Source material for the new sections: `llm/NEUROINCLUSIVE.md` (accessibility), `llm/DESIGN.md` (voice, foundations), and the `:root` token block in `src/index.css` (tokens reference).