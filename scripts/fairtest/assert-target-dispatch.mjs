// @ts-check

// Source guard: no app module outside the target-declaration and
// view-construction modules may branch on the host kind. The adapter and every
// shared module read behaviour from the target value's own fields (kind, id,
// capabilities, fixtures, actions), so a branch on `kind === 'product'` /
// `kind === 'component'` there would mean a second discriminator that can
// disagree with the target. The declaration modules own the kind literals, and
// the view-construction modules legitimately pick a view per kind.
//
// Browser-free: node builtins only. The named mutation is applied by the
// product-contract suite, which plants a forbidden branch in a scratch
// directory and asserts this guard refuses it.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * App modules allowed to branch on the host kind: the two target-declaration
 * modules that own the kind literals, and the view-construction modules that
 * pick a product or component view. Everything else must read the target
 * value's fields instead.
 * @type {readonly string[]}
 */
export const DISPATCH_ALLOWED_MODULES = Object.freeze([
  'fairtrade-targets.mjs',
  'fairtrade-component-target.mjs',
  'product.journey.mjs',
  'component.journey.mjs',
  'product-producer.mjs',
  'component-producer.mjs',
  'fairtest-dev.mjs',
  'run-mounted.mjs',
])

/**
 * The host-kind branch pattern: any comparison of a `kind` field against the
 * product or component literal, with either equality operator.
 * @type {RegExp}
 */
export const DISPATCH_PATTERN = /\bkind\s*[!=]==?\s*['"](?:product|component)['"]/g

/**
 * Return every host-kind branch in a source string.
 * @param {string} source module source
 * @returns {string[]} the matched branch expressions
 */
export function findTargetKindDispatch(source) {
  return [...source.matchAll(DISPATCH_PATTERN)].map((match) => match[0])
}

/**
 * Assert no app module under the directory branches on the host kind outside
 * the allowed declaration and view-construction modules. Test and type-test
 * files are skipped: their `.kind === '…'` comparisons are fixture-mutation
 * discriminators, not host-kind dispatch.
 * @param {string} directory directory holding the app modules
 * @param {readonly string[]} [allowed] allowed module basenames
 * @returns {{ scanned: string[] }} the modules scanned
 */
export function assertNoTargetKindDispatch(directory, allowed = DISPATCH_ALLOWED_MODULES) {
  const violations = []
  const scanned = []
  for (const name of readdirSync(directory).filter((entry) => entry.endsWith('.mjs')).sort()) {
    if (name === 'assert-target-dispatch.mjs' || allowed.includes(name) || name.endsWith('.test.mjs') || name.endsWith('.type-test.mjs')) continue
    scanned.push(name)
    const hits = findTargetKindDispatch(readFileSync(join(directory, name), 'utf8'))
    if (hits.length > 0) {
      violations.push(`${name} branches on the host kind: ${hits.join(', ')}`)
    }
  }
  if (violations.length > 0) {
    throw new Error(
      'fairtest target dispatch: host-kind branch outside the declaration and view-construction modules at path dispatch; ' +
      `${violations.join('; ')}; ` +
      "repair: read the kind, id, capabilities, fixtures, and actions from the target value's own fields instead of branching on kind.",
    )
  }
  return { scanned }
}
