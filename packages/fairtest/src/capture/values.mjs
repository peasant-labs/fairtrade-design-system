// @ts-check

// Shared capture value assertions and closed vocabularies.
//
// The capture model names one lowercase-name shape, one target-kind
// vocabulary, one width bound, and one timestamp bound in exactly one place, so
// the case document, the capture record, the served-build record, and the sheet
// plan cannot drift apart on the shape they accept. It executes no page code
// and names no runner, document object, or scheme address.

import { assertNonEmptyString, freezeRecord } from '../core/values.mjs'

/**
 * The lowercase-name shape every caller-owned capture name uses.
 * @type {RegExp}
 */
export const CAPTURE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

/**
 * Largest accepted viewport width. One bound, shared by the case document and
 * the capture record.
 * @type {number}
 */
export const CAPTURE_MAX_WIDTH = 100000

/**
 * Largest accepted whole-millisecond timestamp.
 * @type {number}
 */
export const CAPTURE_MAX_MILLISECONDS = 9007199254740991

/**
 * Closed target-kind vocabulary: a probe read, its hover treatment, a keyboard
 * focus representative, and the full region shot.
 * @type {readonly string[]}
 */
export const CAPTURE_TARGET_KINDS = freezeRecord(['probe', 'hover', 'focus', 'surface'])

/**
 * Assert a caller-owned capture name matches the shared lowercase-name shape.
 * @param {unknown} value
 * @param {string} field field name used in diagnostics
 * @param {string} path value path used in diagnostics
 * @returns {asserts value is string}
 */
export function assertCaptureName(value, field, path) {
  assertNonEmptyString(value, field, path)
  if (!CAPTURE_NAME_PATTERN.test(value)) {
    throw new Error(
      `invalid value ${JSON.stringify(value)} for field "${field}" at path ${path}; ` +
      `repair: use a lowercase name up to 64 characters for "${field}".`,
    )
  }
}
