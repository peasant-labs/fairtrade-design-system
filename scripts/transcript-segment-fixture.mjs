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
  if (role === 'user') turn.content = `request ${index}`
  else if (role === 'system') turn.content = `system note ${index}`
  else turn.toolCalls = [{ id: `call-${index}`, name: 'Read', group: 'read', filePath: `/src/file-${index % 3}.js`, sourceIndex: 0, sourceIdUnique: true }]
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
