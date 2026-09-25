// Observed resolution records: the closed product/component proof union.
//
// A product resolution requires separately observed persistent chrome,
// representative body, route, active section, and mounted view plus the
// common theme observation. A component resolution permits only identity,
// mounted root, the common theme observation, and an optional interaction
// result, and rejects every product-only field. Cross-kind records fail with
// an actionable diagnostic instead of masquerading as the other kind. This
// module describes observed values only: it executes no browser code and
// names no runner, document object, named route, selector, port, vendored
// fixture, or product threshold.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord, isPlainRecord } from '../core/values.mjs'
import { validateThemeObservation } from './kinds.mjs'
import { validateTargetIdentity } from './targets.mjs'

/**
 * @typedef {object} ObservedPart
 * @property {true} observed the part was separately observed
 * @property {number} observedAtMs observation time in whole milliseconds
 */

/**
 * @typedef {object} MountedRoot
 * @property {true} mounted the component root was mounted
 * @property {number} observedAtMs observation time in whole milliseconds
 */

/**
 * @typedef {object} NamedResult
 * @property {string} name caller-owned action or interaction name
 * @property {true} completed the named effect completed
 * @property {number} observedAtMs observation time in whole milliseconds
 */

/**
 * @typedef {object} ProductResolution
 * @property {string} kind always product
 * @property {import('../core/identity.mjs').Identity} identity identity on the product branch
 * @property {ObservedPart} chrome separately observed persistent chrome
 * @property {ObservedPart} body separately observed representative body
 * @property {ObservedPart} route separately observed route
 * @property {ObservedPart} activeSection separately observed active section
 * @property {ObservedPart} view separately observed mounted view
 * @property {import('./kinds.mjs').ThemeObservation} theme normalized theme observation
 * @property {NamedResult} [action] optional completed named action result
 */

/**
 * @typedef {object} ComponentResolution
 * @property {string} kind always component
 * @property {import('../core/identity.mjs').Identity} identity identity on the component branch
 * @property {MountedRoot} root mounted component root
 * @property {import('./kinds.mjs').ThemeObservation} theme normalized theme observation
 * @property {NamedResult} [interaction] optional completed interaction result
 */

/**
 * Fields only a product resolution may carry. A component record holding
 * any of them is a cross-kind masquerade and fails.
 * @type {string[]}
 */
export const PRODUCT_ONLY_FIELDS = freezeRecord(['chrome', 'body', 'route', 'activeSection', 'view'])

const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const MAX_SAFE = 9007199254740991

/**
 * Validate one separately observed product part.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @param {string} path value path used in diagnostics
 * @returns {ObservedPart}
 */
export function validateObservedPart(value, label, path) {
  assertExactFields(value, ['observed', 'observedAtMs'], label, path)
  const record = /** @type {Record<string, unknown>} */ (value)
  if (record.observed !== true) {
    throw new Error(`${label}: unobserved part at path ${path}.observed; repair: observe the part before resolving ${label}.`)
  }
  assertIntegerInRange(record.observedAtMs, 'observedAtMs', `${path}.observedAtMs`, { min: 0, max: MAX_SAFE })
  return freezeRecord({ observed: true, observedAtMs: record.observedAtMs })
}

/**
 * Validate one mounted component root.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @param {string} path value path used in diagnostics
 * @returns {MountedRoot}
 */
export function validateMountedRoot(value, label, path) {
  assertExactFields(value, ['mounted', 'observedAtMs'], label, path)
  const record = /** @type {Record<string, unknown>} */ (value)
  if (record.mounted !== true) {
    throw new Error(`${label}: unmounted root at path ${path}.mounted; repair: mount the component root before resolving ${label}.`)
  }
  assertIntegerInRange(record.observedAtMs, 'observedAtMs', `${path}.observedAtMs`, { min: 0, max: MAX_SAFE })
  return freezeRecord({ mounted: true, observedAtMs: record.observedAtMs })
}

/**
 * Validate one completed named action or interaction result.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @param {string} path value path used in diagnostics
 * @returns {NamedResult}
 */
export function validateNamedResult(value, label, path) {
  assertExactFields(value, ['name', 'completed', 'observedAtMs'], label, path)
  const record = /** @type {Record<string, unknown>} */ (value)
  assertNonEmptyString(record.name, 'name', `${path}.name`)
  if (!NAME_PATTERN.test(/** @type {string} */ (record.name))) {
    throw new Error(`${label}: invalid result name ${JSON.stringify(record.name)} at path ${path}.name; repair: use a lowercase result name up to 64 characters at ${path}.name.`)
  }
  if (record.completed !== true) {
    throw new Error(`${label}: incomplete result at path ${path}.completed; repair: complete the named effect before resolving ${label}.`)
  }
  assertIntegerInRange(record.observedAtMs, 'observedAtMs', `${path}.observedAtMs`, { min: 0, max: MAX_SAFE })
  return freezeRecord({ name: record.name, completed: true, observedAtMs: record.observedAtMs })
}

/**
 * Validate an unknown value as a product resolution and return a frozen copy.
 * Records of the other kind fail instead of masquerading as a product.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {ProductResolution}
 */
export function validateProductResolution(value, label) {
  if (isPlainRecord(value) && 'kind' in value && value.kind !== 'product') {
    throw new Error(`${label}: cross-kind resolution ${JSON.stringify(value.kind)} at path resolution.kind; repair: validate component records with the component resolver and product records with the product resolver.`)
  }
  const fields = isPlainRecord(value) && 'action' in value
    ? ['kind', 'identity', ...PRODUCT_ONLY_FIELDS, 'theme', 'action']
    : ['kind', 'identity', ...PRODUCT_ONLY_FIELDS, 'theme']
  assertExactFields(value, fields, label, 'resolution')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (record.kind !== 'product') {
    throw new Error(`${label}: cross-kind resolution ${JSON.stringify(record.kind)} at path resolution.kind; repair: validate component records with the component resolver and product records with the product resolver.`)
  }
  const identity = validateTargetIdentity(record.identity, 'product', label)
  const parts = {}
  for (const part of PRODUCT_ONLY_FIELDS) {
    parts[part] = validateObservedPart(record[part], label, `resolution.${part}`)
  }
  const theme = validateThemeObservation(record.theme, label)
  const resolved = { kind: 'product', identity, ...parts, theme }
  if ('action' in record) {
    resolved.action = validateNamedResult(record.action, label, 'resolution.action')
  }
  return freezeRecord(resolved)
}

/**
 * Validate an unknown value as a component resolution and return a frozen
 * copy. Product-only fields and records of the other kind fail instead of
 * masquerading as a component.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {ComponentResolution}
 */
export function validateComponentResolution(value, label) {
  if (isPlainRecord(value)) {
    for (const field of PRODUCT_ONLY_FIELDS) {
      if (field in value) {
        throw new Error(`${label}: product-only field "${field}" at path resolution.${field}; repair: remove "${field}" from the component record or validate it with the product resolver.`)
      }
    }
    if ('kind' in value && value.kind !== 'component') {
      throw new Error(`${label}: cross-kind resolution ${JSON.stringify(value.kind)} at path resolution.kind; repair: validate product records with the product resolver and component records with the component resolver.`)
    }
  }
  const fields = isPlainRecord(value) && 'interaction' in value
    ? ['kind', 'identity', 'root', 'theme', 'interaction']
    : ['kind', 'identity', 'root', 'theme']
  assertExactFields(value, fields, label, 'resolution')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (record.kind !== 'component') {
    throw new Error(`${label}: cross-kind resolution ${JSON.stringify(record.kind)} at path resolution.kind; repair: validate product records with the product resolver and component records with the component resolver.`)
  }
  const identity = validateTargetIdentity(record.identity, 'component', label)
  const root = validateMountedRoot(record.root, label, 'resolution.root')
  const theme = validateThemeObservation(record.theme, label)
  const resolved = { kind: 'component', identity, root, theme }
  if ('interaction' in record) {
    resolved.interaction = validateNamedResult(record.interaction, label, 'resolution.interaction')
  }
  return freezeRecord(resolved)
}

/**
 * Validate an unknown value as the closed resolution union, dispatching on
 * the record kind. Unknown kinds fail with the closed vocabulary.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {ProductResolution | ComponentResolution}
 */
export function validateResolution(value, label) {
  if (!isPlainRecord(value)) {
    throw new Error(`${label}: expected a resolution record at path resolution; repair: restore the product or component record in ${label}.`)
  }
  if (value.kind === 'product') return validateProductResolution(value, label)
  if (value.kind === 'component') return validateComponentResolution(value, label)
  throw new Error(`${label}: cross-kind resolution ${JSON.stringify(value.kind)} at path resolution.kind; repair: use one of product, component for the resolution kind.`)
}
