// @ts-check
/* column alignment — the closed set a host column declares.

   Alignment is a closed set, not a bare string: each member is a frozen
   `ClosedValue` from `src/ui/closed-value.js`, so a rendered cell compares
   `.wire` and never a raw literal. The table maps every member to the alignment
   vocabulary the data-table boundary already speaks (`left`, `right`, `center`,
   `decimal`) at that boundary only.

   The member list is complete by construction: `ALL_COLUMN_ALIGNS` names every
   member and `column-align.type-test.js` fails when a member is added without
   being listed. A host imports `ColumnAlign` and passes its members. */

import { closed } from '../closed-value.js'

const ColumnAlignValues = Object.freeze({
  Start: closed('start', 'start'),
  End: closed('end', 'end'),
  Center: closed('center', 'center'),
  Decimal: closed('decimal', 'decimal'),
})

/**
 * The alignment a host column declares.
 *
 * - `Start` is left-aligned in a left-to-right grid.
 * - `End` is right-aligned; counts and durations pair it with `numeric`.
 * - `Center` is centered.
 * - `Decimal` right-aligns with tabular numbers. A decimal-point span is
 *   `DataTable`'s own; this table does not export it.
 */
export const ColumnAlign = ColumnAlignValues

/**
 * The member type union; every value member is a `ColumnAlign`.
 * @typedef {(typeof ColumnAlignValues)[keyof typeof ColumnAlignValues]} ColumnAlign
 */

/** Every alignment member, in the order a surface lists them. */
export const ALL_COLUMN_ALIGNS = Object.freeze([
  ColumnAlign.Start,
  ColumnAlign.End,
  ColumnAlign.Center,
  ColumnAlign.Decimal,
])

/**
 * Resolve a persisted or host-supplied alignment to its member.
 *
 * Accepts a member (returned unchanged) or its wire value as a string. A label is
 * not accepted: labels are chrome and may change, while the wire value is the
 * stable identity. An unknown value throws rather than silently defaulting,
 * because a silent default hides a host that drifted from this set.
 *
 * @param {unknown} raw - a `ColumnAlign` member or its wire value.
 * @returns {ColumnAlign}
 */
export function parseColumnAlign(raw) {
  if (isMember(raw)) {
    const member = ALL_COLUMN_ALIGNS.find((candidate) => candidate.wire === raw.wire)
    if (member) return member
    throw refuse(`"${String(raw.wire)}" is not a member`)
  }
  if (typeof raw === 'string') {
    const member = ALL_COLUMN_ALIGNS.find((candidate) => candidate.wire === raw)
    if (member) return member
    throw refuse(`"${raw}" is not a wire value`)
  }
  throw refuse(`received ${describe(raw)}`)
}

/**
 * @param {unknown} value
 * @returns {value is { wire?: unknown }}
 */
function isMember(value) {
  return typeof value === 'object' && value !== null && 'wire' in value
}

/**
 * @param {string} reason
 * @returns {TypeError}
 */
function refuse(reason) {
  return new TypeError(
    `parseColumnAlign failed in src/ui/table/column-align.js: ${reason}. ` +
      "A column alignment is a closed set ('start', 'end', 'center', 'decimal'), so an unknown value would render an unaligned cell. " +
      'Pass ColumnAlign.Start/End/Center/Decimal (or its wire value); do not default to one when the value is unknown.',
  )
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function describe(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return `a ${typeof value}`
}
