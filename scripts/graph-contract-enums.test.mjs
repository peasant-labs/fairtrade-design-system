#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import * as schema from '@peasant-labs/schema'
import * as graph from '../dist/lib/graph.js'

const fixture = loadStrictYaml('testdata/graph-contract-enums.yaml')
const manifest = loadStrictYaml('testdata/graph-contract-enums.manifest.yaml')
const failures = []

validateManifest(manifest)
validateFixture(fixture, manifest)

for (const domain of fixture.domains) {
  const schemaValues = schema[domain.allExport]
  const graphValues = graph[domain.allExport]
  const runtimeObject = graph[domain.objectExport]
  const predicate = graph[domain.predicateExport]
  compare(`${domain.name}: schema inventory`, schemaValues, domain.values)
  compare(`${domain.name}: graph inventory`, graphValues, domain.values)
  if (domain.compatibilityExport) compare(`${domain.name}: compatibility alias`, graph[domain.compatibilityExport], domain.values)
  compare(`${domain.name}: runtime object`, Object.values(runtimeObject ?? {}), domain.values)
  if (typeof predicate !== 'function' || domain.values.some((value) => !predicate(value)) || predicate(domain.invalid)) {
    failures.push(`${domain.name}: predicate did not accept the exact canonical inventory and reject ${domain.invalid}`)
  }
}

for (const testCase of fixture.invalidCases) {
  const assertion = graph[testCase.assertionExport]
  let error
  try {
    assertion(testCase.payload)
  } catch (cause) {
    error = cause
  }
  const message = error instanceof Error ? error.message : ''
  if (!message.includes(testCase.expectedPath) || !message.includes('outside the canonical @peasant-labs/schema value domain') || !message.includes('the caller must validate and normalize')) {
    failures.push(`${testCase.name}: invalid present value did not fail actionably at ${testCase.expectedPath}`)
  }
}

if (failures.length > 0) {
  console.error([
    'graph contract enum verification failed.',
    'What went wrong: a canonical graph enum inventory or fail-loud cooked boundary diverged.',
    'Why it happened: Fairtrade copied a schema value list, widened a canonical field, or accepted an invalid present value.',
    'Where: src/ui/graph/types.js, src/ui/graph/index.js, and scripts/testdata/graph-contract-enums*.yaml.',
    `When: focused graph contract verification (${failures.join('; ')}).`,
    'What it means: a local API graph payload can be rendered under an untrusted semantic label.',
    'How to fix: restore schema runtime re-exports, narrowed cooked payload fields, and boundary assertions, rebuild, then rerun pnpm test:graph-contract-enums.',
  ].join('\n'))
  process.exit(1)
}

console.log(`graph contract enums: ${fixture.domains.length} canonical inventories and ${fixture.invalidCases.length} fail-loud cases passed.`)

function validateManifest(value) {
  requireExact(value, ['expectedDomainCount', 'expectedInvalidCaseCount', 'domains', 'invalidCases'], 'manifest')
  if (!Array.isArray(value.domains) || value.domains.length !== value.expectedDomainCount) failures.push('manifest: domain count mismatch')
  if (!Array.isArray(value.invalidCases) || value.invalidCases.length !== value.expectedInvalidCaseCount) failures.push('manifest: invalid case count mismatch')
  const names = new Set()
  for (const [index, domain] of (value.domains ?? []).entries()) {
    requireExact(domain, ['name', 'objectExport', 'allExport', 'predicateExport', 'compatibilityExport', 'values', 'invalid'], `manifest.domains[${index}]`)
    validateStrings(domain, ['name', 'objectExport', 'allExport', 'predicateExport', 'invalid'], `manifest.domains[${index}]`)
    if (domain.compatibilityExport !== null && (typeof domain.compatibilityExport !== 'string' || domain.compatibilityExport.length === 0)) failures.push(`manifest.domains[${index}]: compatibilityExport must be a non-empty string or null`)
    if (!uniqueStrings(domain.values) || names.has(domain.name)) failures.push(`manifest.domains[${index}]: values and name must be unique`)
    names.add(domain.name)
  }
  const invalidNames = new Set()
  for (const [index, testCase] of (value.invalidCases ?? []).entries()) {
    requireExact(testCase, ['name', 'assertionExport', 'expectedPath'], `manifest.invalidCases[${index}]`)
    validateStrings(testCase, ['name', 'assertionExport', 'expectedPath'], `manifest.invalidCases[${index}]`)
    if (invalidNames.has(testCase.name)) failures.push(`manifest.invalidCases[${index}]: name must be unique`)
    invalidNames.add(testCase.name)
  }
}

function validateFixture(value, manifestValue) {
  requireExact(value, ['expectedDomainCount', 'expectedInvalidCaseCount', 'domains', 'invalidCases'], 'fixture')
  if (value.expectedDomainCount !== manifestValue.expectedDomainCount || value.expectedInvalidCaseCount !== manifestValue.expectedInvalidCaseCount) failures.push('fixture: counts must match manifest')
  if (JSON.stringify(value.domains) !== JSON.stringify(manifestValue.domains)) failures.push('fixture: domain inventory must exactly match independent manifest')
  if (!Array.isArray(value.invalidCases) || value.invalidCases.length !== value.expectedInvalidCaseCount) failures.push('fixture: invalid case count mismatch')
  for (const [index, testCase] of (value.invalidCases ?? []).entries()) {
    requireExact(testCase, ['name', 'assertionExport', 'expectedPath', 'payload'], `fixture.invalidCases[${index}]`)
    const expected = manifestValue.invalidCases[index]
    if (!expected || testCase.name !== expected.name || testCase.assertionExport !== expected.assertionExport || testCase.expectedPath !== expected.expectedPath) failures.push(`fixture.invalidCases[${index}]: metadata must match manifest`)
    if (!testCase.payload || typeof testCase.payload !== 'object' || Array.isArray(testCase.payload)) failures.push(`fixture.invalidCases[${index}]: payload must be an object`)
  }
}

function requireExact(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    failures.push(`${label}: must be an object`)
    return
  }
  const actual = Object.keys(value).sort()
  const expected = fields.slice().sort()
  if (actual.length !== expected.length || expected.some((field, index) => field !== actual[index])) failures.push(`${label}: fields must be exact`)
}

function validateStrings(value, fields, label) {
  if (fields.some((field) => typeof value[field] !== 'string' || value[field].length === 0)) failures.push(`${label}: string fields must be non-empty`)
}

function uniqueStrings(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.length > 0) && new Set(value).size === value.length
}

function compare(label, actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) failures.push(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
}

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  return document.toJS()
}
