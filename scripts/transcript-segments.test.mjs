#!/usr/bin/env node
/* Mounted + pure gate for the segmented transcript viewer.

   Fixtures describe directories by parameters (a 10,000-turn / 200-segment directory,
   the 32 MiB session's 1,312 turns in 32 segments, and a sparse 55-turn session), the
   loaded-segment combinations and their expected boundaries, the window descriptors a
   jump produces, and the mounted card / truncation / continuation outcomes. Everything
   is read from scripts/testdata/transcript-segments.yaml and its required-NAME manifest;
   no case table lives here.

   The pure half asserts the loaded-region model. The mounted half mounts the REAL
   `TranscriptViewer` through vite's ssrLoadModule into jsdom and asserts the DOM a
   reader reaches: boundary controls, the `min(200, totalSegments)` sample, the
   window's covering-run requests, the mounted-card bound, the truncation notice and
   the cross-edge continuation marker.

   Run: pnpm test:transcript-segments
   Mutations: pnpm test:transcript-segments:mutations */
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { loadFixturePair, assertExactNames, assertFields, withMountedSource, click, createReport } from './mounted-parts.mjs'
import {
  SEGMENT_SCRUBBER_TICKS,
  boundaryCaption,
  loadedRegions,
  loadedScope,
  mountedCardBound,
  regionBoundaries,
  scrubberTicks,
  turnsFromSegments,
  windowCoverage,
} from '../src/ui/transcript/segments.js'

const FIXTURE = 'scripts/testdata/transcript-segments.yaml'
const MANIFEST = 'scripts/testdata/transcript-segments.manifest.yaml'
const BOUNDARY_FIXTURE = 'scripts/testdata/transcript-segment-boundary.yaml'
const BOUNDARY_MANIFEST = 'scripts/testdata/transcript-segment-boundary.manifest.yaml'
const { fixture: boundaryFixture } = loadFixturePair(BOUNDARY_FIXTURE, BOUNDARY_MANIFEST, {
  sides: 'requiredSideNames',
  missing: 'requiredMissingNames',
})
const BOUNDARY_FIELDS = ['key', 'side', 'firstTurn', 'lastTurn', 'segmentIndexes', 'segmentCount', 'byteLength', 'loadSegment']
for (const row of boundaryFixture.sides) {
  assertFields(row, ['name', 'boundary', 'label', 'iconClass'], `${BOUNDARY_FIXTURE} ${row.name}`)
  assertFields(row.boundary, BOUNDARY_FIELDS, `${BOUNDARY_FIXTURE} ${row.name} boundary`)
}
for (const row of boundaryFixture.missing) {
  assertFields(row, ['name', 'props'], `${BOUNDARY_FIXTURE} ${row.name}`)
  assertFields(row.props, [], `${BOUNDARY_FIXTURE} ${row.name} props`, ['boundary'])
  if ('boundary' in row.props && row.props.boundary != null) {
    throw new Error(`${BOUNDARY_FIXTURE} ${row.name}: a missing-boundary row must omit boundary or set it to null`)
  }
}
assertExactNames(boundaryFixture.sides.map((row) => row.boundary.side), ['older', 'newer', 'all'], `${BOUNDARY_FIXTURE} side set`)

const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  directories: 'requiredDirectoryNames',
  loadCases: 'requiredLoadCaseNames',
  windowCases: 'requiredWindowCaseNames',
  mountCases: 'requiredMountCaseNames',
  phaseCases: 'requiredPhaseCaseNames',
  recoveryCases: 'requiredRecoveryCaseNames',
})

for (const row of fixture.directories) assertFields(row, ['name', 'totalTurns', 'totalSegments', 'firstTurn', 'segmentTurns', 'segmentBytes'], `${FIXTURE} ${row.name}`)
for (const row of fixture.loadCases) assertFields(row, ['name', 'directory', 'loaded', 'expect'], `${FIXTURE} ${row.name}`)
for (const row of fixture.windowCases) assertFields(row, ['name', 'directory', 'loaded', 'window', 'expect'], `${FIXTURE} ${row.name}`)
for (const row of fixture.mountCases) assertFields(row, ['name', 'directory', 'loaded', 'expect'], `${FIXTURE} ${row.name}`, ['window', 'oversizedTurn'])
for (const row of fixture.phaseCases) assertFields(row, ['name', 'directory', 'loaded', 'phase', 'caption'], `${FIXTURE} ${row.name}`)
for (const row of fixture.recoveryCases) assertFields(row, ['name', 'mode', 'directory', 'loaded', 'requests'], `${FIXTURE} ${row.name}`, ['window', 'restoredTurn'])

const DIRECTORY = new Map(fixture.directories.map((row) => [row.name, row]))

/** Build the directory refs the producer would emit for a parameterised fixture. */
function buildDirectory(def) {
  const refs = []
  let first = def.firstTurn
  const lastTurn = def.firstTurn + def.totalTurns - 1
  for (let index = 0; index < def.totalSegments; index += 1) {
    const last = Math.min(lastTurn, first + def.segmentTurns - 1)
    refs.push({ index, firstTurn: first, lastTurn: last, byteLength: def.segmentBytes })
    first = last + 1
  }
  return {
    sessionId: 'sess_segment_fixture',
    revision: '7',
    totalTurns: def.totalTurns,
    totalSegments: def.totalSegments,
    segments: refs,
  }
}

const roleFor = (index) => (index % 6 === 0 ? 'user' : index % 7 === 0 ? 'system' : 'assistant')

/** One cooked turn for the fixture's synthetic session. An assistant turn is wordless
    with one tool call, so an action run crossing a window edge is observable. */
function makeTurn(index) {
  const role = roleFor(index)
  const turn = { index, role, label: String(index), depth: 0, content: '', annotations: [], identity: `main:${index}`, sourceIndexUnique: true }
  if (role === 'user') turn.content = `request ${index}`
  else if (role === 'system') turn.content = `system note ${index}`
  else turn.toolCalls = [{ id: `call-${index}`, name: 'Read', group: 'read', filePath: `/src/file-${index % 3}.js`, sourceIndex: 0, sourceIdUnique: true }]
  return turn
}

function makeSegment(directory, def, index, oversizedTurn) {
  const ref = directory.segments[index]
  const turns = []
  for (let turnIndex = ref.firstTurn; turnIndex <= ref.lastTurn; turnIndex += 1) {
    const turn = makeTurn(turnIndex)
    if (turnIndex === oversizedTurn) {
      turn.truncated = true
      turn.byteLength = 4 * 1024 * 1024
      turn.content = 'an oversized assistant turn'
    }
    turns.push(turn)
  }
  return {
    index,
    firstTurn: ref.firstTurn,
    lastTurn: ref.lastTurn,
    byteLength: ref.byteLength,
    hasOlder: index > 0,
    hasNewer: index < def.totalSegments - 1,
    turns,
  }
}

function makeSegments(def, indexes, oversizedTurn) {
  const directory = buildDirectory(def)
  return indexes.map((index) => makeSegment(directory, def, index, oversizedTurn))
}

const report = createReport('transcript segments')

/* ── the loaded-region model ────────────────────────────────────────────────── */
for (const row of fixture.loadCases) {
  const def = DIRECTORY.get(row.directory)
  const directory = buildDirectory(def)
  const loaded = makeSegments(def, row.loaded)
  const regions = loadedRegions(directory, loaded)
  const boundaries = regionBoundaries(directory, regions)
  const sides = boundaries.map((boundary) => boundary.side)
  report.check(JSON.stringify(sides) === JSON.stringify(row.expect.boundarySides), `${row.name}: boundary sides ${JSON.stringify(sides)} must equal ${JSON.stringify(row.expect.boundarySides)}`)
  const loads = boundaries.map((boundary) => boundary.loadSegment)
  report.check(JSON.stringify(loads) === JSON.stringify(row.expect.loadSegments), `${row.name}: load-more loads ${JSON.stringify(loads)} must equal ${JSON.stringify(row.expect.loadSegments)}`)
  report.check(boundaries.length === row.expect.boundaryCount, `${row.name}: ${boundaries.length} boundaries must equal ${row.expect.boundaryCount}`)
  const ticks = scrubberTicks(directory)
  report.check(ticks.length === row.expect.ticks, `${row.name}: ${ticks.length} ticks must equal ${row.expect.ticks}`)
  report.check(new Set(ticks.map((tick) => tick.key)).size === ticks.length, `${row.name}: scrubber keys must be unique`)
  report.check(ticks.length <= SEGMENT_SCRUBBER_TICKS, `${row.name}: the scrubber sample must never exceed ${SEGMENT_SCRUBBER_TICKS}`)
  if (ticks.length > 0) {
    report.check(ticks[0].index === 0 && ticks[ticks.length - 1].index === def.totalSegments - 1, `${row.name}: the sample must include the first and last segments`)
    report.check(ticks.every((tick) => Number.isFinite(tick.firstTurn) && Number.isFinite(tick.lastTurn)), `${row.name}: every tick must name its turn range`)
  }
  const turns = turnsFromSegments(loaded)
  report.check(turns.length === mountedCardBound(loaded), `${row.name}: the mounted-card bound must equal the loaded turns`)
  report.check(new Set(turns.map((turn) => turn.index)).size === turns.length, `${row.name}: overlapping segments must never duplicate a turn`)
  const scope = loadedScope(directory, regions)
  report.check(scope.loadedSegments === row.loaded.length, `${row.name}: the scope must count loaded segments`)
  report.check(scope.complete === (row.loaded.length === def.totalSegments), `${row.name}: completeness must follow the loaded segment count`)
}

{
  const def = DIRECTORY.get('10000 turn directory')
  const directory = buildDirectory(def)
  const ticks = scrubberTicks(directory)
  report.check(ticks.length === 200, '10000 turn directory: exactly 200 ticks')
  report.check(new Set(ticks.map((tick) => tick.key)).size === 200, '10000 turn directory: 200 unique tick keys')
}

{
  const def = DIRECTORY.get('32 mib session')
  const directory = buildDirectory(def)
  const ticks = scrubberTicks(directory)
  report.check(ticks.length === 32, '32 mib session: 32 ticks for 32 segments')
  const loaded = makeSegments(def, [0, 1])
  report.check(mountedCardBound(loaded) === 82, '32 mib session: two loaded segments bound the mount at 82 turns')
}

/* ── the window descriptor ───────────────────────────────────────────────────── */
for (const row of fixture.windowCases) {
  const def = DIRECTORY.get(row.directory)
  const directory = buildDirectory(def)
  const loaded = makeSegments(def, row.loaded)
  const window = { sessionId: 'sess_segment_fixture', revision: '7', ...row.window }
  const coverage = windowCoverage(window, loaded)
  report.check(JSON.stringify(coverage.missing) === JSON.stringify(row.expect.missing), `${row.name}: missing covering segments ${JSON.stringify(coverage.missing)} must equal ${JSON.stringify(row.expect.missing)}`)
  const requests = coverage.missing
  report.check(JSON.stringify(requests) === JSON.stringify(row.expect.requests), `${row.name}: the viewer requests ${JSON.stringify(requests)} in order`)
  report.check(coverage.complete === row.expect.complete, `${row.name}: completion must be ${row.expect.complete}`)
  const allLoaded = makeSegments(def, row.loaded.concat(row.expect.missing))
  const regions = loadedRegions(directory, allLoaded)
  report.check(regions.length === row.expect.regionCount, `${row.name}: ${regions.length} regions must equal ${row.expect.regionCount}`)
}

/* ── the mounted viewer ──────────────────────────────────────────────────────── */
function viewModel(loaded, extra = {}) {
  return {
    session: { id: 'sess_segment_fixture', title: 'a segmented transcript', harness: 'claude-code' },
    turns: [],
    toolCallsById: new Map(),
    diffs: [],
    files: [],
    tasks: [],
    highlights: [],
    filterIndex: { annotationsByTurn: {}, toolGroupCounts: {} },
    analytics: {},
    ...extra,
  }
}

const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: true, canChangeVisibility: false, canExport: true }
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()

await withMountedSource(async ({ load, mount, window, React }) => {
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')

  const viewer = (props, extra) => React.createElement(TranscriptViewer, {
    viewModel: viewModel(props.segments ?? [], extra),
    capabilities: CAPABILITIES,
    presentation: 'ledger',
    callbacks: { onLoadFullTurn: () => {} },
    ...props,
  })

  for (const row of fixture.phaseCases) {
    const def = DIRECTORY.get(row.directory)
    const mounted = await mount(viewer({ directory: buildDirectory(def), segments: makeSegments(def, row.loaded) }, { analytics: { phases: [row.phase] } }))
    await mounted.settle()
    const caption = text(mounted.container.querySelector('.txn-phase .rng'))
    report.check(caption === row.caption, `${row.name}: phase caption ${JSON.stringify(caption)} must equal ${JSON.stringify(row.caption)}`)
    await mounted.unmount()
  }

  /* window requests and the no-partial rule */
  for (const row of fixture.windowCases) {
    const def = DIRECTORY.get(row.directory)
    const directory = buildDirectory(def)
    const loaded = makeSegments(def, row.loaded)
    const requests = []
    const mounted = await mount(viewer({
      directory,
      segments: loaded,
      window: { sessionId: dirSession(), revision: '7', ...row.window },
      onLoadSegment: (index) => requests.push(index),
      onLoadWindow: () => {},
    }))
    await mounted.settle()
    report.check(JSON.stringify(requests) === JSON.stringify(row.expect.requests), `${row.name}: mounted viewer requests ${JSON.stringify(requests)} must equal ${JSON.stringify(row.expect.requests)}`)
    const windowTurns = row.window.segments.flatMap((index) => makeSegment(directory, def, index).turns)
    const mountedWindowTurns = windowTurns.filter((turn) => mounted.container.querySelector(`#turn-${turn.index}`))
    if (!row.expect.complete) {
      report.check(mountedWindowTurns.length === 0, `${row.name}: no window turn renders before its covering run is complete`)
    } else {
      report.check(!!mounted.container.querySelector(`#turn-${row.window.anchorTurn}`), `${row.name}: the complete window renders its anchor turn`)
    }
    const expectedBoundaries = regionBoundaries(directory, loadedRegions(directory, loaded))
    const mountedCounts = [...mounted.container.querySelectorAll('[data-segment-boundary]')].map((node) => Number(node.dataset.segmentCount))
    report.check(JSON.stringify(mountedCounts) === JSON.stringify(expectedBoundaries.map((boundary) => boundary.segmentCount)), `${row.name}: a held window segment is never reported as unloaded`)
    await mounted.unmount()
  }

  /* mounted card bound, boundaries, truncation, continuation and scope */
  for (const row of fixture.mountCases) {
    const def = DIRECTORY.get(row.directory)
    const directory = buildDirectory(def)
    const loaded = makeSegments(def, row.loaded, row.oversizedTurn)
    /* prove a file from a loaded turn is listed and one only elsewhere is absent */
    const firstAssistantWithTools = loaded.flatMap((segment) => segment.turns).find((turn) => turn.toolCalls?.length)
    if (firstAssistantWithTools) firstAssistantWithTools.toolCalls.push({ id: 'loaded-file', name: 'Read', group: 'read', filePath: '/src/loaded.js', sourceIndex: 1, sourceIdUnique: true })
    const requests = []
    const mounted = await mount(viewer({
      directory,
      segments: loaded,
      window: row.window ? { sessionId: dirSession(), revision: '7', ...row.window } : undefined,
      onLoadSegment: (index) => requests.push(index),
      onLoadWindow: () => {},
    }))
    await mounted.settle()
    const stream = mounted.container.querySelector('.txn-stream')
    const cards = mounted.container.querySelectorAll('.txn-turn').length
    report.check(cards <= row.expect.maxCards, `${row.name}: ${cards} mounted cards must not exceed ${row.expect.maxCards}`)
    report.check(Number(stream?.dataset.mountedTurnBound) === row.expect.maxCards, `${row.name}: the stream must publish its mounted-card bound`)
    report.check(mountedCardBound(loaded) === row.expect.maxCards, `${row.name}: the loaded segments bound the mount at ${row.expect.maxCards}`)
    const boundaryNodes = [...mounted.container.querySelectorAll('[data-segment-boundary]')]
    report.check(boundaryNodes.length === row.expect.boundaryCount, `${row.name}: ${boundaryNodes.length} boundary controls must equal ${row.expect.boundaryCount}`)
    report.check(Number(stream?.dataset.segmentBoundaries) === boundaryNodes.length, `${row.name}: the published boundary count must match the mounted controls`)
    const sides = boundaryNodes.map((node) => node.dataset.segmentBoundary)
    report.check(JSON.stringify(sides) === JSON.stringify(row.expect.boundarySides), `${row.name}: boundary sides ${JSON.stringify(sides)} must equal ${JSON.stringify(row.expect.boundarySides)}`)
    report.check(mounted.container.querySelectorAll('[data-segment-boundary="between"]').length === (row.expect.boundarySides.includes('between') ? 1 : 0), `${row.name}: a gap draws exactly one between boundary`)
    for (const node of boundaryNodes) {
      report.check(node.querySelectorAll('button.txn-segboundary-load').length === 1, `${row.name}: a boundary carries exactly one load-more control`)
    }
    const expectedBoundaries = regionBoundaries(directory, loadedRegions(directory, loaded))
    for (const [index, node] of boundaryNodes.entries()) {
      const caption = text(node.querySelector('.txn-segboundary-caption'))
      report.check(caption === row.expect.captions[index], `${row.name}: boundary ${index} caption ${JSON.stringify(caption)} must equal ${JSON.stringify(row.expect.captions[index])}`)
    }
    const truncation = mounted.container.querySelector('.txn-truncation')
    report.check(!!truncation === row.expect.truncation, `${row.name}: the truncation notice must be ${row.expect.truncation ? 'present' : 'absent'}`)
    if (row.expect.truncation) {
      report.check(!!truncation, `${row.name}: the truncation notice must be present`)
      if (truncation) {
        report.check(text(truncation).includes(row.expect.truncationCopy), `${row.name}: the truncation notice consumes byteLength (${row.expect.truncationCopy})`)
        report.check(!!truncation.querySelector('.txn-truncation-load'), `${row.name}: the truncation notice offers the full turn read`)
      }
    }
    const continuationCount = mounted.container.querySelectorAll('.txn-action-continuation').length
    report.check(continuationCount === row.expect.continuationCount, `${row.name}: the continuation count must equal ${row.expect.continuationCount}`)
    if (row.expect.heldCaptions) {
      const held = [...mounted.container.querySelectorAll('.txn-held-window')].map(text)
      report.check(JSON.stringify(held) === JSON.stringify(row.expect.heldCaptions), `${row.name}: the held range must be named`)
      const order = [...mounted.container.querySelectorAll('[data-segment-boundary], .txn-held-window')].map((node) => node.hasAttribute('data-segment-boundary') ? 'boundary' : 'held')
      report.check(JSON.stringify(order) === JSON.stringify(row.expect.heldOrder), `${row.name}: held ranges and boundaries follow document order`)
    }
    const notIndexed = mounted.container.querySelector('[data-not-indexed]')
    report.check(!!notIndexed === row.expect.notIndexed, `${row.name}: the not-indexed state must be ${row.expect.notIndexed ? 'shown' : 'absent'}`)
    if (row.expect.notIndexed) {
      report.check(!text(mounted.container.querySelector('.txn-stream')).includes('every turn is filtered out'), `${row.name}: an empty session must not read as filtered out`)
    }
    /* A boundary control takes the same load path the host wires. */
    const loadControl = boundaryNodes[0]?.querySelector('.txn-segboundary-load')
    if (loadControl && expectedBoundaries[0]) {
      await mounted.act(() => click(window, loadControl))
      report.check(requests[requests.length - 1] === expectedBoundaries[0].loadSegment, `${row.name}: the control loads segment ${expectedBoundaries[0].loadSegment}`)
    }
    /* the checklist's mounted read at the middle and the end of the stream */
    for (const scrollTop of [0, 5000, 10_000]) {
      await mounted.act(() => {
        stream.scrollTop = scrollTop
        stream.dispatchEvent(new window.Event('scroll', { bubbles: true }))
      })
      await mounted.settle()
      const atPosition = mounted.container.querySelectorAll('.txn-turn').length
      report.check(atPosition <= row.expect.maxCards, `${row.name}: mounted cards at scrollTop ${scrollTop} must not exceed ${row.expect.maxCards}`)
    }
    /* The Files tab states the exact loaded-region scope. */
    const filesTab = [...mounted.container.querySelectorAll('[role="tab"]')].find((node) => text(node).startsWith('files'))
    if (filesTab) {
      await mounted.act(() => click(window, filesTab))
      await mounted.settle()
      const filesPane = mounted.container.querySelector('.txn-files')
      const scopeLine = filesPane?.querySelectorAll('.txn-scope')[0]
      const table = mounted.container.querySelector('.txn-filetable')
      const listed = table ? text(table) : ''
      report.check(text(scopeLine) === `${row.expect.filesScope}. a file that appears only in an unloaded segment is not listed.`, `${row.name}: the Files tab must state its loaded-region scope`)
      if (loaded.length > 0) {
        report.check(listed.includes('loaded.js'), `${row.name}: a file from a loaded turn is listed`)
        report.check(!listed.includes('unloaded.js'), `${row.name}: a file only in an unloaded turn is not listed`)
      }
    }
    await mounted.unmount()
  }

  for (const row of fixture.recoveryCases) {
    const def = DIRECTORY.get(row.directory)
    const directory = buildDirectory(def)
    const requests = []
    if (row.mode === 'clear-window') {
      const segments = makeSegments(def, row.loaded)
      const descriptor = { sessionId: dirSession(), revision: '7', ...row.window }
      const onLoadSegment = (index) => { requests.push(index) }
      const props = { directory, segments, onLoadSegment }
      const mounted = await mount(viewer({ ...props, window: descriptor }))
      await mounted.settle()
      await mounted.rerender(viewer({ ...props, window: null }))
      await mounted.settle()
      report.check(!!mounted.container.querySelector(`#turn-${row.restoredTurn}`), `${row.name}: clearing the window restores held turns`)
      await mounted.rerender(viewer({ ...props, window: descriptor }))
      await mounted.settle()
      report.check(JSON.stringify(requests) === JSON.stringify(row.requests), `${row.name}: the same missing segment is requested again`)
      await mounted.unmount()
      continue
    }
    let rejectLoad
    const onLoadSegment = (index) => {
      requests.push(index)
      if (row.mode === 'rejected') return new Promise((resolve, reject) => { rejectLoad = reject })
    }
    const mounted = await mount(viewer({ directory, segments: makeSegments(def, row.loaded), onLoadSegment }))
    const button = mounted.container.querySelector('.txn-segboundary-load')
    await mounted.act(() => click(window, button))
    if (row.mode === 'rejected') {
      report.check(button.disabled, `${row.name}: pending load disables the control`)
      if (rejectLoad) await mounted.act(() => rejectLoad(new Error('failed fetch')))
      await mounted.settle()
    }
    report.check(!button.disabled, `${row.name}: failed or untracked load permits retry`)
    await mounted.act(() => click(window, button))
    report.check(JSON.stringify(requests) === JSON.stringify(row.requests), `${row.name}: retry invokes the host again`)
    await mounted.unmount()
  }

  /* A prepend keeps the reader's viewport position, not just their turn. The test
     supplies real geometry (jsdom lays nothing out): every turn is 50px tall and
     100px apart, and the prepended segment shifts every offset down by 280px. */
  {
    const def = DIRECTORY.get('sparse 55 turn session')
    const directory = buildDirectory(def)
    const loadedBefore = makeSegments(def, [2])
    const loadedAfter = makeSegments(def, [1, 2])
    let shift = 0
    const savedTop = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'offsetTop')
    const savedHeight = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(window.HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get() { const match = /^turn-(\d+)$/.exec(this.id ?? ''); return match ? Number(match[1]) * 100 + shift : 0 },
    })
    Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() { return /^turn-\d+$/.test(this.id ?? '') ? 50 : 0 },
    })
    try {
      const mounted = await mount(viewer({ directory, segments: loadedBefore, onLoadSegment: () => {}, onLoadWindow: () => {} }))
      await mounted.settle()
      const stream = mounted.container.querySelector('.txn-stream')
      stream.scrollTop = 137
      const anchor = [...mounted.container.querySelectorAll('article[id^="turn-"]')]
        .filter((turn) => turn.querySelector('.txn-turn.user, .txn-turn.system'))
        .find((turn) => turn.offsetTop + turn.offsetHeight > stream.scrollTop)
      report.check(!!anchor, `prepend: the loaded segment mounts a navigable turn (${mounted.container.querySelectorAll('.txn-turn').length} cards)`)
      const beforeViewportTop = anchor ? anchor.offsetTop - stream.scrollTop : null
      const older = mounted.container.querySelector('[data-segment-boundary="older"] .txn-segboundary-load')
      report.check(!!older, 'prepend: the older edge offers a load control')
      if (older) await mounted.act(() => click(window, older))
      shift = 280
      await mounted.rerender(viewer({ directory, segments: loadedAfter, onLoadSegment: () => {}, onLoadWindow: () => {} }))
      await mounted.settle()
      const sameTurn = anchor ? mounted.container.querySelector(`#${anchor.id}`) : null
      const afterViewportTop = sameTurn ? sameTurn.offsetTop - stream.scrollTop : null
      report.check(beforeViewportTop === afterViewportTop, `prepend: the reader's viewport position must be unchanged (${beforeViewportTop} -> ${afterViewportTop})`)
      report.check(stream.scrollTop === 417, `prepend: the restored scrollTop must be 417, received ${stream.scrollTop}`)
      await mounted.unmount()
    } finally {
      if (savedTop) Object.defineProperty(window.HTMLElement.prototype, 'offsetTop', savedTop)
      else delete window.HTMLElement.prototype.offsetTop
      if (savedHeight) Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', savedHeight)
      else delete window.HTMLElement.prototype.offsetHeight
    }
  }

  /* the scrubber sample: one node per sampled segment, never one per turn */
  for (const [name, totalSegments] of [['10000 turn directory', 200], ['10000 turn crowd directory', 400]]) {
    const def = DIRECTORY.get(name)
    const directory = buildDirectory(def)
    const loaded = makeSegments(def, [0])
    const mounted = await mount(viewer({ directory, segments: loaded }))
    await mounted.settle()
    const stream = mounted.container.querySelector('.txn-stream')
    await mounted.act(() => {
      stream.scrollTop = 200
      stream.dispatchEvent(new window.Event('scroll', { bubbles: true }))
    })
    await mounted.settle()
    const ticks = mounted.container.querySelectorAll('.txn-scrub-segment-tick')
    report.check(ticks.length === 200, `${name} mounted: 200 scrubber ticks on ${totalSegments} segments`)
    report.check(new Set([...ticks].map((tick) => tick.dataset.segmentIndex)).size === 200, `${name} mounted: tick keys are unique segment indexes`)
    const scrubber = mounted.container.querySelector('.txn-scrub')
    report.check(scrubber?.getAttribute('aria-valuemax') === '200', `${name} mounted: the scrubber announces its sample, not the turn count`)
    await mounted.unmount()
  }

  /* The library smoke renders one props object per export, so only the newer
     edge is covered there. Render the production boundary for every side and
     for a missing descriptor. */
  const boundaryModule = await load('/src/ui/transcript/TranscriptBoundary.jsx')
  const TranscriptBoundary = boundaryModule.default
  const { TranscriptSegmentBoundaryError } = boundaryModule
  const captions = []
  const icons = new Set()
  const labels = new Set()
  for (const row of boundaryFixture.sides) {
    const markup = renderToStaticMarkup(React.createElement(TranscriptBoundary, {
      boundary: row.boundary,
      onLoadMore: () => {},
    }))
    const document = new JSDOM(markup).window.document
    const node = document.querySelector('[data-segment-boundary]')
    const caption = text(node?.querySelector('.txn-segboundary-caption'))
    const button = node?.querySelector('button.txn-segboundary-load')
    const expectedCaption = boundaryCaption(row.boundary)
    const renderedIcon = [...(document.querySelector('svg')?.classList ?? [])].find((name) => name.startsWith('lucide-chevron-'))
    captions.push(caption)
    if (renderedIcon) icons.add(renderedIcon)
    labels.add(text(button))
    report.check(node?.dataset.segmentBoundary === row.boundary.side, `${row.name}: side ${node?.dataset.segmentBoundary} must equal ${row.boundary.side}`)
    report.check(node?.classList.contains(`txn-segboundary-${row.boundary.side}`), `${row.name}: the side class must be txn-segboundary-${row.boundary.side}`)
    report.check(Number(node?.dataset.segmentCount) === row.boundary.segmentCount, `${row.name}: segment count must equal ${row.boundary.segmentCount}`)
    report.check(caption === expectedCaption, `${row.name}: caption ${JSON.stringify(caption)} must equal ${JSON.stringify(expectedCaption)}`)
    report.check(!!document.querySelector(`svg.${row.iconClass}`), `${row.name}: expected the ${row.iconClass} icon`)
    report.check(document.querySelectorAll('svg').length === 1, `${row.name}: a boundary draws one icon`)
    report.check(text(button).includes(row.label), `${row.name}: the control must read ${JSON.stringify(row.label)}`)
    report.check(button?.getAttribute('aria-label')?.includes(expectedCaption), `${row.name}: the accessible name must include the caption`)
    report.check(button?.hasAttribute('disabled') === false, `${row.name}: a supplied onLoadMore leaves the control enabled`)
  }
  report.check(new Set(captions).size === captions.length, `boundary sides must render distinct captions, received ${JSON.stringify(captions)}`)
  report.check(icons.has('lucide-chevron-up') && icons.has('lucide-chevron-down'), 'both boundary icon branches must render')
  report.check(labels.has('load more') && labels.has('load the transcript'), 'both boundary load labels must render')
  for (const row of boundaryFixture.missing) {
    let thrown = null
    try {
      renderToStaticMarkup(React.createElement(TranscriptBoundary, row.props))
    } catch (error) {
      thrown = error
    }
    report.check(thrown instanceof TranscriptSegmentBoundaryError, `${row.name}: a missing boundary must throw TranscriptSegmentBoundaryError`)
    report.check(thrown?.name === 'TranscriptSegmentBoundaryError', `${row.name}: error name must be TranscriptSegmentBoundaryError, received ${thrown?.name}`)
    for (const phrase of ['boundary prop is missing', 'TranscriptSegmentBoundary', 'TranscriptBoundary.jsx', 'How to fix', 'SegmentBoundaryVM']) {
      report.check(String(thrown?.message ?? '').includes(phrase), `${row.name}: the error must say ${JSON.stringify(phrase)}`)
    }
    report.check(!String(thrown?.message ?? '').includes('Cannot read properties of undefined'), `${row.name}: the error must not be an opaque property read`)
  }
})

function dirSession() {
  return 'sess_segment_fixture'
}

report.finish(`${fixture.directories.length} directories, ${fixture.loadCases.length} load cases, ${fixture.windowCases.length} window cases, ${fixture.mountCases.length} mounted cases, and ${boundaryFixture.sides.length} boundary sides.`)
