#!/usr/bin/env node
// Fairtest run-envelope initializer: the first Fairtest command in a run.
//
// It proves the run root is fresh, creates the owned guards/ directory, and
// writes the immutable guards/run-envelope.json that fixes the run id, project,
// the four exclusive subtrees, the declared 24-minute budget, and the pinned
// durable-artifact upload. It is browser-free and starts no service, so it runs
// before any producer. Subsequent owners read the envelope; no later command
// creates, repairs, or deletes it.
//
// Invocation: FAIRTEST_RUN_ROOT=<absolute-root> FAIRTEST_RUN_ID=<run-id> pnpm test:fairtest:init
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  FAIRTEST_BUDGET,
  FAIRTEST_PROJECT,
  RUN_ENVELOPE_REL,
  RUN_ENVELOPE_VERSION,
  RUN_SUBTREES,
  UPLOAD_PIN,
  fileDigest,
  resolveRunId,
  resolveRunRoot,
  writeJsonAtomic,
} from './run-envelope-contract.mjs'

/**
 * Refuse a run root that already carries a prior run. A previous envelope is
 * the strongest signal; a non-empty root without one is also a reused root,
 * which the immutable-subtree model does not allow.
 * @param {string} root resolved run root
 * @returns {void}
 */
function refusePriorRoot(root) {
  const envelopePath = join(root, RUN_ENVELOPE_REL)
  if (existsSync(envelopePath)) {
    throw new Error(
      `fairtest init: prior run envelope present for field "runEnvelope" at path ${RUN_ENVELOPE_REL}; ` +
      `found ${JSON.stringify(envelopePath)}; ` +
      'repair: use a fresh FAIRTEST_RUN_ROOT per run instead of reusing a previous run root.',
    )
  }
  if (existsSync(root)) {
    const entries = readdirSync(root)
    if (entries.length > 0) {
      throw new Error(
        `fairtest init: prior run root is not empty for field "FAIRTEST_RUN_ROOT" at path run.root; ` +
        `found ${JSON.stringify(entries)} in ${JSON.stringify(root)}; ` +
        'repair: use a fresh FAIRTEST_RUN_ROOT per run so each manager owns a clean subtree.',
      )
    }
  }
}

/**
 * Build the immutable envelope record for one run.
 * @param {string} root resolved run root
 * @param {string} runId run identity
 * @param {number} createdAtMs creation time in whole milliseconds
 * @returns {Record<string, unknown>} the envelope record
 */
export function createRunEnvelope(root, runId, createdAtMs) {
  return {
    version: RUN_ENVELOPE_VERSION,
    runId,
    project: FAIRTEST_PROJECT,
    root,
    createdAtMs,
    subtrees: [...RUN_SUBTREES],
    ownership: {
      guards: 'init-fairtest.mjs',
      selection: 'select-fairtest.mjs',
      producer: 'mounted producers',
      evidence: 'verify-fairtest.mjs',
    },
    budget: {
      totalMinutes: FAIRTEST_BUDGET.totalMinutes,
      retries: FAIRTEST_BUDGET.retries,
      journeyHtml: FAIRTEST_BUDGET.journeyHtml,
      deadlineAtMs: createdAtMs + FAIRTEST_BUDGET.totalMinutes * 60 * 1000,
      stages: FAIRTEST_BUDGET.stages.map((stage) => ({ ...stage })),
    },
    upload: { ...UPLOAD_PIN },
  }
}

/**
 * Run the initializer: resolve the run, refuse a prior root, write the
 * envelope, and report the owner and budget.
 * @returns {number} the process exit code
 */
function main() {
  const root = resolveRunRoot()
  const runId = resolveRunId()
  refusePriorRoot(root)
  const createdAtMs = Date.now()
  const envelopePath = join(root, RUN_ENVELOPE_REL)
  writeJsonAtomic(envelopePath, createRunEnvelope(root, runId, createdAtMs))
  console.log('fairtest init: created the immutable run envelope')
  console.log(`  run root   ${root}`)
  console.log(`  run id     ${runId}`)
  console.log(`  subtrees   ${RUN_SUBTREES.join(', ')}`)
  console.log(`  budget     ${FAIRTEST_BUDGET.totalMinutes} minutes, retries ${FAIRTEST_BUDGET.retries}, JOURNEY_HTML=${FAIRTEST_BUDGET.journeyHtml}`)
  console.log(`  envelope   ${envelopePath} (${fileDigest(envelopePath)})`)
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
