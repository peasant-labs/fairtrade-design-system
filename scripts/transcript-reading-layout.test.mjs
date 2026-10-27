#!/usr/bin/env node
/* Mounted-source gate for the ledger reading layout: the sidebar-layout view model, zen mode,
   the reader width handle, the 32px rail strips, the shared work-grid edge, the prose measure the
   ledger reader drops, the bottom bar that carries the session views, the derived title crumb, and
   the phone header's clamp. jsdom performs no layout, so the geometry rows read the shipped
   stylesheet while the behaviour rows mount the REAL adapter + TranscriptViewer and assert what a
   reader reaches and what a host hears.
   Cases: scripts/testdata/transcript-reading-layout.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-reading-layout;
   mutations: node scripts/parts-mutations.mjs scripts/transcript-reading-layout.test.mjs
   scripts/testdata/transcript-reading-layout.manifest.yaml */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, loadFixturePair, assertExactNames, assertFields, withMountedSource, click, keydown, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-reading-layout.yaml'
const MANIFEST = 'scripts/testdata/transcript-reading-layout.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  layoutCases: 'requiredLayoutNames',
  interactions: 'requiredInteractionNames',
})
if (fixture.defaultsCase?.name !== manifest.requiredDefaultsCase) throw new Error(`${FIXTURE}: defaultsCase must be named ${JSON.stringify(manifest.requiredDefaultsCase)}`)

/* a case NAME alone does not protect its meaning: a swapped `kind` re-points the row at a
   cheaper branch and the name list still matches. Pin every row's kind by name too. */
function assertKindMap(rows, required, label) {
  const expected = required ?? {}
  for (const row of rows) {
    if (!(row.name in expected)) throw new Error(`${label}: ${JSON.stringify(row.name)} has no required kind`)
    if (row.kind !== expected[row.name]) throw new Error(`${label}: ${JSON.stringify(row.name)} must run kind ${JSON.stringify(expected[row.name])}, received ${JSON.stringify(row.kind)}`)
  }
  assertExactNames(rows.map((row) => row.name), Object.keys(expected), `${label} kinds`)
}
assertKindMap([fixture.defaultsCase, ...fixture.layoutCases], manifest.requiredLayoutKinds, FIXTURE)
assertKindMap(fixture.interactions, manifest.requiredInteractionKinds, FIXTURE)

const LAYOUT_KEYS = ['outline', 'filters', 'host']
const RAIL_KEYS = ['outline', 'filters']
const SNAPS = fixture.snaps
if (!Array.isArray(SNAPS) || SNAPS.length !== 3) throw new Error(`${FIXTURE}: snaps must list the three supported widths`)
if (SNAPS[0] !== 600 || SNAPS[1] !== 840 || SNAPS[2] !== 'full') throw new Error(`${FIXTURE}: snaps must be 600/840/full, received ${JSON.stringify(SNAPS)}`)
if (fixture.defaultWidth !== SNAPS[1]) throw new Error(`${FIXTURE}: defaultWidth must be the middle snap`)
/* jsdom lays nothing out, so the gate gives the stream a content width for `full` to measure */
const FULL = fixture.streamWidth
const RESIZED = fixture.resizedStreamWidth
if (!(FULL > SNAPS[1]) || !(RESIZED > SNAPS[1]) || RESIZED === FULL) throw new Error(`${FIXTURE}: streamWidth and resizedStreamWidth must be distinct widths wider than ${SNAPS[1]}`)
/** a snap's pixel width under the stubbed stream */
const px = (snap) => (snap === 'full' ? FULL : snap)

for (const row of [fixture.defaultsCase, ...fixture.layoutCases]) {
  assertFields(row, ['name', 'kind', 'layout', 'open'], `${FIXTURE} ${row.name}`, ['alias'])
  assertExactNames(Object.keys(row.layout), LAYOUT_KEYS, `${FIXTURE} ${row.name} layout`)
  if (!Array.isArray(row.open)) throw new Error(`${FIXTURE} ${row.name}: open must be a list`)
  for (const rail of row.open) {
    if (!RAIL_KEYS.includes(rail)) throw new Error(`${FIXTURE} ${row.name}: open names an unknown rail ${JSON.stringify(rail)}`)
  }
  if (new Set(row.open).size !== row.open.length) throw new Error(`${FIXTURE} ${row.name}: open lists a rail twice`)
  const open = row.open
  for (const rail of [...open, ...RAIL_KEYS.filter((key) => !open.includes(key))]) {
    if (typeof row.layout[rail] !== 'boolean') throw new Error(`${FIXTURE} ${row.name}: layout.${rail} must be a boolean`)
  }
  if (row.alias) {
    assertExactNames(Object.keys(row.alias), ['rail', 'open'], `${FIXTURE} ${row.name} alias`)
    if (!RAIL_KEYS.includes(row.alias.rail) || typeof row.alias.open !== 'boolean') throw new Error(`${FIXTURE} ${row.name}: alias must name a rail and a boolean`)
  }
}
for (const row of fixture.interactions) assertFields(row, ['name', 'kind'], `${FIXTURE} ${row.name}`, ['readerWidth', 'expected'])

/* ── the shipped stylesheet, read from disk ─────────────────────────────────────
   A stylesheet cannot be loaded through vite's SSR module loader (it resolves to an empty
   module), so the two CSS mutations are applied to this read exactly as the harness transform
   applies them to a loaded module. */
const MUTATION = process.env.FAIRTRADE_PARTS_MUTATION ? JSON.parse(process.env.FAIRTRADE_PARTS_MUTATION) : null
function stylesheet(relativePath) {
  let text = readFileSync(resolve(ROOT, relativePath), 'utf8')
  if (MUTATION && MUTATION.file === relativePath) {
    const count = text.split(MUTATION.find).length - 1
    if (count !== 1) throw new Error(`${MUTATION.name}: the mutation anchor must occur exactly once in ${relativePath}, found ${count}`)
    text = text.replace(MUTATION.find, MUTATION.replace)
  }
  return text
}
/** the text of the first rule whose selector starts at `anchor`, up to its closing brace. */
function ruleAt(source, anchor) {
  const at = source.indexOf(anchor)
  if (at === -1) return null
  const open = source.indexOf('{', at)
  if (open === -1) return null
  const close = source.indexOf('}', open)
  if (close === -1) return null
  return source.slice(at, close + 1)
}
/** exact-object comparison for the layout the host hears. */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const layoutOf = (outline, filters, host) => ({ outline, filters, host })

const report = createReport('transcript reading layout')

/* ── the stylesheet rows: geometry jsdom cannot lay out ───────────────────────── */
const css = stylesheet('src/index.css')
{
  const stripRule = ruleAt(css, '.txn-ledger .txn-body-grid {')
  report.check(!!stripRule && stripRule.includes('--txn-rail-strip-w: var(--sp-6);'), 'both collapsed rail strips are 32px: the collapsed strip width must be var(--sp-6)')
  const classicStrips = ruleAt(css, '.txn-body-grid {')
  report.check(!!classicStrips && classicStrips.includes('--txn-rail-strip-w: var(--sp-7);'), 'both collapsed rail strips are 32px: classic must keep its 40px collapsed strip')
  report.check(css.includes('--sp-6: 32px;'), 'both collapsed rail strips are 32px: --sp-6 must be 32px')
  report.check(css.includes('--sp-7: 40px;'), 'both collapsed rail strips are 32px: --sp-7 must stay 40px so the regression is observable')
}
{
  const gutter = ruleAt(css, '.txn-ledger .txn-stream {')
  report.check(!!gutter && gutter.includes('padding-inline: calc(var(--txn-zen-size) + var(--sp-4));'), 'the zen control never covers the reader: the ledger stream must reserve the control\'s inline-end gutter')
  const column = ruleAt(css, '.txn-turnwrap-ledger {')
  report.check(!!column && column.includes('margin-inline: auto;'), 'the zen control never covers the reader: the reader column must be right-aligned inside the remaining space')
  const handle = ruleAt(css, '.txn-reader-handle {\n  position: absolute;')
  report.check(!!handle && handle.includes('transform: translate(0, -50%);'), 'the width handle never covers the text edge: the handle must be drawn fully outside the measure')
  report.check(css.includes('.txn-reader-handle { display: none; }'), 'the width handle never covers the text edge: the handle must leave the narrow viewport')
  report.check(css.includes('.txn-app.txn-ledger.txn-zen .txn-body-grid'), 'the zen layout is ledger only: the collapsed grid rule must be scoped to the ledger root')
  report.check(/@media \(width < 1080px\) \{ \.txn-zen-control \{ display: none; \} \}/.test(css), 'zen leaves where there are no rails: the control must hide below the two-rail breakpoint')
  const grip = ruleAt(css, '.txn-reader-handle::after {')
  report.check(!!grip && grip.includes('inline-size: calc(var(--stroke-emphasis) + var(--stroke-hairline));') && grip.includes('block-size: var(--sp-6);'), 'the width handle reads as a grip: it must stay a slim 3x32 mark')
  const footer = ruleAt(css, '.txn-footer {')
  report.check(!!footer && /align-items: stretch/.test(footer) && !/flex-direction: column/.test(footer), 'the bottom bar is one row: it must not stack a second row')
  const railCard = ruleAt(css, '.txn-rail-turn {')
  report.check(!!railCard && railCard.includes('padding: var(--sp-2) var(--sp-4);'), 'the sidebar user-turn cards breathe: they must take a token inset')
  report.check(!!railCard && !/border-bottom/.test(railCard), 'the sidebar cards carry no rule: the turn head separates them')
  report.check(/\.txn-trace-head-graph \{ display: flex; \}/.test(css), 'graph keeps its way back: the phone must restore the turns bar in graph mode')
  const turnRule = ruleAt(css, '.txn-ledger .txn-turn-rule {')
  report.check(!!turnRule && turnRule.includes('max-inline-size: var(--txn-reader-width);') && turnRule.includes('margin-inline: auto;'), 'the turn rule belongs to the reader column: it must not run out to the stream edge')
  const rootRule = ruleAt(css, '.txn-app {')
  report.check(!!rootRule && !rootRule.includes('--txn-reader-width'), 'the reader width is ledger only: the classic root must declare no reader width')
  const ledgerRoot = ruleAt(css, '.txn-ledger {')
  report.check(!!ledgerRoot && ledgerRoot.includes('--txn-reader-width: 840px;'), 'the reader width is ledger only: the ledger root carries the default width')
  const phase = ruleAt(css, '.txn-ledger .txn-phase {')
  report.check(!!phase && phase.includes('max-inline-size: var(--txn-reader-width);') && phase.includes('margin-inline: auto;'), 'the phase heading belongs to the reader column: it must take the reader width on the reader column\'s trailing edge')
}
{
  const column = ruleAt(css, '.txn-turnwrap-ledger {')
  report.check(!!column && column.includes('max-inline-size: var(--txn-reader-width);'), 'the ledger prose fills the reader width: the turn column must take max-inline-size: var(--txn-reader-width)')
  const prose = ruleAt(css, '.txn-turnwrap-ledger .txn-body > .txn-md-prose')
  report.check(!!prose && prose.includes('max-inline-size: none;'), 'the ledger prose fills the reader width: the ledger reader must clear the measured prose cap with max-inline-size: none')
  for (const selector of ['.txn-md-prose', '.txn-md-list', '.txn-md-heading', '.txn-md-blockquote', '.txn-md-rule']) {
    report.check(!!prose && prose.includes(selector), `the ledger prose fills the reader width: ${selector} must follow the reader width`)
  }
  const classic = ruleAt(css, '.txn-body > .txn-md-prose')
  report.check(!!classic && classic.includes('max-inline-size: var(--measure-prose);'), 'the ledger prose fills the reader width: the classic surface must keep its prose measure')
}
{
  const work = ruleAt(css, '.txn-work {')
  report.check(!!work && work.includes('--txn-work-inline:'), 'the work summary and the tool rows share one inline edge: .txn-work must declare --txn-work-inline')
  report.check(!!work && work.includes('--txn-work-name-offset:'), 'the work summary and the tool rows share one inline edge: .txn-work must carry the tool-name column offset')
  for (const anchor of ['.txn-work-head {', '.txn-work .txn-tc-head {', '.txn-work .txn-tcbody {']) {
    const block = ruleAt(css, anchor)
    report.check(!!block && block.includes('padding-inline: var(--txn-work-inline);'), `the work summary and the tool rows share one inline edge: ${anchor.slice(0, -2)} must pad by var(--txn-work-inline)`)
  }
  const ledgerCount = ruleAt(css, '.txn-ledger .txn-work-head .txn-work-count {')
  report.check(!!ledgerCount && ledgerCount.includes('padding-inline-start: 0;'), 'the work summary starts at the reading edge: the ledger drops the tool-name offset')
}

/* ── mounted behaviour ────────────────────────────────────────────────────────── */
const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }

await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const vm = adaptTranscript(fixture.payload)
  let streamWidth = FULL
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return this.classList?.contains('txn-stream') ? streamWidth : 0 },
  })
  if (vm.turns.length !== 6 || vm.tasks.length !== 2) throw new Error(`${FIXTURE}: the payload must cook to 6 turns and 2 tasks`)
  const toolsTurn = vm.turns.find((turn) => turn.index === 1)
  const tools = toolsTurn?.toolCalls ?? []
  if (tools.length !== 2) throw new Error(`${FIXTURE}: turn 1 must cook with a bash call and an edit call, received ${tools.length}`)

  const baseProps = { viewModel: vm, capabilities: CAPABILITIES, presentation: 'ledger' }
  const mountViewer = (props = {}) => mount(React.createElement(TranscriptViewer, { ...baseProps, ...props }))
  const railState = (container) => ({
    outline: !!container.querySelector('.txn-rail-left'),
    filters: !!container.querySelector('.txn-rail-right'),
    outlineStrip: !!container.querySelector('.txn-rail-strip-left'),
    filtersStrip: !!container.querySelector('.txn-rail-strip-right'),
  })
  /** mount a host-controlled viewer so every emitted layout is both observable and applied. */
  const mountControlled = ({ layout, zen = false, onLayout, onZen, props = {} }) => {
    function Controlled() {
      const [sidebarLayout, setSidebarLayout] = React.useState(layout)
      const [zenValue, setZenValue] = React.useState(zen)
      return React.createElement(TranscriptViewer, {
        ...baseProps,
        ...props,
        sidebarLayout,
        onSidebarLayoutChange: (next) => { onLayout?.(next); setSidebarLayout(next) },
        zen: zenValue,
        onZenChange: (next) => { onZen?.(next); setZenValue(next) },
      })
    }
    return mount(React.createElement(Controlled))
  }
  const expectRails = (row, container) => {
    const state = railState(container)
    for (const rail of RAIL_KEYS) {
      const key = rail === 'outline' ? 'outline' : 'filters'
      const open = row.open.includes(rail)
      report.check(state[key] === open, `${row.name}: the ${rail} rail must be ${open ? 'open' : 'collapsed'}, received ${JSON.stringify(state)}`)
      report.check(state[rail === 'outline' ? 'outlineStrip' : 'filtersStrip'] === !open, `${row.name}: the ${rail} rail must render ${open ? 'no strip' : 'its strip'}`)
    }
    report.check(container.querySelector('.txn-rail-left .txn-host-sidebar, .txn-host-sidebar') === null, `${row.name}: the viewer must never render the host-owned sidebar`)
  }

  {
    const mounted = await mountViewer()
    expectRails(fixture.defaultsCase, mounted.container)
    await mounted.unmount()
  }

  for (const row of fixture.layoutCases) {
    const mounted = row.kind === 'alias-wins'
      ? await mountViewer({
        sidebarLayout: row.layout,
        ...(row.alias.rail === 'outline' ? { leftRailOpen: row.alias.open } : { rightRailOpen: row.alias.open }),
      })
      : await mountControlled({ layout: row.layout })
    expectRails(row, mounted.container)
    await mounted.unmount()
  }

  const handleOf = (container) => container.querySelector('[role="separator"][aria-label="reading width"]')
  const widthOf = (container) => Number(handleOf(container)?.getAttribute('aria-valuenow'))
  /* React sets the width through a custom property; read the px value back tolerantly (the
     serialized attribute's spacing is the DOM's, not ours). */
  const rootWidthOf = (container) => {
    const style = container.querySelector('.txn-app')?.getAttribute('style') ?? ''
    const match = style.match(/--txn-reader-width:\s*([\d.]+)px/)
    return match ? Number(match[1]) : null
  }

  for (const row of fixture.interactions) {
    if (row.kind === 'rail-toggle') {
      const layouts = []
      const mounted = await mountControlled({ layout: layoutOf(true, true, true), onLayout: (next) => layouts.push(next) })
      const container = mounted.container
      const expectEmit = (expected, label) => {
        report.check(layouts.length > 0 && same(layouts[layouts.length - 1], expected), `${row.name}: ${label} must emit ${JSON.stringify(expected)}, received ${JSON.stringify(layouts[layouts.length - 1])}`)
      }
      await mounted.act(() => click(window, container.querySelector('.txn-rail-left .txn-rail-collapse')))
      expectEmit(layoutOf(false, true, true), 'the outline collapse')
      report.check(!!container.querySelector('.txn-rail-strip-left') && !container.querySelector('.txn-rail-left'), `${row.name}: the outline collapse must render its strip`)
      await mounted.act(() => click(window, container.querySelector('.txn-rail-strip-left .txn-rail-reopen')))
      expectEmit(layoutOf(true, true, true), 'the outline reopen strip')
      await mounted.act(() => click(window, container.querySelector('.txn-rail-right .txn-rail-collapse')))
      expectEmit(layoutOf(true, false, true), 'the filters collapse')
      await mounted.act(() => click(window, container.querySelector('.txn-rail-strip-right .txn-rail-reopen')))
      expectEmit(layoutOf(true, true, true), 'the filters reopen strip')
      for (const layout of layouts) report.check(same(Object.keys(layout), LAYOUT_KEYS), `${row.name}: every emission must carry exactly outline, filters and host, received ${JSON.stringify(Object.keys(layout))}`)
      await mounted.unmount()
    } else if (row.kind === 'zen-enter') {
      const layouts = []
      const zenValues = []
      const mounted = await mountControlled({ layout: layoutOf(true, false, true), onLayout: (next) => layouts.push(next), onZen: (next) => zenValues.push(next) })
      const container = mounted.container
      const zenButton = container.querySelector('.txn-zen-control')
      report.check(!!zenButton, `${row.name}: the viewer must render the zen control`)
      report.check(zenButton?.tagName === 'BUTTON', `${row.name}: the zen control must be a button so it is keyboard reachable`)
      report.check(zenButton?.getAttribute('aria-pressed') === 'false', `${row.name}: the zen control must start unpressed`)
      report.check(zenButton?.getAttribute('aria-label') === 'zen mode', `${row.name}: the control must keep one stable name, "zen mode"`)
      report.check(zenButton?.querySelector('.txn-zen-label')?.textContent?.trim() === 'zen', `${row.name}: the visible word must read "zen" before entering`)
      await mounted.act(() => click(window, zenButton))
      await mounted.settle()
      report.check(zenValues.length === 1 && zenValues[0] === true, `${row.name}: entering zen must emit onZenChange(true), received ${JSON.stringify(zenValues)}`)
      report.check(same(layouts[0], layoutOf(false, false, false)), `${row.name}: entering zen must collapse every rail, received ${JSON.stringify(layouts[0])}`)
      report.check(container.querySelectorAll('.txn-rail').length === 0 && container.querySelectorAll('.txn-rail-strip').length === 0, `${row.name}: zen must leave no rail and no strip`)
      report.check(container.querySelector('.txn-body-grid')?.getAttribute('data-zen') === 'true', `${row.name}: the body grid must report zen state`)
      report.check(container.querySelector('.txn-app')?.classList.contains('txn-zen'), `${row.name}: the root must carry txn-zen so the collapsed grid applies`)
      report.check(container.querySelector('.txn-zen-control')?.getAttribute('aria-pressed') === 'true', `${row.name}: the control must report pressed state`)
      report.check(container.querySelector('.txn-zen-control')?.getAttribute('aria-label') === 'zen mode', `${row.name}: the toggle must keep its stable name while pressed`)
      report.check(container.querySelector('.txn-zen-label')?.textContent?.trim() === 'zen', `${row.name}: the visible word must still read "zen" inside zen, never "exit zen"`)
      await mounted.unmount()
    } else if (row.kind === 'zen-restore') {
      const layouts = []
      const zenValues = []
      const mounted = await mountControlled({ layout: layoutOf(false, true, true), onLayout: (next) => layouts.push(next), onZen: (next) => zenValues.push(next) })
      const container = mounted.container
      await mounted.act(() => click(window, container.querySelector('.txn-zen-control')))
      await mounted.settle()
      await mounted.act(() => click(window, container.querySelector('.txn-zen-control')))
      await mounted.settle()
      report.check(zenValues.length === 2 && zenValues[0] === true && zenValues[1] === false, `${row.name}: zen must report true then false, received ${JSON.stringify(zenValues)}`)
      report.check(same(layouts[layouts.length - 1], layoutOf(false, true, true)), `${row.name}: leaving zen must restore {outline:false,filters:true,host:true}, received ${JSON.stringify(layouts[layouts.length - 1])}`)
      const state = railState(container)
      report.check(!state.outline && state.outlineStrip, `${row.name}: the collapsed outline must come back as its strip`)
      report.check(state.filters && !state.filtersStrip, `${row.name}: the open filters rail must come back expanded`)
      await mounted.unmount()
    } else if (row.kind === 'zen-width') {
      const layouts = []
      const mounted = await mountControlled({ layout: layoutOf(true, false, true), onLayout: (next) => layouts.push(next) })
      const container = mounted.container
      await mounted.act(() => click(window, container.querySelector('.txn-zen-control')))
      await mounted.settle()
      report.check(layouts.length === 1, `${row.name}: entering zen must emit exactly one layout, received ${layouts.length}`)
      const handle = handleOf(container)
      report.check(!!handle, `${row.name}: the width handle must remain reachable in zen`)
      if (handle) {
        await mounted.act(() => keydown(window, handle, 'End'))
        await mounted.act(() => keydown(window, handle, 'Home'))
        await mounted.act(() => keydown(window, handle, 'ArrowRight'))
      }
      report.check(layouts.length === 1, `${row.name}: a width change in zen must not write the layout, received ${JSON.stringify(layouts)}`)
      await mounted.act(() => click(window, container.querySelector('.txn-zen-control')))
      await mounted.settle()
      report.check(same(layouts[layouts.length - 1], layoutOf(true, false, true)), `${row.name}: the snapshot must survive the width changes and restore exactly`)
      await mounted.unmount()
    } else if (row.kind === 'zen-strips') {
      const mounted = await mountControlled({ layout: layoutOf(false, false, true) })
      const container = mounted.container
      report.check(container.querySelectorAll('.txn-rail-strip').length === 2, `${row.name}: the fixture must start with both strips mounted`)
      await mounted.act(() => click(window, container.querySelector('.txn-zen-control')))
      await mounted.settle()
      report.check(container.querySelectorAll('.txn-rail-strip').length === 0, `${row.name}: zen must hide both reopen strips`)
      report.check(container.querySelector('.txn-rail-strip-left') === null && container.querySelector('.txn-rail-strip-right') === null, `${row.name}: neither strip may survive zen`)
      await mounted.unmount()
    } else if (row.kind === 'zen-placement') {
      /* where the control LIVES, not where it is painted: jsdom lays nothing out, so the
         mount proves the column it belongs to and the rails it must never join. */
      const mounted = await mountControlled({ layout: layoutOf(true, true, true) })
      const container = mounted.container
      const center = container.querySelector('.txn-center')
      report.check(!!center, `${row.name}: the ledger must render its reader column`)
      const control = container.querySelector('.txn-zen-control')
      report.check(!!control, `${row.name}: the viewer must render the zen control`)
      report.check(!!control && container.querySelector('.txn-center .txn-zen-control') === control, `${row.name}: the zen control must sit inside the reader column`)
      for (const rail of ['.txn-rail-left', '.txn-rail-right']) {
        report.check(container.querySelector(`${rail} .txn-zen-control`) === null, `${row.name}: the zen control must not sit inside ${rail}`)
      }
      const trace = container.querySelector('.txn-center .txn-trace')
      report.check(!!trace, `${row.name}: the reader column must hold the trace`)
      report.check(control?.closest('.txn-center') === center && trace?.closest('.txn-center') === center, `${row.name}: the control and the trace must share the one reader column`)
      await mounted.unmount()
    } else if (row.kind === 'width-drag') {
      const widths = []
      const mounted = await mountViewer({ onReaderWidthChange: (width) => widths.push(width) })
      const container = mounted.container
      const handle = handleOf(container)
      report.check(!!handle, `${row.name}: the ledger reader must render the width handle`)
      report.check(handle?.getAttribute('aria-orientation') === 'vertical', `${row.name}: the handle must be a vertical separator`)
      report.check(handle?.getAttribute('aria-valuemin') === String(SNAPS[0]), `${row.name}: aria-valuemin must be ${SNAPS[0]}`)
      report.check(handle?.getAttribute('aria-valuemax') === String(FULL), `${row.name}: aria-valuemax must be the measured full width ${FULL}, received ${handle?.getAttribute('aria-valuemax')}`)
      report.check(handle?.getAttribute('aria-valuenow') === String(fixture.defaultWidth), `${row.name}: the width must start at ${fixture.defaultWidth}`)
      report.check(rootWidthOf(container) === fixture.defaultWidth, `${row.name}: the root must carry the reader width custom property, received ${rootWidthOf(container)}`)
      const press = (type, clientX, buttons = type === 'pointerup' ? 0 : 1) => handle.dispatchEvent(new window.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, buttons, clientX, clientY: 12, pointerId: 1, pointerType: 'mouse' }))
      await mounted.act(() => press('pointerdown', 400))
      await mounted.act(() => press('pointermove', 420))
      report.check(widthOf(container) === 880, `${row.name}: a 20px drag must widen the column live to 880, received ${widthOf(container)}`)
      await mounted.act(() => press('pointerup', 420))
      report.check(widthOf(container) === fixture.defaultWidth, `${row.name}: releasing at 880 must snap back to ${fixture.defaultWidth}, received ${widthOf(container)}`)
      await mounted.act(() => press('pointerdown', 400))
      await mounted.act(() => press('pointermove', 560))
      report.check(widthOf(container) === FULL, `${row.name}: a long drag must clamp at the full width ${FULL}, received ${widthOf(container)}`)
      await mounted.act(() => press('pointerup', 560))
      report.check(widthOf(container) === FULL, `${row.name}: releasing past the end must rest at full, received ${widthOf(container)}`)
      report.check(handle?.getAttribute('aria-valuetext') === 'full width', `${row.name}: the full snap must be announced as full width, received ${JSON.stringify(handle?.getAttribute('aria-valuetext'))}`)
      report.check(same(widths.slice(0, 4), [880, fixture.defaultWidth, FULL, 'full']), `${row.name}: the host must hear every width change, received ${JSON.stringify(widths)}`)
      report.check(rootWidthOf(container) === FULL, `${row.name}: the root must follow the released width, received ${rootWidthOf(container)}`)
      await mounted.unmount()
    } else if (row.kind === 'width-keys') {
      const widths = []
      const mounted = await mountViewer({ onReaderWidthChange: (width) => widths.push(width) })
      const container = mounted.container
      const handle = handleOf(container)
      const step = async (key, expected) => {
        let prevented = false
        await mounted.act(() => { prevented = keydown(window, handle, key) })
        report.check(prevented, `${row.name}: ${key} must prevent the page default`)
        report.check(widthOf(container) === expected, `${row.name}: ${key} must rest at ${expected}, received ${widthOf(container)}`)
      }
      await step('ArrowRight', FULL)
      await step('ArrowLeft', SNAPS[1])
      await step('ArrowLeft', SNAPS[0])
      await step('ArrowLeft', SNAPS[0])
      await step('End', FULL)
      await step('Home', SNAPS[0])
      await step('ArrowUp', SNAPS[1])
      await step('ArrowDown', SNAPS[0])
      report.check(widths[0] === 'full' && widths.at(-1) === SNAPS[0], `${row.name}: the host must hear every keyboard snap, received ${JSON.stringify(widths)}`)
      await mounted.unmount()
    } else if (row.kind === 'width-rails') {
      const layouts = []
      const mounted = await mountControlled({ layout: layoutOf(true, true, true), onLayout: (next) => layouts.push(next) })
      const container = mounted.container
      const start = railState(container)
      report.check(start.outline && start.filters && !start.outlineStrip && !start.filtersStrip, `${row.name}: the fixture must start with both rails open, received ${JSON.stringify(start)}`)
      const handle = handleOf(container)
      const press = (type, clientX, buttons = type === 'pointerup' ? 0 : 1) => handle.dispatchEvent(new window.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, buttons, clientX, clientY: 12, pointerId: 1, pointerType: 'mouse' }))
      await mounted.act(() => press('pointerdown', 400))
      await mounted.act(() => press('pointermove', 560))
      await mounted.act(() => press('pointerup', 560))
      report.check(widthOf(container) === FULL, `${row.name}: the drag must reach the full width ${FULL}, received ${widthOf(container)}`)
      await mounted.act(() => keydown(window, handle, 'Home'))
      report.check(widthOf(container) === SNAPS[0], `${row.name}: the keyboard must tighten to ${SNAPS[0]}, received ${widthOf(container)}`)
      report.check(layouts.length === 0, `${row.name}: a width change must not emit a sidebar layout, received ${JSON.stringify(layouts)}`)
      const end = railState(container)
      report.check(same(start, end), `${row.name}: neither rail may fold when the width changes, received ${JSON.stringify(end)}`)
      await mounted.unmount()
    } else if (row.kind === 'work-grid') {
      const mounted = await mountViewer()
      const container = mounted.container
      const panel = container.querySelector('.txn-modelactions')
      report.check(!!panel, `${row.name}: the turn with tools must render the model-actions block`)
      report.check(!!panel?.querySelector('.txn-modelactions-head'), `${row.name}: the block names the work on one line`)
      const panelToggle = panel?.querySelector('.txn-modelactions-head')
      if (panelToggle) await mounted.act(() => click(window, panelToggle))
      await mounted.settle()
      const rows = [...(panel?.querySelectorAll('.txn-modelactions-rows .txn-tc-head') ?? [])]
      report.check(rows.length === tools.length, `${row.name}: the panel must hold all ${tools.length} tool rows, received ${rows.length}`)
      for (const rowButton of rows) await mounted.act(() => click(window, rowButton))
      await mounted.settle()
      const bodies = [...(panel?.querySelectorAll('.txn-tcbody') ?? [])]
      report.check(bodies.length === 2, `${row.name}: opening both rows must reveal both bodies, received ${bodies.length}`)
      report.check(bodies.some((body) => body.querySelector('.txn-term')), `${row.name}: the bash body must render its output`)
      report.check(bodies.some((body) => body.querySelector('.txn-diff')), `${row.name}: the edit body must render its diff`)
      report.check(!!panel.querySelector('.txn-tc-head') && !!panel.querySelector('.txn-tcbody'), `${row.name}: both the rows and their bodies must sit inside the block`)
      await mounted.unmount()
    } else if (row.kind === 'strip-width') {
      const mounted = await mountControlled({ layout: layoutOf(false, false, true) })
      const container = mounted.container
      report.check(container.querySelectorAll('.txn-rail-strip').length === 2, `${row.name}: both collapsed rails must render a strip`)
      report.check(!!container.querySelector('.txn-rail-strip-left') && !!container.querySelector('.txn-rail-strip-right'), `${row.name}: one strip per rail`)
      report.check(!!container.querySelector('.txn-rail-strip .txn-rail-strip-label'), `${row.name}: a strip must keep its vertical label`)
      await mounted.unmount()
    } else if (row.kind === 'reader-measure') {
      const mounted = await mountViewer()
      const container = mounted.container
      report.check(!!container.querySelector('.txn-turnwrap-ledger'), `${row.name}: the ledger turns must render their reader column`)
      report.check(rootWidthOf(container) === fixture.defaultWidth, `${row.name}: the viewer must own the reader width custom property`)
      await mounted.unmount()
    } else if (row.kind === 'header-width') {
      const mounted = await mountViewer()
      const container = mounted.container
      const header = container.querySelector('.txn-header')
      report.check(!!header, `${row.name}: the viewer must render its header`)
      for (const selector of ['[role="separator"]', 'select', '.txn-reader-handle', '[aria-label*="width"]']) {
        report.check(header?.querySelector(selector) == null, `${row.name}: the header must carry no width selector (${selector})`)
      }
      report.check(!!handleOf(container) && handleOf(container).closest('.txn-header') === null, `${row.name}: the one width control is the reader handle, outside the header`)
      await mounted.unmount()
    } else if (row.kind === 'classic-only') {
      const mounted = await mountViewer({ presentation: undefined })
      const container = mounted.container
      const app = container.querySelector('.txn-app')
      report.check(!!app && !app.classList.contains('txn-ledger'), `${row.name}: the mount must be the classic surface`)
      report.check(container.querySelector('.txn-zen-control') === null, `${row.name}: classic must render no zen control`)
      report.check(container.querySelector('.txn-reader-handle') === null, `${row.name}: classic must render no width handle`)
      report.check(!app?.classList.contains('txn-zen'), `${row.name}: classic must carry no zen class`)
      report.check(!(app?.getAttribute('style') ?? '').includes('--txn-reader-width'), `${row.name}: classic must carry no reader width property`)
      report.check(container.querySelector('.txn-body-grid')?.getAttribute('data-zen') == null, `${row.name}: classic must report no zen state`)
      report.check(!!container.querySelector('.txn-rail-left') && !!container.querySelector('.txn-rail-right'), `${row.name}: classic keeps both rails`)
      await mounted.unmount()
    } else if (row.kind === 'classic-zen') {
      const mounted = await mountViewer({ presentation: undefined, zen: true })
      const container = mounted.container
      const app = container.querySelector('.txn-app')
      report.check(!app?.classList.contains('txn-zen'), `${row.name}: a zen request must not add the zen class to classic`)
      report.check(container.querySelector('.txn-zen-control') === null, `${row.name}: classic must still render no zen control`)
      report.check(!!container.querySelector('.txn-rail-left') && !!container.querySelector('.txn-rail-right'), `${row.name}: classic rails must stay open despite the zen value`)
      report.check(container.querySelector('.txn-body-grid')?.getAttribute('data-left-rail') === 'open', `${row.name}: classic must keep its rail state`)
      await mounted.unmount()
    } else if (row.kind === 'width-drag-lifecycle') {
      const mounted = await mountViewer()
      const container = mounted.container
      const handle = handleOf(container)
      const press = (type, clientX, buttons = type === 'pointerup' || type === 'lostpointercapture' || type === 'pointerleave' ? 0 : 1) => handle.dispatchEvent(new window.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, buttons, clientX, clientY: 12, pointerId: 1, pointerType: 'mouse' }))
      await mounted.act(() => press('pointerdown', 400))
      await mounted.act(() => press('pointermove', 420))
      report.check(widthOf(container) === 880, `${row.name}: the armed drag must move, received ${widthOf(container)}`)
      await mounted.act(() => press('lostpointercapture', 420))
      await mounted.act(() => press('pointermove', 520))
      report.check(widthOf(container) === fixture.defaultWidth, `${row.name}: a move after a lost capture must not resize, received ${widthOf(container)}`)
      await mounted.act(() => press('pointerdown', 400))
      await mounted.act(() => press('pointermove', 520, 0))
      report.check(widthOf(container) === fixture.defaultWidth, `${row.name}: a mouse move with no button held must not resize, received ${widthOf(container)}`)
      const leave = () => handle.dispatchEvent(new window.PointerEvent('pointerout', { bubbles: true, cancelable: true, button: 0, buttons: 0, clientX: 520, clientY: 12, pointerId: 1, pointerType: 'mouse', relatedTarget: window.document.body }))
      await mounted.act(() => leave())
      await mounted.act(() => press('pointermove', 560))
      report.check(widthOf(container) === fixture.defaultWidth, `${row.name}: a move after the pointer leaves must not resize, received ${widthOf(container)}`)
      await mounted.unmount()
    } else if (row.kind === 'width-controlled') {
      const mounted = await mountViewer({ readerWidth: row.readerWidth })
      const container = mounted.container
      report.check(widthOf(container) === px(row.expected), `${row.name}: the supplied width must normalise to ${row.expected}, received ${widthOf(container)}`)
      report.check(rootWidthOf(container) === px(row.expected), `${row.name}: the root property must carry the normalised width, received ${rootWidthOf(container)}`)
      await mounted.unmount()
    } else if (row.kind === 'width-full-follows') {
      /* a reader resting at full follows the space it has: a resize re-measures the stream */
      const mounted = await mountViewer({ readerWidth: 'full' })
      const container = mounted.container
      report.check(widthOf(container) === FULL, `${row.name}: full must start at the measured width ${FULL}, received ${widthOf(container)}`)
      streamWidth = RESIZED
      await mounted.act(() => window.dispatchEvent(new window.Event('resize')))
      await mounted.settle()
      report.check(widthOf(container) === RESIZED, `${row.name}: full must follow the stream to ${RESIZED}, received ${widthOf(container)}`)
      report.check(rootWidthOf(container) === RESIZED, `${row.name}: the root property must follow the resize, received ${rootWidthOf(container)}`)
      report.check(handleOf(container)?.getAttribute('aria-valuemax') === String(RESIZED), `${row.name}: the range must end at the new full width`)
      streamWidth = FULL
      await mounted.unmount()
    } else if (row.kind === 'footer-tabs') {
      const mounted = await mountViewer()
      const container = mounted.container
      const footer = container.querySelector('.txn-footer')
      report.check(!!footer, `${row.name}: the viewer must render its bottom bar`)
      const tablist = container.querySelector('[role="tablist"]')
      report.check(!!tablist, `${row.name}: the session views must keep their named tablist`)
      report.check(tablist?.getAttribute('aria-label') === 'session views', `${row.name}: the tablist must stay named "session views"`)
      report.check(tablist?.closest('.txn-footer') === footer, `${row.name}: the tablist must be a descendant of the bottom bar`)
      report.check(footer?.querySelector('.txn-foot-tabs > [role="tablist"]') === tablist, `${row.name}: the tablist must be the bottom bar's first row`)
      report.check(container.querySelector('.txn-tabbar') === null, `${row.name}: no separate pre-body tab row may remain`)
      report.check(container.querySelector('.txn-app > .txn-tabs') === null, `${row.name}: the strip must not sit above the body`)
      const panel = container.querySelector('[role="tabpanel"]')
      report.check(!!panel && !!panel.id, `${row.name}: the tab panel must keep its id`)
      const tabs = [...(tablist?.querySelectorAll('[role="tab"]') ?? [])]
      report.check(tabs.length === 5, `${row.name}: the row must keep all five views, received ${tabs.length}`)
      for (const tab of tabs) {
        report.check(tab.getAttribute('aria-controls') === panel?.id, `${row.name}: every tab's aria-controls must resolve to the panel`)
        report.check(!!tab.querySelector('.cnt.tnum'), `${row.name}: every view must keep its count`)
      }
      const roving = tabs.filter((tab) => tab.getAttribute('tabindex') === '0')
      report.check(roving.length === 1 && roving[0] === tabs[1], `${row.name}: exactly one tab must carry the roving tab stop (the active view)`)
      let prevented = false
      await mounted.act(() => { prevented = keydown(window, tablist, 'ArrowRight') })
      await mounted.settle()
      report.check(prevented, `${row.name}: ArrowRight must still prevent the page default`)
      const moved = tablist.querySelectorAll('[role="tab"]')[2]
      report.check(moved?.getAttribute('aria-selected') === 'true', `${row.name}: ArrowRight must select the next view`)
      report.check(moved?.getAttribute('tabindex') === '0' && tabs[1].getAttribute('tabindex') === '-1', `${row.name}: the roving tab stop must follow the selection`)
      report.check(window.document.activeElement === moved, `${row.name}: the keyboard must reach the tab inside the bottom bar`)
      /* the bar sits after the panel in DOM order, so the viewer opens with a jump control */
      const skip = container.querySelector('.txn-skip')
      report.check(!!skip && skip === container.querySelector('.txn-app > .txn-skip'), `${row.name}: the viewer must open with a skip control to the views`)
      report.check(skip?.tagName === 'BUTTON' && /session views/.test(skip?.textContent ?? ''), `${row.name}: the skip control must name its destination`)
      await mounted.act(() => { window.document.activeElement?.blur() })
      await mounted.act(() => click(window, skip))
      await mounted.settle()
      report.check(window.document.activeElement === moved, `${row.name}: the skip control must land on the active view`)
      await mounted.unmount()
    } else if (row.kind === 'footer-visible') {
      report.check(!/\.txn-footer[^{}]*\{[^}]*display\s*:\s*none/.test(css), `${row.name}: no rule may hide the bottom bar at any width`)
      report.check(!/\.txn-foot-tabs[^{}]*\{[^}]*display\s*:\s*none/.test(css), `${row.name}: no rule may hide the views row`)
      report.check(/\.txn-hint \{ display: none; \}/.test(css), `${row.name}: the keyboard hint may leave a touch screen or a phone`)
      report.check(/\.txn-foot-meta:not\(:has\(\.txn-progress\)\) \{ display: none; \}/.test(css), `${row.name}: the meta row may collapse only when the counter is not opted in`)
    } else if (row.kind === 'footer-config') {
      /* the shortcut hint and the position counter are host opt-in, one flag each */
      const off = await mountViewer()
      report.check(off.container.querySelector('.txn-foot-meta') === null, `${row.name}: neither part may render without the prop`)
      report.check(off.container.querySelector('.txn-hint') === null, `${row.name}: the shortcut hint must stay out by default`)
      report.check(off.container.querySelector('.txn-progress') === null, `${row.name}: the position counter must stay out by default`)
      await off.unmount()
      const on = await mountViewer({ footer: { hints: true, progress: true } })
      const meta = on.container.querySelector('.txn-footer .txn-foot-meta')
      report.check(!!meta, `${row.name}: opting in must render the meta row inside the bottom bar`)
      const hint = meta?.querySelector('.txn-hint')
      const counter = meta?.querySelector('.txn-progress')
      report.check(!!hint, `${row.name}: the hint flag must render the shortcut line`)
      report.check(!!counter, `${row.name}: the progress flag must render the position counter`)
      report.check(/\bj\/k\b|step turns/.test(hint?.textContent ?? ''), `${row.name}: the hint must name the step keys`)
      report.check(/\d+ of \d+/.test(counter?.textContent ?? ''), `${row.name}: the counter must read its position`)
      await on.unmount()
      const partial = await mountViewer({ footer: { hints: true } })
      report.check(!!partial.container.querySelector('.txn-hint'), `${row.name}: a hint-only opt-in must render the hint`)
      report.check(partial.container.querySelector('.txn-progress') === null, `${row.name}: a hint-only opt-in must not render the counter`)
      await partial.unmount()
    } else if (row.kind === 'graph-escape') {
      /* the reading view hides the turns bar on a phone; graph mode must keep it, or the switch
         that leaves graph disappears with it. The class is what the phone rule keys on. */
      const graph = await mountViewer({ viewMode: 'graph' })
      report.check(graph.container.querySelector('.txn-trace-head')?.classList.contains('txn-trace-head-graph'), `${row.name}: graph mode must mark the turns bar`)
      report.check(!!graph.container.querySelector('.txn-graphslot'), `${row.name}: graph mode must mount the graph slot`)
      await graph.unmount()
      const list = await mountViewer({ viewMode: 'list' })
      report.check(!list.container.querySelector('.txn-trace-head')?.classList.contains('txn-trace-head-graph'), `${row.name}: the reading view must not mark the turns bar`)
      await list.unmount()
    } else if (row.kind === 'crumb-title') {
      const named = { ...vm, session: { ...vm.session, title: 'Prepare the fixture for the check' } }
      const defaultMounted = await mountViewer({ viewModel: named })
      const defaultCrumb = defaultMounted.container.querySelector('nav.txn-crumb')
      const defaultTitle = defaultMounted.container.querySelector('.txn-title')?.textContent.trim()
      const defaultStops = [...(defaultCrumb?.querySelectorAll(':scope > :not(svg)') ?? [])]
      const defaultLast = defaultStops[defaultStops.length - 1]
      report.check(!!defaultCrumb?.classList.contains('txn-crumb-derived'), `${row.name}: the default trail must be marked as derived`)
      report.check(defaultTitle === 'Prepare the fixture for the check', `${row.name}: the fixture must derive a titled transcript, received ${JSON.stringify(defaultTitle)}`)
      report.check(defaultLast?.textContent === defaultTitle, `${row.name}: the last crumb must read the title, received ${JSON.stringify(defaultLast?.textContent)}`)
      report.check(defaultLast?.classList.contains('cur'), `${row.name}: the last crumb must be the current place`)
      report.check(defaultTitle !== named.session.id, `${row.name}: the last crumb must not fall back to the session id`)
      await defaultMounted.unmount()
      const hostTrail = [{ label: 'pull requests', href: '#pulls' }, { label: 'acme/village#7', href: '#pull' }]
      const hostMounted = await mountViewer({ breadcrumb: hostTrail })
      const hostCrumb = hostMounted.container.querySelector('nav.txn-crumb')
      const hostStops = [...(hostCrumb?.querySelectorAll(':scope > :not(svg)') ?? [])]
      report.check(hostStops[hostStops.length - 1]?.textContent === 'acme/village#7', `${row.name}: a host-supplied trail must win unchanged`)
      report.check(!hostCrumb?.classList.contains('txn-crumb-derived'), `${row.name}: a host-supplied trail must not be marked derived`)
      await hostMounted.unmount()
      const curRule = ruleAt(css, '.txn-crumb-derived .cur:last-child {')
      report.check(!!curRule && curRule.includes('min-width: 0;') && curRule.includes('overflow: hidden;') && curRule.includes('text-overflow: ellipsis;') && curRule.includes('white-space: nowrap;'), `${row.name}: the derived title crumb must stay one line and truncate with an ellipsis`)
    } else if (row.kind === 'mobile-header') {
      report.check(css.includes('.txn-header { padding: var(--sp-2) var(--sp-3); }'), `${row.name}: the phone header must drop to the tight inset`)
      report.check(css.includes('.txn-crumb-derived { display: none; }'), `${row.name}: the derived trail must leave the phone`)
      const titleBlock = ruleAt(css, '.txn-title {\n    font-size: var(--fs-md);')
      report.check(!!titleBlock && titleBlock.includes('display: -webkit-box;') && titleBlock.includes('-webkit-box-orient: vertical;'), `${row.name}: the title must clamp to a fixed number of lines`)
      report.check(!!titleBlock && titleBlock.includes('-webkit-line-clamp: 2;') && titleBlock.includes('overflow: hidden;'), `${row.name}: the title must clamp to two lines`)
      report.check(!!titleBlock && titleBlock.includes('overflow-wrap: anywhere;'), `${row.name}: a long word must still wrap`)
      const metaBlock = ruleAt(css, '.txn-meta {\n    flex-wrap: nowrap;')
      report.check(!!metaBlock && metaBlock.includes('overflow-x: auto;'), `${row.name}: the chips must share one scrollable line`)
      report.check(css.includes('@media (width < 768px) {\n  .txn-header { padding: var(--sp-2) var(--sp-3); }'), `${row.name}: the header inset must live in the phone breakpoint`)
    } else {
      throw new Error(`${FIXTURE}: unknown interaction kind ${JSON.stringify(row.kind)}`)
    }
  }
})

report.finish(`${fixture.layoutCases.length + 1} layout combinations and ${fixture.interactions.length} interactions.`)
