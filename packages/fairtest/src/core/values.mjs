// Strict typed value checks for neutral validation helpers.
//
// Every check throws an actionable Error that names the failing field, the
// value path, and a repair hint. Callers persist those diagnostics in typed
// fixture reports. Uses only language builtins. No page, viewport, runner,
// route, label set, or caller threshold lives here.

/**
 * @typedef {object} RangeOptions
 * @property {number} min
 * @property {number} max
 */

/**
 * Fail with a path-scoped actionable diagnostic.
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  throw new Error(message)
}

/**
 * Return true when the value is a plain record with no prototype behavior.
 * Arrays, null, class instances, and primitives return false.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Assert the value is a plain record holding exactly the declared fields.
 * @param {unknown} value
 * @param {string[]} fields
 * @param {string} label owning document or record name used in diagnostics
 * @param {string} [path] value path used in diagnostics
 * @returns {asserts value is Record<string, unknown>}
 */
export function assertExactFields(value, fields, label, path = 'document') {
  if (!isPlainRecord(value)) {
    fail(`${label}: expected a record with exactly [${fields.join(', ')}] at path ${path}; repair: restore the mapping with exactly those keys.`)
  }
  for (const field of fields) {
    if (!(field in value)) {
      fail(`${label}: missing required field "${field}" at path ${path}; repair: restore "${field}" in ${label}.`)
    }
  }
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) {
      fail(`${label}: unknown field "${key}" at path ${path}; repair: remove "${key}" from ${label}.`)
    }
  }
}

/**
 * Assert the value is a non-empty trimmed string.
 * @param {unknown} value
 * @param {string} field field name used in diagnostics
 * @param {string} path value path used in diagnostics
 * @returns {asserts value is string}
 */
export function assertNonEmptyString(value, field, path) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`invalid value ${JSON.stringify(value)} for field "${field}" at path ${path}; repair: provide a non-empty string for "${field}".`)
  }
}

/**
 * Assert the value is an integer inside the closed range.
 * @param {unknown} value
 * @param {string} field field name used in diagnostics
 * @param {string} path value path used in diagnostics
 * @param {RangeOptions} range closed integer bounds
 * @returns {asserts value is number}
 */
export function assertIntegerInRange(value, field, path, range) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < range.min || value > range.max) {
    fail(`invalid value ${JSON.stringify(value)} for field "${field}" at path ${path}; repair: use an integer from ${range.min} to ${range.max} for "${field}".`)
  }
}

/**
 * Assert the value is a finite number inside the closed range.
 * @param {unknown} value
 * @param {string} field field name used in diagnostics
 * @param {string} path value path used in diagnostics
 * @param {RangeOptions} range closed numeric bounds
 * @returns {asserts value is number}
 */
export function assertNumberInRange(value, field, path, range) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < range.min || value > range.max) {
    fail(`invalid value ${JSON.stringify(value)} for field "${field}" at path ${path}; repair: use a number from ${range.min} to ${range.max} for "${field}".`)
  }
}

/**
 * Assert the value is a list whose every entry is a non-empty string, the
 * shape every id or label inventory in a durable record carries.
 * @param {unknown} value candidate list
 * @param {string} field field name used in diagnostics
 * @param {string} path value path used in diagnostics
 * @returns {asserts value is string[]}
 */
export function assertStringList(value, field, path) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
    fail(`invalid value ${JSON.stringify(value)} for field "${field}" at path ${path}; repair: list non-empty strings for "${field}".`)
  }
}

/**
 * Deep-freeze a plain value tree and return it. Records and lists are frozen
 * recursively so shared identities and policies stay immutable by construction.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function freezeRecord(value) {
  if (Array.isArray(value)) {
    for (const entry of value) freezeRecord(entry)
    return Object.freeze(value)
  }
  if (isPlainRecord(value)) {
    for (const key of Object.keys(value)) freezeRecord(value[key])
    return Object.freeze(value)
  }
  return value
}
