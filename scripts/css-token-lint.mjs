#!/usr/bin/env node
/* CSS-tokenization lint for the lifted surface stylesheets.
   ────────────────────────────────────────────────────────────────────────────
   The HYBRID-boundary surfaces (graph: .gmp-/.gan- ; commons: .cex-/.cmg- ; the
   shared in-use shell: .iu-) MUST drive every colour + spacing value from the
   system tokens (var(--…)), never a hardcoded literal. Re-deriving a token value
   inline silently breaks both-theme correctness (a hex colour can't flip with the
   theme) and the spacing scale.

   This lint fails the build when a lifted-surface stylesheet declares:
     • a COLOUR literal — any #hex or rgb()/rgba()/hsl()/hsla()/hwb()/lab()/lch()/
       oklab()/oklch()/color() function — in a rule declaration. (Colours must be
       var(--…) tokens, with no exceptions; this matches the existing DS convention,
       e.g. MapCanvas.css has zero hardcoded colours.)
     • a raw SPACING length (px/rem/em) on a pure spacing property
       (margin / padding / gap / row-gap / column-gap and their longhands) whose
       absolute value exceeds the hairline allowance (2). Tokenized values (var()/calc()),
       zero, and ≤2px optical hairlines are permitted — matching the convention
       (one-off dimensions like width/min-width/min-height and box-shadow offsets
       are intentionally NOT spacing-linted; they legitimately carry raw lengths).

   Scope = the per-surface bundle source (src/lib-graph.css, src/lib-commons.css)
   plus any colocated surface stylesheet they pull in (the .css files under the
   src/ui/graph, src/ui/commons and src/ui/inuse subtrees). The shared component
   library (src/index.css, the existing tier-2/3 component sheets) is NOT in scope
   — only the lifted surfaces are token-locked.

   Wired into `build:lib`; runnable standalone via `pnpm lint:css`. */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SURFACE_BUNDLES } from './surface-namespaces.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Spacing properties that must use a token (not a raw length). One-off dimension
// properties (width/height/min-*/max-*) and box-shadow are deliberately excluded.
const SPACING_PROPS = new Set([
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'margin-block', 'margin-inline', 'margin-block-start', 'margin-block-end',
  'margin-inline-start', 'margin-inline-end',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-block', 'padding-inline', 'padding-block-start', 'padding-block-end',
  'padding-inline-start', 'padding-inline-end',
  'gap', 'row-gap', 'column-gap',
])

const HAIRLINE_MAX = 2 // px/rem/em ≤ 2 (abs) are optical hairlines, allowed raw

const COLOR_FN = /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i
// #hex colour: 3/4/6/8 hex digits, word-bounded (avoids matching e.g. id refs)
const HEX_COLOR = /#[0-9a-fA-F]{3,4}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b/
const LENGTH = /(-?\d*\.?\d+)(px|rem|em)\b/g

// The CSS named colours (CSS Color Module Level 4). `color: red` / `background: white`
// are just as theme-breaking as a #hex — they cannot flip with the theme — so a named
// colour appearing as a value token is flagged too. `transparent`/`currentcolor`/`inherit`
// are theme-safe keywords (no fixed colour) and are allowed.
const ALLOWED_COLOR_KEYWORDS = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'revert', 'none'])
const NAMED_COLORS = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black',
  'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
  'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
  'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
  'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow',
  'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
  'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
  'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
  'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
  'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
  'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
  'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple',
  'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
  'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
  'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white',
  'whitesmoke', 'yellow', 'yellowgreen',
])
// A value contains a named colour when any bare-ident token (split on non-ident
// chars) exactly matches a named colour and is not an allowed theme-safe keyword.
// `var(...)` references are stripped FIRST so a token NAME that embeds a colour word
// is never mistaken for a bare named colour — those ARE tokens. (This DS palette has
// colour-word tokens, e.g. --olive / --teal / --clay / --mauve, and a surface may use
// var(--red-600); none of those should fail the lint.)
const hasNamedColor = (value) => {
  const noVars = value.replace(/var\([^)]*\)/g, '')
  return noVars
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((tok) => tok && NAMED_COLORS.has(tok) && !ALLOWED_COLOR_KEYWORDS.has(tok))
}

// Lint scope is DERIVED from the surface taxonomy so a new surface is auto-linted:
// each surface's per-surface bundle source (src/lib-<surface>.css) + its colocated
// source dir (src/ui/<surface>), plus the shared in-use shell source dir.
const SHARED_SURFACE_DIR = 'src/ui/inuse'
const SCAN_FILES = SURFACE_BUNDLES.map((b) => `src/lib-${b.surface}.css`)
const SCAN_DIRS = [...SURFACE_BUNDLES.map((b) => `src/ui/${b.surface}`), SHARED_SURFACE_DIR]

/** Recursively collect *.css under a dir (if it exists). */
function collectCss(dir) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  const out = []
  for (const name of readdirSync(abs)) {
    const p = join(abs, name)
    if (statSync(p).isDirectory()) out.push(...collectCss(join(dir, name)))
    else if (name.endsWith('.css')) out.push(join(dir, name))
  }
  return out
}

/** Strip CSS comments (so a hex/px quoted in a comment is never flagged). */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

/** 1-based line number of a character offset. */
const lineAt = (text, idx) => text.slice(0, idx).split('\n').length

/**
 * The pure lint over one stylesheet's raw text → an array of violation strings.
 * Exported so the gate teeth-test (gates.test.mjs) can feed synthetic CSS and
 * assert hardcoded colour/spacing FAILS while tokenized/hairline values pass —
 * without any filesystem or build dependency.
 *
 * @param {string} rawText  the stylesheet source
 * @param {string} file     a label used in the violation message
 * @returns {string[]} violation messages (empty = clean)
 */
export function lintCssText(rawText, file) {
  const css = stripComments(rawText)
  const violations = []
  // Walk rule blocks: a selector prelude + `{ … }` body. We only inspect
  // declarations inside a block body, so at-rule preludes (@media px breakpoints,
  // @layer names) are never mistaken for spacing/colour declarations.
  const blockRe = /\{([^{}]*)\}/g
  let m
  while ((m = blockRe.exec(css)) !== null) {
    const body = m[1]
    const bodyStart = m.index + 1
    for (const decl of body.split(';')) {
      const ci = decl.indexOf(':')
      if (ci === -1) continue
      const prop = decl.slice(0, ci).trim().toLowerCase()
      const value = decl.slice(ci + 1).trim()
      if (!prop || !value) continue
      const declOffset = bodyStart + body.indexOf(decl)
      const line = lineAt(css, declOffset)

      // COLOUR: any hex, colour-function, or NAMED colour literal is forbidden.
      if (HEX_COLOR.test(value) || COLOR_FN.test(value) || hasNamedColor(value)) {
        violations.push(
          `${file}:${line}  hardcoded colour in \`${prop}: ${value}\` — use a colour token (var(--…)); a literal cannot flip with the theme`,
        )
        continue
      }

      // SPACING: raw length on a pure spacing property (unless tokenized/hairline).
      if (SPACING_PROPS.has(prop) && !/var\(|calc\(/.test(value)) {
        const overs = []
        let lm
        LENGTH.lastIndex = 0
        while ((lm = LENGTH.exec(value)) !== null) {
          if (Math.abs(parseFloat(lm[1])) > HAIRLINE_MAX) overs.push(lm[0])
        }
        if (overs.length) {
          violations.push(
            `${file}:${line}  raw spacing ${overs.join(', ')} in \`${prop}: ${value}\` — use a spacing token (var(--sp-…)); only 0 and ≤${HAIRLINE_MAX}px hairlines may be raw`,
          )
        }
      }
    }
  }
  return violations
}

// Main: only when run directly (`node scripts/css-token-lint.mjs`), NOT when
// gates.test.mjs imports `lintCssText` — so importing the pure fn never triggers
// the filesystem scan or the throw.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const files = [
    ...SCAN_FILES.filter((f) => existsSync(join(ROOT, f))),
    ...SCAN_DIRS.flatMap(collectCss),
  ]
  const violations = files.flatMap((file) => lintCssText(readFileSync(join(ROOT, file), 'utf8'), file))

  if (violations.length) {
    throw new Error(
      [
        'CSS-tokenization lint FAILED in scripts/css-token-lint.mjs.',
        'What went wrong: a lifted-surface stylesheet hardcodes a colour or spacing value instead of a token:',
        ...violations.map((v) => `  - ${v}`),
        'Why it matters: lifted surfaces must drive colour/spacing from system tokens so they flip correctly',
        'across both themes and stay on the spacing scale; an inline literal re-derives (and breaks) the token.',
        'How to fix: replace the literal with the matching var(--…) token in the source surface stylesheet.',
      ].join('\n'),
    )
  }

  console.log(
    `css-token lint: ${files.length} lifted-surface stylesheet(s) scanned${
      files.length ? ` (${files.map((f) => relative('src', f)).join(', ')})` : ''
    }; no hardcoded colour/spacing.`,
  )
}
