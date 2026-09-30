---
# GENERATED from src/index.css by scripts/gen-llm-artifacts.mjs. Do not edit this block by hand:
# edit src/index.css and re-run the generator (CI gen:check fails on drift). Dark is the default
# theme; a `-light` key carries the light theme value where it differs.
name: fairtrade
description: 'One square, token-driven design system for reading AI coding transcripts: two WCAG AA themes, neuroinclusive by default, amber as a scarce accent.'
colors:
  canvas: '#070706'
  canvas-light: '#fbfaf7'
  surface: '#0e0e0c'
  surface-light: '#fdfcfa'
  surface-2: '#141413'
  surface-2-light: '#f4f2ec'
  surface-hover: '#1b1a17'
  surface-hover-light: '#edeae2'
  surface-elev: '#1c1b18'
  surface-elev-light: '#efece4'
  ink-strong: '#f8f5ed'
  ink-strong-light: '#0d0c09'
  ink: '#e9e5db'
  ink-light: '#27241f'
  ink-2: '#b8b3a4'
  ink-2-light: '#4a463e'
  ink-3: '#9a9488'
  ink-3-light: '#5c574d'
  ink-4: '#8a8478'
  ink-4-light: '#6f695e'
  ink-5: '#534e45'
  ink-5-light: '#837d72'
  rule: '#3c382f'
  rule-light: '#c4bca8'
  rule-strong: '#6f6a5f'
  rule-strong-light: '#8b836d'
  focus-ring: '#cba35c'
  focus-ring-light: '#0d0c09'
  amber: '#cba35c'
  amber-light: '#8a5f1f'
  amber-bright: '#e6c483'
  amber-bright-light: '#6e4c16'
  amber-dim: '#937a45'
  amber-dim-light: '#b09a63'
  amber-fill: '#cba35c'
  amber-fill-light: '#b8841a'
  amber-fill-ink: '#141003'
  amber-fill-ink-light: '#1a1206'
  teal: '#7ea69d'
  teal-light: '#3a675e'
  olive: '#9aa779'
  olive-light: '#586a3c'
  clay: '#c07f64'
  clay-light: '#974b32'
  mauve: '#9a8cae'
  mauve-light: '#594e72'
  on-amber: '#141003'
  on-amber-light: '#fffdf8'
  success: '#9aa779'
  success-light: '#586a3c'
  success-fg: '#141003'
  success-fg-light: '#fffdf8'
  warning: '#cba35c'
  warning-light: '#8a5f1f'
  warning-fg: '#141003'
  warning-fg-light: '#fffdf8'
  danger: '#c07f64'
  danger-light: '#974b32'
  danger-fg: '#141003'
  danger-fg-light: '#fffdf8'
  add-text: '#bccb96'
  add-text-light: '#465528'
  add-rail: '#9aa779'
  add-rail-light: '#586a3c'
  del-text: '#daa791'
  del-text-light: '#82402a'
  del-rail: '#c07f64'
  del-rail-light: '#974b32'
typography:
  display:
    fontFamily: '"Atkinson Hyperlegible Mono", ui-monospace, Menlo, Consolas, monospace'
    fontSize: '52px'
    fontWeight: 700
    lineHeight: 1.12
  headline:
    fontFamily: '"Atkinson Hyperlegible Mono", ui-monospace, Menlo, Consolas, monospace'
    fontSize: '28px'
    fontWeight: 700
    lineHeight: 1.12
  title:
    fontFamily: '"Atkinson Hyperlegible Mono", ui-monospace, Menlo, Consolas, monospace'
    fontSize: '22px'
    fontWeight: 700
    lineHeight: 1.12
  body:
    fontFamily: '"Atkinson Hyperlegible", ui-sans-serif, system-ui, -apple-system, sans-serif'
    fontSize: '16px'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: '0.03em'
  label:
    fontFamily: '"Atkinson Hyperlegible Mono", ui-monospace, Menlo, Consolas, monospace'
    fontSize: '14px'
    fontWeight: 400
    letterSpacing: 0
  code:
    fontFamily: '"Atkinson Hyperlegible Mono", ui-monospace, Menlo, Consolas, monospace'
    fontSize: '16px'
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
rounded:
  none: '0px'
spacing:
  sp-1: '4px'
  sp-2: '8px'
  sp-3: '12px'
  sp-4: '16px'
  sp-5: '24px'
  sp-6: '32px'
  sp-7: '40px'
  sp-8: '56px'
components:
  button-primary:
    backgroundColor: '{colors.amber}'
    textColor: '{colors.on-amber}'
    typography: '{typography.label}'
    rounded: '{rounded.none}'
    height: '36px'
    padding: '0 16px'
  button-primary-hover:
    backgroundColor: '{colors.amber-bright}'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.none}'
    height: '36px'
    padding: '0 16px'
  button-secondary-hover:
    textColor: '{colors.amber-bright}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-3}'
    typography: '{typography.label}'
    rounded: '{rounded.none}'
    height: '36px'
    padding: '0 16px'
  button-ghost-hover:
    backgroundColor: '{colors.surface-hover}'
    textColor: '{colors.ink}'
  button-danger:
    backgroundColor: 'transparent'
    textColor: '{colors.clay}'
    typography: '{typography.label}'
    rounded: '{rounded.none}'
    height: '36px'
    padding: '0 16px'
  input:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.none}'
    height: '36px'
    padding: '0 12px'
  chip:
    textColor: '{colors.ink-2}'
    typography: '{typography.label}'
    rounded: '{rounded.none}'
    height: '28px'
    padding: '0 12px'
  card:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.none}'
    padding: '16px'
  dialog:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.none}'
    width: '420px'
---

# Design System: fairtrade

> **This file is the one design record for fairtrade.** It carries the tokens, the visual rules and
> the component language that peasant's local web and village's frontend conform to. The YAML
> frontmatter above is generated from `src/index.css` (the single source of token values) by
> `scripts/gen-llm-artifacts.mjs`, and CI fails if it drifts; never edit it by hand. The prose below
> is authored. `llm/NEUROINCLUSIVE.md` keeps the research sources and the review checklist behind the
> neuroinclusive rules stated here; where the two disagree, this file wins and the disagreement is a
> bug to fix in both files in one commit. `PRODUCT.md` holds who the system serves. The in-use demo
> (`#inuse`, fairtrade.peasantlabs.org) is the fidelity oracle: when the demo and this file disagree,
> match the demo and file the conflict here, and a ratified change resolves it.

## Overview

**Creative North Star: "styled, but functional"**

Fairtrade is one design system, for peasant (the local web app) and village (the transcript
commons), built around one job: reading an AI coding agent's trace faithfully. Craft serves use.
Every visual choice earns its place by improving legibility, orientation or speed, never decoration
for its own sake; when in doubt, remove it. The identity is a calm terminal register: a fixed-width
face for chrome, square edges, a near-black dark theme and a warm paper light theme, a desaturated
earthy palette, and one scarce amber accent. Brand character lives in precise details (the amber
active marker, the mono chrome, real provider marks), not in ornament.

The product is data-heavy (long transcripts, tables, code, dashboards), and its readers include
people who are dyslexic, have ADHD or are autistic. So the system is **neuroinclusive by default**,
not through an accessibility toggle: a 16px text floor, 1.5 prose leading, a capped prose measure,
functional borders at 3:1, a global focus ring, static-first motion, at most five primary actions per
view, progressive disclosure, persistent orientation and tabular numbers are baked into the tokens
and the base layer, and they govern every component.

Seven principles, in priority order:

1. **Styled, but functional.** Craft serves use.
2. **The user always knows where they are.** A sticky top nav, sticky section and conversation
   headers, and an origin-aware breadcrumb are always present. Going back restores scroll and state.
3. **Tools stay on screen.** Action bars, rails and toolbars for the current surface stay visible
   on scroll. Reaching a tool never requires hunting.
4. **Everything is aligned, and left-aligned.** One vertical axis; labels, values and content share
   a left edge; everything sits on the 4/8 grid.
5. **Glanceable.** Providers, tools, states and nav lead with a real vector icon.
6. **Readable first.** Calm contrast, comfortable leading, nothing readable below 16px. Monospace is
   reserved for code and chrome.
7. **Maximize usability.** Usability beats flourish at every fork: comfortable targets, obvious
   states, minimal motion, WCAG AA in both themes.

**The Static-First Rule.** Motion is off by default (`--motion-base` is 0ms). Transitions of at
most 200ms (`--dur-1` to `--dur-3`) are added only inside
`@media (prefers-reduced-motion: no-preference)`, and the reduce block zeroes every animation and
transition globally. Nothing loops, pulses, auto-plays or auto-scrolls the reading view; the live
indicator is a static filled dot. The one long entrance (`--dur-entrance`) belongs to the
presentation site's hero, never to a product surface.

**Key Characteristics:**
- Two themes only, dark by default, both WCAG AA, re-themed purely by swapping tokens on `[data-theme]`.
- Square: radius 0 on every box.
- Atkinson Hyperlegible Mono for chrome, headings and code; Atkinson Hyperlegible for prose.
- All-lowercase chrome; user content keeps its case.
- Amber is the one accent and it is scarce.
- Flat: depth comes from tonal surfaces and hairlines, not shadows.
- Neuroinclusive defaults in the tokens, not behind a setting.

## Colors

A calm, desaturated earth palette on a near-black or warm-paper ground, with one amber accent;
vivid reads as cheap. Every value is a token in `src/index.css`; the frontmatter mirrors it, dark
first, with the light value under a `-light` key where it differs.

### Primary
- **Amber** (`--amber`): the single accent. Primary actions, the active nav marker, the active tab
  underline, the selected-row marker, links, keywords and the focus ring in the dark theme.
  `--amber-bright` is its hover state and `--amber-dim` its quiet edge (focused input border, the
  `>` of the active nav marker). `--amber-fill` with `--amber-fill-ink` is the golden fill behind
  near-black ink on selected, pressed and toggled controls; it is split from `--amber` so the light
  theme can keep amber text dark enough for AA while toggles still read golden. `--on-amber` is the
  ink on an amber primary button.

### Secondary
- **Teal** (`--teal`): the user role and informational accents (the user turn rail and label).
- **Olive** (`--olive`): success and additions; the live dot.
- **Clay** (`--clay`): danger and deletions; the danger button text.
- **Mauve** (`--mauve`): system and sub-agent turns.

These four are the tile and chart accents (`--chart-1` to `--chart-4`). The semantic aliases map
onto them: `--success` (olive), `--warning` (amber), `--danger` (clay), each with a `-fg` ink for a
filled chip and a `-soft` tint for a background. Diffs use `--add-*` and `--del-*` (background,
text, rail).

### Neutral
- **Canvas** (`--canvas`): the page ground. Deep neutral-warm near-black in dark; warm paper in light.
- **Surfaces** (`--surface`, `--surface-2`, `--surface-elev`, `--surface-hover`): panels, raised
  panels, overlays and hover, stepping up in tone rather than casting shadows.
- **Inks** (`--ink-strong`, `--ink`, `--ink-2`, `--ink-3`, `--ink-4`, `--ink-5`): short emphasis,
  primary text, secondary, tertiary, the faintest text-safe ink, and decoration only.
- **Rules** (`--rule`, `--rule-strong`): the structural hairline divider and the functional control
  border.

### Named Rules
**The Scarce Amber Rule.** Amber marks at most one focal point per region: the primary action, the
active marker, a link, the focus ring. Large fills stay low-chroma earth; amber is never small body
text on light and never a large saturated panel. Never combine color emphasis, bold and motion on one
element.

**The Text-Safe Ink Rule.** `--ink-4` is the faintest ink that may carry text (at least 4.5:1).
`--ink-5` and `--rule` are decoration and structure only. `--ink-3` is for secondary text, never
primary body.

**The Functional Border Rule.** Anything that identifies a control or its state (input outlines,
button borders, toggles, focus rings, meaningful icons, chart series) clears 3:1 against every
surface in both themes: use `--rule-strong` or stronger. Hairline dividers between same-tone
surfaces (`--rule`) stay deliberately subtle. `scripts/contrast.mjs` enforces both sets in
`pnpm build`.

**The Never Color Alone Rule.** Status, diff, log level, role and required fields always pair color
with an icon, a text label or a shape. Negative numbers carry a leading minus.

**The Warm Paper Rule.** The light theme is warm paper, not `#fff`, and the dark theme is off-white
on near-black, not `#fff` on `#000`. Both choices remove glare and halation; do not "fix" either to
pure black or white.

## Typography

**Display Font:** Atkinson Hyperlegible Mono (with ui-monospace, Menlo, Consolas, monospace)
**Body Font:** Atkinson Hyperlegible (with ui-sans-serif, system-ui, sans-serif)
**Label/Mono Font:** Atkinson Hyperlegible Mono, the same face as display (`--font-mono`)

**Character:** One superfamily from the Braille Institute, chosen for disambiguated glyphs. The
fixed-width cut carries the terminal identity in chrome, headings and code; the proportional cut
carries everything a person reads at length.

Both faces load from Google Fonts with a `<link>` in the document head (with `preconnect`), never a
remote `@import` in CSS. Weights: proportional 400 and 700 with italics; mono 400, 500, 600, 700
and italic 400.

### Hierarchy
- **Display** (700, `--fs-display`, `--lh-tight`): the presentation site's brand moments only.
- **Headline** (700, `--fs-xl`, `--lh-tight`): page titles.
- **Title** (700, `--fs-lg` down to `--fs-md`, `--lh-tight`): section and card titles. Headings
  step by size and weight, with more space above than below and a hairline under section headers.
- **Body** (400, `--fs-body`, `--lh-body`, `--tracking-prose` and `--word-spacing-prose`): prose,
  descriptions and transcript speech, capped at `--measure-prose` (`--measure-read` in transcript
  reading panes).
- **Label** (400 to 600, `--fs-label`, mono, letter-spacing 0): chrome. Nav, buttons, chips, tabs,
  table headers, metadata.
- **Code** (400, `--fs-body`, mono, `--lh-mono`, letter-spacing 0): code, logs, IDs and tool output,
  each in its own horizontal scroller, never capped by the prose measure.

The presentation site also uses a locked three-tier heading ladder (`--fs-group`, `--fs-section`,
`--fs-sub`) that does not drift down the page.

### Named Rules
**The 16px Floor Rule.** Nothing a person reads drops below 16px (`--fs-min`): table cells, code,
log lines, tooltips and metadata included. Chrome labels are mono 14 (`--fs-label`). Gain density
through row height and padding, never smaller glyphs.

**The Mono Is Chrome Rule.** Mono is for code, IDs, timecodes, tabular data and chrome. Paragraphs
and transcript speech are never set in mono. Prose gets tracking, word spacing, 1.5 leading and a
capped measure; mono gets letter-spacing 0 so columns stay aligned.

**The Lowercase Chrome Rule.** UI chrome is all lowercase (nav, labels, buttons, headings, tabs,
table headers). User content is never lowercased: names, transcript text, collective names, code,
hashes and data values keep their case. Multi-line literal copy (error bodies, help, tooltips) may
use sentence case so sentences stay parseable. Never `text-transform: uppercase` on multi-word text.

**The Tabular Numbers Rule.** Every count, duration, stat and numeric column uses tabular lining
figures (`font-variant-numeric: tabular-nums`). Numeric columns right-align, with one precision per
column.

**The Bold, Not Italic Rule.** Emphasis is weight: `em` and `i` render at 600, upright. Underline is
reserved for links. In prose, links carry a dotted underline (solid on hover and focus) so they
never rely on color alone; chrome links stay clean. Bold earns a faint amber glow in the dark theme
only, on single accent words, never on multi-line text.

## Layout

Desktop-first, left-aligned, on a 4/8 grid. The spacing scale is `--sp-1` to `--sp-8` (4, 8, 12, 16,
24, 32, 40, 56) and every padding, margin and gap uses it. Content columns cap at `--maxw` with
`--gutter` sides. Buttons and inputs share one height (`--control-h`, `--control-h-sm` for small).
Rows come in three densities (`--row-h-compact`, `--row-h-standard`, `--row-h-comfortable`), with the
standard 40px as the default and a persistent density choice.

Breakpoints are one scale (`--bp-sm`, `--bp-md`, `--bp-lg`, `--bp-xl`): phone below 480, large phone
480 to 767, tablet 768 to 1023, laptop 1024 to 1439, desktop from 1440. Desktop is the canonical
layout and narrower widths adapt down with `max-width` queries. Mobile complements desktop: it stays
overflow-free, legible and tappable from 320px up (WCAG 1.4.10 reflow at 400% zoom), and the desktop
layout is never compromised to serve it. Each table and code block gets its own `overflow-x: auto`.

Stacking uses one named scale: `--z-sticky` < `--z-nav` < `--z-dropdown` < `--z-dialog` < `--z-toast`
< `--z-tooltip`. `scroll-padding-top: var(--nav-h)` keeps focused and anchored content clear of the
sticky nav.

**The Five Actions Rule.** A view has one primary action and at most five first-class actions; the
rest go under an overflow menu. Table rows default to one kebab, not a row of buttons.

**The Orientation Rule.** Every surface answers where am I, what is this and how did I get here: a
stable breadcrumb, a sticky context header naming the current transcript or dataset, a definite
active nav state, position indicators in long flows ("turn 312 of 1,840"), and anchor-linkable rows.

**The Progressive Disclosure Rule.** Lead with a summary and defer detail: collapsed turns and tool
calls, essential columns with a column picker, headline metrics with drill-down. Calm by default; the
user opts into density, and the choice persists.

**The Target Rule.** Every interactive box is at least 24 by 24 (`--target-min`), and primary
actions reach 44 (`--target-comfortable`). The glyph stays at icon size; the box is what grows.

## Elevation & Depth

Flat by default. Depth comes from tonal layering (canvas, then surface, then `--surface-2` and
`--surface-elev`) and from hairline and functional borders (`--bd`, `--bd-strong`), not from
shadows. Every region with running text or data sits on one flat fill: no gradients, patterns,
scanlines or textures behind reading content. Overlays, sticky headers and command palettes use
opaque surfaces.

### Shadow Vocabulary
- **Amber glow** (`--glow`, `--glow-soft`): a faint text glow on bold words and headings, dark theme
  only (the light theme sets both to `none`).
- **Overlay lift**: the live dialog separates from the page with the glow plus one soft drop shadow.
- **Selection inset**: an inset 2 to 3px amber bar (`box-shadow: inset 2px 0 0 var(--amber)`) marks
  the active turn, outline item or palette row without shifting layout.

### Named Rules
**The Opaque Chrome Rule.** No glass or blur in the base UI. Any `backdrop-filter` sits behind
`prefers-reduced-transparency: no-preference` with an opaque fallback. The `--glass-*` tokens belong
to the presentation site's display surfaces.

**The Texture Stays Out Rule.** ASCII texture and glow live on non-text chrome and display surfaces
only (hero art, thumbnails, empty states), never behind prose or data.

## Shapes

Square and editorial. Radius is 0 on every box: cards, controls, chips, tags, inputs, dialogs,
menus, tooltips, graph nodes. The only curves are true circles whose shape is the meaning: status
dots, radio marks and busy spinners. Borders are 1px (`--stroke-hairline`); 2px
(`--stroke-emphasis`) is reserved for active and selected emphasis such as the tab underline and
role rails. The focus ring is a 3px outline offset 2px.

## Components

The component library is `src/ui` (imported from the `src/ui` barrel), one family per file with a
colocated story and an entry in the generated `public/components.json`. Components emit namespaced,
token-styled classes; the styling lives in `src/index.css` and the per-component CSS files. The
presentation page (`src/sections-react`, `src/App.jsx`) and the in-use demo (`src/mockups/inuse`)
render the same system.

### Buttons
- **Shape:** square (radius 0), one height per size (`--control-h`, or `--control-h-sm` for small),
  mono label chrome, lowercase.
- **Primary:** amber fill with `--on-amber` ink at weight 600; hover moves to `--amber-bright`. One
  per view.
- **Secondary:** transparent with a `--rule-strong` border and `--ink` text; hover tints the text
  `--amber-bright` and the border `--amber-dim`.
- **Ghost:** transparent `--ink-3` text; hover raises to `--ink` on `--surface-hover`.
- **Danger:** transparent `--clay` text with a `--rule-strong` border that turns clay on hover.
  Reserved for deleting things.
- **Disabled:** reduced opacity, not-allowed cursor, no pointer events.

### Chips and tags
- **Style:** mono label on a `--rule-strong` border at the small control height; tags add a
  `--surface-2` fill. A provider chip leads with its brand mark (`<Tag brand="claude">`).
- **State:** outcome states (redacted, partial, failed) always pair an icon with the word.

### Cards / Containers
- **Corner Style:** square (0).
- **Background:** `--surface` on the canvas.
- **Shadow Strategy:** none at rest (see Elevation & Depth). Presentation-page cards lift 2px on
  hover, only under `prefers-reduced-motion: no-preference`.
- **Border:** `--bd-strong`.
- **Internal Padding:** `--sp-4`, with `--sp-3` gaps.

### Inputs / Fields
- **Style:** `--canvas` fill, `--rule-strong` border, body type at 16px, the control height.
- **Focus:** the border shifts to `--amber-dim` and the global 3px focus ring appears on keyboard focus.
- **Error / Disabled:** errors are field-adjacent, persistent and plain-language, never a transient
  toast. Checkboxes and radios are real inputs, so focus, disabled and checked states are native.

### Navigation
- **Top nav:** fixed and sticky with the brand stalk, mono 14 lowercase links in `--ink-3`, and the
  active link in amber led by the one permitted `>` marker (in `--amber-dim`).
- **Tabs:** mono lowercase, `--ink-3` at rest, the active tab in `--ink` with a 2px amber underline;
  counts are tabular in `--ink-4`.
- **Trails:** breadcrumb, step indicator, tabs and pagination; orientation lives here.
- **In-use shell:** the app switcher replaces the page header at the same height and carries a
  keyboard tablist for the three apps. The peasant app's section order is `analytics | changes |
  code map` (`GRAPH_APP_SECTIONS`), binding until a ratified replacement lands here first.

### Transcript viewer (signature component)
The reading view both apps embed (`TranscriptViewer`, fed only by `adaptTranscript`). A header whose
title and meta chips leave once the trace scrolls while its breadcrumb and actions row stays pinned,
with the tab strip, the condensed scrubber header (provider, model, position) and the turns bar.
Role-accented turns, each led by an icon: user in teal, assistant in amber, sub-agents in mauve.
Collapsible tool-call rows with tool icons, thinking blocks, unified diffs (rail, gutter, sign),
code blocks and a persistent footer action bar. Syntax highlighting renders structured output only
(`codeToHast` or `codeToTokens` through React); raw highlighter HTML is never injected.

### Canvas and graph
The map and graph surface: a dot-grid background, square nodes (intensity fill, selected in amber),
orthogonal structure edges with dashed activity edges, persistent zoom controls, a minimap and an
activity time strip.

### Dialogs and overlays
A scrim over a bordered `--surface` card with header, body and footer; the primary action sits
bottom-right. Only explicit destructive confirmations may trap focus; routine messages go to one
polite live region, never a focus-stealing toast.

### Data tables and charts
Tables (TanStack-backed `DataTable`) use hairline rows with full-row hover, a sticky header with a
rule under it (weight 600 to compensate for lowercase), right-aligned tabular numerics, and a
selection that pairs an amber tint with a non-color marker. Charts (Recharts wrapped, never raw) use
square bars and lines, token series colors, a muted hairline grid (never amber), mono tabular ticks,
direct or swatch-and-label legends, keyboard access and static-first rendering.

### Icons and brand marks
- **Functional icons** are Lucide only (`lucide-react`), one stroke family at `--ic-sm`, `--ic-md`
  or `--ic-lg`. Tools, states, roles, breadcrumbs, controls and nav all lead with a real glyph.
- **Brand marks:** when the UI names a company or provider, it leads with that provider's real mark
  (`<BrandMark name="claude" />`; aliases resolve anthropic to claude, google to gemini, codex to
  openai), never a generic stand-in. Marks are single-color via `currentColor`, sized off the icon
  tokens, undistorted and paired with the provider name. A mark beside its visible name is
  decorative; a mark standing alone as the identity passes `label`. Claude, Gemini, OpenAI, Cursor
  and opencode geometry originates from Simple Icons (CC0, inlined). Strike's comes unchanged from
  its official project favicon, used with the project's permission. Pi uses the official OAuth mark
  from `earendil-works/pi` (MIT) in the mauve token. The opencode mark is provisional upstream.
- **The brand stalk** (`#logo`, five paths in `src/sections-react/00-defs.jsx`) is the only inline
  brand glyph: the nav brand and the in-use banner.

### ASCII imagery (display surfaces only)
Procedural and image-filtered ASCII is a deliberate centerpiece restricted to a few low-traffic
display surfaces, rendered by `src/effects.jsx`: the wheat video hero (`AsciiVideo`), the brand
section's soil field and roots over the wordmark, the philosophy portrait field, and card
thumbnails (`AsciiImage`, whose ink follows the theme). Dense reading views stay icon-light, and
vector chrome and ASCII never mix on one element.

## Do's and Don'ts

### Do:
- **Do** reference a token for every color and size (`var(--amber)`, `var(--sp-4)`); tokens live
  in `src/index.css` and ship as `@peasant-labs/fairtrade/tokens.css`.
- **Do** keep both themes at WCAG AA and re-theme only by swapping tokens on `[data-theme]`.
- **Do** keep reading text at 16px or more and chrome at mono 14.
- **Do** write chrome in lowercase and keep user content in its own case.
- **Do** use tabular numbers on every count, duration and numeric column.
- **Do** lead every provider name with its `<BrandMark>`.
- **Do** keep 1.5 prose leading, 24px targets, the global `:focus-visible` ring (3px, offset 2px)
  and a reduced-motion path for anything that moves.
- **Do** land a new visual pattern here, in the demo first, before a consuming app uses it.
- **Do** keep chrome copy plain, literal and short, with verb and object on buttons
  ("export transcript", not "ok"); errors say what happened and what to do.

### Don't:
- **Don't** hardcode a hex or px value outside the token blocks.
- **Don't** round a box corner.
- **Don't** use amber for large fills, small body text on light, chart gridlines or more than one
  focal point per region.
- **Don't** carry meaning by color alone.
- **Don't** set `outline: none` without a stronger replacement, justify text, loop an animation or
  add motion outside `prefers-reduced-motion: no-preference`.
- **Don't** put glass, blur, gradients or texture behind reading content.
- **Don't** set prose or transcript speech in mono, or italicize for emphasis.
- **Don't** load fonts with a remote `@import`; use the `<link>` form.
- **Don't** inject highlighter HTML; use structured Shiki output rendered through React.
- **Don't** use em dashes, middot separators or buzzwords (delve, leverage, robust, seamless, crucial,
  elevate, foster, tapestry, landscape, journey, ultimately), or "not X, but Y" constructions.
- **Don't** decorate chrome as a fake terminal: no `//` comment markers, no `>` prompt prefixes on
  titles, labels or bullets (the active nav marker is the one `>`), no eyebrow or kicker labels above
  a heading, no decorative captions under imagery. A section is a title and at most one subtitle.
  Form-field labels, control sub-labels and section titles are functional, not eyebrows.
