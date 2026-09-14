#!/usr/bin/env node
/* Packed-tarball consumer harness. scripts/packed-tarball-roundtrip.test.mjs
   copies this file into a throwaway directory whose node_modules holds ONLY the
   extracted tarball plus symlinked runtime externals, so every import below
   resolves the published bytes. The fixture JSON drives every assertion; this
   file owns no case data and imports nothing from this repository's source. */
import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const inputPath = process.argv[2]
if (!inputPath) {
  throw new Error('packed-tarball consumer was invoked without its fixture JSON path; run it through scripts/packed-tarball-roundtrip.test.mjs, not directly.')
}
const input = JSON.parse(readFileSync(inputPath, 'utf8'))
const consumerRoot = realpathSync(input.consumerRoot)

// ── Import surface ───────────────────────────────────────────────────────────
// Every declared importable must resolve from the installed package, and the
// resolved module must live under the throwaway consumer, so a workspace link,
// dev-link, or repo-relative fallback can never satisfy this check.
const resolved = new Map()
for (const group of input.importGroups) {
  const specifier = `${input.packageName}/${group.subpath}`
  const target = realpathSync(fileURLToPath(import.meta.resolve(specifier)))
  assert.ok(target.startsWith(consumerRoot + sep), `${specifier} resolved to ${target}, outside the throwaway consumer ${consumerRoot}; the packed bytes were not the import target`)
  const mod = await import(specifier)
  for (const name of group.names) {
    assert.ok(name in mod, `${specifier} is missing the ${name} export in the packed package`)
    assert.ok(typeof mod[name] === 'function', `${specifier}.${name} is ${typeof mod[name]}, expected a callable export`)
    resolved.set(name, mod[name])
  }
}

const adaptTranscript = resolved.get('adaptTranscript')
const prefilterTurns = resolved.get('prefilterTurns')

// ── Roundtrip ────────────────────────────────────────────────────────────────
for (const testCase of input.cases) {
  const expect = testCase.expect
  const vm = adaptTranscript(testCase.payload, undefined, undefined, { relationshipNavigation: testCase.navigation })
  assert.deepEqual(vm.turns.map(turn => turn.index), expect.turnIndices, `${testCase.name}: retained turn indices`)
  assert.equal(vm.turns.length, expect.turnCount, `${testCase.name}: retained turn count`)
  assert.equal(vm.session.turnCount, expect.turnCount, `${testCase.name}: session turn count`)
  assert.ok(Object.hasOwn(vm.session, 'inputSubmissionCount'), `${testCase.name}: inputSubmissionCount must be present, not absent`)
  assert.equal(vm.session.inputSubmissionCount, expect.inputSubmissionCount, `${testCase.name}: measured input submission count`)
  assert.deepEqual(prefilterTurns(testCase.payload.turns).map(turn => turn.index), expect.turnIndices, `${testCase.name}: prefilterTurns keeps the same retained turns`)

  const text = vm.turns.find(turn => turn.index === expect.textTurnIndex)
  assert.equal(text?.content, expect.textContent, `${testCase.name}: text turn content`)
  assert.equal(text?.thinking, undefined, `${testCase.name}: text turn must not fold a thinking block`)
  const thinking = vm.turns.find(turn => turn.index === expect.thinkingTurnIndex)
  assert.equal(thinking?.thinking?.text, expect.thinkingText, `${testCase.name}: thinking turn content`)
  assert.equal(thinking?.content, '', `${testCase.name}: thinking turn must not duplicate its text as content`)

  assert.deepEqual(vm.relationships.map(row => row.label), expect.relationshipLabels, `${testCase.name}: cooked relationship labels`)
  assert.deepEqual(vm.relationships.flatMap(row => row.navigation ? [row.navigation.localId ?? row.navigation.transcriptId] : []), expect.relationshipTargets, `${testCase.name}: cooked relationship navigation targets`)
  assert.equal(vm.relationships[0]?.navigation?.status, expect.contextNavigationStatus, `${testCase.name}: context relationship navigation status`)
  assert.equal(vm.relationships[0]?.navigation?.anchor?.sourceRevisionRef, expect.contextAnchorRevision, `${testCase.name}: exact context anchor revision`)
  assert.equal(vm.relationships[1]?.navigation?.status, expect.starterNavigationStatus, `${testCase.name}: starter relationship navigation status`)
  assert.equal(vm.relationships[1]?.navigation?.anchor, undefined, `${testCase.name}: starter relationship must not carry an exact anchor`)
  assert.ok(vm.relationships[0]?.navigation?.localId, `${testCase.name}: context relationship navigation must be cooked, not merely labelled`)
}

// ── Fail-closed refusals ─────────────────────────────────────────────────────
// An unsupported payload must be REFUSED, never stripped or silently degraded
// into a transcript that omits the unrecognized evidence.
for (const refusal of input.refusals) {
  let error
  try {
    adaptTranscript(refusal.payload, undefined, undefined, { relationshipNavigation: refusal.navigation })
  } catch (thrown) {
    error = thrown
  }
  assert.ok(error, `${refusal.name}: packed adaptTranscript returned a value for an unsupported payload instead of refusing it`)
  assert.ok(error instanceof TypeError, `${refusal.name}: refusal must be a TypeError, got ${error?.constructor?.name}`)
  assert.match(error.message, /adaptTranscript refused/, `${refusal.name}: refusal must name adaptTranscript`)
  assert.ok(error.message.includes(refusal.expectedError), `${refusal.name}: expected the refusal to explain "${refusal.expectedError}", got "${error.message}"`)
}

console.log(`packed tarball consumer OK: ${input.importGroups.reduce((n, group) => n + group.names.length, 0)} importables resolved, ${input.cases.length} roundtrip case retained, ${input.refusals.length} unsupported payloads refused`)
