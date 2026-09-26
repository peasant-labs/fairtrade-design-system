#!/usr/bin/env node
// The one required command that runs the whole Fairtest host contract.
//
// Six suites carry that contract, and before this command existed none of them
// was named by a package script, a CI step, or a runner-inventory row, so a
// later deletion of the rendered-view predicate or of the preparation ordering
// left every required gate green. This file is the single declaration of that
// command graph:
//
//   scripts/fairtest/product-adapter.test.mjs      host modules, registry, and
//                                                   the product fixture family
//                                                   (which owns the ten named
//                                                   real mutations)
//   scripts/fairtest/product-mutations.test.mjs    the negative-mutation suite's
//                                                   own non-mutation cases and
//                                                   the real absence proof
//   scripts/fairtest/component-adapter.test.mjs    the component target registry
//                                                   and the component fixture
//                                                   family (which owns the named
//                                                   executable mutations)
//   scripts/journey/lib/helper-ownership.test.mjs  journey helper export
//                                                   ownership
//   scripts/journey/lib/journey-compat.test.mjs    journey helper compatibility
//                                                   and vendored-tree proof
//   scripts/surface-preservation.test.mjs          SurfaceGate and specialized
//                                                   probe preservation
//
// Execution is a single `node --test` invocation over all six, with
// --test-concurrency=1. That flag is not cosmetic: two of these suites open
// real browsers and throwaway loopback listeners, and Node's default runs test
// FILES concurrently, so one suite's scratch listener can hold the port another
// suite is about to bind. Every scratch port now comes from the single owner in
// fairtest-runtime.mjs, which hands out a port only after verifying it is free,
// and the serial file order removes the remaining same-instant race.
//
// Preconditions (declared, not assumed): `pnpm build` first, because the
// browser-backed cases read the real built app out of dist/.
//
// REQUIRED-CI MOUNT: DEFERRED. This command is required in the runner inventory
// and runnable from a clean checkout, but no required CI workflow invokes it
// yet. Declared is not the same as enforced, and this banner plus
// PRODUCT_CONTRACT_REQUIRED_CI_MOUNT exist so a reader cannot read one as the
// other. Mounting it in required CI is a separate, later change that must also
// flip this status and the case in the product fixture family that reads it.
import { spawnSync } from 'node:child_process'
import { FAIRTEST_REPO_ROOT } from './fairtest-runtime.mjs'

/**
 * The six suites this command owns, in execution order. One list, read by the
 * banner, by the node argument list, and by the product fixture family case
 * that proves the command is reachable, so the declaration cannot drift from
 * what actually runs.
 * @type {string[]}
 */
export const PRODUCT_CONTRACT_SUITES = Object.freeze([
  'scripts/fairtest/product-adapter.test.mjs',
  'scripts/fairtest/product-mutations.test.mjs',
  'scripts/fairtest/component-adapter.test.mjs',
  'scripts/journey/lib/helper-ownership.test.mjs',
  'scripts/journey/lib/journey-compat.test.mjs',
  'scripts/surface-preservation.test.mjs',
])

/**
 * The exact node arguments that execute the declared suites: one test
 * invocation, one file at a time. `--test-concurrency=1` is the reason the two
 * browser-backed suites can share a single invocation instead of colliding on
 * scratch ports.
 * @type {string[]}
 */
export const PRODUCT_CONTRACT_NODE_ARGS = Object.freeze([
  '--test',
  '--test-concurrency=1',
  ...PRODUCT_CONTRACT_SUITES,
])

/**
 * What this command is, and what it is not yet. `status: 'declared-not-ci'` is
 * the observable statement that the command graph exists and runs locally but
 * is not yet enforced by any required CI workflow; `enforcedBy` names who owns
 * the remaining mount without pretending it is done.
 * @type {{ status: string, enforcedBy: string, reason: string }}
 */
export const PRODUCT_CONTRACT_REQUIRED_CI_MOUNT = Object.freeze({
  status: 'declared-not-ci',
  enforcedBy: 'the Fairtest required-CI job, in the change that mounts it',
  reason: 'no required CI workflow invokes this command yet, so a green CI run does not yet prove it',
})

/**
 * Print the command's own help: what it runs, how it runs it, its
 * precondition, and the deferred required-CI mount.
 * @returns {string[]} the banner lines
 */
function banner() {
  return [
    'fairtest product contract: running the whole host contract in one node --test invocation',
    ...PRODUCT_CONTRACT_SUITES.map((suite) => `  suite  ${suite}`),
    `  exec  node ${PRODUCT_CONTRACT_NODE_ARGS.join(' ')}`,
    '  precondition: pnpm build first, so dist/ holds the exact built app',
    `  required-ci mount: ${PRODUCT_CONTRACT_REQUIRED_CI_MOUNT.status} (${PRODUCT_CONTRACT_REQUIRED_CI_MOUNT.reason})`,
  ]
}

/**
 * Run the declared suites and exit with the test runner's own status, so a
 * failing case fails the command.
 * @returns {number} the process exit code
 */
function main() {
  for (const line of banner()) {
    console.log(line)
  }
  const result = spawnSync(process.execPath, [...PRODUCT_CONTRACT_NODE_ARGS], {
    cwd: FAIRTEST_REPO_ROOT,
    stdio: 'inherit',
  })
  if (result.error) {
    console.error(
      `fairtest product contract: cannot start the test runner for field "nodeArgs" at path command.nodeArgs; ` +
      `caused by ${result.error instanceof Error ? result.error.message : String(result.error)}; ` +
      'repair: keep the declared node --test invocation runnable from a clean checkout.',
    )
    return 1
  }
  return result.status ?? 1
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exit(main())
}
