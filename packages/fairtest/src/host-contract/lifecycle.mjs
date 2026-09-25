// Host lifecycle traces. A trace is the ordered stage list one host reports
// for a single target: declared, then acquired, then ready, then released.
// Traces must follow that canonical order from the opening stage with no
// repeats, skips, or backward moves, so a later adapter can tell an
// acquired host from a released one without executing anything. This module
// describes the lifecycle only: it executes no browser code and names no
// runner, document object, named route, selector, port, vendored fixture,
// or product threshold.

import { assertExactFields, freezeRecord } from '../core/values.mjs'

/**
 * @typedef {object} LifecycleTrace
 * @property {string[]} stages ordered leading run of the canonical stages
 */

/**
 * Canonical lifecycle order every trace follows from the opening stage.
 * @type {string[]}
 */
export const LIFECYCLE_STAGES = freezeRecord(['declared', 'acquired', 'ready', 'released'])

/**
 * Validate an unknown value as a lifecycle trace and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {LifecycleTrace}
 */
export function validateLifecycleTrace(value, label) {
  assertExactFields(value, ['stages'], label, 'lifecycle')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (!Array.isArray(record.stages) || record.stages.length === 0) {
    throw new Error(`${label}: missing lifecycle stages at path lifecycle.stages; repair: declare the trace from "declared" in lifecycle.stages.`)
  }
  for (const [index, entry] of record.stages.entries()) {
    if (typeof entry !== 'string' || !LIFECYCLE_STAGES.includes(entry)) {
      throw new Error(`${label}: unknown lifecycle stage ${JSON.stringify(entry)} at path lifecycle.stages[${index}]; repair: use one of ${LIFECYCLE_STAGES.join(', ')} in lifecycle.stages.`)
    }
  }
  for (const [index, entry] of record.stages.entries()) {
    if (entry !== LIFECYCLE_STAGES[index]) {
      throw new Error(`${label}: lifecycle stage ${JSON.stringify(entry)} breaks canonical order at path lifecycle.stages[${index}]; repair: keep the trace a leading run of ${LIFECYCLE_STAGES.join(', ')} in lifecycle.stages.`)
    }
  }
  return freezeRecord({ stages: freezeRecord([...record.stages]) })
}
