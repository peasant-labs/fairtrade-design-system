/* Mounted-source gate for the transcript session header that leaves once the full
   trace is scrolled. It mounts the REAL TranscriptViewer source through vite + jsdom,
   fakes only the scroller's box geometry (jsdom has no layout), drives the fixture
   steps (scroll / tab / view / focus), and asserts the root's condensed class and the
   pinned scrubber state after every step. Cases live in
   scripts/testdata/transcript-header-condense.yaml; the manifest pins the inventory
   and the executable production mutations that must each make this gate go red. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'
import YAML from 'yaml'

const manifestSource = readFileSync(resolve('scripts/testdata/transcript-header-condense.manifest.yaml'), 'utf8')
const casesSource = readFileSync(resolve('scripts/testdata/transcript-header-condense.yaml'), 'utf8')
const stylesheetSource = readFileSync(resolve('src/index.css'), 'utf8')
const caseFields = ['name', 'turns', 'scrollHeight', 'clientHeight', 'headerHeight', 'condensedHeaderHeight', 'steps', 'expectedCondensedTrail', 'expectedStickyTrail']
const loaderMutationFields = ['name', 'target', 'find', 'replace', 'expectedError']
const productionMutationFields = ['name', 'file', 'find', 'replace', 'expectedError']
const STEP = /^(?:scroll:\d+|tab:(?:trace|files|diffs|highlights|annotations)|view:(?:list|graph)|focus:header|blur)$/

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
const positiveInt = (value) => Number.isSafeInteger(value) && value > 0
const boolArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'boolean')

export function loadCondenseFixtures(manifestText = manifestSource, casesText = casesSource) {
  const manifest = parseDocument(manifestText, 'condense manifest')
  exactFields(manifest, ['expectedCaseCount', 'requiredNames', 'expectedStylesheetRules', 'expectedLoaderMutationCount', 'requiredLoaderMutationNames', 'loaderMutations', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'condense manifest')
  if (![manifest.expectedCaseCount, manifest.expectedLoaderMutationCount, manifest.expectedMutationCount].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error('condense manifest counts must be safe nonnegative integers')
  const requiredNames = uniqueStrings(manifest.requiredNames, 'condense requiredNames')
  const stylesheetRules = uniqueStrings(manifest.expectedStylesheetRules, 'condense expectedStylesheetRules')
  const requiredLoaderMutationNames = uniqueStrings(manifest.requiredLoaderMutationNames, 'condense requiredLoaderMutationNames')
  const requiredMutationNames = uniqueStrings(manifest.requiredMutationNames, 'condense requiredMutationNames')
  if (!Array.isArray(manifest.loaderMutations) || !Array.isArray(manifest.mutations)) throw new Error('condense manifest mutation families must be arrays')
  const loaderMutations = manifest.loaderMutations.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`condense loader mutation ${index} must be an object`)
    exactFields(row, loaderMutationFields, `condense loader mutation ${index}`)
    if (!['manifest', 'cases'].includes(row.target) || ['name', 'find', 'expectedError'].some((field) => typeof row[field] !== 'string' || row[field].length === 0) || typeof row.replace !== 'string') throw new Error(`condense loader mutation ${index} has invalid values`)
    return row
  })
  const mutations = manifest.mutations.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`condense mutation ${index} must be an object`)
    exactFields(row, productionMutationFields, `condense mutation ${index}`)
    if (row.file !== 'viewer' || ['name', 'find', 'expectedError'].some((field) => typeof row[field] !== 'string' || row[field].length === 0) || typeof row.replace !== 'string') throw new Error(`condense mutation ${index} has invalid values`)
    return row
  })
  const inventory = (rows, required, label) => {
    const names = rows.map((row) => row.name)
    if (names.length !== required.length || new Set(names).size !== names.length || required.some((name) => !names.includes(name))) throw new Error(`condense ${label} do not match their independent manifest`)
  }
  if (loaderMutations.length !== manifest.expectedLoaderMutationCount) throw new Error('condense loader mutations do not match their independent manifest count')
  if (mutations.length !== manifest.expectedMutationCount) throw new Error('condense production mutations do not match their independent manifest count')
  inventory(loaderMutations, requiredLoaderMutationNames, 'loader mutations')
  inventory(mutations, requiredMutationNames, 'production mutations')

  const root = parseDocument(casesText, 'condense cases')
  exactFields(root, ['cases'], 'condense cases')
  if (!Array.isArray(root.cases)) throw new Error('condense cases must be an array')
  const cases = root.cases.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`condense case ${index} must be an object`)
    exactFields(row, caseFields, `condense case ${index}`)
    if (typeof row.name !== 'string' || row.name.length === 0 || !positiveInt(row.turns) || !positiveInt(row.scrollHeight) || !positiveInt(row.clientHeight) || !positiveInt(row.headerHeight) || !positiveInt(row.condensedHeaderHeight) || row.condensedHeaderHeight >= row.headerHeight) throw new Error(`condense case ${index} scalars are invalid`)
    if (!Array.isArray(row.steps) || row.steps.length === 0 || row.steps.some((step) => typeof step !== 'string' || !STEP.test(step))) throw new Error(`condense case ${index}.steps has invalid values`)
    if (!boolArray(row.expectedCondensedTrail) || !boolArray(row.expectedStickyTrail)) throw new Error(`condense case ${index} trails must be boolean arrays`)
    if (row.expectedCondensedTrail.length !== row.steps.length || row.expectedStickyTrail.length !== row.steps.length) throw new Error(`condense case ${index} trail length must equal the step count`)
    return row
  })
  if (cases.length !== manifest.expectedCaseCount || requiredNames.length !== manifest.expectedCaseCount) throw new Error('condense cases do not match their independent manifest count')
  inventory(cases, requiredNames, 'cases')
  const globalNames = [...cases.map((row) => row.name), ...loaderMutations.map((row) => row.name), ...mutations.map((row) => row.name)]
  if (new Set(globalNames).size !== globalNames.length) throw new Error('condense case and mutation names must be globally unique')
  return { cases, stylesheetRules, loaderMutations, mutations }
}

const fixtures = loadCondenseFixtures()
for (const mutation of fixtures.loaderMutations) {
  const source = mutation.target === 'manifest' ? manifestSource : casesSource
  if (source.split(mutation.find).length - 1 !== 1) throw new Error(`${mutation.name}: loader mutation anchor must occur exactly once`)
  const mutated = source.replace(mutation.find, mutation.replace)
  let caught
  try { loadCondenseFixtures(mutation.target === 'manifest' ? mutated : manifestSource, mutation.target === 'cases' ? mutated : casesSource) } catch (error) { caught = error }
  if (!(caught instanceof Error) || !new RegExp(mutation.expectedError).test(caught.message)) throw new Error(`${mutation.name}: loader invariant expected ${mutation.expectedError}; received ${caught instanceof Error ? caught.message : 'no error'}`)
}
for (const rule of fixtures.stylesheetRules) {
  if (stylesheetSource.split(rule).length - 1 !== 1) throw new Error(`stylesheet invariant failed: src/index.css must declare exactly once: ${rule}`)
}

const sourceMutation = process.env.FAIRTRADE_SOURCE_MUTATION ? JSON.parse(process.env.FAIRTRADE_SOURCE_MUTATION) : null
const mutationPlugin = {
  name: 'fairtrade-source-mutation',
  enforce: 'pre',
  transform(code, id) {
    if (!sourceMutation || !id.split('?')[0].endsWith('/src/ui/transcript/TranscriptViewer.jsx')) return null
    const count = code.split(sourceMutation.find).length - 1
    if (count !== 1) throw new Error(`${sourceMutation.name}: source mutation anchor must occur exactly once, received ${count}`)
    return { code: code.replace(sourceMutation.find, sourceMutation.replace), map: null }
  },
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://fairtrade.invalid/transcript' })
dom.window.HTMLElement.prototype.attachEvent = function () {}
dom.window.HTMLElement.prototype.detachEvent = function () {}
dom.window.HTMLElement.prototype.scrollIntoView = function () {}
const previousGlobals = new Map()
for (const [key, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
})) {
  previousGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

const server = await createServer({ appType: 'custom', configFile: false, logLevel: 'silent', plugins: [mutationPlugin, react()], root: process.cwd(), server: { middlewareMode: true } })
try {
  let loaded
  try { loaded = await server.ssrLoadModule('/src/ui/transcript/TranscriptViewer.jsx') } catch (error) {
    throw new Error(`mounted source module invariant failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  const TranscriptViewer = loaded.default
  const tabButton = (container, tab) => [...container.querySelectorAll('[role="tab"]')].find((button) => button.textContent.trim().startsWith(tab === 'trace' ? 'full trace' : tab))
  const viewButton = (container, mode) => [...container.querySelectorAll('.txn-viewtoggle button')].find((button) => button.textContent.trim() === mode)

  for (const fixture of fixtures.cases) {
    const turns = Array.from({ length: fixture.turns }, (_, index) => ({ index, role: index % 2 ? 'assistant' : 'user', label: String(index), content: `turn ${index}`, depth: 0, toolCalls: [], annotations: [] }))
    const container = dom.window.document.getElementById('root')
    const root = createRoot(container)
    // jsdom performs no layout: give the live scroller and the session header the
    // fixture geometry synchronously (prototype getters, so a freshly remounted stream
    // already has its box when effects run), and let scrollTo land on scrollTop and fire
    // a scroll event the way a browser does when the position changes.
    const proto = dom.window.HTMLElement.prototype
    Object.defineProperty(proto, 'scrollHeight', { configurable: true, get() { return this.classList.contains('txn-stream') ? fixture.scrollHeight : 0 } })
    Object.defineProperty(proto, 'clientHeight', { configurable: true, get() { return this.classList.contains('txn-stream') ? fixture.clientHeight : 0 } })
    Object.defineProperty(proto, 'offsetHeight', { configurable: true, get() {
      if (!this.classList.contains('txn-header')) return 0
      // The condensed header keeps its breadcrumb + actions row, so it still
      // reports a (smaller) height - the measurement guard must not adopt it.
      return this.parentElement?.classList.contains('txn-app-condensed') ? fixture.condensedHeaderHeight : fixture.headerHeight
    } })
    proto.scrollTo = function (options) {
      const top = options?.top ?? 0
      if (this.scrollTop === top) return
      this.scrollTop = top
      this.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    }
    const condensedTrail = []
    const stickyTrail = []
    try {
      await act(async () => {
        root.render(React.createElement(StrictMode, null, React.createElement(TranscriptViewer, {
          viewModel: {
            session: { id: 'condense-render', harness: 'codex', git: { commits: [] } }, turns,
            tasks: [], files: [], diffs: [], highlights: [], toolCallsById: new Map(),
            analytics: { phases: [], scorecardBands: [], patternAnnotations: [] },
            filterIndex: { toolGroupCounts: { edits: 0, bash: 0, read: 0, search: 0, fetch: 0, tasks: 0, other: 0 }, annotationsByTurn: {}, tags: [], tagCounts: {}, totalTurns: turns.length },
          },
          capabilities: {},
          initialPosition: { kind: 'top' },
        })))
        await Promise.resolve()
      })
      if (!container.querySelector('.txn-header')) throw new Error(`${fixture.name}: mounted source DOM invariant failed; missing txn-header`)
      if (container.querySelector('.txn-app-condensed')) throw new Error(`${fixture.name}: condensed invariant failed at mount; the session header must start visible`)
      for (const step of fixture.steps) {
        const [kind, arg] = step.split(':')
        await act(async () => {
          if (kind === 'scroll') {
            const stream = container.querySelector('.txn-stream')
            if (!stream) throw new Error(`${fixture.name}: trace scroller is missing before ${step}`)
            stream.scrollTop = Number(arg)
            stream.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
          } else if (kind === 'tab') {
            const button = tabButton(container, arg)
            if (!button) throw new Error(`${fixture.name}: ${arg} tab is missing`)
            button.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, button: 0 }))
            button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, button: 0 }))
          } else if (kind === 'view') {
            const button = viewButton(container, arg)
            if (!button) throw new Error(`${fixture.name}: ${arg} view toggle is missing`)
            button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, button: 0 }))
          } else if (kind === 'focus') {
            const control = container.querySelector('.txn-header button, .txn-header a')
            if (!control) throw new Error(`${fixture.name}: session header has no focusable control`)
            control.focus()
          } else if (kind === 'blur') {
            dom.window.document.activeElement?.blur()
          }
          await Promise.resolve()
        })
        condensedTrail.push(!!container.querySelector('.txn-app-condensed'))
        stickyTrail.push(!!container.querySelector('.txn-trace-pinned') || !!container.querySelector('.txn-sticky'))
        const condensedHeader = container.querySelector('.txn-app-condensed > .txn-header')
        const header = container.querySelector('.txn-header')
        if (!header) throw new Error(`${fixture.name}: session header must stay mounted after ${step}`)
        if (condensedTrail.at(-1) && !condensedHeader) throw new Error(`${fixture.name}: condensed invariant failed after ${step}; the condensed header must be the root's direct child`)
        if (condensedTrail.at(-1) && !container.querySelector('.txn-app-condensed > .txn-header .txn-header-top')) throw new Error(`${fixture.name}: condensed invariant failed after ${step}; the breadcrumb + actions row must stay mounted in the condensed header`)
      }
      if (JSON.stringify(condensedTrail) !== JSON.stringify(fixture.expectedCondensedTrail)) throw new Error(`${fixture.name}: condensed invariant failed; expected ${JSON.stringify(fixture.expectedCondensedTrail)}, received ${JSON.stringify(condensedTrail)}`)
      if (JSON.stringify(stickyTrail) !== JSON.stringify(fixture.expectedStickyTrail)) throw new Error(`${fixture.name}: sticky invariant failed; expected ${JSON.stringify(fixture.expectedStickyTrail)}, received ${JSON.stringify(stickyTrail)}`)
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

console.log(`transcript header condense mounted source: ${fixtures.cases.length} case(s) passed with exact condensed + pinned trails and ${fixtures.stylesheetRules.length} stylesheet rule(s) present`)
