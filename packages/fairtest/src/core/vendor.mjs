// Source-vendoring and import policy. A vendor record pins one vendored
// source by name, version, content digest, and origin note. Import policy
// decides which module specifiers a neutral module may name: node builtins
// always, relative paths structurally, and bare specifiers only when the
// caller allowlists them. Path containment keeps resolved files inside one
// root. Uses language builtins only.

import { assertExactFields, assertNonEmptyString, freezeRecord } from './values.mjs'

/**
 * @typedef {object} VendorRecordInput
 * @property {string} name vendored source name
 * @property {string} version vendored source version
 * @property {string} sourceDigest lowercase hex digest of the vendored bytes
 * @property {string} origin where the vendored bytes were taken from
 */

/**
 * @typedef {object} VendorRecord
 * @property {string} name
 * @property {string} version
 * @property {string} sourceDigest
 * @property {string} origin
 */

const NAME_PATTERN = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)?$/
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/
const DIGEST_PATTERN = /^[0-9a-f]{32}$|^[0-9a-f]{64}$/
const NODE_PREFIX = 'node:'

/**
 * Create a frozen vendor record. Throws when any pin is invalid.
 * @param {VendorRecordInput} input
 * @returns {VendorRecord}
 */
export function createVendorRecord(input) {
  assertExactFields(input, ['name', 'version', 'sourceDigest', 'origin'], 'vendor', 'vendor')
  assertNonEmptyString(input.name, 'name', 'vendor.name')
  if (!NAME_PATTERN.test(input.name)) {
    throw new Error(`invalid value ${JSON.stringify(input.name)} for field "name" at path vendor.name; repair: use a lowercase source name for "name".`)
  }
  assertNonEmptyString(input.version, 'version', 'vendor.version')
  if (!VERSION_PATTERN.test(input.version)) {
    throw new Error(`invalid value ${JSON.stringify(input.version)} for field "version" at path vendor.version; repair: use a dotted version such as 1.2.3 for "version".`)
  }
  assertNonEmptyString(input.sourceDigest, 'sourceDigest', 'vendor.sourceDigest')
  if (!DIGEST_PATTERN.test(input.sourceDigest)) {
    throw new Error(`invalid value ${JSON.stringify(input.sourceDigest)} for field "sourceDigest" at path vendor.sourceDigest; repair: use a 32 or 64 character lowercase hex digest for "sourceDigest".`)
  }
  assertNonEmptyString(input.origin, 'origin', 'vendor.origin')
  return freezeRecord({ name: input.name, version: input.version, sourceDigest: input.sourceDigest, origin: input.origin })
}

/**
 * Validate an unknown value as a vendor record and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {VendorRecord}
 */
export function validateVendorRecord(value, label) {
  assertExactFields(value, ['name', 'version', 'sourceDigest', 'origin'], label, 'vendor')
  return createVendorRecord(/** @type {VendorRecordInput} */ (value))
}

/**
 * Return true when a module specifier is allowed under the caller allowlist.
 * Node builtins are always allowed. Relative specifiers are structurally
 * allowed here; root containment is enforced separately by assertWithinRoot.
 * Bare specifiers are allowed only when allowlisted. Absolute paths, drive
 * letters, scheme prefixes, null bytes, and backslashes are never allowed.
 * @param {unknown} specifier
 * @param {string[]} allowlist exact bare specifiers the caller declares
 * @returns {boolean}
 */
export function isAllowedImport(specifier, allowlist) {
  if (typeof specifier !== 'string' || specifier.length === 0) return false
  if (specifier.includes('\0') || specifier.includes('\\')) return false
  if (specifier.startsWith('/')) return false
  if (/^[A-Za-z]:/.test(specifier)) return false
  if (specifier.startsWith(NODE_PREFIX)) return specifier.length > NODE_PREFIX.length
  if (specifier.includes(':')) return false
  if (specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../')) return true
  if (specifier.startsWith('@')) {
    return Array.isArray(allowlist) && allowlist.includes(specifier.split('/').slice(0, 2).join('/'))
  }
  if (specifier.startsWith('.')) return false
  return Array.isArray(allowlist) && allowlist.includes(specifier.split('/')[0])
}

/**
 * Assert a resolved path stays inside a root. Compares normalized strings
 * with a separator boundary so sibling prefixes never satisfy containment.
 * @param {string} resolvedPath normalized resolved file path
 * @param {string} rootPath normalized root directory path
 * @returns {void}
 */
export function assertWithinRoot(resolvedPath, rootPath) {
  assertNonEmptyString(resolvedPath, 'resolvedPath', 'source.resolvedPath')
  assertNonEmptyString(rootPath, 'rootPath', 'source.rootPath')
  const root = rootPath.endsWith('/') ? rootPath : `${rootPath}/`
  if (resolvedPath !== rootPath && !resolvedPath.startsWith(root)) {
    throw new Error(`source route escapes its root at path source.resolvedPath; resolved ${JSON.stringify(resolvedPath)} outside ${JSON.stringify(rootPath)}; repair: resolve the module from inside the declared root.`)
  }
}
