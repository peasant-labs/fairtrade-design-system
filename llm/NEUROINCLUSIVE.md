# neuroinclusive by default

> **Authority.**
> - The binding rules live in [`../DESIGN.md`](../DESIGN.md), the one design record.
> - Token values live in `src/index.css`. The token values in `DESIGN.md`'s frontmatter and in
>   `public/tokens.json` are generated from it.
> - This file keeps three things: the research behind each rule, one line per rule naming the
>   `DESIGN.md` rule it explains; how the rules were reconciled with the locked identity; and the
>   review checklist.
> - The values in its tables explain the rules. They are not a second source of truth.
> - A rule has one wording, in `DESIGN.md`. If this file and `DESIGN.md` disagree, `DESIGN.md` wins.
>   The disagreement is a bug: fix both files in the same commit.

This is not an "accessibility settings" page. It records the research behind fairtrade's
neuroinclusive defaults. `DESIGN.md` sets each rule's status: binding, or a known conflict with the
demo, as its Status note says. This file sets no status. A line here that `DESIGN.md`
does not state is research guidance that the library does not ship yet, and where a line says
more than `DESIGN.md`, the extra is guidance too. The defaults exist because the product is a
**data-heavy** application (long transcripts, tables, code, dashboards) and our users include people
who are dyslexic, have ADHD, or are autistic. Designing for them by default makes the product
calmer, faster to scan, and less fatiguing for **everyone**, and none of it is an opt-in toggle.

Sourced from a deep review of primary research: W3C **WCAG 2.2** + the **COGA** (Cognitive &
Learning Disabilities) task force "Making Content Usable", the **British Dyslexia Association**
(BDA) Dyslexia Style Guide 2023, **Rello & Baeza-Yates** eye-tracking studies, **Braille
Institute** (Atkinson Hyperlegible), **Nielsen Norman Group**, **GOV.UK Home Office** accessibility
posters, and **APCA** contrast. Every rule keeps the locked identity (Atkinson Hyperlegible
Mono + proportional, amber/earthy palette, near-black dark / paper light, all-lowercase chrome,
real vector icons). Where research and the locked identity genuinely conflict, the reconciliation
is stated.

---

## the tokens behind the defaults

These tokens live in `src/index.css` and reach every consuming app through the package's
`@peasant-labs/fairtrade/tokens.css` and `base.css` exports. The rule column is research;
`DESIGN.md` sets each rule's status:

| token | value | rule |
|---|---|---|
| `--fs-body` | **16px floor** (18px ideal for reading/transcript surfaces) | never render reading text below 16px; gain table density via row height, not smaller glyphs |
| `--lh-body` | **1.5** | prose leading 1.5; `--lh-mono` 1.4 for code/transcript lines; tight leading (≤1.25) only on single-line display headings |
| `--tracking-prose` | **0.03em** | extra tracking on proportional prose only; **mono/code/.tnum get `letter-spacing:0`** (keeps columns aligned) |
| `--word-spacing-prose` | **0.16em** | word-space ≥ 3.5× letter-space so words don't fuse (prose only) |
| `--measure-prose` / `--measure-read` / `--measure-code` | **58ch / 48ch / 80ch** | probe-verified prose <=80 actual characters and reading panes 45–66; never cap tables/code (give each its own `overflow-x:auto`) |
| `--focus-ring` | amber (dark) / near-black (light) | global 3px ring offset 2px; one -3px inset variant where the outside ring would clip or collide; never bare `outline:none` |
| `--target-min` / `--target-comfortable` | **24px / 44px** | every interactive box ≥24px or the WCAG spacing exception; primary publish actions 36px desktop / 44px coarse-pointer touch |
| `--row-h-compact/standard/comfortable` | **32 / 40 / 48px** | standard 40px default, persistent density toggle |
| `--motion-base` | **0ms default**, 120 to 200ms (`--dur-1` to `--dur-3`) only under `prefers-reduced-motion:no-preference` | static-first |

---

In sections 1 to 7 each line names the `DESIGN.md` rule it explains; the rule itself is worded once, there.

## 1. typography & text

- **The 16px Floor Rule** - dyslexic readers have a "critical font size" below which reading rate collapses, and dense UIs habitually shrink to 11-13px; gain density through row height, never a smaller glyph. *(Rello & Baeza-Yates 2017; BDA 2023)*
- **The Mono Is Chrome Rule** - monospace slows natural-language reading, so prose keeps tracking, word spacing, 1.5 leading and a capped measure while mono keeps `letter-spacing:0` for its columns. *(Braille Institute; BDA 2023)*
- **The Bold, Not Italic Rule** - slant and underline disrupt word shape, and all-caps removes the cues dyslexic readers scan by; emphasis is upright weight. *(BDA 2023)*
- **prose measure** (`Typography`) - over-long lines fail the return sweep and land on the wrong next line, which hits dyslexic and ADHD readers hardest; tables, code and logs are never capped. *(BDA 2023; Schneps et al. PMC3734020)*
- **single column, never justified** (`Typography`) - justification opens rivers and uneven gaps that break tracking; a ragged right edge is predictable to return to. *(BDA 2023; COGA)*
- **paragraph and heading spacing** (`Typography`, `Layout`) - whitespace chunks dense text into navigable units: paragraph spacing at least one line-height, at least 2em above a heading, headings at least 20% larger than body. *(BDA 2023; WCAG 1.4.12)*

## 2. layout & whitespace

- **reflow** (`Layout`) - usable at 320px / 400% zoom with no page-level horizontal scroll; each table and code block scrolls inside its own container. *(WCAG 1.4.10)*
- **The Opaque Chrome Rule** - transparency and blur behind text lose legibility and add visual stress; overlays, sticky headers and palettes stay opaque, and `prefers-reduced-transparency` is honoured. (`prefers-contrast` is research guidance, not implemented.) *(MDN; COGA)*
- **The Texture Stays Out Rule** - repeating high-contrast patterns make words appear to move; texture and ASCII imagery stay on non-text chrome and display surfaces, and every region with running text or data is one flat fill. *(BDA 2023; pattern-glare PMC4621622)*

## 3. colour & contrast

- **The Warm Paper Rule** - `#fff` dazzles and a `#000`-on-`#fff` edge triggers pattern glare, while pure white on black halates for about one in three adults with astigmatism; never "fix" either to pure black or white. *(BDA 2023; Rello & Bigham ASSETS 2017; NN/g Dark Mode; COGA)*
- **The Text-Safe Ink Rule** - thin mono glyphs anti-alias darker, so captions and labels were landing near the AA floor and read weak beside the light theme; text clears 4.5:1 and primary body aims for 7:1. *(WCAG 1.4.3 / 1.4.6)*
- **The Functional Border Rule** - in a dense table the structure is the information; every control border, focus ring, meaningful icon, toggle and chart series clears 3:1, while dividers between same-tone surfaces stay deliberately subtle. *(WCAG 1.4.11)*
- **The Never Color Alone Rule** - meaning has to survive every colour vision; each status, diff, log level, role and required field pairs colour with an icon, a label or a shape. *(WCAG 1.4.1; COGA)*
- **The Scarce Amber Rule** - saturated amber is a loud, cheap register; it marks at most one focal point per region and large fills stay low-chroma earth. *(GOV.UK; APCA)*

## 4. motion & sensory

- **The Static-First Rule** - motion off by default, added only inside `@media (prefers-reduced-motion: no-preference)`, with the reduce block zeroing every animation and transition globally. *(W3C C39; WCAG 2.3.3)*
- **no autoplay, loop or blink** (`Overview`) - nothing flashes more than three times a second, skeletons stay static, the live indicator is a static filled dot, a live table settles at most once a second and the view never auto-scrolls while reading; the named busy-spinner is the one looping exception, and under reduced motion it remains a static ring or glyph. *(WCAG 2.2.2 / 2.3.1; COGA)*

## 5. cognitive load & orientation

- **The Five Actions Rule** - one primary action and at most five first-class actions per view keep a dense view manageable. *(COGA Manageable Quantity)*
- **The Progressive Disclosure Rule** - calm by default, density on request: expanded but collapsible transcript turns, initially collapsed tool details, essential columns + column-picker, headline metrics with drill-down. The tool-type filter subgroup starts collapsed and persists its disclosure choice. *(NN/g; COGA Objective 8)*
- **no interruptions during focused work** (`Dialogs and overlays`) - surprise modals and focus-stealing toasts break concentration; user-opened modals, including publish, trap focus and restore it to their opener on close, and routine messages go to one polite live region. *(COGA Limit Interruptions; WAI-ARIA APG Dialog Modal Pattern)*
- **The Orientation Rule** - a person should never have to work out where they are: a stable breadcrumb, a sticky context header, a definite active nav state, position indicators in long flows and anchor-linkable rows. *(COGA; NN/g)*
- **The Same Place Rule** - rigid layout consistency: the same controls in the same place on every view, identical actions carry identical labels and icons, and nothing reflows, reorders or auto-submits without an explicit action. *(WCAG 3.2.6/3.2.1/3.2.2; GOV.UK)*
- **plain, literal language** (`Do's and Don'ts`) - no idioms or metaphors, short sentences, verb and object on every button ("export transcript", not "ok"); short labels stay lowercase while multi-line literal copy may use sentence case. *(GOV.UK; COGA)*
- **The Help In Place Rule** - the explanation belongs at the point of use, and reaches hover, keyboard focus and tap alike. *(COGA Provide help and support)*
- **salience is a scarce budget** (`Colors`) - at most one focal point per region, never colour emphasis plus bold plus motion on one element, and one focus ring. *(GOV.UK; COGA)*
- **support task resumption** (research guidance) - never re-ask information already given; keep work and offer to continue where the person left off. *(WCAG 3.3.7; COGA)*

## 6. data & tables

- **The Tabular Numbers Rule** - digits in a proportional face have varying widths, so counts, durations and numeric columns use tabular lining figures and align to a common edge. *(A List Apart; NN/g)*
- **decimal alignment** (`Data tables and charts`) - mixed-precision numbers are compared at the decimal separator, with a right-aligned tabular fallback where the renderer or the locale forbids it. *(A List Apart)*
- **hairline rows and full-row hover** (`Data tables and charts`) - heavy gridlines and default zebra add noise; reserve zebra for more than five columns or fifteen rows, and pair a selection tint with a non-color marker (`--stroke-emphasis`, 2px, or bold first cell) that stays separable from hover. *(NN/g; A List Apart; WCAG 1.4.11)*
- **sticky header and frozen first column** (`Data tables and charts`) - the frozen first column is a human-readable label, never an opaque id, and lowercase headers are compensated with weight and a rule under them. *(NN/g; Adrian Roselli)*
- **row density** (`Data tables and charts`) - about 40px rows by default with persistent compact and comfortable densities, and in-row controls keep their hit boxes even when the glyph is smaller. *(BDA 2023; MUI X; WCAG 2.5.8)*
- **maximize data-ink** (`Data tables and charts`) - no 3D, gradients, drop shadows, textures or full cell grids; group with whitespace and alignment, prefer horizontal rules, and keep gridlines muted and never amber. *(NN/g; A List Apart; Wilke)*
- **search, filter and sort are defaults** (`Data tables and charts`) - recognition over recall: an always-visible search, discoverable column filters with a filters-active indicator, an explicit sort arrow and removable chips, in state the host can map to URL parameters. *(NN/g; Learning Loop)*
- **chunk long content** (`Data tables and charts`) - long content is chunked into labelled, individually navigable segments with descriptive headings and a jump-to, and a persistent count reports what is shown. *(COGA; BDA 2023)*

## 7. technical / WCAG baseline

- **focus indicator** (`Shapes`) - a keyboard user has to see where they are; the ring clears 3:1 against its component and its background, and nothing removes it without a stronger replacement. *(WCAG 2.4.13)*
- **focus never hidden by sticky chrome** (`Layout`) - `scroll-padding-top` (and, with a player bar, `scroll-padding-bottom`) keeps tabbed-into-view and anchored content clear of the sticky nav. *(WCAG 2.4.11/2.4.12)*
- **The Target Rule** - dense controls meet the WCAG 2.5.8 spacing exception where they cannot reach 24px, and the glyph stays at icon size while the box is what grows. *(WCAG 2.5.8/2.5.5; BDA 2023)*
- **The Text Spacing Rule** - A WCAG 1.4.12 user stylesheet must clip nothing: no fixed px heights on text containers and no truncation of message content. Primary titles and labels wrap; paths and prompt previews may ellipsize with full text available through a title or detail view. *(WCAG 1.4.12)*
- **reversible by default** (`Dialogs and overlays`) - undo or confirm for delete, edit and bulk actions; preserve in-progress work on navigation; errors stay specific, persistent and field-adjacent rather than a transient toast. *(COGA Objective 4; WCAG 3.3.1/3.3.3)*
- **role accents and brand marks** (`Colors`, `Components`) - provider accents belong to assistant turns, teal to users, mauve to sub-agents and neutral `--ink-3` to system turns; navigation remains text-first, while named providers and companies, including github, lead with real brand marks. *(NN/g; COGA; DESIGN.md Components)*
- **APCA is aspirational, not implemented** - the shipping gate (`scripts/contrast.mjs`) measures pure WCAG 2.x ratios in both themes and does not compute APCA Lc; WCAG 2.x is known to overstate contrast near black, so an APCA backstop is a future aim and no APCA coverage may be claimed. *(APCA; Myndex)*

---

## conflicts with the locked identity (and how they're reconciled)

1. **Pure-white light theme vs glare.** → Shift the light *reading* canvas a few percent warm to
   paper-white (`#fbfaf7`/`#fdfcfa`); it still reads as a crisp white theme and carries a faint amber
   kinship, while removing the documented `#000`-on-`#fff` glare. If literal `#fff` is required, scope
   it to thin chrome and make large reading surfaces the paper. *(shipped: the light canvas and surface
   are the warm paper values, recorded in `DESIGN.md` as the warm paper rule)*
2. **Amber/earthy palette vs functional contrast.** → Amber = accent/link/keyword/focus/large-bold,
   never small body text on light. **Raise the rule/border tokens to clear 3:1** (thin preserved).
   Tune muted tokens by lightness to clear ≥4.5:1.
3. **Mono typeface vs prose-spacing rules.** → No real conflict: proportional Atkinson for all
   prose/speech (gets tracking/word-spacing/1.5/probe-verified measure); Mono only for code/IDs/tabular/chrome (gets
   `letter-spacing:0`, 1.4, 80ch, tabular figures).
4. **All-lowercase chrome vs heading hierarchy.** → Carry hierarchy through size (≥20% steps), weight
   (600–700), amber accent, whitespace, and a hairline under section headers. Allow sentence-case for
   multi-line literal copy; keep short labels lowercase.
5. **Underline-free amber links vs "links must look different".** → In-prose links get a secondary
   non-color cue (a dotted underline at rest, solid on hover and focus; no `>` marker) without
   undoing the global underline-free aesthetic.
6. **cp437/Qud texture & glow vs flat-background/halation rules.** → Confine texture to non-text
   chrome; every region with running text or data stays a flat single fill; glow is for single
   accent words marked `.hl` only, never generic bold transcript spans.

---

## what to verify in CI / review

The automated gates that cover these rules (CI runs them in `.github/workflows/ci.yml`):

- **contrast gate** (`scripts/contrast.mjs`, run via `pnpm build` before `vite build`): pure-JS WCAG
  2.x ratios in both themes - every required text/surface pair ≥4.5:1; control borders and the focus
  ring ≥3:1; the toggle fill, the `--amber-dim` focus tint and the structural dividers are reported,
  not failed. It has no icon or chart-series pairs. No APCA today.
- **built-app validation** (`scripts/journey/app-validate.journey.mjs`, run by `pnpm journey:ci`): the
  twenty interaction checks, ported from the older `scripts/validate.mjs` onto Playwright (icons
  painted, one h1, heading outline, copy-token labels, decorative icons aria-hidden, scroll-spy, ZONE
  header gating, cmd-k palette, dialog focus-trap, theme toggle, 0 overflow at 360/390/768/1024/1440,
  reduced-motion, no console errors), plus a separate check that under `prefers-reduced-transparency:
  reduce` no mounted element and no fresh unclassed div computes a backdrop blur, and the nav, the
  mounted transcript glass bars and a `.txn-sticky` bar compute the opaque `--surface`, in each theme.
- **storybook build** (`pnpm build-storybook`): the type/parse gate for `src/ui/*`.
- **storybook smoke** (`scripts/journey/storybook-smoke.journey.mjs`, run by `pnpm journey:ci`): loads
  every story incl. `play()`, expects 0 real errors. `node scripts/sbsmoke.mjs` is the local equivalent.

Manual / review checks beyond the automated gates. A consumer surface that matches the demo is not
a finding (see `DESIGN.md` Status). On a listed known conflict the decision is open; anywhere else
the demo has a defect to file in fairtrade. New fairtrade work is held to the record.

- text-spacing resilience: apply the 1.4.12 user stylesheet; nothing clips.
- no text token <16px in reading contexts; no `text-align:justify`; no `outline:none` without replacement; no infinite animation outside the named busy-spinner exception; no color-only status.
- reflow at 320px / 400% zoom; reduced-motion honoured (reduced transparency is automated, above).
- every interactive box ≥24px (or 24px-spacing exception); focus visible on every control including dense table cells.
- meaningful icons, toggle boundaries and chart series clear 3:1 against their surfaces (the gate does not check them).
