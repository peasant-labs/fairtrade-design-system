#!/usr/bin/env node
// Fairtest independent selector: writes selection/expected-selection.json.
//
// The selector runs after the inventory/list guards and before the producer. It
// writes ONLY the selection subtree: it never writes a guards/ file. A distinct
// command, selection-receipt.mjs, later reads the finalized selection and
// stamps the guard receipt, so selection and its receipt are separate owners.
// It is browser-free and starts no service.
//
// Invocation: FAIRTEST_RUN_ROOT=<absolute-root> FAIRTEST_RUN_ID=<run-id> pnpm test:fairtest:select
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  FAIRTEST_PROJECT,
  MODE_KEYS,
  RUN_ENVELOPE_REL,
  RUN_ENVELOPE_VERSION,
  SELECTION_REL,
  assertExactKeys,
  assertSelectionMode,
  fileDigest,
  requireEnvelopeForRun,
  resolveRunId,
  resolveRunRoot,
  selectionIdentityDigest,
  writeJsonAtomic,
} from './run-envelope-contract.mjs'

/**
 * Resolve the selection mode. The default is CI; an explicit `--mode` may
 * select local exploration, which the producer never accepts as evidence.
 * @param {string[]} args command arguments
 * @returns {string} the selection mode
 */
export function parseSelectionMode(args) {
  let mode = 'ci'
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg.startsWith('--mode=')) mode = arg.slice('--mode='.length)
    else if (arg === '--mode' && index + 1 < args.length) {
      mode = args[index + 1]
      index += 1
    }
  }
  assertSelectionMode(mode, 'fairtest select')
  return mode
}

/**
 * Build the expected-selection record for one run and mode. The selection
 * digest is a canonical digest of the identity fields, so the record and the
 * receipt can be compared without depending on JSON formatting.
 * @param {{ root: string, runId: string, mode: string, createdAtMs: number }} input selector inputs
 * @returns {Record<string, unknown>} the selection record
 */
export function createExpectedSelection(input) {
  const { root, runId, mode, createdAtMs } = input
  const keys = [...assertExactKeys(mode, MODE_KEYS[mode], 'fairtest select')]
  return {
    version: RUN_ENVELOPE_VERSION,
    runId,
    project: FAIRTEST_PROJECT,
    mode,
    keys,
    keyCount: keys.length,
    qualifiedKeys: keys.map((key) => `${FAIRTEST_PROJECT}::${key}`),
    runEnvelope: RUN_ENVELOPE_REL,
    runEnvelopeDigest: fileDigest(join(root, RUN_ENVELOPE_REL)),
    createdAtMs,
  }
}

/**
 * Run the selector.
 * @returns {number} the process exit code
 */
function main() {
  const mode = parseSelectionMode(process.argv.slice(2))
  const root = resolveRunRoot()
  const runId = resolveRunId()
  requireEnvelopeForRun(root, runId, 'fairtest select')
  const selectionPath = join(root, SELECTION_REL)
  if (existsSync(selectionPath)) {
    throw new Error(
      `fairtest select: prior selection present for field "selection" at path ${SELECTION_REL}; ` +
      `found ${JSON.stringify(selectionPath)}; ` +
      'repair: use a fresh FAIRTEST_RUN_ROOT per run so the selection subtree is written once.',
    )
  }
  const selection = createExpectedSelection({ root, runId, mode, createdAtMs: Date.now() })
  writeJsonAtomic(selectionPath, selection)
  console.log(`fairtest select: wrote the independent ${mode} expected selection`)
  console.log(`  run root   ${root}`)
  console.log(`  run id     ${runId}`)
  console.log(`  keys       ${selection.qualifiedKeys.join(', ')}`)
  console.log(`  selection  ${selectionPath}`)
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
