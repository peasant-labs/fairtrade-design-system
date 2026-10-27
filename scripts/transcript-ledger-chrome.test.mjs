#!/usr/bin/env node
/* Mounted-source gate for the transcript viewer's ledger presentation: the `presentation` prop,
   its subtitle slot, the pinned header's title + minimap, and the user-turn task cards in the
   left rail. Every case mounts the REAL viewer (adaptTranscript -> TranscriptViewer) through
   vite, scrolls the trace so the pinned header renders, and asserts which chrome exists. The
   interaction rows then drive the minimap slider (pointer, keyboard, decorative ticks, visible
   turn set) and both rail jump paths.
   Cases: scripts/testdata/transcript-ledger-chrome.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-ledger-chrome;
   mutations: node scripts/parts-mutations.mjs scripts/transcript-ledger-chrome.test.mjs
   scripts/testdata/transcript-ledger-chrome.manifest.yaml */
import { loadFixturePair, assertExactNames, assertFields, withMountedSource, click, keydown, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-ledger-chrome.yaml'
const MANIFEST = 'scripts/testdata/transcript-ledger-chrome.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  cases: 'requiredCaseNames',
  interactions: 'requiredInteractionNames',
  railCases: 'requiredRailNames',
})
if (fixture.defaultsCase?.name !== manifest.requiredDefaultsCase) throw new Error(`${FIXTURE}: defaultsCase must be named ${JSON.stringify(manifest.requiredDefaultsCase)}`)

/* a case NAME alone does not protect its meaning: a swapped `kind` re-points the row at a
   cheaper branch and the name list still matches. So every row's kind is pinned by name too. */
function assertKindMap(rows, required, label) {
  const expected = required ?? {}
  for (const row of rows) {
    if (!(row.name in expected)) throw new Error(`${label}: ${JSON.stringify(row.name)} has no required kind`)
    if (row.kind !== expected[row.name]) throw new Error(`${label}: ${JSON.stringify(row.name)} must run kind ${JSON.stringify(expected[row.name])}, received ${JSON.stringify(row.kind)}`)
  }
  assertExactNames(rows.map((row) => row.name), Object.keys(expected), `${label} kinds`)
}
assertKindMap([fixture.defaultsCase, ...fixture.cases], manifest.requiredCaseKinds, FIXTURE)
assertKindMap(fixture.interactions, manifest.requiredInteractionKinds, FIXTURE)

/* the closed chrome set: name -> how a reader finds it in the mounted viewer. */
const CONTROLS = {
  'ledger-root': (root) => root.querySelector('.txn-app.txn-ledger'),
  'subtitle': (root) => root.querySelector('.txn-header .txn-sub'),
  'sticky-bar': (root) => root.querySelector('.txn-trace .txn-sticky'),
  'sticky-title': (root) => root.querySelector('.txn-sticky .txn-sticky-title'),
  'minimap': (root) => root.querySelector('.txn-sticky .txn-minimap'),
  'scrubber': (root) => root.querySelector('.txn-sticky .txn-scrub'),
  'sticky-provider': (root) => root.querySelector('.txn-sticky .pv-icon'),
  'sticky-model': (root) => root.querySelector('.txn-sticky .txn-sticky-model'),
  'rail-turns': (root) => root.querySelector('.txn-rail-left .txn-rail-turns'),
  'rail-waterfall': (root) => root.querySelector('.txn-rail-left .txn-ol-waterfall'),
  'rail-outline': (root) => root.querySelector('.txn-rail-left .txn-ol-row'),
  'task-boundary': (root) => root.querySelector('.txn-stream .txn-taskboundary'),
}
const CONTROL_NAMES = Object.keys(CONTROLS)
for (const row of [fixture.defaultsCase, ...fixture.cases]) {
  assertFields(row, ['name', 'kind', 'present', 'absent'], `${FIXTURE} ${row.name}`, ['props'])
  assertExactNames([...row.present, ...row.absent], CONTROL_NAMES, `${FIXTURE} ${row.name} controls`)
}
for (const row of fixture.interactions) assertFields(row, ['name', 'kind'], `${FIXTURE} ${row.name}`)
for (const row of fixture.railCases) assertFields(row, ['name', 'turn', 'duration', 'prompt'], `${FIXTURE} ${row.name}`)

const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: true, canChangeVisibility: false, canExport: true }
const SUBTITLE = 'a public transcript from fairtrade, read as a ledger.'

const FILTERS = {
  categories: { prompts: true, responses: true, thinking: true, toolcalls: true },
  toolGroups: { edits: true, bash: true, read: true, search: true, fetch: true, tasks: true, other: true },
  tags: { errors: false, retries: false, revert: false },
  views: { hidden: false, expandAll: false, compact: false },
  checkpoint: 'all',
}

/* two user prompts, so the rail has two task cards; the first assistant turn carries a tool
   call and the session ends on a system turn, so the minimap covers all three tick kinds. */
function payload() {
  return {
    id: 'ledger-chrome',
    harness: 'claude-code',
    startTime: '2026-09-20T10:00:00Z',
    endTime: '2026-09-20T10:05:00Z',
    durationMins: 5,
    totalTokens: 1200,
    tokensIn: 800,
    tokensOut: 400,
    turnCount: 5,
    toolCallCount: 1,
    outcome: 'resolved',
    inputSubmissionCount: 2,
    turns: [
      { index: 0, role: 'user', content: 'prepare the fixture for the check', timestamp: '2026-09-20T10:00:00Z', depth: 0 },
      {
        index: 1,
        role: 'assistant',
        content: 'reading the fixture.',
        timestamp: '2026-09-20T10:01:00Z',
        depth: 0,
        observedModel: 'claude-opus-4-8',
        toolCalls: [{ id: 'tc1', name: 'Read', arguments: '{"file_path":"scripts/testdata/fixture.yaml"}', result: '"ok"', toolKind: 'read' }],
      },
      { index: 2, role: 'user', content: 'run it again and show me the result', timestamp: '2026-09-20T10:03:00Z', depth: 0 },
      { index: 3, role: 'assistant', content: 'the check passed.', timestamp: '2026-09-20T10:04:00Z', depth: 0 },
      { index: 4, role: 'system', content: 'the workspace check completed', timestamp: '2026-09-20T10:05:00Z', depth: 0 },
    ],
  }
}

const report = createReport('transcript ledger chrome')

await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const vm = adaptTranscript(payload())
  const turns = vm.turns
  const tasks = vm.tasks
  if (turns.length !== 5 || tasks.length !== 2) {
    throw new Error(`${FIXTURE}: the fixture payload must cook to 5 turns and 2 tasks, received ${turns.length} and ${tasks.length}`)
  }
  const systemTurn = turns.find((turn) => turn.role === 'system')
  if (!systemTurn) throw new Error(`${FIXTURE}: the fixture payload must carry a system turn`)
  /* the classic sticky header shows the active turn's model, so the cases pin an assistant turn. */
  const PINNED_TURN = turns[3].index

  /** the tick kind the minimap must show for a cooked turn. */
  /* the role decides the tick kind: a tool call never demotes an agent turn to a neutral mark. */
  const kindOf = (turn) => (turn.role === 'user' ? 'user' : turn.role === 'system' ? 'tool' : 'agent')

  /** mount the viewer, then scroll the trace so the pinned header (the ledger chrome) renders. */
  async function pinHeader(mounted) {
    const stream = mounted.container.querySelector('.txn-stream')
    if (!stream) return mounted
    await mounted.act(() => {
      stream.scrollTop = 240
      stream.dispatchEvent(new window.Event('scroll', { bubbles: false }))
    })
    await mounted.settle()
    return mounted
  }

  async function mountViewer(props = {}) {
    const mounted = await mount(React.createElement(TranscriptViewer, { viewModel: vm, capabilities: CAPABILITIES, ...props }))
    return pinHeader(mounted)
  }

  /** mount the viewer with a controlled active turn, so a jump is observable in the DOM. */
  async function mountControlled(startTurn, props = {}) {
    function Controlled() {
      const [activeTurn, setActiveTurn] = React.useState(startTurn)
      return React.createElement(TranscriptViewer, {
        viewModel: vm, capabilities: CAPABILITIES, ...props, activeTurn, onActiveTurnChange: setActiveTurn,
      })
    }
    const mounted = await mount(React.createElement(Controlled))
    return pinHeader(mounted)
  }

  const expectControls = (row, container) => {
    for (const name of row.present) report.check(!!CONTROLS[name](container), `${row.name}: ${name} must be present`)
    for (const name of row.absent) report.check(!CONTROLS[name](container), `${row.name}: ${name} must be absent`)
  }

  const propsOf = (row) => ({
    activeTurn: PINNED_TURN,
    presentation: row.props?.presentation,
    subtitle: row.props?.subtitle ? SUBTITLE : undefined,
    activeTab: row.props?.activeTab,
  })

  const sliderOf = (container) => container.querySelector('.txn-sticky .txn-minimap')
  const nowOf = (container) => sliderOf(container)?.getAttribute('aria-valuenow')

  {
    const mounted = await mountViewer(propsOf(fixture.defaultsCase))
    expectControls(fixture.defaultsCase, mounted.container)
    await mounted.unmount()
  }

  for (const row of fixture.cases) {
    const mounted = await mountViewer(propsOf(row))
    expectControls(row, mounted.container)
    await mounted.unmount()
  }

  for (const row of fixture.interactions) {
    if (row.kind === 'minimap-slider') {
      const mounted = await mountViewer({ presentation: 'ledger', activeTurn: PINNED_TURN })
      const container = mounted.container
      const slider = sliderOf(container)
      report.check(!!slider, `${row.name}: the pinned header must render the minimap`)
      report.check(slider?.getAttribute('role') === 'slider', `${row.name}: the control must carry role=slider`)
      report.check(slider?.getAttribute('aria-label') === 'transcript timeline', `${row.name}: the control must be named "transcript timeline"`)
      report.check(slider?.getAttribute('aria-valuemin') === '0', `${row.name}: aria-valuemin must be 0`)
      report.check(slider?.getAttribute('aria-valuemax') === String(turns.length - 1), `${row.name}: aria-valuemax must be ${turns.length - 1}`)
      report.check(slider?.getAttribute('aria-valuenow') === String(turns.findIndex((turn) => turn.index === PINNED_TURN)), `${row.name}: aria-valuenow must be the active turn's position`)
      report.check(slider?.getAttribute('aria-valuetext') === `turn ${turns[3].label} of ${turns.length}`, `${row.name}: aria-valuetext must state the position and total`)
      report.check(slider?.querySelectorAll('button').length === 0, `${row.name}: the control must hold no per-turn buttons`)
      const track = slider?.querySelector('.txn-minimap-track')
      report.check(track?.getAttribute('aria-hidden') === 'true', `${row.name}: the decorative track must be hidden from assistive tech`)
      report.check(track?.querySelectorAll('.txn-minimap-seg').length === turns.length, `${row.name}: the track must carry one tick per turn`)
      const cursor = slider?.querySelector('.txn-minimap-cursor')
      report.check(cursor?.getAttribute('aria-hidden') === 'true', `${row.name}: the cursor must be decorative`)
      report.check(cursor?.style.left === `${(turns.findIndex((turn) => turn.index === PINNED_TURN) / (turns.length - 1)) * 100}%`, `${row.name}: the cursor must sit at the active turn's position`)
      await mounted.unmount()
    } else if (row.kind === 'minimap-kinds') {
      const mounted = await mountViewer({ presentation: 'ledger' })
      const ticks = [...mounted.container.querySelectorAll('.txn-minimap-seg')]
      turns.forEach((turn, i) => {
        const expected = 'txn-minimap-' + kindOf(turn)
        report.check(ticks[i]?.classList.contains(expected), `${row.name}: tick ${i} must carry ${expected}, received ${JSON.stringify(ticks[i]?.className)}`)
      })
      const systemIndex = turns.findIndex((turn) => turn.role === 'system')
      report.check(ticks[systemIndex]?.classList.contains('txn-minimap-tool'), `${row.name}: the system tick must carry txn-minimap-tool`)
      await mounted.unmount()
    } else if (row.kind === 'minimap-keys') {
      const mounted = await mountControlled(turns[0].index, { presentation: 'ledger' })
      const container = mounted.container
      /* pinning the header scrolls the trace in jsdom, which reports a reading position; the rail
         card for the first task is the production way back to the first turn. */
      await mounted.act(() => click(window, container.querySelector('.txn-rail-turn')))
      report.check(nowOf(container) === '0', `${row.name}: the fixture must start at the first turn, received ${nowOf(container)}`)
      let prevented = false
      await mounted.act(() => { prevented = keydown(window, sliderOf(container), 'ArrowRight') })
      report.check(prevented, `${row.name}: ArrowRight must prevent the page default`)
      report.check(nowOf(container) === '1', `${row.name}: ArrowRight must step to the next turn, received ${nowOf(container)}`)
      await mounted.act(() => keydown(window, sliderOf(container), 'End'))
      report.check(nowOf(container) === String(turns.length - 1), `${row.name}: End must select the last turn, received ${nowOf(container)}`)
      report.check(sliderOf(container)?.querySelector('.txn-minimap-cursor')?.style.left === '100%', `${row.name}: End must move the cursor to the far end`)
      await mounted.act(() => keydown(window, sliderOf(container), 'Home'))
      report.check(nowOf(container) === '0', `${row.name}: Home must select the first turn, received ${nowOf(container)}`)
      await mounted.act(() => keydown(window, sliderOf(container), 'PageDown'))
      report.check(nowOf(container) === String(turns.length - 1), `${row.name}: PageDown must step ten turns and clamp to the last, received ${nowOf(container)}`)
      await mounted.act(() => keydown(window, sliderOf(container), 'PageUp'))
      report.check(nowOf(container) === '0', `${row.name}: PageUp must step ten turns and clamp to the first, received ${nowOf(container)}`)
      await mounted.act(() => keydown(window, sliderOf(container), 'ArrowLeft'))
      report.check(nowOf(container) === '0', `${row.name}: ArrowLeft must clamp at the first turn, received ${nowOf(container)}`)
      await mounted.unmount()
    } else if (row.kind === 'minimap-pointer') {
      const mounted = await mountControlled(turns[0].index, { presentation: 'ledger' })
      const container = mounted.container
      const slider = sliderOf(container)
      await mounted.act(() => click(window, container.querySelector('.txn-rail-turn')))
      slider.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 24, right: 300, bottom: 24, x: 0, y: 0, toJSON() {} })
      const press = (type, clientX) => slider.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY: 12 }))
      await mounted.act(() => { press('pointerdown', 150) })
      report.check(nowOf(container) === '2', `${row.name}: expected the press at the middle of the track to select turn 2, received ${nowOf(container)}`)
      await mounted.act(() => { press('pointermove', 300) })
      report.check(nowOf(container) === String(turns.length - 1), `${row.name}: a drag while captured must keep seeking, received ${nowOf(container)}`)
      await mounted.act(() => { press('pointerup', 300) })
      await mounted.act(() => { press('pointermove', 0) })
      report.check(nowOf(container) === String(turns.length - 1), `${row.name}: a move after release must not seek, received ${nowOf(container)}`)
      await mounted.unmount()
    } else if (row.kind === 'minimap-visible') {
      const mounted = await mountViewer({ presentation: 'ledger', filters: { ...FILTERS, categories: { ...FILTERS.categories, prompts: false } } })
      const container = mounted.container
      const slider = sliderOf(container)
      const visible = container.querySelectorAll('.txn-stream [data-turn]').length
      report.check(visible > 0 && visible < turns.length, `${row.name}: the fixture must render a filtered subset, received ${visible} of ${turns.length}`)
      report.check(slider?.querySelectorAll('.txn-minimap-seg').length === visible, `${row.name}: tick count expected ${visible} visible turns, received ${slider?.querySelectorAll('.txn-minimap-seg').length}`)
      report.check(slider?.getAttribute('aria-valuemax') === String(visible - 1), `${row.name}: aria-valuemax expected ${visible - 1} visible turns, received ${slider?.getAttribute('aria-valuemax')}`)
      await mounted.unmount()
    } else if (row.kind === 'rail-cards') {
      const mounted = await mountViewer({ presentation: 'ledger' })
      const cards = [...mounted.container.querySelectorAll('.txn-rail-left .txn-rail-turn')]
      report.check(cards.length === tasks.length, `${row.name}: expected ${tasks.length} cards, received ${cards.length}`)
      report.check(cards.length === fixture.railCases.length, `${row.name}: the fixture must state one expected card per task`)
      fixture.railCases.forEach((expected, i) => {
        report.check(cards[i]?.querySelector('.txn-rail-turn-top b')?.textContent === expected.turn, `${row.name}: card ${i} must name ${JSON.stringify(expected.turn)}, received ${JSON.stringify(cards[i]?.querySelector('.txn-rail-turn-top b')?.textContent)}`)
        report.check(cards[i]?.querySelector('.txn-rail-turn-top span')?.textContent === expected.duration, `${row.name}: card ${i} must show its duration ${JSON.stringify(expected.duration)}, received ${JSON.stringify(cards[i]?.querySelector('.txn-rail-turn-top span')?.textContent)}`)
        report.check(cards[i]?.querySelector('.txn-rail-turn-copy')?.textContent === expected.prompt, `${row.name}: card ${i} must show its prompt verbatim`)
        report.check(cards[i]?.getAttribute('title') === expected.prompt, `${row.name}: card ${i} must title its prompt`)
      })
      await mounted.unmount()
    } else if (row.kind === 'rail-current') {
      const target = tasks[1]
      const mounted = await mountControlled(target.turnIndices[0], { presentation: 'ledger' })
      const cards = [...mounted.container.querySelectorAll('.txn-rail-left .txn-rail-turn')]
      report.check(cards.filter((card) => card.getAttribute('aria-current') === 'true').length === 1, `${row.name}: exactly one card must be current`)
      report.check(cards[1]?.getAttribute('aria-current') === 'true', `${row.name}: the card covering the active turn must be current`)
      await mounted.unmount()
    } else if (row.kind === 'rail-jump') {
      const target = tasks[1]
      const mounted = await mountControlled(tasks[0].turnIndices[0], { presentation: 'ledger' })
      const cards = [...mounted.container.querySelectorAll('.txn-rail-left .txn-rail-turn')]
      if (cards[1]) await mounted.act(() => click(window, cards[1]))
      await mounted.settle()
      const currentTurn = nowOf(mounted.container) ?? null
      const expectedPosition = turns.findIndex((turn) => turn.index === target.turnIndices[0])
      report.check(currentTurn === String(expectedPosition), `${row.name}: expected turn ${target.turnIndices[0]} to be current, received ${currentTurn}`)
      const currentCard = mounted.container.querySelector('.txn-rail-turn[aria-current="true"]')
      report.check(currentCard === (mounted.container.querySelectorAll('.txn-rail-turn')[1] ?? null), `${row.name}: the clicked card must become current`)
      await mounted.unmount()
    } else if (row.kind === 'rail-follows') {
      /* jsdom lays nothing out, so the rail body gets a 100px view over 80px cards stacked at
         0 and 120 that move with its scrollTop; moving the reader must bring the current card in */
      let setTurn = null
      function Following() {
        const [activeTurn, setActiveTurn] = React.useState(tasks[0].turnIndices[0])
        setTurn = setActiveTurn
        return React.createElement(TranscriptViewer, { viewModel: vm, capabilities: CAPABILITIES, presentation: 'ledger', activeTurn, onActiveTurnChange: setActiveTurn })
      }
      const mounted = await mount(React.createElement(Following))
      const body = mounted.container.querySelector('#txn-rail-left-body')
      const cards = [...mounted.container.querySelectorAll('.txn-rail-left .txn-rail-turn')]
      let scrollTop = 0
      body.style.overflowY = 'auto'
      Object.defineProperty(body, 'scrollTop', { configurable: true, get: () => scrollTop, set: (value) => { scrollTop = value } })
      Object.defineProperty(body, 'scrollHeight', { configurable: true, get: () => 400 })
      Object.defineProperty(body, 'clientHeight', { configurable: true, get: () => 100 })
      body.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 240, width: 240, height: 100 })
      cards.forEach((card, i) => {
        card.getBoundingClientRect = () => ({ top: i * 120 - scrollTop, bottom: i * 120 + 80 - scrollTop, left: 0, right: 240, width: 240, height: 80 })
      })
      await mounted.act(() => setTurn(tasks[1].turnIndices[0]))
      await mounted.settle()
      report.check(scrollTop === 100, `${row.name}: moving to a card below the rail's view must scroll it in, expected scrollTop 100, received ${scrollTop}`)
      await mounted.act(() => setTurn(tasks[0].turnIndices[0]))
      await mounted.settle()
      report.check(scrollTop === 0, `${row.name}: moving back to a card above the view must scroll it in, expected scrollTop 0, received ${scrollTop}`)
      await mounted.unmount()
    } else if (row.kind === 'subtitle-modes') {
      for (const presentation of ['classic', 'ledger']) {
        const mounted = await mountViewer({ presentation, subtitle: SUBTITLE })
        const container = mounted.container
        const subtitle = container.querySelector('.txn-header .txn-sub')
        report.check(subtitle?.textContent === SUBTITLE, `${row.name}: the ${presentation} presentation must render the supplied subtitle`)
        report.check(subtitle?.tagName === 'DIV', `${row.name}: the ${presentation} subtitle must render as a div so a composed deck stays valid HTML`)
        const title = container.querySelector('.txn-header .txn-title')
        const follows = !!title && !!subtitle && (title.compareDocumentPosition(subtitle) & window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        report.check(follows, `${row.name}: the ${presentation} subtitle must follow the session title`)
        await mounted.unmount()
      }
    } else {
      throw new Error(`${FIXTURE}: unknown interaction kind ${JSON.stringify(row.kind)}`)
    }
  }
})

report.finish(`${fixture.cases.length + 1} chrome combinations and ${fixture.interactions.length} interactions.`)
