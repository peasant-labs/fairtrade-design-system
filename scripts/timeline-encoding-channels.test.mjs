#!/usr/bin/env node
/* Source-text regression guard for the
   timeline's visual-encoding channel allocation: each semantic fact resolves
   to its own channel, no channel is claimed twice, dash stays reserved
   exclusively for forked/merged-out-of-view, and the hover highlight carries
   the width-step floor in BOTH motion states with the animated glow layered
   on top in normal motion only (two independently named failure modes, per
   this repo's own convention: a width-step-only-in-normal-motion render must
   redden, and a glow-only render must redden).

   Asserts against SOURCE (not the built/minified dist), same discipline as
   mobile-layout.test.mjs: a future edit that reintroduces a channel overload
   or drops either half of the hover encoding fails this loudly.

   Run: `node scripts/timeline-encoding-channels.test.mjs` (wired into build:lib). */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const FILES = {
  'CommitGraph.jsx': resolve(ROOT, 'src/ui/CommitGraph.jsx'),
  'CommitGraph.css': resolve(ROOT, 'src/ui/CommitGraph.css'),
  'timelinePrimitives.css': resolve(ROOT, 'src/ui/graph/timelinePrimitives.css'),
  'GhostCommitNode.jsx': resolve(ROOT, 'src/ui/graph/GhostCommitNode.jsx'),
  'GhostGroup.jsx': resolve(ROOT, 'src/ui/graph/GhostGroup.jsx'),
}

const fixture = parseOne(readFileSync(resolve(HERE, 'testdata/timeline-encoding-channels.yaml'), 'utf8'), 'timeline-encoding-channels fixture')
const manifest = parseOne(readFileSync(resolve(HERE, 'testdata/timeline-encoding-channels.manifest.yaml'), 'utf8'), 'timeline-encoding-channels manifest')

if (manifest.expectedCaseCount !== manifest.caseNames.length) throw new Error('manifest expectedCaseCount does not match its own caseNames length')
if (fixture.expectedCaseCount !== manifest.expectedCaseCount) throw new Error('fixture expectedCaseCount does not match the manifest')
if (fixture.cases.length !== fixture.expectedCaseCount) throw new Error(`fixture must contain exactly ${fixture.expectedCaseCount} cases`)
const fixtureNames = new Set(fixture.cases.map((c) => c.name))
if (fixtureNames.size !== fixture.cases.length) throw new Error('fixture has a duplicate case name')
for (const name of manifest.caseNames) if (!fixtureNames.has(name)) throw new Error(`manifest declares a case name absent from the fixture: ${name}`)
for (const name of fixtureNames) if (!manifest.caseNames.includes(name)) throw new Error(`fixture declares a case name absent from the manifest: ${name}`)

/** Reads live source text for `file` at the moment of the call (never cached), so mutation runs see the mutated copy. */
function sourceOf(sources, file) {
  return sources[file]
}

function runCase(testCase, sources) {
  const text = sourceOf(sources, testCase.file)
  for (const needle of testCase.mustContain ?? []) {
    assert.ok(text.includes(needle), `${testCase.name}: ${testCase.file} must contain ${JSON.stringify(needle.slice(0, 60))}`)
  }
  for (const needle of testCase.mustNotContain ?? []) {
    assert.ok(!text.includes(needle), `${testCase.name}: ${testCase.file} must NOT contain ${JSON.stringify(needle)}`)
  }
  for (const cross of testCase.crossFile ?? []) {
    const crossText = sourceOf(sources, cross.file)
    for (const needle of cross.mustContain ?? []) assert.ok(crossText.includes(needle), `${testCase.name}: ${cross.file} must contain ${JSON.stringify(needle)}`)
    for (const needle of cross.mustNotContain ?? []) assert.ok(!crossText.includes(needle), `${testCase.name}: ${cross.file} must NOT contain ${JSON.stringify(needle)}`)
  }
  // mustContainWithin: `marker` must appear textually inside a block opened by `requiredAncestor`
  // (a crude but sufficient nesting check for these small, hand-authored CSS files: the ancestor's
  // opening brace must appear before the marker with no closing "}\n\n" (blank-line-separated top
  // level rule boundary) in between).
  for (const within of testCase.mustContainWithin ?? []) {
    assert.ok(markerIsWithin(text, within.marker, within.requiredAncestor), `${testCase.name}: ${JSON.stringify(within.marker.slice(0, 40))} must appear inside ${JSON.stringify(within.requiredAncestor)}`)
  }
  for (const outside of testCase.mustNotContainWithin ?? []) {
    assert.ok(!markerIsWithin(text, outside.marker, outside.forbiddenAncestor), `${testCase.name}: ${JSON.stringify(outside.marker.slice(0, 40))} must NOT appear inside ${JSON.stringify(outside.forbiddenAncestor)}`)
  }
}

/** True when `marker` occurs after the nearest preceding `ancestorOpen` with no intervening blank-line-terminated top-level rule close. */
function markerIsWithin(text, marker, ancestorOpen) {
  const markerIndex = text.indexOf(marker)
  if (markerIndex === -1) return false
  // The NEAREST preceding occurrence of the ancestor-open text -- there may be
  // several unrelated blocks earlier in the file opened by the same marker
  // text (e.g. more than one `@media (prefers-reduced-motion: no-preference) {`).
  const ancestorIndex = text.lastIndexOf(ancestorOpen, markerIndex)
  if (ancestorIndex === -1) return false
  // The media-query block closes with a bare "}\n\n" (a lone closing brace on its own line,
  // followed by a blank line) in this file's formatting convention -- if that boundary occurs
  // between the ancestor's opening brace and the marker, the marker has escaped the block.
  const between = text.slice(ancestorIndex + ancestorOpen.length, markerIndex)
  return !/\n}\n\n/.test(between)
}

// ── run every declared case against the real, unmutated source ──────────────
const liveSources = Object.fromEntries(Object.entries(FILES).map(([name, path]) => [name, readFileSync(path, 'utf8')]))
for (const testCase of fixture.cases) runCase(testCase, liveSources)

// ── cross-check: dash is used at exactly ONE call site across every file this
// fixture covers (the pre-existing "show older" ghost-history indicator) --
// catching a channel-overload regression that isn't tied to any single case. */
{
  const dashOccurrences = Object.values(liveSources).reduce((sum, text) => sum + (text.match(/dasharray/gi) ?? []).length, 0)
  assert.equal(dashOccurrences, 1, `dash must be used at exactly one call site (forked/merged-out-of-view); found ${dashOccurrences} across the covered files`)
}

console.log(`timeline encoding channels: ${fixture.cases.length} fixture cases passed against live source`)

// ── mutation guards: apply each named source mutation to an IN-MEMORY copy and
// prove the SAME case now reddens ────────────────────────────────────────────
if (!Array.isArray(manifest.mutationCases) || manifest.mutationCases.length === 0) {
  throw new Error('timeline-encoding-channels manifest must declare at least one mutationCases entry')
}
let killed = 0
for (const mutation of manifest.mutationCases) {
  const testCase = fixture.cases.find((c) => c.name === mutation.case)
  if (!testCase) throw new Error(`mutation ${JSON.stringify(mutation.name)} references an unknown case ${JSON.stringify(mutation.case)}`)
  const original = liveSources[mutation.file]
  if (!original.includes(mutation.find)) {
    throw new Error(`mutation ${JSON.stringify(mutation.name)}: find text not present in ${mutation.file} (verbatim, once) -- update the fixture's mutation to match the real source`)
  }
  const occurrences = original.split(mutation.find).length - 1
  if (occurrences !== 1) throw new Error(`mutation ${JSON.stringify(mutation.name)}: find text must occur exactly once in ${mutation.file}, found ${occurrences}`)
  const mutated = { ...liveSources, [mutation.file]: original.replace(mutation.find, mutation.replace) }
  let threw = false
  try {
    runCase(testCase, mutated)
  } catch {
    threw = true
  }
  if (!threw) throw new Error(`mutation ${JSON.stringify(mutation.name)} survived: case ${JSON.stringify(mutation.case)} still passed against the mutated source`)
  killed += 1
}

console.log(`timeline encoding channels: ${killed} mutation(s) killed (each named guard genuinely reddens)`)

function parseOne(text, label) {
  const documents = YAML.parseAllDocuments(text, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (errors.length) throw new Error(`${label} has invalid strict YAML or a duplicate key: ${errors.map((error) => error.message).join('; ')}`)
  if (documents.length !== 1) throw new Error(`${label} must contain exactly one YAML document`)
  return documents[0].toJS()
}
