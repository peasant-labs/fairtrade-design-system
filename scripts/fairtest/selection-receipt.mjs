#!/usr/bin/env node
// Fairtest selection receipt: the distinct validator of the expected selection.
//
// This is deliberately NOT the selector. The selector writes only
// selection/expected-selection.json. This command independently reloads that
// finalized file, re-derives the expected identity from the run envelope and
// the closed key policy, and writes guards/selection-receipt.json with the
// selection digest it computed. The selector never writes a guards/ file, so
// the guard receipt can never be forged by the producer path. Browser-free; it
// starts no service.
//
// Invocation: FAIRTEST_RUN_ROOT=<absolute-root> FAIRTEST_RUN_ID=<run-id> pnpm test:fairtest:selection-receipt
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  FAIRTEST_PROJECT,
  RUN_ENVELOPE_REL,
  RUN_ENVELOPE_VERSION,
  SELECTION_RECEIPT_REL,
  SELECTION_REL,
  assertExactKeys,
  assertSelectionMode,
  fileDigest,
  readJsonFile,
  requireEnvelopeForRun,
  resolveRunId,
  resolveRunRoot,
  selectionIdentityDigest,
  writeJsonAtomic,
} from './run-envelope-contract.mjs'

/**
 * Independently validate one expected-selection record against the envelope
 * and the closed key policy. Returns the validated record or throws.
 * @param {{ root: string, runId: string, selection: Record<string, any>, envelopeDigest: string | null }} input validation inputs
 * @returns {Record<string, any>} the validated selection
 */
export function validateExpectedSelection(input) {
  const { runId, selection, envelopeDigest } = input
  const label = 'fairtest selection-receipt'
  if (selection.version !== RUN_ENVELOPE_VERSION) {
    throw new Error(
      `${label}: unsupported selection version ${JSON.stringify(selection.version)} for field "version" at path ${SELECTION_REL}.version; ` +
      `repair: rewrite the selection with version ${RUN_ENVELOPE_VERSION}.`,
    )
  }
  if (selection.runId !== runId) {
    throw new Error(
      `${label}: selection belongs to another run for field "runId" at path ${SELECTION_REL}.runId; ` +
      `expected ${JSON.stringify(runId)} observed ${JSON.stringify(selection.runId)}; ` +
      'repair: re-run pnpm test:fairtest:select for this run before stamping its receipt.',
    )
  }
  if (selection.project !== FAIRTEST_PROJECT) {
    throw new Error(
      `${label}: selection names another project for field "project" at path ${SELECTION_REL}.project; ` +
      `expected ${JSON.stringify(FAIRTEST_PROJECT)} observed ${JSON.stringify(selection.project)}; ` +
      'repair: rebuild the selection with the fairtest project identity.',
    )
  }
  assertSelectionMode(selection.mode, label)
  assertExactKeys(selection.mode, selection.keys, label)
  const qualified = selection.keys.map((key) => `${FAIRTEST_PROJECT}::${key}`)
  if (JSON.stringify(selection.qualifiedKeys) !== JSON.stringify(qualified)) {
    throw new Error(
      `${label}: project-qualified identities drifted for field "qualifiedKeys" at path ${SELECTION_REL}.qualifiedKeys; ` +
      `expected ${JSON.stringify(qualified)} observed ${JSON.stringify(selection.qualifiedKeys)}; ` +
      `repair: qualify every key as ${FAIRTEST_PROJECT}::<key>.`,
    )
  }
  if (selection.runEnvelopeDigest !== envelopeDigest) {
    throw new Error(
      `${label}: selection binds to another run envelope for field "runEnvelopeDigest" at path ${SELECTION_REL}.runEnvelopeDigest; ` +
      `expected ${JSON.stringify(envelopeDigest)} observed ${JSON.stringify(selection.runEnvelopeDigest)}; ` +
      'repair: re-run select against the current run envelope.',
    )
  }
  return selection
}

/**
 * Build the guard receipt for one validated selection.
 * @param {{ runId: string, selection: Record<string, any>, envelopeDigest: string | null, completedAtMs: number }} input receipt inputs
 * @returns {Record<string, unknown>} the receipt record
 */
export function createSelectionReceipt(input) {
  const { runId, selection, envelopeDigest, completedAtMs } = input
  return {
    version: RUN_ENVELOPE_VERSION,
    runId,
    project: FAIRTEST_PROJECT,
    mode: selection.mode,
    keys: [...selection.keys],
    keyCount: selection.keyCount,
    qualifiedKeys: [...selection.qualifiedKeys],
    selection: SELECTION_REL,
    selectionDigest: selectionIdentityDigest(selection),
    runEnvelope: RUN_ENVELOPE_REL,
    runEnvelopeDigest: envelopeDigest,
    status: 'valid',
    completedAtMs,
  }
}

/**
 * Run the receipt command.
 * @returns {number} the process exit code
 */
function main() {
  const root = resolveRunRoot()
  const runId = resolveRunId()
  requireEnvelopeForRun(root, runId, 'fairtest selection-receipt')
  const selectionPath = join(root, SELECTION_REL)
  if (!existsSync(selectionPath)) {
    throw new Error(
      `fairtest selection-receipt: missing expected selection for field "selection" at path ${SELECTION_REL}; ` +
      `looked for ${JSON.stringify(selectionPath)}; ` +
      'repair: run pnpm test:fairtest:select before stamping the selection receipt.',
    )
  }
  const receiptPath = join(root, SELECTION_RECEIPT_REL)
  if (existsSync(receiptPath)) {
    throw new Error(
      `fairtest selection-receipt: prior receipt present for field "selectionReceipt" at path ${SELECTION_RECEIPT_REL}; ` +
      `found ${JSON.stringify(receiptPath)}; ` +
      'repair: use a fresh FAIRTEST_RUN_ROOT per run so the receipt is stamped once.',
    )
  }
  const envelopeDigest = fileDigest(join(root, RUN_ENVELOPE_REL))
  const selection = validateExpectedSelection({
    root,
    runId,
    selection: readJsonFile(selectionPath, 'expected-selection'),
    envelopeDigest,
  })
  const receipt = createSelectionReceipt({ runId, selection, envelopeDigest, completedAtMs: Date.now() })
  writeJsonAtomic(receiptPath, receipt)
  console.log('fairtest selection-receipt: validated the independent selection and stamped the guard receipt')
  console.log(`  run root   ${root}`)
  console.log(`  run id     ${runId}`)
  console.log(`  selection  ${receipt.selectionDigest}`)
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
