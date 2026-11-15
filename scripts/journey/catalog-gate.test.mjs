import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { assertWritableCatalog, checkCatalog, listCatalog } from './catalog-gate.mjs'

const required = JSON.parse(readFileSync('scripts/testdata/journey-catalog.json', 'utf8'))
const cases = parse(readFileSync('scripts/testdata/journey-catalog-mutations.yaml', 'utf8')).cases

test('real browser-free catalog matches every required project and title', () => {
  checkCatalog(listCatalog(), required)
})

test('named mutations reject missing, duplicate, renamed and missing-project cases', () => {
  assert.deepEqual(cases.map((entry) => entry.name).sort(), ['dropped-test', 'duplicated-test', 'missing-project', 'renamed-test', 'write-missing-project'])
  for (const entry of cases) {
    const changed = structuredClone(required)
    if (entry.operation === 'drop') changed.pop()
    else if (entry.operation === 'duplicate') changed.push(changed[0])
    else if (entry.operation === 'rename') changed[0].title += ' renamed'
    else if (entry.operation === 'project' || entry.operation === 'project-write') changed.splice(0, changed.length, ...changed.filter((item) => item.project !== required[0].project))
    else assert.fail(`unknown mutation ${entry.operation}`)
    assert.throws(() => entry.operation === 'project-write' ? assertWritableCatalog(changed) : checkCatalog(changed, required), new RegExp(entry.expected), entry.name)
  }
})
