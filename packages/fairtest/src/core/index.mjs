// Neutral core barrel. Re-exports the browser-neutral validation primitives
// only. No runner, viewport, route, label set, or caller threshold is added
// at this layer.

export {
  assertExactFields,
  assertIntegerInRange,
  assertNonEmptyString,
  assertNumberInRange,
  freezeRecord,
  isPlainRecord,
} from './values.mjs'
export { createIdentity, sameIdentity, validateIdentity } from './identity.mjs'
export { checkKeys, checkRequiredNames, checkText, loadSingleDocument } from './fixtures.mjs'
export { countDistinct, digestHex, fractionWhere, summarizeBytes } from './measure.mjs'
export { POLICY_VERSION, createMeasurementPolicy, evaluateMeasurement } from './policy.mjs'
export {
  assertFresh,
  checkDuplicate,
  createDuplicateSet,
  createEvidenceRecord,
  isFresh,
  validateEvidenceRecord,
} from './evidence.mjs'
export { assertWithinRoot, createVendorRecord, isAllowedImport, validateVendorRecord } from './vendor.mjs'
