// The single declaration of the Fairtest run envelope.
//
// One immutable run root carries exactly four exclusive subtrees. Each subtree
// has exactly one owner, and an owner may create or finalize only its own
// subtree:
//
//   guards/     init-fairtest.mjs (run-envelope.json) and the receipt commands
//               (inventory-<mode>-receipt.json, selection-receipt.json)
//   selection/  select-fairtest.mjs (expected-selection.json)
//   producer/   the mounted product and component producers
//   evidence/   verify-fairtest.mjs (evidence.json)
//
// This module owns every path, key set, budget line, and upload pin those
// owners share, so no command re-spells a path or invents a second key set.
// It is browser-free and starts no service. The one root variable is
// FAIRTEST_RUN_ROOT; the one identity variable is FAIRTEST_RUN_ID.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { FAIRTEST_EVIDENCE_ROW_KEYS } from './fairtest-evidence-policy.mjs'
import { ARTIFACT_CLASSES } from './fairtest-artifacts.mjs'

/**
 * Run-envelope schema version written into every envelope and receipt.
 * @type {number}
 */
export const RUN_ENVELOPE_VERSION = 1

/**
 * The one project identity every row and receipt carries. A second project is
 * a second runner, which this envelope does not allow.
 * @type {string}
 */
export const FAIRTEST_PROJECT = 'fairtest'

/**
 * The four exclusive run subtrees, in ownership order. Exactly these, no
 * extras: an undeclared sibling directory is not part of the envelope.
 * @type {string[]}
 */
export const RUN_SUBTREES = Object.freeze(['guards', 'selection', 'producer', 'evidence'])

/** @type {string} */
export const GUARDS_DIR = 'guards'
/** @type {string} */
export const SELECTION_DIR = 'selection'
/** @type {string} */
export const PRODUCER_DIR = 'producer'
/** @type {string} */
export const EVIDENCE_DIR = 'evidence'

/**
 * The immutable run-envelope record, owned by init-fairtest.mjs.
 * @type {string}
 */
export const RUN_ENVELOPE_REL = `${GUARDS_DIR}/run-envelope.json`

/**
 * The independent expected selection, owned by select-fairtest.mjs.
 * @type {string}
 */
export const SELECTION_REL = `${SELECTION_DIR}/expected-selection.json`

/**
 * The selection receipt, owned by the distinct selection-receipt.mjs command.
 * The selector never writes a guards/ file; a separate command validates the
 * finalized selection and stamps this receipt.
 * @type {string}
 */
export const SELECTION_RECEIPT_REL = `${GUARDS_DIR}/selection-receipt.json`

/**
 * The verifier's durable report, owned by verify-fairtest.mjs.
 * @type {string}
 */
export const EVIDENCE_REL = `${EVIDENCE_DIR}/evidence.json`

/**
 * The closed six-class producer artifact set the envelope preflight checks the
 * verifier report against. It is the ONE shared constant, imported from its
 * owner in fairtest-artifacts.mjs so the preflight and the producers can never
 * read two different lists.
 * @type {string[]}
 */
export const PRODUCER_ARTIFACT_CLASSES = ARTIFACT_CLASSES

/**
 * The exact one-theme CI row keys. Derived, not re-spelled: the evidence policy
 * owns the required producer rows, and the inventory command must select
 * exactly those. A drift between the two fails at the envelope test.
 * @type {string[]}
 */
export const CI_ROW_KEYS = Object.freeze([...FAIRTEST_EVIDENCE_ROW_KEYS])

/**
 * The local exploration keys. They are a distinct set from the CI keys and are
 * never selected as producer evidence; `fairtest dev` (a later slice) generates
 * its own local identity. Declared here so the local list command can prove the
 * exact set and that no local key leaks into CI.
 * @type {string[]}
 */
export const LOCAL_ROW_KEYS = Object.freeze(['local-product-dark', 'local-product-light'])

/**
 * The exact expected key set for each selection mode. The CI set is the only
 * one that may produce evidence.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const MODE_KEYS = Object.freeze({ ci: CI_ROW_KEYS, local: LOCAL_ROW_KEYS })

/**
 * The closed selection modes.
 * @type {string[]}
 */
export const SELECTION_MODES = Object.freeze(['ci', 'local'])

/**
 * The Fairtest budget, recorded in the run envelope rather than inferred from
 * a test count. Stage minutes sum to the total by construction; the envelope
 * test asserts the sum. The 24-minute total sits inside the unchanged
 * 30-minute CI job.
 * @type {{ totalMinutes: number, retries: number, journeyHtml: number, stages: ReadonlyArray<{ name: string, minutes: number }> }}
 */
export const FAIRTEST_BUDGET = Object.freeze({
  totalMinutes: 24,
  retries: 0,
  journeyHtml: 0,
  stages: Object.freeze([
    Object.freeze({ name: 'runner-inventory', minutes: 0.1 }),
    Object.freeze({ name: 'list-and-argv', minutes: 0.2 }),
    Object.freeze({ name: 'selection-and-structure', minutes: 0.2 }),
    Object.freeze({ name: 'adapter-startup-and-teardown', minutes: 1.0 }),
    Object.freeze({ name: 'mounted-rows', minutes: 18.5 }),
    Object.freeze({ name: 'process-lifecycle', minutes: 2.0 }),
    Object.freeze({ name: 'evidence-verification', minutes: 1.0 }),
    Object.freeze({ name: 'preflight-and-upload', minutes: 1.0 }),
  ]),
})

/**
 * The pinned durable-artifact upload. The action is pinned to a full commit
 * SHA, never a mutable tag; the retention is bounded. The workflow guard reads
 * these values so the pin cannot drift silently.
 * @type {{ action: string, sha: string, retentionDays: number, ifNoFilesFound: string }}
 */
export const UPLOAD_PIN = Object.freeze({
  action: 'actions/upload-artifact',
  sha: 'ea165f8d65b6e75b540449e92b4886f43607fa02',
  retentionDays: 14,
  ifNoFilesFound: 'error',
})

/**
 * Relative path of the inventory receipt for one selection mode. The list
 * command owns these; the preflight requires the CI one.
 * @param {string} mode ci or local
 * @returns {string} run-root-relative receipt path
 */
export function inventoryReceiptRel(mode) {
  assertSelectionMode(mode, 'inventoryReceiptRel')
  return `${GUARDS_DIR}/inventory-${mode}-receipt.json`
}

/**
 * The run-root-relative path of one row directory a producer owns.
 * @param {string} key producer row key
 * @returns {string} run-root-relative row directory
 */
export function producerRowDirRel(key) {
  return `${PRODUCER_DIR}/${key}`
}

/**
 * Assert a value is a declared selection mode.
 * @param {unknown} mode mode to check
 * @param {string} label caller label used in the diagnostic
 * @returns {void}
 */
export function assertSelectionMode(mode, label) {
  if (typeof mode !== 'string' || !SELECTION_MODES.includes(mode)) {
    throw new Error(
      `${label}: invalid selection mode ${JSON.stringify(mode)} for field "mode" at path selection.mode; ` +
      `repair: use one of ${SELECTION_MODES.join(', ')} for "mode".`,
    )
  }
}

/**
 * Resolve FAIRTEST_RUN_ROOT to an absolute run root whose final path segment is
 * the run id. The last-segment rule is what makes a wrong root observable: a
 * root whose directory does not name the run it holds cannot be told apart from
 * a different run's root.
 * @param {NodeJS.ProcessEnv} [env] environment to read, defaults to process.env
 * @returns {string} the resolved absolute run root
 */
export function resolveRunRoot(env = process.env) {
  return resolveRunRootFor(env.FAIRTEST_RUN_ROOT, env.FAIRTEST_RUN_ID)
}

/**
 * Resolve one run root against one run id. Exported so a test can exercise the
 * missing/wrong/prior root paths without mutating the process environment.
 * @param {unknown} rawRoot FAIRTEST_RUN_ROOT value
 * @param {unknown} rawRunId FAIRTEST_RUN_ID value
 * @returns {string} the resolved absolute run root
 */
export function resolveRunRootFor(rawRoot, rawRunId) {
  const root = typeof rawRoot === 'string' ? rawRoot : ''
  if (!root) {
    throw new Error(
      'fairtest run envelope: missing run root for field "FAIRTEST_RUN_ROOT" at path run.root; ' +
      'repair: run with FAIRTEST_RUN_ROOT=<absolute-run-root> pointing at the run directory.',
    )
  }
  if (!isAbsolute(root)) {
    throw new Error(
      `fairtest run envelope: invalid run root ${JSON.stringify(root)} for field "FAIRTEST_RUN_ROOT" at path run.root; ` +
      'repair: use an absolute directory path for FAIRTEST_RUN_ROOT.',
    )
  }
  const runId = typeof rawRunId === 'string' ? rawRunId.trim() : ''
  if (!runId) {
    throw new Error(
      'fairtest run envelope: missing run id for field "FAIRTEST_RUN_ID" at path run.id; ' +
      'repair: set FAIRTEST_RUN_ID to the run identity the envelope covers.',
    )
  }
  const resolved = resolve(root)
  if (basename(resolved) !== runId) {
    throw new Error(
      `fairtest run envelope: wrong run root ${JSON.stringify(resolved)} for field "FAIRTEST_RUN_ROOT" at path run.root; ` +
      `its final path segment ${JSON.stringify(basename(resolved))} does not name the run id ${JSON.stringify(runId)}; ` +
      'repair: point FAIRTEST_RUN_ROOT at a directory named for FAIRTEST_RUN_ID.',
    )
  }
  return resolved
}

/**
 * Resolve FAIRTEST_RUN_ID, requiring a non-empty value.
 * @param {NodeJS.ProcessEnv} [env] environment to read, defaults to process.env
 * @returns {string} the trimmed run id
 */
export function resolveRunId(env = process.env) {
  const runId = typeof env.FAIRTEST_RUN_ID === 'string' ? env.FAIRTEST_RUN_ID.trim() : ''
  if (!runId) {
    throw new Error(
      'fairtest run envelope: missing run id for field "FAIRTEST_RUN_ID" at path run.id; ' +
      'repair: set FAIRTEST_RUN_ID to the run identity the envelope covers.',
    )
  }
  return runId
}

/**
 * SHA-256 hex digest of bytes or a string.
 * @param {Buffer|string} data bytes to hash
 * @returns {string} hex digest
 */
export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Canonical digest of a selection record's identity fields. One declaration
 * site: the selector writes it and the distinct receipt command recomputes it
 * from the selection file, so a mid-run edit of any identity field is
 * observable even when the record still parses.
 * @param {Record<string, any>} selection selection record
 * @returns {string} hex digest
 */
export function selectionIdentityDigest(selection) {
  return sha256Hex(JSON.stringify({
    runId: selection?.runId,
    project: selection?.project,
    mode: selection?.mode,
    keys: selection?.keys,
    runEnvelopeDigest: selection?.runEnvelopeDigest,
  }))
}

/**
 * Read and parse one JSON record, failing closed with a path and a repair.
 * @param {string} path file path to read
 * @param {string} label record label used in diagnostics
 * @returns {Record<string, any>} the parsed record
 */
export function readJsonFile(path, label) {
  let source
  try {
    source = readFileSync(path, 'utf8')
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `fairtest run envelope: cannot read ${JSON.stringify(path)} for field "${label}" at path run.root; caused by ${cause}; ` +
      `repair: keep the ${label} record intact or rebuild the run root.`,
    )
  }
  try {
    return JSON.parse(source)
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `fairtest run envelope: invalid JSON in ${JSON.stringify(path)} for field "${label}" at path run.root; caused by ${cause}; ` +
      `repair: rebuild the run root so ${label} holds valid JSON.`,
    )
  }
}

/**
 * Write one JSON record atomically: write a sibling temporary file, then rename
 * it onto the target. A reader never observes a half-written record.
 * @param {string} path destination file path
 * @param {unknown} value JSON-serializable record
 * @returns {number} the byte length written
 */
export function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const body = `${JSON.stringify(value, null, 2)}\n`
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(temporary, body)
  renameSync(temporary, path)
  return Buffer.byteLength(body)
}

/**
 * Digest of an on-disk file, or null when it is absent. Used to bind a receipt
 * to the exact bytes of the record it validated.
 * @param {string} path file to digest
 * @returns {string | null} hex digest, or null when the file does not exist
 */
export function fileDigest(path) {
  if (!existsSync(path)) return null
  return sha256Hex(readFileSync(path))
}

/**
 * Read the run envelope and require its run id to match the current run. The
 * pre-service owners (list, select, selection-receipt, preflight) call this
 * before touching their subtree; init and the verifier resolve their root
 * through resolveRunRoot; and the two producer root resolvers call this after
 * resolveRunRoot, so a cross-run root fails before any producer row or
 * evidence file is written.
 * @param {string} root resolved run root
 * @param {string} runId expected run id
 * @param {string} label caller label used in diagnostics
 * @returns {Record<string, any>} the envelope
 */
export function requireEnvelopeForRun(root, runId, label) {
  const envelopePath = join(root, RUN_ENVELOPE_REL)
  if (!existsSync(envelopePath)) {
    throw new Error(
      `${label}: missing run envelope for field "runEnvelope" at path ${RUN_ENVELOPE_REL}; ` +
      `looked for ${JSON.stringify(envelopePath)}; ` +
      'repair: run pnpm test:fairtest:init first so the run root carries its immutable envelope.',
    )
  }
  const envelope = readJsonFile(envelopePath, 'run-envelope')
  if (envelope.runId !== runId) {
    throw new Error(
      `${label}: run envelope belongs to another run for field "runId" at path ${RUN_ENVELOPE_REL}; ` +
      `expected ${JSON.stringify(runId)} observed ${JSON.stringify(envelope.runId)}; ` +
      'repair: use the run root that belongs to FAIRTEST_RUN_ID, or re-run init for this run.',
    )
  }
  if (envelope.project !== FAIRTEST_PROJECT) {
    throw new Error(
      `${label}: run envelope names another project for field "project" at path ${RUN_ENVELOPE_REL}; ` +
      `expected ${JSON.stringify(FAIRTEST_PROJECT)} observed ${JSON.stringify(envelope.project)}; ` +
      'repair: rebuild the envelope with the fairtest project identity.',
    )
  }
  return envelope
}

/**
 * Assert a set of keys is exactly the declared set for one mode. Names the
 * missing, extra, and cross-mode keys so a wrong set is actionable.
 * @param {string} mode selection mode
 * @param {unknown} keys observed keys
 * @param {string} label caller label used in diagnostics
 * @returns {string[]} the frozen expected keys
 */
export function assertExactKeys(mode, keys, label) {
  assertSelectionMode(mode, label)
  const expected = MODE_KEYS[mode]
  if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string' || key.length === 0)) {
    throw new Error(
      `${label}: invalid key list ${JSON.stringify(keys)} for field "keys" at path selection.keys; ` +
      `repair: name exactly ${JSON.stringify([...expected])} for mode ${JSON.stringify(mode)}.`,
    )
  }
  const observed = [...keys]
  if (new Set(observed).size !== observed.length) {
    throw new Error(
      `${label}: duplicate keys ${JSON.stringify(observed)} for field "keys" at path selection.keys; ` +
      `repair: name exactly ${JSON.stringify([...expected])} once each.`,
    )
  }
  const missing = expected.filter((key) => !observed.includes(key))
  const extra = observed.filter((key) => !expected.includes(key))
  if (missing.length > 0 || extra.length > 0) {
    const crossMode = extra.filter((key) => (mode === 'ci' ? LOCAL_ROW_KEYS : CI_ROW_KEYS).includes(key))
    throw new Error(
      `${label}: wrong key set for field "keys" at path selection.keys; ` +
      `expected ${JSON.stringify([...expected])} observed ${JSON.stringify(observed)}; ` +
      `missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}` +
      (crossMode.length > 0 ? ` cross-mode ${JSON.stringify(crossMode)}` : '') + '; ' +
      `repair: declare exactly the ${mode} keys ${JSON.stringify([...expected])} and no others.`,
    )
  }
  return [...expected]
}
