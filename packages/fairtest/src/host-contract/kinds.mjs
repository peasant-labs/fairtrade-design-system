// Closed host-kind vocabulary and the shared theme observation shape.
//
// Targets, resolutions, and later evidence records share one
// `product | component` discriminant and one ThemeObservation shape. This
// module describes host expectations only: it executes no browser code and
// names no runner, document object, named route, selector, port, vendored
// fixture, or product threshold.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord } from '../core/values.mjs'

/**
 * @typedef {object} ThemeObservation
 * @property {string} expected theme the row was asked to render, dark or light
 * @property {string} observed theme the host reports as rendered, dark or light
 * @property {string} source caller-owned note naming where the observation came from
 * @property {number} observedAtMs observation time in whole milliseconds
 */

/**
 * Closed host-kind discriminant shared by targets, resolutions, and evidence.
 * @type {string[]}
 */
export const HOST_KINDS = freezeRecord(['product', 'component'])

/**
 * Closed rendered-theme names every observation normalizes to.
 * @type {string[]}
 */
export const THEME_NAMES = freezeRecord(['dark', 'light'])

const MAX_SAFE = 9007199254740991

/**
 * Assert the value names a known host kind.
 * @param {unknown} value
 * @param {string} path value path used in diagnostics
 * @returns {asserts value is string}
 */
export function assertHostKind(value, path) {
  if (!HOST_KINDS.includes(/** @type {string} */ (value))) {
    throw new Error(`invalid host kind ${JSON.stringify(value)} at path ${path}; repair: use one of ${HOST_KINDS.join(', ')} for the host kind.`)
  }
}

/**
 * Validate an unknown value as a theme observation and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {ThemeObservation}
 */
export function validateThemeObservation(value, label) {
  assertExactFields(value, ['expected', 'observed', 'source', 'observedAtMs'], label, 'theme')
  const record = /** @type {Record<string, unknown>} */ (value)
  for (const field of ['expected', 'observed']) {
    if (!THEME_NAMES.includes(/** @type {string} */ (record[field]))) {
      throw new Error(`${label}: invalid theme ${JSON.stringify(record[field])} for field "${field}" at path theme.${field}; repair: use one of ${THEME_NAMES.join(', ')} for "${field}".`)
    }
  }
  assertNonEmptyString(record.source, 'source', 'theme.source')
  assertIntegerInRange(record.observedAtMs, 'observedAtMs', 'theme.observedAtMs', { min: 0, max: MAX_SAFE })
  return freezeRecord({
    expected: record.expected,
    observed: record.observed,
    source: record.source,
    observedAtMs: record.observedAtMs,
  })
}
