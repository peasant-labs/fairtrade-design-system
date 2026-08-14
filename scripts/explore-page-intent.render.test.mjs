/* Mounted production regression for the commons Explore pagination authority.

   The component's page is the sole navigation intent: the initial server payload
   may seed the starting page exactly once, but a later (possibly stale) response
   page must never rewrite a newer user/filter page. This test mounts the ACTUAL
   published surface (`@peasant-labs/fairtrade/commons` -> Explore, loaded through
   the commons barrel consumers import) and drives it through named YAML case
   permutations: seed checks, page navigation, stale response rerenders, and a
   filter change. Each step asserts the pager's current-page marker, the last
   emitted intent, and whether a new intent was emitted — the observable contract
   a host relies on.

   Permutations live in scripts/testdata/explore-page-intent.yaml with an
   independent manifest (counts + required names + mutation inventories) in
   scripts/testdata/explore-page-intent.manifest.yaml, loaded through a typed
   loader with exact inventory, uniqueness, and unknown-field guards. Source
   mutations are injected through a Vite transform gated by
   FAIRTRADE_SOURCE_MUTATION so the paired mutations runner can prove the gate is
   non-vacuous without editing tracked sources. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'
import YAML from 'yaml'

const manifestSource = readFileSync(resolve('scripts/testdata/explore-page-intent.manifest.yaml'), 'utf8')
const casesSource = readFileSync(resolve('scripts/testdata/explore-page-intent.yaml'), 'utf8')
const caseFields = ['name', 'rowProviders', 'total', 'limit', 'seedPage', 'steps']
const stepFields = ['action', 'arg', 'expectCurrent', 'expectLastEmitted', 'expectNewEmission']
const stepActions = ['seedCheck', 'page', 'stale', 'provider']
const loaderMutationFields = ['name', 'target', 'find', 'replace', 'expectedError']
const productionMutationFields = ['name', 'find', 'replace', 'expectedError']

function parseDocument(source, label) {
  if ((source.match(/^---\s*$/gm) ?? []).length) throw new Error(`${label} must contain exactly one YAML document`)
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length) throw new Error(`${label} is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
  const value = document.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} root must be an object`)
  return value
}

function exactFields(value, fields, label) {
  const unknown = Object.keys(value).filter((field) => !fields.includes(field))
  const missing = fields.filter((field) => !(field in value))
  if (unknown.length || missing.length) throw new Error(`${label} fields are invalid; unknown=${unknown.join(',')} missing=${missing.join(',')}`)
}

function uniqueStrings(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0) || new Set(value).size !== value.length) throw new Error(`${label} must contain unique nonempty strings`)
  return value
}

function positiveInt(value) {
  return Number.isSafeInteger(value) && value >= 1
}

function loadFixtures(manifestText = manifestSource, casesText = casesSource) {
  const manifest = parseDocument(manifestText, 'explore manifest')
  exactFields(manifest, ['expectedCaseCount', 'requiredNames', 'expectedLoaderMutationCount', 'requiredLoaderMutationNames', 'loaderMutations', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'explore manifest')
  if (![manifest.expectedCaseCount, manifest.expectedLoaderMutationCount, manifest.expectedMutationCount].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error('explore manifest counts must be safe nonnegative integers')
  const requiredNames = uniqueStrings(manifest.requiredNames, 'explore requiredNames')
  const requiredLoaderMutationNames = uniqueStrings(manifest.requiredLoaderMutationNames, 'explore requiredLoaderMutationNames')
  const requiredMutationNames = uniqueStrings(manifest.requiredMutationNames, 'explore requiredMutationNames')
  if (!Array.isArray(manifest.loaderMutations) || !Array.isArray(manifest.mutations)) throw new Error('explore manifest mutation families must be arrays')

  const loaderMutations = manifest.loaderMutations.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`explore loader mutation ${index} must be an object`)
    exactFields(row, loaderMutationFields, `explore loader mutation ${index}`)
    if (!['manifest', 'cases'].includes(row.target) || ['name', 'find', 'expectedError'].some((field) => typeof row[field] !== 'string' || row[field].length === 0) || typeof row.replace !== 'string') throw new Error(`explore loader mutation ${index} has invalid values`)
    return row
  })
  const mutations = manifest.mutations.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`explore source mutation ${index} must be an object`)
    exactFields(row, productionMutationFields, `explore source mutation ${index}`)
    if (['name', 'find', 'expectedError'].some((field) => typeof row[field] !== 'string' || row[field].length === 0) || typeof row.replace !== 'string') throw new Error(`explore source mutation ${index} has invalid values`)
    return row
  })
  const loaderMutationNames = loaderMutations.map((row) => row.name)
  const mutationNames = mutations.map((row) => row.name)
  if (loaderMutations.length !== manifest.expectedLoaderMutationCount || requiredLoaderMutationNames.length !== manifest.expectedLoaderMutationCount || new Set(loaderMutationNames).size !== loaderMutations.length || requiredLoaderMutationNames.some((name) => !loaderMutationNames.includes(name)) || loaderMutationNames.some((name) => !requiredLoaderMutationNames.includes(name))) throw new Error('explore loader mutation inventory does not match its manifest')
  if (mutations.length !== manifest.expectedMutationCount || requiredMutationNames.length !== manifest.expectedMutationCount || new Set(mutationNames).size !== mutations.length || requiredMutationNames.some((name) => !mutationNames.includes(name)) || mutationNames.some((name) => !requiredMutationNames.includes(name))) throw new Error('explore source mutation inventory does not match its manifest')

  const root = parseDocument(casesText, 'explore cases')
  exactFields(root, ['cases'], 'explore cases')
  if (!Array.isArray(root.cases)) throw new Error('explore cases must be an array')
  const cases = root.cases.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`explore case ${index} must be an object`)
    exactFields(row, caseFields, `explore case ${index}`)
    if (typeof row.name !== 'string' || row.name.length === 0) throw new Error(`explore case ${index} name is invalid`)
    if (!positiveInt(row.total) || !positiveInt(row.limit) || row.limit >= row.total) throw new Error(`explore case ${index} must page a total greater than its limit`)
    if (!Number.isSafeInteger(row.seedPage) || row.seedPage < 0) throw new Error(`explore case ${index} seedPage must be a safe nonnegative integer`)
    if (!Array.isArray(row.rowProviders) || row.rowProviders.length === 0 || row.rowProviders.some((slug) => typeof slug !== 'string' || slug.length === 0)) throw new Error(`explore case ${index} rowProviders must be nonempty provider slugs`)
    if (!Array.isArray(row.steps) || row.steps.length === 0) throw new Error(`explore case ${index} steps must be a nonempty array`)
    row.steps.forEach((step, stepIndex) => {
      if (!step || typeof step !== 'object' || Array.isArray(step)) throw new Error(`explore case ${index} step ${stepIndex} must be an object`)
      exactFields(step, stepFields, `explore case ${index} step ${stepIndex}`)
      if (!stepActions.includes(step.action)) throw new Error(`explore case ${index} step ${stepIndex} action is invalid`)
      if (typeof step.expectNewEmission !== 'boolean' || !positiveInt(step.expectCurrent) || !positiveInt(step.expectLastEmitted)) throw new Error(`explore case ${index} step ${stepIndex} expectations are invalid`)
      if (step.action === 'page' || step.action === 'stale') {
        if (!positiveInt(step.arg)) throw new Error(`explore case ${index} step ${stepIndex} numeric arg is invalid`)
      } else if (step.action === 'provider') {
        if (typeof step.arg !== 'string' || step.arg.length === 0 || !row.rowProviders.includes(step.arg)) throw new Error(`explore case ${index} step ${stepIndex} provider arg must name a present provider`)
      } else if (step.arg !== 'none') {
        throw new Error(`explore case ${index} step ${stepIndex} seedCheck arg must be "none"`)
      }
      return step
    })
    if (row.steps[0].action !== 'seedCheck') throw new Error(`explore case ${index} must begin with a seedCheck step`)
    return row
  })
  const names = cases.map((row) => row.name)
  if (cases.length !== manifest.expectedCaseCount || requiredNames.length !== manifest.expectedCaseCount || names.length !== new Set(names).size || requiredNames.some((name) => !names.includes(name)) || names.some((name) => !requiredNames.includes(name))) throw new Error('explore cases do not match their independent manifest')
  const globalNames = [...names, ...loaderMutationNames, ...mutationNames]
  if (new Set(globalNames).size !== globalNames.length) throw new Error('explore case and mutation names must be globally unique')
  return { cases, loaderMutations, mutations }
}

const fixtures = loadFixtures()
for (const mutation of fixtures.loaderMutations) {
  const source = mutation.target === 'manifest' ? manifestSource : casesSource
  if (source.split(mutation.find).length - 1 !== 1) throw new Error(`${mutation.name}: loader mutation anchor must occur exactly once`)
  const mutated = source.replace(mutation.find, mutation.replace)
  let caught
  try { loadFixtures(mutation.target === 'manifest' ? mutated : manifestSource, mutation.target === 'cases' ? mutated : casesSource) } catch (error) { caught = error }
  if (!(caught instanceof Error) || !new RegExp(mutation.expectedError).test(caught.message)) throw new Error(`${mutation.name}: loader invariant expected ${mutation.expectedError}; received ${caught instanceof Error ? caught.message : 'no error'}`)
}

const sourceMutation = process.env.FAIRTRADE_SOURCE_MUTATION ? JSON.parse(process.env.FAIRTRADE_SOURCE_MUTATION) : null
const mutationPlugin = {
  name: 'fairtrade-explore-source-mutation',
  enforce: 'pre',
  transform(code, id) {
    if (!sourceMutation || !id.split('?')[0].endsWith('/src/ui/commons/Explore.jsx')) return null
    const count = code.split(sourceMutation.find).length - 1
    if (count !== 1) throw new Error(`${sourceMutation.name}: source mutation anchor must occur exactly once, received ${count}`)
    return { code: code.replace(sourceMutation.find, sourceMutation.replace), map: null }
  },
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://fairtrade.invalid/commons' })
const previousGlobals = new Map()
for (const [key, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
})) {
  previousGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

function makeTranscript(id, provider) {
  return {
    id,
    title: `session ${id}`,
    visibility: 'public',
    modelProvider: provider,
    modelName: provider,
    harnessVersion: '2026.06',
    sessionStart: '2026-06-15T00:00:00Z',
    sessionEnd: '2026-06-15T01:00:00Z',
    turnCount: 10,
    tokenCount: 1000,
    toolCallCount: 2,
    durationMs: 600000,
    gitBranch: 'main',
    projectName: 'proj',
    tags: [{ id: 't', name: 't' }],
    owner: { githubUsername: `u-${id}`, displayName: `User ${id}`, avatarUrl: null },
  }
}

function buildPayload(fixture, seedPage) {
  const transcripts = fixture.rowProviders.map((provider, index) => makeTranscript(`r${index}`, provider))
  return {
    transcripts: { transcripts, total: fixture.total, page: seedPage, limit: fixture.limit },
    collectives: [],
    popularTags: [],
  }
}

const server = await createServer({
  appType: 'custom', configFile: false, logLevel: 'silent', plugins: [mutationPlugin, react()],
  root: process.cwd(), server: { middlewareMode: true },
})
try {
  let loaded
  try { loaded = await server.ssrLoadModule('/src/ui/commons/index.js') } catch (error) {
    throw new Error(`mounted source module invariant failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  const Explore = loaded.Explore
  if (typeof Explore !== 'function') throw new Error('mounted source module invariant failed: commons barrel did not export the Explore surface')

  for (const fixture of fixtures.cases) {
    const emitted = []
    const onFiltersChange = (filters) => emitted.push(filters.page)
    let externalSetPayload
    function MountedExplore() {
      const [payloadState, setPayloadState] = React.useState(() => buildPayload(fixture, fixture.seedPage))
      externalSetPayload = setPayloadState
      return React.createElement(Explore, { data: payloadState, onFiltersChange })
    }

    const container = dom.window.document.getElementById('root')
    const root = createRoot(container)
    const currentPage = () => {
      const markers = [...container.querySelectorAll('[aria-current="page"]')]
      if (markers.length !== 1) throw new Error(`${fixture.name}: single current-page invariant failed; found ${markers.length} current markers`)
      const match = /page (\d+)/.exec(markers[0].getAttribute('aria-label') ?? '')
      if (!match) throw new Error(`${fixture.name}: single current-page invariant failed; current marker is unlabeled`)
      return Number(match[1])
    }
    const assertLandmark = () => {
      const nav = container.querySelector('nav.pgn')
      if (!nav || nav.getAttribute('aria-label') !== 'pagination') throw new Error(`${fixture.name}: pagination landmark invariant failed`)
    }
    const clickTarget = async (element, label) => {
      if (!element) throw new Error(`${fixture.name}: interaction invariant failed; missing ${label}`)
      await act(async () => {
        element.dispatchEvent(new dom.window.MouseEvent('click', { button: 0, bubbles: true }))
        await Promise.resolve()
      })
    }

    try {
      for (const [stepIndex, step] of fixture.steps.entries()) {
        const before = emitted.length
        if (step.action === 'seedCheck') {
          await act(async () => {
            root.render(React.createElement(StrictMode, null, React.createElement(MountedExplore)))
            await Promise.resolve()
          })
          assertLandmark()
        } else if (step.action === 'page') {
          await clickTarget(container.querySelector(`button[aria-label="page ${step.arg}"]`), `page ${step.arg} control`)
        } else if (step.action === 'stale') {
          await act(async () => {
            externalSetPayload((prev) => ({ ...prev, transcripts: { ...prev.transcripts, page: step.arg } }))
            await Promise.resolve()
          })
        } else if (step.action === 'provider') {
          const providerButton = [...container.querySelectorAll('.fr-provider')].find((button) => button.querySelector('.fr-provider-name')?.textContent === step.arg)
          await clickTarget(providerButton, `provider ${step.arg} control`)
        }
        const after = emitted.length
        const observedNew = after > before
        if (observedNew !== step.expectNewEmission) throw new Error(`${fixture.name}: emission cadence invariant failed at step ${stepIndex} (${step.action}); expected new=${step.expectNewEmission}, observed new=${observedNew} (emitted ${JSON.stringify(emitted)})`)
        const observedCurrent = currentPage()
        if (observedCurrent !== step.expectCurrent) throw new Error(`${fixture.name}: page intent invariant failed at step ${stepIndex} (${step.action}); expected current ${step.expectCurrent}, observed ${observedCurrent}`)
        const observedLast = emitted[emitted.length - 1]
        if (observedLast !== step.expectLastEmitted) throw new Error(`${fixture.name}: emitted intent invariant failed at step ${stepIndex} (${step.action}); expected last ${step.expectLastEmitted}, observed ${observedLast} (emitted ${JSON.stringify(emitted)})`)
      }
    } catch (error) {
      throw new Error(`mounted explore invariant failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      await act(async () => root.unmount())
    }
  }
} finally {
  await server.close()
  dom.window.close()
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor === undefined) delete globalThis[key]
    else Object.defineProperty(globalThis, key, descriptor)
  }
}

console.log(`explore page intent mounted source: ${fixtures.cases.length} case(s) passed with exact seed, stale-suppression, filter-reset, and emitted-intent matrices`)
