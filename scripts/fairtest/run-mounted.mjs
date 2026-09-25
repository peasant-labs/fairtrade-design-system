#!/usr/bin/env node
// Minimal CLI for the ratified mounted command:
// FAIRTEST_RUN_ROOT=<run-root> pnpm test:fairtest:mounted -- --target=product
//
// Playwright rejects unknown flags such as --target, so this shim consumes
// the target flag, validates it fail-closed, and then runs the one-project
// Fairtest config without forwarding the flag. The component target arrives
// later under the same config; until then only product is valid.
import { spawnSync } from 'node:child_process'

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
  process.exit(2)
}
if (target !== 'product') {
  console.error(
    `fairtest mounted: unknown target ${JSON.stringify(target)} for field "target" at path cli.target; ` +
    'repair: use --target=product (the component target arrives later).',
  )
  process.exit(2)
}
const result = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '--config', 'playwright.fairtest.config.mjs'],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
