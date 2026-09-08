// Fixture composition only. Production parsing and cooking always use adaptTranscript.
export function buildContextFixture(fixture, name, partition = 'both') {
  const testCase = fixture.cases.find(item => item.name === name)
  if (!testCase) throw new Error(`Unknown context demo case ${name}; choose a named retention fixture.`)
  const payload = structuredClone({ ...fixture.base, ...testCase.detail })
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
    payload.earlierHistory = [{ state: 'uncertain_migrated', turns: earlier }]
    if (partition === 'earlier') {
      payload.turns = []
      payload.turnCount = 0
      payload.inputSubmissionCount = 0
      payload.toolCallCount = 0
    }
  }
  return payload
}
