// @ts-check
/* Selection node kind and state: a projection of the schema-owned wire sets.
   The wire values are written once, here, inside closed(). Every consumer uses
   the member, its wire, or its label. The schema package owns membership;
   this module does not define a second set. */

import { closed } from './closed-value.js'

const SelectionNodeKindValues = Object.freeze({
  Project: closed('project', 'project'),
  Group: closed('group', 'group'),
  Branch: closed('branch', 'branch'),
  Session: closed('session', 'session'),
})

const SelectionNodeStateValues = Object.freeze({
  None: closed('none', 'none'),
  Some: closed('some', 'some'),
  All: closed('all', 'all'),
})

/**
 * A node kind in a server-grouped selection forest.
 * @typedef {(typeof SelectionNodeKindValues)[keyof typeof SelectionNodeKindValues]} SelectionNodeKind
 */

/**
 * The tri-state a host has already computed for a node. Ambiguity is `locked`
 * on the node, not a fourth state.
 * @typedef {(typeof SelectionNodeStateValues)[keyof typeof SelectionNodeStateValues]} SelectionNodeState
 */

/** The kind members. Compare `.wire`, never a raw literal. */
export const SelectionNodeKind = SelectionNodeKindValues

/** The state members. Compare `.wire`, never a raw literal. */
export const SelectionNodeState = SelectionNodeStateValues

/** Every kind, in the order a surface lists them. */
export const ALL_SELECTION_NODE_KINDS = Object.freeze([
  SelectionNodeKind.Project,
  SelectionNodeKind.Group,
  SelectionNodeKind.Branch,
  SelectionNodeKind.Session,
])

/** Every state, in the order a surface lists them. */
export const ALL_SELECTION_NODE_STATES = Object.freeze([
  SelectionNodeState.None,
  SelectionNodeState.Some,
  SelectionNodeState.All,
])

/** Built once. Membership is Map.has, so a prototype key cannot enter the set. */
const KIND_BY_WIRE = new Map(ALL_SELECTION_NODE_KINDS.map((member) => [member.wire, member]))

/** Built once. Membership is Map.has, so a prototype key cannot enter the set. */
const STATE_BY_WIRE = new Map(ALL_SELECTION_NODE_STATES.map((member) => [member.wire, member]))

/**
 * A refused kind or state. The message names the set and the legal wires.
 * Nothing is relabeled as the first member.
 */
export class SelectionNodeParseError extends TypeError {
  /**
   * @param {'kind' | 'state'} set which closed set refused the value
   * @param {unknown} raw the value the host supplied
   */
  constructor(set, raw) {
    const members = set === 'kind' ? ALL_SELECTION_NODE_KINDS : ALL_SELECTION_NODE_STATES
    const wires = members.map((member) => member.wire).join(', ')
    const parser = set === 'kind' ? 'parseNodeKind' : 'parseNodeState'
    super(
      `${parser} failed in src/ui/selection-tree-values.js: ${describe(raw)} is not a selection node ${set}. ` +
        `The ${set} set is owned by @peasant-labs/schema and projected here (${wires}); an unknown value is dropped, not relabeled. ` +
        `Pass one of those wire values, or the matching ${set === 'kind' ? 'SelectionNodeKind' : 'SelectionNodeState'} member.`,
    )
    this.name = 'SelectionNodeParseError'
    /** @type {'kind' | 'state'} */
    this.set = set
    this.raw = raw
  }
}

/**
 * Resolve a host-supplied kind to its member.
 *
 * Accepts a member (returned as this module's singleton) or its wire string.
 * A label is not accepted. An unknown value throws; it is never mapped to project.
 *
 * @param {unknown} raw a SelectionNodeKind member or its wire value
 * @returns {SelectionNodeKind}
 */
export function parseNodeKind(raw) {
  return parseClosed(raw, KIND_BY_WIRE, 'kind')
}

/**
 * Resolve a host-supplied state to its member.
 *
 * Accepts a member or its wire string. An unknown value throws; it is never
 * mapped to none.
 *
 * @param {unknown} raw a SelectionNodeState member or its wire value
 * @returns {SelectionNodeState}
 */
export function parseNodeState(raw) {
  return parseClosed(raw, STATE_BY_WIRE, 'state')
}

/**
 * Props SelectionTree reads. Paging, cursors, and storage are not in this set.
 * @type {readonly ['nodes', 'value', 'onSelectionChange', 'ariaLabel']}
 */
export const SELECTION_TREE_PROPS = Object.freeze(['nodes', 'value', 'onSelectionChange', 'ariaLabel'])

/**
 * @template {SelectionNodeKind | SelectionNodeState} Member
 * @param {unknown} raw
 * @param {ReadonlyMap<string, Member>} byWire
 * @param {'kind' | 'state'} set
 * @returns {Member}
 */
function parseClosed(raw, byWire, set) {
  const wire = wireOf(raw)
  if (wire !== null && byWire.has(wire)) {
    const member = byWire.get(wire)
    if (member) return member
  }
  throw new SelectionNodeParseError(set, raw)
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function wireOf(raw) {
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object' && raw !== null && 'wire' in raw && typeof raw.wire === 'string') return raw.wire
  return null
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function describe(value) {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  if (typeof value === 'object') return 'an object'
  return `a ${typeof value}`
}
