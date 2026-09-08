import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import { adaptTranscript, prefilterTurns } from '../src/ui/transcript/adapter.js'
import { buildContextFixture } from '../src/mockups/inuse/context-fixture.js'

function load(name) {
  const docs = YAML.parseAllDocuments(readFileSync(new URL(`testdata/${name}.yaml`, import.meta.url), 'utf8'), { strict: true, uniqueKeys: true })
  assert.equal(docs.length, 1)
  assert.deepEqual(docs[0].errors, [])
  return docs[0].toJS()
}
const fixture = load('transcript_provenance_retention')
const manifest = load('transcript_provenance_retention.manifest')
function names(cases, required) {
  assert.deepEqual(cases.map(item => item.name).sort(), [...required].sort())
  assert.equal(new Set(cases.map(item => item.name)).size, cases.length)
}
names(fixture.cases, manifest.requiredCases)
names(fixture.navigationCases, manifest.requiredNavigationCases)
names(fixture.countCases, manifest.requiredCountCases)
names(fixture.invalidCounts, manifest.requiredInvalidCounts)
names(fixture.cases.find(item => item.invalid).invalid, manifest.requiredInvalidCases)

function assertPartition(cooked, raw, expectedIndices, partition, legacy) {
  assert.deepEqual(cooked.map(turn => turn.index), expectedIndices)
  for (const turn of cooked) {
    const source = raw.find(item => item.index === turn.index)
    assert.equal(turn.partition, partition)
    assert.equal(turn.identity, `${partition}:${source.sourceEntryRef || source.index}`)
    assert.equal(turn.sourceEntryRef, source.sourceEntryRef || undefined)
    assert.deepEqual(turn.provenance, source.provenance)
    assert.equal(turn.role, source.role)
    assert.equal(turn.entryType, source.entryType)
    if (source.entryType === 'thinking') {
      assert.equal(turn.thinking.text, source.content)
      assert.equal(turn.content, '')
    } else if (legacy && source.index === 5) {
      assert.equal(turn.thinking.text, 'legacy thought')
      assert.equal(turn.content, 'legacy response')
    } else {
      assert.equal(turn.content, source.content)
      assert.equal(turn.thinking, undefined)
    }
    assert.deepEqual(turn.usage, source.usage)
    for (const tool of turn.toolCalls) {
      const sourceTool = source.toolCalls.find(item => item.id === tool.id)
      assert.equal(tool.partition, partition)
      assert.equal(tool.callEntryRef, sourceTool.callEntryRef)
      assert.equal(tool.resultEntryRef, sourceTool.resultEntryRef)
      assert.deepEqual(tool.callProvenance, sourceTool.callProvenance)
      assert.deepEqual(tool.resultProvenance, sourceTool.resultProvenance)
      assert.deepEqual(tool.usage, sourceTool.usage)
      if (sourceTool.result) assert.equal(tool.output, sourceTool.result)
      if (sourceTool.id.endsWith(fixture.longResult.toolId)) assert.ok(Buffer.byteLength(tool.output) >= fixture.longResult.minimumBytes, 'long result fixture must exercise full-content retention')
    }
  }
}

for (const testCase of fixture.cases) {
  assert.ok(testCase.invalid?.length || testCase.expectedIndices?.length, `${testCase.name}: non-vacuous evidence expectations required`)
  for (const partition of fixture.partitions) {
    const input = buildContextFixture(fixture, testCase.name, partition)
    if (testCase.invalid) {
      for (const invalid of testCase.invalid) {
        const candidate = structuredClone(input)
        const target = partition === 'earlier' ? candidate.earlierHistory[0] : candidate
        let owner = target
        for (const key of invalid.path.slice(0, -1)) owner = owner[key]
        owner[invalid.path.at(-1)] = invalid.surrogate ? String.fromCharCode(0xd800) : structuredClone(invalid.value)
        if (invalid.scopedReference && partition === 'earlier') owner[invalid.path.at(-1)] = `old-${invalid.value}`
        assert.throws(() => adaptTranscript(candidate), /adaptTranscript refused/, `${testCase.name}/${partition}/${invalid.name}`)
        if (invalid.arrayReject) assert.throws(() => prefilterTurns(target.turns), /prefilterTurns refused/, `${testCase.name}/${partition}/${invalid.name}: public array helper`)
      }
      continue
    }
    const before = structuredClone(input)
    const vm = adaptTranscript(input, undefined, undefined, { relationshipNavigation: fixture.navigation })
    assert.deepEqual(input, before, `${testCase.name}: source was mutated`)
    const mainIndices = partition === 'earlier' ? [] : testCase.expectedIndices
    assert.deepEqual(prefilterTurns(input.turns).map(turn => turn.index), mainIndices)
    assertPartition(vm.turns, input.turns, mainIndices, 'main', testCase.legacy)
    if (partition !== 'main') {
      assertPartition(vm.earlierHistory[0].turns, input.earlierHistory[0].turns, testCase.expectedIndices, 'earlier-0', testCase.legacy)
      assert.deepEqual(vm.earlierHistory[0].nativeMetadata, input.earlierHistory[0].nativeMetadata)
      for (const record of input.earlierHistory[0].nativeMetadata ?? []) {
        const owner = vm.earlierHistory[0].turns.find(turn => turn.index === record.attachment.turnIndex)
        assert.deepEqual(owner.toolCalls.find(tool => tool.id === record.attachment.toolCallId).nativeMetadata, [record])
      }
    }
    assert.equal(vm.session.inputSubmissionCount, input.inputSubmissionCount)
    assert.equal(vm.session.turnCount, input.turnCount)
    assert.equal(vm.filterIndex.totalTurns, mainIndices.length)
    assert.deepEqual(adaptTranscript(input, undefined, undefined, { visibleTurnIndices: [] }).session, vm.session)
    console.log(`PASS ${testCase.name}/${partition}`)
  }
}

for (const testCase of fixture.navigationCases) {
  const input = buildContextFixture(fixture, 'native-text-thinking-pair')
  let navigation = structuredClone(fixture.navigation)
  if (testCase.sameTarget) {
    input.relationships[1].targetLocalId = input.relationships[0].targetLocalId
    navigation[1].localId = navigation[0].localId
  }
  if (testCase.revision) navigation[0].anchor.sourceRevisionRef = testCase.revision
  if (testCase.status) navigation = navigation.map(item => ({ kind: item.kind, status: testCase.status }))
  if (testCase.conflict) input.relationships = input.relationships.map(item => ({ kind: item.kind, targetState: 'conflicting_current_native_evidence', evidence: 'conflict' }))
  if (testCase.omit) navigation = undefined
  const vm = adaptTranscript(input, undefined, undefined, { relationshipNavigation: navigation })
  assert.deepEqual(vm.relationships.map(item => item.label), testCase.expectedLabels)
  assert.deepEqual(vm.relationships.flatMap(item => item.navigation ? [item.navigation.localId] : []), testCase.expectedTargets)
  if (testCase.exact !== undefined) assert.equal(!!vm.relationships[0].navigation.anchor, testCase.exact)
  console.log(`PASS ${testCase.name}`)
}
for (const testCase of fixture.countCases) {
  const input = buildContextFixture(fixture, 'native-text-thinking-pair')
  if (testCase.absent) delete input.inputSubmissionCount
  else input.inputSubmissionCount = testCase.value
  const vm = adaptTranscript(input)
  assert.equal(String(vm.session.inputSubmissionCount ?? 'unknown'), testCase.expected)
  assert.equal(vm.session.turnCount, 5)
}
for (const testCase of fixture.invalidCounts) {
  const input = buildContextFixture(fixture, 'native-text-thinking-pair')
  input.inputSubmissionCount = testCase.value
  assert.throws(() => adaptTranscript(input), /adaptTranscript refused/, testCase.name)
}
