#!/usr/bin/env node
import fs from 'node:fs'
import YAML from 'yaml'
import { assertTimelineNavigationAction } from '../src/ui/graph/timelineNavigation.js'

const fixture = loadStrictYaml('testdata/timeline-navigation-actions.yaml')
const manifest = loadStrictYaml('testdata/timeline-navigation-actions-manifest.yaml')
const failures = []

const exactFields = (value, fields) => {
  const actual = Object.keys(value ?? {}).sort()
  const expected = fields.slice().sort()
  return actual.length === expected.length && expected.every((field, index) => field === actual[index])
}

function validateManifest(value, label) {
  const problems = []
  if (!exactFields(value, ['expectedFamilyCount', 'families'])) problems.push(`${label}: root fields must be exact`)
  if (!Number.isInteger(value.expectedFamilyCount) || value.expectedFamilyCount < 1) problems.push(`${label}: expectedFamilyCount must be positive`)
  if (!Array.isArray(value.families) || value.families.length !== value.expectedFamilyCount) problems.push(`${label}: family count mismatch`)
  const names = new Set()
  for (const [index, family] of (value.families ?? []).entries()) {
    if (!exactFields(family, ['name', 'actionType', 'sourceKind'])) problems.push(`${label}.families[${index}]: fields must be exact`)
    if (typeof family.name !== 'string' || family.name.length === 0 || names.has(family.name)) problems.push(`${label}.families[${index}]: name must be non-empty and unique`)
    names.add(family.name)
    if (!['open-change', 'open-session', 'open-map', 'show-older'].includes(family.actionType)) problems.push(`${label}.families[${index}]: unsupported actionType`)
    if (family.actionType === 'open-session') {
      if (!['commit', 'unlinked', 'outside-window'].includes(family.sourceKind)) problems.push(`${label}.families[${index}]: session sourceKind is invalid`)
    } else if (family.sourceKind !== null) problems.push(`${label}.families[${index}]: non-session sourceKind must be null`)
  }
  return problems
}

function validateFixture(value, manifestValue, label) {
  const problems = []
  if (!exactFields(value, ['expectedCaseCount', 'payload', 'cases'])) problems.push(`${label}: root fields must be exact`)
  if (!Number.isInteger(value.expectedCaseCount) || value.expectedCaseCount !== manifestValue.expectedFamilyCount) problems.push(`${label}: expectedCaseCount must match manifest`)
  if (!Array.isArray(value.cases) || value.cases.length !== value.expectedCaseCount) problems.push(`${label}: case count mismatch`)
  const cases = new Map()
  for (const [index, testCase] of (value.cases ?? []).entries()) {
    if (!exactFields(testCase, ['name', 'controlName', 'expectedAction', 'legacyCallback', 'legacyValue'])) problems.push(`${label}.cases[${index}]: fields must be exact`)
    if (typeof testCase.name !== 'string' || testCase.name.length === 0 || cases.has(testCase.name)) problems.push(`${label}.cases[${index}]: name must be non-empty and unique`)
    cases.set(testCase.name, testCase)
    if (typeof testCase.controlName !== 'string' || testCase.controlName.length === 0) problems.push(`${label}.cases[${index}]: controlName must be non-empty`)
    if (!['select', 'session', 'map', 'older'].includes(testCase.legacyCallback)) problems.push(`${label}.cases[${index}]: legacyCallback is invalid`)
    try {
      assertTimelineNavigationAction(testCase.expectedAction)
    } catch (error) {
      problems.push(`${label}.cases[${index}]: ${error instanceof Error ? error.message.split('\n')[0] : 'invalid expectedAction'}`)
    }
  }
  for (const family of manifestValue.families ?? []) {
    const testCase = cases.get(family.name)
    if (!testCase) {
      problems.push(`${label}: missing behavior family ${family.name}`)
      continue
    }
    if (testCase.expectedAction?.type !== family.actionType) problems.push(`${label}.${family.name}: actionType differs from manifest`)
    const sourceKind = testCase.expectedAction?.type === 'open-session' ? testCase.expectedAction.source?.kind : null
    if (sourceKind !== family.sourceKind) problems.push(`${label}.${family.name}: sourceKind differs from manifest`)
  }
  return problems
}

failures.push(...validateManifest(manifest.value, 'manifest'))
failures.push(...validateFixture(fixture.value, manifest.value, 'fixture'))

for (const family of manifest.value.families ?? []) {
  const mutated = structuredClone(fixture.value)
  const testCase = mutated.cases.find((candidate) => candidate.name === family.name)
  if (!testCase) continue
  testCase.name = `renamed_${family.name}`
  if (!validateFixture(mutated, manifest.value, `rename mutation ${family.name}`).some((problem) => problem.includes(`missing behavior family ${family.name}`))) {
    failures.push(`rename mutation ${family.name}: removing the required family was not rejected`)
  }

  const shapeMutation = structuredClone(testCase.expectedAction)
  shapeMutation.unexpected = true
  let rejected = false
  try {
    assertTimelineNavigationAction(shapeMutation)
  } catch {
    rejected = true
  }
  if (!rejected) failures.push(`shape mutation ${family.name}: an extra action field was not rejected`)
}

if (failures.length > 0) {
  console.error([
    'timeline navigation contract test failed.',
    'What went wrong: the action fixture, its independent manifest, or exact runtime shapes drifted.',
    'Why it happened: a behavior family was removed, renamed, or changed without updating the canonical contract.',
    'Where: scripts/timeline-navigation.test.mjs and scripts/testdata/timeline-navigation-actions*.yaml.',
    `When: Fairtrade timeline navigation contract verification (${failures.join('; ')}).`,
    'What it means: hosts cannot route every timeline gesture deterministically.',
    'How to fix: restore all manifested action families and their exact JSON-safe payloads, then rerun pnpm test:timeline-navigation.',
  ].join('\n'))
  process.exit(1)
}

console.log(`timeline navigation contract: all ${fixture.value.cases.length} action families passed.`)

function loadStrictYaml(relativePath) {
  const url = new URL(relativePath, import.meta.url)
  const source = fs.readFileSync(url, 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return { source, value: document.toJS() }
}
