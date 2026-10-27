import assert from 'node:assert/strict'
import { loadFixturePair, withMountedSource, click } from './mounted-parts.mjs'

const { fixture } = loadFixturePair('scripts/testdata/transcript-action-ownership.yaml', 'scripts/testdata/transcript-action-ownership.manifest.yaml', {
  groups: 'requiredGroupNames', disclosures: 'requiredDisclosureNames', filters: 'requiredFilterNames', navigation: 'requiredNavigationNames', initial: 'requiredInitialNames', keyboard: 'requiredKeyboardNames',
})
const caps = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }
await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: Viewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const vm = adaptTranscript(fixture.payload)
  const render = extra => React.createElement(Viewer, { viewModel: vm, capabilities: caps, presentation: 'ledger', ...extra })
  const panel = c => c.querySelector('#turn-1 .txn-modelactions')
  const control = (c, label) => c.querySelector(`[role="switch"][aria-label="${label}"]`)
  const tool = (c, id) => [...c.querySelectorAll('.txn-toolcall')].find(el => el.querySelector('.path')?.textContent.includes(`${id}-command`))
  const press = async (m, el) => { assert.ok(el, 'production control must exist'); await m.act(() => click(window, el)); await m.settle() }
  const membership = async (m, thinking = true) => {
    const c = m.container
    for (const group of fixture.groups) {
      const p = c.querySelector(`#turn-${group.owner} .txn-modelactions`)
      assert.ok(p, `a user turn starts a new block at ${group.owner}`)
      const actual = [...p.querySelectorAll('.txn-toolcall .path')].map(el => el.textContent.trim())
      assert.deepEqual(actual, group.tools.map(id => `printf ${id}-command`), 'exact distinct action membership')
      for (const head of p.querySelectorAll('.txn-toolcall .txn-tc-head, .txn-thinking-toggle')) if (head.getAttribute('aria-expanded') !== 'true') await press(m, head)
      for (const id of group.tools) assert.ok(tool(p, id)?.textContent.includes(`${id}-output`), `distinct output ${id} must render once with its command`)
      const thoughts = [...p.querySelectorAll('.txn-thinking-box')].map(el => el.textContent.trim())
      assert.deepEqual(thoughts, thinking ? group.thinking : [], 'exact distinct thinking membership')
    }
    const global = [...c.querySelectorAll('.txn-toolcall .path')].map(el => el.textContent.trim())
    assert.deepEqual(global, fixture.groups.flatMap(g => g.tools.map(id => `printf ${id}-command`)), 'global action conservation with multiplicity')
    const ids = [...c.querySelectorAll('[id]')].map(el => el.id)
    assert.equal(new Set(ids).size, ids.length, 'source and action anchors must stay unique')
  }
  for (const row of fixture.disclosures) {
    const changes = []
    const m = await mount(render({ onOpenToolsChange: value => changes.push(value) }))
    const c = m.container
    await press(m, tool(c, 'alpha')?.querySelector('button'))
    await press(m, tool(c, 'beta')?.querySelector('button'))
    await press(m, panel(c).querySelector('.txn-thinking-toggle'))
    if (row.mode === 'expand-all') await press(m, control(c, 'expand all tool calls'))
    const before = changes.length
    await press(m, row.mode === 'compact' ? control(c, 'compact mode') : panel(c).querySelector('.txn-modelactions-head'))
    assert.equal(panel(c).querySelector('.txn-modelactions-head').getAttribute('aria-expanded'), 'false', `${row.name}: explicit parent must close`)
    assert.equal(changes.length, before, `${row.name}: parent hiding must not write child choices`)
    await press(m, panel(c).querySelector('.txn-modelactions-head'))
    assert.equal(tool(c, 'alpha').querySelector('button').getAttribute('aria-expanded'), 'true', `${row.name}: alpha retained`)
    assert.equal(tool(c, 'beta').querySelector('button').getAttribute('aria-expanded'), 'true', `${row.name}: beta retained`)
    assert.equal(panel(c).querySelector('.txn-thinking-toggle').getAttribute('aria-expanded'), 'true', `${row.name}: Think retained`)
    if (row.mode !== 'expand-all') assert.equal(tool(c, 'gamma').querySelector('.txn-tcbody'), null, `${row.name}: never-opened expensive output stays lazy`)
    if (row.mode === 'compact') {
      await press(m, control(c, 'compact mode'))
      assert.equal(tool(c, 'alpha').querySelector('button').getAttribute('aria-expanded'), 'true', 'compact exit retains child choices')
    }
    await m.unmount()
  }
  for (const row of fixture.filters) {
    const m = await mount(render())
    await membership(m)
    const c = m.container
    const input = [...c.querySelectorAll('.txn-checkrow')].find(el => el.querySelector('.txn-cr-label')?.textContent.trim() === row.key)?.querySelector('input')
    await press(m, input)
    await membership(m, row.kind !== 'tags')
    if (row.key === 'responses') assert.ok(!c.querySelector('.txn-stream').textContent.includes('Later prose destination'), 'filtered prose must not leak through display content')
    await press(m, input)
    await membership(m)
    await m.unmount()
  }
  for (const row of fixture.navigation) {
    const selected = []
    const m = await mount(render({ search: row.query, filters: { categories: { prompts: true, responses: true, thinking: true, toolcalls: true }, toolGroups: {}, tags: {}, views: { compact: true, expandAll: false, hidden: false }, checkpoint: 'all' }, onActiveTurnChange: i => selected.push(i) }))
    const c = m.container
    const destinations = []
    // JSDOM has no layout; this observes the production selected destination, not pixel visibility.
    c.querySelector('.txn-stream').scrollTo = options => destinations.push(options.top)
    for (const el of c.querySelectorAll('.txn-toolcall, .txn-thinking, article')) {
      const top = row.where === 'body' ? (el.id === `turn-${row.turn}` ? 410 : 10) : ((row.where === 'thinking' ? el.matches('.txn-thinking') : el.querySelector('.path')?.textContent.includes(`${row.where}-command`)) && !el.matches('article') ? 910 : 10)
      Object.defineProperty(el, 'offsetTop', { configurable: true, value: top })
      el.getBoundingClientRect = () => ({ top })
    }
    await m.act(() => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true })))
    await m.settle(80)
    assert.equal(selected.at(-1), row.turn, `${row.name}: public source identity retained`)
    const target = row.where === 'body' ? c.querySelector(`#turn-${row.turn}`) : row.where === 'thinking' ? c.querySelector('.txn-thinking') : tool(c, row.where)
    if (row.where !== 'body') {
      assert.equal(target.querySelector('button').getAttribute('aria-expanded'), 'true', `${row.name}: matched output revealed`)
      assert.equal(target.closest('.txn-modelactions').querySelector('.txn-modelactions-head').getAttribute('aria-expanded'), 'true', `${row.name}: ancestor revealed`)
    }
    assert.equal(destinations.at(-1), target.offsetTop - 12, `${row.name}: actual rendered row destination`)
    await m.unmount()
  }
  for (const row of fixture.initial) {
    const callbacks = [], history = [], scrolls = []
    const prototype = window.HTMLElement.prototype
    const previous = { scrollTo: prototype.scrollTo, scrollIntoView: prototype.scrollIntoView, pushState: window.history.pushState, replaceState: window.history.replaceState }
    prototype.scrollTo = function (options) { scrolls.push(options) }
    prototype.scrollIntoView = function (options) { scrolls.push(options) }
    window.history.pushState = () => history.push('push')
    window.history.replaceState = () => history.push('replace')
    try {
      const m = await mount(render({ initialPosition: { kind: 'turn', turnIndex: row.turn }, activeTurn: row.activeTurn, onActiveTurnChange: index => callbacks.push(index), filters: { categories: { prompts: true, responses: true, thinking: true, toolcalls: true }, toolGroups: {}, tags: {}, views: { compact: true, hidden: false }, checkpoint: 'all' } }))
      await m.settle(80)
      if (row.where !== 'body') {
        const target = row.where === 'thinking' ? m.container.querySelector('.txn-thinking') : tool(m.container, row.where)
        assert.equal(target.querySelector('button').getAttribute('aria-expanded'), 'true', `${row.name}: relocated output revealed`)
        assert.equal(target.closest('.txn-modelactions').querySelector('button').getAttribute('aria-expanded'), 'true', `${row.name}: relocated list revealed`)
      }
      assert.deepEqual(callbacks, row.expectedCallbacks, `${row.name}: positioning must not select`)
      assert.deepEqual(history, row.expectedHistory, `${row.name}: positioning must not write history`)
      assert.equal(scrolls.at(-1)?.behavior, row.scrollBehavior, `${row.name}: positioning retains automatic scrolling`)
      assert.ok(m.container.querySelector(`#turn-${row.activeTurn} .txn-active`), `${row.name}: controlled selection remains independent`)
      await m.unmount()
    } finally {
      prototype.scrollTo = previous.scrollTo
      prototype.scrollIntoView = previous.scrollIntoView
      window.history.pushState = previous.pushState
      window.history.replaceState = previous.replaceState
    }
  }
  for (const row of fixture.keyboard) {
    const selected = []
    const m = await mount(render({ search: row.query, onActiveTurnChange: index => selected.push(index) }))
    if (row.hidePrompts) {
      const input = [...m.container.querySelectorAll('.txn-checkrow')].find(el => el.querySelector('.txn-cr-label')?.textContent.trim() === 'prompts')?.querySelector('input')
      await press(m, input)
    }
    const key = value => window.dispatchEvent(new window.KeyboardEvent('keydown', { ...value, bubbles: true, cancelable: true }))
    await m.act(() => key({ key: 'f', ctrlKey: true }))
    await m.settle(80)
    assert.deepEqual(selected, [row.source], `${row.name}: search selects its original action source`)
    await m.act(() => key({ key: 'Escape' }))
    assert.equal(m.container.querySelector('.txn-search'), null, `${row.name}: search closes before stepping`)
    const stream = m.container.querySelector('.txn-stream')
    await m.act(() => stream.focus())
    for (const step of row.steps) {
      await m.act(() => key({ key: step.key }))
      await m.settle(20)
      assert.equal(selected.at(-1), step.expected, `${row.name}: ${step.key} selects directional eligible neighbor`)
      assert.ok(m.container.querySelector(`#turn-${step.expected} .txn-active`), `${row.name}: selection stays on an eligible card`)
    }
    await m.unmount()
  }
})
console.log('action ownership: named disclosure, projection, conservation and source-navigation regressions passed')
