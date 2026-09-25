// Generic caller-owned measurement policy. The caller supplies every numeric
// bound; this module validates the policy shape once and evaluates observed
// measurements against it. No default bound, floor, ratio, or count lives
// here, so two callers can hold different thresholds over the same sample.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, assertNumberInRange, freezeRecord } from './values.mjs'

/**
 * @typedef {object} MeasurementPolicyInput
 * @property {number} version policy schema version, currently 1
 * @property {number} minBytes smallest accepted byte count
 * @property {number} minDistinct smallest accepted distinct-sample count
 * @property {number} minFraction smallest accepted selected fraction in [0, 1]
 * @property {number} [maxAgeMs] optional largest accepted evidence age in milliseconds
 */

/**
 * @typedef {object} MeasurementPolicy
 * @property {number} version
 * @property {number} minBytes
 * @property {number} minDistinct
 * @property {number} minFraction
 * @property {number} [maxAgeMs]
 */

/**
 * @typedef {object} MeasurementInput
 * @property {number} bytes observed byte count
 * @property {number} distinct observed distinct-sample count
 * @property {number} fraction observed selected fraction in [0, 1]
 * @property {string} [digest] optional lowercase hex digest of the observed bytes
 * @property {number} [observedAtMs] optional observation time in whole milliseconds
 * @property {number} [nowMs] optional reference time in whole milliseconds
 */

/**
 * @typedef {object} PolicyVerdict
 * @property {boolean} pass true when every bound holds
 * @property {string[]} failures one entry per violated bound, empty on pass
 */

export const POLICY_VERSION = 1
const MAX_SAFE = 9007199254740991
const DIGEST_PATTERN = /^[0-9a-f]{32}$|^[0-9a-f]{64}$/

/**
 * Validate a caller-supplied policy and return it frozen. All numeric bounds
 * are required except maxAgeMs. No bound is defaulted.
 * @param {MeasurementPolicyInput} input
 * @returns {MeasurementPolicy}
 */
export function createMeasurementPolicy(input) {
  const fields = 'maxAgeMs' in Object(input) ? ['version', 'minBytes', 'minDistinct', 'minFraction', 'maxAgeMs'] : ['version', 'minBytes', 'minDistinct', 'minFraction']
  assertExactFields(input, fields, 'policy', 'policy')
  assertIntegerInRange(input.version, 'version', 'policy.version', { min: 1, max: 1 })
  assertIntegerInRange(input.minBytes, 'minBytes', 'policy.minBytes', { min: 0, max: MAX_SAFE })
  assertIntegerInRange(input.minDistinct, 'minDistinct', 'policy.minDistinct', { min: 0, max: MAX_SAFE })
  assertNumberInRange(input.minFraction, 'minFraction', 'policy.minFraction', { min: 0, max: 1 })
  if ('maxAgeMs' in input) {
    assertIntegerInRange(input.maxAgeMs, 'maxAgeMs', 'policy.maxAgeMs', { min: 0, max: MAX_SAFE })
  }
  return freezeRecord({ ...input })
}

/**
 * Evaluate one observed measurement against a caller policy. Returns a frozen
 * verdict listing every violated bound; never throws for a failing sample.
 * @param {MeasurementInput} measurement
 * @param {MeasurementPolicy} policy
 * @returns {PolicyVerdict}
 */
export function evaluateMeasurement(measurement, policy) {
  assertExactFields(policy, Object.keys(policy).includes('maxAgeMs')
    ? ['version', 'minBytes', 'minDistinct', 'minFraction', 'maxAgeMs']
    : ['version', 'minBytes', 'minDistinct', 'minFraction'], 'policy', 'policy')
  const accepted = ['bytes', 'distinct', 'fraction', 'digest', 'observedAtMs', 'nowMs']
  for (const key of Object.keys(measurement)) {
    if (!accepted.includes(key)) {
      throw new Error(`measurement: unknown field "${key}" at path measurement; repair: remove "${key}" from measurement.`)
    }
  }
  for (const key of ['bytes', 'distinct', 'fraction']) {
    if (!(key in measurement)) {
      throw new Error(`measurement: missing required field "${key}" at path measurement; repair: restore "${key}" in measurement.`)
    }
  }
  assertIntegerInRange(measurement.bytes, 'bytes', 'measurement.bytes', { min: 0, max: MAX_SAFE })
  assertIntegerInRange(measurement.distinct, 'distinct', 'measurement.distinct', { min: 0, max: MAX_SAFE })
  assertNumberInRange(measurement.fraction, 'fraction', 'measurement.fraction', { min: 0, max: 1 })
  if (measurement.digest !== undefined) {
    assertNonEmptyString(measurement.digest, 'digest', 'measurement.digest')
    if (!DIGEST_PATTERN.test(measurement.digest)) {
      throw new Error(`invalid value ${JSON.stringify(measurement.digest)} for field "digest" at path measurement.digest; repair: use a 32 or 64 character lowercase hex digest for "digest".`)
    }
  }
  const failures = []
  if (measurement.bytes < policy.minBytes) {
    failures.push(`bytes ${measurement.bytes} is below the caller floor ${policy.minBytes} at path measurement.bytes`)
  }
  if (measurement.distinct < policy.minDistinct) {
    failures.push(`distinct ${measurement.distinct} is below the caller floor ${policy.minDistinct} at path measurement.distinct`)
  }
  if (measurement.fraction < policy.minFraction) {
    failures.push(`fraction ${measurement.fraction} is below the caller floor ${policy.minFraction} at path measurement.fraction`)
  }
  if (policy.maxAgeMs !== undefined) {
    const missing = []
    if (measurement.observedAtMs === undefined) missing.push('observedAtMs')
    if (measurement.nowMs === undefined) missing.push('nowMs')
    if (missing.length > 0) {
      failures.push(`measurement omits ${missing.map((clock) => `"${clock}"`).join(' and ')} required by the caller ceiling ${policy.maxAgeMs} at path ${missing.map((clock) => `measurement.${clock}`).join(', ')}; repair: persist observedAtMs and nowMs in measurement.`)
    } else {
      assertIntegerInRange(measurement.observedAtMs, 'observedAtMs', 'measurement.observedAtMs', { min: 0, max: MAX_SAFE })
      assertIntegerInRange(measurement.nowMs, 'nowMs', 'measurement.nowMs', { min: 0, max: MAX_SAFE })
      if (measurement.observedAtMs > measurement.nowMs || measurement.nowMs - measurement.observedAtMs > policy.maxAgeMs) {
        failures.push(`observation age exceeds the caller ceiling ${policy.maxAgeMs} at path measurement.observedAtMs`)
      }
    }
  }
  return freezeRecord({ pass: failures.length === 0, failures: freezeRecord([...failures]) })
}
