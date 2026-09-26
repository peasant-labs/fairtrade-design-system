#!/usr/bin/env node
// Fairtest inventory command: the first browser-phase Fairtest command.
//
// It proves the exact project-qualified key set for one selection mode before
// any service starts, then writes its own receipt under guards/. The CI
// invocation (`--mode=ci`) must contain exactly the four one-theme producer
// keys and no local identity; the local invocation (`--mode=local`) must
// contain exactly the local exploration keys and no CI identity. It writes no
// producer output and starts no service.
//
// Invocation: FAIRTEST_RUN_ROOT=<absolute-root> FAIRTEST_RUN_ID=<run-id> \
//   pnpm test:fairtest:list:ci | pnpm test:fairtest:list:local
import { join } from 'node:path'
import {
  FAIRTEST_PROJECT,
  MODE_KEYS,
  RUN_ENVELOPE_REL,
  RUN_ENVELOPE_VERSION,
  assertExactKeys,
  inventoryReceiptRel,
  requireEnvelopeForRun,
  fileDigest,
  resolveRunId,
  resolveRunRoot,
  writeJsonAtomic,
} from './run-envelope-contract.mjs'

/**
 * Parse the `--mode=` flag. Only the two declared modes are accepted.
 * @param {string[]} args command arguments
 * @returns {string} the selection mode
 */
export function parseMode(args) {
  let mode = null
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg.startsWith('--mode=')) mode = arg.slice('--mode='.length)
    else if (arg === '--mode' && index + 1 < args.length) {
      mode = args[index + 1]
      index += 1
    }
  }
  if (mode === null) {
    throw new Error(
      'fairtest inventory: missing selection mode for field "mode" at path cli.mode; ' +
      'repair: run with -- --mode=ci or -- --mode=local.',
    )
  }
  if (mode !== 'ci' && mode !== 'local') {
    throw new Error(
      `fairtest inventory: invalid selection mode ${JSON.stringify(mode)} for field "mode" at path cli.mode; ` +
      'repair: use -- --mode=ci or -- --mode=local.',
    )
  }
  return mode
}

/**
 * Qualify one row key with the project identity, so a receipt cannot be
 * mistaken for another runner's inventory.
 * @param {string} key row key
 * @returns {string} the project-qualified identity
 */
export function projectQualifiedKey(key) {
  return `${FAIRTEST_PROJECT}::${key}`
}

/**
 * Build the inventory receipt record.
 * @param {{ root: string, runId: string, mode: string, completedAtMs: number }} input receipt inputs
 * @returns {Record<string, unknown>} the receipt record
 */
export function createInventoryReceipt(input) {
  const { root, runId, mode, completedAtMs } = input
  const keys = [...assertExactKeys(mode, MODE_KEYS[mode], 'fairtest inventory')]
  return {
    version: RUN_ENVELOPE_VERSION,
    runId,
    project: FAIRTEST_PROJECT,
    mode,
    keys,
    keyCount: keys.length,
    qualifiedKeys: keys.map((key) => projectQualifiedKey(key)),
    runEnvelope: RUN_ENVELOPE_REL,
    runEnvelopeDigest: fileDigest(join(root, RUN_ENVELOPE_REL)),
    completedAtMs,
  }
}

/**
 * Run the inventory command for one mode.
 * @returns {number} the process exit code
 */
function main() {
  const mode = parseMode(process.argv.slice(2))
  const root = resolveRunRoot()
  const runId = resolveRunId()
  requireEnvelopeForRun(root, runId, 'fairtest inventory')
  const receipt = createInventoryReceipt({ root, runId, mode, completedAtMs: Date.now() })
  const receiptPath = join(root, inventoryReceiptRel(mode))
  writeJsonAtomic(receiptPath, receipt)
  console.log(`fairtest inventory: validated the exact ${mode} key set before service startup`)
  console.log(`  run root   ${root}`)
  console.log(`  run id     ${runId}`)
  console.log(`  keys       ${receipt.qualifiedKeys.join(', ')}`)
  console.log(`  receipt    ${receiptPath}`)
  return 0
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    process.exit(main())
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
