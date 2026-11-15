/* Shared construction for the parameterised segment fixtures. */
export function buildDirectory(def) {
  const refs = []
  let first = def.firstTurn
  const lastTurn = def.firstTurn + def.totalTurns - 1
  for (let index = 0; index < def.totalSegments; index += 1) {
    const last = Math.min(lastTurn, first + def.segmentTurns - 1)
    refs.push({ index, firstTurn: first, lastTurn: last, byteLength: def.segmentBytes })
    first = last + 1
  }
  return { sessionId: 'sess_segment_fixture', revision: '7', totalTurns: def.totalTurns, totalSegments: def.totalSegments, segments: refs }
}

const roleFor = (index) => (index % 6 === 0 ? 'user' : index % 7 === 0 ? 'system' : 'assistant')

export function makeTurn(index) {
  const role = roleFor(index)
  const turn = { index, role, label: String(index), depth: 0, content: '', annotations: [], identity: `main:${index}`, sourceIndexUnique: true }
  if (role === 'user') { turn.content = `request ${index}`; turn.entryType = 'text' }
  else if (role === 'system') turn.content = `system note ${index}`
  else {
    turn.entryType = 'tool_use'
    turn.toolCalls = [{ id: `call-${index}`, name: 'Read', group: 'read', filePath: `/src/file-${index % 3}.js`, sourceIndex: 0, sourceIdUnique: true }]
  }
  return turn
}

export function makeSegment(directory, def, index, oversizedTurn) {
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
  return { index, firstTurn: ref.firstTurn, lastTurn: ref.lastTurn, byteLength: ref.byteLength, hasOlder: index > 0, hasNewer: index < def.totalSegments - 1, turns }
}

export function makeSegments(def, indexes, oversizedTurn) {
  const directory = buildDirectory(def)
  return indexes.map((index) => makeSegment(directory, def, index, oversizedTurn))
}

/* ── directories that carry conversation-turn positions ─────────────────────────
   A position directory names every ref and its span as literals, and names every row
   that is not a plain assistant reply: `userTurns` are prompts, `systemTurns` are
   harness notices, `toolTurns` are assistant rows that hold only a tool call and
   `thinkingTurns` hold only thinking. Nothing here computes a span or a total: the
   fixture states them, as a producer would send them. */
const positionRef = ({ index, firstTurn, lastTurn, byteLength, conversationTurns }) => ({
  index, firstTurn, lastTurn, byteLength, ...(conversationTurns ? { conversationTurns: { ...conversationTurns } } : {}),
})

/** The directory a host passes. `refs` keeps one received page; `withoutPositions`
    is an older server; `dropSpans` removes single spans. */
export function buildPositionDirectory(def, { refs, withoutPositions = false, dropSpans = [] } = {}) {
  const segments = def.segments
    .filter((segment) => !refs || refs.includes(segment.index))
    .map((segment) => {
      const ref = positionRef(segment)
      if (withoutPositions || dropSpans.includes(segment.index)) delete ref.conversationTurns
      return ref
    })
  const directory = { sessionId: 'sess_segment_fixture', revision: '7', totalTurns: def.totalTurns, totalSegments: def.segments.length, segments }
  if (!withoutPositions) directory.totalConversationTurns = def.totalConversationTurns
  return directory
}

export function makePositionTurn(def, index) {
  const turn = { index, role: 'assistant', entryType: 'text', label: String(index), depth: 0, content: `reply ${index}`, toolCalls: [], annotations: [], identity: `main:${index}`, sourceIndexUnique: true }
  if ((def.userTurns ?? []).includes(index)) { turn.role = 'user'; turn.content = `request ${index}` }
  else if ((def.systemTurns ?? []).includes(index)) { turn.role = 'system'; turn.content = `system note ${index}`; delete turn.entryType }
  else if ((def.toolTurns ?? []).includes(index)) {
    turn.entryType = 'tool_use'
    turn.content = ''
    turn.toolCalls = [{ id: `call-${index}`, name: 'Read', group: 'read', filePath: `/src/file-${index % 3}.js`, sourceIndex: 0, sourceIdUnique: true }]
  } else if ((def.thinkingTurns ?? []).includes(index)) {
    turn.entryType = 'thinking'
    turn.content = ''
    turn.thinking = { text: `thinking ${index}`, words: 2 }
  }
  return turn
}

/** The loaded segments. `dropTurns` removes turns an adapter merged away. */
export function makePositionSegments(def, indexes, { dropTurns = [] } = {}) {
  return indexes.map((index) => {
    const ref = def.segments.find((segment) => segment.index === index)
    const turns = []
    for (let turnIndex = ref.firstTurn; turnIndex <= ref.lastTurn; turnIndex += 1) {
      if (!dropTurns.includes(turnIndex)) turns.push(makePositionTurn(def, turnIndex))
    }
    return { index, firstTurn: ref.firstTurn, lastTurn: ref.lastTurn, byteLength: ref.byteLength, hasOlder: index > 0, hasNewer: index < def.segments.length - 1, turns }
  })
}
