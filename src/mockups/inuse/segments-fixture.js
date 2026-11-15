/* The segmented-transcript demo models.

   The driving app mounts the viewer exactly as a host does: a directory, the
   segments it has loaded, and a window descriptor when the reader jumps. Segments
   are cut on clean turn boundaries, so the demo exercises the real viewer contract
   without a second fixture language. The demo stands in for the producer, so it
   also states each segment's place in the conversation turns and the session total,
   counted with the contract's own rule.

   Two models ship here:
     • the reading session, cut into small segments for ordinary browsing;
     • `buildLargeRunModel`, a session whose long model-action run carries more than
       1 MiB of served content and spans several segments. Its paging model has three
       segments, so loading the middle one shows both dotted boundaries and both
       `load more` controls in the first screen; its jump model has enough assistant
       turns on each side that a post-run user turn's window leaves unloaded
       segments before and after it. */

import { isConversationTurn } from '@peasant-labs/schema'
import { adaptTranscript } from '../../ui/transcript/adapter.js'
import { readingPayload } from './reading-fixture.js'

const SEGMENT_TURNS = 10
const HALF_SPAN = 10

function approximateBytes(turns) {
  let bytes = 0
  for (const turn of turns) {
    bytes += (turn.content ?? '').length
    for (const call of turn.toolCalls ?? []) {
      const args = typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.args ?? {})
      const output = typeof call.output === 'string' ? call.output : ''
      bytes += args.length + output.length + (call.preview ?? '').length
    }
  }
  return bytes
}

/** Build a directory and segments from explicit turn-identity ranges. */
function buildModel(payload, ranges) {
  const vm = adaptTranscript(payload)
  const turns = vm.turns
  const segments = ranges.map(([firstTurn, lastTurn], index) => {
    const segmentTurns = turns.filter((turn) => turn.index >= firstTurn && turn.index <= lastTurn).map((turn) => ({ ...turn, segmentIndex: index }))
    return {
      index,
      firstTurn,
      lastTurn,
      byteLength: approximateBytes(segmentTurns),
      hasOlder: index > 0,
      hasNewer: index < ranges.length - 1,
      turns: segmentTurns,
    }
  })
  /* The producer's running count: each ref states the conversation turns before it and
     the conversation turns it holds. */
  let before = 0
  const refs = segments.map(({ index, firstTurn, lastTurn, byteLength, turns: held }) => {
    const count = held.filter(isConversationTurn).length
    const ref = { index, firstTurn, lastTurn, byteLength, conversationTurns: { before, count } }
    before += count
    return ref
  })
  const directory = {
    sessionId: payload.id,
    revision: '1',
    totalTurns: turns.length,
    totalSegments: segments.length,
    totalConversationTurns: before,
    segments: refs,
  }

  /** The window read's descriptor: ten assistant turns per side, plus the anchor and
      every interleaved user or system turn, and the ordered segments that cover it. */
  function windowFor(anchor) {
    const position = turns.findIndex((turn) => turn.index === anchor)
    const at = position >= 0 ? position : turns.findIndex((turn) => turn.index >= anchor)
    let anchorPos = at >= 0 ? at : turns.length - 1
    if (turns[anchorPos]?.role !== 'user') {
      for (let index = anchorPos; index >= 0; index -= 1) {
        if (turns[index].role === 'user') { anchorPos = index; break }
      }
    }
    const requestedAnchor = anchor
    const anchorTurn = turns[anchorPos]?.index ?? turns[0].index
    let first = anchorPos
    let seen = 0
    for (let index = anchorPos - 1; index >= 0; index -= 1) {
      first = index
      if (turns[index].role === 'assistant') seen += 1
      if (seen === HALF_SPAN) break
    }
    let last = anchorPos
    seen = 0
    for (let index = anchorPos + 1; index < turns.length; index += 1) {
      last = index
      if (turns[index].role === 'assistant') seen += 1
      if (seen === HALF_SPAN) break
    }
    const firstTurn = turns[first].index
    const lastTurn = turns[last].index
    const covering = segments.filter((segment) => segment.lastTurn >= firstTurn && segment.firstTurn <= lastTurn).map((segment) => segment.index)
    return {
      sessionId: directory.sessionId,
      revision: directory.revision,
      requestedAnchor,
      anchorTurn,
      span: HALF_SPAN,
      firstTurn,
      lastTurn,
      segments: covering,
      hasOlder: first > 0,
      hasNewer: last < turns.length - 1,
    }
  }

  return { vm, directory, segments, windowFor }
}

/** The ordinary reading session, cut into small segments. */
export function buildSegmentsModel() {
  const payload = readingPayload({ taskCount: 60 })
  const vm = adaptTranscript(payload)
  const ranges = []
  for (let start = 0; start < vm.turns.length; start += SEGMENT_TURNS) {
    const chunk = vm.turns.slice(start, start + SEGMENT_TURNS)
    ranges.push([chunk[0].index, chunk[chunk.length - 1].index])
  }
  return buildModel(payload, ranges)
}

/* A deterministic large output. 33 bytes per line keeps the byte math legible:
   7000 lines is about 225 KiB, 2600 is about 84 KiB, and 1500 is about 48 KiB. */
const LINE = 'large run output line 0123456789\n'

function runCall(index, lines) {
  return {
    id: `large-run-${index}`,
    name: 'Bash',
    arguments: JSON.stringify({ command: `printf run-${index}` }),
    result: LINE.repeat(lines),
    durationMs: 1000,
    exitCode: 0,
  }
}

/**
 * A session with a long model-action run whose served content is over 1 MiB.
 *
 * `jump` builds the jump model: 14 large assistant turns before the post-run user
 * turn and 14 after it, across eleven segments, so that user turn's ±10-assistant
 * window leaves unloaded segments on both sides. Without `jump`, the paging model
 * has exactly three segments — the middle one is a short run of large tool calls,
 * so both boundaries and both controls fit on the first screen.
 */
export function buildLargeRunModel({ jump = false } = {}) {
  /** @type {any[]} */
  const turns = jump
    ? [
      { index: 0, role: 'user', entryType: 'text', content: 'open the large session' },
      { index: 1, role: 'assistant', entryType: 'text', content: 'a short response before the long run.' },
      ...Array.from({ length: 14 }, (_, offset) => ({ index: 2 + offset, role: 'assistant', entryType: 'tool_use', content: '', toolCalls: [runCall(2 + offset, 2600)] })),
      { index: 16, role: 'user', entryType: 'text', content: 'the follow-up request after the long run' },
      ...Array.from({ length: 14 }, (_, offset) => ({ index: 17 + offset, role: 'assistant', entryType: 'tool_use', content: '', toolCalls: [runCall(17 + offset, 1500)] })),
      { index: 31, role: 'user', entryType: 'text', content: 'a later request that keeps the tail unloaded' },
      { index: 32, role: 'assistant', entryType: 'text', content: 'a short tail response.' },
      { index: 33, role: 'assistant', entryType: 'text', content: 'another short tail response.' },
    ]
    : [
      { index: 0, role: 'user', entryType: 'text', content: 'open the large session' },
      { index: 1, role: 'assistant', entryType: 'text', content: 'a short response before the long run.' },
      ...Array.from({ length: 6 }, (_, offset) => ({ index: 2 + offset, role: 'assistant', entryType: 'tool_use', content: '', toolCalls: [runCall(2 + offset, 7000)] })),
      { index: 8, role: 'user', entryType: 'text', content: 'the follow-up request after the long run' },
    ]
  const payload = {
    id: jump ? 'large-run-jump' : 'large-run',
    title: 'a session with a long model-action run',
    harness: 'claude-code',
    // every row is a top-level entry, stated as the wire states it
    turns: turns.map((turn) => ({ depth: 0, ...turn })),
  }
  const ranges = jump
    ? [[0, 1], [2, 4], [5, 7], [8, 10], [11, 13], [14, 16], [17, 19], [20, 22], [23, 25], [26, 28], [29, 33]]
    : [[0, 1], [2, 4], [5, 8]]
  return buildModel(payload, ranges)
}
