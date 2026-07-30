#!/usr/bin/env node
/* ───────────────────────────────────────────────────────────────────────────
   transcript-composite-width — source-text regression guard for the real UAT-found "cramped
   transcript composite" defect: the main content sat boxed into a narrow column with wide empty
   gutters on both sides at desktop widths, because `.txn-center` (a real <section>) inherits
   the presentation page's global `section { max-width; margin: 0 auto;
   padding: 0 var(--gutter); }` reset — an auto horizontal margin wins over
   grid stretch alignment, so the box shrink-wraps and centres inside its 1fr
   grid track instead of filling it.

   Follows this repo's smoke-script convention (no unit-test runner here —
   plain node scripts with `assert()`), the same style as
   mobile-layout.test.mjs and transcript-initial-position.render.test.mjs's
   sibling in this file. Asserts against SOURCE (never the built dist, which
   may minify/reorder declarations) — the fixture is the durable contract; a
   future edit that drops the neutralising declarations off `.txn-center`
   fails this loudly instead of silently reboxing the composite until the
   next manual desktop eyeball.

   Run: `node scripts/transcript-composite-width.test.mjs` (wired into build:lib).
   ─────────────────────────────────────────────────────────────────────────── */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const manifest = YAML.parse(readFileSync(resolve(HERE, 'testdata/transcript-composite-width-invariants.manifest.yaml'), 'utf8'))
const fixture = YAML.parse(readFileSync(resolve(HERE, 'testdata/transcript-composite-width-invariants.yaml'), 'utf8'))

const results = []
function assert(id, desc, cond) {
  results.push({ id, desc, ok: !!cond })
}

if (fixture.invariants.length !== manifest.expectedInvariantCount) {
  console.error(
    `transcript-composite-width fixture drift: testdata/transcript-composite-width-invariants.yaml has ${fixture.invariants.length} invariant(s), ` +
      `manifest expects ${manifest.expectedInvariantCount}. Update the manifest when adding/removing a case (row-count guard).`,
  )
  process.exit(1)
}

const sourceCache = new Map()
function sourceOf(relPath) {
  if (!sourceCache.has(relPath)) sourceCache.set(relPath, readFileSync(resolve(ROOT, relPath), 'utf8'))
  return sourceCache.get(relPath)
}

/* mustContainAll[0] is the ANCHOR (a selector opener, e.g. ".txn-center {") that locates the rule
   block(s) this invariant is about; the remaining entries must appear WITHIN the SAME block's own
   text (up to its closing brace) — not merely anywhere in the file. Every occurrence of the anchor
   is collected, and the invariant passes if AT LEAST ONE of those blocks contains every remaining
   substring (this codebase legitimately reuses a selector across an unrelated base rule and a
   scoped @media rule elsewhere; scoping this way prevents a declaration on a DIFFERENT, unrelated
   rule from masking a real regression in THIS rule). */
function allOccurrences(haystack, needle) {
  const indices = []
  let from = 0
  for (;;) {
    const i = haystack.indexOf(needle, from)
    if (i === -1) break
    indices.push(i)
    from = i + 1
  }
  return indices
}

for (const inv of fixture.invariants) {
  const source = sourceOf(inv.file)
  const [anchor, ...rest] = inv.mustContainAll
  const anchorIndices = allOccurrences(source, anchor)
  if (anchorIndices.length === 0) {
    assert(inv.id, `${inv.file}: ${inv.description}`, false)
    console.error(`  ${inv.id}: anchor ${JSON.stringify(anchor)} not found in ${inv.file}`)
    continue
  }
  const blocks = anchorIndices.map((anchorIndex) => {
    const blockEnd = source.indexOf('\n}', anchorIndex)
    return blockEnd === -1 ? source.slice(anchorIndex) : source.slice(anchorIndex, blockEnd)
  })
  const satisfied = blocks.some((block) => rest.every((needle) => block.includes(needle)))
  assert(inv.id, `${inv.file}: ${inv.description}`, satisfied)
  if (!satisfied) {
    const missingPerBlock = blocks.map((block) => rest.filter((needle) => !block.includes(needle)))
    console.error(
      `  ${inv.id}: no ${JSON.stringify(anchor)} block (${blocks.length} found) in ${inv.file} contains every required substring; ` +
        `closest gaps: ${JSON.stringify(missingPerBlock)}`,
    )
  }
}

const fails = results.filter((r) => !r.ok)
for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.id + ' — ' + r.desc)
if (fails.length) {
  console.error(
    [
      '',
      `transcript-composite-width regression guard FAILED: ${fails.length}/${results.length} invariant(s) red.`,
      'What went wrong: the .txn-center fix that neutralises the global `section { max-width; margin: 0 auto;',
      'padding: 0 var(--gutter) }` reset was reverted or weakened.',
      'Why it matters: without it, `.txn-center` (a real <section>) shrink-wraps and centres inside its 1fr',
      'grid track again, boxing the transcript composite into a narrow column with wide empty gutters on both',
      'sides at desktop widths (the exact defect a real user flagged in UAT).',
      'Where: ' + fails.map((f) => f.id).join(', '),
      'How to fix: restore the named declaration(s) in the file the failing invariant names.',
    ].join('\n'),
  )
  process.exit(1)
}
console.log(`\ntranscript-composite-width regression guard: all ${results.length} invariants passed.`)
