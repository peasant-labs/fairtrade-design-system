#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import YAML from 'yaml'

const fixture = loadStrictYaml('testdata/transcript-turn-model.yaml')
const failures = []

validateFixture(fixture)

const adapterModule = process.env.FAIRTRADE_SCHEMA_TURN_MODEL_ADAPTER_MODULE
  ? pathToFileURL(process.env.FAIRTRADE_SCHEMA_TURN_MODEL_ADAPTER_MODULE).href
  : new URL('../src/ui/transcript/adapter.js', import.meta.url).href
const { adaptTranscript } = await import(`${adapterModule}?turn-model=${Date.now()}`)
const viewModels = new Map()

for (const testCase of fixture.cases) {
  try {
    const viewModel = adaptTranscript(testCase.payload)
    viewModels.set(testCase.name, viewModel)
    const observed = {
      models: viewModel.turns.map((turn) => turn.model ?? null),
      modelProperties: viewModel.turns.map((turn) => Object.hasOwn(turn, 'model')),
    }
    for (const key of Object.keys(testCase.expected)) {
      assert.deepEqual(observed[key], testCase.expected[key], `${testCase.name}: ${key}`)
    }
  } catch (error) {
    failures.push(`${testCase.name}: adapter verification threw ${error instanceof Error ? error.message : String(error)}`)
  }
}

try {
  const ui = await import(new URL(`../dist/lib/ui.js?turn-model=${Date.now()}`, import.meta.url).href)
  const TurnCard = ui.TranscriptTurnCard
  if (typeof TurnCard !== 'function') throw new Error('TranscriptTurnCard is not a production export')
  for (const testCase of fixture.cases) {
    const viewModel = viewModels.get(testCase.name)
    if (!viewModel) continue
    for (const [index, turn] of viewModel.turns.entries()) {
      const markup = renderToStaticMarkup(React.createElement(TurnCard, { turn }))
      const model = testCase.expected.models[index]
      const hasModelChrome = markup.includes('txn-turnmodel')
      if (model === null) {
        if (hasModelChrome) failures.push(`${testCase.name} turn ${index}: absent model rendered a turn-model chrome element`)
      } else {
        if (!hasModelChrome) failures.push(`${testCase.name} turn ${index}: effective model did not reach the production turn header`)
        if (!markup.includes(model)) failures.push(`${testCase.name} turn ${index}: model value lost its original case in the production turn header`)
      }
    }
  }
} catch (error) {
  failures.push(`production component export: ${error instanceof Error ? error.message : String(error)}`)
}

if (failures.length > 0) {
  console.error([
    'turn model verification failed.',
    'What went wrong: the effective turn model or its production header rendering diverged from the strict fixture family.',
    'Why it happened: per-turn metadata must override the session fallback while legacy payloads may omit both values.',
    'Where: src/ui/transcript/adapter.js, src/ui/transcript/view-model.js, src/ui/transcript/TurnCard.jsx, and the packed-library output.',
    `When: focused turn-model verification (${failures.join('; ')}).`,
    'What it means: mixed-model transcripts can show the wrong attribution or fail to display a valid model.',
    'How to fix: restore the adapter fallback and turn-header value, rebuild the library, then rerun pnpm test:transcript-turn-model.',
  ].join('\n'))
  process.exit(1)
}

console.log(`turn model verification: ${fixture.cases.length} strict cases and the production turn header passed.`)

function validateFixture(value) {
  assert.deepEqual(Object.keys(value).sort(), ['cases', 'componentCase', 'expectedCaseCount', 'expectedMutationCount', 'mutations'].sort(), 'turn model fixture root fields')
  assert.equal(value.expectedCaseCount, value.cases.length, 'turn model fixture case count')
  assert.equal(value.expectedCaseCount, 4, 'turn model fixture must retain the four required cases')
  assert.equal(value.expectedMutationCount, value.mutations.length, 'turn model fixture mutation count')
  assert.equal(value.expectedMutationCount, 2, 'turn model fixture must retain both fallback mutations')
  assert.equal(new Set(value.cases.map((testCase) => testCase.name)).size, value.cases.length, 'turn model case names must be unique')
  assert.deepEqual(value.cases.map((testCase) => testCase.name), ['turn-override', 'session-fallback', 'mixed-turns', 'total-absence'], 'turn model fixture case order')
  assert.equal(value.componentCase, 'turn-override', 'turn model component case')
  for (const [index, testCase] of value.cases.entries()) {
    assert.deepEqual(Object.keys(testCase).sort(), ['expected', 'name', 'payload'].sort(), `turn model case ${index} fields`)
    assert.deepEqual(Object.keys(testCase.expected).sort(), ['modelProperties', 'models'].sort(), `turn model case ${index} expected fields`)
    assert.equal(testCase.payload.turns.length, testCase.expected.models.length, `turn model case ${index} turn count`)
    assert.equal(testCase.expected.models.length, testCase.expected.modelProperties.length, `turn model case ${index} model property count`)
  }
  for (const [index, mutation] of value.mutations.entries()) {
    assert.deepEqual(Object.keys(mutation).sort(), ['expectedError', 'find', 'name', 'replace'].sort(), `turn model mutation ${index} fields`)
    for (const field of ['name', 'find', 'replace', 'expectedError']) assert.equal(typeof mutation[field], 'string', `turn model mutation ${index} ${field}`)
  }
}

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return document.toJS()
}
