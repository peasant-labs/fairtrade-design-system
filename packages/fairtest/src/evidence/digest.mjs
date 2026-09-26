// Neutral SHA-256 integrity helpers for evidence artifacts. Bytes are hashed
// with the shared core digest primitive, never a second hashing path, and a
// recorded digest is validated to a lowercase 64-character hex shape before it
// is compared. No runner, service, route, selector, port, or product threshold
// is named here.

import { digestHex } from '../core/measure.mjs'

const DIGEST_PATTERN = /^[0-9a-f]{64}$/

/**
 * SHA-256 hex digest of artifact bytes. A string is hashed as its UTF-8 bytes
 * so a fixture can carry text content without base64 encoding.
 * @param {string | Uint8Array} content artifact bytes
 * @returns {string} lowercase 64-character hex digest
 */
export function artifactDigest(content) {
  if (typeof content !== 'string' && !(content instanceof Uint8Array)) {
    throw new Error(
      `invalid value ${JSON.stringify(typeof content)} for field "content" at path artifact.content; ` +
      'repair: provide a string or Uint8Array for "content".',
    )
  }
  return digestHex(content, 'sha256')
}

/**
 * Byte length of artifact content without materializing a second copy.
 * @param {string | Uint8Array} content artifact bytes
 * @returns {number}
 */
export function artifactByteLength(content) {
  if (typeof content === 'string') return new TextEncoder().encode(content).byteLength
  if (content instanceof Uint8Array) return content.byteLength
  throw new Error(
    `invalid value ${JSON.stringify(typeof content)} for field "content" at path artifact.content; ` +
    'repair: provide a string or Uint8Array for "content".',
  )
}

/**
 * Assert a recorded digest is a lowercase 64-character hex string.
 * @param {unknown} value candidate digest
 * @param {string} path value path used in diagnostics
 * @returns {asserts value is string}
 */
export function assertArtifactDigest(value, path) {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) {
    throw new Error(
      `invalid value ${JSON.stringify(value)} for field "digest" at path ${path}; ` +
      'repair: use a 64 character lowercase hex SHA-256 digest for "digest".',
    )
  }
}
