# ▶ NEXT PHASE — START HERE (priority set 2026-06-17)

> ## ▶ REMAINING WORK (do this next — fresh-context entry point)
> P1–P6 + the LAYOUT_AUDIT + the QA sweep are DONE and merged to `main` (commit `437f3f2`, build green,
> `validate.mjs` 19/19, 0 overflow). Run order for what is left:
> 1. **Quick deferred QA nits** (fast, visible polish) — the "deferred minor QA nits" list near the
>    bottom of this file. A 1-pass workflow (one agent per nit) + re-gate is plenty.
> 2. **tier-2.5 JSX component port** — formalise `Button/Input/Checkbox/Switch/Chip/Card/Tabs/Dialog/Menu`
>    into typed `src/ui/*` components **keeping the existing class names**, then stand up Storybook
>    ([`STORYBOOK_PLAN.md`](./STORYBOOK_PLAN.md)). This is the big structural item; see "carried over" below.
> 3. **more tier-2 coverage** — sortable/selectable data table, numbered pagination, collapsible/accordion,
>    per-tool transcript renderers (some may be subsumed by the P6 transcript-viewer mockup).
> Gates to keep green every pass: `pnpm build` (contrast) + `node scripts/validate.mjs "http://localhost:5180/?fb=off"`
> + `node scripts/findover.mjs <w>` for overflow. Capture QA crops with `node scripts/shoot.mjs <theme> <dir> [ids…]`.
> Dev server: `pnpm dev --port 5180`. Stay in `unified-identity`; unification rollout stays deferred.
>
> **STATUS 2026-06-17 (overnight pass): P1–P6 below are ALL DONE, verified, and gated green** (build +
> contrast gate both themes, `validate.mjs` 19/19, 0 overflow at 360/390/768/1024/1440). The full
> 147-finding [`LAYOUT_AUDIT.md`](./LAYOUT_AUDIT.md) was applied (systemic CSS + one-agent-per-section
> markup pass) and a 25-section dual-theme screenshot QA sweep was run and its real findings fixed.
> The P1–P6 sections below are kept for reference. **What remains is the "carried over" list at the
> bottom plus the deferred-minor nits added there.** Next substantive work = the `src/ui/*` JSX
> component port → Storybook.
>
> This was the current top of the backlog. The owner reviewed the page and set a new direction:
> a distinctive ascii hero, snap-scrolling with creative scroll cues, ascii art in the value-prop,
> calmer 1-column layout, a real spacing/hierarchy cleanup, and **interactive use-case mockups**
> (transcript viewer / commons / chart) at the end so the three apps can be previewed live.
>
> **How to work (required):** use **big agent teams + workflows**, not solo passes. The proven loop on
> this project is *design fan-out (one agent per component/spec) → you integrate the shared files →
> `pnpm build` (contrast gate) → parallel screenshot QA over band crops → fix → `node scripts/validate.mjs`*.
> Verify interactively with the puppeteer harness (`scripts/diag.mjs` / `validate.mjs`), not just static shots.
> Token cost is not a constraint; correctness and craft are. Work in small, verifiable passes.
>
> **State going in (all DONE + verified, build green, 19/19 validation):** tier-1 quality pass; tier-2
> batch 1 (states + overlays + chip depth); a full interactive bug-fix pass (bundled icons, scroll-spy,
> nav-reveal, command palette, responsive overflow, ascii hero v1, animation); and the interactive
> dialog / tabs / dropdown menu. See the session logs in [`IMPROVE.md`](./IMPROVE.md). Architecture +
> gates are summarized at the bottom of this file.

---

## P1 — hero: ascii wordmark, bottom-right, wheat-ramp chars, no container, no alpha

The current hero (`Hero()` in `App.jsx`, `.hero-*` in `index.css`) renders "fairtrade" as solid-block
ascii (`AsciiText`) on a **bordered, semi-transparent, blurred plate**, centered. Redo it:

- **Same characters as the wheat video.** The wordmark must be drawn from the wheat-video ramp,
  `VID_RAMP = " .,-:;=+*vcoxO0Q#%@"` (see `effects.jsx`), NOT the solid `█` blocks `AsciiText` uses today.
  Extend `effects.jsx` (new prop on `AsciiText`, or a new `AsciiWordmark`) so each "on" cell of a glyph
  renders a ramp glyph (a dense one like `#`/`@`, or varied across the ramp for texture so the name reads
  as if drawn in wheat), "off" cells stay blank. It should feel continuous with the wheat field behind it.
- **Position: bottom-right, distinctive.** Absolutely place the wordmark in the bottom-right of the hero
  (with comfortable padding), not centered. This is the signature composition the owner asked for.
- **No container.** Delete `.hero-plate` entirely (the bordered/`framed` box). The wordmark sits directly
  over the video.
- **No alpha.** Remove the plate's `color-mix(... transparent)` background and `backdrop-filter`. No
  transparency in the name treatment. Legibility over the busy video must come from the char density +
  the bottom-right placement (the radial mask already fades the video at the edges, so that corner is
  darker/sparser) + the amber colour and glow — a SOLID knockout or glow, never alpha.
- Keep a tasteful one-time reveal (resolve/typewriter), honour `prefers-reduced-motion`.
- The scroll cue (P2) stays.

**Done when:** "fairtrade" reads as wheat-ramp ascii, anchored bottom-right, no box, no transparency,
legible in both themes (screenshot the real `#top`, no `?cap`).

## P2 — snap scroll + creative scroll-down hints (think hard, this is a signature moment)

The full-screen splash sections (hero, value-prop, and the P6 use-case mockups) should settle with a
**slow, nice snap**; the long doc sections must NOT snap.

- **Snap:** `scroll-snap-type: y proximity` on the scroll root (PROXIMITY, never `mandatory` — mandatory
  traps users inside long sections). `scroll-snap-align: start` + `scroll-snap-stop: normal` only on the
  full-viewport sections (`.hero`, `.intro`, the mockup sections). Pair with the existing
  `scroll-behavior: smooth` for the slow settle. Consider `scroll-padding-top: var(--nav-h)`.
- **Creative scroll-down cue (design it well, on-brand: Caves-of-Qud terminal, wheat, amber):** options
  to prototype and pick from / combine —
  1. **descending grain** — a short vertical run of wheat-ramp glyphs (`· : * # @`) that animate falling
     downward and fade, looping, capped by a `▽` chevron + lowercase "scroll" label. (recommended; ties to the wheat)
  2. **growing wheat stalk** — an ascii stalk that grows down toward the next section, grains appearing one by one.
  3. **morphing ramp char** — one glyph cycling `.`→`-`→`*`→`#`→`@` on a slow loop (a "filling" feeling) above a chevron.
  4. **scroll-progress rail** — a thin amber rail on the right edge that fills as you scroll, with section ticks (also a "where am I").
  5. **next-section peek** — the next heading/art peeks above the fold with a gentle parallax.
  - Make it a real focusable link to the next section (`#intro`), with a keyboard hint (`↓ / space`),
    and a **reduced-motion** static fallback (a plain chevron). No blinking (neuroinclusive).
- Recommended combo: snap (proximity) + the **descending-grain** cue at the bottom of each splash +
  a thin **scroll-progress rail**. Keep it subtle and amber-scarce.

## P3 — value-prop (intro) section: ascii art frames

The second section (`Intro()` — "receipts for agentic work…") is currently text + two buttons in a vast
empty 100vh. Add **ascii-art image frames in the card style**: peasant portraits run through the
`AsciiImage` filter (as `Cards` does — see `src/img/*` + `AsciiImage` usage), in framed/hairline
"art frames" (corner brackets, like `.card-img` / `.framed`). Compose them with the headline (e.g. a
framed ascii portrait or a small strip beside / below the value prop) so the section feels composed,
not empty. Keep one `<h1>`, keep it left-aligned, amber scarce.

## P4 — layout: at most 2 columns, prefer 1

The owner wants **no more than 2 columns of content per specimen, and 1 wherever it reads better**, for
organization and calm. Audit every `.cols-2` / multi-column grid (components, overlays, states, the
side-by-side token tables, the trails 4-up row, etc.) and collapse to a single column unless two columns
genuinely add value. The layout audit (P5) lists the specific offenders. General: single-column,
left-aligned, generous vertical rhythm.

## P5 — spacing + visual hierarchy cleanup

The owner flagged the **typography** section as "messy" and said it is "only one of many with issues".
Do a real pass on spacing rhythm (consistent 4/8 scale, consistent gaps between a section title, its
sub, its prose, and its specimens; consistent inter-section padding) and visual hierarchy (title >
subhead > body must read clearly; type specimens must look organized, baselines aligned).

**Full per-section findings: [`LAYOUT_AUDIT.md`](./LAYOUT_AUDIT.md)** (147 findings — 57 major / 75 minor
/ 15 nit — from the 17-band `ds-layout-audit` workflow, both themes). Re-run that workflow after the pass
to confirm. The systemic patterns (fix these GLOBALLY, then the per-section specifics):

1. **Section-title hierarchy is inconsistent down the page.** Section titles should ALL be one identical
   H2 size and every subhead one identical size/colour — today they drift (and some subheads are tiny).
   Lock `.band > .label:first-child` to a single size (don't let it shrink), and the subheads (`.sub` and
   the in-section sub-labels) to one shared token. Page-title vs section-title vs subhead must be 3 clear tiers.
2. **Vertical rhythm is "tight-then-loose" everywhere.** The title→subhead gap is tight, then subhead→prose
   jumps large; inter-section gaps are oversized (e.g. ~175–195px of dead space before "voice"; big empty
   bands above several titles). Standardise to ONE rhythm: title→subhead `--sp-2/3`, subhead→prose `--sp-4`,
   prose→specimen `--sp-4/5`, and a single consistent band top/bottom padding. Centre each divider rule in
   its whitespace (equal gap above/below).
3. **Collapse multi-column specimens to 1 (P4).** Confirmed offenders: principles (3-up → 1), color swatches
   (6-up → 1 list), the color/spec/token tables shown side by side, iconography icon grid (4-up) + provider
   marks (4-up), typography face specimens (2-up → 1) and the 4-track type-scale rows, controls (2-up, and
   its right column overflows), the 2-up anatomy checklist, and the states caption grid.
4. **Density / wasted space.** Color swatch chips waste ~50% width (tiny square + empty half); several
   bordered panels have large empty bands at the bottom; some token tables have a huge gap between value and
   role. Tighten or restructure.

**Typography is the worst (start here):** 2-up face specimens, 4-track type-scale rows with three competing
metadata clusters (role/px/usage all same size — none wins), specs+tokens tables stacked back-to-back
identical, broken H2→subhead rhythm. Rebuild it as one column with a clear scale and one metadata treatment.

> Tip: do P4 + P5 together as a workflow — one agent per section proposes the restructured markup +
> spacing tokens, you integrate `index.css` + the partials, then re-run `ds-layout-audit` to verify.

## P6 — interactive use-case mockups (the live preview of the three apps)

Add, at the END of the page (a new "in use" group), **fully dynamic, usable mockups** — not static
specimens — so the page previews what the design system builds. Each is a self-contained React component
(interleave in `App.jsx` like `Cards`), reusing the existing classes, with mock data:

1. **transcript viewer** — a working mini transcript browser: a left rail (turn list / file tree / the
   interactive tabs trace·highlights·diffs·files) + the conversation window with expandable tool calls,
   thinking blocks, and diffs. Clicking navigates. Reuse `.window` / `.turn` / `.toolcall` / `.diff` / tabs.
2. **commons** — a browsable grid of transcript/collective cards with WORKING controls: the filter rail
   (order / provider / acceptance) actually filters, a search input filters live, sort works, empty state
   when nothing matches. Reuse `.card` / `.row` / `.sidebar` / `.chip` / `.empty`. Bonus: clicking a card
   opens the transcript-viewer mockup (tie them together).
3. **chart** — a real, dynamic visualization in the house style (amber/earth, square, hairline, SVG, no
   heavy chart lib): e.g. tokens-per-turn (area/bar), tool-call distribution, or a session timeline, with
   hover tooltips and a view/series toggle. "fully dynamic and usable".

These are substantial — run a **design fan-out** (one agent per mockup proposing structure + mock data +
markup), integrate, then parallel-QA. They are the strongest demonstration of the system; budget for them.

---

## carried over from earlier phases (still open)

- **tier-2.5 JSX component port** — the interaction patterns are proven (dialog/tabs/menu/palette work via
  delegated handlers + React). Formalising `Button/Input/Checkbox/Switch/Chip/Card/Tabs/Dialog/Menu/…`
  into `src/ui/*` typed components (keeping the class names) unlocks Storybook and real prop-driven reuse.
  See [`STORYBOOK_PLAN.md`](./STORYBOOK_PLAN.md) (Storybook deferred until this port).
- **more tier-2 coverage** — data table (sortable/selectable), numbered pagination, collapsible/accordion,
  transcript-viewer-depth per-tool renderers. NOTE: P6's transcript-viewer mockup may subsume several.
- **cosmetic nit** — the token tables show the copy-icon only on the family-leader row of each colour
  family; it reads as inconsistent. Add copy to every row, or add an explicit grouping cue.
- **mobile** — overflow is now **0px at 360/390/768/1024/1440** (was ~19px at 360); if you touch layout,
  re-check `node scripts/validate.mjs` + `node scripts/findover.mjs <w>`.

## deferred minor QA nits (from the 2026-06-17 screenshot sweep — left intentionally, low value)

- **forms filter rail** — the `order` rows (no leading icon) and `provider` rows (brand icon) don't share a
  left text edge. Left as-is because the two groups are semantically distinct; could reserve a 20px icon column.
- **forms empty-state** — its inner inset is ~8px deeper than the sibling form/filter cards. Minor.
- **start subhead** — "…transcript viewer" wraps with a one-word orphan; a `&nbsp;` would balance it.
- **badges state chips** — `failed`/`partial` text sits ~3.4–4.4:1 in dark (clay/amber tints). Below 4.5:1 AA
  but every state pairs an icon + label so color is never the sole carrier, and the contrast gate passes.
- **tokens / color reference tables** — show the **dark** hex values in both themes (documented "dark default").
  Could be made theme-aware or gain a second light-values column.
- **mock-commons** — summaries clamp mid-word at 2 lines; shorten the mock copy for clean breaks if desired.
- **a11y "don't" card** — its body is `text-align: justify` on purpose (it demonstrates the anti-pattern); leave it.
- **font of small callout/note bodies** — render in the proportional reading face by design; if the owner wants
  the terminal look tighter, switching `.callout`/`.note` bodies to mono is a one-rule change (left to the owner).

## working method, gates, how to run

- **Gates (keep green):** `pnpm build` runs the contrast gate (`scripts/contrast.mjs`, both themes);
  `node scripts/validate.mjs "http://localhost:PORT/?fb=off"` is a 19-check puppeteer-core interactive
  gate (a11y wiring, scroll-spy, nav-reveal, palette, dialog, theme, overflow per breakpoint, reduced-motion);
  `node scripts/diag.mjs` diagnoses interactive bugs. Add checks as features land (e.g. snap, the mockups).
- **Run:** `pnpm dev` (or `pnpm build && pnpm preview`). `?theme=light`, `?fb=off`, `?cap` (review capture).
- **Screenshot QA:** capture full dark+light with `?cap`, slice into ~1500px bands (see prior workflows),
  fan out reviewers. For the real hero, capture `#top` WITHOUT `?cap`.

## architecture orientation (for a fresh context)

- **Stack:** Vite + React 19 + Tailwind v4, pnpm. `src/index.css` is the single source of truth (tokens in
  `:root` / `[data-theme="light"]`, then all component classes). Two themes; amber scarce; radius 0;
  hairlines; functional borders `--rule-strong` (≥3:1), dividers `--rule` (intentionally subtle); neuroinclusive
  defaults (16px floor, focus rings, ≥24px targets, tabular nums, static-first motion). See `DESIGN.md`,
  `NEUROINCLUSIVE.md`, `PRESENTATION.md`.
- **Composition:** `App.jsx` injects 22 `src/sections/*.html` partials via a **memoized** `<Raw>` (renders
  once — do not un-memoize; React resetting innerHTML clobbers the painted icons + detaches refs),
  interleaved with React components: `Hero`, `Intro`, `Cards`, `CommandPalette.jsx`, `Dialog.jsx`.
- **Icons:** bundled lucide via `src/icons.js` `paintIcons()` (converts `<i data-lucide>` → `<svg>`),
  re-run by a MutationObserver. In React components use `lucide-react` (not `data-lucide`).
- **Interactivity:** delegated handlers in `App.jsx` (theme toggle, copy-token, ⌘k palette, dialog trigger,
  tablists, dropdown menus) + the React components. New static-partial interactivity should follow the same
  delegated pattern (wire by attribute/selector in a `useEffect`).
- **Effects:** `src/effects.jsx` — `AsciiVideo` (wheat hero), `AsciiImage` (card portraits), `AsciiText`
  (block wordmark; extend for P1), plus unused `Halftone`/`GlyphField`/`AsciiArt`.
