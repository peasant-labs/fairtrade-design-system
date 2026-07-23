#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import { createCodeMapState, deriveCodeMapView } from '../src/ui/graph/codeMapState.js'

const STATE_KEYS = ['expandedIds', 'grain', 'navigatorFilter', 'navigatorFocusedId', 'presentation', 'selectedId', 'version', 'viewport']
const LEGACY_KEYS = ['select', 'zoom', 'expand', 'presentation']
const CARDINALITY_KEYS = ['states', ...LEGACY_KEYS, 'aria', 'structure']
const DOM_EVIDENCE_KEYS = ['visibleIds', 'pressedIds', 'grain', 'disclosures', 'disclosureExpandedIds', 'transform', 'status', 'structure']
const SNAPSHOT_CARDINALITY_KEYS = ['before', 'after', 'ownerStates', 'semanticStates', 'announcements', 'transforms']
const SEMANTIC_STATE_KEYS = ['selectedId', 'grain', 'expandedIds']
const STRUCTURAL_ASSERTIONS = new Set([
  'disclosure-outside-treeitem',
  'disclosure-tabindex-minus-one',
  'one-roving-tree-tabstop',
  'disclosure-outside-node',
  'disclosure-sibling-node',
])
const MUTATION_KINDS = new Set([
  'trailing-document',
  'duplicate-root-key',
  'unknown-root-field',
  'count-drift',
  'duplicate-case-name',
  'empty-case-name',
  'rename-case',
  'delete-case',
  'unknown-case-field',
  'incomplete-state',
  'empty-active-case',
  'controlled-owner-missing-before',
  'controlled-owner-missing-after',
  'legacy-owner-missing-before',
  'legacy-owner-incomplete-before',
  'legacy-owner-missing-after',
  'legacy-owner-incomplete-after',
  'missing-announcement',
  'wrong-announcement',
  'semantic-selection-mismatch',
  'semantic-expansion-mismatch',
  'null-viewport-missing-transform',
])

const fixtureSource = readFileSync(new URL('./testdata/code-map-interactions.yaml', import.meta.url), 'utf8')
const manifestSource = readFileSync(new URL('./testdata/code-map-interactions-manifest.yaml', import.meta.url), 'utf8')
const manifest = parseDocument(manifestSource, 'code-map interaction manifest')
validateManifest(manifest)
const fixture = parseDocument(fixtureSource, 'code-map interaction fixture')
validateFixture(fixture, manifest)

for (const mutationCase of manifest.mutations) {
  let failure = null
  try {
    validateMutation(mutationCase, fixture, fixtureSource, manifest)
  } catch (error) {
    failure = error
  }
  assert.ok(failure, `${mutationCase.name} must fail validation`)
  assert.ok(
    String(failure.message).includes(mutationCase.expectedError),
    `${mutationCase.name} must include literal diagnostic ${JSON.stringify(mutationCase.expectedError)}; received ${JSON.stringify(failure.message)}`,
  )
}

console.log(`code-map interactions: ${fixture.cases.length} fixture cases, ${manifest.cases.length} manifest rows, and ${manifest.mutations.length} mutation guards passed`)

function validateMutation(testCase, original, source, requiredManifest) {
  if (testCase.mutation === 'trailing-document') return parseDocument(`${source}\n---\nextra: true\n`, testCase.name)
  if (testCase.mutation === 'duplicate-root-key') return parseDocument(source.replace(`expectedCaseCount: ${requiredManifest.expectedCaseCount}`, `expectedCaseCount: ${requiredManifest.expectedCaseCount}\nexpectedCaseCount: ${requiredManifest.expectedCaseCount}`), testCase.name)
  const value = structuredClone(original)
  if (testCase.mutation === 'unknown-root-field') value.unexpected = true
  else if (testCase.mutation === 'count-drift') value.expectedCaseCount = requiredManifest.expectedCaseCount - 1
  else if (testCase.mutation === 'duplicate-case-name') value.cases[1].name = value.cases[0].name
  else if (testCase.mutation === 'empty-case-name') value.cases[0].name = ''
  else if (testCase.mutation === 'rename-case') value.cases[0].name = 'renamed interaction'
  else if (testCase.mutation === 'delete-case') value.cases.pop()
  else if (testCase.mutation === 'unknown-case-field') value.cases[0].unexpected = true
  else if (testCase.mutation === 'incomplete-state') delete value.cases[0].expectedStates[0].viewport
  else if (testCase.mutation === 'empty-active-case') {
    value.cases[0].expectedStates = []
    for (const key of LEGACY_KEYS) value.cases[0].expectedLegacy[key] = []
    value.cases[0].expectedAria = []
    value.cases[0].expectedStructure = []
  } else if (testCase.mutation === 'controlled-owner-missing-before') {
    delete value.cases.find((candidate) => candidate.owner === 'reject').expectedBefore
  } else if (testCase.mutation === 'controlled-owner-missing-after') {
    delete value.cases.find((candidate) => candidate.owner === 'reject').expectedAfter
  } else if (testCase.mutation === 'legacy-owner-missing-before') {
    delete value.cases.find((candidate) => candidate.owner === 'legacy').expectedBefore
  } else if (testCase.mutation === 'legacy-owner-incomplete-before') {
    delete value.cases.find((candidate) => candidate.owner === 'legacy').expectedBefore.semanticState.selectedId
  } else if (testCase.mutation === 'legacy-owner-missing-after') {
    delete value.cases.find((candidate) => candidate.owner === 'legacy').expectedAfter
  } else if (testCase.mutation === 'legacy-owner-incomplete-after') {
    delete value.cases.find((candidate) => candidate.owner === 'legacy').expectedAfter.dom.pressedIds
  } else if (testCase.mutation === 'missing-announcement') {
    delete value.cases.find((candidate) => candidate.owner === 'legacy').expectedAfter.dom.status.text
  } else if (testCase.mutation === 'wrong-announcement') {
    value.cases.find((candidate) => candidate.owner === 'legacy').expectedAfter.dom.status.text = 'wrong announcement'
  } else if (testCase.mutation === 'semantic-selection-mismatch') {
    value.cases.findLast((candidate) => candidate.owner === 'legacy').expectedAfter.semanticState.selectedId = 'web'
  } else if (testCase.mutation === 'semantic-expansion-mismatch') {
    value.cases.findLast((candidate) => candidate.owner === 'legacy').expectedAfter.semanticState.expandedIds = []
  } else if (testCase.mutation === 'null-viewport-missing-transform') {
    delete value.cases.find((candidate) => candidate.owner === 'legacy').expectedBefore.dom.transform
  } else throw new Error(`unknown mutation ${testCase.mutation}`)
  return validateFixture(value, requiredManifest)
}

function parseDocument(text, label) {
  const documents = YAML.parseAllDocuments(text, { strict: true, uniqueKeys: true })
  if (documents.length !== 1) throw new Error(`${label} must contain exactly one YAML document`)
  if (documents[0].errors.length) {
    const message = documents[0].errors.map((error) => error.message).join('; ')
    throw new Error(/keys must be unique/i.test(message) ? `duplicate key: ${message}` : message)
  }
  return documents[0].toJS()
}

function validateManifest(value) {
  requireObject(value, 'manifest')
  requireExactKeys(value, ['expectedCaseCount', 'expectedMutationCount', 'cases', 'mutations'], 'manifest')
  if (!Number.isInteger(value.expectedCaseCount) || value.expectedCaseCount < 1 || !Array.isArray(value.cases) || value.cases.length !== value.expectedCaseCount) throw new Error('manifest case count is inconsistent')
  if (!Number.isInteger(value.expectedMutationCount) || value.expectedMutationCount < 1 || !Array.isArray(value.mutations) || value.mutations.length !== value.expectedMutationCount) throw new Error('manifest mutation count is inconsistent')
  const names = new Set()
  for (const [index, row] of value.cases.entries()) {
    const label = `manifest.cases[${index}]`
    requireObject(row, label)
    requireShape(row, ['name', 'surface', 'action', 'cardinality', 'assertionsAt', 'owner'], ['name', 'surface', 'action', 'cardinality'], label)
    requireUniqueName(row.name, names, 'manifest cases')
    validateSurface(row.surface, `${label}.surface`)
    validateAction(row.action, `${label}.action`)
    validateAssertionsAt(row.assertionsAt, `${label}.assertionsAt`)
    validateOwner(row.owner, `${label}.owner`)
    requireObject(row.cardinality, `${label}.cardinality`)
    requireShape(row.cardinality, [...CARDINALITY_KEYS, ...SNAPSHOT_CARDINALITY_KEYS], CARDINALITY_KEYS, `${label}.cardinality`)
    for (const key of [...CARDINALITY_KEYS, ...SNAPSHOT_CARDINALITY_KEYS]) if (key in row.cardinality && (!Number.isInteger(row.cardinality[key]) || row.cardinality[key] < 0)) throw new Error(`${label}.cardinality.${key} must be a nonnegative integer`)
    const statefulOwner = ['reject', 'legacy'].includes(row.owner)
    if (statefulOwner && (row.cardinality.before !== 1 || row.cardinality.after !== 1 || row.cardinality.announcements !== 2 || row.cardinality.transforms !== 2)) throw new Error(`${label}.cardinality must require complete before and after mounted evidence`)
    if (row.owner === 'reject' && (row.cardinality.ownerStates !== 2 || row.cardinality.semanticStates !== 0)) throw new Error(`${label}.cardinality must require two owner states and no legacy semantic states`)
    if (row.owner === 'legacy' && (row.cardinality.ownerStates !== 0 || row.cardinality.semanticStates !== 2)) throw new Error(`${label}.cardinality must require two legacy semantic states and no owner states`)
    if (!statefulOwner && SNAPSHOT_CARDINALITY_KEYS.some((key) => key in row.cardinality)) throw new Error(`${label}.cardinality snapshots are only valid for stateful owners`)
  }
  const mutationNames = new Set()
  const mutationKinds = new Set()
  for (const [index, row] of value.mutations.entries()) {
    const label = `manifest.mutations[${index}]`
    requireObject(row, label)
    requireExactKeys(row, ['name', 'mutation', 'expectedError'], label)
    requireUniqueName(row.name, mutationNames, 'manifest mutations')
    if (!MUTATION_KINDS.has(row.mutation) || mutationKinds.has(row.mutation)) throw new Error('manifest mutation kinds must be exact and unique')
    mutationKinds.add(row.mutation)
    if (typeof row.expectedError !== 'string' || row.expectedError === '') throw new Error(`${label}.expectedError must be a nonempty literal substring`)
  }
  requireExactSet(mutationKinds, MUTATION_KINDS, 'manifest mutation kinds')
}

function validateFixture(value, requiredManifest) {
  requireObject(value, 'fixture')
  requireExactKeys(value, ['expectedCaseCount', 'payload', 'cases'], 'fixture')
  if (value.expectedCaseCount !== requiredManifest.expectedCaseCount || !Array.isArray(value.cases) || value.cases.length !== requiredManifest.expectedCaseCount) throw new Error(`fixture must contain exactly ${requiredManifest.expectedCaseCount} cases`)
  validatePayload(value.payload)
  const names = new Set()
  const byName = new Map()
  for (const [index, testCase] of value.cases.entries()) {
    const label = `cases[${index}]`
    requireObject(testCase, label)
    requireShape(testCase, ['name', 'surface', 'initialState', 'action', 'expectedStates', 'expectedLegacy', 'expectedAria', 'expectedStructure', 'assertionsAt', 'owner', 'expectedBefore', 'expectedAfter', 'expectedTransformRelation'], ['name', 'surface', 'initialState', 'action', 'expectedStates', 'expectedLegacy', 'expectedAria', 'expectedStructure'], label)
    requireUniqueName(testCase.name, names, 'fixture cases')
    validateSurface(testCase.surface, `${label}.surface`)
    validateAssertionsAt(testCase.assertionsAt, `${label}.assertionsAt`)
    validateOwner(testCase.owner, `${label}.owner`)
    validateState(testCase.initialState, `${label}.initialState`)
    const statefulOwner = ['reject', 'legacy'].includes(testCase.owner)
    if (statefulOwner) {
      if (!('expectedBefore' in testCase)) throw new Error(`${label} stateful owner is missing expectedBefore`)
      if (!('expectedAfter' in testCase)) throw new Error(`${label} stateful owner is missing expectedAfter`)
      if (!['same', 'change'].includes(testCase.expectedTransformRelation)) throw new Error(`${label}.expectedTransformRelation is unsupported`)
      if (testCase.owner === 'reject') {
        validateState(testCase.expectedBefore.ownerState, `${label}.expectedBefore.ownerState`)
        validateState(testCase.expectedAfter.ownerState, `${label}.expectedAfter.ownerState`)
        if (!deepEqual(testCase.expectedBefore.ownerState, testCase.initialState) || !deepEqual(testCase.expectedAfter.ownerState, testCase.initialState)) throw new Error(`${label} rejecting controlled owner must preserve the actual canonical owner state`)
        if (testCase.expectedTransformRelation !== 'same') throw new Error(`${label} rejecting controlled owner must preserve its exact transform`)
      } else {
        validateSemanticState(testCase.expectedBefore.semanticState, `${label}.expectedBefore.semanticState`)
        validateSemanticState(testCase.expectedAfter.semanticState, `${label}.expectedAfter.semanticState`)
        if (!deepEqual(testCase.expectedBefore.semanticState, semanticStateFromCanonical(testCase.initialState))) throw new Error(`${label} legacy before semantic state must match initial state`)
        const reduced = reduceLegacySemanticState(testCase.initialState, testCase.expectedLegacy)
        if (!deepEqual(testCase.expectedAfter.semanticState, reduced)) throw new Error(`${label} legacy after semantic state must match callback reduction`)
      }
      validateEvidenceSnapshot(testCase.expectedBefore, testCase.owner, value.payload, testCase, 'before', `${label}.expectedBefore`)
      validateEvidenceSnapshot(testCase.expectedAfter, testCase.owner, value.payload, testCase, 'after', `${label}.expectedAfter`)
      const transformStayedSame = testCase.expectedBefore.dom.transform === testCase.expectedAfter.dom.transform
      if (transformStayedSame !== (testCase.expectedTransformRelation === 'same')) throw new Error(`${label} transform evidence does not match expectedTransformRelation`)
    } else if ('expectedBefore' in testCase || 'expectedAfter' in testCase || 'expectedTransformRelation' in testCase) throw new Error(`${label} before/after evidence is only valid for stateful owners`)
    if (testCase.owner === 'legacy' && testCase.surface !== 'canvas') throw new Error(`${label} legacy owner is only supported on canvas`)
    validateAction(testCase.action, `${label}.action`)
    if (!Array.isArray(testCase.expectedStates)) throw new Error(`${label}.expectedStates must be an array`)
    for (const [stateIndex, state] of testCase.expectedStates.entries()) validateState(state, `${label}.expectedStates[${stateIndex}]`)
    validateLegacy(testCase.expectedLegacy, `${label}.expectedLegacy`)
    validateAria(testCase.expectedAria, `${label}.expectedAria`)
    validateStructure(testCase.expectedStructure, `${label}.expectedStructure`)
    if (testCase.action.type !== 'assert-only' && isVacuous(testCase)) throw new Error(`${label} must not be vacuous`)
    byName.set(testCase.name, testCase)
  }
  const requiredNames = new Set(requiredManifest.cases.map((row) => row.name))
  if (!setsEqual(names, requiredNames)) throw new Error('manifest case pairing mismatch')
  for (const row of requiredManifest.cases) {
    const testCase = byName.get(row.name)
    if (testCase.surface !== row.surface || (testCase.owner ?? 'accept') !== (row.owner ?? 'accept') || (testCase.assertionsAt ?? 'after') !== (row.assertionsAt ?? 'after') || !deepEqual(testCase.action, row.action)) throw new Error(`manifest case pairing mismatch for ${row.name}`)
    const cardinality = {
      states: testCase.expectedStates.length,
      select: testCase.expectedLegacy.select.length,
      zoom: testCase.expectedLegacy.zoom.length,
      expand: testCase.expectedLegacy.expand.length,
      presentation: testCase.expectedLegacy.presentation.length,
      aria: testCase.expectedAria.length,
      structure: testCase.expectedStructure.length,
      before: testCase.expectedBefore === undefined ? 0 : 1,
      after: testCase.expectedAfter === undefined ? 0 : 1,
      ownerStates: testCase.owner === 'reject' ? 2 : 0,
      semanticStates: testCase.owner === 'legacy' ? 2 : 0,
      announcements: testCase.expectedBefore === undefined ? 0 : 2,
      transforms: testCase.expectedBefore === undefined ? 0 : 2,
    }
    const manifestCardinality = {
      ...row.cardinality,
      before: row.cardinality.before ?? 0,
      after: row.cardinality.after ?? 0,
      ownerStates: row.cardinality.ownerStates ?? 0,
      semanticStates: row.cardinality.semanticStates ?? 0,
      announcements: row.cardinality.announcements ?? 0,
      transforms: row.cardinality.transforms ?? 0,
    }
    if (!deepEqual(cardinality, manifestCardinality)) throw new Error(`manifest cardinality mismatch for ${row.name}`)
  }
}

function validatePayload(payload) {
  requireObject(payload, 'payload')
  requireExactKeys(payload, ['repoFound', 'nodes', 'structureEdges', 'violations'], 'payload')
  if (payload.repoFound !== true || !Array.isArray(payload.nodes) || !Array.isArray(payload.structureEdges) || !Array.isArray(payload.violations)) throw new Error('payload is incomplete')
  const ids = new Set()
  for (const [index, node] of payload.nodes.entries()) {
    requireObject(node, `payload.nodes[${index}]`)
    const allowed = ['id', 'name', 'kind', 'parent', 'loc', 'recordedFiles', 'totalFiles', 'order']
    for (const key of Object.keys(node)) if (!allowed.includes(key)) throw new Error(`payload.nodes[${index}] has unknown field ${key}`)
    if (typeof node.id !== 'string' || node.id === '' || ids.has(node.id)) throw new Error('payload nodes need unique nonempty ids')
    ids.add(node.id)
  }
}

function validateAction(action, label) {
  requireObject(action, label)
  requireExactKeys(action, ['type', 'targets', 'keys'], label)
  const supported = ['click', 'double-click', 'disclosure', 'disclosure-key', 'key-sequence', 'assert-only', 'rapid-click', 'grain-control', 'zoom-control', 'pan']
  if (!supported.includes(action.type)) throw new Error(`${label}.type is unsupported`)
  if (!Array.isArray(action.targets) || action.targets.some((id) => typeof id !== 'string' || id === '')) throw new Error(`${label}.targets must be ids`)
  if (!Array.isArray(action.keys) || action.keys.some((key) => typeof key !== 'string' || key === '')) throw new Error(`${label}.keys must be strings`)
  if (action.type === 'key-sequence' && (action.targets.length === 0 || action.targets.length !== action.keys.length)) throw new Error(`${label} key sequence is incomplete`)
  if (action.type === 'disclosure-key' && (action.targets.length !== 1 || action.keys.length !== 1 || !['Enter', 'Space'].includes(action.keys[0]))) throw new Error(`${label} disclosure key is incomplete`)
  if (['click', 'double-click', 'disclosure', 'assert-only'].includes(action.type) && (action.targets.length !== 1 || action.keys.length !== 0)) throw new Error(`${label} action shape is invalid`)
  if (action.type === 'rapid-click' && (action.targets.length < 2 || action.keys.length !== 0)) throw new Error(`${label} rapid click is incomplete`)
  if (action.type === 'grain-control' && (action.targets.length !== 1 || !['overview', 'folders', 'files'].includes(action.targets[0]) || action.keys.length !== 0)) throw new Error(`${label} grain control is incomplete`)
  if (action.type === 'zoom-control' && (action.targets.length !== 1 || !['zoom in', 'zoom out', 'fit map to view'].includes(action.targets[0]) || action.keys.length !== 2 || action.keys.some((value) => !Number.isFinite(Number(value))))) throw new Error(`${label} zoom control is incomplete`)
  if (action.type === 'pan' && (action.targets.length !== 1 || action.targets[0] !== 'viewport' || action.keys.length !== 4 || action.keys.some((value) => !Number.isFinite(Number(value))))) throw new Error(`${label} pan is incomplete`)
}

function validateState(state, label) {
  requireObject(state, label)
  requireExactKeys(state, STATE_KEYS, label)
  assert.deepEqual(createCodeMapState(state), state, `${label} must be a complete canonical CodeMapState`)
}

function validateEvidenceSnapshot(snapshot, owner, payload, testCase, phase, label) {
  requireObject(snapshot, label)
  if (owner === 'reject') {
    requireExactKeys(snapshot, ['ownerState', 'dom'], label)
    validateState(snapshot.ownerState, `${label}.ownerState`)
  } else {
    requireExactKeys(snapshot, ['semanticState', 'dom'], label)
    validateSemanticState(snapshot.semanticState, `${label}.semanticState`)
  }
  const semantic = owner === 'reject' ? semanticStateFromCanonical(snapshot.ownerState) : snapshot.semanticState
  validateDomEvidence(snapshot.dom, semantic, payload, testCase, phase, `${label}.dom`)
}

function validateSemanticState(state, label) {
  requireObject(state, label)
  requireExactKeys(state, SEMANTIC_STATE_KEYS, label)
  if (state.selectedId !== null && (typeof state.selectedId !== 'string' || state.selectedId === '')) throw new Error(`${label}.selectedId must be a nonempty id or null`)
  if (!['project', 'package', 'file'].includes(state.grain)) throw new Error(`${label}.grain is unsupported`)
  validateIdList(state.expandedIds, `${label}.expandedIds`)
}

function validateDomEvidence(dom, semantic, payload, testCase, phase, label) {
  requireObject(dom, label)
  requireExactKeys(dom, DOM_EVIDENCE_KEYS, label)
  validateIdList(dom.visibleIds, `${label}.visibleIds`)
  validateIdList(dom.pressedIds, `${label}.pressedIds`)
  validateIdList(dom.disclosureExpandedIds, `${label}.disclosureExpandedIds`)
  if (!deepEqual(dom.visibleIds, [...dom.visibleIds].sort())) throw new Error(`${label}.visibleIds must be sorted`)
  if (!deepEqual(dom.pressedIds, [...dom.pressedIds].sort())) throw new Error(`${label}.pressedIds must be sorted`)
  if (dom.grain !== semantic.grain) throw new Error(`${label}.grain must match semantic state`)
  if (typeof dom.transform !== 'string' || !/^translate\(-?\d+(?:\.\d+)?px, -?\d+(?:\.\d+)?px\) scale\(\d+(?:\.\d+)?\)$/.test(dom.transform)) throw new Error(`${label}.transform must be exact rendered transform evidence`)
  requireObject(dom.status, `${label}.status`)
  requireExactKeys(dom.status, ['role', 'ariaLive', 'text'], `${label}.status`)
  if (dom.status.role !== 'status' || dom.status.ariaLive !== 'polite' || typeof dom.status.text !== 'string') throw new Error(`${label}.status must preserve exact status role, aria-live, and text`)
  requireObject(dom.structure, `${label}.structure`)
  requireExactKeys(dom.structure, ['applicationRole', 'applicationLabel', 'roleDescription', 'statusCount'], `${label}.structure`)
  if (!deepEqual(dom.structure, { applicationRole: 'application', applicationLabel: 'code map', roleDescription: 'code structure map', statusCount: 1 })) throw new Error(`${label}.structure must prove the mounted application and sole live region`)
  if (!Array.isArray(dom.disclosures)) throw new Error(`${label}.disclosures must be an array`)
  for (const [index, disclosure] of dom.disclosures.entries()) {
    requireObject(disclosure, `${label}.disclosures[${index}]`)
    requireExactKeys(disclosure, ['id', 'expanded'], `${label}.disclosures[${index}]`)
    if (typeof disclosure.id !== 'string' || disclosure.id === '' || typeof disclosure.expanded !== 'boolean') throw new Error(`${label}.disclosures[${index}] is invalid`)
  }
  if (!deepEqual(dom.disclosures, [...dom.disclosures].sort((left, right) => left.id.localeCompare(right.id)))) throw new Error(`${label}.disclosures must be sorted`)
  if (!deepEqual(dom.disclosureExpandedIds, dom.disclosures.filter((item) => item.expanded).map((item) => item.id))) throw new Error(`${label}.disclosureExpandedIds must match disclosure aria-expanded evidence`)
  const canonical = createCodeMapState({ presentation: 'canvas', selectedId: semantic.selectedId, grain: semantic.grain, expandedIds: semantic.expandedIds })
  const expectedVisibleIds = [...deriveCodeMapView(payload, canonical).canvas.visibleIds].sort()
  if (!deepEqual(dom.visibleIds, expectedVisibleIds)) throw new Error(`${label}.visibleIds must exactly match semantic rendering`)
  const expectedPressedIds = semantic.selectedId && dom.visibleIds.includes(semantic.selectedId) ? [semantic.selectedId] : []
  if (!deepEqual(dom.pressedIds, expectedPressedIds)) throw new Error(`${label}.pressedIds must exactly describe mounted selection markers`)
  const expectedDisclosures = deriveDisclosureEvidence(payload, dom.visibleIds, semantic.expandedIds)
  if (!deepEqual(dom.disclosures, expectedDisclosures)) throw new Error(`${label}.disclosures must exactly describe mounted aria-expanded controls`)
  const expectedAnnouncement = deriveAnnouncement(payload, testCase, semantic, phase)
  if (dom.status.text !== expectedAnnouncement) throw new Error(`${label}.status.text must exactly match the mounted semantic announcement`)
  if (ownerViewport(testCase, phase)) {
    const viewport = ownerViewport(testCase, phase)
    const exact = `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.scale})`
    if (dom.transform !== exact) throw new Error(`${label}.transform must match the canonical owner viewport`)
  }
}

function validateIdList(ids, label) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || id === '') || new Set(ids).size !== ids.length) throw new Error(`${label} must contain unique nonempty ids`)
}

function semanticStateFromCanonical(state) {
  const canonical = createCodeMapState(state)
  return { selectedId: canonical.selectedId, grain: canonical.grain, expandedIds: [...canonical.expandedIds] }
}

function reduceLegacySemanticState(initialState, legacy) {
  const semantic = semanticStateFromCanonical(initialState)
  for (const args of legacy.select) semantic.selectedId = args[0]
  for (const args of legacy.zoom) {
    semantic.grain = args[0].level
    semantic.expandedIds = [...args[0].expanded]
  }
  return semantic
}

function deriveDisclosureEvidence(payload, visibleIds, expandedIds) {
  const childCounts = new Map()
  for (const node of payload.nodes) if (node.parent) childCounts.set(node.parent, (childCounts.get(node.parent) ?? 0) + 1)
  const expanded = new Set(expandedIds)
  return visibleIds.filter((id) => childCounts.has(id)).map((id) => ({ id, expanded: expanded.has(id) }))
}

function deriveAnnouncement(payload, testCase, semantic, phase) {
  if (phase === 'before' || !['click', 'double-click', 'key-sequence'].includes(testCase.action.type)) return ''
  const focusedId = testCase.action.targets.at(-1)
  const node = payload.nodes.find((candidate) => candidate.id === focusedId)
  if (!node) throw new Error(`announcement target ${focusedId} is absent from payload`)
  const kind = node.kind === 'file' ? 'file' : 'folder'
  const coverage = Math.round(4 * node.recordedFiles / node.totalFiles)
  let text = `${node.name || node.id}: ${kind} · coverage ${coverage} of 4`
  if (node.loc) text += ` · ${node.loc} loc`
  if (semantic.selectedId === focusedId) text += ' · selected'
  if (semantic.expandedIds.includes(focusedId)) text += ' · expanded'
  return text
}

function ownerViewport(testCase, phase) {
  if (testCase.owner !== 'reject') return null
  return (phase === 'before' ? testCase.expectedBefore.ownerState : testCase.expectedAfter.ownerState).viewport
}

function validateLegacy(legacy, label) {
  requireObject(legacy, label)
  requireExactKeys(legacy, LEGACY_KEYS, label)
  for (const key of LEGACY_KEYS) if (!Array.isArray(legacy[key]) || legacy[key].some((args) => !Array.isArray(args))) throw new Error(`${label}.${key} must be exact callback argument arrays`)
}

function validateAria(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  for (const [index, aria] of value.entries()) {
    const itemLabel = `${label}[${index}]`
    requireObject(aria, itemLabel)
    requireExactKeys(aria, ['targetId', 'expanded', 'disclosurePresent', 'disclosureDisabled'], itemLabel)
    if (typeof aria.targetId !== 'string' || ![true, false, null].includes(aria.expanded) || typeof aria.disclosurePresent !== 'boolean' || typeof aria.disclosureDisabled !== 'boolean') throw new Error(`${itemLabel} has invalid values`)
  }
}

function validateStructure(value, label) {
  if (!Array.isArray(value) || value.some((item) => !STRUCTURAL_ASSERTIONS.has(item)) || new Set(value).size !== value.length) throw new Error(`${label} must contain unique supported assertions`)
}

function isVacuous(testCase) {
  return testCase.expectedBefore === undefined
    && testCase.expectedAfter === undefined
    && testCase.expectedStates.length === 0
    && LEGACY_KEYS.every((key) => testCase.expectedLegacy[key].length === 0)
    && testCase.expectedAria.length === 0
    && testCase.expectedStructure.length === 0
}

function validateSurface(value, label) {
  if (!['navigator', 'canvas'].includes(value)) throw new Error(`${label} is unsupported`)
}

function validateAssertionsAt(value, label) {
  if (value !== undefined && !['before', 'after'].includes(value)) throw new Error(`${label} is unsupported`)
}

function validateOwner(value, label) {
  if (value !== undefined && !['accept', 'reject', 'legacy'].includes(value)) throw new Error(`${label} is unsupported`)
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
}

function requireExactKeys(value, expected, label) {
  const expectedSet = new Set(expected)
  for (const key of Object.keys(value)) if (!expectedSet.has(key)) throw new Error(`${label} has unknown field ${key}`)
  for (const key of expected) if (!(key in value)) throw new Error(`${label} is missing ${key}`)
}

function requireShape(value, allowed, required, label) {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) throw new Error(`${label} has unknown field ${key}`)
  for (const key of required) if (!(key in value)) throw new Error(`${label} is missing ${key}`)
}

function requireUniqueName(value, names, label) {
  if (typeof value !== 'string' || value.trim() === '' || names.has(value)) throw new Error(`${label} must have unique nonempty names`)
  names.add(value)
}

function requireExactSet(actual, expected, label) {
  if (!setsEqual(actual, expected)) throw new Error(`${label} must match the independent required set`)
}

function setsEqual(left, right) {
  return left.size === right.size && [...right].every((item) => left.has(item))
}

function deepEqual(left, right) {
  try {
    assert.deepEqual(left, right)
    return true
  } catch {
    return false
  }
}
