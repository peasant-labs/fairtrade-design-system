#!/usr/bin/env node
// @ts-check

// Minimal CLI for the ratified mounted command:
// FAIRTEST_RUN_ROOT=<absolute-root> FAIRTEST_RUN_ID=<run-id> \
//   pnpm test:fairtest:mounted -- --target=all
// FAIRTEST_RUN_ROOT=<absolute-root> FAIRTEST_RUN_ID=<run-id> \
//   pnpm test:fairtest:mounted -- --target=product
// FAIRTEST_RUN_ROOT=<absolute-root> FAIRTEST_RUN_ID=<run-id> \
//   pnpm test:fairtest:mounted -- --target=component
//
// All three variables name the same run, and the run envelope must already
// exist for that root: run `FAIRTEST_RUN_ROOT=<absolute-root> FAIRTEST_RUN_ID=<run-id>
// pnpm test:fairtest:init` first. The producer reads the envelope and refuses a
// root whose final path segment is not the run id, so a fresh root fails closed
// with that diagnostic rather than writing an unowned subtree.
//
// Playwright rejects unknown flags such as --target, so this shim consumes
// the target flag, validates it fail-closed, and then runs the one-project
// Fairtest config. `all` runs both journeys in one invocation so product and
// component rows share the worker pool; `product` and `component` select one
// journey with Playwright's first-class --grep for focused local runs. Both
// journeys live under the same config; no second config, project, or catalog is
// added.
//
// REQUIRED-CI MOUNT: ENFORCED. The Fairtest required-CI job in
// .github/workflows/ci.yml invokes this command once with --target=all after
// the clean app and Storybook builds, so every mounted row is enforced rather
// than merely declared.
import { spawnSync } from 'node:child_process'
import { parseTarget } from './fairtrade-adapter.mjs'

/**
 * The declared targets and the exact describe-title prefix each one selects.
 * One list, read by the grep argument and by the suite case that pins each
 * prefix to its journey's real describe title, so the declaration cannot drift
 * from what actually runs.
 * @type {{ product: string, component: string }}
 */
export const MOUNTED_TARGET_GREPS = Object.freeze({
  product: 'fairtest mounted product',
  component: 'fairtest mounted component',
})

/**
 * The one target that runs both journeys in a single Playwright invocation.
 * It is not a grep target: `all` passes no --grep, so Playwright schedules both
 * files through the one project and the configured worker pool.
 * @type {string}
 */
export const MOUNTED_ALL_TARGET = 'all'

/**
 * What this command is. `status: 'mounted'` is the observable statement that a
 * required CI workflow invokes the command; `enforcedBy` names the job that
 * mounts it, and the mounted-command fixture case requires a workflow to
 * reference this command while the status is not `declared-not-ci`.
 * @type {{ status: string, enforcedBy: string, reason: string }}
 */
export const MOUNTED_REQUIRED_CI_MOUNT = Object.freeze({
  status: 'mounted',
  enforcedBy: '"Fairtest mounted producer" in .github/workflows/ci.yml',
  reason: 'a required CI workflow invokes this command with --target=all, so a green CI run proves both mounted journeys ran',
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
      'repair: run with -- --target=all, -- --target=product, or -- --target=component.',
    )
    return 2
  }
  let kind = null
  try {
    kind = target === MOUNTED_ALL_TARGET ? MOUNTED_ALL_TARGET : parseTarget(target, 'cli.target').kind
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 2
  }
  for (const line of [
    `fairtest mounted: running the ${kind === MOUNTED_ALL_TARGET ? 'product and component' : kind} rows through the one-project Playwright config`,
    kind === MOUNTED_ALL_TARGET
      ? '  precondition: pnpm build and pnpm build-storybook first, then pnpm test:fairtest:init for this FAIRTEST_RUN_ROOT and FAIRTEST_RUN_ID, so both built trees are the exact served bytes'
      : kind === 'product'
        ? '  precondition: pnpm build first, then pnpm test:fairtest:init for this FAIRTEST_RUN_ROOT and FAIRTEST_RUN_ID, so dist/ holds the exact built app'
        : '  precondition: pnpm build-storybook first, then pnpm test:fairtest:init for this FAIRTEST_RUN_ROOT and FAIRTEST_RUN_ID, so storybook-static/ holds the exact built story',
    `  required-ci mount: ${MOUNTED_REQUIRED_CI_MOUNT.status} (${MOUNTED_REQUIRED_CI_MOUNT.reason})`,
  ]) {
    console.log(line)
  }
  const playwrightArgs = ['exec', 'playwright', 'test', '--config', 'playwright.fairtest.config.mjs']
  if (kind !== MOUNTED_ALL_TARGET) {
    const grep = kind === 'product' ? MOUNTED_TARGET_GREPS.product : MOUNTED_TARGET_GREPS.component
    playwrightArgs.push('--grep', grep)
  }
  const result = spawnSync('pnpm', playwrightArgs, { stdio: 'inherit' })
  return result.status ?? 1
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exit(main())
}
