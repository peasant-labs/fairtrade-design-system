/* The positioned-reader demo's mock transport.

   It stands in for a host: it answers the five positioned reads with bodies a server would send and
   runs the real reader (`usePositionedTranscript`) and the real segment adapter over them. Every body
   is built once, at construction, and every one must pass Schema's z* parsers and the shared
   directory-position rule; the first refusal throws, so the demo refuses to start on a body a real
   client would discard. It creates no service and no file.

   The demo stands in for the producer, so it numbers its rows with the whole-document rule the
   server's cook reproduces (`computeTurnLabels`), once, over the whole partition. */

import {
  TranscriptSegmentPartitionKind,
  isConversationTurn,
  isPositionedDirectoryPositionsValid,
  zPositionedDirectory,
  zPositionedSegment,
  zPositionedWindow,
  zTranscriptContentHeader,
} from '@peasant-labs/schema'
import { computeTurnLabels } from '../../ui/transcript/analytics.js'

const TRANSCRIPT_ID = '0b9a3e7c-5d41-4c1f-9a7e-2f6b8c1d4e50'
const ROWS_PER_SEGMENT = 6
const SEGMENTS = 12
const START = Date.parse('2026-11-12T09:00:00Z')

/** The demo scenarios, one per mounted state. */
export const PositionedDemoScenario = Object.freeze({
  Open: 'open', Far: 'far', History: 'history', NoNumber: 'nonumber', Busy: 'busy', Stale: 'stale',
  Denied: 'denied', Unavailable: 'unavailable', Failed: 'failed', Malformed: 'malformed', Network: 'network',
})
export const POSITIONED_DEMO_SCENARIOS = Object.freeze(Object.values(PositionedDemoScenario))

const FILES = ['src/reader/fetch-set.js', 'src/reader/eviction.js', 'src/reader/landing.js', 'docs/reading.md', 'src/reader/history.js', 'src/reader/usage.js']
const PROMPTS = [
  'Open the reader at the deep link and check which segments it asks for.',
  'Why does the boundary between the two runs say six segments?',
  'Make the history section show its recorded count while it is closed.',
  'Check that a refetched segment keeps its numbers after eviction.',
  'Read the landing rule again and compare it with the window answer.',
  'Summarise what changed in the fetch set and why.',
]

/** One task: a prompt, a tool call, a reply, a follow-up tool call, a reply and a closing note. */
function taskTurns(task, firstIndex) {
  const at = (offset) => new Date(START + (firstIndex + offset) * 47_000).toISOString()
  const file = FILES[task % FILES.length]
  const read = (id, path) => ({ id, name: 'Read', arguments: JSON.stringify({ file_path: path }), result: `// ${path}\nexport const step = ${task}\n` })
  return [
    { index: firstIndex, role: 'user', depth: 0, entryType: 'text', content: PROMPTS[task % PROMPTS.length], timestamp: at(0) },
    { index: firstIndex + 1, role: 'assistant', depth: 0, entryType: 'text', content: `Reading \`${file}\` first.`, timestamp: at(1), toolCalls: [read(`call-${task}-a`, file)] },
    { index: firstIndex + 2, role: 'assistant', depth: 0, entryType: 'text', content: `The window names its own run, so the reader asks for exactly those segments and nothing between them. Task ${task + 1} keeps that rule.`, timestamp: at(2) },
    { index: firstIndex + 3, role: 'assistant', depth: 0, entryType: 'text', content: 'Checking the test that pins it.', timestamp: at(3), toolCalls: [read(`call-${task}-b`, `scripts/${file.split('/').pop()}`)] },
    { index: firstIndex + 4, role: 'assistant', depth: 0, entryType: 'text', content: 'The case fails when a segment between the runs is requested, which is the point.', timestamp: at(4) },
    { index: firstIndex + 5, role: 'assistant', depth: 0, entryType: 'text', content: `Done with task ${task + 1}.`, timestamp: at(5) },
  ]
}

function context(totals, overrides = {}) {
  return {
    protocolVersion: '0.2.0',
    representation: 'r1',
    revision: '3',
    harness: 'claude-code',
    model: 'claude-opus-4-5',
    nativePresence: 'absent',
    validation: 'published_strict',
    transport: { kind: 'village_transcript', transcriptId: TRANSCRIPT_ID },
    ...totals,
    ...overrides,
  }
}

/** Parse with the real parser or refuse to start, naming the body. */
function mustParse(parser, body, name) {
  const parsed = parser.safeParse(body)
  if (!parsed.success) {
    throw new TypeError(`The positioned demo refused to start: its ${name} body is not one Schema's parser accepts (${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}). Fix the mock body in src/mockups/inuse/positioned-fixture.js so it is a body a real server could send.`)
  }
  return parsed.data
}

/** Build one partition's turns, rows and segment bodies. */
function buildPartition({ tasks, segmentRows, partition, contextFor, drop }) {
  const turns = []
  for (let task = 0; task < tasks; task += 1) turns.push(...taskTurns(task, turns.length))
  const labels = computeTurnLabels(turns)
  const rows = turns.map((turn, position) => {
    const row = { position, recordedIndex: turn.index, recordedIndexState: 'present', displayNumber: labels[position], turn }
    if (drop?.(position)) delete row.displayNumber
    return row
  })
  const segments = []
  for (let index = 0; index * segmentRows < rows.length; index += 1) {
    const slice = rows.slice(index * segmentRows, (index + 1) * segmentRows)
    segments.push({
      index,
      rows: slice,
      byteLength: JSON.stringify(slice).length,
      hasOlder: index > 0,
      hasNewer: (index + 1) * segmentRows < rows.length,
      partition,
    })
  }
  let before = 0
  const refs = segments.map((segment) => {
    const count = segment.rows.filter((row) => isConversationTurn(row.turn)).length
    const ref = {
      index: segment.index,
      byteLength: segment.byteLength,
      sourceFirstPosition: segment.rows[0].position,
      sourceLastPosition: segment.rows[segment.rows.length - 1].position,
      conversationTurns: { before, count },
    }
    before += count
    return ref
  })
  const totals = { totalTurns: rows.length, totalSegments: segments.length, totalConversationTurns: before }
  return { turns, rows, segments, refs, totals, ctx: contextFor(totals) }
}

/**
 * Build every body for one scenario and the transport that serves them.
 * @param {string} scenario one of POSITIONED_DEMO_SCENARIOS
 * @param {{ delayMs?: number, mutateBody?: (name: string, body: object) => object }} [options]
 */
export function buildPositionedDemo(scenario = 'open', { delayMs = 30, mutateBody } = {}) {
  const main = buildPartition({
    tasks: SEGMENTS,
    segmentRows: ROWS_PER_SEGMENT,
    partition: { kind: 'main' },
    contextFor: (totals) => context(totals),
    drop: scenario === PositionedDemoScenario.NoNumber ? (position) => position === 2 : undefined,
  })
  const history = buildPartition({
    tasks: 1,
    segmentRows: ROWS_PER_SEGMENT,
    partition: { kind: 'history', sectionIndex: 0 },
    contextFor: (totals) => context(totals),
  })
  const check = (parser, body, name) => mustParse(parser, mutateBody ? mutateBody(name, body) : body, name)

  const header = check(zTranscriptContentHeader, {
    contractVersion: '0.58.1',
    kind: 'session_detail',
    revision: '3',
    representation: 'r1',
    canonical: true,
    omittedImages: 0,
    sessionHeader: {
      id: 'demo-positioned-reader',
      project: 'fairtrade-design-system',
      harness: 'claude-code',
      model: 'claude-opus-4-5',
      startTime: new Date(START).toISOString(),
      endTime: new Date(START + main.rows.length * 47_000).toISOString(),
      durationMins: Math.round((main.rows.length * 47) / 60),
      turnCount: main.rows.length,
      conversationTurnCount: main.totals.totalConversationTurns,
      toolCallCount: SEGMENTS * 2,
    },
  }, 'header')

  const mainDirectory = check(zPositionedDirectory, {
    context: main.ctx,
    partition: { kind: 'main' },
    segments: main.refs,
    usagePresent: 'empty',
    history: [{ index: 0, state: 'uncertain_migrated', totalTurns: history.totals.totalTurns, totalConversationTurns: history.totals.totalConversationTurns, usagePresent: 'unknown' }],
  }, 'main directory')
  if (!isPositionedDirectoryPositionsValid(mainDirectory)) throw new TypeError('The positioned demo refused to start: its main directory breaks the shared conversation-position rule. Fix the counts in src/mockups/inuse/positioned-fixture.js.')
  const historyDirectory = check(zPositionedDirectory, {
    context: history.ctx,
    partition: { kind: 'history', sectionIndex: 0 },
    segments: history.refs,
    usagePresent: 'unknown',
  }, 'history directory')
  if (!isPositionedDirectoryPositionsValid(historyDirectory)) throw new TypeError('The positioned demo refused to start: its history directory breaks the shared conversation-position rule. Fix the counts in src/mockups/inuse/positioned-fixture.js.')

  const segmentBody = (partition, segment) => check(zPositionedSegment, { ...segment, context: partition.ctx }, `segment ${segment.partition.kind} ${segment.index}`)
  const mainSegments = main.segments.map((segment) => segmentBody(main, segment))
  const historySegments = history.segments.map((segment) => segmentBody(history, segment))

  /** A window over one partition: anchored at a recorded index, or the default open. */
  const windowBody = (partition, partitionValue, turn) => {
    const requested = turn === undefined ? undefined : partition.rows.find((row) => row.recordedIndex === turn)
    const anchorRow = requested ?? partition.rows[0]
    const anchorSegment = Math.floor(anchorRow.position / ROWS_PER_SEGMENT)
    const run = turn === undefined ? [anchorSegment] : [anchorSegment, Math.min(anchorSegment + 1, partition.segments.length - 1)].filter((value, index, list) => list.indexOf(value) === index)
    return check(zPositionedWindow, {
      context: partition.ctx,
      partition: partitionValue,
      anchorPosition: anchorRow.position,
      anchorSegment,
      anchorTurn: anchorRow.recordedIndex,
      ...(turn === undefined ? {} : { requestedAnchor: turn, ...(requested ? { requestedPosition: requested.position } : {}) }),
      firstPosition: partition.segments[run[0]].rows[0].position,
      lastPosition: partition.segments[run[run.length - 1]].rows.at(-1).position,
      segments: run,
      span: 10,
      hasOlder: run[0] > 0,
      hasNewer: run[run.length - 1] < partition.segments.length - 1,
    }, `window ${partitionValue.kind}`)
  }
  const defaultWindow = windowBody(main, { kind: 'main' })
  const historyWindow = windowBody(history, { kind: 'history', sectionIndex: 0 })
  /* every anchored window the demo can answer, built now so each passes the parser before start */
  const targetWindows = new Map(main.rows.map((row) => [row.recordedIndex, windowBody(main, { kind: 'main' }, row.recordedIndex)]))

  /* a body whose context names another transcript: it parses, and the reader must discard it */
  const foreignSegment = check(zPositionedSegment, { ...main.segments[1], context: context(main.totals, { transport: { kind: 'village_transcript', transcriptId: '7f3d2c1b-0a9e-4d8c-b7a6-5e4f3d2c1b0a' } }) }, 'foreign segment')

  const attempts = new Map()
  const first = (key) => {
    const count = (attempts.get(key) ?? 0) + 1
    attempts.set(key, count)
    return count === 1
  }
  const answer = (value) => new Promise((resolve) => setTimeout(() => resolve(value), delayMs))
  const ok = (body) => answer({ status: 200, body })
  const isHistory = (request) => request?.partition?.kind === TranscriptSegmentPartitionKind.History

  /** The scenario's refusal for one segment read, or null to answer it. Segment 1 is the one the
      failing scenarios refuse, so the opening run paints before the notice. */
  const segmentRefusal = (request) => {
    if (isHistory(request) || request.index !== 1) return null
    switch (scenario) {
      case PositionedDemoScenario.Busy: return { status: 503, retryAfterSeconds: 30, body: null }
      case PositionedDemoScenario.Stale: return { status: 409, body: null }
      case PositionedDemoScenario.Failed: return first('failed') ? { status: 500, body: null } : null
      case PositionedDemoScenario.Malformed: return first('malformed') ? { status: 200, body: foreignSegment } : null
      default: return null
    }
  }

  const transport = {
    header: () => ok(header),
    directory(request) {
      if (scenario === PositionedDemoScenario.Denied) return answer({ status: 404, body: null })
      if (scenario === PositionedDemoScenario.Unavailable) return answer({ status: 410, body: null })
      return ok(isHistory(request) ? historyDirectory : mainDirectory)
    },
    window(request) {
      if (isHistory(request)) return ok(historyWindow)
      if (request.turn === undefined) return ok(defaultWindow)
      const window = targetWindows.get(request.turn)
      return window ? ok(window) : answer({ status: 400, body: null })
    },
    segment(request) {
      if (scenario === PositionedDemoScenario.Network && request.index === 1 && first('network')) return new Promise((_, reject) => setTimeout(() => reject(new TypeError('Failed to fetch')), delayMs))
      const refusal = segmentRefusal(request)
      if (refusal) return answer(refusal)
      const list = isHistory(request) ? historySegments : mainSegments
      const body = list[request.index]
      return body ? ok(body) : answer({ status: 404, body: null })
    },
  }

  /* the default open's run is segment 0; the other scenarios read a run that includes segment 1 */
  const farTurn = main.rows[(SEGMENTS - 2) * ROWS_PER_SEGMENT + 2].recordedIndex
  const failingTurn = main.rows[ROWS_PER_SEGMENT].recordedIndex
  const failing = [PositionedDemoScenario.Busy, PositionedDemoScenario.Stale, PositionedDemoScenario.Failed, PositionedDemoScenario.Malformed, PositionedDemoScenario.Network]
  const deepLink = scenario === PositionedDemoScenario.Far ? farTurn : failing.includes(scenario) ? failingTurn : undefined
  return {
    transport,
    target: { transport: { kind: 'village_transcript', transcriptId: TRANSCRIPT_ID }, ...(deepLink === undefined ? {} : { turn: deepLink }) },
    openHistory: scenario === PositionedDemoScenario.History,
  }
}
