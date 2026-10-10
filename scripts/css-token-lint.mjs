#!/usr/bin/env node
/* CSS-tokenization lint for every stylesheet that ships in the package.
   ────────────────────────────────────────────────────────────────────────────
   Scope is DERIVED: the four bundle entries (src/lib-components.css and
   src/lib-<surface>.css), every local sheet they @import (src/index.css, the colocated
   component sheets), and every sheet a src/ui module imports for its side effect
   (src/ui/graph/timelinePrimitives.css). A new imported sheet is linted the moment it ships.
   The presentation site's own sheet (src/site.css) never ships and is out of scope.

   Checks (each violation names its check id):
     colour      a #hex, colour function or named colour in a declaration. Colours are
                 var(--…) tokens; only the token blocks (:root, [data-theme], @theme) may
                 hold literals.
     spacing     a raw length above the 2px hairline on a spacing property (margin,
                 padding, gap and their longhands), INCLUDING a length mixed with a token
                 (`padding: 3px var(--sp-3)`); only the var(…) references are exempt.
     ring-width  a focus rule (:focus, :focus-visible, :focus-within) whose outline or
                 ring box-shadow is not var(--focus-ring-width).
     ring-offset a focus rule whose outline-offset is not var(--focus-ring-offset) or the
                 one inset variant var(--focus-ring-offset-inset).
     motion      a transition or animation declared outside
                 `@media (prefers-reduced-motion: no-preference)`. Motion is opt-in.
     loop        an infinite animation other than the one busy spinner (busy-spin). Skeletons,
                 pulses and live dots stay static.
     stroke      a one-sided border (a rail, stripe or underline) or an inset stripe shadow wider
                 than the 1px hairline that is not var(--stroke-emphasis).
     icon        a Lucide icon (a rule whose last compound selects .lucide) sized by anything but
                 the icon tokens --ic-sm / --ic-md / --ic-lg.
     blur        a backdrop-filter outside `@media (prefers-reduced-transparency:
                 no-preference)`. Bars and scrims are opaque and unblurred by default.

   Known exceptions live in scripts/testdata/css-token-lint.allowlist.yaml, one entry
   per (file, selector, property, value, check). The list only shrinks: an entry that no
   longer matches a violation fails the lint, so a fixed literal must leave the list.

   Three source guards run here too (scripts/css-guards.mjs): every surface namespace that
   has its own shipped sheet is declared in exactly that sheet, no JSX icon is sized below
   --ic-sm with a numeric size={n} prop, and the app loads its fonts only with the <link> in
   index.html (no CSS @import of a remote font or of the deprecated fonts.css).

   Wired into `build:lib`; runnable standalone via `pnpm lint:css`. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, walkCss, inMotionAllowed, isStyleRule, shippedSourceSheets, loadStrictYaml } from './css-source.mjs'

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

/** Remove every var(…) reference (with nested parentheses) from a value. */
export function stripVarRefs(value) {
  let out = ''
  for (let i = 0; i < value.length; i++) {
    if (value.startsWith('var(', i) && !/[\w-]/.test(value[i - 1] ?? '')) {
      let depth = 0
      let j = i + 3
      for (; j < value.length; j++) {
        if (value[j] === '(') depth++
        else if (value[j] === ')' && --depth === 0) break
      }
      out += ' '
      i = j
      continue
    }
    out += value[i]
  }
  return out
}

// A value contains a named colour when any bare-ident token (split on non-ident
// chars) exactly matches a named colour and is not an allowed theme-safe keyword.
// `var(...)` references are stripped FIRST so a token NAME that embeds a colour word
// is never mistaken for a bare named colour — those ARE tokens.
const hasNamedColor = (value) =>
  stripVarRefs(value)
    .toLowerCase()
    .split(/[^a-z-]+/)
    .some((tok) => tok && NAMED_COLORS.has(tok) && !ALLOWED_COLOR_KEYWORDS.has(tok))

const isTokenBlock = (block) =>
  block.context.some((p) => p.startsWith('@theme')) ||
  block.prelude.split(',').every((s) => /^(?::root|\[data-theme(?:=["']?[\w-]+["']?)?\])$/.test(s.trim()))

const isFocusRule = (prelude) => /:focus(?:-visible|-within)?\b/.test(prelude)
const NO_MOTION = /^(?:none|0m?s?|initial|unset|inherit)(?:\s*!important)?$/
const RING_OFFSETS = new Set(['var(--focus-ring-offset)', 'var(--focus-ring-offset-inset)'])
/** The single named looping animation (src/index.css): a busy spinner while work is in progress. */
export const BUSY_SPINNER = 'busy-spin'
const STROKE_PROPS = /^border-(?:left|right|top|bottom|inline-start|inline-end|block-start|block-end)(?:-width)?$/
const INSET_STRIPE = /\binset\s+(-?\d*\.?\d+px|var\(--sp-\d\))\s+0\s+0\b/
const ICON_TOKENS = /^var\(--ic-(?:sm|md|lg)\)$/
/** The selector list targets a Lucide icon itself (the last compound carries .lucide). */
const targetsIcon = (prelude) => prelude.split(',').some((s) => /\.lucide(?![\w-])[^\s>+~]*$/.test(s.trim()))
const inTransparencyAllowed = (context) => context.some((p) => /^@media\b[^{]*prefers-reduced-transparency\s*:\s*no-preference/.test(p))

/**
 * The pure lint over one stylesheet → violation objects. Exported so the gate tests
 * (scripts/css-guards.test.mjs, gates.test.mjs) feed synthetic or mutated CSS through
 * the same code the build runs.
 *
 * @param {string} rawText  the stylesheet source
 * @param {string} file     a label used in the violation
 * @returns {Array<{file: string, line: number, selector: string, prop: string, value: string, check: string, message: string}>}
 */
export function lintCssDecls(rawText, file) {
  const out = []
  const push = (block, decl, check, why) =>
    out.push({
      file,
      line: decl.line,
      selector: block.prelude,
      prop: decl.prop,
      value: decl.value,
      check,
      message: `${file}:${decl.line}  [${check}] \`${decl.prop}: ${decl.value}\` in \`${block.prelude}\`: ${why}`,
    })
  for (const block of walkCss(rawText).blocks) {
    if (!isStyleRule(block)) continue
    const tokenBlock = isTokenBlock(block)
    const focus = isFocusRule(block.prelude)
    const motionOk = inMotionAllowed(block.context) || block.context.some((p) => /prefers-reduced-motion\s*:\s*reduce/.test(p))
    for (const decl of block.decls) {
      const { prop, value } = decl
      if (prop.startsWith('--') && tokenBlock) continue

      if (HEX_COLOR.test(value) || COLOR_FN.test(stripVarRefs(value)) || hasNamedColor(value)) {
        push(block, decl, 'colour', 'use a colour token (var(--…)); a literal cannot flip with the theme')
        continue
      }

      if (SPACING_PROPS.has(prop)) {
        const raw = stripVarRefs(value)
        const overs = [...raw.matchAll(LENGTH)].filter((m) => Math.abs(parseFloat(m[1])) > HAIRLINE_MAX).map((m) => m[0])
        if (overs.length) push(block, decl, 'spacing', `raw spacing ${overs.join(', ')}; use a spacing token (var(--sp-…)); only 0 and ≤${HAIRLINE_MAX}px hairlines may be raw`)
      }

      if (focus) {
        if ((prop === 'outline' || prop === 'outline-width') && !/^(?:none|0)\b/.test(value) && !value.includes('var(--focus-ring-width)')) {
          push(block, decl, 'ring-width', 'a focus ring is var(--focus-ring-width) wide')
        }
        if (prop === 'box-shadow' && value.includes('var(--focus-ring)') && !value.includes('var(--focus-ring-width)')) {
          push(block, decl, 'ring-width', 'a ring drawn as a box-shadow is var(--focus-ring-width) wide')
        }
        if (prop === 'outline-offset' && !RING_OFFSETS.has(value)) {
          push(block, decl, 'ring-offset', 'the ring sits at var(--focus-ring-offset), or var(--focus-ring-offset-inset) on an edge-to-edge control')
        }
      }

      if (/^(?:transition|animation)(?:$|-name|-property)/.test(prop) && !NO_MOTION.test(value) && !motionOk) {
        push(block, decl, 'motion', 'motion is opt-in: declare it inside @media (prefers-reduced-motion: no-preference)')
      }

      if ((prop === 'animation' || prop === 'animation-iteration-count') && /\binfinite\b/.test(value) && !new RegExp(`(?:^|[\\s,])${BUSY_SPINNER}(?:$|[\\s,])`).test(value)) {
        push(block, decl, 'loop', `only the busy spinner (${BUSY_SPINNER}) loops; a skeleton, pulse or live dot is static`)
      }

      if ((prop === 'width' || prop === 'height') && targetsIcon(block.prelude) && !ICON_TOKENS.test(value)) {
        push(block, decl, 'icon', 'a Lucide icon is var(--ic-sm), var(--ic-md) or var(--ic-lg)')
      }

      if (STROKE_PROPS.test(prop)) {
        const wide = [...stripVarRefs(value).matchAll(LENGTH)].some((m) => Math.abs(parseFloat(m[1])) > 1) || /var\(--sp-\d\)/.test(value)
        if (wide) push(block, decl, 'stroke', 'a rail, stripe or underline is var(--stroke-emphasis) (or the 1px hairline)')
      }
      if (prop === 'box-shadow') {
        const stripe = value.match(INSET_STRIPE)
        if (stripe && (stripe[1].startsWith('var(') || Math.abs(parseFloat(stripe[1])) > 1)) push(block, decl, 'stroke', 'an inset stripe is var(--stroke-emphasis) wide')
      }

      if (/^(?:-webkit-)?backdrop-filter$/.test(prop) && !/^none\b/.test(value) && !inTransparencyAllowed(block.context)) {
        push(block, decl, 'blur', 'blur is opt-in: declare it inside @media (prefers-reduced-transparency: no-preference) over an opaque default')
      }
    }
  }
  return out
}

/** Message-only form, kept for the gate teeth-tests in scripts/gates.test.mjs. */
export const lintCssText = (rawText, file) => lintCssDecls(rawText, file).map((v) => v.message)

const ALLOWLIST = 'scripts/testdata/css-token-lint.allowlist.yaml'
const ALLOW_FIELDS = ['file', 'selector', 'prop', 'value', 'check']
const allowKey = (v) => ALLOW_FIELDS.map((f) => v[f]).join('\u0000')

/**
 * Split violations into allowed and new ones, and report allowlist entries that no
 * longer match anything (stale: the literal was fixed, so the entry must go).
 */
export function applyAllowlist(violations, entries) {
  const allowed = new Map(entries.map((e) => [allowKey(e), e]))
  const used = new Set()
  const fresh = []
  for (const v of violations) {
    const k = allowKey(v)
    if (allowed.has(k)) used.add(k)
    else fresh.push(v)
  }
  const stale = entries.filter((e) => !used.has(allowKey(e)))
  return { fresh, stale }
}

export function loadAllowlist() {
  const doc = loadStrictYaml(ALLOWLIST)
  if (!Array.isArray(doc.entries)) throw new Error(`${ALLOWLIST}: entries must be a list`)
  const seen = new Set()
  for (const e of doc.entries) {
    const keys = Object.keys(e)
    const bad = keys.filter((k) => !ALLOW_FIELDS.includes(k))
    const missing = ALLOW_FIELDS.filter((k) => typeof e[k] !== 'string' || !e[k])
    if (bad.length || missing.length) throw new Error(`${ALLOWLIST}: entry ${JSON.stringify(e)} unknown=${bad.join(',')} missing=${missing.join(',')}`)
    if (seen.has(allowKey(e))) throw new Error(`${ALLOWLIST}: duplicate entry ${JSON.stringify(e)}`)
    seen.add(allowKey(e))
  }
  return doc.entries
}

/** Lint every shipped source sheet (optionally with some texts replaced) against the allowlist. */
export function lintShippedSheets(overrides = {}, extraAllowEntries = []) {
  const files = shippedSourceSheets()
  const violations = files.flatMap((file) => lintCssDecls(overrides[file] ?? readFileSync(join(ROOT, file), 'utf8'), file))
  return { files, violations, ...applyAllowlist(violations, [...loadAllowlist(), ...extraAllowEntries]) }
}

/**
 * The whole source-side CSS gate: ownership + lint + allowlist burn-down. Returns the
 * failure report (null when clean). The build runs it with no arguments; the mutation
 * test passes planted texts / allowlist entries through the SAME path.
 */
export async function runCssLint(overrides = {}, extraAllowEntries = []) {
  const { checkSourceOwnership, checkIconSizeLiterals, checkAppFontPath } = await import('./css-guards.mjs')
  const ownership = checkSourceOwnership(overrides)
  const icons = checkIconSizeLiterals(overrides)
  const fonts = checkAppFontPath(overrides)
  const { files, violations, fresh, stale } = lintShippedSheets(overrides, extraAllowEntries)
  const report =
    ownership.length || icons.length || fonts.length || fresh.length || stale.length
      ? [
          'CSS lint FAILED in scripts/css-token-lint.mjs.',
          ...(ownership.length
            ? ['What went wrong: a surface rule has more than one source (keep it in its owner sheet only):', ...ownership.map((p) => `  - ${p}`)]
            : []),
          ...(icons.length
            ? ['What went wrong: a JSX icon is sized below the icon tokens:', ...icons.map((p) => `  - ${p}`)]
            : []),
          ...(fonts.length
            ? ['What went wrong: the app path loads fonts some other way than the <link> in index.html:', ...fonts.map((p) => `  - ${p}`)]
            : []),
          ...(fresh.length
            ? ['What went wrong: a shipped stylesheet hardcodes a value the tokens own, or animates outside the motion query:', ...fresh.map((v) => `  - ${v.message}`)]
            : []),
          ...(stale.length
            ? [`What went wrong: ${ALLOWLIST} lists exceptions that no longer occur (the value was fixed); delete them:`, ...stale.map((e) => `  - ${JSON.stringify(e)}`)]
            : []),
          'Why it matters: shipped CSS drives colour, spacing, focus rings and motion from the tokens so both themes,',
          'the spacing scale, the ring policy and static-first motion hold for every consumer; one source per rule keeps',
          'consumers from getting whichever copy their import order happens to favour.',
          'How to fix: use the matching var(--…) token, move motion into @media (prefers-reduced-motion: no-preference),',
          'or delete the duplicate rule. Add an allowlist entry only for a reviewed, deliberate exception.',
        ].join('\n')
      : null
  return { report, files, violations }
}

// Main: only when run directly, NOT when a test imports the pure functions.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const { report, files, violations } = await runCssLint()
  if (report) throw new Error(report)
  console.log(`css lint: ${files.length} shipped stylesheet(s) scanned; ${violations.length} allowlisted exception(s), no new violations; one source per surface rule.`)
}
