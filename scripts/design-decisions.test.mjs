import assert from 'node:assert/strict'
import { loadDecisionFixtures, assertDecisionResolved, assertNoMiddots } from './design-decisions.mjs'
import { assertExactNames } from './css-source.mjs'

const { register, guards, manifest } = loadDecisionFixtures()
assertExactNames(guards.cases.map(row => row.name), manifest.requiredCases, 'design guard cases')
assertExactNames(guards.mutations.map(row => row.name), manifest.requiredMutations, 'design guard mutations')
for (const row of guards.cases) {
  if (row.row) assertDecisionResolved(row.row, row.sources, guards.restatingFiles)
  else assertNoMiddots(row.sources, guards.allowedMiddots)
}
for (const mutation of guards.mutations) {
  const original = guards.cases.find(row => row.name === mutation.case)
  assert.ok(original, `${mutation.name}: fixture case missing`)
  const row = structuredClone(original)
  if (mutation.clearBinding) row.row.binding = null
  if (mutation.file) row.sources[mutation.file] = mutation.replace ?? (row.sources[mutation.file] + mutation.append)
  assert.throws(() => {
    if (row.row) assertDecisionResolved(row.row, row.sources, guards.restatingFiles)
    else assertNoMiddots(row.sources, guards.allowedMiddots)
  }, new RegExp(mutation.error), mutation.name)
  console.log(`PASS ${mutation.name}`)
}
console.log(`PASS decision register contract (${register.decisions.filter(row => row.binding === null).length} bindings pending; no completion claimed)`)
