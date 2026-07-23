#!/usr/bin/env node
/* ───────────────────────────────────────────────────────────────────────────
   mobile-layout — source-text regression guard for two real UAT-found mobile
   layout defects: commit-row buttons overflowing
   their narrow container, and the mounted transcript's persistent chrome
   (title/meta chips/turns toolbar) crowding out the transcript itself on a
   390px viewport. Follows this repo's smoke-script convention (no unit-test
   runner here — plain node scripts with `assert()`), the same style as
   smoke-transcript-ui.mjs and AppShellGeometry.test.ts's sibling in peasant.

   This asserts against SOURCE, not the built dist (which may minify/reorder
   declarations) — the fixture is the durable contract; a future edit that
   reverts either fix (e.g. drops width:100% off a <button> row, or removes
   the mobile compaction rules) fails this loudly instead of silently
   regressing until the next manual mobile eyeball.

   Run: `node scripts/mobile-layout.test.mjs` (wired into build:lib).
   ─────────────────────────────────────────────────────────────────────────── */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const manifest = YAML.parse(readFileSync(resolve(HERE, 'testdata/mobile-layout-invariants.manifest.yaml'), 'utf8'))
const fixture = YAML.parse(readFileSync(resolve(HERE, 'testdata/mobile-layout-invariants.yaml'), 'utf8'))

const results = []
function assert(id, desc, cond) {
  results.push({ id, desc, ok: !!cond })
}

if (fixture.invariants.length !== manifest.expectedInvariantCount) {
  console.error(
    `mobile-layout fixture drift: testdata/mobile-layout-invariants.yaml has ${fixture.invariants.length} invariant(s), ` +
      `manifest expects ${manifest.expectedInvariantCount}. Update the manifest when adding/removing a case (row-count guard).`,
  )
  process.exit(1)
}

const sourceCache = new Map()
function sourceOf(relPath) {
  if (!sourceCache.has(relPath)) sourceCache.set(relPath, readFileSync(resolve(ROOT, relPath), 'utf8'))
  return sourceCache.get(relPath)
}

/* mustContainAll[0] is the ANCHOR (a selector opener, e.g. ".cg-row {") that locates the rule
   block(s) this invariant is about; the remaining entries must appear WITHIN the SAME block's own
   text (up to its closing brace) — not merely anywhere in the file, and not merely in the FIRST
   block that happens to share the anchor's selector (this codebase legitimately reuses a selector
   across an unrelated base rule and a scoped @media rule — .txn-meta is exactly this: a base rule
   AND a mobile-only rule both open with ".txn-meta {"). So every occurrence of the anchor is
   collected, and the invariant passes if AT LEAST ONE of those blocks contains every remaining
   substring. Checking the whole file (no block-scoping at all) would let a declaration shared by a
   DIFFERENT, unrelated rule (e.g. .cg-older also has "width: 100%;") mask a real regression in
   THIS rule — the failure mode this scoping exists to prevent (see the FIXED comment for the
   mutation-proof that caught exactly that false pass during development). */
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
      `mobile-layout regression guard FAILED: ${fails.length}/${results.length} invariant(s) red.`,
      'What went wrong: a mobile-layout fix was reverted or weakened.',
      'Why it matters: without it, the commit-row buttons (Home picker, /review) overflow a narrow',
      'viewport, or the mounted transcript header/meta/toolbar crowd out the transcript stream again',
      '(the exact defects a real user flagged in UAT).',
      'Where: ' + fails.map((f) => f.id).join(', '),
      'How to fix: restore the named declaration(s) in the file the failing invariant names.',
    ].join('\n'),
  )
  process.exit(1)
}
console.log(`\nmobile-layout regression guard: all ${results.length} invariants passed.`)
