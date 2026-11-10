#!/usr/bin/env node
/* Closed-set projection and schema drift for selection node kind and state.
   Cases live in scripts/testdata/selection-node-values.yaml. */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import * as schema from '@peasant-labs/schema'
import YAML from 'yaml'
import { assertExactNames } from './css-source.mjs'
import {
  ALL_SELECTION_NODE_KINDS,
  ALL_SELECTION_NODE_STATES,
  parseNodeKind,
  parseNodeState,
  SelectionNodeKind,
  SelectionNodeParseError,
  SelectionNodeState,
} from '../src/ui/selection-tree-values.js'

const fixture = YAML.parse(readFileSync(new URL('./testdata/selection-node-values.yaml', import.meta.url), 'utf8'))
const manifest = YAML.parse(readFileSync(new URL('./testdata/selection-node-values.manifest.yaml', import.meta.url), 'utf8'))
assertExactNames(fixture.kinds.map((row) => row.name), manifest.requiredKindNames, 'selection node kinds')
assertExactNames(fixture.states.map((row) => row.name), manifest.requiredStateNames, 'selection node states')
assertExactNames(fixture.unknown.map((row) => row.name), manifest.requiredUnknownNames, 'selection node unknown values')

const failures = []
checkMembers('kind', fixture.kinds, SelectionNodeKind, ALL_SELECTION_NODE_KINDS, parseNodeKind)
checkMembers('state', fixture.states, SelectionNodeState, ALL_SELECTION_NODE_STATES, parseNodeState)

for (const row of fixture.unknown) {
  const parse = row.set === 'kind' ? parseNodeKind : parseNodeState
  let error
  try {
    parse(row.raw)
  } catch (cause) {
    error = cause
  }
  if (!(error instanceof SelectionNodeParseError) || error.set !== row.set || !error.message.includes('src/ui/selection-tree-values.js') || !error.message.includes('not relabeled')) {
    failures.push(`${row.name}: unknown ${row.set} must throw SelectionNodeParseError naming the member and refusing a relabel`)
  }
}

const component = readFileSync(new URL('../src/ui/SelectionTree.jsx', import.meta.url), 'utf8')
for (const comparison of fixture.forbiddenComparisons) {
  if (component.includes(comparison)) failures.push(`SelectionTree.jsx compares a raw literal (${comparison}); use the member`)
}

const schemaKinds = schema[fixture.schema.kindExport]
const schemaStates = schema[fixture.schema.stateExport]
if (Array.isArray(schemaKinds) && Array.isArray(schemaStates)) {
  compareBothWays('kind', schemaKinds, ALL_SELECTION_NODE_KINDS.map((member) => member.wire))
  compareBothWays('state', schemaStates, ALL_SELECTION_NODE_STATES.map((member) => member.wire))
} else {
  const declared = schemaDeclaration()
  const kindType = fixture.schema.kindType
  const stateType = fixture.schema.stateType
  if (declared.includes(`export type ${kindType}`) || declared.includes(`export declare const ${fixture.schema.kindExport}`) || declared.includes(`export type ${stateType}`) || declared.includes(`export declare const ${fixture.schema.stateExport}`)) {
    failures.push(`schema declares ${kindType} or ${stateType} but does not export ${fixture.schema.kindExport} and ${fixture.schema.stateExport} as arrays`)
  }
  const surprise = Object.keys(schema).filter((name) => /kickstart/i.test(name) && /node/i.test(name))
  if (surprise.length > 0) {
    failures.push(`schema exports kickstart node names ${surprise.join(', ')} but not ${fixture.schema.kindExport}; the both-ways check cannot see them`)
  }
}

if (failures.length > 0) {
  console.error([
    'selection node values failed.',
    'What went wrong: the kind or state projection drifted from its fixture or from the schema set.',
    'Why it happened: a member, label, parser, or schema export no longer matches the closed set.',
    'Where: src/ui/selection-tree-values.js and scripts/testdata/selection-node-values.yaml.',
    `When: focused projection check (${failures.join('; ')}).`,
    'What it means: a host can relabel an unknown node or drop a schema member.',
    'How to fix: keep one frozen member per schema wire, parse at the boundary, and compare both ways against the schema All* export.',
  ].join('\n'))
  process.exit(1)
}

console.log(`selection node values: ${fixture.kinds.length} kinds, ${fixture.states.length} states, ${fixture.unknown.length} refusals, schema drift ${Array.isArray(schemaKinds) ? 'compared' : 'armed'}.`)

/**
 * @param {string} label
 * @param {{ name: string, wire: string, label: string }[]} rows
 * @param {Record<string, { wire: string, label: string }>} table
 * @param {readonly { wire: string, label: string }[]} all
 * @param {(raw: unknown) => { wire: string }} parse
 */
function checkMembers(label, rows, table, all, parse) {
  if (all.length !== rows.length || rows.some((row, index) => all[index] !== table[row.name])) {
    failures.push(`${label}: ALL_ list must be the fixture order and the same member objects`)
  }
  for (const row of rows) {
    const member = table[row.name]
    if (!member || member.wire !== row.wire || member.label !== row.label) {
      failures.push(`${label} ${row.name}: wire/label expected ${row.wire}/${row.label}`)
      continue
    }
    if (parse(row.wire) !== member || parse(member) !== member) {
      failures.push(`${label} ${row.name}: parser must return the frozen member for the wire and the member`)
    }
    if (!Object.isFrozen(member)) failures.push(`${label} ${row.name}: member must be frozen`)
  }
}

/**
 * @param {string} label
 * @param {readonly string[]} schemaWires
 * @param {readonly string[]} clientWires
 */
function compareBothWays(label, schemaWires, clientWires) {
  const missing = schemaWires.filter((wire) => !clientWires.includes(wire))
  const extra = clientWires.filter((wire) => !schemaWires.includes(wire))
  if (missing.length || extra.length || schemaWires.length !== clientWires.length) {
    failures.push(`${label}: schema wires ${JSON.stringify(schemaWires)} and client wires ${JSON.stringify(clientWires)} differ`)
  }
}

/**
 * @returns {string}
 */
function schemaDeclaration() {
  const require = createRequire(import.meta.url)
  const entry = require.resolve('@peasant-labs/schema')
  const root = dirname(entry)
  const files = ['index.d.ts', join('internal', 'generated', 'enums.gen.d.ts')]
  return files.map((file) => {
    try {
      return readFileSync(join(root, file), 'utf8')
    } catch {
      return ''
    }
  }).join('\n')
}
