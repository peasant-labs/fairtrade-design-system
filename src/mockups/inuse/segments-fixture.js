/* The segmented-transcript demo model.

   The driving app mounts the viewer exactly as a host does: a directory, the
   segments it has loaded, and a window descriptor when the reader jumps. Segments
   are cut from the same cooked reading session the other transcript demos use, on
   clean turn boundaries, so the demo exercises the real viewer contract without a
   second fixture language. */

import { adaptTranscript } from '../../ui/transcript/adapter.js'
import { readingPayload } from './reading-fixture.js'

const SEGMENT_TURNS = 10
const HALF_SPAN = 10

function approximateBytes(turns) {
  let bytes = 0
  for (const turn of turns) {
    bytes += (turn.content ?? '').length
    for (const call of turn.toolCalls ?? []) {
      bytes += (call.arguments ?? '').length + (call.result ?? '').length + (call.preview ?? '').length
    }
  }
  return bytes
}

/** Cut the cooked turns into segments of a few turns, then build the directory the
    host would receive. */
export function buildSegmentsModel() {
  const payload = readingPayload({ taskCount: 60 })
  const vm = adaptTranscript(payload)
  const turns = vm.turns
  const chunks = []
  for (let start = 0; start < turns.length; start += SEGMENT_TURNS) {
    chunks.push(turns.slice(start, start + SEGMENT_TURNS))
  }
  const segments = chunks.map((chunk, index) => ({
    index,
    firstTurn: chunk[0].index,
    lastTurn: chunk[chunk.length - 1].index,
    byteLength: approximateBytes(chunk),
    hasOlder: index > 0,
    hasNewer: index < chunks.length - 1,
    turns: chunk.map((turn) => ({ ...turn, segmentIndex: index })),
  }))
  const directory = {
    sessionId: 'reading-destinations',
    revision: '1',
    totalTurns: turns.length,
    totalSegments: segments.length,
    segments: segments.map(({ index, firstTurn, lastTurn, byteLength }) => ({ index, firstTurn, lastTurn, byteLength })),
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
