# neuroinclusive by default

This is not an "accessibility settings" page. These are the **default** rules of the peasant
design system, because the product is a **data-heavy** application (long transcripts, tables,
code, dashboards) and our users include people who are dyslexic, have ADHD, or are autistic.
Designing for them by default makes the product calmer, faster to scan, and less fatiguing for
**everyone**. Every rule below is a default behaviour of the base components and tokens — not an
opt-in toggle.

Sourced from a deep review of primary research: W3C **WCAG 2.2** + the **COGA** (Cognitive &
Learning Disabilities) task force "Making Content Usable", the **British Dyslexia Association**
(BDA) Dyslexia Style Guide 2023, **Rello & Baeza-Yates** eye-tracking studies, **Braille
Institute** (Atkinson Hyperlegible), **Nielsen Norman Group**, **GOV.UK Home Office** accessibility
posters, and **APCA** contrast. Every rule keeps the locked identity (Atkinson Hyperlegible
Mono + proportional, amber/earthy palette, near-black dark / paper light, all-lowercase chrome,
real vector icons). Where research and the locked identity genuinely conflict, the reconciliation
is stated.

---

## the defaults that ship in the tokens

These are baked into `src/index.css` (and flow to every app via `@peasant-labs/theme`):

| token | value | rule |
|---|---|---|
| `--fs-body` | **16px floor** (18px ideal for reading/transcript surfaces) | never render reading text below 16px; gain table density via row height, not smaller glyphs |
| `--lh-body` | **1.5** | prose leading 1.5; `--lh-mono` 1.4 for code/transcript lines; tight leading (≤1.25) only on single-line display headings |
| `--tracking-prose` | **0.03em** | extra tracking on proportional prose only; **mono/code/.tnum get `letter-spacing:0`** (keeps columns aligned) |
| `--word-spacing-prose` | **0.16em** | word-space ≥ 3.5× letter-space so words don't fuse (prose only) |
| `--measure-prose` / `--measure-read` / `--measure-code` | **66ch / 60ch / 80ch** | cap running-prose line length; never cap tables/code (give each its own `overflow-x:auto`) |
| `--focus-ring` | amber (dark) / near-black (light) | global `:focus-visible{outline:3px solid;outline-offset:2px}`; never bare `outline:none` |
| `--target-min` / `--target-comfortable` | **24px / 44px** | every interactive box ≥24px (WCAG 2.5.8), primary ≥44px |
| `--row-h-compact/standard/comfortable` | **32 / 40 / 48px** | comfortable 40px default, persistent density toggle |
| `--motion-base` | **0ms default**, 150–200ms only under `prefers-reduced-motion:no-preference` | static-first |

Hard floors / lint rules: no text `<16px` in reading contexts; no `text-align:justify`; no
`outline:none` without a stronger replacement; no infinite animation; no color-only meaning.

---

## 1. typography & text

- **16px floor, 18px ideal.** Dyslexic readers have a "critical font size" below which reading
  rate collapses; the benefit threshold is ~18px and dense UIs habitually shrink to 11–13px. Body
  reading text never goes below 16px — including table cells, code, log lines, tooltips, metadata.
  Gain density through row height/padding, not smaller glyphs. *(Rello & Baeza-Yates 2017; BDA 2023)*
- **Line-height 1.5 for prose, ≥1.4 for any multi-line text.** Tight leading (≤1.25) is reserved
  for single-line, width-capped display headings only — never reuse it on wrapping body copy.
  *(BDA 2023; WCAG 1.4.12)*
- **+0.03em tracking and 0.16em word-spacing on proportional prose only.** Extra tracking reduces
  letter "crowding" (Rello: +7–14% faster reading). **Monospace gets `letter-spacing:0`** — added
  tracking breaks the tabular grid. Keep word-space ≥3.5× letter-space. *(BDA 2023; WCAG 1.4.12)*
- **Cap prose measure at 66ch** (45–66ch for transcript reading panes); never beyond ~80ch.
  Over-long lines cause return-sweep failures (landing on the wrong next line) that hit
  dyslexic/ADHD readers hardest. **Do not cap tables/code/logs** — full width or horizontal scroll
  in their own container. *(BDA 2023; Schneps et al. PMC3734020)*
- **Left-align everything; never justify; single column.** Justification creates rivers and uneven
  gaps that disrupt tracking; ragged-right gives a predictable left edge to return to. Right-aligned
  numeric columns are fine (scanning, not justification). *(BDA 2023; COGA)*
- **Bold for emphasis, never italics or underline.** Render `<em>/<i>` as `font-weight:600`, not
  slanted. Underline is reserved for genuine links. Never ALL-CAPS / `text-transform:uppercase` on
  multi-word strings (removes the word-shape cues dyslexic readers use). Lowercasing must **never**
  touch code identifiers, hashes, or verbatim data values. *(BDA 2023)*
- **Prose in the proportional face; Mono only for code/IDs/timecodes/tabular data/chrome.**
  Monospace slows natural-language reading; never typeset paragraphs or transcript speech in mono.
  This is exactly the locked split — formalized as a hard mapping. *(Braille Institute; A List Apart)*

## 2. layout & whitespace

- **Generous structural spacing.** Paragraph spacing ≥1× line-height (margin, not indent), ≥2em
  above headings, headings ≥20% larger than body, clear size/weight hierarchy. Whitespace chunks
  dense text into navigable units. *(BDA 2023; WCAG 1.4.12)*
- **One flat background colour behind any text.** No gradients, patterns, watermarks, CRT/scanline
  textures, or busy striping behind reading or data content — repeating high-contrast patterns
  induce visual stress ("words appear to move"). The cp437 / Caves-of-Qud texture lives on
  **non-text chrome only** (borders, headers, empty states, hero art, thumbnails). *(BDA 2023; pattern-glare PMC4621622)*
- **Reflow (WCAG 1.4.10):** usable at 320px / 400% zoom with no page-level horizontal scroll. Each
  table/code block gets its own `overflow-x:auto`; prose wraps at the measure. *(WCAG 1.4.10)*
- **Honor `prefers-reduced-transparency` / `prefers-contrast`.** No glass/blur in the base UI;
  overlays, sticky headers and command palettes use opaque surfaces; gate `backdrop-blur` behind
  `prefers-reduced-transparency:no-preference` with an opaque fallback. *(MDN; COGA)*

## 3. colour & contrast

- **Light theme: warm paper, not pure white.** `#fff` dazzles and the `#000`-on-`#fff` edge triggers
  pattern glare/migraine; warm off-white reads faster. Default `--canvas`/`--surface` to a faint
  warm paper (~`#FAF7F0`/`#FCFBF6`); body ink stays the locked off-black `#27241f`. *(BDA 2023; Rello & Bigham ASSETS 2017)*
- **Dark theme: off-white on near-black, never `#fff` on `#000`.** Pure white on black causes
  halation (haloing) for ~1-in-3 adults with astigmatism. Body uses `--ink #e9e5db` (16:1);
  `--ink-strong #f8f5ed` (18.5:1) only for short emphasis; the amber text-shadow glow never touches
  multi-line text. (Already satisfied — do not "fix" to pure black/white.) *(NN/g Dark Mode; COGA)*
- **Contrast floor 4.5:1, target 7:1 (AAA) for primary body.** Tune earthy hues by lightness; the
  muted `--ink-3` (≈5:1 dark / 4.6:1 light) is for **secondary** text only, never primary body.
  Validate every text-on-surface pair in CI. *(WCAG 1.4.3 / 1.4.6)*
- **Non-text contrast ≥3:1 (WCAG 1.4.11) on every functional border, gridline, input outline, focus
  ring, meaningful icon, toggle, chart series.** In dense tables the structure *is* the information.
  **Defect found & fixed:** locked `--rule` (1.28:1 light) and `--rule-strong` (1.51:1 dark) both
  failed — raised in lightness, kept 1px thin. Sub-3:1 hairlines only for purely decorative,
  redundant separators. *(WCAG 1.4.11)*
- **Never color alone (WCAG 1.4.1).** Every status/diff/log-level/required-field carries a redundant
  icon + label + shape. Negative numbers get a leading minus/parentheses. Pairs perfectly with the
  locked "real icons, not glyph-dots" rule. *(WCAG 1.4.1; COGA)*
- **Saturated amber is a scarce accent.** Large fills stay low-chroma/mid-luminance earthy; reserve
  amber for small accents, focus, links, keywords, and large/bold text — never small body text on
  light, never big saturated panels. This *tightens* the locked palette intent. *(GOV.UK; APCA)*

## 4. motion & sensory

- **Reduced-motion is the base state.** Author static-first, then add motion only inside
  `@media (prefers-reduced-motion:no-preference)`. Under "reduce", kill non-essential
  transitions/animations; cap any remainder at ~200ms. No parallax, carousels, marquees, looping
  shimmer. **Defect fixed:** the locked reduce block only covered `scroll-behavior` — the `.btn`/`.input`
  transitions and `.nav` blur are now gated. *(W3C C39; WCAG 2.3.3)*
- **No autoplay/loop/blink by default.** Nothing flashes >3×/sec (WCAG 2.3.1); the recording/live
  indicator is a **static** filled dot, not a pulse; live tables coalesce repaints to ≤1 change/sec
  as a brief non-looping settle; never auto-scroll the viewport while reading. *(WCAG 2.2.2 / 2.3.1; COGA)*

## 5. cognitive load & orientation

- **≤5 primary actions per view.** One primary CTA, ≤5 first-class secondary actions, the rest under
  a `…` overflow. Table rows default to a single kebab, not inline button rows. *(COGA Manageable Quantity)*
- **Progressive disclosure by default.** Lead with a summary, defer detail to expand-on-demand:
  collapsed transcript turns (speaker + first line), essential columns + column-picker, headline
  metrics with drill-down. Calm by default; the user opts *into* density (persisted). *(NN/g; COGA Obj. 8)*
- **No interruptions during focused work.** No surprise modals, no focus-stealing toasts, no
  animating badges. Routine messages go to one fixed `aria-live="polite"` region. Only explicit
  destructive confirmations may focus-trap. *(COGA Limit Interruptions)*
- **Persistent orientation everywhere** ("where am I / what is this / how did I get here"): stable
  breadcrumb, sticky context header naming the current dataset/transcript, definite active nav-state,
  position indicators in long flows ("turn 312 of 1,840"), anchor-linkable rows (`#turn-312`). The
  locked sticky headers + amber active-nav already do this — extend the pattern. *(COGA; NN/g)*
- **Support task resumption.** Continuous auto-save; never re-ask info already given (WCAG 3.3.7); on
  return, "continue where you left off" + done/remaining + "jump to next unreviewed". *(WCAG 3.3.7; COGA)*
- **Rigid layout consistency (WCAG 3.2.6).** Same controls in the same place on every view; identical
  actions use byte-identical labels/icons; nothing reflows/reorders/auto-submits without explicit
  action (3.2.1/3.2.2). One AppShell, one action registry. Reinforces "standardize to tokens". *(WCAG 3.2.6/3.2.1/3.2.2; GOV.UK)*
- **Literal plain language.** No idioms/metaphors/cute errors; short sentences + bullets;
  descriptive verb+object button labels ("export transcript", not "ok"); errors state what happened +
  what to do. Short UI labels stay lowercase per the lock; multi-line literal copy (error bodies,
  help, tooltips) may be sentence-case so sentences stay parseable. *(GOV.UK; COGA)*
- **Inline contextual help** at the point of use (column headers, metrics, jargon), triggerable by
  hover **and** keyboard **and** tap; "what to expect" before multi-step tasks; a consistently
  located help launcher. *(COGA Provide help and support)*
- **Salience is a scarce budget.** Amber/strong-contrast for at most one focal point per region;
  never combine color-emphasis + bold + motion on one element; one clear focus ring, not competing
  highlights. A formalization of the locked "amber scarce, earthy supporting" intent. *(GOV.UK; COGA)*

## 6. data & tables

- **Right-align numeric columns; tabular lining figures by default** (`font-variant-numeric:
  lining-nums tabular-nums` on tables/code/metrics; extend the existing `.tnum`); identical decimal
  precision per column; match each header's alignment to its column. *(A List Apart; NN/g)*
- **Align mixed-precision numbers on the decimal** (`text-align:"." center` where supported, with a
  right + `tnum` + fixed-precision fallback). *(A List Apart)*
- **Hairline rows + full-row hover, not heavy gridlines or default zebra.** Reserve ultra-low-contrast
  zebra for >5 columns or >15 rows. Selection = distinct higher-alpha amber tint **plus** a non-color
  marker (2–3px amber left-border / bold first cell), separable from hover. Row rules must clear 3:1.
  *(NN/g; A List Apart; WCAG 1.4.11)*
- **Freeze the header row** (and the first identifier column on horizontal scroll) with
  `position:sticky`; the frozen first column is a human-readable label, never an opaque ID; order
  columns by importance. Compensate for lowercase headers with weight 600 + a rule under the header.
  *(NN/g; Adrian Roselli)*
- **Comfortable ~40px rows by default** (≈12px vertical padding), with persistent compact (32px) /
  comfortable (48px) density; in-row controls get ≥24px (≥44px touch) hit boxes even when the glyph
  is 14–16px. *(BDA 2023; MUI X; WCAG 2.5.8)*
- **Maximize data-ink.** No 3D, gradients, drop shadows (beyond one functional sticky-edge), textures,
  ornamental borders, or full cell grids in data. Group with whitespace, alignment, light hairlines;
  prefer horizontal rules over vertical; **direct-label charts** instead of hue-only legends; mute
  gridlines (low-alpha earthy, never amber — amber competes with data). *(NN/g; A List Apart; Wilke)*
- **Search/filter/sort are first-class persistent defaults** on every data view (recognition over
  recall): always-visible search with autosuggest, discoverable column filters with a "filters
  active" indicator, explicit current-sort arrow, removable filter chips; persist state in URL params.
  *(NN/g; Learning Loop)*
- **Chunk long content** into short, labelled, individually navigable segments with descriptive
  headings + a jump-to/ToC; very long tables paginate or windowed-virtualize with a persistent
  "showing X of N"; each segment gets a stable URL fragment. *(COGA; BDA 2023)*

## 7. technical / WCAG baseline

- **Global focus indicator** (WCAG 2.4.13): `:focus-visible{outline:3px solid var(--focus-ring);
  outline-offset:2px}`, ring clears ≥3:1 against both component and background; never bare
  `outline:none`. **Defect fixed:** there was no global `:focus-visible` — only a color-only input
  border. *(WCAG 2.4.13)*
- **Focus never hidden by sticky chrome** (WCAG 2.4.11): `scroll-padding-top:var(--nav-h)` (+
  `scroll-padding-bottom` for a player bar) so tab-into-view never tucks focus under the nav. *(WCAG 2.4.11/2.4.12)*
- **Hit targets ≥24×24px** (WCAG 2.5.8), ≥44 for primary; dense controls satisfy the 24px-spacing
  exception. The glyph stays at `--ic-sm`/`--ic-md`; the *box* is ≥24px. *(WCAG 2.5.8/2.5.5)*
- **Reversible by default** (COGA Obj. 4): undo/confirm for delete/edit/bulk; preserve in-progress
  work on navigation; specific, persistent, field-adjacent plain-language error guidance (not a
  transient toast). *(COGA; WCAG 3.3.1/3.3.3)*
- **Author the WCAG 1.4.12 text-spacing metrics as comfortable defaults** and stay resilient: no fixed
  px heights on text containers, no `overflow:hidden`/truncation of transcript lines, so a user
  stylesheet (line-height 1.5 / paragraph 2× / letter 0.12em / word 0.16em) cannot clip content. *(WCAG 1.4.12)*
- **Measure dark-theme contrast with APCA** (Lc 90 fluent body / 75 floor / 60 secondary / 45 large /
  15 non-text) alongside WCAG 2.2 AA as a backstop — WCAG 2.x overstates contrast near black. *(APCA; Myndex)*

---

## conflicts with the locked identity (and how they're reconciled)

1. **Pure-white light theme vs glare.** → Shift the light *reading* canvas a few percent warm to
   paper-white (`#FAF7F0`/`#FCFBF6`); it still reads as a crisp white theme and carries a faint amber
   kinship, while removing the documented `#000`-on-`#fff` glare. If literal `#fff` is required, scope
   it to thin chrome and make large reading surfaces the paper. *(decision pending the owner — see below)*
2. **Amber/earthy palette vs functional contrast.** → Amber = accent/link/keyword/focus/large-bold,
   never small body text on light. **Raise the rule/border tokens to clear 3:1** (thin preserved).
   Tune muted tokens by lightness to clear ≥4.5:1.
3. **Mono typeface vs prose-spacing rules.** → No real conflict: proportional Atkinson for all
   prose/speech (gets tracking/word-spacing/1.5/66ch); Mono only for code/IDs/tabular/chrome (gets
   `letter-spacing:0`, 1.4, 80ch, tabular figures).
4. **All-lowercase chrome vs heading hierarchy.** → Carry hierarchy through size (≥20% steps), weight
   (600–700), amber accent, whitespace, and a hairline under section headers. Allow sentence-case for
   multi-line literal copy; keep short labels lowercase.
5. **Underline-free amber links vs "links must look different".** → In-prose links get a secondary
   non-color cue (dotted underline on hover/focus + the existing `> ` marker vocabulary) without
   undoing the global underline-free aesthetic.
6. **cp437/Qud texture & glow vs flat-background/halation rules.** → Confine texture/glow to non-text
   chrome; every region with running text or data stays a flat single fill; the `.hl` glow is single
   accent words only.

---

## what to verify in CI / review

- contrast gate: every text/surface pair ≥4.5:1 (warn <7:1 primary); every functional border/icon/ring ≥3:1; APCA Lc tags on dark tokens.
- text-spacing resilience: apply the 1.4.12 user stylesheet; nothing clips.
- no text token <16px in reading contexts; no `text-align:justify`; no `outline:none` without replacement; no infinite animation; no color-only status.
- reflow at 320px / 400% zoom; reduced-motion and reduced-transparency honoured.
- every interactive box ≥24px (or 24px-spacing exception); focus visible on every control including dense table cells.
