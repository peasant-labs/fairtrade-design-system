// Opaque host handles. A handle is an uninterpreted token plus a revoked
// flag. The contract never dereferences the token: it carries no reference,
// callback, instance, or document node, only a caller-opaque string the host
// minted. Anything that looks like a live reference, a path, or a scheme
// fails as an unsafe handle. This module describes handle values only: it
// executes no browser code and names no runner, document object, named
// route, selector, port, vendored fixture, or product threshold.

import { assertExactFields, freezeRecord } from '../core/values.mjs'

/**
 * @typedef {object} OpaqueHandle
 * @property {string} token caller-opaque handle token minted by the host
 * @property {boolean} revoked true once the host withdraws the handle
 */

const HANDLE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

/**
 * Validate an unknown value as an opaque handle and return a frozen copy.
 * Live references, structured tokens, paths, and schemes fail as unsafe.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {OpaqueHandle}
 */
export function validateOpaqueHandle(value, label) {
  assertExactFields(value, ['token', 'revoked'], label, 'handle')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (typeof record.token !== 'string' || !HANDLE_TOKEN_PATTERN.test(record.token)) {
    const shown = typeof record.token === 'string' ? JSON.stringify(record.token) : typeof record.token
    throw new Error(`${label}: unsafe handle token ${shown} for field "token" at path handle.token; repair: provide an opaque token of letters, digits, dash, or underscore for "token".`)
  }
  if (typeof record.revoked !== 'boolean') {
    throw new Error(`${label}: invalid value ${JSON.stringify(record.revoked)} for field "revoked" at path handle.revoked; repair: use true or false for "revoked".`)
  }
  return freezeRecord({ token: record.token, revoked: record.revoked })
}
