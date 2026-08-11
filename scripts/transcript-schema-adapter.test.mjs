#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import YAML from 'yaml'

/* The built UI export includes the browser-side character-reference decoder used by
   react-markdown. Install its minimal DOM before the mounted production import below. */
const importDom = new JSDOM('<!doctype html><html><body></body></html>')
for (const [key, value] of Object.entries({ window: importDom.window, document: importDom.window.document, navigator: importDom.window.navigator })) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}

const fixture = loadStrictYaml('testdata/transcript-schema-adapter.yaml')
const manifest = loadStrictYaml('testdata/transcript-schema-adapter.manifest.yaml')
const adapterModule = process.env.FAIRTRADE_SCHEMA_ADAPTER_MODULE
  ? pathToFileURL(process.env.FAIRTRADE_SCHEMA_ADAPTER_MODULE).href
  : new URL('../src/ui/transcript/adapter.js', import.meta.url).href
const wireTypesModule = process.env.FAIRTRADE_SCHEMA_WIRE_TYPES_MODULE
  ? pathToFileURL(process.env.FAIRTRADE_SCHEMA_WIRE_TYPES_MODULE).href
  : new URL('../src/ui/transcript/wire-types.js', import.meta.url).href
const { adaptTranscript } = await import(`${adapterModule}?contract=${Date.now()}`)
const { HARNESSES, STOP_REASONS } = await import(`${wireTypesModule}?contract=${Date.now()}`)
const failures = []

validateManifest(manifest)
validateFixture(fixture, manifest)
compareValues('harness values', HARNESSES, fixture.harnessValues)
compareValues('stop reason values', STOP_REASONS, fixture.stopReasonValues)
for (const invalid of fixture.invalidStopReasonValues) {
  if (STOP_REASONS.includes(invalid)) failures.push(`invalid stop reason remained accepted: ${invalid}`)
}

const viewModels = new Map()
for (const testCase of fixture.adapterCases) {
  try {
    const viewModel = adaptTranscript(testCase.payload)
    viewModels.set(testCase.name, viewModel)
    const observed = observe(viewModel)
    for (const key of Object.keys(testCase.expected)) {
      if (observed[key] !== testCase.expected[key]) {
        failures.push(`${testCase.name}: ${key} expected ${JSON.stringify(testCase.expected[key])}, received ${JSON.stringify(observed[key])}`)
      }
    }
  } catch (error) {
    failures.push(`${testCase.name}: adapter threw ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (!process.env.FAIRTRADE_SCHEMA_ADAPTER_MODULE && !process.env.FAIRTRADE_SCHEMA_WIRE_TYPES_MODULE) {
  try {
    const ui = await import('../dist/lib/ui.js')
    const viewModel = viewModels.get(fixture.mountedViewerCase)
    const capabilities = {
      canEdit: false,
      canLabel: false,
      canContribute: false,
      canChangeVisibility: false,
      canExport: false,
    }
    const markup = viewModel
      ? renderToStaticMarkup(React.createElement(ui.TranscriptViewer, { viewModel, capabilities }))
      : ''
    if (!markup.includes('schema-backed viewer marker') || !markup.includes('txn-turn')) {
      failures.push('mounted viewer: adapted canonical payload did not reach the production TranscriptViewer')
    }
  } catch (error) {
    failures.push(`mounted viewer: production bundle could not render the adapted payload (${error instanceof Error ? error.message : String(error)})`)
  }
}

if (failures.length > 0) {
  console.error([
    'transcript schema adapter verification failed.',
    'What went wrong: canonical schema values, legacy normalization, or the mounted viewer contract diverged.',
    'Why it happened: the adapter stopped preserving a manifested behavior or a runtime enum was copied instead of derived.',
    'Where: src/ui/transcript/wire-types.js, src/ui/transcript/adapter.js, and scripts/testdata/transcript-schema-adapter*.yaml.',
    `When: focused schema adapter verification (${failures.join('; ')}).`,
    'What it means: a schema-valid transcript or supported legacy payload may render incorrectly.',
    'How to fix: restore the manifested normalization and canonical runtime objects, rebuild dist/lib, then rerun pnpm test:transcript-schema-adapter.',
  ].join('\n'))
  process.exit(1)
}

console.log(`transcript schema adapter: ${fixture.adapterCases.length} payloads, ${HARNESSES.length} harnesses, ${STOP_REASONS.length} stop reasons, and the mounted viewer passed.`)

function observe(viewModel) {
  const commit = viewModel.session.git?.commits?.[0]
  return {
    turns: viewModel.turns.length,
    branch: viewModel.session.git?.branch ?? null,
    remote: viewModel.session.git?.remote ?? null,
    workingDirectory: viewModel.session.workingDirectory ?? null,
    author: viewModel.session.git?.author ?? null,
    commitCount: viewModel.session.git?.commits?.length ?? 0,
    commitTime: commit?.commitTime ?? null,
    adds: commit?.adds ?? null,
    dels: commit?.dels ?? null,
    files: commit?.files ?? null,
  }
}

function validateManifest(value) {
  const rootFields = [
    'expectedAdapterCaseCount', 'expectedStopReasonCount',
    'expectedInvalidStopReasonCount', 'expectedMutationCount', 'adapterCases',
    'stopReasonValues', 'invalidStopReasonValues', 'mutations',
  ]
  if (!exactFields(value, rootFields)) failures.push('manifest: root fields must be exact')
  const lists = ['adapterCases', 'stopReasonValues', 'invalidStopReasonValues']
  for (const field of lists) {
    if (!uniqueNonEmptyStrings(value[field])) failures.push(`manifest: ${field} must contain unique non-empty strings`)
  }
  const counts = [
    ['expectedAdapterCaseCount', 'adapterCases'],
    ['expectedStopReasonCount', 'stopReasonValues'],
    ['expectedInvalidStopReasonCount', 'invalidStopReasonValues'],
    ['expectedMutationCount', 'mutations'],
  ]
  for (const [count, list] of counts) {
    if (!Number.isSafeInteger(value[count]) || value[count] !== value[list]?.length) failures.push(`manifest: ${count} must match ${list}`)
  }
  for (const [index, mutation] of (value.mutations ?? []).entries()) {
    if (!exactFields(mutation, ['name', 'file', 'find', 'replace', 'expectedError'])) failures.push(`manifest.mutations[${index}]: fields must be exact`)
    if (!['adapter', 'wireTypes'].includes(mutation?.file)) failures.push(`manifest.mutations[${index}]: file is unsupported`)
    for (const field of ['name', 'find', 'expectedError']) {
      if (typeof mutation?.[field] !== 'string' || mutation[field].length === 0) failures.push(`manifest.mutations[${index}]: ${field} must be non-empty`)
    }
    if (typeof mutation?.replace !== 'string') failures.push(`manifest.mutations[${index}]: replace must be a string`)
  }
  if (!uniqueNonEmptyStrings((value.mutations ?? []).map((mutation) => mutation?.name))) failures.push('manifest: mutation names must be unique')
}

function validateFixture(value, manifestValue) {
  const rootFields = [
    'expectedAdapterCaseCount', 'expectedHarnessCount', 'expectedStopReasonCount',
    'expectedInvalidStopReasonCount', 'mountedViewerCase', 'harnessValues',
    'stopReasonValues', 'invalidStopReasonValues', 'adapterCases',
  ]
  if (!exactFields(value, rootFields)) failures.push('fixture: root fields must be exact')
  for (const field of ['expectedAdapterCaseCount', 'expectedStopReasonCount', 'expectedInvalidStopReasonCount']) {
    if (value[field] !== manifestValue[field]) failures.push(`fixture: ${field} must match the independent manifest`)
  }
  if (!uniqueNonEmptyStrings(value.harnessValues) || value.harnessValues.length !== value.expectedHarnessCount) failures.push('fixture: harnessValues must contain the expected unique Harness inventory')
  for (const field of ['stopReasonValues', 'invalidStopReasonValues']) compareValues(`fixture ${field}`, value[field], manifestValue[field])
  if (!Array.isArray(value.adapterCases) || value.adapterCases.length !== value.expectedAdapterCaseCount) failures.push('fixture: adapter case count mismatch')
  const names = []
  for (const [index, testCase] of (value.adapterCases ?? []).entries()) {
    if (!exactFields(testCase, ['name', 'payload', 'expected'])) failures.push(`fixture.adapterCases[${index}]: fields must be exact`)
    if (typeof testCase?.name !== 'string' || testCase.name.length === 0) failures.push(`fixture.adapterCases[${index}]: name must be non-empty`)
    names.push(testCase?.name)
    if (!testCase?.payload || typeof testCase.payload !== 'object' || Array.isArray(testCase.payload)) failures.push(`fixture.adapterCases[${index}]: payload must be an object`)
    if (!exactFields(testCase?.expected, ['turns', 'branch', 'remote', 'workingDirectory', 'author', 'commitCount', 'commitTime', 'adds', 'dels', 'files'])) failures.push(`fixture.adapterCases[${index}]: expected fields must be exact`)
  }
  compareValues('adapter case names', names, manifestValue.adapterCases)
  if (!names.includes(value.mountedViewerCase)) failures.push('fixture: mountedViewerCase must name an adapter case')
}

function compareValues(label, actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

function exactFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const expected = fields.slice().sort()
  return actual.length === expected.length && expected.every((field, index) => field === actual[index])
}

function uniqueNonEmptyStrings(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0) && new Set(value).size === value.length
}

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return document.toJS()
}
