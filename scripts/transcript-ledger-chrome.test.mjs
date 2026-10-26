#!/usr/bin/env node
/* Mounted-source gate for the transcript viewer's ledger presentation: the `presentation` prop,
   its subtitle slot, the pinned header's title + minimap, and the user-turn task cards in the
   left rail. Every case mounts the REAL viewer (adaptTranscript -> TranscriptViewer) through
   vite, scrolls the trace so the pinned header renders, and asserts which chrome exists. The
   interaction rows then read the minimap's per-turn segments and drive both jump paths.
   Cases: scripts/testdata/transcript-ledger-chrome.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-ledger-chrome;
   mutations: node scripts/parts-mutations.mjs scripts/transcript-ledger-chrome.test.mjs
   scripts/testdata/transcript-ledger-chrome.manifest.yaml */
import { loadFixturePair, assertExactNames, assertFields, withMountedSource, click, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-ledger-chrome.yaml'
const MANIFEST = 'scripts/testdata/transcript-ledger-chrome.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  cases: 'requiredCaseNames',
  interactions: 'requiredInteractionNames',
})
if (fixture.defaultsCase?.name !== manifest.requiredDefaultsCase) throw new Error(`${FIXTURE}: defaultsCase must be named ${JSON.stringify(manifest.requiredDefaultsCase)}`)

/* the closed chrome set: name -> how a reader finds it in the mounted viewer. */
const CONTROLS = {
  'ledger-root': (root) => root.querySelector('.txn-app.txn-ledger'),
  'subtitle': (root) => root.querySelector('.txn-header .txn-sub'),
  'sticky-bar': (root) => root.querySelector('.txn-trace .txn-sticky'),
  'sticky-title': (root) => root.querySelector('.txn-sticky .txn-sticky-title'),
  'minimap': (root) => root.querySelector('.txn-sticky nav.txn-minimap'),
  'scrubber': (root) => root.querySelector('.txn-sticky .txn-scrub'),
  'rail-turns': (root) => root.querySelector('.txn-rail-left .txn-rail-turns'),
  'rail-waterfall': (root) => root.querySelector('.txn-rail-left .txn-ol-waterfall'),
  'rail-outline': (root) => root.querySelector('.txn-rail-left .txn-ol-row'),
}
const CONTROL_NAMES = Object.keys(CONTROLS)
for (const row of [fixture.defaultsCase, ...fixture.cases]) {
  assertFields(row, ['name', 'present', 'absent'], `${FIXTURE} ${row.name}`, ['props'])
  assertExactNames([...row.present, ...row.absent], CONTROL_NAMES, `${FIXTURE} ${row.name} controls`)
}

const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: true, canChangeVisibility: false, canExport: true }
const SUBTITLE = 'a public transcript from fairtrade, read as a ledger.'

/* two user prompts, so the rail has two task cards; the first assistant turn carries a tool
   call, so the minimap covers all three segment kinds. */
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
    turnCount: 4,
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
        toolCalls: [{ id: 'tc1', name: 'Read', arguments: '{"file_path":"scripts/testdata/fixture.yaml"}', result: '"ok"', toolKind: 'read' }],
      },
      { index: 2, role: 'user', content: 'run it again and show me the result', timestamp: '2026-09-20T10:03:00Z', depth: 0 },
      { index: 3, role: 'assistant', content: 'the check passed.', timestamp: '2026-09-20T10:04:00Z', depth: 0 },
    ],
  }
}

const report = createReport('transcript ledger chrome')

await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const { formatDuration } = await load('/src/ui/StepsWaterfall.jsx')
  const vm = adaptTranscript(payload())
  const turns = vm.turns
  const tasks = vm.tasks
  if (turns.length !== 4 || tasks.length !== 2) {
    throw new Error(`${FIXTURE}: the fixture payload must cook to 4 turns and 2 tasks, received ${turns.length} and ${tasks.length}`)
  }

  /** the segment kind the minimap must show for a cooked turn. */
  const kindOf = (turn) => (turn.role === 'user' ? 'user' : turn.role === 'system' || (turn.toolCalls?.length ?? 0) > 0 ? 'tool' : 'agent')

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
    presentation: row.props?.presentation,
    subtitle: row.props?.subtitle ? SUBTITLE : undefined,
    activeTab: row.props?.activeTab,
  })

  {
    const mounted = await mountViewer()
    expectControls(fixture.defaultsCase, mounted.container)
    await mounted.unmount()
  }

  for (const row of fixture.cases) {
    const mounted = await mountViewer(propsOf(row))
    expectControls(row, mounted.container)
    await mounted.unmount()
  }

  for (const row of fixture.interactions) {
    if (row.kind === 'minimap-segments') {
      const mounted = await mountViewer({ presentation: 'ledger' })
      const segments = [...mounted.container.querySelectorAll('.txn-minimap-seg')]
      report.check(segments.length === turns.length, `${row.name}: expected ${turns.length} segments, received ${segments.length}`)
      report.check(segments.map((segment) => segment.getAttribute('data-jump')).join(',') === turns.map((turn) => String(turn.index)).join(','), `${row.name}: the segments must be in turn order`)
      report.check(segments.filter((segment) => segment.getAttribute('aria-current') === 'true').length === 1, `${row.name}: exactly one segment must be current`)
      await mounted.unmount()
    } else if (row.kind === 'minimap-kinds') {
      const mounted = await mountViewer({ presentation: 'ledger' })
      const segments = [...mounted.container.querySelectorAll('.txn-minimap-seg')]
      turns.forEach((turn, i) => {
        const expected = 'txn-minimap-' + kindOf(turn)
        report.check(segments[i]?.classList.contains(expected), `${row.name}: segment ${i} must carry ${expected}`)
      })
      await mounted.unmount()
    } else if (row.kind === 'minimap-labels') {
      const mounted = await mountViewer({ presentation: 'ledger' })
      const segments = [...mounted.container.querySelectorAll('.txn-minimap-seg')]
      turns.forEach((turn, i) => {
        const expected = `jump to ${turn.role} turn ${turn.label}`
        report.check(segments[i]?.getAttribute('aria-label') === expected, `${row.name}: segment ${i} must be named ${JSON.stringify(expected)}, received ${JSON.stringify(segments[i]?.getAttribute('aria-label'))}`)
      })
      await mounted.unmount()
    } else if (row.kind === 'minimap-jump') {
      const mounted = await mountControlled(turns[0].index, { presentation: 'ledger' })
      const target = turns[2]
      const segment = mounted.container.querySelector(`.txn-minimap-seg[data-jump="${target.index}"]`)
      if (segment) await mounted.act(() => click(window, segment))
      await mounted.settle()
      const current = mounted.container.querySelector('.txn-minimap-seg[aria-current="true"]')
      report.check(current?.getAttribute('data-jump') === String(target.index), `${row.name}: expected the segment for turn ${target.index} to be current`)
      await mounted.unmount()
    } else if (row.kind === 'rail-cards') {
      const mounted = await mountViewer({ presentation: 'ledger' })
      const cards = [...mounted.container.querySelectorAll('.txn-rail-left .txn-rail-turn')]
      report.check(cards.length === tasks.length, `${row.name}: expected ${tasks.length} cards, received ${cards.length}`)
      tasks.forEach((task, i) => {
        const first = task.turnIndices[0]
        const expectedTurn = '#' + (turns.find((turn) => turn.index === first)?.label ?? first)
        report.check(cards[i]?.querySelector('.txn-rail-turn-top b')?.textContent === expectedTurn, `${row.name}: card ${i} must name ${JSON.stringify(expectedTurn)}`)
        report.check(cards[i]?.querySelector('.txn-rail-turn-top span')?.textContent === formatDuration(task.durationMs), `${row.name}: card ${i} must show its duration`)
        report.check(cards[i]?.querySelector('.txn-rail-turn-copy')?.textContent === task.prompt, `${row.name}: card ${i} must show its prompt verbatim`)
        report.check(cards[i]?.getAttribute('title') === task.prompt, `${row.name}: card ${i} must title its prompt`)
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
      const currentTurn = mounted.container.querySelector('.txn-minimap-seg[aria-current="true"]')?.getAttribute('data-jump')
      report.check(currentTurn === String(target.turnIndices[0]), `${row.name}: expected turn ${target.turnIndices[0]} to be current, received ${currentTurn}`)
      const currentCard = mounted.container.querySelector('.txn-rail-turn[aria-current="true"]')
      report.check(currentCard === (mounted.container.querySelectorAll('.txn-rail-turn')[1] ?? null), `${row.name}: the clicked card must become current`)
      await mounted.unmount()
    } else if (row.kind === 'subtitle-modes') {
      for (const presentation of ['classic', 'ledger']) {
        const mounted = await mountViewer({ presentation, subtitle: SUBTITLE })
        const subtitle = mounted.container.querySelector('.txn-header .txn-sub')
        report.check(subtitle?.textContent === SUBTITLE, `${row.name}: the ${presentation} presentation must render the supplied subtitle`)
        await mounted.unmount()
      }
    } else {
      throw new Error(`${FIXTURE}: unknown interaction kind ${JSON.stringify(row.kind)}`)
    }
  }
})

report.finish(`${fixture.cases.length + 1} chrome combinations and ${fixture.interactions.length} interactions.`)
