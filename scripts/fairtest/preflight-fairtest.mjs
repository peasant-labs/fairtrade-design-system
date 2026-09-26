#!/usr/bin/env node
// Fairtest durable-evidence preflight: the always-run completeness check.
//
// It runs after the verifier (and after a producer failure, because CI runs it
// with `if: always()`). It independently reloads the run envelope and every
// receipt owner, confirms the four subtrees and their owned files are present
// and consistent, checks the declared budget has not elapsed, and refuses to
// let an incomplete run read as green. On failure it prints the whole retained
// run root so partial producer output stays visible before the upload step.
// Browser-free; it starts no service.
//
// Invocation: FAIRTEST_RUN_ROOT=<absolute-root> FAIRTEST_RUN_ID=<run-id> pnpm test:fairtest:preflight
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  EVIDENCE_REL,
  FAIRTEST_BUDGET,
  FAIRTEST_PROJECT,
  PRODUCER_ARTIFACT_CLASSES,
  RUN_ENVELOPE_REL,
  RUN_SUBTREES,
  SELECTION_RECEIPT_REL,
  SELECTION_REL,
  assertExactKeys,
  fileDigest,
  inventoryReceiptRel,
  readJsonFile,
  requireEnvelopeForRun,
  resolveRunId,
  resolveRunRoot,
  selectionIdentityDigest,
} from './run-envelope-contract.mjs'

/**
 * List every file under the run root as root-relative posix paths, so a failed
 * preflight shows exactly which partial output is retained for upload.
 * @param {string} root run root
 * @returns {string[]} sorted root-relative file paths
 */
export function listRunRootFiles(root) {
  const found = []
  const walk = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const absolute = join(directory, name)
      if (statSync(absolute).isDirectory()) walk(absolute)
      else found.push(relative(root, absolute).split('\\').join('/'))
    }
  }
  if (existsSync(root)) walk(root)
  return found
}

/**
 * Assert the run root holds exactly the four declared subtrees, one owner
 * each, and no undeclared sibling. An extra top-level entry (a stray
 * diagnostics directory, a future producer writing at the root) would be
 * uploaded by the whole-root upload without being verified, so the observed
 * set must equal RUN_SUBTREES.
 * @param {string} root run root
 * @returns {void}
 */
export function validateRunSubtrees(root) {
  const entries = existsSync(root) ? readdirSync(root, { withFileTypes: true }) : []
  const expected = [...RUN_SUBTREES]
  const observed = entries.map((entry) => entry.name).sort()
  const missing = expected.filter((name) => !entries.some((entry) => entry.name === name && entry.isDirectory()))
  const extra = observed.filter((name) => !expected.includes(name))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `fairtest preflight: undeclared run subtree for field "subtrees" at path run.root; ` +
      `expected exactly ${JSON.stringify(expected)} observed ${JSON.stringify(observed)} ` +
      `missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}; ` +
      'repair: write every owned file inside one of the four declared subtrees and remove any stray top-level entry.',
    )
  }
}

/**
 * Validate the envelope budget record: the stage minutes sum to the total, the
 * run did not overrun the declared deadline, and the run policy matches the
 * declared budget.
 * @param {Record<string, any>} envelope run envelope
 * @param {number} nowMs current time
 * @returns {void}
 */
export function validateBudget(envelope, nowMs) {
  const label = 'fairtest preflight'
  const budget = envelope.budget
  if (!budget || typeof budget !== 'object') {
    throw new Error(
      `${label}: missing budget for field "budget" at path ${RUN_ENVELOPE_REL}.budget; ` +
      'repair: rebuild the run envelope so it records the declared Fairtest budget.',
    )
  }
  const stages = Array.isArray(budget.stages) ? budget.stages : []
  const sum = stages.reduce((total, stage) => total + (typeof stage?.minutes === 'number' ? stage.minutes : 0), 0)
  if (Math.round(sum * 10) !== Math.round(FAIRTEST_BUDGET.totalMinutes * 10)) {
    throw new Error(
      `${label}: budget stages do not sum to the total for field "stages" at path ${RUN_ENVELOPE_REL}.budget.stages; ` +
      `expected ${FAIRTEST_BUDGET.totalMinutes} minutes observed ${sum}; ` +
      'repair: make the stage minutes sum to the declared Fairtest budget.',
    )
  }
  if (budget.retries !== FAIRTEST_BUDGET.retries || budget.journeyHtml !== FAIRTEST_BUDGET.journeyHtml) {
    throw new Error(
      `${label}: run policy drifted for field "retries"/"journeyHtml" at path ${RUN_ENVELOPE_REL}.budget; ` +
      `expected retries ${FAIRTEST_BUDGET.retries} JOURNEY_HTML=${FAIRTEST_BUDGET.journeyHtml} ` +
      `observed retries ${JSON.stringify(budget.retries)} JOURNEY_HTML=${JSON.stringify(budget.journeyHtml)}; ` +
      'repair: keep the bounded no-retry, no-HTML Fairtest policy.',
    )
  }
  if (!Number.isInteger(budget.deadlineAtMs) || budget.deadlineAtMs <= 0) {
    throw new Error(
      `${label}: invalid deadline for field "deadlineAtMs" at path ${RUN_ENVELOPE_REL}.budget.deadlineAtMs; ` +
      'repair: rebuild the run envelope with a numeric deadline.',
    )
  }
  if (nowMs > budget.deadlineAtMs) {
    throw new Error(
      `${label}: Fairtest budget overrun for field "deadlineAtMs" at path ${RUN_ENVELOPE_REL}.budget.deadlineAtMs; ` +
      `deadline ${budget.deadlineAtMs} exceeded by ${nowMs - budget.deadlineAtMs} ms; ` +
      `repair: keep the run inside the declared ${FAIRTEST_BUDGET.totalMinutes}-minute budget.`,
    )
  }
}

/**
 * Validate the CI inventory receipt against the envelope.
 * @param {{ root: string, runId: string, envelopeDigest: string | null }} input validation inputs
 * @returns {void}
 */
export function validateInventoryReceipt(input) {
  const { root, runId, envelopeDigest } = input
  const label = 'fairtest preflight'
  const rel = inventoryReceiptRel('ci')
  const receipt = readJsonFile(join(root, rel), 'inventory-ci-receipt')
  if (receipt.runId !== runId) {
    throw new Error(
      `${label}: inventory receipt belongs to another run for field "runId" at path ${rel}.runId; ` +
      `expected ${JSON.stringify(runId)} observed ${JSON.stringify(receipt.runId)}; ` +
      'repair: re-run pnpm test:fairtest:list:ci for this run.',
    )
  }
  if (receipt.mode !== 'ci') {
    throw new Error(
      `${label}: inventory receipt is not the CI set for field "mode" at path ${rel}.mode; ` +
      `expected "ci" observed ${JSON.stringify(receipt.mode)}; ` +
      'repair: run pnpm test:fairtest:list:ci before the producer.',
    )
  }
  assertExactKeys('ci', receipt.keys, label)
  if (receipt.runEnvelopeDigest !== envelopeDigest) {
    throw new Error(
      `${label}: inventory receipt binds to another envelope for field "runEnvelopeDigest" at path ${rel}.runEnvelopeDigest; ` +
      `expected ${JSON.stringify(envelopeDigest)} observed ${JSON.stringify(receipt.runEnvelopeDigest)}; ` +
      'repair: re-run pnpm test:fairtest:list:ci against the current run envelope.',
    )
  }
}

/**
 * Validate the selection file and its guard receipt against the envelope.
 * @param {{ root: string, runId: string, envelopeDigest: string | null }} input validation inputs
 * @returns {void}
 */
export function validateSelectionAndReceipt(input) {
  const { root, runId, envelopeDigest } = input
  const label = 'fairtest preflight'
  const selectionPath = join(root, SELECTION_REL)
  const selection = readJsonFile(selectionPath, 'expected-selection')
  if (selection.runId !== runId) {
    throw new Error(
      `${label}: expected selection belongs to another run for field "runId" at path ${SELECTION_REL}.runId; ` +
      `expected ${JSON.stringify(runId)} observed ${JSON.stringify(selection.runId)}; ` +
      'repair: re-run the selection commands for this run.',
    )
  }
  if (selection.project !== FAIRTEST_PROJECT) {
    throw new Error(
      `${label}: expected selection names another project for field "project" at path ${SELECTION_REL}.project; ` +
      `expected ${JSON.stringify(FAIRTEST_PROJECT)} observed ${JSON.stringify(selection.project)}; ` +
      'repair: rebuild the selection with the fairtest project identity.',
    )
  }
  // A CI run must be bound to the CI selection, never the local exploration
  // key set. The mode is the record's own declaration, so requiring it here is
  // what keeps a local-mode selection from passing a CI completeness check.
  if (selection.mode !== 'ci') {
    throw new Error(
      `${label}: expected selection is not the CI set for field "mode" at path ${SELECTION_REL}.mode; ` +
      `expected "ci" observed ${JSON.stringify(selection.mode)}; ` +
      'repair: run pnpm test:fairtest:select in the default ci mode so the run selects the four one-theme CI rows.',
    )
  }
  assertExactKeys(selection.mode, selection.keys, label)
  const receipt = readJsonFile(join(root, SELECTION_RECEIPT_REL), 'selection-receipt')
  const expectedDigest = selectionIdentityDigest(selection)
  if (receipt.selectionDigest !== expectedDigest) {
    throw new Error(
      `${label}: selection receipt does not match the selection for field "selectionDigest" at path ${SELECTION_RECEIPT_REL}.selectionDigest; ` +
      `expected ${JSON.stringify(expectedDigest)} observed ${JSON.stringify(receipt.selectionDigest)}; ` +
      'repair: re-run pnpm test:fairtest:selection-receipt over the finalized selection.',
    )
  }
  if (receipt.runEnvelopeDigest !== envelopeDigest) {
    throw new Error(
      `${label}: selection receipt binds to another envelope for field "runEnvelopeDigest" at path ${SELECTION_RECEIPT_REL}.runEnvelopeDigest; ` +
      `expected ${JSON.stringify(envelopeDigest)} observed ${JSON.stringify(receipt.runEnvelopeDigest)}; ` +
      'repair: re-run the selection receipt against the current run envelope.',
    )
  }
}

/**
 * Validate the verifier's durable report: it must belong to this run and be
 * complete with exactly the declared artifact classes. A partial producer is
 * reported, never converted to a pass.
 * @param {{ root: string, runId: string }} input validation inputs
 * @returns {void}
 */
export function validateEvidenceReport(input) {
  const { root, runId } = input
  const label = 'fairtest preflight'
  const report = readJsonFile(join(root, EVIDENCE_REL), 'evidence')
  if (report.runId !== runId) {
    throw new Error(
      `${label}: evidence report belongs to another run for field "runId" at path ${EVIDENCE_REL}.runId; ` +
      `expected ${JSON.stringify(runId)} observed ${JSON.stringify(report.runId)}; ` +
      'repair: re-run pnpm test:fairtest:verify for this run.',
    )
  }
  if (report.complete !== true || report.verdict !== 'pass') {
    throw new Error(
      `${label}: evidence is not complete for field "complete" at path ${EVIDENCE_REL}.complete; ` +
      `complete ${JSON.stringify(report.complete)} verdict ${JSON.stringify(report.verdict)} ` +
      `failureCodes ${JSON.stringify(report.failureCodes)}; ` +
      'repair: re-run the failing producer row and verify again; a partial producer is retained but cannot be green.',
    )
  }
  const classes = Array.isArray(report.artifactClasses) ? report.artifactClasses : []
  if (JSON.stringify([...classes].sort()) !== JSON.stringify([...PRODUCER_ARTIFACT_CLASSES].sort())) {
    throw new Error(
      `${label}: artifact class set drifted for field "artifactClasses" at path ${EVIDENCE_REL}.artifactClasses; ` +
      `expected ${JSON.stringify([...PRODUCER_ARTIFACT_CLASSES])} observed ${JSON.stringify(classes)}; ` +
      'repair: verify the run against the closed six-class producer set.',
    )
  }
}

/**
 * Run the preflight. Collects every missing owned file before failing so the
 * diagnostic names the whole gap, then prints the retained run root.
 * @returns {number} the process exit code
 */
function main() {
  const root = resolveRunRoot()
  const runId = resolveRunId()
  const retained = () => {
    console.log(`  retained run root ${root}:`)
    for (const file of listRunRootFiles(root)) console.log(`    ${file}`)
  }
  try {
    requireEnvelopeForRun(root, runId, 'fairtest preflight')
    const envelope = readJsonFile(join(root, RUN_ENVELOPE_REL), 'run-envelope')
    validateBudget(envelope, Date.now())
    const requiredFiles = [
      RUN_ENVELOPE_REL,
      inventoryReceiptRel('ci'),
      SELECTION_REL,
      SELECTION_RECEIPT_REL,
      EVIDENCE_REL,
    ]
    const missing = requiredFiles.filter((rel) => !existsSync(join(root, rel)))
    if (missing.length > 0) {
      throw new Error(
        `fairtest preflight: missing owned run files for field "ownedFiles" at path run.root; ` +
        `missing ${JSON.stringify(missing)}; ` +
        'repair: run every pre-service command, the producer, and the verifier so each owner writes its subtree before upload.',
      )
    }
    const envelopeDigest = fileDigest(join(root, RUN_ENVELOPE_REL))
    validateRunSubtrees(root)
    validateInventoryReceipt({ root, runId, envelopeDigest })
    validateSelectionAndReceipt({ root, runId, envelopeDigest })
    validateEvidenceReport({ root, runId })
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    retained()
    return 1
  }
  console.log('fairtest preflight: the run root is complete and ready for durable upload')
  console.log(`  run root   ${root}`)
  console.log(`  run id     ${runId}`)
  console.log(`  budget     ${FAIRTEST_BUDGET.totalMinutes} minutes inside the 30-minute job`)
  console.log('  retained run root:')
  for (const file of listRunRootFiles(root)) console.log(`    ${file}`)
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
