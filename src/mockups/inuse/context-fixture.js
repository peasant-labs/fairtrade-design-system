// Fixture composition only. Production parsing and cooking always use adaptTranscript.
/**
 * @typedef {object} RetentionCase
 * @property {string} name
 * @property {Partial<import('@peasant-labs/schema').SessionDetailPayload>} detail
 * @property {boolean} [legacy]
 * @property {number[]} [expectedIndices]
 * @property {{name: string, path: (string | number)[], value?: unknown, surrogate?: boolean, scopedReference?: boolean, arrayReject?: boolean}[]} [invalid]
 */
/**
 * @typedef {object} RetentionFixture
 * @property {import('@peasant-labs/schema').SessionDetailPayload} base
 * @property {{timestamp: string}} turnDefaults
 * @property {RetentionCase[]} cases
 * @property {import('@peasant-labs/schema').SessionRelationshipNavigation[]} navigation
 * @property {string[]} partitions
 * @property {string[]} themes
 * @property {{turnIndex: number, toolId: string, chunk: string, repetitions: number, suffix: string, minimumBytes: number}} longResult
 */
/** @param {RetentionFixture} fixture @param {string} name @param {string} [partition] */
export function buildContextFixture(fixture, name, partition = 'both') {
  const testCase = fixture.cases.find(item => item.name === name)
  if (!testCase) throw new Error(`Unknown context demo case ${name}; choose a named retention fixture.`)
  const payload = structuredClone({ ...fixture.base, ...testCase.detail })
  payload.turns = payload.turns.map(turn => ({ ...fixture.turnDefaults, ...turn }))
  const long = fixture.longResult
  const longTool = payload.turns.find(turn => turn.index === long.turnIndex)?.toolCalls?.find(tool => tool.id === long.toolId)
  if (longTool) longTool.result = long.chunk.repeat(long.repetitions) + long.suffix
  if (testCase.legacy) {
    delete payload.inputSubmissionCount
    delete payload.relationships
  }
  if (partition !== 'main') {
    const earlier = structuredClone(payload.turns)
    // Different public blocks in another index domain; never text-derived identity.
    for (const turn of earlier) {
      if (turn.sourceEntryRef) turn.sourceEntryRef = `old-${turn.sourceEntryRef}`
      if (turn.provenance?.submissionRef) turn.provenance.submissionRef = `old-${turn.provenance.submissionRef}`
      if (turn.usage) {
        turn.usage.ownerId = `old-${turn.usage.ownerId}`
        turn.usage.sourceEntryRef = `old-${turn.usage.sourceEntryRef}`
      }
      for (const tool of turn.toolCalls ?? []) {
        tool.id = `old-${tool.id}`
        if (tool.callEntryRef) tool.callEntryRef = `old-${tool.callEntryRef}`
        if (tool.resultEntryRef) tool.resultEntryRef = `old-${tool.resultEntryRef}`
        if (tool.usage) {
          tool.usage.ownerId = `old-${tool.usage.ownerId}`
          tool.usage.sourceEntryRef = `old-${tool.usage.sourceEntryRef}`
        }
      }
    }
    const nativeMetadata = payload.nativeMetadata?.map(record => ({ ...structuredClone(record), id: `old-${record.id}`,
      source: { ...record.source, entryRef: `old-${record.source.entryRef}` },
      ...(record.attachment ? { attachment: { ...record.attachment, ...(record.attachment.toolCallId ? { toolCallId: `old-${record.attachment.toolCallId}` } : {}) } } : {}) }))
    payload.earlierHistory = [{ state: 'uncertain_migrated', turns: earlier, ...(nativeMetadata ? { nativeMetadata } : {}) }]
    if (partition === 'earlier') {
      payload.turns = []
      payload.turnCount = 0
      payload.inputSubmissionCount = 0
      payload.toolCallCount = 0
      delete payload.nativeMetadata
    }
  }
  return payload
}
