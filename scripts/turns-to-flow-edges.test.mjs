#!/usr/bin/env node
/* turnsToFlow topology test — the trajectory graph's data-layer guarantee.
   ────────────────────────────────────────────────────────────────────────────
   The trajectory graph must emit every connector from DATA ALONE, even when a
   presentation-layer container makes those connectors invisible. A collapsing
   container can hide correctly computed edges; that must never be confused with
   a topology failure in `turnsToFlow`.

   So this exercises `turnsToFlow` — the pure transform that decides which nodes
   and edges exist — directly: no DOM, no CSS, no `@xyflow/react` render, and
   therefore no container or width dependency whatsoever. If a change ever drops
   an edge (sequential, turn-to-tool, spawn, or return) or mis-classifies one,
   this fails regardless of how any consumer sizes its container.

   It imports the SOURCE module (not dist), so it runs as part of `test:gates`
   BEFORE the library build, and a broken mapper stops the build early.

   Cases live in scripts/testdata/turns-to-flow-edges.yaml; the scenarios that
   must never be deleted are named in the sibling .manifest.yaml.

   Run: `pnpm test:turns-to-flow-edges` (also wired into `pnpm test:gates`). */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { turnsToFlow } from '../src/ui/transcript/graph/engine/turnsToFlow.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = join(ROOT, 'scripts', 'testdata', 'turns-to-flow-edges.yaml')
const MANIFEST = join(ROOT, 'scripts', 'testdata', 'turns-to-flow-edges.manifest.yaml')

const CANONICAL_ROLES = new Set(['user', 'assistant', 'system', 'tool'])
const CASE_FIELDS = [
  'name',
  'description',
  'turns',
  'expectedNodeCount',
  'expectedEdgeCount',
  'expectedSequentialEdgeCount',
  'expectedToolEdgeCount',
  'expectedEdgeIds',
  'expectedEdgeTypes',
]
const OPTIONAL_CASE_FIELDS = new Set(['expectedEdgeTypes'])

/** @type {string[]} */
const failures = []

/**
 * Parse one YAML document, refusing anything that is not a plain object.
 * @param {string} path
 * @param {string} label
 * @returns {Record<string, unknown>}
 */
function loadYamlObject(path, label) {
  const value = YAML.parse(readFileSync(path, 'utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} (${path}) must parse to a YAML mapping`)
  }
  return value
}

/**
 * Reject unknown and missing keys, so a typo in a fixture is loud instead of silent.
 * @param {Record<string, unknown>} record
 * @param {readonly string[]} allowed
 * @param {Set<string>} optional
 * @param {string} label
 */
function requireFields(record, allowed, optional, label) {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) failures.push(`${label}: unknown field "${key}"`)
  }
  for (const key of allowed) {
    if (!optional.has(key) && !(key in record)) failures.push(`${label}: missing field "${key}"`)
  }
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {boolean}
 */
function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    failures.push(`${label} must be a non-empty string`)
    return false
  }
  return true
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function requireNonNegativeInteger(value, label) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    failures.push(`${label} must be a safe non-negative integer`)
  }
}

/** Load, validate, and return the fixture's cases. */
function loadCases() {
  const root = loadYamlObject(FIXTURE, 'turns-to-flow edges fixture')
  const manifest = loadYamlObject(MANIFEST, 'turns-to-flow edges manifest')

  requireFields(root, ['cases'], new Set(), 'fixture root')
  requireFields(manifest, ['requiredNames'], new Set(), 'manifest root')

  const requiredNames = manifest.requiredNames
  if (!Array.isArray(requiredNames) || requiredNames.length === 0) {
    failures.push('manifest requiredNames must be a non-empty array of case names')
  } else if (new Set(requiredNames).size !== requiredNames.length) {
    failures.push('manifest requiredNames must not repeat a name')
  }

  const cases = root.cases
  if (!Array.isArray(cases) || cases.length === 0) {
    failures.push('fixture cases must be a non-empty array')
    return { cases: [], requiredNames: [] }
  }

  for (const [index, row] of cases.entries()) {
    const label = `fixture cases[${index}]`
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      failures.push(`${label} must be a mapping`)
      continue
    }
    requireFields(row, CASE_FIELDS, OPTIONAL_CASE_FIELDS, label)
    requireNonEmptyString(row.name, `${label}.name`)
    requireNonEmptyString(row.description, `${label}.description`)
    requireNonNegativeInteger(row.expectedNodeCount, `${label}.expectedNodeCount`)
    requireNonNegativeInteger(row.expectedEdgeCount, `${label}.expectedEdgeCount`)
    requireNonNegativeInteger(row.expectedSequentialEdgeCount, `${label}.expectedSequentialEdgeCount`)
    requireNonNegativeInteger(row.expectedToolEdgeCount, `${label}.expectedToolEdgeCount`)
    if (!Array.isArray(row.expectedEdgeIds)) failures.push(`${label}.expectedEdgeIds must be an array`)
    if (!Array.isArray(row.turns) || row.turns.length === 0) {
      failures.push(`${label}.turns must be a non-empty array`)
      continue
    }
    for (const [ti, turn] of row.turns.entries()) {
      requireNonNegativeInteger(turn?.index, `${label}.turns[${ti}].index`)
      requireNonNegativeInteger(turn?.depth, `${label}.turns[${ti}].depth`)
      requireNonEmptyString(turn?.content, `${label}.turns[${ti}].content`)
      if (!CANONICAL_ROLES.has(turn?.role)) {
        failures.push(`${label}.turns[${ti}].role must be one of ${[...CANONICAL_ROLES].join(', ')}`)
      }
    }
  }

  const names = cases.map((c) => c?.name)
  if (new Set(names).size !== names.length) failures.push('fixture case names must be unique')
  for (const required of Array.isArray(requiredNames) ? requiredNames : []) {
    if (!names.includes(required)) {
      failures.push(
        `fixture is missing required case "${required}" — the manifest protects it from deletion; restore the case or remove it from the manifest deliberately`,
      )
    }
  }

  return { cases, requiredNames: Array.isArray(requiredNames) ? requiredNames : [] }
}

/**
 * Turn a fixture row into the canonical wire shape the mapper consumes.
 * @param {Record<string, any>} fixture
 */
function toTurnDetail(fixture) {
  return {
    index: fixture.index,
    depth: fixture.depth,
    role: fixture.role,
    content: fixture.content,
    timestamp: '2024-01-01T00:00:00.000Z',
    toolCalls: fixture.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
      result: tc.result,
    })),
  }
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} label
 */
function expectEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const { cases, requiredNames } = loadCases()

for (const testCase of cases) {
  const label = `case "${testCase?.name}"`
  const turns = (testCase.turns ?? []).map(toTurnDetail)
  const { nodes, edges } = turnsToFlow({
    turns,
    phases: [],
    annotations: [],
    searchMatches: [],
    filteredIndices: new Set(),
  })

  expectEqual(nodes.length, testCase.expectedNodeCount, `${label}: node count`)
  expectEqual(edges.length, testCase.expectedEdgeCount, `${label}: edge count`)
  expectEqual([...edges.map((e) => e.id)].sort(), [...testCase.expectedEdgeIds].sort(), `${label}: edge ids`)

  const sequentialEdges = edges.filter((e) => e.data?.edgeType === 'sequential')
  const toolEdges = edges.filter((e) => e.sourceHandle === 'tool-source')
  expectEqual(sequentialEdges.length, testCase.expectedSequentialEdgeCount, `${label}: sequential edge count`)
  expectEqual(toolEdges.length, testCase.expectedToolEdgeCount, `${label}: tool edge count`)

  for (const [edgeId, expectedType] of Object.entries(testCase.expectedEdgeTypes ?? {})) {
    const edge = edges.find((e) => e.id === edgeId)
    if (!edge) {
      failures.push(`${label}: edge "${edgeId}" must exist so its type can be classified`)
      continue
    }
    expectEqual(edge.data?.edgeType, expectedType, `${label}: edge "${edgeId}" type`)
  }

  // Every edge must reference a node that actually exists — a real node-link
  // graph, not a dangling reference (which renders as an invisible or broken
  // connector regardless of container width: the same "renders but is not a
  // real graph" defect class).
  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) failures.push(`${label}: edge "${edge.id}" source "${edge.source}" is not a real node`)
    if (!nodeIds.has(edge.target)) failures.push(`${label}: edge "${edge.id}" target "${edge.target}" is not a real node`)
  }
}

if (failures.length) {
  console.error(
    [
      'turnsToFlow topology test FAILED in scripts/turns-to-flow-edges.test.mjs.',
      'What went wrong: the trajectory-graph mapper emitted the wrong nodes, edges, or edge classification:',
      ...failures.map((f) => `  - ${f}`),
      'Why it matters: the graph must be a complete node-link graph from data alone; a dropped or',
      'mis-typed edge is a topology defect that no container or stylesheet change can explain away.',
      'Where: src/ui/transcript/graph/engine/turnsToFlow.js, with cases in',
      'scripts/testdata/turns-to-flow-edges.yaml (protected by turns-to-flow-edges.manifest.yaml).',
      'How to fix: repair the mapper, or update the fixture case if the topology change is intended,',
      'then rerun `pnpm test:turns-to-flow-edges`.',
    ].join('\n'),
  )
  process.exit(1)
}

console.log(
  `turnsToFlow topology: ${cases.length} fixture case(s) passed; ${requiredNames.length} required scenario(s) present.`,
)
