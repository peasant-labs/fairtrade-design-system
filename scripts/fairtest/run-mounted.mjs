#!/usr/bin/env node
// Minimal CLI for the ratified mounted command:
// FAIRTEST_RUN_ROOT=<run-root> pnpm test:fairtest:mounted -- --target=product
//
// Playwright rejects unknown flags such as --target, so this shim consumes
// the target flag, validates it fail-closed, and then runs the one-project
// Fairtest config without forwarding the flag. The component target arrives
// later under the same config; until then only product is valid.
//
// REQUIRED-CI MOUNT: DEFERRED. This command is the evidence path for the
// mounted product rows, but no required CI workflow invokes it yet. Declared
// is not the same as enforced, and the banner plus
// MOUNTED_REQUIRED_CI_MOUNT exist so a reader cannot read one as the other.
// Mounting it in required CI is a separate, later change that must also flip
// this status and the case in the product fixture family that reads it.
import { spawnSync } from 'node:child_process'

/**
 * What this command is, and what it is not yet. `status: 'declared-not-ci'`
 * is the observable statement that the command exists and runs locally but is
 * not yet enforced by any required CI workflow; `enforcedBy` names who owns
 * the remaining mount without pretending it is done.
 * @type {{ status: string, enforcedBy: string, reason: string }}
 */
export const MOUNTED_REQUIRED_CI_MOUNT = Object.freeze({
  status: 'declared-not-ci',
  enforcedBy: 'the Fairtest required-CI job, in the change that mounts it',
  reason: 'no required CI workflow invokes this command yet, so a green CI run does not yet prove it',
})

/**
 * Parse and validate the target flag, print the command banner, and hand off
 * to Playwright with the exit status. Only reached when this module is the
 * entry point, so an import of the declared mount record never runs the CLI.
 * @returns {number} the process exit code
 */
function main() {
  const args = process.argv.slice(2)
  let target = null
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length)
    } else if (arg === '--target' && index + 1 < args.length) {
      target = args[index + 1]
      index += 1
    }
  }
  if (!target) {
    console.error(
      'fairtest mounted: missing target for field "target" at path cli.target; ' +
      'repair: run with -- --target=product.',
    )
    return 2
  }
  if (target !== 'product') {
    console.error(
      `fairtest mounted: unknown target ${JSON.stringify(target)} for field "target" at path cli.target; ` +
      'repair: use --target=product (the component target arrives later).',
    )
    return 2
  }
  for (const line of [
    'fairtest mounted: running the row-scoped product rows through the one-project Playwright config',
    '  precondition: pnpm build first and FAIRTEST_RUN_ROOT set, so dist/ holds the exact built app',
    `  required-ci mount: ${MOUNTED_REQUIRED_CI_MOUNT.status} (${MOUNTED_REQUIRED_CI_MOUNT.reason})`,
  ]) {
    console.log(line)
  }
  const result = spawnSync(
    'pnpm',
    ['exec', 'playwright', 'test', '--config', 'playwright.fairtest.config.mjs'],
    { stdio: 'inherit' },
  )
  return result.status ?? 1
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exit(main())
}
