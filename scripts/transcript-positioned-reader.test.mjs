#!/usr/bin/env node
/* Gate for the positioned (v2) reader: served numbering in segment mode, the reader controller,
   the usage accumulator, history sections and integrity pairs.

   Five fixture families, each a strict YAML file with its required-NAME manifest:
     scripts/testdata/transcript-positioned-numbering.yaml
     scripts/testdata/transcript-positioned-reader.yaml   (also carries the production mutations)
     scripts/testdata/transcript-usage-accumulator.yaml
     scripts/testdata/transcript-history-partitions.yaml
     scripts/testdata/transcript-integrity-pairs.yaml
   The positioned segment geometry family extends scripts/transcript-segments.test.mjs.

   Production source loads through vite's ssrLoadModule, so scripts/parts-mutations.mjs can
   rewrite it before it loads. Two read-only call counters are placed on the production functions
   the reader must never call for a positioned read: the whole-document cook (prefilterTurns,
   computeTurnLabels) and the whole-document adapter. The controller runs over a recording
   transport whose every body passes Schema's z* parsers. Nothing here measures time, heap or RSS.

   Run: pnpm test:transcript-positioned-reader
   Mutations: pnpm test:transcript-positioned-reader:mutations */
import {
  TranscriptSegmentPartitionKind,
  TranscriptUsagePresence,
  UsageCompleteness,
  zPositionedDirectory,
  zPositionedSegment,
  zPositionedWindow,
  zTranscriptContentHeader,
} from '@peasant-labs/schema'
import { assertExactNames, loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'

const NUMBERING = 'scripts/testdata/transcript-positioned-numbering.yaml'
const NUMBERING_MANIFEST = 'scripts/testdata/transcript-positioned-numbering.manifest.yaml'
const READER = 'scripts/testdata/transcript-positioned-reader.yaml'
const READER_MANIFEST = 'scripts/testdata/transcript-positioned-reader.manifest.yaml'
const USAGE = 'scripts/testdata/transcript-usage-accumulator.yaml'
const USAGE_MANIFEST = 'scripts/testdata/transcript-usage-accumulator.manifest.yaml'
const HISTORY = 'scripts/testdata/transcript-history-partitions.yaml'
const HISTORY_MANIFEST = 'scripts/testdata/transcript-history-partitions.manifest.yaml'
const INTEGRITY = 'scripts/testdata/transcript-integrity-pairs.yaml'
const INTEGRITY_MANIFEST = 'scripts/testdata/transcript-integrity-pairs.manifest.yaml'
const numberingPair = loadFixturePair(NUMBERING, NUMBERING_MANIFEST, { cases: 'requiredCaseNames' })
/** The cases the manifest allows to be skipped; the runner's pending set must equal it. */
const PENDING_CASE_NAMES = new Set(numberingPair.manifest.pendingCaseNames ?? [])
const families = {
  numbering: numberingPair.fixture,
  reader: loadFixturePair(READER, READER_MANIFEST, { cases: 'requiredCaseNames' }).fixture,
  usage: loadFixturePair(USAGE, USAGE_MANIFEST, { cases: 'requiredCaseNames' }).fixture,
  history: loadFixturePair(HISTORY, HISTORY_MANIFEST, { cases: 'requiredCaseNames' }).fixture,
  integrity: loadFixturePair(INTEGRITY, INTEGRITY_MANIFEST, { cases: 'requiredCaseNames' }).fixture,
}
assertExactNames(
  families.reader.cases.find((row) => row.name === 'controller-status-kind-table').rows.map((row) => row.name),
  loadFixturePair(READER, READER_MANIFEST, { cases: 'requiredCaseNames' }).manifest.requiredStatusNames,
  `${READER} status rows`,
)
/** The transport's request names, as the recording transport logs them. */
const Operation = Object.freeze({ Header: 'header', Directory: 'directory', Window: 'window', Segment: 'segment', Locate: 'locate' })
const report = createReport('transcript positioned reader')
const caseOf = (family, name) => {
  const row = families[family].cases.find((item) => item.name === name)
  if (!row) throw new Error(`${family}: the fixture has no case ${name}`)
  return row
}
let ran = 0
let pending = 0
const skipped = new Set()
/** Run one named case; every check message starts with the case name, so a mutation's killer is named. */
async function run(family, name, body) {
  const row = caseOf(family, name)
  if (row.pending === true) {
    pending += 1
    skipped.add(name)
    console.log(`pending: ${name} (${row.note})`)
    return
  }
  ran += 1
  try {
    await body(row, (passed, message) => report.check(passed, `${name}: ${message}`))
  } catch (error) {
    report.check(false, `${name}: threw ${error?.stack ?? error}`)
  }
}

/* read-only counters on the production functions a positioned read must not call */
const spy = { prefilter: 0, labels: 0, wholeDocument: 0, sectionOpens: 0, sectionCloses: 0 }
globalThis.__fairtradePositionedSpy = spy
const COUNTERS = [
  { file: 'src/ui/transcript/analytics.js', find: 'export function computeTurnLabels(turns) {', add: 'globalThis.__fairtradePositionedSpy && (globalThis.__fairtradePositionedSpy.labels += 1)' },
  { file: 'src/ui/transcript/adapter.js', find: 'export function prefilterTurns(turns) {', add: 'globalThis.__fairtradePositionedSpy && (globalThis.__fairtradePositionedSpy.prefilter += 1)' },
  { file: 'src/ui/transcript/adapter.js', find: "  const payloadMode = options?.payloadMode ?? 'local'\n", add: "if (payloadMode !== PayloadMode.Segment && globalThis.__fairtradePositionedSpy) globalThis.__fairtradePositionedSpy.wholeDocument += 1" },
  { file: 'src/ui/transcript/positioned-read.js', find: '  async function openSection(section) {', add: 'globalThis.__fairtradePositionedSpy && (globalThis.__fairtradePositionedSpy.sectionOpens += 1)' },
  { file: 'src/ui/transcript/positioned-read.js', find: '  function closeSection(section) {', add: 'globalThis.__fairtradePositionedSpy && (globalThis.__fairtradePositionedSpy.sectionCloses += 1)' },
]
const counterPlugin = {
  name: 'fairtrade-positioned-call-counters',
  enforce: 'pre',
  transform(code, id) {
    const path = id.split('?')[0]
    let next = code
    for (const counter of COUNTERS) {
      if (!path.endsWith(`/${counter.file}`)) continue
      if (next.split(counter.find).length !== 2) throw new Error(`call counter anchor not found exactly once in ${counter.file}: ${counter.find}`)
      next = next.replace(counter.find, `${counter.find}\n${counter.add}\n`)
    }
    return next === code ? null : { code: next, map: null }
  },
}
const resetSpy = () => { spy.prefilter = 0; spy.labels = 0; spy.wholeDocument = 0; spy.sectionOpens = 0; spy.sectionCloses = 0 }
const settle = async (rounds = 20) => { for (let i = 0; i < rounds; i += 1) await new Promise((done) => setTimeout(done, 0)) }

/* ── the synthetic positioned document ─────────────────────────────────────────── */

const DOC = families.reader.document
const context = (totals, transport = DOC.transport) => ({
  protocolVersion: '0.2.0', representation: 'r1', revision: '3', harness: 'claude-code', model: 'claude-opus-4-5',
  nativePresence: 'absent', validation: 'published_strict', transport, ...totals,
})
const parse = (parser, body, name) => {
  const parsed = parser.safeParse(body)
  if (!parsed.success) throw new Error(`the test document's ${name} body is not one Schema's parser accepts: ${parsed.error.message}`)
  return parsed.data
}

/** One partition: `segments` tasks of `rowsPerSegment` rows each, numbered as the server's cook would. */
function partitionOf({ segments, rowsPerSegment, partition, offset, usage, transcript = DOC.transport }) {
  const rows = []
  for (let segment = 0; segment < segments; segment += 1) {
    for (let row = 0; row < rowsPerSegment; row += 1) {
      const position = segment * rowsPerSegment + row
      const turn = { index: position + offset, role: row === 0 ? 'user' : 'assistant', depth: 0, entryType: 'text', content: row === 0 ? `request ${segment + 1}` : `reply ${segment + 1}.${row}`, timestamp: '2026-11-12T09:00:00Z' }
      if (usage && row > 0) turn.usage = { scope: 'assistant', ownerId: `owner-${position}`, sourceEntryRef: `entry-${position}`, completeness: 'complete', tokens: { input: 10, output: 2 } }
      rows.push({ position, recordedIndex: position + offset, recordedIndexState: 'present', displayNumber: row === 0 ? String(segment + 1) : `${segment + 1}${String.fromCharCode(96 + row)}`, turn })
    }
  }
  const totals = { totalTurns: rows.length, totalSegments: segments, totalConversationTurns: rows.length }
  const bodies = Array.from({ length: segments }, (_, index) => ({
    index, partition, rows: rows.slice(index * rowsPerSegment, (index + 1) * rowsPerSegment), byteLength: 100, hasOlder: index > 0, hasNewer: index < segments - 1, context: context(totals, transcript),
  }))
  const refs = bodies.map((body) => ({ index: body.index, byteLength: 100, sourceFirstPosition: body.rows[0].position, sourceLastPosition: body.rows.at(-1).position, conversationTurns: { before: body.rows[0].position, count: body.rows.length } }))
  return { rows, totals, bodies, refs, partition }
}

/**
 * The recording transport. `respond(operation, request)` may return a host response, a promise, or
 * undefined for the document's own answer. Every call is logged with its request and signal.
 */
function documentTransport({ respond, perPage, usagePresent = 'empty', history, transcript = DOC.transport } = {}) {
  const main = partitionOf({ segments: DOC.segments, rowsPerSegment: DOC.rowsPerSegment, partition: { kind: 'main' }, offset: DOC.recordedOffset, usage: usagePresent === TranscriptUsagePresence.Present, transcript })
  const section = history ? partitionOf({ segments: 1, rowsPerSegment: history.rows, partition: { kind: 'history', sectionIndex: history.index }, offset: 0, transcript }) : null
  const log = []
  const ok = (body) => Promise.resolve({ status: 200, body })
  const answer = (operation, request) => {
    const isHistory = request?.partition?.kind === TranscriptSegmentPartitionKind.History
    const part = isHistory ? section : main
    if (operation === Operation.Header) return ok(parse(zTranscriptContentHeader, { contractVersion: '0.58.1', kind: 'session_detail', revision: '3', representation: 'r1', canonical: true, omittedImages: 0, sessionHeader: { id: 'positioned-test', harness: 'claude-code' } }, 'header'))
    if (operation === Operation.Directory) {
      const page = request.page ?? 1
      const refs = perPage ? part.refs.slice((page - 1) * perPage, page * perPage) : part.refs
      return ok(parse(zPositionedDirectory, {
        context: part.bodies[0].context, partition: part.partition, segments: refs, usagePresent: isHistory ? 'unknown' : usagePresent,
        ...(perPage ? { directoryPage: page, directoryPerPage: perPage } : {}),
        ...(!isHistory && history ? { history: [{ index: history.index, state: history.state, totalTurns: history.rows, totalConversationTurns: history.recordedConversationTurns, usagePresent: 'unknown' }] } : {}),
      }, 'directory'))
    }
    if (operation === Operation.Window) {
      const turn = request.turn
      const requested = turn === undefined ? undefined : part.rows.find((row) => row.recordedIndex === turn)
      const nearest = turn === undefined ? part.rows[0] : requested ?? part.rows.find((row) => row.recordedIndex > turn) ?? part.rows.at(-1)
      const anchorSegment = Math.floor(nearest.position / DOC.rowsPerSegment)
      const anchorRow = part.bodies[anchorSegment].rows[0]
      const run = turn === undefined ? [anchorSegment] : [...new Set([anchorSegment, Math.min(anchorSegment + 1, part.bodies.length - 1)])]
      return ok(parse(zPositionedWindow, {
        context: part.bodies[0].context, partition: part.partition, anchorPosition: anchorRow.position, anchorSegment, anchorTurn: anchorRow.recordedIndex,
        ...(turn === undefined ? {} : { requestedAnchor: turn, ...(requested ? { requestedPosition: requested.position } : {}) }),
        firstPosition: part.bodies[run[0]].rows[0].position, lastPosition: part.bodies[run.at(-1)].rows.at(-1).position, segments: run, span: 10,
        hasOlder: run[0] > 0, hasNewer: run.at(-1) < part.bodies.length - 1,
      }, 'window'))
    }
    if (operation === Operation.Segment) return ok(parse(zPositionedSegment, part.bodies[request.index], 'segment'))
    return Promise.resolve({ status: 404, body: null })
  }
  const call = (operation) => (request, signal) => {
    log.push({ operation, request, signal })
    const custom = respond?.(operation, request, signal)
    return custom === undefined ? answer(operation, request) : Promise.resolve(custom)
  }
  const transport = Object.fromEntries(Object.values(Operation).map((operation) => [operation, call(operation)]))
  return { transport, log, main, section }
}
const historyRequests = (log) => log.filter((entry) => entry.request?.partition?.kind === TranscriptSegmentPartitionKind.History)
const segmentRequests = (log) => log.filter((entry) => entry.operation === Operation.Segment && entry.request.partition.kind === TranscriptSegmentPartitionKind.Main).map((entry) => entry.request.index)
const residentOf = (reader) => [...reader.getSnapshot().segments.keys()].sort((a, b) => a - b)

await withMountedSource(async ({ load, mount, window, React }) => {
  const reader = await load('/src/ui/transcript/positioned-read.js')
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { createUsageAccumulator, aggregateUsage } = await load('/src/ui/transcript/usage.js')
  const { positionedIntegrity, integrityView } = await load('/src/ui/transcript/integrity.js')
  const { default: TurnCard } = await load('/src/ui/transcript/TurnCard.jsx')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const { buildPositionedDemo } = await load('/src/mockups/inuse/positioned-fixture.js')
  const { historySectionId, parseHistorySectionId } = await load('/src/ui/transcript/history-section-id.js')
  const { createPositionedReader, usePositionedTranscript, PositionedLanding, PositionedReadFailureKind, PositionedReadStatus } = reader
  const start = async (options) => {
    const instance = createPositionedReader({ landing: PositionedLanding.Exact, ...options })
    await instance.start()
    await settle()
    return instance
  }

  /* ── numbering ───────────────────────────────────────────────────────────────── */
  const N = families.numbering
  const servedSegment = (source, partition) => {
    const body = {
      index: source.index,
      partition,
      byteLength: 100, hasOlder: true, hasNewer: true,
      context: context({ totalTurns: 100, totalSegments: 20 }),
      rows: source.rows.map((row) => ({
        position: row.position, recordedIndex: row.recordedIndex, recordedIndexState: 'present',
        ...(row.displayNumber === undefined ? {} : { displayNumber: row.displayNumber }),
        turn: { index: row.recordedIndex, role: row.role, depth: 0, entryType: 'text', content: row.content, timestamp: '2026-11-12T09:00:00Z' },
      })),
    }
    return parse(zPositionedSegment, body, 'numbering segment')
  }
  const mainSegment = servedSegment(N.segment, { kind: 'main' })
  const cookSegment = (segment) => adaptTranscript(segment, undefined, undefined, { payloadMode: 'segment', context: segment.context })

  await run('numbering', 'number-segment-prints-served-value', async (_, check) => {
    const { turns } = cookSegment(mainSegment)
    for (const row of N.segment.rows.filter((item) => item.displayNumber !== undefined)) {
      const turn = turns.find((item) => item.position === row.position)
      check(turn?.label === row.displayNumber, `position ${row.position} prints ${JSON.stringify(row.displayNumber)}, received ${JSON.stringify(turn?.label)}`)
    }
  })
  await run('numbering', 'number-segment-never-cooks', async (_, check) => {
    resetSpy()
    cookSegment(mainSegment)
    check(spy.prefilter === 0 && spy.labels === 0, `segment mode called prefilterTurns ${spy.prefilter} and computeTurnLabels ${spy.labels} times`)
    resetSpy()
    adaptTranscript({ id: 'whole', harness: 'claude-code', turns: N.wholeDocument.turns.map((turn) => ({ ...turn, depth: 0, entryType: 'text' })) })
    check(spy.labels > 0, 'the call counter observes the whole-document cook, so a zero above is real')
  })
  await run('numbering', 'number-segment-renders-exactly-served-rows', async (_, check) => {
    const { turns } = cookSegment(mainSegment)
    check(JSON.stringify(turns.map((turn) => turn.position)) === JSON.stringify(N.segment.rows.map((row) => row.position)), `the rows are the served rows in served order, received ${JSON.stringify(turns.map((turn) => turn.position))}`)
    check(turns.every((turn) => turn.index === turn.position && turn.segmentIndex === N.segment.index), 'each row is keyed by its position and carries its segment')
  })
  await run('numbering', 'number-absent-on-v2-row-shows-no-number', async (_, check) => {
    const { turns } = cookSegment(mainSegment)
    const absent = turns.find((turn) => turn.position === N.segment.rows.find((row) => row.displayNumber === undefined).position)
    check(absent?.label === '' && absent?.numberAbsent === true, `a row without a served number prints none, received label ${JSON.stringify(absent?.label)}`)
    const card = await mount(React.createElement(TurnCard, { turn: absent }))
    const heading = card.container.querySelector('.txn-turn-heading')?.textContent ?? ''
    check(heading.endsWith('turn, number not served') && card.container.querySelector('.txn-turnnum') === null, `the card draws no number and names its absence, received ${JSON.stringify(heading)}`)
    await card.unmount()
  })
  await run('numbering', 'number-malformed-value-discarded', async (_, check) => {
    const { transport } = documentTransport({
      respond: (operation, request) => {
        if (operation !== Operation.Segment || request.index !== 0) return undefined
        const body = partitionOf({ segments: DOC.segments, rowsPerSegment: DOC.rowsPerSegment, partition: { kind: 'main' }, offset: DOC.recordedOffset }).bodies[0]
        return { status: 200, body: { ...body, rows: body.rows.map((row, index) => (index === 0 ? { ...row, displayNumber: N.malformedNumber } : row)) } }
      },
    })
    const instance = await start({ transport, target: { transport: DOC.transport } })
    const snapshot = instance.getSnapshot()
    check(snapshot.failure?.kind === PositionedReadFailureKind.Malformed && !snapshot.segments.has(0), `a number outside the served pattern discards the response, received ${JSON.stringify(snapshot.failure)}`)
    instance.dispose()
  })
  await run('numbering', 'number-whole-document-render-computes', async (_, check) => {
    const vm = adaptTranscript({ id: 'whole', harness: 'claude-code', turns: N.wholeDocument.turns.map((turn) => ({ ...turn, depth: 0, entryType: 'text' })) })
    check(JSON.stringify(vm.turns.map((turn) => turn.label)) === JSON.stringify(N.wholeDocument.labels), `the whole-document render computes its numbers, received ${JSON.stringify(vm.turns.map((turn) => turn.label))}`)
  })
  await run('numbering', 'number-accessible-name-includes-served-value', async (_, check) => {
    const { turns } = cookSegment(mainSegment)
    const turn = turns.find((item) => item.label === '7a')
    const card = await mount(React.createElement(TurnCard, { turn }))
    const heading = card.container.querySelector('.txn-turn-heading')?.textContent ?? ''
    const link = card.container.querySelector('.txn-anchor')?.getAttribute('aria-label') ?? ''
    check(heading.includes('turn 7a') && link.includes('7a'), `the heading and the copy link name the served number, received ${JSON.stringify([heading, link])}`)
    await card.unmount()
  })
  await run('numbering', 'number-copy-link-unaffected', async (_, check) => {
    const { turns } = cookSegment(mainSegment)
    const turn = turns.find((item) => item.label === '7a')
    const copied = []
    const card = await mount(React.createElement(TurnCard, { turn, onCopyAnchor: (index) => copied.push(index) }))
    click(window, card.container.querySelector('.txn-anchor'))
    check(copied[0] === N.segment.rows.find((row) => row.displayNumber === '7a').recordedIndex, `the copy link carries the recorded index, received ${JSON.stringify(copied)}`)
    await card.unmount()
    const unaddressed = { ...turn, recordedIndex: undefined }
    const bare = await mount(React.createElement(TurnCard, { turn: unaddressed }))
    check(bare.container.querySelector('.txn-anchor') === null, 'a row with no recorded index offers no copy link')
    await bare.unmount()
  })
  await run('numbering', 'number-saved-label-keys-recorded-index', async (_, check) => {
    const { turns } = cookSegment(mainSegment)
    const turn = turns.find((item) => item.label === '7a')
    const recorded = N.segment.rows.find((row) => row.displayNumber === '7a').recordedIndex
    const labelled = []
    const card = await mount(React.createElement(TurnCard, { turn, onLabel: (index) => labelled.push(index) }))
    click(window, card.container.querySelector('.txn-labelbtn'))
    check(labelled[0] === recorded && recorded !== turn.position, `the label names the recorded index ${recorded}, not the position ${turn.position}, received ${JSON.stringify(labelled)}`)
    await card.unmount()
    const bare = await mount(React.createElement(TurnCard, { turn: { ...turn, recordedIndex: undefined }, onLabel: () => {} }))
    check(bare.container.querySelector('.txn-labelbtn') === null, 'a row with no recorded index offers no label')
    await bare.unmount()
    const ref = { index: N.segment.index, byteLength: 100, sourceFirstPosition: turns[0].position, sourceLastPosition: turns.at(-1).position }
    const viewer = (savedLabels) => React.createElement(TranscriptViewer, {
      viewModel: { session: { id: 'labels', harness: 'claude-code' }, turns: [], tasks: [], relationships: [], earlierHistory: [] },
      capabilities: {}, presentation: 'classic', directory: { complete: true, totalSegments: 1, totalTurns: turns.length, segments: [ref] }, segments: [{ ...ref, turns }], savedLabels,
    })
    const chips = (container) => [...container.querySelectorAll('[title^="saved label"]')].map((node) => node.closest('[data-turn]')?.getAttribute('data-turn') ?? node.textContent)
    const byRecorded = await mount(viewer({ [recorded]: { outcome: 'good' } }))
    const byPosition = await mount(viewer({ [turn.position]: { outcome: 'good' } }))
    check(chips(byRecorded.container).length === 1 && chips(byPosition.container).length === 0, `the viewer shows a label saved under the recorded index and none saved under the position, received ${JSON.stringify([chips(byRecorded.container), chips(byPosition.container)])}`)
    await byRecorded.unmount()
    await byPosition.unmount()
  })
  await run('numbering', 'number-search-and-filter-unaffected', async (_, check) => {
    const { turns } = cookSegment(mainSegment)
    const ref = { index: N.segment.index, byteLength: 100, sourceFirstPosition: turns[0].position, sourceLastPosition: turns.at(-1).position }
    const props = (filters) => ({
      viewModel: { session: { id: 'filter', harness: 'claude-code' }, turns: [], tasks: [], relationships: [], earlierHistory: [] },
      capabilities: {}, directory: { complete: true, totalSegments: 1, totalTurns: turns.length, segments: [ref] }, segments: [{ ...ref, turns }],
      ...(filters ? { filters } : {}),
    })
    const headings = (container) => [...container.querySelectorAll('.txn-turn-heading')].map((node) => node.textContent)
    const view = await mount(React.createElement(TranscriptViewer, props()))
    const before = headings(view.container)
    await view.rerender(React.createElement(TranscriptViewer, props({ categories: { prompts: true, responses: false, thinking: true, toolcalls: true, system: false }, toolGroups: {}, tags: { errors: false, retries: false, revert: false }, views: { hidden: true, expandAll: false, compact: false }, checkpoint: 'all' })))
    const after = headings(view.container)
    check(before.includes('user turn 7') && before.includes('user turn 8'), `the user rows print their served numbers, received ${JSON.stringify(before)}`)
    check(after.length < before.length && after.every((heading) => before.includes(heading)) && after.includes('user turn 8'), `a filter hides rows and renumbers none, received ${JSON.stringify(after)}`)
    await view.unmount()
  })
  await run('numbering', 'number-history-section-prints-own-numbering', async (_, check) => {
    const history = servedSegment(N.historySegment, { kind: 'history', sectionIndex: N.historySegment.sectionIndex })
    const { turns } = cookSegment(history)
    check(JSON.stringify(turns.map((turn) => turn.label)) === JSON.stringify(N.historySegment.rows.map((row) => row.displayNumber)) && turns.every((turn) => turn.partition === `earlier-${N.historySegment.sectionIndex}`), `a history row prints its own served number in its own partition, received ${JSON.stringify(turns.map((turn) => [turn.partition, turn.label]))}`)
  })
  await run('numbering', 'segment-mode-refuses-analytics', async (_, check) => {
    let thrown = null
    try { adaptTranscript(mainSegment, undefined, {}, { payloadMode: 'segment', context: mainSegment.context }) } catch (error) { thrown = error }
    check(thrown instanceof TypeError && thrown.message.includes('analytics'), `precomputed analytics are refused with an actionable TypeError, received ${thrown?.message}`)
  })
  const wirePayload = (id, turns) => ({
    id,
    harness: N.wireSegment.harness,
    startTime: '2026-11-12T08:59:00Z',
    endTime: '2026-11-12T09:05:00Z',
    durationMins: 6,
    totalTokens: 100,
    tokensIn: 60,
    tokensOut: 40,
    turnCount: turns.length,
    toolCallCount: turns.reduce((n, turn) => n + (turn.toolCalls?.length ?? 0), 0),
    turns,
  })
  await run('numbering', 'wire-mid-session-keeps-display-number', async (_, check) => {
    resetSpy()
    const vm = adaptTranscript(wirePayload('wire-mid', N.wireSegment.midSession))
    const got = vm.turns.map((turn) => turn.label)
    check(JSON.stringify(got) === JSON.stringify(N.wireSegment.expectedLabels) && spy.labels === 0, `mid-session wire turns keep displayNumber without calling computeTurnLabels, received ${JSON.stringify(got)}, labels calls ${spy.labels}`)
  })
  await run('numbering', 'wire-absent-display-number-computes', async (_, check) => {
    resetSpy()
    const stripped = N.wireSegment.midSession.map(({ displayNumber: _drop, ...turn }) => turn)
    const vm = adaptTranscript(wirePayload('wire-absent', stripped))
    const got = vm.turns.map((turn) => turn.label)
    check(JSON.stringify(got) === JSON.stringify(N.wireSegment.expectedFallbackLabels) && spy.labels > 0, `turns without displayNumber fall back to computeTurnLabels, received ${JSON.stringify(got)}, labels calls ${spy.labels}`)
  })
  await run('numbering', 'wire-partial-or-malformed-display-number-refused', async (_, check) => {
    const partialTurns = N.wireSegment.midSession.map((turn, idx) => (idx === 1 ? (({ displayNumber: _drop, ...rest }) => rest)(turn) : turn))
    let partialErr = null
    try { adaptTranscript(wirePayload('wire-partial', partialTurns)) } catch (error) { partialErr = error }
    let malformedOk = true
    for (const bad of N.wireSegment.invalidDisplayNumbers) {
      const badTurns = N.wireSegment.midSession.map((turn, idx) => (idx === 0 ? { ...turn, displayNumber: bad } : turn))
      let err = null
      try { adaptTranscript(wirePayload('wire-bad', badTurns)) } catch (error) { err = error }
      if (!(err instanceof TypeError)) malformedOk = false
    }
    check(partialErr instanceof TypeError && malformedOk, `partial and malformed wire displayNumbers fail closed with TypeError`)
  })
  await run('numbering', 'wire-two-segments-either-order-keep-labels', async (_, check) => {
    const { turnsFromSegments, loadedRegions } = await load('/src/ui/transcript/segments.js')
    const vm0 = adaptTranscript(wirePayload('wire-two', N.wireSegment.previousSegment))
    const vm1 = adaptTranscript(wirePayload('wire-two', N.wireSegment.midSession))
    const seg0 = { index: 0, firstTurn: 15, lastTurn: 15, byteLength: 50, turns: vm0.turns }
    const seg1 = { index: 1, firstTurn: 17, lastTurn: 19, byteLength: 100, turns: vm1.turns }
    const dir = { sessionId: 'wire-two', revision: '1', totalSegments: 2, totalTurns: 4, segments: [{ index: 0, firstTurn: 15, lastTurn: 15, byteLength: 50 }, { index: 1, firstTurn: 17, lastTurn: 19, byteLength: 100 }] }
    const forward = turnsFromSegments([seg0, seg1]).map((t) => t.label)
    const reverse = turnsFromSegments([seg1, seg0]).map((t) => t.label)
    const merged = loadedRegions(dir, [seg1, seg0])[0]?.turns.map((t) => t.label)
    const expected = ['9', ...N.wireSegment.expectedLabels]
    check(JSON.stringify(forward) === JSON.stringify(expected) && JSON.stringify(reverse) === JSON.stringify(expected) && JSON.stringify(merged) === JSON.stringify(expected), `segment merges preserve wire labels regardless of load order, received ${JSON.stringify([forward, reverse, merged])}`)
  })
  await run('numbering', 'wire-numbered-mounted-surfaces-agree', async (_, check) => {
    const { Presentation } = await load('/src/ui/transcript/state-capabilities.js')
    const vm = adaptTranscript(wirePayload('wire-mounted', N.wireSegment.midSession))
    let allPassed = true
    for (const theme of ['dark', 'light']) {
      for (const presentation of [Presentation.Ledger, Presentation.Classic]) {
        const view = await mount(React.createElement(TranscriptViewer, { viewModel: vm, capabilities: {}, theme, presentation }))
        const headings = [...view.container.querySelectorAll('.txn-turn-heading')].map((el) => el.textContent)
        const headNums = [...view.container.querySelectorAll('.txn-turnnum')].map((el) => el.textContent)
        const links = [...view.container.querySelectorAll('.txn-anchor')].map((el) => el.getAttribute('aria-label'))
        const railLabels = presentation === Presentation.Ledger
          ? [...view.container.querySelectorAll('.txn-rail-left .txn-rail-turn-top b')].map((el) => el.textContent)
          : [...view.container.querySelectorAll('.txn-rail-left .swf-index')].map((el) => el.textContent)
        const boundaryChip = view.container.querySelector('.txn-tb-chip')?.textContent ?? null
        const okHeadings = headings.includes('assistant turn 9a') && headings.includes('user turn 10') && headings.includes('assistant turn 10a')
        const okHeadNums = JSON.stringify(headNums) === JSON.stringify(['#9a', '#10', '#10a'])
        const okLinks = links.includes('copy link to turn 9a') && links.includes('copy link to turn 10')
        const okRail = JSON.stringify(railLabels) === JSON.stringify(['#9a', '#10'])
        const okBoundary = presentation === Presentation.Ledger ? boundaryChip === null : boundaryChip === 'user turn 10'
        await view.act(() => click(window, view.container.querySelector('[role="tab"][id$="-annotations"]')))
        const annoTurn = view.container.querySelector('.txn-anno-turn')?.textContent ?? ''
        const annoRail = view.container.querySelector('.txn-rail-left .txn-ol-leaf')?.textContent ?? ''
        const okAnnos = annoTurn.startsWith('turn 9a') && annoRail === 'turn 9a'
        if (!okHeadings || !okHeadNums || !okLinks || !okRail || !okBoundary || !okAnnos) allPassed = false
        await view.unmount()
      }
    }
    check(allPassed, 'mounted headers, user-turns rail, classic TaskBoundary, copy links, accessible headings, and annotations agree on wire displayNumbers in both presentations and themes')
  })
  await run('numbering', 'number-fixture-replay-js', async () => {})

  /* ── the reader controller ─────────────────────────────────────────────────── */

  await run('reader', 'controller-request-set-equals-F', async (row, check) => {
    for (const each of row.runs) {
      const { transport, log } = documentTransport()
      const instance = await start({ transport, target: { transport: DOC.transport, ...(each.turn === undefined ? {} : { turn: each.turn }) } })
      const requested = segmentRequests(log)
      check(requested.length === new Set(requested).size && JSON.stringify([...requested].sort((a, b) => a - b)) === JSON.stringify([...each.segments].sort((a, b) => a - b)), `${each.label}: the segment requests are exactly ${JSON.stringify(each.segments)}, received ${JSON.stringify(requested)}`)
      instance.dispose()
    }
  })
  await run('reader', 'controller-target-first', async (row, check) => {
    const { transport, log } = documentTransport()
    const instance = await start({ transport, target: { transport: DOC.transport, turn: row.turn } })
    check(segmentRequests(log)[0] === row.firstSegment, `the target's segment is requested first, received ${JSON.stringify(segmentRequests(log))}`)
    instance.dispose()
  })
  await run('reader', 'controller-evicts-oldest-visited', async (row, check) => {
    const { transport } = documentTransport()
    const instance = await start({ transport, target: { transport: DOC.transport }, residency: row.residency })
    const evicted = []
    for (const ordinal of row.load) {
      const before = residentOf(instance)
      await instance.loadSegment(ordinal)
      for (const index of before) if (!instance.getSnapshot().segments.has(index)) evicted.push(index)
    }
    check(JSON.stringify(evicted) === JSON.stringify(row.evicted) && JSON.stringify(residentOf(instance)) === JSON.stringify(row.resident), `the oldest visited segment leaves first, received evicted ${JSON.stringify(evicted)} resident ${JSON.stringify(residentOf(instance))}`)
    instance.dispose()
  })
  for (const name of ['controller-pin-target', 'controller-pin-neighbour', 'controller-pin-focus', 'controller-pin-selection', 'controller-pin-open-control']) {
    await run('reader', name, async (row, check) => {
      const { transport } = documentTransport()
      const instance = await start({ transport, target: { transport: DOC.transport, ...(row.turn === undefined ? {} : { turn: row.turn }) }, residency: row.residency })
      if (row.pin) instance.setPins({ [row.pin]: [row.kept] })
      for (const ordinal of row.load) await instance.loadSegment(ordinal)
      check(instance.getSnapshot().segments.has(row.kept), `segment ${row.kept} stays resident, received ${JSON.stringify(residentOf(instance))}`)
      instance.dispose()
    })
  }
  await run('reader', 'controller-pin-open-history', async (row, check) => {
    const { transport } = documentTransport({ history: families.history.section })
    const instance = await start({ transport, target: { transport: DOC.transport }, residency: row.residency })
    await instance.openSection(families.history.section.index)
    await settle()
    for (const ordinal of row.load) await instance.loadSegment(ordinal)
    const section = instance.getSnapshot().history.get(families.history.section.index)
    check(section?.segments.size === 1, `the open section's rows stay resident, received ${section?.segments.size} with main ${JSON.stringify(residentOf(instance))}`)
    instance.dispose()
  })
  await run('reader', 'controller-refetch-keeps-number', async (row, check) => {
    const { transport, log } = documentTransport()
    const instance = await start({ transport, target: { transport: DOC.transport }, residency: row.residency })
    let first = null
    for (const ordinal of row.load) {
      await instance.loadSegment(ordinal)
      if (ordinal === row.refetched && first === null) first = instance.getSnapshot().segments.get(ordinal).turns.map((turn) => turn.label)
    }
    const again = instance.getSnapshot().segments.get(row.refetched)?.turns.map((turn) => turn.label)
    check(segmentRequests(log).filter((index) => index === row.refetched).length === 2, `the evicted segment was read again, received ${JSON.stringify(segmentRequests(log))}`)
    check(JSON.stringify(again) === JSON.stringify(first), `a refetched row keeps its served number, received ${JSON.stringify([first, again])}`)
    instance.dispose()
  })
  await run('reader', 'controller-status-kind-table', async (row, check) => {
    for (const status of row.rows) {
      const { transport, main } = documentTransport({
        respond: (operation, request) => {
          if (operation !== Operation.Segment || request.index !== 0) return undefined
          if (status.reject) return Promise.reject(new TypeError('Failed to fetch'))
          if (status.status !== 200) return { status: status.status, ...('retryAfterSeconds' in status ? { retryAfterSeconds: status.retryAfterSeconds } : {}), body: null }
          const body = main.bodies[0]
          if (status.body === 'refused-by-parser') return { status: 200, body: { ...body, rows: [{ ...body.rows[0], recordedIndexState: 'unrecorded' }] } }
          return { status: 200, body: { ...body, context: context(main.totals, { kind: DOC.transport.kind, transcriptId: DOC.otherTranscriptId }) } }
        },
      })
      const instance = await start({ transport, target: { transport: DOC.transport } })
      const failure = instance.getSnapshot().failure
      check(failure?.kind === status.kind && (status.wait === undefined || failure.retryAfterSeconds === status.wait), `row ${status.name} expects ${status.kind}${status.wait === undefined ? '' : ` waiting ${status.wait} s`}, received ${JSON.stringify(failure)}`)
      instance.dispose()
    }
  })
  await run('reader', 'controller-failure-never-whole-document', async (row, check) => {
    const responses = {
      stale: { status: 409, body: null }, busy: { status: 503, body: null }, denied: { status: 404, body: null }, unavailable: { status: 410, body: null },
      failed: { status: 500, body: null }, malformed: { status: 200, body: { rows: [] } }, network: 'reject',
    }
    const allowed = new Set(['directory', 'segment', 'window', 'header', 'locate'])
    for (const kind of row.kinds) {
      const { transport } = documentTransport({
        respond: (operation, request) => {
          if (operation !== Operation.Segment || request.index !== 0) return undefined
          return responses[kind] === 'reject' ? Promise.reject(new TypeError('Failed to fetch')) : responses[kind]
        },
      })
      const touched = []
      const fenced = new Proxy(transport, { get(target, key) { if (typeof key === 'string' && !allowed.has(key)) touched.push(key); return target[key] } })
      resetSpy()
      const instance = await start({ transport: fenced, target: { transport: DOC.transport } })
      await instance.retry()
      await settle()
      check(instance.getSnapshot().failure?.kind === kind, `${kind}: the read failed as ${kind}, received ${JSON.stringify(instance.getSnapshot().failure)}`)
      check(spy.wholeDocument === 0 && touched.length === 0, `${kind}: no whole-document adapt (${spy.wholeDocument}) and no transport member outside the five (${JSON.stringify(touched)})`)
      instance.dispose()
    }
  })
  await run('reader', 'controller-retry-after-partial-failure-settles-ready', async (row, check) => {
    let refused = false
    const { transport } = documentTransport({
      respond: (operation, request) => {
        if (operation !== Operation.Segment || request.index !== row.segment || refused) return undefined
        refused = true
        return { status: row.status, body: null }
      },
    })
    const instance = await start({ transport, target: { transport: DOC.transport, turn: row.turn } })
    const before = instance.getSnapshot()
    check(before.failure?.kind === PositionedReadFailureKind.Failed && before.segments.size > 0 && before.status !== PositionedReadStatus.Ready, `the partial failure keeps loaded rows and is not ready, received ${JSON.stringify({ status: before.status, failure: before.failure, held: [...before.segments.keys()] })}`)
    await instance.retry()
    await settle()
    const after = instance.getSnapshot()
    check(after.failure === null && after.segments.has(row.segment) && after.status === PositionedReadStatus.Ready, `a retry that answers settles the read as ready, received ${JSON.stringify({ status: after.status, failure: after.failure, held: [...after.segments.keys()] })}`)
    instance.dispose()
  })
  await run('reader', 'controller-throwing-failure-handler-settled', async (row, check) => {
    let refuse = true
    const { transport } = documentTransport({
      respond: (operation, request) => (refuse && operation === Operation.Segment && request.index === row.segment ? { status: row.status, body: null } : undefined),
    })
    const unhandled = []
    const onUnhandled = (reason) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    const instance = await start({ transport, target: { transport: DOC.transport } })
    const unsubscribe = instance.subscribe(() => {
      if (instance.getSnapshot().failure) throw new Error('boom in listener')
    })
    try {
      await instance.loadSegment(row.segment)
      await settle()
      const afterFail = instance.getSnapshot()
      check(unhandled.length === 0, `a throwing failure handler produces no unhandled rejection, received ${unhandled.length}`)
      check(afterFail.failure?.kind === PositionedReadFailureKind.Failed && afterFail.failure?.operation === Operation.Segment, `the reader records the segment failure consistently, received ${JSON.stringify(afterFail.failure)}`)
      unsubscribe()
      refuse = false
      await instance.retry()
      await settle()
      check(instance.getSnapshot().segments.has(row.segment) && instance.getSnapshot().failure === null, 'in-flight state is cleared so retry loads the segment')
    } finally {
      process.off('unhandledRejection', onUnhandled)
      instance.dispose()
    }
  })
  await run('reader', 'controller-transport-mismatch-discards', async (row, check) => {
    const { transport, main } = documentTransport({
      respond: (operation, request) => (operation === Operation.Segment && request.index === row.segment
        ? { status: 200, body: { ...main.bodies[row.segment], context: context(main.totals, { kind: DOC.transport.kind, transcriptId: DOC.otherTranscriptId }) } }
        : undefined),
    })
    const instance = await start({ transport, target: { transport: DOC.transport } })
    check(instance.getSnapshot().failure?.kind === PositionedReadFailureKind.Malformed && !instance.getSnapshot().segments.has(row.segment), 'a body naming another transcript is discarded, never installed')
    instance.dispose()
  })
  await run('reader', 'controller-directory-paging-refetch-page-one', async (row, check) => {
    let refused = false
    const { transport, log } = documentTransport({
      perPage: row.perPage,
      respond: (operation, request) => {
        if (operation === Operation.Directory && request.page === 2 && !refused) { refused = true; return { status: 404, body: null } }
        return undefined
      },
    })
    const instance = await start({ transport, target: { transport: DOC.transport } })
    const pages = log.filter((entry) => entry.operation === Operation.Directory).map((entry) => entry.request.page)
    check(JSON.stringify(pages) === JSON.stringify(row.pages), `a page past the last refetches page one, received ${JSON.stringify(pages)}`)
    check(instance.getSnapshot().directory?.segments.length === DOC.segments && !instance.getSnapshot().failure, `the directory holds every ref after the refetch, received ${instance.getSnapshot().directory?.segments.length}`)
    instance.dispose()
  })
  await run('reader', 'controller-section-open-close-aborts', async (_, check) => {
    let release
    const held = new Promise((done) => { release = done })
    const { transport, log, section } = documentTransport({
      history: families.history.section,
      respond: (operation, request) => (operation === Operation.Segment && request.partition.kind === TranscriptSegmentPartitionKind.History ? held : undefined),
    })
    const instance = await start({ transport, target: { transport: DOC.transport } })
    const opening = instance.openSection(families.history.section.index)
    await settle()
    const pending = log.find((entry) => entry.operation === Operation.Segment && entry.request.partition.kind === TranscriptSegmentPartitionKind.History)
    instance.closeSection(families.history.section.index)
    release({ status: 200, body: section.bodies[0] })
    await opening
    await settle()
    check(pending?.signal.aborted === true, 'closing the section aborts its in-flight read')
    check(!instance.getSnapshot().history.has(families.history.section.index), 'a closed section releases its rows and installs nothing that arrives late')
    instance.dispose()
  })
  await run('reader', 'controller-segment-fetch-survives-restart', async (row, check) => {
    const held = []
    let refused = false
    const { transport, log, main } = documentTransport({
      respond: (operation, request) => {
        if (operation !== Operation.Segment) return undefined
        if (request.index === row.staleSegment && !refused) { refused = true; return { status: 409, body: null } }
        if (request.index !== row.segment) return undefined
        let release
        const answer = new Promise((done) => { release = done })
        held.push(() => release({ status: 200, body: main.bodies[row.segment] }))
        return answer
      },
    })
    const instance = await start({ transport, target: { transport: DOC.transport } })
    instance.loadSegment(row.segment)
    await settle()
    await instance.loadSegment(row.staleSegment)
    await settle()
    check(instance.getSnapshot().failure?.kind === PositionedReadFailureKind.Stale, `the stale answer fails the read, received ${JSON.stringify(instance.getSnapshot().failure)}`)
    await instance.retry()
    await settle()
    const newer = instance.loadSegment(row.segment)
    await settle()
    held[0]()
    await settle()
    const again = instance.loadSegment(row.segment)
    await settle()
    const requests = segmentRequests(log).filter((index) => index === row.segment).length
    check(requests === row.requests, `segment ${row.segment} is requested once before the restart and once after, received ${requests} requests`)
    check(again === newer, 'asking again while the newer read is in flight joins that read')
    for (const release of held.slice(1)) release()
    await newer
    await settle()
    check(instance.getSnapshot().segments.has(row.segment), `the newer read installs segment ${row.segment}, received ${JSON.stringify(residentOf(instance))}`)
    instance.dispose()
  })
  await run('reader', 'controller-landing-exact-vs-snapped', async (row, check) => {
    const landingFor = async (landing, turn) => {
      const { transport } = documentTransport()
      const instance = await start({ transport, target: { transport: DOC.transport, turn }, landing })
      const value = instance.getSnapshot().landing
      instance.dispose()
      return value
    }
    const exact = await landingFor(PositionedLanding.Exact, row.turn)
    const snapped = await landingFor(PositionedLanding.Snapped, row.turn)
    const absent = await landingFor(PositionedLanding.Exact, row.absentTurn)
    check(exact.position === row.exact && exact.snapped === false, `exact lands on the requested row, received ${JSON.stringify(exact)}`)
    check(snapped.position === row.snapped && snapped.snapped === true, `snapped lands on the anchor turn, received ${JSON.stringify(snapped)}`)
    check(absent.requestedPosition === undefined && absent.position === absent.anchorPosition && absent.snapped === true, `a row the server does not serve lands on the anchor, reported as snapped, received ${JSON.stringify(absent)}`)
  })
  await run('reader', 'controller-closed-sets', async (row, check) => {
    const sameMembers = (object, members) => Object.isFrozen(object) && JSON.stringify(Object.values(object).sort()) === JSON.stringify([...members].sort())
    check(sameMembers(reader.PositionedReadFailureKind, row.failureKinds), `PositionedReadFailureKind is exactly ${JSON.stringify(row.failureKinds)}, received ${JSON.stringify(Object.values(reader.PositionedReadFailureKind))}`)
    check(sameMembers(reader.PositionedLanding, row.landings), `PositionedLanding is exactly ${JSON.stringify(row.landings)}, received ${JSON.stringify(Object.values(reader.PositionedLanding))}`)
    check(sameMembers(reader.PositionedReadStatus, row.statuses), `PositionedReadStatus is exactly ${JSON.stringify(row.statuses)}, received ${JSON.stringify(Object.values(reader.PositionedReadStatus))}`)
    check(row.failureKinds.every(reader.isPositionedReadFailureKind) && !reader.isPositionedReadFailureKind('timeout') && row.landings.every(reader.isPositionedLanding) && !reader.isPositionedLanding('nearest') && row.statuses.every(reader.isPositionedReadStatus) && !reader.isPositionedReadStatus('busy'), 'the guards accept exactly the members')
    const barrel = await load('/src/ui/transcript/index.js')
    check(barrel.PositionedReadStatus === reader.PositionedReadStatus && barrel.isPositionedReadStatus === reader.isPositionedReadStatus, 'the status set and its guard are exported from the transcript barrel')
  })
  await run('reader', 'demo-mock-refuses-invalid-body', async (_, check) => {
    let thrown = null
    try { buildPositionedDemo('open', { mutateBody: (name, body) => (name === 'segment main 3' ? { ...body, rows: [{ ...body.rows[0], displayNumber: '0' }] } : body) }) } catch (error) { thrown = error }
    check(thrown instanceof TypeError && thrown.message.includes('segment main 3') && thrown.message.includes('refused to start'), `the demo refuses to start on a body the parser refuses, received ${thrown?.message}`)
    let clean = null
    try { buildPositionedDemo('open') } catch (error) { clean = error }
    check(clean === null, `the demo starts on its own bodies, received ${clean?.message}`)
  })

  await run('reader', 'hook-strict-mode-reaches-ready', async (row, check) => {
    const { transport } = documentTransport()
    const StrictHost = () => {
      const { viewerProps } = usePositionedTranscript({ transport, target: { transport: DOC.transport, turn: row.turn }, landing: PositionedLanding.Exact })
      return React.createElement(TranscriptViewer, { ...viewerProps, capabilities: {} })
    }
    const view = await mount(React.createElement(React.StrictMode, null, React.createElement(StrictHost)))
    await view.settle(30)
    const status = view.container.querySelector('.txn-stream')?.getAttribute('data-positioned-read')
    const headings = [...view.container.querySelectorAll('.txn-turn-heading')].map((node) => node.textContent)
    check(status === row.status && headings.includes(row.heading), `under StrictMode the reader loads its target and settles, received status ${status} and ${headings.length} rows`)
    await view.unmount()
  })

  await run('reader', 'hook-viewer-props-mount-every-failure-state', async (row, check) => {
    for (const kind of row.kinds) {
      const demo = buildPositionedDemo(kind, { delayMs: 0 })
      const DemoHost = () => {
        const { viewerProps } = usePositionedTranscript({ transport: demo.transport, target: demo.target, landing: PositionedLanding.Exact })
        return React.createElement(TranscriptViewer, { ...viewerProps, capabilities: {} })
      }
      const view = await mount(React.createElement(DemoHost))
      await view.settle(30)
      const notice = view.container.querySelector(`[data-read-failure="${kind}"]`)
      const status = view.container.querySelector('.txn-stream')?.getAttribute('data-positioned-read')
      check(notice !== null && status === row.statuses[kind], `${kind}: the spread viewer props draw the ${kind} state, received notice ${notice ? 'present' : 'absent'} and status ${status}`)
      await view.unmount()
    }
  })

  /* ── usage ───────────────────────────────────────────────────────────────────── */
  const U = families.usage
  const usageView = (scopes) => scopes.map((scope) => ({
    scope: scope.scope,
    ownerCount: scope.ownerCount,
    tokens: Object.fromEntries(scope.tokens.filter((field) => field.completeness !== UsageCompleteness.Unknown).map((field) => [field.label, [field.value, field.completeness]])),
    cost: Object.fromEntries(scope.cost.filter((field) => field.completeness !== UsageCompleteness.Unknown).map((field) => [field.label, [field.value, field.completeness]])),
  }))
  await run('usage', 'usage-accumulator-equals-aggregate', async (_, check) => {
    const accumulator = createUsageAccumulator()
    for (const turn of U.turns) accumulator.addTurn(turn)
    const incremental = usageView(accumulator.finish())
    check(JSON.stringify(incremental) === JSON.stringify(U.expected), `the accumulator equals the captured aggregate, received ${JSON.stringify(incremental)}`)
    check(JSON.stringify(usageView(aggregateUsage(U.turns))) === JSON.stringify(U.expected), 'the whole-list form is the same pass')
  })
  await run('usage', 'usage-hidden-unless-present', async (row, check) => {
    for (const presence of row.presences) {
      const { transport } = documentTransport({ usagePresent: presence })
      const instance = await start({ transport, target: { transport: DOC.transport } })
      const scopes = instance.getSnapshot().usageScopes
      check(presence === TranscriptUsagePresence.Present ? Array.isArray(scopes) && scopes.length > 0 : scopes === undefined, `usagePresent ${presence} ${presence === TranscriptUsagePresence.Present ? 'shows' : 'hides'} usage, received ${JSON.stringify(scopes?.map((scope) => scope.ownerCount))}`)
      instance.dispose()
    }
  })
  await run('usage', 'usage-no-spread-150000-owners', async (row, check) => {
    const accumulator = createUsageAccumulator()
    for (let index = 0; index < row.owners; index += 1) {
      accumulator.addTurn({ usage: { scope: 'assistant', ownerId: `o${index}`, sourceEntryRef: `r${index}`, completeness: 'complete', tokens: { input: 1 }, cost: { total: index % 2 ? '0.01' : '0.001' } } })
    }
    let scopes = null
    let thrown = null
    try { scopes = accumulator.finish() } catch (error) { thrown = error }
    check(thrown === null && scopes?.[0]?.ownerCount === row.owners && scopes[0].tokens[0].value === String(row.owners), `every owner accumulates without a RangeError, received ${thrown ? thrown.name : JSON.stringify(scopes?.[0]?.ownerCount)}`)
  })

  /* ── history sections, mounted through the hook ──────────────────────────────── */
  const H = families.history
  const Host = ({ transport, onRead }) => {
    const read = usePositionedTranscript({ transport, target: { transport: DOC.transport }, landing: PositionedLanding.Exact })
    onRead(read)
    return React.createElement(TranscriptViewer, { ...read.viewerProps, capabilities: {} })
  }
  const historyHost = async () => {
    const recorded = documentTransport({ history: H.section })
    let latest = null
    const view = await mount(React.createElement(Host, { transport: recorded.transport, onRead: (read) => { latest = read } }))
    await view.settle(20)
    return { view, recorded, read: () => latest }
  }
  const toggleText = (container) => container.querySelector('.txn-earlier-toggle')?.textContent.replace(/\s+/g, ' ').trim() ?? ''
  await run('history', 'history-closed-count-qualified', async (_, check) => {
    const { view, recorded } = await historyHost()
    check(toggleText(view.container).startsWith(H.closedText), `the closed section states its recorded count, received ${JSON.stringify(toggleText(view.container))}`)
    check(!recorded.log.some((entry) => entry.request?.partition?.kind === TranscriptSegmentPartitionKind.History), 'a closed section reads nothing')
    await view.unmount()
  })
  await run('history', 'history-open-exact-count', async (_, check) => {
    const { view } = await historyHost()
    await view.act(() => click(window, view.container.querySelector('.txn-earlier-toggle')))
    await view.settle(20)
    check(toggleText(view.container).startsWith(H.openText), `the open section states its exact served count, received ${JSON.stringify(toggleText(view.container))}`)
    await view.unmount()
  })
  await run('history', 'history-numbering-restarts', async (_, check) => {
    const { view, read } = await historyHost()
    await view.act(() => click(window, view.container.querySelector('.txn-earlier-toggle')))
    await view.settle(20)
    const section = read().viewerProps.viewModel.earlierHistory[0]
    const labels = section.turns.map((turn) => turn.label)
    const headings = [...view.container.querySelectorAll('.txn-earlier .txn-turn-heading')].map((node) => node.textContent)
    check(labels[0] === '1' && headings[0] === 'user turn 1' && section.turns.every((turn) => turn.partition === `earlier-${H.section.index}`), `the section numbers from 1 in its own partition, received ${JSON.stringify(labels)} ${JSON.stringify(headings.slice(0, 2))}`)
    await view.unmount()
  })

  await run('reader', 'hook-history-closes-on-transcript-swap', async (_, check) => {
    const first = documentTransport({ history: H.section })
    const otherTranscript = { kind: DOC.transport.kind, transcriptId: DOC.otherTranscriptId }
    const second = documentTransport({ history: H.section, transcript: otherTranscript })
    let latest = null
    const SwapHost = ({ transport, transcript }) => {
      const read = usePositionedTranscript({ transport, target: { transport: transcript }, landing: PositionedLanding.Exact })
      latest = read
      return React.createElement(TranscriptViewer, { ...read.viewerProps, capabilities: {} })
    }
    const view = await mount(React.createElement(SwapHost, { transport: first.transport, transcript: DOC.transport }))
    await view.settle(20)
    await view.act(() => click(window, view.container.querySelector('.txn-earlier-toggle')))
    await view.settle(20)
    check(historyRequests(first.log).length > 0 && view.container.querySelector('.txn-earlier-toggle')?.getAttribute('aria-expanded') === 'true', 'the section opens on the first transcript')
    await view.rerender(React.createElement(SwapHost, { transport: second.transport, transcript: otherTranscript }))
    await view.settle(30)
    const open = Object.entries(latest.viewerProps.earlierHistoryOpen).filter(([, value]) => value).map(([id]) => id)
    check(historyRequests(second.log).length === 0, `the swapped-in transcript reads no history section, received ${historyRequests(second.log).length} history requests`)
    check(open.length === 0 && view.container.querySelector('.txn-earlier-toggle')?.getAttribute('aria-expanded') === 'false', `the section shows closed after the swap, received open ${JSON.stringify(open)}`)
    await view.unmount()
  })
  await run('reader', 'hook-history-section-id-shared', async (row, check) => {
    for (const { section, id } of row.ids) {
      check(historySectionId(section) === id && parseHistorySectionId(id) === section, `section ${section} is named ${id} and read back, received ${JSON.stringify([historySectionId(section), parseHistorySectionId(id)])}`)
    }
    for (const value of row.rejected) check(parseHistorySectionId(value) === undefined, `${JSON.stringify(value)} is not a section id, received ${parseHistorySectionId(value)}`)
    const barrel = await load('/src/ui/transcript/index.js')
    check(barrel.historySectionId === historySectionId && barrel.parseHistorySectionId === parseHistorySectionId, 'historySectionId and parseHistorySectionId are exported from the transcript barrel')
    const { view, recorded, read } = await historyHost()
    const section = read().viewerProps.viewModel.earlierHistory[0]
    check(section.id === historySectionId(H.section.index) && view.container.querySelector('.txn-earlier')?.getAttribute('data-earlier-section') === section.id, `the hook's view and the mounted viewer name the section ${historySectionId(H.section.index)}, received ${section.id}`)
    await view.act(() => read().viewerProps.onEarlierHistoryOpenChange(Object.fromEntries(row.rejected.map((value) => [value, true]))))
    await view.settle(20)
    check(historyRequests(recorded.log).length === 0, `an open state keyed by values that are not section ids opens nothing, received ${historyRequests(recorded.log).length} history requests`)
    await view.act(() => read().controls.openSection(H.section.index))
    await view.settle(20)
    check(historyRequests(recorded.log).length > 0 && read().viewerProps.earlierHistoryOpen[section.id] === true, 'the controls open the section under the same id the viewer reads')
    await view.unmount()
  })
  await run('reader', 'hook-history-toggle-tells-reader-once', async (row, check) => {
    const recorded = documentTransport({ history: H.section })
    const StrictHost = () => {
      const read = usePositionedTranscript({ transport: recorded.transport, target: { transport: DOC.transport }, landing: PositionedLanding.Exact })
      return React.createElement(TranscriptViewer, { ...read.viewerProps, capabilities: {} })
    }
    const view = await mount(React.createElement(React.StrictMode, null, React.createElement(StrictHost)))
    await view.settle(20)
    resetSpy()
    await view.act(() => click(window, view.container.querySelector('.txn-earlier-toggle')))
    await view.settle(20)
    const opens = spy.sectionOpens
    await view.act(() => click(window, view.container.querySelector('.txn-earlier-toggle')))
    await view.settle(20)
    check(opens === row.opens && spy.sectionCloses === row.closes, `one toggle open and one toggle closed tell the reader ${row.opens} and ${row.closes} times, received ${opens} and ${spy.sectionCloses}`)
    await view.unmount()
  })

  /* ── integrity pairs ─────────────────────────────────────────────────────────── */
  const I = families.integrity
  const rows = I.rows.map((row) => ({ ...row, partition: 'main' }))
  await run('integrity', 'integrity-mark-on-served-pair', async (row, check) => {
    const props = positionedIntegrity({ flaggedTurns: I.flaggedTurns, contentHash: I.contentHash }, rows)
    const view = integrityView(props.integrity, props.contentHash, props.contentHash)
    check(JSON.stringify([...(view?.positions ?? [])]) === JSON.stringify(row.marked), `a pair marks only the row carrying its recorded index, received ${JSON.stringify([...(view?.positions ?? [])])}`)
  })
  await run('integrity', 'integrity-no-mark-without-hash', async (_, check) => {
    const props = positionedIntegrity({ flaggedTurns: I.flaggedTurns }, rows)
    const view = integrityView(props.integrity, props.contentHash, props.contentHash)
    check(view !== null && view.positions.size === 0, `without contentHash the badge draws and no row is marked, received ${JSON.stringify(view && [...view.positions])}`)
  })
}, { plugins: [counterPlugin] })

/* every family's pending flags, against the manifest's pending set: nothing is skipped silently */
const flagged = Object.values(families).flatMap((family) => family.cases.filter((row) => row.pending === true).map((row) => row.name))
const same = (a, b) => a.size === b.size && [...a].every((name) => b.has(name))
report.check(same(new Set(flagged), PENDING_CASE_NAMES) && same(skipped, PENDING_CASE_NAMES), `pending-cases-match-manifest: the skipped cases ${JSON.stringify([...skipped])} and the flagged ones ${JSON.stringify(flagged)} must equal pendingCaseNames ${JSON.stringify([...PENDING_CASE_NAMES])}`)
report.finish(`${ran} cases ran, ${pending} pending.`)
