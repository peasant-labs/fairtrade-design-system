// Generic measurement helpers. Measurements describe observed bytes, digests,
// and counted samples without deciding what counts as passing. Passing is a
// caller-owned policy applied later. Uses node:crypto and language builtins.

import { createHash } from 'node:crypto'

/**
 * @typedef {object} ByteSummary
 * @property {number} bytes byte length of the input
 * @property {string} sha256 lowercase hex digest of the input bytes
 */

const DIGESTS = new Set(['sha256', 'md5'])

/**
 * Hex digest of a string or byte input with a caller-chosen algorithm.
 * @param {string | Uint8Array} input
 * @param {string} [algorithm] sha256 or md5
 * @returns {string}
 */
export function digestHex(input, algorithm = 'sha256') {
  if (!DIGESTS.has(algorithm)) {
    throw new Error(`invalid value ${JSON.stringify(algorithm)} for field "algorithm" at path digest.algorithm; repair: use one of sha256, md5 for "algorithm".`)
  }
  const bytes = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`invalid value ${typeof input} for field "input" at path digest.input; repair: provide a string or Uint8Array for "input".`)
  }
  return createHash(algorithm).update(bytes).digest('hex')
}

/**
 * Summarize a string or byte input as a frozen byte count plus sha256 digest.
 * @param {string | Uint8Array} input
 * @returns {ByteSummary}
 */
export function summarizeBytes(input) {
  const bytes = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`invalid value ${typeof input} for field "input" at path summary.input; repair: provide a string or Uint8Array for "input".`)
  }
  return Object.freeze({ bytes: bytes.byteLength, sha256: digestHex(bytes, 'sha256') })
}

/**
 * Count distinct sample values with a stable key. Primitives compare by type
 * and value; records and lists compare by their JSON encoding.
 * @param {unknown[]} values
 * @returns {number}
 */
export function countDistinct(values) {
  if (!Array.isArray(values)) {
    throw new Error(`invalid value ${typeof values} for field "values" at path distinct.values; repair: provide a list for "values".`)
  }
  const seen = new Set()
  for (const value of values) {
    const key = value !== null && typeof value === 'object' ? `record:${JSON.stringify(value)}` : `${typeof value}:${String(value)}`
    seen.add(key)
  }
  return seen.size
}

/**
 * Fraction of samples selected by the caller predicate, closed to [0, 1].
 * An empty sample yields 0. The predicate is caller-owned selection logic.
 * @param {unknown[]} values
 * @param {(value: unknown) => boolean} predicate
 * @returns {number}
 */
export function fractionWhere(values, predicate) {
  if (!Array.isArray(values)) {
    throw new Error(`invalid value ${typeof values} for field "values" at path fraction.values; repair: provide a list for "values".`)
  }
  if (typeof predicate !== 'function') {
    throw new Error(`invalid value ${typeof predicate} for field "predicate" at path fraction.predicate; repair: provide a selection function for "predicate".`)
  }
  if (values.length === 0) return 0
  let selected = 0
  for (const value of values) {
    if (predicate(value)) selected += 1
  }
  return selected / values.length
}
