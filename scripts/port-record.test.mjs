#!/usr/bin/env node
/* Port record for the three open pull requests whose prose this delivery does not port (#102
   heading case, #103 breadcrumb links, #104 section containers). Each source states the pull
   request number, its head SHA, the file the hunk lives in, the destination section it lands in,
   the destination, who owns the port and
   the hunk itself, copied from that SHA. The check:

     - holds the source set to the required-name manifest, so a source cannot be dropped or invented;
     - requires every recorded field, so a PR number, head SHA, destination section, hunk or port
       duty cannot go missing, and the destination section must exist in DESIGN.md;
     - compares a hunk with normalized identity (whitespace collapsed, the leading `- **label**`
       marker and its emphasis ignored), so DESIGN.md wrapping is tolerated and a hunk cannot
       silently weaken;
     - requires a hunk this delivery ports to be in DESIGN.md, and requires a hunk a later pull
       request owns NOT to be there yet, so unshipped behavior is never recorded ahead of its code.

   Cases: scripts/testdata/port-record.yaml (+ .manifest.yaml).
   Run: pnpm test:port-record */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadStrictYaml, assertExactNames } from './css-source.mjs'

const FIXTURE = 'scripts/testdata/port-record.yaml'
const MANIFEST = 'scripts/testdata/port-record.manifest.yaml'
const PORT_DUTIES = ['ours', 'later-pr']
const DESTINATION = 'DESIGN.md'

/* Compare with normalized identity: drop the leading `- **label**` list marker and its emphasis,
   drop emphasis and code markers, collapse whitespace. Content stays exact. */
export function normalizeHunk(text) {
  return String(text)
    .replace(/^\s*-\s*\*\*(.*?)\*\*\s*/, '$1 ')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** @param {{name: string, pr: number, headSha: string, file: string, destination: string, portedBy: string, added: string}} row */
export function assertPortRecord(row, designText) {
  assert.ok(typeof row.name === 'string' && row.name.trim(), 'a recorded source needs a name')
  assert.ok(Number.isInteger(row.pr) && row.pr > 0, `${row.name}: source PR number missing`)
  assert.match(String(row.headSha), /^[0-9a-f]{40}$/, `${row.name}: source head SHA missing, so the recorded hunk cannot be tied to a revision`)
  assert.ok(typeof row.file === 'string' && /^[\w./-]+\.md$/.test(row.file), `${row.name}: source file missing`)
  assert.ok(typeof row.destinationSection === 'string' && row.destinationSection.trim(), `${row.name}: the destination section missing`)
  assert.ok(designText.includes(row.destinationSection), `${row.name}: the destination section is not a heading in DESIGN.md`)
  assert.equal(row.destination, DESTINATION, `${row.name}: the port destination is ${DESTINATION}, the one design record`)
  assert.ok(PORT_DUTIES.includes(row.portedBy), `${row.name}: port duty must be one of ${PORT_DUTIES.join('/')}`)
  assert.ok(typeof row.added === 'string' && row.added.trim(), `${row.name}: source hunk missing`)
  const hunk = normalizeHunk(row.added)
  const design = normalizeHunk(designText)
  if (row.portedBy === 'ours') {
    assert.ok(design.includes(hunk), `${row.name}: this delivery owns the port but DESIGN.md does not contain the recorded hunk`)
  } else {
    assert.ok(!design.includes(hunk), `${row.name}: DESIGN.md already carries a hunk the source pull request owns, so unshipped prose was recorded ahead of its code`)
  }
}

const record = loadStrictYaml(FIXTURE)
const manifest = loadStrictYaml(MANIFEST)
assertExactNames(record.sources.map((row) => row.name), manifest.requiredSourceNames, 'port record sources')
assertExactNames(manifest.mutations.map((row) => row.name), manifest.requiredMutationNames, 'port record mutations')

const design = readFileSync(join(ROOT, DESTINATION), 'utf8')
for (const row of record.sources) assertPortRecord(row, design)

for (const mutation of manifest.mutations) {
  if (mutation.names) {
    assert.throws(() => assertExactNames(mutation.names, manifest.requiredSourceNames, 'port record sources'), new RegExp(mutation.error), mutation.name)
  } else {
    assert.ok(mutation.row, `${mutation.name}: the mutation must carry a row or a name list`)
    assert.throws(() => assertPortRecord(mutation.row, design), new RegExp(mutation.error), mutation.name)
  }
  console.log(`PASS ${mutation.name}`)
}

const later = record.sources.filter((row) => row.portedBy === 'later-pr').map((row) => row.name)
console.log(`port record: ${record.sources.length} source(s) recorded (${later.join(', ') || 'none'} awaiting the source pull request); all ${manifest.mutations.length} mutation(s) killed.`)
