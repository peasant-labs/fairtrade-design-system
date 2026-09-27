// @ts-check

// Closed host-kind vocabulary and the shared theme observation shape.
//
// Targets, resolutions, and later evidence records share one
// `product | component` discriminant and one ThemeObservation shape. This
// module describes host expectations only: it executes no browser code and
// names no runner, document object, named route, selector, port, vendored
// fixture, or product threshold.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord } from '../core/values.mjs'

/**
 * Closed host-kind discriminant shared by targets, resolutions, and evidence.
 * The literal-union typedef is derived from this one declaration, so a wrong
 * literal fails to compile and no second vocabulary can drift.
 */
export const HOST_KINDS = freezeRecord(/** @type {const} */ (['product', 'component']))

/** @typedef {(typeof HOST_KINDS)[number]} HostKind */

/**
 * Closed rendered-theme names every observation normalizes to.
 */
export const THEME_NAMES = freezeRecord(/** @type {const} */ (['dark', 'light']))

/** @typedef {(typeof THEME_NAMES)[number]} ThemeName */

/**
 * @typedef {object} ThemeObservation
 * @property {ThemeName} expected theme the row was asked to render, dark or light
 * @property {ThemeName} observed theme the host reports as rendered, dark or light
 * @property {string} source caller-owned note naming where the observation came from
 * @property {number} observedAtMs observation time in whole milliseconds
 */

const MAX_SAFE = 9007199254740991

/**
 * Assert the value names a known host kind.
 * @param {unknown} value
 * @param {string} path value path used in diagnostics
 * @returns {asserts value is HostKind}
 */
export function assertHostKind(value, path) {
  if (!/** @type {readonly string[]} */ (HOST_KINDS).includes(/** @type {string} */ (value))) {
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
    if (!/** @type {readonly string[]} */ (THEME_NAMES).includes(/** @type {string} */ (record[field]))) {
      throw new Error(`${label}: invalid theme ${JSON.stringify(record[field])} for field "${field}" at path theme.${field}; repair: use one of ${THEME_NAMES.join(', ')} for "${field}".`)
    }
  }
  assertNonEmptyString(record.source, 'source', 'theme.source')
  assertIntegerInRange(record.observedAtMs, 'observedAtMs', 'theme.observedAtMs', { min: 0, max: MAX_SAFE })
  return freezeRecord({
    expected: /** @type {ThemeName} */ (record.expected),
    observed: /** @type {ThemeName} */ (record.observed),
    source: record.source,
    observedAtMs: record.observedAtMs,
  })
}
