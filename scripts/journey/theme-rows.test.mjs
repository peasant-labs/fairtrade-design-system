import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { assertThemeRows, PROJECT_THEMES } from './theme-rows.mjs'

const mutationCases = parse(readFileSync('scripts/testdata/journey-theme-mutations.yaml', 'utf8')).cases
test('every gated fixture row runs in exactly one real project', () => {
  for (const file of ['scripts/testdata/publish-mounted.yaml', 'scripts/testdata/context-share.yaml']) {
    assertThemeRows(parse(readFileSync(file, 'utf8')).cases)
  }
  assert.deepEqual(PROJECT_THEMES, ['dark', 'light'])
})
test('unknown theme and matching zero or both projects fail', () => {
  assert.deepEqual(mutationCases.map((row) => row.name).sort(), ['matches-both-projects', 'matches-no-project', 'unknown-theme'])
  for (const mutation of mutationCases) {
    const row = { name: mutation.name, theme: mutation.kind === 'unknown' ? 'unknown' : PROJECT_THEMES[0] }
    const matches = mutation.kind === 'both' ? () => true : mutation.kind === 'neither' ? () => false : undefined
    assert.throws(() => assertThemeRows([row], PROJECT_THEMES, matches), new RegExp(mutation.expected), mutation.name)
  }
})
