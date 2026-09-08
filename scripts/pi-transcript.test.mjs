import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import YAML from 'yaml'
import { parseSessionDetailPayloadText } from '@peasant-labs/schema'
const adapterModule = process.env.FAIRTRADE_PI_ADAPTER_MODULE
  ? pathToFileURL(process.env.FAIRTRADE_PI_ADAPTER_MODULE).href
  : new URL('../src/ui/transcript/adapter.js', import.meta.url).href
const { adaptTranscript } = await import(`${adapterModule}?pi=${Date.now()}`)

function load(name) {
  const docs = YAML.parseAllDocuments(readFileSync(new URL(`testdata/${name}.yaml`, import.meta.url), 'utf8'), { strict: true, uniqueKeys: true })
  assert.equal(docs.length, 1)
  assert.deepEqual(docs[0].errors, [])
  return docs[0].toJS()
}
const { payload, cases, namespaceCases, probe } = load('pi-transcript')
const piManifest = load('pi-transcript.manifest')
assert.deepEqual(cases.map(c => c.name).sort(), piManifest.requiredCases.sort())
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
    const { JSDOM } = await import('jsdom')
    const document = new JSDOM(html).window.document
    assert.deepEqual([...document.querySelectorAll('.txn-usage-scopes h3')].map(node => node.textContent), probe.ownerHeadings)
  }
  console.log(`PASS ${c.name}`)
}

assert.deepEqual(namespaceCases.map(c => c.name).sort(), piManifest.requiredNamespaceCases.sort())
assert.equal(new Set(namespaceCases.map(c => c.name)).size, namespaceCases.length)
for (const c of namespaceCases) {
  assert.ok(Object.keys(c).every(key => ['name', 'toolMembers', 'toolPosition', 'arguments', 'error', 'expectedNamespace', 'duplicateNamespace', 'observedModel', 'metadataStringBytes', 'expectedRecordBytes', 'omitNamespace', 'legacyHarness'].includes(key)), `${c.name}: unrecognized fixture field`)
  const input = structuredClone(payload)
  if (c.legacyHarness) {
    input.harness = c.legacyHarness
    delete input.nativeMetadata
    for (const turn of input.turns) {
      delete turn.usage
      delete turn.sourceEntryRef
      delete turn.observedModel
      for (const candidate of turn.toolCalls ?? []) {
        delete candidate.usage
        delete candidate.callEntryRef
        delete candidate.resultEntryRef
        delete candidate.namespace
      }
    }
  }
  const tool = input.turns[2].toolCalls[c.toolPosition ?? 0]
  if (c.omitNamespace) delete tool.namespace
  Object.assign(tool, c.toolMembers)
  if (c.arguments) tool.arguments = JSON.stringify(c.arguments)
  if (c.observedModel) input.turns[2].observedModel = c.observedModel
  if (c.metadataStringBytes) {
    input.nativeMetadata[2].data.Report.Opaque = 'x'.repeat(c.metadataStringBytes)
    input.nativeMetadata[2].data.Report.Padding = ''
    const unpaddedBytes = Buffer.byteLength(JSON.stringify(input.nativeMetadata[2]))
    input.nativeMetadata[2].data.Report.Padding = 'y'.repeat(c.expectedRecordBytes - unpaddedBytes)
    assert.equal(Buffer.byteLength(JSON.stringify(input.nativeMetadata[2])), c.expectedRecordBytes, `${c.name}: selected metadata record budget`)
  }
  let raw = JSON.stringify(input)
  if (c.duplicateNamespace) raw = raw.replace(`"namespace":"${tool.namespace}"`, `"namespace":"${tool.namespace}","namesp\\u0061ce":"duplicate"`)
  if (c.error) {
    assert.throws(() => adaptTranscript(parseSessionDetailPayloadText(raw)), new RegExp(c.error, 'i'), `${c.name}: canonical text boundary`)
    if (!c.duplicateNamespace) assert.throws(() => adaptTranscript(input), new RegExp(c.error, 'i'), `${c.name}: canonical value boundary`)
    if (process.env.PI_MOUNTED_TEST) {
      const { adaptTranscript: packagedAdapter } = await import('../dist/lib/ui.js')
      if (!c.duplicateNamespace) assert.throws(() => packagedAdapter(input), new RegExp(c.error, 'i'), `${c.name}: packaged adapter`)
    }
  } else {
    const canonical = parseSessionDetailPayloadText(raw)
    const vm = adaptTranscript(input)
    assert.equal(vm.toolCallsById.get(tool.id).name, tool.name)
    assert.equal(vm.toolCallsById.get(tool.id).namespace, c.expectedNamespace)
    assert.equal(adaptTranscript(canonical).toolCallsById.get(tool.id).namespace, c.expectedNamespace)
    if (c.observedModel) assert.equal(vm.turns[2].effectiveModel, c.observedModel)
    if (c.arguments) assert.deepEqual(vm.toolCallsById.get(tool.id).args, c.arguments)
    if (process.env.PI_MOUNTED_TEST) {
      const React = await import('react')
      const { renderToStaticMarkup } = await import('react-dom/server')
      const { TranscriptViewer, adaptTranscript: packagedAdapter } = await import('../dist/lib/ui.js')
      const packagedVM = packagedAdapter(input)
      assert.equal(packagedVM.toolCallsById.get(tool.id).namespace, c.expectedNamespace)
      const html = renderToStaticMarkup(React.createElement(TranscriptViewer, { viewModel: packagedVM, initialExpandedTools: [tool.id] }))
      assert.equal(html.includes('txn-tool-namespace'), c.expectedNamespace !== undefined)
      if (c.expectedNamespace !== undefined) assert.ok(html.includes(c.expectedNamespace || '(empty)'))
      assert.ok(html.includes(tool.name))
    }
  }
  console.log(`PASS ${c.name}`)
}
