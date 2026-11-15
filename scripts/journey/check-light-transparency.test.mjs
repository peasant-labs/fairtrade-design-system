import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { assertLightTransparency } from './check-light-transparency.mjs'

const cases = parse(readFileSync('scripts/testdata/journey-light-transparency.yaml', 'utf8')).cases
test('report requires an executed light transparency check', () => {
  assert.deepEqual(cases.map((row) => row.name).sort(), ['passed-light', 'skipped-light', 'wrong-theme'])
  for (const row of cases) {
    const report = { suites: [{ specs: [{ file: 'app-validate.journey.mjs', title: 'honors reduced transparency', tests: [{ projectName: 'light', expectedStatus: 'passed', results: [{ status: row.status, stdout: [{ text: `reduced transparency [light]: ${JSON.stringify({ theme: row.theme })}` }] }] }] }] }] }
    if (row.error) assert.throws(() => assertLightTransparency(report), new RegExp(row.error), row.name)
    else assert.doesNotThrow(() => assertLightTransparency(report), row.name)
  }
})
