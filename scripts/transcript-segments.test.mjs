#!/usr/bin/env node
/* Mounted + pure gate for the segmented transcript viewer.

   Fixtures describe directories by parameters (a 10,000-turn / 200-segment directory,
   the 32 MiB session's 1,312 turns in 32 segments, and a sparse 55-turn session), the
   loaded-segment combinations and their expected boundaries, the window descriptors a
   jump produces, the mounted card / truncation / continuation outcomes, and the
   directories that carry conversation-turn positions with the literal copy a reader
   sees for them (boundary captions, the header count, scrubber ticks, the slider's
   value text, the jump-failure sentence and the Files tab sentence). Everything
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
import { buildDirectory, buildPositionDirectory, makePositionSegments, makeSegment, makeSegments } from './transcript-segment-fixture.mjs'
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
  phaseCountCases: 'requiredPhaseCountCaseNames',
  recoveryCases: 'requiredRecoveryCaseNames',
  historyCases: 'requiredHistoryCaseNames',
  typeMutations: 'requiredTypeMutationNames',
  unknownHistoryInvalidCases: 'requiredUnknownHistoryInvalidNames',
  wordlessCases: 'requiredWordlessCaseNames',
  positionDirectories: 'requiredPositionDirectoryNames',
  positionCases: 'requiredPositionCaseNames',
  countCases: 'requiredCountCaseNames',
  heroCases: 'requiredHeroCaseNames',
})

for (const row of fixture.directories) assertFields(row, ['name', 'totalTurns', 'totalSegments', 'firstTurn', 'segmentTurns', 'segmentBytes'], `${FIXTURE} ${row.name}`)
for (const row of fixture.loadCases) assertFields(row, ['name', 'directory', 'loaded', 'expect'], `${FIXTURE} ${row.name}`)
for (const row of fixture.windowCases) assertFields(row, ['name', 'directory', 'loaded', 'window', 'expect'], `${FIXTURE} ${row.name}`)
for (const row of fixture.mountCases) assertFields(row, ['name', 'directory', 'loaded', 'expect'], `${FIXTURE} ${row.name}`, ['window', 'oversizedTurn', 'noLoader'])
for (const row of fixture.wordlessCases) assertFields(row, ['name', 'turn', 'wordless'], `${FIXTURE} ${row.name}`)
for (const row of fixture.phaseCases) assertFields(row, ['name', 'directory', 'loaded', 'phase', 'caption'], `${FIXTURE} ${row.name}`)
for (const row of fixture.phaseCountCases) assertFields(row, ['name', 'turns', 'expectedCount', 'expectedFrom', 'expectedTo'], `${FIXTURE} ${row.name}`)
for (const row of fixture.recoveryCases) assertFields(row, ['name', 'mode', 'directory', 'loaded', 'requests'], `${FIXTURE} ${row.name}`, ['window', 'restoredTurn', 'failureCopy', 'retryCopy'])
for (const row of fixture.historyCases) assertFields(row, ['name', 'state', 'label', 'explanation'], `${FIXTURE} ${row.name}`)
for (const row of fixture.positionDirectories) {
  assertFields(row, ['name', 'totalTurns', 'totalConversationTurns', 'segments'], `${FIXTURE} ${row.name}`, ['userTurns', 'systemTurns', 'toolTurns', 'thinkingTurns'])
  for (const segment of row.segments) {
    assertFields(segment, ['index', 'firstTurn', 'lastTurn', 'byteLength', 'conversationTurns'], `${FIXTURE} ${row.name} segment ${segment.index}`)
    assertFields(segment.conversationTurns, ['before', 'count'], `${FIXTURE} ${row.name} segment ${segment.index} span`)
  }
}
for (const row of fixture.positionCases) {
  assertFields(row, ['name', 'directory', 'loaded', 'expect'], `${FIXTURE} ${row.name}`, ['refs', 'withoutPositions', 'dropSpans', 'dropTurns', 'hiddenCategories', 'thenLoaded', 'jump'])
  assertFields(row.expect, ['header', 'captions', 'labels', 'filesScope'], `${FIXTURE} ${row.name} expect`, ['thenHeader', 'tickTitles', 'valueText', 'sliderAt', 'failure', 'loads', 'absent', 'silent'])
  if (('jump' in row) !== ('failure' in row.expect)) throw new Error(`${FIXTURE} ${row.name}: a jump and its failure copy are stated together`)
  if (('thenLoaded' in row) !== ('thenHeader' in row.expect)) throw new Error(`${FIXTURE} ${row.name}: a second load and its header are stated together`)
}
for (const row of fixture.countCases) assertFields(row, ['name', 'turns', 'header'], `${FIXTURE} ${row.name}`)
for (const row of fixture.heroCases) assertFields(row, ['name', 'turnCount', 'hero'], `${FIXTURE} ${row.name}`, ['conversationTurnCount'])
for (const [key, family] of [['heldWindow', fixture.mountCases], ['failedWindow', fixture.recoveryCases], ['phase', fixture.phaseCases], ['positions', fixture.positionCases]]) {
  if (!family.some(row => row.name === fixture.vitestSelection[key])) throw new Error(`${FIXTURE}: selected ${key} case must exist`)
}

const DIRECTORY = new Map(fixture.directories.map((row) => [row.name, row]))
const POSITION_DIRECTORY = new Map(fixture.positionDirectories.map((row) => [row.name, row]))
for (const row of fixture.positionCases) {
  if (!POSITION_DIRECTORY.has(row.directory)) throw new Error(`${FIXTURE} ${row.name}: unknown position directory ${row.directory}`)
}

const report = createReport('transcript segments')

/* ── the inequality ─────────────────────────────────────────────────────────────
   No surface may name a conversation turn past the session total. The check parses
   what a reader is shown: the header's total, and the upper bound of every range a
   caption, tick, slider or alert names. It is a comparison, never a string match. */
const integer = (digits) => Number(digits.replaceAll(',', ''))
function headerTotal(header) {
  const match = /(\d[\d,]*) turns?$/.exec(header)
  return match ? integer(match[1]) : null
}
function namedUpperBounds(copy) {
  return [...copy.matchAll(/\bturns? (\d[\d,]*)(?:–(\d[\d,]*))?/g)].map((match) => integer(match[2] ?? match[1]))
}
function checkWithinTotal(label, header, copies) {
  const total = headerTotal(header)
  report.check(total != null, `${label}: the header ${JSON.stringify(header)} must state a total`)
  for (const copy of copies) {
    for (const upper of namedUpperBounds(copy)) {
      report.check(upper <= total, `${label}: ${JSON.stringify(copy)} names turn ${upper}, past the header total ${total}`)
    }
  }
}

/* ── positions in the loaded-region model ───────────────────────────────────── */
for (const row of fixture.positionCases) {
  const def = POSITION_DIRECTORY.get(row.directory)
  const directory = buildPositionDirectory(def, row)
  for (const loaded of [row.loaded, row.thenLoaded].filter(Boolean)) {
    const regions = loadedRegions(directory, makePositionSegments(def, loaded, row))
    const boundaries = regionBoundaries(directory, regions)
    for (const boundary of boundaries) {
      if (row.withoutPositions) report.check(boundary.position === null, `${row.name}: a directory without positions gives its boundaries none`)
      if (boundary.position) report.check(boundary.position.before + boundary.position.count <= def.totalConversationTurns, `${row.name}: model boundary ${boundary.key} ends at ${boundary.position.before + boundary.position.count}, past the total ${def.totalConversationTurns}`)
    }
    for (const tick of scrubberTicks(directory)) {
      if (row.withoutPositions) report.check(tick.position === null, `${row.name}: a directory without positions gives its ticks none`)
      if (tick.position) report.check(tick.position.before + tick.position.count <= def.totalConversationTurns, `${row.name}: model tick ${tick.key} ends at ${tick.position.before + tick.position.count}, past the total ${def.totalConversationTurns}`)
    }
    const captions = boundaries.map(boundaryCaption)
    if (loaded === row.loaded) report.check(JSON.stringify(captions) === JSON.stringify(row.expect.captions), `${row.name}: model captions ${JSON.stringify(captions)} must equal ${JSON.stringify(row.expect.captions)}`)
  }
}

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
  const { detectPhases } = await load('/src/ui/transcript/analytics.js')
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { ALL_EARLIER_HISTORY_STATES, EarlierHistoryState } = await load('/src/ui/transcript/earlier-history-state.js')
  report.check(JSON.stringify(ALL_EARLIER_HISTORY_STATES) === JSON.stringify(Object.values(EarlierHistoryState)), 'history state inventory contains every member')

  for (const row of fixture.historyCases) {
    const payload = { ...fixture.historyPayload, earlierHistory: [{ state: row.state, turns: [] }] }
    const cooked = adaptTranscript(payload)
    report.check(cooked.earlierHistory[0].state.wire === row.state, `${row.name}: wire state is preserved`)
    report.check(Object.isFrozen(cooked.earlierHistory[0].state), `${row.name}: state is immutable`)
    const mounted = await mount(React.createElement(TranscriptViewer, { viewModel: cooked, capabilities: CAPABILITIES, earlierHistoryOpen: { [cooked.earlierHistory[0].id]: true } }))
    report.check(text(mounted.container.querySelector('.txn-earlier .txn-context-status')) === row.label, `${row.name}: mounted history label`)
    report.check(text(mounted.container.querySelector('.txn-earlier .txn-context-note')) === row.explanation, `${row.name}: mounted history explanation`)
    await mounted.unmount()
  }
  for (const row of fixture.unknownHistoryInvalidCases) {
    let refused = false
    try { adaptTranscript({ ...fixture.historyPayload, earlierHistory: [row.section] }) } catch { refused = true }
    report.check(refused, `${row.name}: canonical evidence validation still refuses the payload`)
  }

  for (const row of fixture.phaseCountCases) {
    const phase = detectPhases(row.turns)[0]
    report.check(phase?.turnCount === row.expectedCount, `${row.name}: phase count must equal ${row.expectedCount}`)
    report.check(phase?.from === row.expectedFrom && phase?.to === row.expectedTo, `${row.name}: phase retains its source indexes`)
  }

  const { isWordlessAssistant } = await load('/src/ui/transcript/segments.js')
  for (const row of fixture.wordlessCases) {
    const wordless = isWordlessAssistant(row.turn)
    report.check(wordless === row.wordless, `${row.name}: an image is content, not an action continuation`)
  }

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
    if (row.phase.turnCount != null) report.check(/^\d[\d,]* turns?(?:, \d[\d,]* error)?$/.test(caption), `${row.name}: phase caption must be a turn count`)
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
      onLoadSegment: row.noLoader ? undefined : (index) => requests.push(index),
      onLoadWindow: () => {},
    }))
    await mounted.settle()
    const stream = mounted.container.querySelector('.txn-stream')
    const headerCounts = mounted.container.querySelectorAll('.txn-trace-count')
    report.check(headerCounts.length === 1 && /\b\d[\d,]*(?: of \d[\d,]*)? turns?\b/.test(text(headerCounts[0])), `${row.name}: the transcript has one turn-count header`)
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
    if (loadControl && expectedBoundaries[0] && !row.noLoader) {
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

  /* positions: the copy a reader sees, and the inequality over all of it */
  const { DEFAULT_TRANSCRIPT_FILTERS } = await load('/src/ui/transcript/filters.js')
  const { default: Scrubber } = await load('/src/ui/transcript/Scrubber.jsx')
  for (const row of fixture.positionCases) {
    const def = POSITION_DIRECTORY.get(row.directory)
    const directory = buildPositionDirectory(def, row)
    const requests = []
    const noise = []
    const saved = { warn: console.warn, error: console.error }
    /* record and forward: the report's own failure output still reaches the terminal */
    console.warn = (...args) => { noise.push(args.join(' ')); saved.warn(...args) }
    console.error = (...args) => { noise.push(args.join(' ')); saved.error(...args) }
    const categories = { ...DEFAULT_TRANSCRIPT_FILTERS.categories }
    for (const category of row.hiddenCategories ?? []) categories[category] = false
    const props = (loaded) => ({
      directory,
      segments: makePositionSegments(def, loaded, row),
      filters: { ...DEFAULT_TRANSCRIPT_FILTERS, categories },
      onFiltersChange: () => {},
      onLoadSegment: (index) => { requests.push(index) },
      onLoadWindow: row.jump ? () => Promise.reject(new Error('failed window request')) : () => {},
      initialPosition: row.jump ? { kind: 'turn', turnIndex: row.jump.turn } : undefined,
    })
    let mounted
    try {
      mounted = await mount(viewer(props(row.loaded)))
      await mounted.settle()
      const stream = mounted.container.querySelector('.txn-stream')
      const header = text(mounted.container.querySelector('.txn-trace-count'))
      report.check(header === row.expect.header, `${row.name}: header ${JSON.stringify(header)} must equal ${JSON.stringify(row.expect.header)}`)
      const boundaryNodes = [...mounted.container.querySelectorAll('[data-segment-boundary]')]
      const captions = boundaryNodes.map((node) => text(node.querySelector('.txn-segboundary-caption')))
      report.check(JSON.stringify(captions) === JSON.stringify(row.expect.captions), `${row.name}: boundary captions ${JSON.stringify(captions)} must equal ${JSON.stringify(row.expect.captions)}`)
      const labels = boundaryNodes.map((node) => node.querySelector('.txn-segboundary-load')?.getAttribute('aria-label'))
      report.check(JSON.stringify(labels) === JSON.stringify(row.expect.labels), `${row.name}: boundary labels ${JSON.stringify(labels)} must equal ${JSON.stringify(row.expect.labels)}`)
      const copies = [...captions, ...labels]
      let failure = null
      if (row.jump) {
        failure = text(mounted.container.querySelector('.txn-held-window[role="alert"] span'))
        report.check(failure === row.expect.failure, `${row.name}: jump failure ${JSON.stringify(failure)} must equal ${JSON.stringify(row.expect.failure)}`)
        copies.push(failure)
      }
      /* the pinned header carries the scrubber once the reader has scrolled */
      await mounted.act(() => {
        stream.scrollTop = 200
        stream.dispatchEvent(new window.Event('scroll', { bubbles: true }))
      })
      await mounted.settle()
      const scrubber = mounted.container.querySelector('.txn-scrub')
      const tickTitles = [...mounted.container.querySelectorAll('.txn-scrub-segment-tick')].map((node) => node.getAttribute('title'))
      const valueText = scrubber?.getAttribute('aria-valuetext') ?? null
      report.check(tickTitles.length > 0 && valueText != null, `${row.name}: the scrubber must be mounted with its ticks`)
      if (row.expect.tickTitles) report.check(JSON.stringify(tickTitles) === JSON.stringify(row.expect.tickTitles), `${row.name}: tick titles ${JSON.stringify(tickTitles)} must equal ${JSON.stringify(row.expect.tickTitles)}`)
      if (row.expect.valueText) report.check(valueText === row.expect.valueText, `${row.name}: slider value text ${JSON.stringify(valueText)} must equal ${JSON.stringify(row.expect.valueText)}`)
      copies.push(...tickTitles, valueText ?? '')
      /* the slider with a stated segment active: the production scrubber over the same sample */
      if (row.expect.sliderAt) {
        const slider = await mount(React.createElement(Scrubber, { ticks: scrubberTicks(directory), activeTick: row.expect.sliderAt.segment }))
        const sliderText = slider.container.querySelector('.txn-scrub')?.getAttribute('aria-valuetext')
        report.check(sliderText === row.expect.sliderAt.valueText, `${row.name}: slider value text at segment ${row.expect.sliderAt.segment} ${JSON.stringify(sliderText)} must equal ${JSON.stringify(row.expect.sliderAt.valueText)}`)
        copies.push(sliderText ?? '')
        await slider.unmount()
      }
      checkWithinTotal(row.name, header, copies)
      for (const number of row.expect.absent ?? []) {
        report.check(![header, ...copies].some((copy) => new RegExp(`(?<![\\d,])${number}(?![\\d,])`).test(copy)), `${row.name}: no surface may print ${number}`)
      }
      if (row.expect.loads != null) {
        await mounted.act(() => click(window, boundaryNodes[0].querySelector('.txn-segboundary-load')))
        report.check(requests[requests.length - 1] === row.expect.loads, `${row.name}: the control loads segment ${row.expect.loads}, received ${JSON.stringify(requests)}`)
      }
      const filesTab = [...mounted.container.querySelectorAll('[role="tab"]')].find((node) => text(node).startsWith('files'))
      await mounted.act(() => click(window, filesTab))
      await mounted.settle()
      const scopeLine = text(mounted.container.querySelector('.txn-files .txn-scope'))
      report.check(scopeLine === `${row.expect.filesScope}. a file that appears only in an unloaded segment is not listed.`, `${row.name}: files sentence ${JSON.stringify(scopeLine)} must start ${JSON.stringify(row.expect.filesScope)}`)
      checkWithinTotal(`${row.name} files sentence`, header, row.withoutPositions ? [] : [scopeLine.replace(/^derived from (?:all )?/, 'turn ')])
      if (row.thenLoaded) {
        const traceTab = [...mounted.container.querySelectorAll('[role="tab"]')].find((node) => text(node).startsWith('full trace'))
        await mounted.act(() => click(window, traceTab))
        await mounted.rerender(viewer(props(row.thenLoaded)))
        await mounted.settle()
        const then = text(mounted.container.querySelector('.txn-trace-count'))
        report.check(then === row.expect.thenHeader, `${row.name}: header after loading ${JSON.stringify(then)} must equal ${JSON.stringify(row.expect.thenHeader)}`)
        report.check(headerTotal(then) === headerTotal(header), `${row.name}: the header total must not change while segments load`)
      }
      if (row.expect.silent) report.check(noise.length === 0, `${row.name}: absent position fields must not log or warn, received ${JSON.stringify(noise)}`)
    } finally {
      console.warn = saved.warn
      console.error = saved.error
      if (mounted) await mounted.unmount()
    }
  }

  /* a whole transcript: the header counts the conversation turns it holds */
  for (const row of fixture.countCases) {
    const turns = row.turns.map(({ tool, ...turn }) => ({
      label: String(turn.index), annotations: [], identity: `main:${turn.index}`, sourceIndexUnique: true,
      toolCalls: tool ? [{ id: `call-${turn.index}`, name: 'Read', group: 'read', filePath: '/src/file.js', sourceIndex: 0, sourceIdUnique: true }] : [],
      ...turn,
    }))
    const mounted = await mount(React.createElement(TranscriptViewer, { viewModel: viewModel([], { turns }), capabilities: CAPABILITIES, presentation: 'ledger' }))
    await mounted.settle()
    const header = text(mounted.container.querySelector('.txn-trace-count'))
    report.check(header === row.header, `${row.name}: header ${JSON.stringify(header)} must equal ${JSON.stringify(row.header)}`)
    await mounted.unmount()
  }

  /* the hero prints the conversation count, and the folded count only without one */
  for (const row of fixture.heroCases) {
    const payload = { ...fixture.historyPayload, turnCount: row.turnCount }
    if (row.conversationTurnCount != null) payload.conversationTurnCount = row.conversationTurnCount
    const cooked = adaptTranscript(payload)
    report.check(cooked.session.conversationTurnCount === row.conversationTurnCount, `${row.name}: the adapter carries conversationTurnCount ${row.conversationTurnCount}`)
    const mounted = await mount(React.createElement(TranscriptViewer, { viewModel: cooked, capabilities: CAPABILITIES }))
    await mounted.settle()
    const hero = [...mounted.container.querySelectorAll('.txn-meta .metaitem')].map(text).filter((item) => /\bturns$/.test(item))
    report.check(JSON.stringify(hero) === JSON.stringify([row.hero]), `${row.name}: hero ${JSON.stringify(hero)} must equal ${JSON.stringify([row.hero])}`)
    await mounted.unmount()
  }

  for (const row of fixture.recoveryCases) {
    const def = DIRECTORY.get(row.directory)
    const directory = buildDirectory(def)
    const requests = []
    if (row.failureCopy) {
      const segments = makeSegments(def, row.loaded)
      const descriptor = { sessionId: dirSession(), revision: '7', ...row.window }
      let attempts = 0
      const onLoadSegment = (index) => {
        if (row.mode === 'host-segment-only') { requests.push(index); return }
        if (row.mode !== 'covering-rejected') return
        requests.push(index)
        if (++attempts === 1) return Promise.reject(new Error('failed covering segment'))
      }
      const onLoadWindow = (anchor) => {
        requests.push(anchor)
        if (row.mode === 'window-rejected' && ++attempts === 1) return Promise.reject(new Error('failed window request'))
      }
      const props = { directory, segments, onLoadSegment, onLoadWindow: row.mode === 'host-segment-only' ? undefined : onLoadWindow }
      const initial = row.mode === 'window-rejected' ? { initialPosition: { kind: 'turn', turnIndex: row.window.anchorTurn } } : { window: descriptor }
      const mounted = await mount(viewer({ ...props, ...initial }))
      await mounted.settle()
      if (row.mode === 'host-reported' || row.mode === 'host-segment-only') {
        await mounted.rerender(viewer({ ...props, window: null }))
        await mounted.settle()
      }
      const failure = mounted.container.querySelector('.txn-held-window[role="alert"]')
      report.check(!!failure && text(failure).includes(row.failureCopy), `${row.name}: rejection or host failure must be visible, not silently dropped`)
      const retry = failure?.querySelector('button')
      report.check(text(retry) === row.retryCopy, `${row.name}: failure offers retry`)
      if (row.mode !== 'window-rejected') {
        report.check(!!mounted.container.querySelector(`#turn-${row.restoredTurn}`), `${row.name}: failure restores held turns`)
        report.check(!!mounted.container.querySelector('[data-segment-boundary]'), `${row.name}: failure retains a boundary`)
      }
      if (retry) await mounted.act(() => click(window, retry))
      await mounted.settle()
      report.check(JSON.stringify(requests) === JSON.stringify(row.requests), `${row.name}: retry invokes the same loader`)
      await mounted.rerender(viewer({ ...props, window: descriptor, segments: makeSegments(def, [0, 1, 2, 3]) }))
      await mounted.settle()
      report.check(!!mounted.container.querySelector(`#turn-${row.window.anchorTurn}`), `${row.name}: successful retry renders the window`)
      report.check(!mounted.container.querySelector('.txn-held-window[role="alert"]'), `${row.name}: success clears the failure`)
      await mounted.unmount()
      continue
    }
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

report.finish(`${fixture.directories.length} directories, ${fixture.positionDirectories.length} position directories, ${fixture.positionCases.length} position cases, ${fixture.loadCases.length} load cases, ${fixture.windowCases.length} window cases, ${fixture.mountCases.length} mounted cases, ${fixture.wordlessCases.length} wordless cases, and ${boundaryFixture.sides.length} boundary sides.`)
