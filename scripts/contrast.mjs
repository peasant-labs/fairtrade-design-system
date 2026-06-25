#!/usr/bin/env node
/* contrast gate (IMPROVE.md item 12)
   the backstop that keeps the border/ink contrast fixes (items 1-2) from regressing.
   parses the design tokens straight out of src/index.css (single source of truth) and
   asserts, in BOTH themes:
     - every required text/surface pair clears WCAG AA (4.5:1, or 3:1 for large text)
     - every functional border / icon / focus ring clears 3:1 (WCAG 1.4.11 non-text)
   report-only pairs are printed but never fail the build (accent-as-text, informational).

   usage:
     node scripts/contrast.mjs            # check, exit 1 on any required failure
     node scripts/contrast.mjs --probe '#6f6a60' '#0e0e0c'   # ad-hoc ratio for one pair
*/
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
// Default to the src single-source-of-truth. `--css <path>` lets the lib build
// re-run the gate against the SHIPPED bytes (dist/lib/tokens.css after finalize),
// so a finalize copy-source bug can't evade contrast.
const cssArgIdx = process.argv.indexOf('--css')
const CSS =
  cssArgIdx !== -1 && process.argv[cssArgIdx + 1]
    ? resolve(process.cwd(), process.argv[cssArgIdx + 1])
    : join(HERE, '..', 'src', 'index.css')

/* ---- color math (WCAG 2.x) ---- */
function hexToRgb(hex) {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
}
function parseColor(value) {
  const raw = value.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return hexToRgb(raw)
  const rgba = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/i)
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] == null ? 1 : Number(rgba[4])]
  throw new Error(`unsupported color ${value}`)
}
function composite(over, under) {
  const alpha = over[3]
  return [
    Math.round(over[0] * alpha + under[0] * (1 - alpha)),
    Math.round(over[1] * alpha + under[1] * (1 - alpha)),
    Math.round(over[2] * alpha + under[2] * (1 - alpha)),
    1,
  ]
}
function relLum([r, g, b]) {
  const f = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contrast(a, b) {
  const la = relLum(a) + 0.05
  const lb = relLum(b) + 0.05
  return (Math.max(la, lb) / Math.min(la, lb))
}
function resolveColor(tokens, name, base = null) {
  const color = parseColor(tokens[name])
  if (color[3] === 1) return color
  if (!base) throw new Error(`${name} is translucent but no composite base was provided`)
  return composite(color, parseColor(tokens[base]))
}

/* ---- probe mode ---- */
const argv = process.argv.slice(2)
if (argv[0] === '--probe') {
  const [, fg, bg] = argv
  console.log(`${fg} on ${bg} = ${contrast(parseColor(fg), parseColor(bg)).toFixed(2)}:1`)
  process.exit(0)
}

/* ---- parse the two token blocks from index.css ---- */
function parseBlock(css, opener) {
  const start = css.indexOf(opener)
  if (start === -1) throw new Error(`token block not found: ${opener}`)
  const open = css.indexOf('{', start)
  // walk to the matching close brace
  let depth = 0, i = open
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') { depth--; if (depth === 0) break }
  }
  const body = css.slice(open + 1, i)
  const map = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g)) {
    map[m[1].slice(2)] = m[2]
  }
  return map
}

const css = readFileSync(CSS, 'utf8')
// match the selector WITH its brace so a mention inside a comment can't be picked up
const dark = parseBlock(css, ':root {')
const light = parseBlock(css, '[data-theme="light"] {')

/* ---- the checks ----
   kind 'text'   -> AA: min 4.5 (or 3 when large:true)
   kind 'nontext'-> 3:1 functional border / icon / ring
   required:false -> report only (never fails) */
const PAIRS = [
  // body + ink ramp as text
  { fg: 'ink', bg: 'canvas', kind: 'text' },
  { fg: 'ink', bg: 'surface', kind: 'text' },
  { fg: 'ink', bg: 'surface-2', kind: 'text' },
  { fg: 'ink-strong', bg: 'canvas', kind: 'text' },
  { fg: 'ink-strong', bg: 'surface', kind: 'text' },
  { fg: 'ink-2', bg: 'canvas', kind: 'text' },
  { fg: 'ink-2', bg: 'surface', kind: 'text' },
  { fg: 'ink-2', bg: 'surface-2', kind: 'text' },
  { fg: 'ink-3', bg: 'canvas', kind: 'text', note: 'labels/captions' },
  { fg: 'ink-3', bg: 'surface', kind: 'text', note: 'labels/captions' },
  { fg: 'ink-3', bg: 'surface-2', kind: 'text', note: 'labels/captions' },
  { fg: 'ink-4', bg: 'canvas', kind: 'text', note: 'meta/counts/line-numbers (text-safe)' },
  { fg: 'ink-4', bg: 'surface', kind: 'text', note: 'meta/counts/line-numbers (text-safe)' },
  { fg: 'ink-4', bg: 'surface-2', kind: 'text', note: 'meta/counts/line-numbers (text-safe)' },
  // primary button label
  { fg: 'on-amber', bg: 'amber', kind: 'text', note: 'primary button label' },
  // selected/toggled control label + unread count on the golden amber fill (both themes)
  { fg: 'amber-fill-ink', bg: 'amber-fill', kind: 'text', note: 'toggle/selected chip + unread count label' },
  // diff body text: required because add/del tokens are used directly as readable diff rows.
  { fg: 'add-text', bg: 'add-bg', bgBase: 'surface', kind: 'text', note: 'diff added line text' },
  { fg: 'del-text', bg: 'del-bg', bgBase: 'surface', kind: 'text', note: 'diff deleted line text' },
  // the toggle fill as a component boundary against the surfaces it sits on (1.4.11)
  { fg: 'amber-fill', bg: 'surface', kind: 'nontext', required: false, note: 'toggle fill boundary (report)' },
  { fg: 'amber-fill', bg: 'canvas', kind: 'nontext', required: false, note: 'toggle fill boundary (report)' },
  // functional borders / control outlines (1.4.11) — measured against the surfaces they bound
  { fg: 'rule-strong', bg: 'canvas', kind: 'nontext', note: 'control/input border on canvas fill' },
  { fg: 'rule-strong', bg: 'surface', kind: 'nontext', note: 'control border on panels' },
  { fg: 'rule-strong', bg: 'surface-2', kind: 'nontext', note: 'control border on elevated bars' },
  { fg: 'rule-strong', bg: 'surface-hover', kind: 'nontext', note: 'control border on hover surface' },
  // --rule is a DECORATIVE structural divider between same-tone surfaces (owner decision
  // 2026-06-16): raised for visibility but intentionally NOT held to 1.4.11's 3:1, which only
  // governs borders that identify a component/state (those use --rule-strong, required above).
  { fg: 'rule', bg: 'canvas', kind: 'nontext', required: false, note: 'divider (decorative, report)' },
  { fg: 'rule', bg: 'surface', kind: 'nontext', required: false, note: 'divider (decorative, report)' },
  { fg: 'rule', bg: 'surface-2', kind: 'nontext', required: false, note: 'divider (decorative, report)' },
  { fg: 'rule', bg: 'surface-hover', kind: 'nontext', required: false, note: 'divider (decorative, report)' },
  // the primary focus indicator is the 3px --focus-ring (required); the amber-dim border tint
  // on :focus/:hover is supplementary emphasis layered on top of it, so it is report-only.
  { fg: 'focus-ring', bg: 'canvas', kind: 'nontext', note: 'focus ring (primary indicator)' },
  { fg: 'focus-ring', bg: 'surface', kind: 'nontext', note: 'focus ring (primary indicator)' },
  { fg: 'amber-dim', bg: 'canvas', kind: 'nontext', required: false, note: 'supplementary :focus/:hover tint' },
  { fg: 'amber-dim', bg: 'surface', kind: 'nontext', required: false, note: 'supplementary :focus/:hover tint' },
  // accent-as-text — role/status accents are readable labels and must clear small-text AA.
  { fg: 'amber', bg: 'canvas', kind: 'text', note: 'links/accent text' },
  { fg: 'amber', bg: 'surface', kind: 'text', note: 'links/accent text' },
  { fg: 'amber-bright', bg: 'surface', kind: 'text', required: false, note: 'hover/highlight (large/bold)', large: true },
  { fg: 'teal', bg: 'surface', kind: 'text', note: 'user role text' },
  { fg: 'olive', bg: 'surface', kind: 'text', note: 'success/add text' },
  { fg: 'clay', bg: 'surface', kind: 'text', note: 'danger/del text' },
  { fg: 'mauve', bg: 'surface', kind: 'text', note: 'system/subagent text' },
]

function minFor(p) {
  if (p.kind === 'nontext') return 3
  return p.large ? 3 : 4.5
}

let failures = 0
for (const [themeName, tokens] of [['dark', dark], ['light', light]]) {
  console.log(`\n=== ${themeName} ===`)
  for (const p of PAIRS) {
    const fg = tokens[p.fg], bg = tokens[p.bg]
    if (!fg || !bg) { console.log(`  SKIP  ${p.fg} / ${p.bg} (token missing)`); continue }
    const ratio = contrast(resolveColor(tokens, p.fg), resolveColor(tokens, p.bg, p.bgBase))
    const min = minFor(p)
    const ok = ratio >= min
    const req = p.required !== false
    const tag = ok ? 'PASS' : req ? 'FAIL' : 'warn'
    if (!ok && req) failures++
    const label = `${p.fg} / ${p.bg}`.padEnd(30)
    console.log(`  ${tag.padEnd(5)} ${label} ${ratio.toFixed(2)}:1  (min ${min}${req ? '' : ', report'})${p.note ? '  ' + p.note : ''}`)
  }
}

console.log('')
if (failures) {
  console.error(`contrast gate: ${failures} required pair(s) below threshold`)
  process.exit(1)
}
console.log('contrast gate: all required pairs pass in both themes')
