import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import { parseSessionDetailPayloadText } from '@peasant-labs/schema'
import { adaptTranscript } from '../src/ui/transcript/adapter.js'

function load(name) {
  const docs = YAML.parseAllDocuments(readFileSync(new URL(`testdata/${name}.yaml`, import.meta.url), 'utf8'), { strict: true, uniqueKeys: true })
  assert.equal(docs.length, 1)
  assert.deepEqual(docs[0].errors, [])
  return docs[0].toJS()
}
const { payload, cases } = load('pi-transcript')
assert.deepEqual(cases.map(c => c.name).sort(), load('pi-transcript.manifest').requiredCases.sort())
assert.equal(new Set(cases.map(c => c.name)).size, cases.length)
for (const c of cases) {
  assert.ok(Object.keys(c).every(key => ['name', 'equalOwners', 'completeScopes', 'shortContext', 'metadataOnly', 'overflow', 'duplicateOwner', 'invalidToken', 'invalidTarget', 'rawDuplicate', 'error'].includes(key)), `${c.name}: unrecognized fixture field`)
  const input = structuredClone(payload)
  if (c.shortContext) input.turns[1].content = 'OK'
  if (c.completeScopes) {
    for (const owner of [input.turns[2].toolCalls[0].usage, input.turns[4].usage]) {
      owner.completeness = 'complete'
      owner.tokens = structuredClone(c.completeScopes)
    }
  }
  if (c.metadataOnly) {
    input.turns = []
    input.turnCount = 0
    input.toolCallCount = 0
    input.nativeMetadata = input.nativeMetadata.slice(0, 1)
  }
  if (c.equalOwners || c.overflow) {
    input.turns[3].usage = { ...structuredClone(input.turns[2].usage), ownerId: 'owner-empty', sourceEntryRef: 'entry-empty' }
    if (c.overflow) for (const index of [2, 3]) {
      input.turns[index].usage.tokens = { input: Number.MAX_SAFE_INTEGER }
      input.turns[index].usage.completeness = 'partial'
    }
  }
  if (c.duplicateOwner) input.turns[3].usage.ownerId = input.turns[2].usage.ownerId
  if (c.invalidToken) input.turns[2].usage.tokens.input = -1
  if (c.invalidTarget) input.nativeMetadata[2].attachment.turnIndex = 0
  let raw = JSON.stringify(input)
  if (c.rawDuplicate) raw = raw.replace('"HiddenState":', '"HiddenState":true,"HiddenState":')
  const run = () => adaptTranscript(parseSessionDetailPayloadText(raw))
  if (c.error) {
    assert.throws(run, new RegExp(c.error, 'i'), c.name)
    if (!c.rawDuplicate) assert.throws(() => adaptTranscript(input), new RegExp(c.error, 'i'), `${c.name}: adapter value boundary`)
    console.log(`PASS ${c.name}`)
    continue
  }
  const vm = run()
  assert.equal(vm.turns.length, input.turns.length, c.name)
  assert.deepEqual(vm.nativeMetadata, input.nativeMetadata)
  if (c.metadataOnly) {
    assert.equal(vm.filterIndex.totalTurns, 0)
    assert.deepEqual(vm.usageScopes, [])
    console.log(`PASS ${c.name}`)
    continue
  }
  assert.equal(vm.turns[1].content, input.turns[1].content)
  assert.equal(vm.turns[2].thinking.text, 'Consider Orchard constraints exactly once.')
  assert.equal(vm.turns[2].content, 'Checking the plan. [image omitted]')
  assert.equal(vm.toolCallsById.get('tool-orchard').args.Plan.Options[1].Mode, 'Careful')
  assert.equal(vm.toolCallsById.get('tool-orchard').output, payload.turns[2].toolCalls[0].result)
  assert.equal(vm.toolCallsById.get('tool-orchard').nativeMetadata[0].data.Report.State, 'NeedsReview')
  assert.equal(vm.toolCallsById.get('tool-pending').pending, true)
  assert.equal(vm.toolCallsById.get('tool-pending').usage, undefined)
  assert.equal(vm.turns[2].usage.cost.output, '0.30000000000000004')
  assert.ok(!JSON.stringify(vm.turns.map(t => t.content)).includes('MetadataOnlyNeedle'))
  assert.equal(vm.filterIndex.totalTurns, 6)
  const assistant = vm.usageScopes.find(scope => scope.scope === 'assistant')
  assert.equal(assistant.ownerCount, 2)
  assert.deepEqual(assistant.tokens[0], { label: 'input', value: '0', completeness: c.equalOwners ? 'complete' : 'partial' })
  assert.equal(assistant.cost.find(field => field.label === 'output').value, c.equalOwners ? '0.60000000000000008' : '0.30000000000000004')
  assert.equal(vm.usageScopes.find(scope => scope.scope === 'summary').tokens[0].value, c.completeScopes ? '1' : 'unknown')
  if (c.completeScopes) assert.equal(vm.usageScopes.find(scope => scope.scope === 'tool').tokens.find(field => field.label === 'total tokens').value, '10')
  assert.deepEqual(adaptTranscript(input, undefined, undefined, { visibleTurnIndices: [0] }).usageScopes, vm.usageScopes)
  if (process.env.PI_MOUNTED_TEST) {
    const React = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { TranscriptViewer } = await import('../dist/lib/ui.js')
    const html = renderToStaticMarkup(React.createElement(TranscriptViewer, { viewModel: vm }))
    assert.ok(html.includes('data-brand="pi"'))
    assert.ok(html.includes('recorded harness estimate'))
    assert.ok(!html.includes('MetadataOnlyNeedle'))
  }
  console.log(`PASS ${c.name}`)
}
