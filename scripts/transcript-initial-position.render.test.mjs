import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'
import YAML from 'yaml'

const manifestSource = readFileSync(resolve('scripts/testdata/transcript-initial-position.render.manifest.yaml'), 'utf8')
const casesSource = readFileSync(resolve('scripts/testdata/transcript-initial-position.render.yaml'), 'utf8')
const caseFields = ['name', 'initialKind', 'initialTurn', 'turns', 'expectedScrolls', 'expectedCallbacks', 'expectedHistory', 'expectedContains']
const returnCaseFields = ['name', 'initialKind', 'initialTurn', 'initialTab', 'controlMode', 'turns', 'sourceOffset', 'focusOrigin', 'action', 'fileActivation', 'destinationTurn', 'expectedTabs', 'expectedTabChanges', 'expectedScrollCalls', 'expectedScrollTop', 'expectedFocus', 'expectedContains']
const loaderMutationFields = ['name', 'target', 'find', 'replace', 'expectedError']
const productionMutationFields = ['name', 'file', 'find', 'replace', 'expectedError']

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

function loadRenderFixtures(manifestText = manifestSource, casesText = casesSource) {
  const manifest = parseDocument(manifestText, 'source render manifest')
  exactFields(manifest, ['expectedCaseCount', 'requiredNames', 'expectedReturnCaseCount', 'requiredReturnNames', 'expectedLoaderMutationCount', 'requiredLoaderMutationNames', 'loaderMutations', 'requiredMutationNames', 'expectedMutationCount', 'mutations'], 'source render manifest')
  if (![manifest.expectedCaseCount, manifest.expectedReturnCaseCount, manifest.expectedLoaderMutationCount, manifest.expectedMutationCount].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error('source render manifest counts must be safe nonnegative integers')
  const requiredNames = uniqueStrings(manifest.requiredNames, 'source render requiredNames')
  const requiredReturnNames = uniqueStrings(manifest.requiredReturnNames, 'source render requiredReturnNames')
  const requiredLoaderMutationNames = uniqueStrings(manifest.requiredLoaderMutationNames, 'source render requiredLoaderMutationNames')
  const requiredMutationNames = uniqueStrings(manifest.requiredMutationNames, 'source render requiredMutationNames')
  if (!Array.isArray(manifest.loaderMutations) || !Array.isArray(manifest.mutations)) throw new Error('source render manifest mutation families must be arrays')
  const loaderMutations = manifest.loaderMutations.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`source render loader mutation ${index} must be an object`)
    exactFields(row, loaderMutationFields, `source render loader mutation ${index}`)
    if (!['manifest', 'cases'].includes(row.target) || ['name', 'find', 'replace', 'expectedError'].some((field) => typeof row[field] !== 'string' || row[field].length === 0)) throw new Error(`source render loader mutation ${index} has invalid values`)
    return row
  })
  const mutations = manifest.mutations.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`source render mutation ${index} must be an object`)
    exactFields(row, productionMutationFields, `source render mutation ${index}`)
    if (!['hook', 'viewer'].includes(row.file) || ['name', 'find', 'expectedError'].some((field) => typeof row[field] !== 'string' || row[field].length === 0) || typeof row.replace !== 'string') throw new Error(`source render mutation ${index} has invalid values`)
    return row
  })
  const loaderMutationNames = loaderMutations.map((row) => row.name)
  const mutationNames = mutations.map((row) => row.name)
  if (loaderMutations.length !== manifest.expectedLoaderMutationCount || requiredLoaderMutationNames.length !== manifest.expectedLoaderMutationCount || new Set(loaderMutationNames).size !== loaderMutations.length || requiredLoaderMutationNames.some((name) => !loaderMutationNames.includes(name)) || loaderMutationNames.some((name) => !requiredLoaderMutationNames.includes(name))) throw new Error('source render loader mutation inventory is invalid')
  if (mutations.length !== manifest.expectedMutationCount || requiredMutationNames.length !== manifest.expectedMutationCount || new Set(mutationNames).size !== mutations.length || requiredMutationNames.some((name) => !mutationNames.includes(name)) || mutationNames.some((name) => !requiredMutationNames.includes(name))) throw new Error('source render production mutation inventory is invalid')

  const root = parseDocument(casesText, 'source render cases')
  exactFields(root, ['cases', 'returnCases'], 'source render cases')
  if (!Array.isArray(root.cases) || !Array.isArray(root.returnCases)) throw new Error('source render cases must be arrays')
  const cases = root.cases.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`source render case ${index} must be an object`)
    exactFields(row, caseFields, `source render case ${index}`)
    if (typeof row.name !== 'string' || row.name.length === 0 || !['top', 'turn'].includes(row.initialKind) || !Number.isSafeInteger(row.initialTurn) || typeof row.expectedContains !== 'string' || row.expectedContains.length === 0) throw new Error(`source render case ${index} scalars are invalid`)
    if ((row.initialKind === 'turn') !== (row.initialTurn >= 0)) throw new Error(`source render case ${index} has an invalid turn sentinel`)
    if (!Array.isArray(row.turns) || row.turns.some((turn) => !Number.isSafeInteger(turn) || turn < 0) || new Set(row.turns).size !== row.turns.length) throw new Error(`source render case ${index} turns must be unique safe nonnegative integers`)
    for (const [field, grammar] of [['expectedScrolls', /^(?:top|turn:\d+)$/], ['expectedCallbacks', /^active:\d+$/], ['expectedHistory', /^(?:push|replace)$/]]) {
      if (!Array.isArray(row[field]) || row[field].some((value) => typeof value !== 'string' || !grammar.test(value))) throw new Error(`source render case ${index}.${field} has invalid values`)
    }
    return row
  })
  const returnCases = root.returnCases.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`source render return case ${index} must be an object`)
    exactFields(row, returnCaseFields, `source render return case ${index}`)
    const actions = ['files-edited-diffs-trace-tab', 'files-readonly-active-trace-tab', 'files-readonly-highlights-active-trace-tab', 'diffs-trace-tab', 'highlights-trace-tab', 'initial-alternate-trace-tab', 'keyboard-highlights-trace-tab', 'search-trace-tab', 'external-controlled-rerender', 'session-change-discard']
    const readOnlyAction = row.action === 'files-readonly-active-trace-tab' || row.action === 'files-readonly-highlights-active-trace-tab'
    if (typeof row.name !== 'string' || row.name.length === 0 || !['top', 'turn'].includes(row.initialKind) || !Number.isSafeInteger(row.initialTurn) || !['trace', 'files', 'diffs'].includes(row.initialTab) || !['unmanaged', 'internal-controlled', 'external-controlled'].includes(row.controlMode) || !Number.isSafeInteger(row.sourceOffset) || row.sourceOffset < 0 || !['scroller', 'tab', 'turn-anchor'].includes(row.focusOrigin) || !actions.includes(row.action) || !['pointer', 'keyboard-enter', 'keyboard-space'].includes(row.fileActivation) || !Number.isSafeInteger(row.destinationTurn) || row.destinationTurn < -1 || (readOnlyAction ? row.destinationTurn < 0 : row.destinationTurn !== -1) || !Number.isSafeInteger(row.expectedScrollTop) || row.expectedScrollTop < 0 || !['scroller', 'tab', 'turn-anchor', 'search', 'none'].includes(row.expectedFocus) || typeof row.expectedContains !== 'string' || row.expectedContains.length === 0) throw new Error(`source render return case ${index} scalars are invalid`)
    if ((row.initialKind === 'turn') !== (row.initialTurn >= 0)) throw new Error(`source render return case ${index} has an invalid turn sentinel`)
    if (!Array.isArray(row.turns) || row.turns.some((turn) => !Number.isSafeInteger(turn) || turn < 0) || new Set(row.turns).size !== row.turns.length) throw new Error(`source render return case ${index} turns must be unique safe nonnegative integers`)
    if (!Array.isArray(row.expectedTabs) || row.expectedTabs.some((tab) => !['trace', 'files', 'diffs', 'highlights'].includes(tab))) throw new Error(`source render return case ${index}.expectedTabs has invalid values`)
    if (!Array.isArray(row.expectedTabChanges) || row.expectedTabChanges.some((tab) => !['trace', 'files', 'diffs', 'highlights'].includes(tab))) throw new Error(`source render return case ${index}.expectedTabChanges has invalid values`)
    if (!Array.isArray(row.expectedScrollCalls) || row.expectedScrollCalls.some((entry) => typeof entry !== 'string' || !/^(?:top:\d+|turn:\d+)$/.test(entry))) throw new Error(`source render return case ${index}.expectedScrollCalls has invalid values`)
    return row
  })
  const names = cases.map((row) => row.name)
  const returnNames = returnCases.map((row) => row.name)
  if (cases.length !== manifest.expectedCaseCount || requiredNames.length !== manifest.expectedCaseCount || names.length !== new Set(names).size || requiredNames.some((name) => !names.includes(name)) || names.some((name) => !requiredNames.includes(name))) throw new Error('source render cases do not match their independent manifest')
  if (returnCases.length !== manifest.expectedReturnCaseCount || requiredReturnNames.length !== manifest.expectedReturnCaseCount || returnNames.length !== new Set(returnNames).size || requiredReturnNames.some((name) => !returnNames.includes(name)) || returnNames.some((name) => !requiredReturnNames.includes(name))) throw new Error('source render return cases do not match their independent manifest')
  const globalNames = [...names, ...returnNames, ...loaderMutations.map((row) => row.name), ...mutations.map((row) => row.name)]
  if (new Set(globalNames).size !== globalNames.length) throw new Error('source render case and mutation names must be globally unique')
  return { cases, returnCases, loaderMutations, mutations }
}

const fixtures = loadRenderFixtures()
for (const mutation of fixtures.loaderMutations) {
  const source = mutation.target === 'manifest' ? manifestSource : casesSource
  if (source.split(mutation.find).length - 1 !== 1) throw new Error(`${mutation.name}: loader mutation anchor must occur exactly once`)
  const mutated = source.replace(mutation.find, mutation.replace)
  let caught
  try { loadRenderFixtures(mutation.target === 'manifest' ? mutated : manifestSource, mutation.target === 'cases' ? mutated : casesSource) } catch (error) { caught = error }
  if (!(caught instanceof Error) || !new RegExp(mutation.expectedError).test(caught.message)) throw new Error(`${mutation.name}: loader invariant expected ${mutation.expectedError}; received ${caught instanceof Error ? caught.message : 'no error'}`)
}

const sourceMutation = process.env.FAIRTRADE_SOURCE_MUTATION ? JSON.parse(process.env.FAIRTRADE_SOURCE_MUTATION) : null
const mutationSuffixes = { hook: '/src/ui/transcript/useTranscriptInitialPosition.jsx', viewer: '/src/ui/transcript/TranscriptViewer.jsx' }
const mutationPlugin = {
  name: 'fairtrade-source-mutation',
  enforce: 'pre',
  transform(code, id) {
    if (!sourceMutation || !id.split('?')[0].endsWith(mutationSuffixes[sourceMutation.file])) return null
    const count = code.split(sourceMutation.find).length - 1
    if (count !== 1) throw new Error(`${sourceMutation.name}: source mutation anchor must occur exactly once, received ${count}`)
    return { code: code.replace(sourceMutation.find, sourceMutation.replace), map: null }
  },
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://fairtrade.invalid/transcript' })
dom.window.HTMLElement.prototype.attachEvent = function () {}
dom.window.HTMLElement.prototype.detachEvent = function () {}
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

const server = await createServer({
  appType: 'custom', configFile: false, logLevel: 'silent', plugins: [mutationPlugin, react()],
  root: process.cwd(), server: { middlewareMode: true },
})
try {
  let loaded
  try { loaded = await server.ssrLoadModule('/src/ui/transcript/TranscriptViewer.jsx') } catch (error) {
    throw new Error(`mounted source module invariant failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  const TranscriptViewer = loaded.default
  for (const fixture of fixtures.cases) {
    const callbacks = []
    const history = []
    const scrolls = []
    dom.window.HTMLElement.prototype.scrollIntoView = function () { scrolls.push(`turn:${this.dataset.turn}`) }
    dom.window.HTMLElement.prototype.scrollTo = function (options) { if (options?.top === 0) scrolls.push('top') }
    dom.window.history.pushState = () => { history.push('push') }
    dom.window.history.replaceState = () => { history.push('replace') }
    const turns = fixture.turns.map((index) => ({ index, role: 'user', label: String(index), content: `turn ${index}`, depth: 0, toolCalls: [], annotations: [] }))
    const container = dom.window.document.getElementById('root')
    const root = createRoot(container)
    try {
      await act(async () => {
        root.render(React.createElement(StrictMode, null, React.createElement(TranscriptViewer, {
        viewModel: {
          session: { id: 'source-render', harness: 'codex', git: { commits: [] } }, turns,
          tasks: [], files: [], diffs: [], highlights: [], toolCallsById: new Map(),
          analytics: { phases: [], scorecardBands: [], patternAnnotations: [] },
          filterIndex: { toolGroupCounts: { edits: 0, bash: 0, read: 0, search: 0, fetch: 0, tasks: 0, other: 0 }, annotationsByTurn: {}, tags: [], tagCounts: {}, totalTurns: turns.length },
        },
        capabilities: {},
        initialPosition: fixture.initialKind === 'top' ? { kind: 'top' } : { kind: 'turn', turnIndex: fixture.initialTurn },
        onActiveTurnChange: (turn) => callbacks.push(`active:${turn}`),
        })))
        await Promise.resolve()
      })
    } catch (error) {
      throw new Error(`mounted source module invariant failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (!container.querySelector(`.${fixture.expectedContains}`)) throw new Error(`${fixture.name}: mounted source DOM invariant failed; missing ${fixture.expectedContains}`)
    if (JSON.stringify(scrolls) !== JSON.stringify(fixture.expectedScrolls)) throw new Error(`positioning scroll invariant failed: expected ${JSON.stringify(fixture.expectedScrolls)}, received ${JSON.stringify(scrolls)}`)
    if (JSON.stringify(callbacks) !== JSON.stringify(fixture.expectedCallbacks)) throw new Error(`positioning selection invariant failed: expected ${JSON.stringify(fixture.expectedCallbacks)}, received ${JSON.stringify(callbacks)}`)
    if (JSON.stringify(history) !== JSON.stringify(fixture.expectedHistory)) throw new Error(`positioning history invariant failed: expected ${JSON.stringify(fixture.expectedHistory)}, received ${JSON.stringify(history)}`)
    await act(async () => root.unmount())
  }

  const tabButton = (container, tab) => [...container.querySelectorAll('[role="tab"]')].find((button) => button.textContent.trim().startsWith(tab === 'trace' ? 'full trace' : tab))
  const activeTab = (container) => {
    const label = [...container.querySelectorAll('[role="tab"]')].find((button) => button.getAttribute('aria-selected') === 'true')?.textContent.trim().split(/\s+/)[0]
    return label === 'full' ? 'trace' : label
  }
  const assertPermittedReadingPositionActions = (container, fixtureName) => {
    const controls = [...container.querySelectorAll('button,a,[role="button"],[role="link"]')]
    const permitted = new Set([...container.querySelectorAll('[role="tab"]')])
    const restoreTagged = controls.filter((element) => element.matches('.txn-return,[data-reading-position-action]'))
    if (restoreTagged.length !== 0) throw new Error(`${fixtureName}: permitted action inventory invariant failed; dedicated restore controls are forbidden`)
    const traceTab = tabButton(container, 'trace')
    if (!traceTab || !permitted.has(traceTab)) throw new Error(`${fixtureName}: permitted action inventory invariant failed; full trace must be the sole explicit restore action`)
    const tablist = traceTab.closest('[role="tablist"]')
    const extraControls = tablist ? [...tablist.querySelectorAll('button,a,[role="button"],[role="link"]')].filter((element) => !permitted.has(element)) : []
    if (extraControls.length !== 0) throw new Error(`${fixtureName}: permitted action inventory invariant failed; tab strip contains a dedicated non-tab control`)
  }
  const click = async (element, label, afterMouseDown) => {
    if (!element) throw new Error(`full trace tab invariant failed: missing ${label}`)
    await act(async () => {
      element.dispatchEvent(new dom.window.MouseEvent('mousedown', { button: 0, bubbles: true }))
      await Promise.resolve()
    })
    afterMouseDown?.()
    // jsdom does not perform the browser's default mousedown focus transfer.
    // Model it for departures, but leave the return tab unfocused so the
    // restoration branch, rather than native focus, proves tab-origin return.
    if (!/full trace/i.test(label)) element.focus()
    await act(async () => {
      element.dispatchEvent(new dom.window.MouseEvent('mouseup', { button: 0, bubbles: true }))
      element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
  }
  const activate = async (element, mode, label) => {
    if (!element) throw new Error(`read-only destination invariant failed: missing ${label}`)
    if (element.tagName !== 'BUTTON' || element.getAttribute('type') !== 'button') throw new Error(`file activation semantics invariant failed: ${label} must be a native button`)
    element.focus()
    if (mode === 'pointer') await click(element, label)
    else {
      const key = mode === 'keyboard-space' ? ' ' : 'Enter'
      await act(async () => {
        element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true }))
        element.click()
        await Promise.resolve()
      })
    }
  }
  const keyDown = async (element, key, label) => {
    if (!element) throw new Error(`keyboard tab invariant failed: missing ${label}`)
    await act(async () => {
      element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true }))
      await Promise.resolve()
    })
  }

  for (const fixture of fixtures.returnCases) {
    const callbacks = []
    const scrolls = []
    dom.window.HTMLElement.prototype.scrollIntoView = function () { scrolls.push(`turn:${this.dataset.turn}`) }
    dom.window.HTMLElement.prototype.scrollTo = function (options) {
      if (options?.top != null) {
        this.scrollTop = options.top
        scrolls.push(`top:${options.top}`)
      }
    }
    const turns = fixture.turns.map((index) => ({ index, role: index === 0 ? 'user' : 'assistant', label: String(index), content: `turn ${index}`, depth: 0, toolCalls: [], annotations: [] }))
    const container = dom.window.document.getElementById('root')
    const root = createRoot(container)
    const tabChanges = []
    const makeViewModel = (sessionId) => ({
      session: { id: sessionId, harness: 'codex', git: { commits: [] } },
      turns,
      tasks: [],
      files: [
        { path: 'src/edited.ts', leaf: 'edited.ts', reads: 0, writes: 0, edits: 1, deletes: 0, adds: 1, dels: 1, edited: true, turn: fixture.turns[fixture.turns.length - 1] },
        { path: 'src/read-only.ts', leaf: 'read-only.ts', reads: 1, writes: 0, edits: 0, deletes: 0, adds: 0, dels: 0, edited: false, turn: fixture.turns[0] },
      ],
      diffs: [{ path: 'src/edited.ts', leaf: 'edited.ts', adds: 1, dels: 1, turn: fixture.turns[fixture.turns.length - 1], hunks: [{ lines: [{ sign: 'ctx', oldNo: '1', newNo: '1', text: 'const stable = true' }, { sign: 'del', oldNo: '2', text: 'const before = true' }, { sign: 'add', newNo: '2', text: 'const after = true' }] }] }],
      highlights: [],
      toolCallsById: new Map(),
      analytics: { phases: [], scorecardBands: [], patternAnnotations: [] },
      filterIndex: { toolGroupCounts: { edits: 0, bash: 0, read: 0, search: 0, fetch: 0, tasks: 0, other: 0 }, annotationsByTurn: {}, tags: [], tagCounts: {}, totalTurns: turns.length },
    })
    const sessionA = `return-${fixture.name}-a`
    let externalSetTab
    let externalSetSession
    function MountedReturnCase() {
      const [controlledTab, setControlledTab] = React.useState(fixture.initialTab)
      const [sessionId, setSessionId] = React.useState(sessionA)
      externalSetTab = setControlledTab
      externalSetSession = setSessionId
      return React.createElement(TranscriptViewer, {
        viewModel: makeViewModel(sessionId),
        capabilities: {},
        activeTab: fixture.controlMode === 'unmanaged' ? undefined : controlledTab,
        onTabChange: fixture.controlMode === 'internal-controlled' ? (nextTab) => {
          tabChanges.push(nextTab)
          setControlledTab(nextTab)
        } : fixture.controlMode === 'external-controlled' ? () => {} : undefined,
        initialPosition: fixture.initialTab === 'trace'
          ? fixture.initialKind === 'top' ? { kind: 'top' } : { kind: 'turn', turnIndex: fixture.initialTurn }
          : null,
        onActiveTurnChange: (turn) => callbacks.push(`active:${turn}`),
      })
    }
    try {
      await act(async () => {
        root.render(React.createElement(StrictMode, null, React.createElement(MountedReturnCase)))
        await Promise.resolve()
      })

      const observedTabs = [activeTab(container)]
      const assertNoDedicatedReturn = () => assertPermittedReadingPositionActions(container, fixture.name)
      const assertNoPrematureRestore = () => {
        if (fixture.initialTab === 'trace' && scrolls.slice(1).includes(`top:${fixture.sourceOffset}`)) throw new Error(`${fixture.name}: premature restoration invariant failed before full trace selection`)
      }

      if (fixture.initialTab === 'trace') {
        const stream = container.querySelector('.txn-stream')
        if (!stream) throw new Error(`${fixture.name}: source trace scroller is missing`)
        if (fixture.focusOrigin === 'scroller') stream.focus()
        else if (fixture.focusOrigin === 'turn-anchor') container.querySelector('.txn-anchor[data-turn-control="0"]')?.focus()
        else tabButton(container, 'trace')?.focus()
        await act(async () => {
          stream.scrollTop = fixture.sourceOffset
          stream.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
          await Promise.resolve()
        })
      }
      assertNoDedicatedReturn()

      if (fixture.action === 'files-edited-diffs-trace-tab') {
        await click(tabButton(container, 'files'), 'files tab', assertNoPrematureRestore)
        observedTabs.push(activeTab(container))
        assertNoDedicatedReturn()
        await activate([...container.querySelectorAll('.txn-file-cell')].find((control) => control.textContent.includes('edited.ts')), fixture.fileActivation, 'edited file control')
        observedTabs.push(activeTab(container))
        assertNoDedicatedReturn()
        await click(tabButton(container, 'trace'), 'full trace tab')
        observedTabs.push(activeTab(container))
      } else if (fixture.action === 'files-readonly-active-trace-tab' || fixture.action === 'files-readonly-highlights-active-trace-tab') {
        await click(tabButton(container, 'files'), 'files tab', assertNoPrematureRestore)
        observedTabs.push(activeTab(container))
        assertNoDedicatedReturn()
        const callbacksBeforeDestination = callbacks.length
        await activate([...container.querySelectorAll('.txn-file-cell')].find((control) => control.textContent.includes('read-only.ts')), fixture.fileActivation, 'read-only file control')
        observedTabs.push(activeTab(container))
        assertNoDedicatedReturn()
        if (!callbacks.slice(callbacksBeforeDestination).includes(`active:${fixture.destinationTurn}`)) throw new Error(`${fixture.name}: read-only destination invariant failed; expected active turn ${fixture.destinationTurn}, received ${JSON.stringify(callbacks.slice(callbacksBeforeDestination))}`)
        if (scrolls.includes(`top:${fixture.sourceOffset}`)) throw new Error(`${fixture.name}: read-only destination invariant failed; return restoration ran before the explicit action`)
        if (fixture.action === 'files-readonly-highlights-active-trace-tab') {
          await click(tabButton(container, 'highlights'), 'highlights tab after temporary inspection', assertNoPrematureRestore)
          observedTabs.push(activeTab(container))
          assertNoDedicatedReturn()
          if (scrolls.includes(`top:${fixture.sourceOffset}`)) throw new Error(`${fixture.name}: read-only destination invariant failed; return restoration ran before the explicit full trace tab action`)
        }
        await click(tabButton(container, 'trace'), 'active full trace tab')
        observedTabs.push(activeTab(container))
      } else if (fixture.action === 'diffs-trace-tab') {
        await click(tabButton(container, 'diffs'), 'diffs tab', assertNoPrematureRestore)
        observedTabs.push(activeTab(container))
        assertNoDedicatedReturn()
        // The trace tab persists while the panel is unmounted. Remove its
        // prior focus so only restoration can satisfy the focus-origin check.
        dom.window.document.activeElement?.blur()
        await click(tabButton(container, 'trace'), 'full trace tab')
        observedTabs.push(activeTab(container))
      } else if (fixture.action === 'highlights-trace-tab') {
        await click(tabButton(container, 'highlights'), 'highlights tab', assertNoPrematureRestore)
        observedTabs.push(activeTab(container))
        assertNoDedicatedReturn()
        await click(tabButton(container, 'trace'), 'full trace tab')
        observedTabs.push(activeTab(container))
      } else if (fixture.action === 'initial-alternate-trace-tab') {
        await click(tabButton(container, 'trace'), 'full trace tab')
        observedTabs.push(activeTab(container))
      } else if (fixture.action === 'keyboard-highlights-trace-tab') {
        await keyDown(tabButton(container, 'trace'), 'ArrowLeft', 'full trace tab')
        observedTabs.push(activeTab(container))
        assertNoDedicatedReturn()
        await keyDown(tabButton(container, 'highlights'), 'ArrowRight', 'highlights tab')
        observedTabs.push(activeTab(container))
      } else if (fixture.action === 'search-trace-tab') {
        await click(tabButton(container, 'files'), 'files tab', assertNoPrematureRestore)
        observedTabs.push(activeTab(container))
        assertNoDedicatedReturn()
        await act(async () => {
          dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))
          await Promise.resolve()
        })
        await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
        observedTabs.push(activeTab(container))
      } else if (fixture.action === 'external-controlled-rerender' || fixture.action === 'session-change-discard') {
        await act(async () => {
          externalSetTab('files')
          await Promise.resolve()
        })
        observedTabs.push(activeTab(container))
        assertNoPrematureRestore()
        if (fixture.action === 'session-change-discard') {
          await act(async () => {
            externalSetSession(`${sessionA}-b`)
            await Promise.resolve()
          })
        }
        await act(async () => {
          externalSetTab('trace')
          await Promise.resolve()
        })
        observedTabs.push(activeTab(container))
      }

      if (JSON.stringify(observedTabs) !== JSON.stringify(fixture.expectedTabs)) throw new Error(`${fixture.name}: tab invariant failed; expected ${JSON.stringify(fixture.expectedTabs)}, received ${JSON.stringify(observedTabs)}`)
      if (JSON.stringify(tabChanges) !== JSON.stringify(fixture.expectedTabChanges)) throw new Error(`${fixture.name}: controlled tab invariant failed; expected ${JSON.stringify(fixture.expectedTabChanges)}, received ${JSON.stringify(tabChanges)}`)
      assertNoDedicatedReturn()

      const restoredScroller = container.querySelector('.txn-stream')
      if (fixture.expectedFocus !== 'none') {
        if (!restoredScroller) throw new Error(`${fixture.name}: restored trace scroller is missing`)
        const focused = dom.window.document.activeElement
        const expectedFocused = fixture.expectedFocus === 'scroller'
          ? restoredScroller
          : fixture.expectedFocus === 'turn-anchor'
            ? container.querySelector('.txn-anchor[data-turn-control="0"]')
          : fixture.expectedFocus === 'search'
            ? container.querySelector('.txn-search-input')
            : tabButton(container, 'trace')
        if (focused !== expectedFocused) throw new Error(`${fixture.name}: focus invariant failed; expected ${fixture.expectedFocus}, received ${focused?.className ?? focused?.getAttribute?.('role') ?? 'none'}`)
      }
      if (fixture.expectedFocus === 'none' && [tabButton(container, 'trace'), container.querySelector('.txn-stream'), container.querySelector('.txn-anchor[data-turn-control="0"]')].includes(dom.window.document.activeElement)) {
        throw new Error(`${fixture.name}: no-restore case unexpectedly restored a trace focus origin`)
      }
      if (JSON.stringify(scrolls) !== JSON.stringify(fixture.expectedScrollCalls)) throw new Error(`${fixture.name}: scroll call inventory invariant failed; expected ${JSON.stringify(fixture.expectedScrollCalls)}, received ${JSON.stringify(scrolls)}`)
      if (fixture.initialTab === 'trace' && (!restoredScroller || restoredScroller.scrollTop !== fixture.expectedScrollTop)) throw new Error(`${fixture.name}: trace position invariant failed; expected ${fixture.expectedScrollTop}, received ${restoredScroller?.scrollTop ?? 'missing'}`)
      if (fixture.initialTab !== 'trace' && (!restoredScroller || restoredScroller.scrollTop !== fixture.expectedScrollTop)) throw new Error(`${fixture.name}: fabricated trace position invariant failed; expected normal ${fixture.expectedScrollTop}, received ${restoredScroller?.scrollTop ?? 'missing'} with ${JSON.stringify(scrolls)}`)
      if (fixture.action === 'session-change-discard' && scrolls.includes(`top:${fixture.sourceOffset}`)) throw new Error(`${fixture.name}: session boundary invariant failed; session B inherited session A restoration`)
      if (!container.querySelector(`.${fixture.expectedContains}`)) throw new Error(`${fixture.name}: final mounted DOM invariant failed; missing ${fixture.expectedContains}`)
    } catch (error) {
      throw new Error(`mounted return invariant failed: ${error instanceof Error ? error.message : String(error)}`)
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

console.log(`transcript initial-position mounted source: ${fixtures.cases.length} positioning case(s) and ${fixtures.returnCases.length} trace-tab case(s) passed with exact scroll, selection, affordance, and focus matrices`)
