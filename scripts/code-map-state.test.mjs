import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import { CODE_MAP_STATE_VERSION, createCodeMapState, deriveCodeMapView, reduceCodeMapState } from '../src/ui/graph/codeMapState.js'

const REQUIRED_CASE_NAMES = new Set([
  'defaults survive json roundtrip', 'selection also focuses the navigator',
  'keyboard semantic selection uses the reducer', 'expansion ids are normalized',
  'filter retains deep matching context', 'open in map is atomic',
  'grain change clears expansion', 'canvas and navigator share selection',
  'viewport accepts finite values and rejects invalid scale', 'replace never carries stale fields',
  'file grain stays aggregate until explicit expansion', 'explicit expansion reaches file grain within one folder',
  'timeline actions round-trip the frozen contract',
])
const REQUIRED_ACTION_TYPES = new Set([
  'replace', 'hydrate', 'set-presentation', 'select', 'clear-selection', 'focus',
  'set-filter', 'set-expanded', 'toggle-expanded', 'set-grain', 'set-viewport',
  'open-in-map', 'reveal',
  'hover-session', 'select-session', 'toggle-commit-sessions', 'toggle-ghost-group',
  'set-rank-mode', 'set-scent-filter', 'set-rank-expanded',
])
const REQUIRED_MUTATION_NAMES = new Set([
  'manifest trailing document', 'manifest duplicate key', 'manifest unknown field',
  'manifest count drift', 'manifest duplicate name', 'manifest empty name',
  'manifest rename against fixture', 'manifest deletion against fixture',
  'fixture trailing document', 'fixture duplicate key', 'fixture unknown field',
  'fixture case unknown field', 'fixture action unknown field', 'fixture derived unknown field',
  'fixture expected count drift', 'fixture deleted case', 'fixture duplicate name',
  'fixture empty name',
])

const fixtureSource = readFileSync(new URL('./testdata/code-map-state.yaml', import.meta.url), 'utf8')
const manifestSource = readFileSync(new URL('./testdata/code-map-state-manifest.yaml', import.meta.url), 'utf8')
const manifest = parseOne(manifestSource, 'code-map state manifest')
const navigatorFixture = parseOne(readFileSync(new URL('./testdata/code-map-navigator.yaml', import.meta.url), 'utf8'), 'code-map navigator fixture')
const fixture = parseOne(fixtureSource, 'code-map state fixture')
validateManifest(manifest)
validateFixture(fixture, manifest)

const payload = { repoFound: true, nodes: navigatorFixture.nodes, structureEdges: navigatorFixture.structureEdges, violations: [] }
for (const testCase of fixture.cases) {
  let state = createCodeMapState(structuredClone(testCase.initial))
  for (const action of testCase.sequence) state = reduceCodeMapState(state, action)
  assert.deepEqual(state, testCase.expected, testCase.name)
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state, `${testCase.name}: state is JSON-safe`)
  for (const rejected of testCase.rejects ?? []) assert.throws(() => reduceCodeMapState(state, rejected), /what went wrong:.*why:.*where:.*when:.*what it means:.*how to fix:/)
  if (testCase.deriveExpected) {
    const view = deriveCodeMapView(payload, state)
    if (testCase.deriveExpected.rowIds) assert.deepEqual(view.rows.map((row) => row.node.id), testCase.deriveExpected.rowIds)
    if ('focusedId' in testCase.deriveExpected) assert.equal(view.focusedId, testCase.deriveExpected.focusedId)
    if ('staleSelectedId' in testCase.deriveExpected) assert.equal(view.staleSelectedId, testCase.deriveExpected.staleSelectedId)
    if ('selectedId' in testCase.deriveExpected) assert.equal(view.selected?.id ?? null, testCase.deriveExpected.selectedId)
    if ('canvasSelectedId' in testCase.deriveExpected) assert.equal(view.canvas.selectedId, testCase.deriveExpected.canvasSelectedId)
    if (testCase.deriveExpected.canvasVisibleIds) assert.deepEqual(view.canvas.visibleIds, testCase.deriveExpected.canvasVisibleIds)
  }
}

const opaque = fixture.opaqueIdCase
const opaqueState = createCodeMapState(opaque.state)
const opaqueView = deriveCodeMapView(opaque.payload, opaqueState)
assert.equal(opaqueView.canvas.selectedId, opaque.expected.selectedId)
assert.equal(opaqueView.focusedId, opaque.expected.focusedId)
assert.deepEqual(opaqueState.expandedIds, opaque.expected.expandedIds)
assert.deepEqual(opaqueView.canvas.hierarchy.orderedIds, opaque.expected.orderedIds)

// A modest grain x expansion-depth matrix locking navigator/canvas agreement
// GENERALLY (not just the one file-grain case above): for ANY state (no
// active filter, which introduces its own force-open recursion term), the
// canvas's visible node set must equal exactly the navigator's collapsed-row
// frontier -- every row whose children are NOT currently rendered below it.
// A row's `canExpand` is precisely that "did this row's children get
// rendered" decision (hasChildren && (depth < maxDepth || explicitly
// expanded) -- the SAME condition appendRow's own recursion uses), which is
// distinct from `expanded` (a UI/keyboard-toggle-state flag: a base-depth
// auto-opened row shows its children below it without ever being toggled,
// so `expanded` alone under-counts the frontier). This is a structural
// invariant of deriveCodeMapView itself, not per-case expected-id lists, so
// it catches a divergence at ANY grain/expansion combination, not only the
// ones a fixed expected list happens to cover.
const agreementMatrixSource = readFileSync(new URL('./testdata/code-map-agreement-matrix.yaml', import.meta.url), 'utf8')
const agreementMatrix = parseOne(agreementMatrixSource, 'code-map agreement-matrix fixture')
validateAgreementMatrix(agreementMatrix)
for (const testCase of agreementMatrix.cases) {
  const state = createCodeMapState({ grain: testCase.grain, expandedIds: testCase.expandedIds })
  const view = deriveCodeMapView(payload, state)
  const canvasIds = [...view.canvas.visibleIds].sort()
  const rowFrontierIds = view.rows.filter((row) => !row.canExpand).map((row) => row.node.id).sort()
  assert.deepEqual(rowFrontierIds, canvasIds, `agreement matrix (${testCase.name}): navigator's collapsed-row frontier must equal the canvas's visible node set`)
}
console.log(`code-map state: navigator/canvas agreement locked across ${agreementMatrix.cases.length} grain x expansion combinations`)

assert.equal(CODE_MAP_STATE_VERSION, 1)
assert.throws(() => reduceCodeMapState(createCodeMapState(), { type: 'unknown' }), /how to fix:/)
assert.throws(() => deriveCodeMapView({ ...payload, nodes: [...payload.nodes, payload.nodes[0]] }, createCodeMapState()), /duplicate node id/)
assert.throws(() => deriveCodeMapView({ ...payload, nodes: payload.nodes.map((node) => node.id === 'internal' ? { ...node, parent: 'missing' } : node) }, createCodeMapState()), /does not exist/)
assert.throws(() => deriveCodeMapView({ ...payload, nodes: payload.nodes.map((node) => node.id === 'internal' ? { ...node, parent: 'internal\/ingest' } : node) }, createCodeMapState()), /cycle/)

for (const sample of manifest.actionSamples) {
  requireAction(sample.action, `actionSamples.${sample.name}`)
  const fields = Object.keys(sample.action)
  const omittedField = fields.length === 1 ? 'type' : fields.at(-1)
  const omitted = structuredClone(sample.action)
  delete omitted[omittedField]
  assertSpecificFailure(() => requireAction(omitted, `actionSamples.${sample.name}.omitted`), omittedField === 'type' ? 'type must be a nonempty string' : `is missing ${omittedField}`, `${sample.name} validator omission`)
  assertSpecificFailure(() => reduceCodeMapState(createCodeMapState(), omitted), omittedField === 'type' ? 'no string type' : `required field ${JSON.stringify(omittedField)} is missing`, `${sample.name} runtime omission`)

  const extra = { ...structuredClone(sample.action), unexpected: true }
  assertSpecificFailure(() => requireAction(extra, `actionSamples.${sample.name}.extra`), 'has unknown field unexpected', `${sample.name} validator extra`)
  assertSpecificFailure(() => reduceCodeMapState(createCodeMapState(), extra), 'field "unexpected" is not allowed', `${sample.name} runtime extra`)
}

for (const probe of manifest.actionValueProbes) {
  const sample = manifest.actionSamples.find((item) => item.action.type === probe.actionType)
  const action = structuredClone(sample.action)
  action[probe.field] = probe.valueKind === 'undefined' ? undefined : structuredClone(probe.value)
  if (probe.outcome === 'accept') {
    assert.doesNotThrow(() => reduceCodeMapState(createCodeMapState(), action), probe.name)
  } else {
    assertSpecificFailure(() => reduceCodeMapState(createCodeMapState(), action), probe.expectedError, probe.name)
  }
}

for (const mutationCase of manifest.mutationCases) {
  assertSpecificFailure(
    () => runMutation(mutationCase, { manifest, manifestSource, fixture, fixtureSource }),
    mutationCase.expectedError,
    mutationCase.name,
  )
}

console.log(`code-map state: ${fixture.cases.length} fixture cases, ${manifest.actionSamples.length} action shapes, ${manifest.actionValueProbes.length} value probes, and ${manifest.mutationCases.length} mutation guards passed`)

function runMutation(testCase, sources) {
  if (testCase.target === 'manifestSource') return parseOne(mutateSource(sources.manifestSource, testCase.mutation), testCase.name)
  if (testCase.target === 'fixtureSource') return parseOne(mutateSource(sources.fixtureSource, testCase.mutation), testCase.name)
  if (testCase.target === 'manifest') {
    const value = structuredClone(sources.manifest)
    mutateManifest(value, testCase.mutation)
    validateManifest(value)
    validateFixture(sources.fixture, value)
    return
  }
  if (testCase.target === 'fixture') {
    const value = structuredClone(sources.fixture)
    mutateFixture(value, testCase.mutation)
    validateFixture(value, sources.manifest)
    return
  }
  throw new Error(`mutation target ${testCase.target} is unsupported`)
}

function mutateSource(source, mutation) {
  if (mutation === 'trailing-document') return `${source}\n---\nextra: true\n`
  if (mutation === 'duplicate-key') {
    return source.replace('expectedCaseCount: 13\n', 'expectedCaseCount: 13\nexpectedCaseCount: 13\n')
  }
  throw new Error(`source mutation ${mutation} is unsupported`)
}

function mutateManifest(value, mutation) {
  if (mutation === 'unknown-field') value.unknown = true
  else if (mutation === 'expected-count-drift') value.expectedCaseCount = 9
  else if (mutation === 'duplicate-name') value.caseNames[1] = value.caseNames[0]
  else if (mutation === 'empty-name') value.caseNames[0] = ''
  else if (mutation === 'renamed-name') value.caseNames[0] = 'renamed behavior'
  else if (mutation === 'deleted-name') value.caseNames.pop()
  else throw new Error(`manifest mutation ${mutation} is unsupported`)
}

function mutateFixture(value, mutation) {
  if (mutation === 'unknown-field') value.unknown = true
  else if (mutation === 'case-unknown-field') value.cases[0].unknown = true
  else if (mutation === 'action-unknown-field') value.cases[0].sequence[0].unknown = true
  else if (mutation === 'derived-unknown-field') value.cases.find((item) => item.deriveExpected).deriveExpected.unknown = true
  else if (mutation === 'expected-count-drift') value.expectedCaseCount = 9
  else if (mutation === 'deleted-case') value.cases.pop()
  else if (mutation === 'duplicate-name') value.cases[1].name = value.cases[0].name
  else if (mutation === 'empty-name') value.cases[0].name = ''
  else throw new Error(`fixture mutation ${mutation} is unsupported`)
}

function assertSpecificFailure(callback, expected, label) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof Error, `${label}: expected an Error`)
    assert.ok(error.message.includes(expected), `${label}: expected ${JSON.stringify(expected)} in ${JSON.stringify(error.message)}`)
    return true
  })
}

function parseOne(text, label) {
  const documents = YAML.parseAllDocuments(text, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (errors.length) throw new Error(`${label} has invalid strict YAML or a duplicate key: ${errors.map((error) => error.message).join('; ')}`)
  if (documents.length !== 1) throw new Error(`${label} must contain exactly one YAML document`)
  return documents[0].toJS()
}

function validateManifest(value) {
  requireObject(value, 'manifest')
  requireExactKeys(value, ['expectedCaseCount', 'caseNames', 'actionSamples', 'actionValueProbes', 'mutationCases'], 'manifest')
  if (value.expectedCaseCount !== 13 || !Array.isArray(value.caseNames) || value.caseNames.length !== 13) throw new Error('manifest must declare exactly 13 case names')
  const names = new Set(value.caseNames)
  if (names.size !== 13 || value.caseNames.some((name) => typeof name !== 'string' || name.trim() === '')) throw new Error('manifest case names must be unique nonempty strings')
  requireExactSet(names, REQUIRED_CASE_NAMES, 'manifest case names')
  if (!Array.isArray(value.actionSamples) || value.actionSamples.length !== 20) throw new Error('manifest actionSamples must contain exactly 20 actions')
  const sampleNames = new Set()
  const actionTypes = new Set()
  for (const [index, sample] of value.actionSamples.entries()) {
    requireObject(sample, `actionSamples[${index}]`)
    requireExactKeys(sample, ['name', 'action'], `actionSamples[${index}]`)
    if (typeof sample.name !== 'string' || sample.name.trim() === '') throw new Error(`actionSamples[${index}].name must be nonempty`)
    if (sampleNames.has(sample.name)) throw new Error(`actionSamples[${index}].name must be unique`)
    sampleNames.add(sample.name)
    requireAction(sample.action, `actionSamples[${index}].action`)
    actionTypes.add(sample.action.type)
  }
  requireExactSet(actionTypes, REQUIRED_ACTION_TYPES, 'manifest action types')
  if (!Array.isArray(value.actionValueProbes) || value.actionValueProbes.length !== 60) throw new Error('manifest actionValueProbes must contain exactly 60 probes')
  const probeNames = new Set()
  const probeKeys = new Set()
  for (const [index, probe] of value.actionValueProbes.entries()) {
    requireObject(probe, `actionValueProbes[${index}]`)
    const keys = probe.valueKind === 'undefined'
      ? ['name', 'actionType', 'field', 'valueKind', 'outcome', 'expectedError']
      : ['name', 'actionType', 'field', 'valueKind', 'value', 'outcome', 'expectedError']
    requireExactKeys(probe, keys, `actionValueProbes[${index}]`)
    if (typeof probe.name !== 'string' || probe.name.trim() === '' || probeNames.has(probe.name)) throw new Error(`actionValueProbes[${index}].name must be unique and nonempty`)
    probeNames.add(probe.name)
    if (!REQUIRED_ACTION_TYPES.has(probe.actionType)) throw new Error(`actionValueProbes[${index}].actionType is unknown`)
    if (!['undefined', 'literal'].includes(probe.valueKind)) throw new Error(`actionValueProbes[${index}].valueKind is unknown`)
    if (!['accept', 'reject'].includes(probe.outcome)) throw new Error(`actionValueProbes[${index}].outcome is unknown`)
    const probeKind = probe.valueKind === 'undefined'
      ? 'undefined'
      : probe.value === null
        ? 'null'
        : 'wrong'
    probeKeys.add(`${probe.actionType}:${probeKind}`)
  }
  const requiredProbeKeys = new Set([...REQUIRED_ACTION_TYPES].flatMap((type) => ['undefined', 'null', 'wrong'].map((kind) => `${type}:${kind}`)))
  requireExactSet(probeKeys, requiredProbeKeys, 'manifest action value probes')
  if (!Array.isArray(value.mutationCases) || value.mutationCases.length !== 18) throw new Error('manifest mutationCases must contain exactly 18 cases')
  const mutationNames = new Set()
  for (const [index, testCase] of value.mutationCases.entries()) {
    requireObject(testCase, `mutationCases[${index}]`)
    requireExactKeys(testCase, ['name', 'target', 'mutation', 'expectedError'], `mutationCases[${index}]`)
    if (typeof testCase.name !== 'string' || testCase.name.trim() === '' || mutationNames.has(testCase.name)) throw new Error(`mutationCases[${index}].name must be unique and nonempty`)
    mutationNames.add(testCase.name)
  }
  requireExactSet(mutationNames, REQUIRED_MUTATION_NAMES, 'manifest mutation names')
}

function validateFixture(value, manifest) {
  requireObject(value, 'fixture')
  requireExactKeys(value, ['expectedCaseCount', 'cases', 'opaqueIdCase'], 'fixture')
  if (value.expectedCaseCount !== 13) throw new Error('fixture expectedCaseCount must equal 13')
  if (!Array.isArray(value.cases) || value.cases.length !== 13) throw new Error('fixture must contain exactly 13 cases')
  const names = new Set()
  for (const [index, testCase] of value.cases.entries()) {
    requireObject(testCase, `cases[${index}]`)
    const allowed = new Set(['name', 'initial', 'sequence', 'expected', 'rejects', 'deriveExpected'])
    for (const key of Object.keys(testCase)) if (!allowed.has(key)) throw new Error(`cases[${index}] has unknown field ${key}`)
    for (const required of ['name', 'initial', 'sequence', 'expected']) if (!(required in testCase)) throw new Error(`cases[${index}] is missing ${required}`)
    if (typeof testCase.name !== 'string' || testCase.name.trim() === '' || names.has(testCase.name)) throw new Error(`cases[${index}] has a duplicate or empty name`)
    names.add(testCase.name)
    requireStateShape(testCase.initial, `cases[${index}].initial`)
    requireStateShape(testCase.expected, `cases[${index}].expected`)
    if (!Array.isArray(testCase.sequence)) throw new Error(`cases[${index}].sequence must be an array`)
    for (const [actionIndex, action] of testCase.sequence.entries()) requireAction(action, `cases[${index}].sequence[${actionIndex}]`)
    if (testCase.rejects) {
      if (!Array.isArray(testCase.rejects)) throw new Error(`cases[${index}].rejects must be an array`)
      for (const [actionIndex, action] of testCase.rejects.entries()) requireAction(action, `cases[${index}].rejects[${actionIndex}]`)
    }
    if (testCase.deriveExpected) {
      requireObject(testCase.deriveExpected, `cases[${index}].deriveExpected`)
      const deriveKeys = new Set(['rowIds', 'focusedId', 'staleSelectedId', 'selectedId', 'canvasSelectedId', 'canvasVisibleIds'])
      for (const key of Object.keys(testCase.deriveExpected)) if (!deriveKeys.has(key)) throw new Error(`cases[${index}].deriveExpected has unknown field ${key}`)
    }
  }
  if (manifest.caseNames.some((name) => !names.has(name)) || names.size !== manifest.caseNames.length) throw new Error('fixture semantic name set does not match the manifest')
  requireObject(value.opaqueIdCase, 'opaqueIdCase')
  requireExactKeys(value.opaqueIdCase, ['state', 'payload', 'expected'], 'opaqueIdCase')
  requireStateShape(value.opaqueIdCase.state, 'opaqueIdCase.state')
}

function validateAgreementMatrix(value) {
  requireObject(value, 'agreement-matrix fixture')
  requireExactKeys(value, ['expectedCaseCount', 'cases'], 'agreement-matrix fixture')
  if (value.expectedCaseCount !== 9) throw new Error('agreement-matrix fixture expectedCaseCount must equal 9')
  if (!Array.isArray(value.cases) || value.cases.length !== 9) throw new Error('agreement-matrix fixture must contain exactly 9 cases')
  const names = new Set()
  for (const [index, testCase] of value.cases.entries()) {
    requireObject(testCase, `agreement-matrix cases[${index}]`)
    requireExactKeys(testCase, ['name', 'grain', 'expandedIds'], `agreement-matrix cases[${index}]`)
    if (typeof testCase.name !== 'string' || testCase.name.trim() === '' || names.has(testCase.name)) {
      throw new Error(`agreement-matrix cases[${index}] has a duplicate or empty name`)
    }
    names.add(testCase.name)
    if (!['project', 'package', 'file'].includes(testCase.grain)) throw new Error(`agreement-matrix cases[${index}] has an invalid grain`)
    if (!Array.isArray(testCase.expandedIds)) throw new Error(`agreement-matrix cases[${index}].expandedIds must be an array`)
  }
}

function requireStateShape(value, label) {
  requireObject(value, label)
  requireExactKeys(value, [
    'version', 'presentation', 'selectedId', 'grain', 'expandedIds', 'navigatorFilter', 'navigatorFocusedId', 'viewport',
    'hoveredSessionId', 'selectedSessionId', 'expandedCommitSessions', 'expandedGhostGroups', 'rankMode', 'scentFilter',
  ], label)
}

function requireAction(value, label) {
  requireObject(value, label)
  if (typeof value.type !== 'string' || value.type.length === 0) throw new Error(`${label}.type must be a nonempty string`)
  const fieldsByType = {
    replace: ['type', 'state'],
    hydrate: ['type', 'state'],
    'set-presentation': ['type', 'presentation'],
    select: ['type', 'id'],
    'clear-selection': ['type'],
    focus: ['type', 'id'],
    'set-filter': ['type', 'filter'],
    'set-expanded': ['type', 'ids'],
    'toggle-expanded': ['type', 'id'],
    'set-grain': ['type', 'grain'],
    'set-viewport': ['type', 'viewport'],
    'open-in-map': ['type', 'id'],
    reveal: ['type', 'id', 'grain', 'expandedIds'],
    'hover-session': ['type', 'sessionId'],
    'select-session': ['type', 'sessionId'],
    'toggle-commit-sessions': ['type', 'commitHash'],
    'toggle-ghost-group': ['type', 'successorHash'],
    'set-rank-mode': ['type', 'rankMode'],
    'set-scent-filter': ['type', 'scentFilter'],
    'set-rank-expanded': ['type', 'expanded'],
  }
  const fields = fieldsByType[value.type]
  if (!fields) throw new Error(`${label}.type is unknown`)
  requireExactKeys(value, fields, label)
}

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
}

function requireExactKeys(value, expected, label) {
  const expectedSet = new Set(expected)
  for (const key of Object.keys(value)) if (!expectedSet.has(key)) throw new Error(`${label} has unknown field ${key}`)
  for (const key of expected) if (!(key in value)) throw new Error(`${label} is missing ${key}`)
}

function requireExactSet(actual, expected, label) {
  if (actual.size !== expected.size || [...expected].some((item) => !actual.has(item))) {
    throw new Error(`${label} must match the independent required set`)
  }
}
