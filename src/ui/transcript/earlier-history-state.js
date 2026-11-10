// @ts-check
import { closed } from '../closed-value.js'

/** Reader-facing meanings for the contract's earlier-history states. */
export const EarlierHistoryState = Object.freeze({
  Migrated: closed('uncertain_migrated', 'migrated history', { explanation: 'this earlier history was retained during migration. its ownership is uncertain, so it is separate from current turns and input submissions.' }),
  Unresolved: closed('uncertain_unresolved', 'ownership unresolved', { explanation: 'the ownership of this earlier history could not be resolved. it is retained separately from current turns and input submissions.' }),
})

/** @typedef {(typeof EarlierHistoryState)[keyof typeof EarlierHistoryState]} KnownEarlierHistoryState */

/** Every supported state, in display order. */
export const ALL_EARLIER_HISTORY_STATES = Object.freeze([
  EarlierHistoryState.Migrated,
  EarlierHistoryState.Unresolved,
])

/** A future state is kept as evidence, never given another state's meaning. */
export class UnknownEarlierHistoryState {
  /** @param {unknown} wire */
  constructor(wire) {
    this.wire = wire
    this.label = 'unknown history state'
    this.explanation = 'the ownership of this earlier history is not known. it is retained separately from current turns and input submissions.'
    Object.freeze(this)
  }
}

/** @typedef {KnownEarlierHistoryState | UnknownEarlierHistoryState} ParsedEarlierHistoryState */

/** @type {Readonly<Record<string, KnownEarlierHistoryState>>} */
const STATE_BY_WIRE = Object.freeze(Object.fromEntries(ALL_EARLIER_HISTORY_STATES.map(value => [value.wire, value])))

/** @param {unknown} wire @returns {wire is KnownEarlierHistoryState['wire']} */
export function isKnownEarlierHistoryWire(wire) {
  return typeof wire === 'string' && Object.prototype.hasOwnProperty.call(STATE_BY_WIRE, wire)
}

/** @param {unknown} wire @returns {ParsedEarlierHistoryState} */
export function parseEarlierHistoryState(wire) {
  return isKnownEarlierHistoryWire(wire) ? STATE_BY_WIRE[wire] : new UnknownEarlierHistoryState(wire)
}
