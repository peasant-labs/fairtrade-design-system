#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import YAML from 'yaml'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const manifest = strictYaml('scripts/testdata/transcript-turn-model.manifest.yaml', 'turn-model manifest')
const corpus = strictYaml('scripts/testdata/transcript-turn-model.yaml', 'turn-model corpus')
const mutation = process.env.FAIRTRADE_TURN_MODEL_MUTATION ? JSON.parse(process.env.FAIRTRADE_TURN_MODEL_MUTATION) : null
validateFixtures(manifest, corpus)

const plugins = [{
  name: 'fairtrade-turn-model-css-stub',
  enforce: 'pre',
  resolveId(id) {
    if (id.endsWith('.css')) return '\0fairtrade-turn-model-empty-css'
    return null
  },
  load(id) { return id === '\0fairtrade-turn-model-empty-css' ? 'export default {}' : null },
}]
const plugin = mutation ? {
  name: 'fairtrade-turn-model-mutation',
  enforce: 'pre',
  transform(code, id) {
    if (!id.split('?')[0].endsWith(`/${mutation.file}`)) return null
    code = replaceExactlyOnce(code, mutation.find, mutation.replace, mutation.name)
    if (mutation.secondaryFind) code = replaceExactlyOnce(code, mutation.secondaryFind, mutation.secondaryReplace, mutation.name)
    return { code, map: null }
  },
} : null
if (plugin) plugins.push(plugin)
const server = await createServer({ appType: 'custom', configFile: false, logLevel: 'silent', root: ROOT, plugins })

const failures = []
try {
  const { adaptTranscript } = await server.ssrLoadModule('/src/ui/transcript/adapter.js')
  const { default: TurnCard } = await server.ssrLoadModule('/src/ui/transcript/TurnCard.jsx')
  const { default: TranscriptApp } = await server.ssrLoadModule('/src/mockups/inuse/TranscriptApp.jsx')

  for (const testCase of corpus.cases) {
    try {
      const options = testCase.options ?? undefined
      const viewModel = adaptTranscript(testCase.payload, undefined, undefined, options)
      assert.deepEqual(viewModel.turns.map((turn) => turn.index), testCase.expect.indices, `${testCase.name}: indices`)
      assert.deepEqual(viewModel.turns.map((turn) => turn.effectiveModel ?? null), testCase.expect.effectiveModels, `${testCase.name}: effectiveModels`)
      assert.deepEqual(viewModel.turns.map((turn) => turn.modelChangedFrom ?? null), testCase.expect.changedFrom, `${testCase.name}: changedFrom`)

      const turnMarkup = viewModel.turns.map((turn) => renderToStaticMarkup(React.createElement(TurnCard, { turn }))).join('')
      const turnDocument = new JSDOM(`<main>${turnMarkup}</main>`).window.document
      assert.equal(turnDocument.querySelectorAll('.txn-modelchange').length, testCase.expect.markerCount, `${testCase.name}: markerCount`)
      for (const content of testCase.payload.turns.filter((turn) => testCase.expect.indices.includes(turn.index)).map((turn) => turn.content)) {
        assert.ok(turnDocument.body.textContent.includes(content), `${testCase.name}: content ${content}`)
      }

      if (testCase.expect.mounted) await assertMountedContract(TranscriptApp, testCase.name, testCase.expect.mounted)
    } catch (error) {
      failures.push(`${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
} finally {
  await server.close()
}

if (failures.length) {
  console.error([
    'sticky turn-model verification failed.',
    'What went wrong: complete-wire model resolution or mounted attribution diverged from the strict fixture corpus.',
    'Why it matters: filtering, inline agents, or provider chrome could misattribute the model that produced assistant output.',
    `Where: ${failures.join('; ')}`,
    'When: the focused production adapter, TurnCard, and TranscriptViewer verification.',
    'What it means: users may see a reset, relocated transition, inaccessible provider identity, or stale active model.',
    'How to fix: restore complete-order resolution and semantic assistant/provider rendering, then rerun pnpm test:transcript-turn-model.',
  ].join('\n'))
  process.exit(1)
}
console.log(`sticky turn-model verification: complete baseline passed for ${corpus.cases.length} strict production-path cases.`)

async function assertMountedContract(TranscriptApp, caseName, expected) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://fairtrade.invalid/transcript' })
  const mountedGlobals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Event: dom.window.Event,
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  const previous = new Map(Object.keys(mountedGlobals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(mountedGlobals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {}
  dom.window.HTMLElement.prototype.scrollTo = function scrollTo(options) {
    if (options && typeof options.top === 'number') this.scrollTop = options.top
  }
  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  try {
    await act(async () => { root.render(React.createElement(TranscriptApp, { theme: 'dark' })) })
    const document = dom.window.document
    const stream = dom.window.document.querySelector('.txn-stream')
    Object.defineProperty(stream, 'clientHeight', { configurable: true, value: expected.viewportHeight })
    const turnOffsets = new Map(expected.turnOffsets.map((offset, index) => [index, offset]))
    for (const turn of document.querySelectorAll('[data-turn]')) {
      const index = Number(turn.getAttribute('data-turn'))
      Object.defineProperty(turn, 'offsetTop', { configurable: true, value: turnOffsets.get(index) })
    }
    stream.scrollTop = expected.beforeBoundaryScrollTop
    await act(async () => { stream.dispatchEvent(new dom.window.Event('scroll', { bubbles: true })) })
    assert.equal(dom.window.document.querySelector('.txn-sticky-model')?.textContent, expected.stickyModels[0], `${caseName}: sticky seed before boundary`)
    stream.scrollTop = expected.afterBoundaryScrollTop
    await act(async () => { stream.dispatchEvent(new dom.window.Event('scroll', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 0)) })
    assert.equal(dom.window.document.querySelector('.txn-sticky-model')?.textContent, expected.stickyModels[1], `${caseName}: active sticky model`)
    const topLevelAssistants = [...document.querySelectorAll('.txn-turn.asst .txn-rolelabel')]
    assert.equal(topLevelAssistants.length, expected.topLevelAssistantCount, `${caseName}: top-level assistant inventory`)
    assert.ok(topLevelAssistants.every((node) => node.textContent.trim() === expected.speaker), `${caseName}: exact assistant speaker`)
    assert.ok(topLevelAssistants.every((node) => node.querySelector(`[role="img"][aria-label="${expected.providerLabel}"]`)), `${caseName}: accessible provider mark`)
    const modelText = [...document.querySelectorAll('.txn-turnmodel')].map((node) => node.textContent)
    assert.deepEqual(modelText, expected.modelNodes, `${caseName}: exact model nodes`)
    assert.equal(document.querySelectorAll(`.txn-turn.${expected.unattributedRole} .txn-turnmodel`).length, 0, `${caseName}: absent attribution has no model node`)
    assert.equal(document.querySelectorAll('.txn-modelchange').length, expected.markerCount, `${caseName}: exact marker inventory`)
    assert.equal(document.querySelector('.txn-modelchange')?.textContent.trim(), expected.markerText, `${caseName}: exact marker text`)
    assert.ok(document.querySelector('.txn-meta')?.textContent.includes(expected.harnessText), `${caseName}: session harness text retained`)
    for (const sentinel of expected.forbiddenModelSentinels) assert.ok(!document.body.textContent.includes(sentinel), `${caseName}: forbidden model sentinel ${sentinel}`)
  } finally {
    await act(async () => { root.unmount() })
  }
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}

function validateFixtures(manifestValue, corpusValue) {
  exactFields(manifestValue, ['expectedCaseCount', 'requiredNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'turn-model manifest')
  exactFields(corpusValue, ['cases'], 'turn-model corpus')
  assert.equal(manifestValue.expectedCaseCount, 10, 'turn-model manifest exact case guard')
  assert.equal(manifestValue.expectedMutationCount, 12, 'turn-model manifest exact mutation guard')
  assert.equal(corpusValue.cases.length, manifestValue.expectedCaseCount, 'turn-model corpus count')
  assert.equal(manifestValue.mutations.length, manifestValue.expectedMutationCount, 'turn-model mutation count')
  requiredInventory(corpusValue.cases.map((item) => item.name), manifestValue.requiredNames, 'turn-model cases')
  requiredInventory(manifestValue.mutations.map((item) => item.name), manifestValue.requiredMutationNames, 'turn-model mutations')
  for (const [index, testCase] of corpusValue.cases.entries()) {
    exactFields(testCase, ['name', 'payload', 'options', 'expect'], `turn-model case ${index}`)
    const expectedFields = ['indices', 'effectiveModels', 'changedFrom', 'markerCount']
    if ('mounted' in testCase.expect) expectedFields.push('mounted')
    exactFields(testCase.expect, expectedFields, `turn-model case ${index}.expect`)
    assert.equal(testCase.expect.indices.length, testCase.expect.effectiveModels.length, `${testCase.name}: expected model count`)
    assert.equal(testCase.expect.indices.length, testCase.expect.changedFrom.length, `${testCase.name}: expected change count`)
    if (testCase.expect.mounted) {
      exactFields(testCase.expect.mounted, ['turnOffsets', 'viewportHeight', 'beforeBoundaryScrollTop', 'afterBoundaryScrollTop', 'stickyModels', 'topLevelAssistantCount', 'speaker', 'providerLabel', 'modelNodes', 'unattributedRole', 'markerCount', 'markerText', 'harnessText', 'forbiddenModelSentinels'], `${testCase.name}.expect.mounted`)
      assert.equal(testCase.expect.mounted.turnOffsets.length, 9, `${testCase.name}: mounted turn offset inventory`)
      assert.equal(testCase.expect.mounted.stickyModels.length, 2, `${testCase.name}: mounted sticky model boundary inventory`)
      assert.equal(testCase.expect.mounted.modelNodes.length, 7, `${testCase.name}: mounted model-node inventory`)
      assert.equal(testCase.expect.mounted.forbiddenModelSentinels.length, 2, `${testCase.name}: mounted sentinel inventory`)
    }
  }
  for (const [index, item] of manifestValue.mutations.entries()) {
    const fields = ['name', 'file', 'find', 'replace', 'expectedDiagnostic']
    if ('secondaryFind' in item || 'secondaryReplace' in item) fields.push('secondaryFind', 'secondaryReplace')
    exactFields(item, fields, `turn-model mutation ${index}`)
  }
}

function strictYaml(relativePath, label) {
  const source = readFileSync(resolve(ROOT, relativePath), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length || (source.match(/^---\s*$/gm) ?? []).length) throw new Error(`${label} must be one strict YAML document with unique keys`)
  const value = document.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} root must be an object`)
  return value
}

function exactFields(value, fields, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`)
  assert.deepEqual(Object.keys(value).sort(), fields.sort(), `${label} exact fields`)
}

function requiredInventory(actual, required, label) {
  assert.equal(new Set(actual).size, actual.length, `${label} names unique`)
  assert.equal(new Set(required).size, required.length, `${label} required names unique`)
  assert.deepEqual([...actual].sort(), [...required].sort(), `${label} exact required-name inventory`)
}

function replaceExactlyOnce(source, find, replacement, name) {
  const count = source.split(find).length - 1
  if (count !== 1) throw new Error(`${name}: source mutation anchor occurred ${count} times instead of exactly once`)
  return source.replace(find, replacement)
}
