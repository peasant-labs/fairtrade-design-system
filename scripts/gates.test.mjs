#!/usr/bin/env node
/* Re-runnable teeth-tests for the build-time surface gates.
   ────────────────────────────────────────────────────────────────────────────
   The bundle-isolation guard (scripts/surface-namespaces.mjs → finalize-lib-build
   .mjs + assert-pack-contents.mjs) and the CSS-tokenization lint (scripts/css-token
   -lint.mjs) are load-bearing: they are what stop a peasant ./graph bundle from
   shipping village ./commons surfaces, and a lifted surface from hardcoding a
   non-token colour/spacing. These tests feed SYNTHETIC inputs through the gates'
   pure cores and assert the gate FAILS on a bad input and PASSES on a clean one —
   so a future Vite/config refactor cannot silently neuter a gate.

   Also asserts the three vendored png-diff.mjs copies (this canonical + the peasant
   and village harness copies) have identical diff LOGIC (header comments ignored),
   so the two-arm imgdiff can never disagree on what "a pixel differs" means.

   Run: `pnpm test:gates` (also wired into build:lib). Dependency-free (node:assert). */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findForeignNamespaces, GRAPH_NAMESPACES, COMMONS_NAMESPACES, ANALYTICS_NAMESPACES } from './surface-namespaces.mjs'
import { lintCssText } from './css-token-lint.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let failed = 0
const check = (name, fn) => {
  try {
    fn()
    console.log('PASS', name)
  } catch (e) {
    console.error('FAIL', name, '—', e.message)
    failed++
  }
}

/* ── bundle-isolation guard (findForeignNamespaces) ──────────────────────────── */

check('isolation: a commons namespace leaked into the graph bundle IS caught', () => {
  const leaked = findForeignNamespaces('.gmp-node{color:var(--ink)} .cex-card{}', COMMONS_NAMESPACES)
  assert.ok(leaked.includes('cex-'), 'expected cex- to be flagged as foreign in the graph bundle')
})

check('isolation: a graph namespace leaked into the commons bundle IS caught', () => {
  const leaked = findForeignNamespaces('.cex-card{} .gmp-node{}', GRAPH_NAMESPACES)
  assert.ok(leaked.includes('gmp-'), 'expected gmp- to be flagged as foreign in the commons bundle')
})

check('isolation: the analytics namespace leaked into the graph bundle IS caught', () => {
  const leaked = findForeignNamespaces('.gmp-node{} .gan-chart{}', ANALYTICS_NAMESPACES)
  assert.ok(leaked.includes('gan-'), 'expected gan- to be flagged as foreign in the graph bundle')
})

check('isolation: the trajectory-graph namespace leaked into the commons bundle IS caught', () => {
  const leaked = findForeignNamespaces('.cex-card{} .tb-graph{}', GRAPH_NAMESPACES)
  assert.ok(leaked.includes('tb-'), 'expected tb- to be flagged as foreign in the commons bundle')
})

check('isolation: the trajectory-graph namespace leaked into the analytics bundle IS caught', () => {
  const leaked = findForeignNamespaces('.gan-chart{} .tb-gnode-handle{}', GRAPH_NAMESPACES)
  assert.ok(leaked.includes('tb-'), 'expected tb- to be flagged as foreign in the analytics bundle')
})

check('isolation: a namespace is matched in a JS class string, not only a CSS selector', () => {
  const leaked = findForeignNamespaces('const c = "tb-root tb-graph"', GRAPH_NAMESPACES)
  assert.ok(leaked.includes('tb-'), 'expected tb- to be flagged inside a bundled className string')
})

// The false-positive guard. This library ships `.txn-tb-chip` / `.txn-tb-meta`
// (transcript `txn-` selectors that merely CONTAIN the letters "tb-"). A plain
// substring test would report a tb- leak in every bundle carrying the transcript
// surface, so the guard must match only where a class NAME can begin.
check('isolation: a class name that merely EMBEDS a namespace is NOT flagged', () => {
  assert.deepEqual(
    findForeignNamespaces('.cex-card{} .txn-tb-chip{} .txn-tb-meta{}', GRAPH_NAMESPACES),
    [],
    '.txn-tb-chip embeds "tb-" mid-identifier and must not be read as the tb- namespace',
  )
})

check('isolation: a clean graph bundle (own .gmp- + .tb- + shared .iu-) PASSES', () => {
  assert.deepEqual(
    findForeignNamespaces('.gmp-node{} .tb-graph{} .iu-shell{}', [...COMMONS_NAMESPACES, ...ANALYTICS_NAMESPACES]),
    [],
    'a graph bundle carrying both of its own namespaces plus the shared iu- must not be flagged',
  )
})

check('isolation: a clean graph bundle (own .gmp- + shared .iu-) PASSES', () => {
  assert.deepEqual(
    findForeignNamespaces('.gmp-node{} .iu-shell{}', [...COMMONS_NAMESPACES, ...ANALYTICS_NAMESPACES]),
    [],
    'a graph bundle with only its own + the shared iu- namespaces must not be flagged',
  )
})

check('isolation: a clean analytics bundle (own .gan- + shared .iu-) PASSES', () => {
  assert.deepEqual(
    findForeignNamespaces('.gan-root{} .gan-card{} .iu-shell{}', [...GRAPH_NAMESPACES, ...COMMONS_NAMESPACES]),
    [],
    'an analytics bundle with only its own + the shared iu- namespaces must not be flagged',
  )
})

/* ── CSS-tokenization lint (lintCssText) ─────────────────────────────────────── */

check('css-lint: a #hex colour FAILS', () => {
  assert.ok(lintCssText('.gmp-x{color:#ff0000}', 't.css').length >= 1, 'a #hex colour must be flagged')
})

check('css-lint: a colour-function (rgb/hsl/oklch) FAILS', () => {
  assert.ok(lintCssText('.gmp-x{color:rgb(1,2,3)}', 't.css').length >= 1)
  assert.ok(lintCssText('.gmp-x{background:oklch(0.5 0.1 200)}', 't.css').length >= 1)
})

check('css-lint: a NAMED colour (red / white) FAILS', () => {
  assert.ok(lintCssText('.gmp-x{color:red}', 't.css').length >= 1, '`color: red` must be flagged')
  assert.ok(lintCssText('.cex-y{background:white}', 't.css').length >= 1, '`background: white` must be flagged')
})

check('css-lint: a colour-word var() TOKEN name does NOT false-positive', () => {
  // The token NAME embeds a colour word but the value is a var() reference, not a
  // bare named colour — this DS palette has --olive/--teal/--clay/--mauve and a
  // surface may use var(--red-600); none may trip the named-colour check.
  assert.deepEqual(lintCssText('.gmp-x{color:var(--red-600)}', 't.css'), [], 'var(--red-600) must pass')
  assert.deepEqual(lintCssText('.gmp-y{color:var(--olive)}', 't.css'), [], 'var(--olive) must pass')
  assert.deepEqual(lintCssText('.cex-z{background:var(--teal-2)}', 't.css'), [], 'var(--teal-2) must pass')
})

check('css-lint: raw spacing on a spacing property FAILS', () => {
  assert.ok(lintCssText('.gmp-x{padding:12px}', 't.css').length >= 1, '`padding: 12px` must be flagged')
  assert.ok(lintCssText('.gmp-x{margin:16px 24px}', 't.css').length >= 1)
})

check('css-lint: tokens + hairline + theme-safe keywords PASS clean', () => {
  const v = lintCssText(
    '.gmp-x{color:var(--ink);background:transparent;border:1px solid currentColor;padding:0 var(--sp-3);margin:1px;gap:var(--sp-2)}',
    't.css',
  )
  assert.deepEqual(v, [], 'tokenized colour/spacing, a 1px hairline, transparent + currentColor must all pass; got: ' + v.join(' | '))
})

check('css-lint: a one-off dimension (width/min-width/box-shadow) is NOT spacing-linted', () => {
  // width/min-width/box-shadow legitimately carry raw lengths (matching the DS convention).
  assert.deepEqual(lintCssText('.gmp-x{min-width:180px;width:240px;box-shadow:inset 2px 0 0 var(--amber)}', 't.css'), [])
})

/* ── vendored png-diff.mjs logic sync (no drift across the 3 copies) ──────────── */

// Strip the leading block-comment header (the only intentional per-copy difference),
// then hash the executable body. Identical bodies ⇒ the imgdiff means the same thing
// in every repo.
const logicHash = (src) => createHash('sha256').update(src.replace(/^\s*\/\*[\s\S]*?\*\//, '').trim()).digest('hex')
const CANON = join(ROOT, 'scripts', 'png-diff.mjs')
// The two app harness copies, resolved relative to this repo (best-effort: the
// cross-repo check runs where the sibling worktrees exist, and skips-with-note
// when they don't, while the canonical is always self-validated below).
const VENDORED = [
  '../../peasant/fairtrade-1--breaking--adopt-fairtrade-design-system/web/scripts/visual/png-diff.mjs',
  '../../village/fairtrade-1--breaking--adopt-fairtrade-design-system/frontend/scripts/visual/png-diff.mjs',
]

check('png-diff: the canonical diff primitive exports dataUrl + diffPixels', () => {
  const src = readFileSync(CANON, 'utf8')
  assert.ok(/export const dataUrl/.test(src) && /export const diffPixels/.test(src))
})

check('png-diff: vendored harness copies match the canonical diff logic (no drift)', () => {
  const canonHash = logicHash(readFileSync(CANON, 'utf8'))
  let compared = 0
  for (const rel of VENDORED) {
    const p = join(ROOT, rel)
    if (!existsSync(p)) {
      console.log('  note: vendored copy not present in this checkout (skipped):', rel)
      continue
    }
    assert.equal(
      logicHash(readFileSync(p, 'utf8')),
      canonHash,
      `png-diff DRIFT: ${rel} diff logic differs from the canonical scripts/png-diff.mjs — re-vendor it`,
    )
    compared++
  }
  console.log(`  compared ${compared}/${VENDORED.length} vendored png-diff copies against the canonical`)
})

if (failed) {
  console.error(`\ntest:gates — ${failed} gate teeth-test(s) FAILED`)
  process.exit(1)
}
console.log('\ntest:gates — all gate teeth-tests passed')
