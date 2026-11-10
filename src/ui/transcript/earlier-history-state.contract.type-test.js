// @ts-check
import { ALL_EARLIER_HISTORY_STATES, EarlierHistoryState, parseEarlierHistoryState } from './earlier-history-state.js'

/** @typedef {import('./earlier-history-state.js').KnownEarlierHistoryState} State */
/** @typedef {import('@peasant-labs/schema').EarlierHistoryState} SchemaState */
/** @typedef {Exclude<State, (typeof ALL_EARLIER_HISTORY_STATES)[number]>} Missing */
/** @typedef {Exclude<SchemaState, State['wire']>} MissingWire */
/** @typedef {Exclude<State['wire'], SchemaState>} ExtraWire */
/** @type {Missing extends never ? true : never} */
const allMembers = true
/** @type {MissingWire extends never ? true : never} */
const coversSchema = true
/** @type {ExtraWire extends never ? true : never} */
const noExtraWire = true
/** @type {'uncertain_migrated'} */
const wire = EarlierHistoryState.Migrated.wire
/** @type {import('./earlier-history-state.js').ParsedEarlierHistoryState} */
const parsed = parseEarlierHistoryState(wire)
void allMembers; void coversSchema; void noExtraWire; void parsed
