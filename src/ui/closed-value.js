// @ts-check
/* closed-value — the shared closed-set factory.
   ─────────────────────────────────────────────────────────────────────────────
   A closed set is a small, known collection of values: a status, a mode, a page
   size, a grouping. JavaScript has no enum that a JS/JSX package can ship, and a
   bare string union is compile-time only, so every consumer ends up writing a raw
   literal. `closed(wire, label)` makes each member a frozen singleton object that
   carries its wire value and its label, and converts with the Go-style hooks:
   `String()` / `toString()` for display and template literals, `toJSON()` for
   persistence and URL state.

   One definition site. A member's wire value is written once, in the object that
   creates it; every consumer uses the member (its `wire`, its `label`, its
   `String()`, or its identity) and never the literal.

   The singleton is intentional: `closed('project', 'project')` returns the same
   frozen object on every call, so identity comparison works even when two modules
   name the same member. The cache key includes the wire's primitive type, so the
   numeric member `25` and the string member `'25'` never alias.

   Fairtrade is JS/JSX. `ClosedValue` is a JSDoc type and the generated
   `dist/lib/types/closed-value.d.ts` is the compile-time check; the runtime guard
   in `closed()` is the boundary check for a non-TypeScript host. */

/**
 * A closed value: a frozen singleton that carries its wire value, the label a
 * surface shows for it, and the conversion hooks.
 *
 * - `wire` is the exact value persisted, compared, and sent on the wire.
 * - `label` is the human-readable text shown for the member.
 * - `String()` is the Go-style explicit text conversion; it returns `String(wire)`.
 * - `toString()` is the text conversion used by `String(value)` and template literals.
 * - `toJSON()` is the persistence conversion used by `JSON.stringify`; it returns `wire`.
 *
 * @template {string | number} W - the exact value persisted, compared, and sent on the wire.
 * @template {string} L - the human-readable label shown for the member.
 * @typedef {{
 *   readonly wire: W,
 *   readonly label: L,
 *   String: () => string,
 *   toString: () => string,
 *   toJSON: () => W,
 * }} ClosedValue
 */

/**
 * Every member created so far, keyed by primitive type, wire, and label. `unknown`
 * keeps the heterogeneous singleton set honest without an `any`.
 *
 * @type {Map<string, unknown>}
 */
const SINGLETONS = new Map()

/**
 * Create — or return the existing — frozen singleton for one closed-set member.
 *
 * @template {string | number} W
 * @template {string} L
 * @param {W} wire - the exact value persisted, compared, and sent on the wire.
 * @param {L} label - the human-readable text shown for the member.
 * @returns {ClosedValue<W, L>} the frozen singleton for this `(wire, label)` pair.
 */
export function closed(wire, label) {
  assertWire(wire)
  assertLabel(label)

  const key = JSON.stringify([typeof wire, wire, label])
  const existing = SINGLETONS.get(key)
  if (existing !== undefined) return /** @type {ClosedValue<W, L>} */ (existing)

  const text = String(wire)
  /** @type {ClosedValue<W, L>} */
  const value = Object.freeze({
    wire,
    label,
    String: () => text,
    toString: () => text,
    toJSON: () => wire,
  })
  SINGLETONS.set(key, value)
  return value
}

/**
 * Refuse a wire that a closed set cannot compare or persist predictably.
 *
 * @param {unknown} wire
 * @returns {void}
 */
function assertWire(wire) {
  if (typeof wire === 'string' && wire.length > 0) return
  if (typeof wire === 'number' && Number.isFinite(wire)) return
  throw new TypeError(
    `closed(wire, label) failed in src/ui/closed-value.js: wire must be a non-empty string or a finite number, received ${describe(wire)}. ` +
      "A closed value's wire is the exact value persisted and compared, so it must be a primitive with a stable identity (for example 'project' or 25). " +
      'Pass the primitive at the member definition.',
  )
}

/**
 * Refuse a missing or non-string label. The label is the only text a surface
 * shows for a member, so a silent default would make two members indistinguishable.
 *
 * @param {unknown} label
 * @returns {void}
 */
function assertLabel(label) {
  if (typeof label === 'string' && label.length > 0) return
  throw new TypeError(
    `closed(wire, label) failed in src/ui/closed-value.js: label must be a non-empty string, received ${describe(label)}. ` +
      'The label is the human-readable text shown for the member, so every member needs its own (for example \'25\' for the numeric wire 25). ' +
      'Pass the label at the member definition.',
  )
}

/**
 * A short, safe description of a refused argument for the error message.
 *
 * @param {unknown} value
 * @returns {string}
 */
function describe(value) {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return String(value)
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return `a ${typeof value}`
}
