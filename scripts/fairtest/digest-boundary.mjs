#!/usr/bin/env node
// @ts-check

// Producer-to-verifier digest boundary command.
//
// This is the focused regression for the row-owned digest record. It runs after
// the real mounted producer in the required Fairtest CI job, copies the
// producer's own output into throwaway run roots, and drives the REAL verifier
// CLI over each isolated copy:
//
//   - one untouched copy must verify complete (both product and component rows
//     are present because the source run root is a real mounted run);
//   - a one-byte change to each of the six artifact classes, with the digest
//     record unchanged, must fail as digest-mismatch BEFORE JSON parsing;
//   - a missing, malformed, extra-entry, missing-entry, or invalid-hash digest
//     record must fail closed with the row and field named;
//   - a missing or extra artifact file must fail closed; and
//   - two independent copies must prove a mutation in one does not make the
//     other pass or fail differently.
//
// The command never writes to the source run root. Every case owns one
// mkdtemp parent and is removed in a finally step on every exit path. Cases and
// their required-name inventory live in digest-boundary.testdata.yaml and
// digest-boundary.testdata.manifest.yaml; this module owns no inline case
// table. Browser-free: it starts no service and opens no page. The mounted
// producer is run by the caller before this command.
//
// Invocation: FAIRTEST_RUN_ROOT=<absolute-root> FAIRTEST_RUN_ID=<run-id> \
//   pnpm test:fairtest:digest-boundary
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { loadSingleDocument } from '../fairtest-single-document.mjs'
import { ARTIFACT_DIGEST_RECORD } from './artifact-digest-record.mjs'
import { ARTIFACT_CLASSES } from './fairtest-artifacts.mjs'
import { FAIRTEST_EVIDENCE_ROW_KEYS } from './fairtest-evidence-policy.mjs'
import { EVIDENCE_REL, fileDigest, resolveRunRoot, resolveRunRootFor } from './run-envelope-contract.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CORPUS_REL = 'digest-boundary.testdata.yaml'
const MANIFEST_REL = 'digest-boundary.testdata.manifest.yaml'
const VERIFIER_REL = 'scripts/fairtest/verify-fairtest.mjs'
const RUN_ENVELOPE_REL = 'guards/run-envelope.json'

// The harness's own closed vocabulary. The fixture carries the wire values;
// code compares members, never the string literals, so the static guard sees a
// typed set instead of stringly-typed branches.
const CHECKS = Object.freeze(/** @type {const} */ ({
  verifier: 'verifier',
  isolation: 'isolation',
}))
const CHECK_NAMES = /** @type {readonly string[]} */ (Object.freeze(Object.values(CHECKS)))
const MUTATIONS = Object.freeze(/** @type {const} */ ({
  none: 'none',
  mutateJsonArtifact: 'mutate-json-artifact',
  mutateBinaryArtifact: 'mutate-binary-artifact',
  deleteArtifact: 'delete-artifact',
  deleteDigestRecord: 'delete-digest-record',
  deleteDigestRecordAndMutateArtifact: 'delete-digest-record-and-mutate-artifact',
  malformDigestRecord: 'malform-digest-record',
  copyDigestRecordFromOtherRow: 'copy-digest-record-from-other-row',
  setDigestRecordVersion: 'set-digest-record-version',
  addDigestRecordField: 'add-digest-record-field',
  removeDigestRecordField: 'remove-digest-record-field',
  addDigestEntry: 'add-digest-entry',
  removeDigestEntry: 'remove-digest-entry',
  invalidDigest: 'invalid-digest',
  addArtifact: 'add-artifact',
}))
const MUTATION_NAMES = /** @type {readonly string[]} */ (Object.freeze(Object.values(MUTATIONS)))
const ROW_ONLY_MUTATIONS = /** @type {readonly string[]} */ (Object.freeze([
  MUTATIONS.deleteDigestRecord,
  MUTATIONS.malformDigestRecord,
  MUTATIONS.addDigestEntry,
  MUTATIONS.addArtifact,
]))
const ROW_ARTIFACT_MUTATIONS = /** @type {readonly string[]} */ (Object.freeze([
  MUTATIONS.mutateJsonArtifact,
  MUTATIONS.mutateBinaryArtifact,
  MUTATIONS.deleteArtifact,
  MUTATIONS.deleteDigestRecordAndMutateArtifact,
  MUTATIONS.removeDigestEntry,
  MUTATIONS.invalidDigest,
]))
const JSON_ARTIFACTS = ['record.json', 'aria.json', 'axe.json', 'provenance.json', 'resolution.json']
const MUTATION_KINDS = ['delete-record', 'duplicate-name', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document']

/**
 * @typedef {object} DigestBoundaryCase
 * @property {string} name
 * @property {string} check
 * @property {string} mutation
 * @property {string} [row]
 * @property {string} [sourceRow]
 * @property {string} [artifact]
 * @property {number} [version]
 * @property {string} [field]
 * @property {number} [expectStatus]
 * @property {string[]} [expectedErrorContains]
 */

/**
 * @typedef {object} DigestBoundaryMutation
 * @property {string} name
 * @property {string} kind
 * @property {string} target
 * @property {string} [field]
 * @property {string} [value]
 * @property {string} expectedField
 */

/**
 * @typedef {object} DigestBoundaryCorpus
 * @property {number} expectedCaseCount
 * @property {DigestBoundaryCase[]} cases
 */

/**
 * @typedef {object} DigestBoundaryManifest
 * @property {number} expectedCaseCount
 * @property {string[]} requiredCaseNames
 * @property {number} expectedMutationCount
 * @property {string[]} requiredMutationNames
 * @property {DigestBoundaryMutation[]} mutations
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainRecord(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Assert a record has exactly the declared fields.
 * @param {unknown} value candidate
 * @param {string[]} fields exact field set
 * @param {string} label owning document
 * @param {string} path value path used in diagnostics
 * @returns {void}
 */
function checkKeys(value, fields, label, path) {
  if (!isPlainRecord(value)) {
    throw new Error(`${label}: expected a record at path ${path}; repair: restore the mapping at ${path}.`)
  }
  const actual = Object.keys(value).sort()
  const wanted = [...fields].sort()
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label}: exact field mismatch at path ${path}; got [${actual.join(', ')}] want [${wanted.join(', ')}]; repair: restore the exact field set at ${path}.`)
  }
}

/**
 * Assert a value is a non-empty string list.
 * @param {unknown} value candidate
 * @param {string} label owning document
 * @param {string} path value path used in diagnostics
 * @returns {void}
 */
function checkFragmentList(value, label, path) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`${label}: expected a non-empty string list at path ${path}; repair: restore the diagnostic fragment list at ${path}.`)
  }
}

/**
 * Assert every required name appears exactly once and no other name appears.
 * @param {string[]} actual observed names
 * @param {string[]} required required names
 * @param {string} label owning document
 * @param {string} path value path used in diagnostics
 * @returns {void}
 */
function checkRequiredNames(actual, required, label, path) {
  if (new Set(actual).size !== actual.length) {
    const duplicate = actual.find((name, index) => actual.indexOf(name) !== index)
    throw new Error(`${label}: duplicate name ${JSON.stringify(duplicate)} at path ${path}; repair: list every case name once.`)
  }
  for (const name of required) {
    if (!actual.includes(name)) {
      throw new Error(`${label}: missing required name ${JSON.stringify(name)} at path ${path}; repair: restore the required case.`)
    }
  }
  for (const name of actual) {
    if (!required.includes(name)) {
      throw new Error(`${label}: unknown name ${JSON.stringify(name)} at path ${path}; repair: remove the undeclared case or extend the manifest.`)
    }
  }
}

/**
 * Validate one case record and its mutation-specific fields.
 * @param {unknown} value candidate case
 * @param {number} index case index
 * @param {string} label owning document
 * @returns {void}
 */
function validateCase(value, index, label) {
  const path = `cases[${index}]`
  if (!isPlainRecord(value)) {
    throw new Error(`${label}: expected a case record at path ${path}; repair: restore the case mapping.`)
  }
  const name = value.name
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(`${label}: missing case name at path ${path}.name; repair: restore the required case name.`)
  }
  if (!CHECK_NAMES.includes(/** @type {string} */ (value.check))) {
    throw new Error(`${label}: unknown check ${JSON.stringify(value.check)} for field "check" at path ${path}.check; repair: use one of ${CHECK_NAMES.join(', ')}.`)
  }
  if (!MUTATION_NAMES.includes(/** @type {string} */ (value.mutation))) {
    throw new Error(`${label}: unknown mutation ${JSON.stringify(value.mutation)} for field "mutation" at path ${path}.mutation; repair: use one of ${MUTATION_NAMES.join(', ')}.`)
  }
  const mutation = /** @type {string} */ (value.mutation)
  if (value.check === CHECKS.isolation) {
    if (mutation !== MUTATIONS.mutateJsonArtifact) {
      throw new Error(`${label}: isolation case ${JSON.stringify(name)} names mutation ${JSON.stringify(mutation)} for field "mutation" at path ${path}.mutation; repair: use ${MUTATIONS.mutateJsonArtifact} for the isolation case.`)
    }
    checkKeys(value, ['name', 'check', 'mutation', 'row', 'artifact', 'expectedErrorContains'], label, path)
  } else if (mutation === MUTATIONS.none) {
    checkKeys(value, ['name', 'check', 'mutation', 'expectStatus'], label, path)
    if (value.expectStatus !== 0) {
      throw new Error(`${label}: untouched case ${JSON.stringify(name)} declares status ${JSON.stringify(value.expectStatus)} for field "expectStatus" at path ${path}.expectStatus; repair: declare 0 for an untouched run.`)
    }
  } else if (mutation === MUTATIONS.copyDigestRecordFromOtherRow) {
    checkKeys(value, ['name', 'check', 'mutation', 'row', 'sourceRow', 'expectStatus', 'expectedErrorContains'], label, path)
  } else if (mutation === MUTATIONS.setDigestRecordVersion) {
    checkKeys(value, ['name', 'check', 'mutation', 'row', 'version', 'expectStatus', 'expectedErrorContains'], label, path)
  } else if (mutation === MUTATIONS.addDigestRecordField || mutation === MUTATIONS.removeDigestRecordField) {
    checkKeys(value, ['name', 'check', 'mutation', 'row', 'field', 'expectStatus', 'expectedErrorContains'], label, path)
  } else if (ROW_ONLY_MUTATIONS.includes(mutation)) {
    checkKeys(value, ['name', 'check', 'mutation', 'row', 'expectStatus', 'expectedErrorContains'], label, path)
  } else if (ROW_ARTIFACT_MUTATIONS.includes(mutation)) {
    checkKeys(value, ['name', 'check', 'mutation', 'row', 'artifact', 'expectStatus', 'expectedErrorContains'], label, path)
  } else {
    throw new Error(`${label}: mutation ${JSON.stringify(mutation)} has no declared case shape at path ${path}.mutation; repair: declare the mutation shape in the fixture validator.`)
  }
  if (mutation !== MUTATIONS.none && value.check === CHECKS.verifier && value.expectStatus !== 1) {
    throw new Error(`${label}: mutation case ${JSON.stringify(name)} declares status ${JSON.stringify(value.expectStatus)} for field "expectStatus" at path ${path}.expectStatus; repair: declare 1 for a mutation case.`)
  }
  if ('expectedErrorContains' in value) checkFragmentList(value.expectedErrorContains, label, `${path}.expectedErrorContains`)
  if ('row' in value) {
    if (typeof value.row !== 'string' || !/** @type {readonly string[]} */ (FAIRTEST_EVIDENCE_ROW_KEYS).includes(value.row)) {
      throw new Error(`${label}: unknown row ${JSON.stringify(value.row)} for field "row" at path ${path}.row; repair: use one of the required producer row keys.`)
    }
  }
  if ('sourceRow' in value) {
    if (typeof value.sourceRow !== 'string' || !/** @type {readonly string[]} */ (FAIRTEST_EVIDENCE_ROW_KEYS).includes(value.sourceRow)) {
      throw new Error(`${label}: unknown source row ${JSON.stringify(value.sourceRow)} for field "sourceRow" at path ${path}.sourceRow; repair: use one of the required producer row keys.`)
    }
    if (value.sourceRow === value.row) {
      throw new Error(`${label}: source row must differ from the target row for field "sourceRow" at path ${path}.sourceRow; repair: copy a digest record from another row.`)
    }
  }
  if ('version' in value) {
    if (!Number.isInteger(value.version) || value.version === 1) {
      throw new Error(`${label}: invalid digest record version ${JSON.stringify(value.version)} for field "version" at path ${path}.version; repair: declare an integer version other than 1.`)
    }
  }
  if ('field' in value) {
    if (typeof value.field !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(value.field)) {
      throw new Error(`${label}: invalid digest record field ${JSON.stringify(value.field)} for field "field" at path ${path}.field; repair: use a lowercase field name up to 32 characters.`)
    }
  }
  if ('artifact' in value) {
    if (typeof value.artifact !== 'string' || !/** @type {readonly string[]} */ (ARTIFACT_CLASSES).includes(value.artifact)) {
      throw new Error(`${label}: unknown artifact ${JSON.stringify(value.artifact)} for field "artifact" at path ${path}.artifact; repair: use one of ${ARTIFACT_CLASSES.join(', ')}.`)
    }
    if (mutation === MUTATIONS.mutateJsonArtifact && !JSON_ARTIFACTS.includes(value.artifact)) {
      throw new Error(`${label}: mutation ${JSON.stringify(mutation)} cannot target ${JSON.stringify(value.artifact)} for field "artifact" at path ${path}.artifact; repair: target one of ${JSON_ARTIFACTS.join(', ')}.`)
    }
    if (mutation === MUTATIONS.mutateBinaryArtifact && value.artifact !== 'screenshot.png') {
      throw new Error(`${label}: mutation ${JSON.stringify(mutation)} must target screenshot.png for field "artifact" at path ${path}.artifact; repair: target the one binary artifact class.`)
    }
  }
}

/**
 * Validate one corpus document against its required-name manifest.
 * @param {unknown} corpusValue parsed corpus
 * @param {string} label owning document
 * @param {{ expectedCaseCount: number, requiredCaseNames: string[] }} [manifest] required-name manifest
 * @returns {void}
 */
export function validateDigestBoundaryCorpus(corpusValue, label, manifest) {
  if (!isPlainRecord(corpusValue)) {
    throw new Error(`${label}: expected a record at path document; repair: restore the mapping root.`)
  }
  const corpus = /** @type {DigestBoundaryCorpus} */ (corpusValue)
  checkKeys(corpus, ['expectedCaseCount', 'cases'], label, 'document')
  if (!Array.isArray(corpus.cases) || corpus.cases.length === 0) {
    throw new Error(`${label}: document holds no cases at path cases; repair: restore the named case list.`)
  }
  for (const [index, entry] of corpus.cases.entries()) validateCase(entry, index, label)
  const names = corpus.cases.map((entry) => entry.name)
  if (manifest) {
    if (manifest.expectedCaseCount !== manifest.requiredCaseNames.length) {
      throw new Error(`${label}: manifest expectedCaseCount must equal requiredCaseNames at path manifest.expectedCaseCount; repair: align the counts.`)
    }
    checkRequiredNames(names, manifest.requiredCaseNames, label, 'cases')
  } else if (new Set(names).size !== names.length) {
    throw new Error(`${label}: duplicate case name at path cases; repair: list every case once.`)
  }
  if (corpus.expectedCaseCount !== corpus.cases.length) {
    throw new Error(`${label}: case count must equal the case list at path expectedCaseCount; repair: align expectedCaseCount with cases.`)
  }
}

/**
 * Validate the manifest itself.
 * @param {unknown} value candidate manifest
 * @param {string} label owning document
 * @returns {void}
 */
export function validateDigestBoundaryManifest(value, label) {
  if (!isPlainRecord(value)) {
    throw new Error(`${label}: expected a record at path manifest; repair: restore the manifest mapping.`)
  }
  const manifest = /** @type {DigestBoundaryManifest} */ (value)
  checkKeys(manifest, ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], label, 'manifest')
  if (!Array.isArray(manifest.requiredCaseNames) || manifest.requiredCaseNames.length === 0) {
    throw new Error(`${label}: manifest holds no required case names at path manifest.requiredCaseNames; repair: restore the required-name inventory.`)
  }
  if (manifest.expectedCaseCount !== manifest.requiredCaseNames.length) {
    throw new Error(`${label}: manifest expectedCaseCount must equal requiredCaseNames at path manifest.expectedCaseCount; repair: align the counts.`)
  }
  if (!Array.isArray(manifest.mutations) || manifest.mutations.length === 0) {
    throw new Error(`${label}: manifest holds no mutations at path manifest.mutations; repair: restore the mutation inventory.`)
  }
  if (manifest.expectedMutationCount !== manifest.mutations.length) {
    throw new Error(`${label}: manifest expectedMutationCount must equal mutations at path manifest.expectedMutationCount; repair: align the counts.`)
  }
  checkRequiredNames(manifest.mutations.map((entry) => entry.name), manifest.requiredMutationNames, label, 'manifest.requiredMutationNames')
  for (const [index, mutation] of manifest.mutations.entries()) {
    const path = `manifest.mutations[${index}]`
    if (!isPlainRecord(mutation)) {
      throw new Error(`${label}: expected a mutation record at path ${path}; repair: restore the mutation mapping.`)
    }
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (mutation.kind === 'delete-field' || mutation.kind === 'bad-value' || mutation.kind === 'unknown-field') fields.push('field')
    if (mutation.kind === 'bad-value' || mutation.kind === 'unknown-field') fields.push('value')
    checkKeys(mutation, fields, label, path)
    if (!MUTATION_KINDS.includes(/** @type {string} */ (mutation.kind))) {
      throw new Error(`${label}: unknown mutation kind ${JSON.stringify(mutation.kind)} at path ${path}.kind; repair: use one of ${MUTATION_KINDS.join(', ')}.`)
    }
    if (mutation.kind === 'trailing-document') {
      if (mutation.target !== 'document') {
        throw new Error(`${label}: trailing-document must target the document at path ${path}.target; repair: target "document".`)
      }
    } else if (!manifest.requiredCaseNames.includes(/** @type {string} */ (mutation.target))) {
      throw new Error(`${label}: mutation ${JSON.stringify(mutation.name)} targets an unknown case at path ${path}.target; repair: target one of the required case names.`)
    }
    if (typeof mutation.expectedField !== 'string' || mutation.expectedField.length === 0) {
      throw new Error(`${label}: mutation ${JSON.stringify(mutation.name)} must name its intended field at path ${path}.expectedField; repair: name the field the mutation must fail on.`)
    }
  }
}

/**
 * Load and validate the fixture pair.
 * @returns {{ cases: DigestBoundaryCase[], manifest: DigestBoundaryManifest }} validated cases and manifest
 */
export function loadDigestBoundaryFixture() {
  const corpusSource = readFileSync(resolve(HERE, CORPUS_REL), 'utf8')
  const manifestSource = readFileSync(resolve(HERE, MANIFEST_REL), 'utf8')
  const manifest = /** @type {DigestBoundaryManifest} */ (loadSingleDocument(manifestSource, MANIFEST_REL))
  validateDigestBoundaryManifest(manifest, MANIFEST_REL)
  const corpus = /** @type {DigestBoundaryCorpus} */ (loadSingleDocument(corpusSource, CORPUS_REL))
  validateDigestBoundaryCorpus(corpus, CORPUS_REL, manifest)
  return { cases: corpus.cases, manifest }
}

/**
 * List every file under a directory as sorted root-relative posix paths.
 * @param {string} root directory to walk
 * @returns {string[]} sorted relative file paths
 */
function listFiles(root) {
  const found = /** @type {string[]} */ ([])
  const walk = (/** @type {string} */ directory) => {
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
 * Require a file digest for a path this command has already listed.
 * @param {string} path file path
 * @returns {string} hex digest
 */
function requireFileDigest(path) {
  const digest = fileDigest(path)
  if (digest === null) {
    throw new Error(
      `fairtest digest boundary: missing file while snapshotting the source run root at path ${JSON.stringify(path)}; ` +
      'repair: keep the source producer output stable while the digest boundary runs.',
    )
  }
  return digest
}

/**
 * Snapshot the source run root's producer and envelope bytes so the command can
 * prove it never wrote to the source evidence.
 * @param {string} root source run root
 * @returns {Record<string, string>} file digest per root-relative path
 */
export function snapshotRunRoot(root) {
  /** @type {Record<string, string>} */
  const snapshot = Object.create(null)
  const envelopePath = join(root, RUN_ENVELOPE_REL)
  if (!existsSync(envelopePath)) {
    throw new Error(
      `fairtest digest boundary: missing run envelope for field "runEnvelope" at path ${RUN_ENVELOPE_REL}; ` +
      `looked for ${JSON.stringify(envelopePath)}; ` +
      'repair: run pnpm test:fairtest:init, the mounted producer, then this command for the same run root.',
    )
  }
  snapshot[RUN_ENVELOPE_REL] = requireFileDigest(envelopePath)
  for (const name of listFiles(join(root, 'producer'))) {
    snapshot[`producer/${name}`] = requireFileDigest(join(root, 'producer', name))
  }
  return snapshot
}

/**
 * Copy the envelope and either every producer row or the named rows into one
 * isolated run root. Evidence from a previous verifier run is never copied.
 * @param {string} target destination run root (final segment equals the run id)
 * @param {string} source source run root
 * @param {string[] | null} rowKeys rows to copy, or null for every row
 * @returns {void}
 */
function copyRunRoot(target, source, rowKeys) {
  mkdirSync(join(target, 'guards'), { recursive: true })
  cpSync(join(source, RUN_ENVELOPE_REL), join(target, RUN_ENVELOPE_REL))
  if (rowKeys === null) {
    cpSync(join(source, 'producer'), join(target, 'producer'), { recursive: true })
    return
  }
  mkdirSync(join(target, 'producer'), { recursive: true })
  for (const key of rowKeys) {
    const sourceRow = join(source, 'producer', key)
    if (!existsSync(sourceRow)) {
      throw new Error(
        `fairtest digest boundary: missing producer row ${JSON.stringify(key)} for field "row" at path producer/${key}; ` +
        `looked for ${JSON.stringify(sourceRow)}; ` +
        'repair: run the mounted producer for every required row before this command.',
      )
    }
    cpSync(sourceRow, join(target, 'producer', key), { recursive: true })
  }
}

/**
 * Run the real verifier CLI against one isolated run root.
 * @param {string} root isolated run root
 * @param {string} runId run identity
 * @returns {{ status: number, output: string }} exit status and combined output
 */
function runVerifier(root, runId) {
  const result = spawnSync(process.execPath, [resolve(ROOT, VERIFIER_REL)], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FAIRTEST_RUN_ROOT: root, FAIRTEST_RUN_ID: runId },
  })
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}

/**
 * Assert one verifier result: status, diagnostic fragments, and the evidence
 * report it wrote. A failing verdict may carry no report today (the digest
 * boundary fails before report assembly); if a report exists it must not claim
 * a pass.
 * @param {{ status: number, output: string }} result verifier result
 * @param {string} root isolated run root
 * @param {number} expectedStatus expected exit status
 * @param {string[]} fragments expected diagnostic fragments
 * @param {string} label case label
 * @returns {void}
 */
function assertVerifierResult(result, root, expectedStatus, fragments, label) {
  if (expectedStatus === 0) {
    assert.equal(result.status, 0, `${label}: untouched run must verify; output:\n${result.output}`)
    const reportPath = join(root, EVIDENCE_REL)
    assert.ok(existsSync(reportPath), `${label}: a complete run must write ${EVIDENCE_REL}`)
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    assert.equal(report.complete, true, `${label}: untouched run report must be complete; output:\n${result.output}`)
    assert.deepEqual(report.failureCodes, [], `${label}: untouched run report must carry no failure codes`)
    return
  }
  assert.equal(result.status, expectedStatus, `${label}: a changed artifact, digest record, or artifact set must exit ${expectedStatus}; output:\n${result.output}`)
  for (const fragment of fragments) {
    assert.ok(result.output.includes(fragment), `${label}: diagnostic must include ${JSON.stringify(fragment)}; got:\n${result.output}`)
  }
  const reportPath = join(root, EVIDENCE_REL)
  if (existsSync(reportPath)) {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    assert.equal(report.complete, false, `${label}: a failing run must not leave a complete report`)
  }
}

/**
 * Apply one fixture mutation to an isolated copy.
 * @param {string} root isolated run root
 * @param {DigestBoundaryCase} entry fixture case
 * @returns {void}
 */
function applyMutation(root, entry) {
  if (entry.mutation === MUTATIONS.none) return
  if (typeof entry.row !== 'string') {
    throw new Error(`fairtest digest boundary: case ${JSON.stringify(entry.name)} needs a row for field "row" at path cases; repair: declare the row the mutation targets.`)
  }
  const rowDir = join(root, 'producer', entry.row)
  if (!existsSync(rowDir)) {
    throw new Error(`fairtest digest boundary: case ${JSON.stringify(entry.name)} targets a missing row at path producer/${entry.row}; repair: copy the row before mutating it.`)
  }
  const recordPath = join(rowDir, ARTIFACT_DIGEST_RECORD)
  switch (entry.mutation) {
    case MUTATIONS.mutateJsonArtifact:
    case MUTATIONS.mutateBinaryArtifact: {
      if (typeof entry.artifact !== 'string') {
        throw new Error(`fairtest digest boundary: case ${JSON.stringify(entry.name)} needs an artifact for field "artifact" at path cases; repair: declare the artifact the mutation targets.`)
      }
      const artifactPath = join(rowDir, entry.artifact)
      const bytes = readFileSync(artifactPath)
      const appended = entry.mutation === MUTATIONS.mutateJsonArtifact ? Buffer.from('\nnot-json\n') : Buffer.from([0])
      writeFileSync(artifactPath, Buffer.concat([bytes, appended]))
      return
    }
    case MUTATIONS.deleteArtifact: {
      if (typeof entry.artifact !== 'string') {
        throw new Error(`fairtest digest boundary: case ${JSON.stringify(entry.name)} needs an artifact for field "artifact" at path cases; repair: declare the artifact the mutation targets.`)
      }
      rmSync(join(rowDir, entry.artifact), { force: true })
      return
    }
    case MUTATIONS.deleteDigestRecord: {
      rmSync(recordPath, { force: true })
      return
    }
    case MUTATIONS.deleteDigestRecordAndMutateArtifact: {
      if (typeof entry.artifact !== 'string') {
        throw new Error(`fairtest digest boundary: case ${JSON.stringify(entry.name)} needs an artifact for field "artifact" at path cases; repair: declare the artifact the mutation targets.`)
      }
      rmSync(recordPath, { force: true })
      const artifactPath = join(rowDir, entry.artifact)
      const bytes = readFileSync(artifactPath)
      const appended = JSON_ARTIFACTS.includes(entry.artifact) ? Buffer.from('\nnot-json\n') : Buffer.from([0])
      writeFileSync(artifactPath, Buffer.concat([bytes, appended]))
      return
    }
    case MUTATIONS.malformDigestRecord: {
      writeFileSync(recordPath, '{\n')
      return
    }
    case MUTATIONS.copyDigestRecordFromOtherRow: {
      if (typeof entry.sourceRow !== 'string') {
        throw new Error(`fairtest digest boundary: case ${JSON.stringify(entry.name)} needs a source row for field "sourceRow" at path cases; repair: declare the row whose digest record is copied.`)
      }
      cpSync(join(root, 'producer', entry.sourceRow, ARTIFACT_DIGEST_RECORD), recordPath)
      return
    }
    case MUTATIONS.setDigestRecordVersion: {
      if (!Number.isInteger(entry.version)) {
        throw new Error(`fairtest digest boundary: case ${JSON.stringify(entry.name)} needs an integer version for field "version" at path cases; repair: declare the wrong version the record should carry.`)
      }
      const record = JSON.parse(readFileSync(recordPath, 'utf8'))
      record.version = entry.version
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
      return
    }
    case MUTATIONS.addDigestRecordField: {
      if (typeof entry.field !== 'string') {
        throw new Error(`fairtest digest boundary: case ${JSON.stringify(entry.name)} needs a field for field "field" at path cases; repair: declare the extra top-level field.`)
      }
      const record = JSON.parse(readFileSync(recordPath, 'utf8'))
      record[entry.field] = true
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
      return
    }
    case MUTATIONS.removeDigestRecordField: {
      if (typeof entry.field !== 'string') {
        throw new Error(`fairtest digest boundary: case ${JSON.stringify(entry.name)} needs a field for field "field" at path cases; repair: declare the top-level field to remove.`)
      }
      const record = JSON.parse(readFileSync(recordPath, 'utf8'))
      delete record[entry.field]
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
      return
    }
    case MUTATIONS.addDigestEntry: {
      const record = JSON.parse(readFileSync(recordPath, 'utf8'))
      record.artifacts['scratch.txt'] = '0'.repeat(64)
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
      return
    }
    case MUTATIONS.removeDigestEntry: {
      if (typeof entry.artifact !== 'string') {
        throw new Error(`fairtest digest boundary: case ${JSON.stringify(entry.name)} needs an artifact for field "artifact" at path cases; repair: declare the digest entry the mutation removes.`)
      }
      const record = JSON.parse(readFileSync(recordPath, 'utf8'))
      delete record.artifacts[entry.artifact]
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
      return
    }
    case MUTATIONS.invalidDigest: {
      if (typeof entry.artifact !== 'string') {
        throw new Error(`fairtest digest boundary: case ${JSON.stringify(entry.name)} needs an artifact for field "artifact" at path cases; repair: declare the digest entry the mutation invalidates.`)
      }
      const record = JSON.parse(readFileSync(recordPath, 'utf8'))
      record.artifacts[entry.artifact] = 'not-a-sha256'
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
      return
    }
    case MUTATIONS.addArtifact: {
      writeFileSync(join(rowDir, 'scratch.bin'), 'scratch\n')
      return
    }
    default:
      throw new Error(`fairtest digest boundary: unsupported mutation ${JSON.stringify(entry.mutation)} for field "mutation" at path cases; repair: use one of ${MUTATION_NAMES.join(', ')}.`)
  }
}

/**
 * The source rows one case needs copied. Untouched cases need every row; a
 * mutation needs its target row and, for the wrong-row case, the row it copies
 * the record from.
 * @param {DigestBoundaryCase} entry fixture case
 * @returns {string[] | null} rows to copy, or null for every row
 */
function rowsForCase(entry) {
  if (entry.mutation === MUTATIONS.none) return null
  const rows = [/** @type {string} */ (entry.row)]
  if (entry.mutation === MUTATIONS.copyDigestRecordFromOtherRow) rows.push(/** @type {string} */ (entry.sourceRow))
  return rows
}

/**
 * Run one verifier case.
 * @param {string} source source run root
 * @param {string} runId run identity
 * @param {DigestBoundaryCase} entry fixture case
 * @returns {void}
 */
function runVerifierCase(source, runId, entry) {
  const parent = mkdtempSync(join(tmpdir(), 'fairtest-digest-boundary-'))
  try {
    const target = join(parent, runId)
    copyRunRoot(target, source, rowsForCase(entry))
    applyMutation(target, entry)
    const result = runVerifier(target, runId)
    assertVerifierResult(result, target, /** @type {number} */ (entry.expectStatus), /** @type {string[]} */ (entry.expectedErrorContains ?? []), entry.name)
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
}

/**
 * Run the isolation case: two full copies, one mutated and one untouched. The
 * untouched copy must still verify complete, so a mutation in one run root
 * cannot leak into the other.
 * @param {string} source source run root
 * @param {string} runId run identity
 * @param {DigestBoundaryCase} entry fixture case
 * @returns {void}
 */
function runIsolationCase(source, runId, entry) {
  const mutatedParent = mkdtempSync(join(tmpdir(), 'fairtest-digest-boundary-mutated-'))
  const cleanParent = mkdtempSync(join(tmpdir(), 'fairtest-digest-boundary-clean-'))
  try {
    const mutatedRoot = join(mutatedParent, runId)
    const cleanRoot = join(cleanParent, runId)
    copyRunRoot(mutatedRoot, source, null)
    copyRunRoot(cleanRoot, source, null)
    applyMutation(mutatedRoot, entry)
    assertVerifierResult(
      runVerifier(mutatedRoot, runId),
      mutatedRoot,
      1,
      /** @type {string[]} */ (entry.expectedErrorContains),
      `${entry.name} mutated copy`,
    )
    assertVerifierResult(runVerifier(cleanRoot, runId), cleanRoot, 0, [], `${entry.name} untouched copy`)
  } finally {
    rmSync(mutatedParent, { recursive: true, force: true })
    rmSync(cleanParent, { recursive: true, force: true })
  }
}

/**
 * Run every fixture case against the real verifier and prove the source run
 * root was not modified.
 * @param {{ source: string, runId: string, cases: DigestBoundaryCase[] }} input run inputs
 * @returns {number} number of cases that ran
 */
export function runDigestBoundaryCases({ source, runId, cases }) {
  // The existing run-envelope contract is the path-safety check: the source
  // root must be absolute and its final segment must equal the run id. Derive
  // the isolated segment from the validated root itself, so no separator or
  // parent-directory value from the environment can escape mkdtemp.
  const sourceRoot = resolveRunRootFor(source, runId)
  const isolatedRunId = basename(sourceRoot)
  const before = snapshotRunRoot(sourceRoot)
  for (const entry of cases) {
    if (entry.check === CHECKS.isolation) runIsolationCase(sourceRoot, isolatedRunId, entry)
    else runVerifierCase(sourceRoot, isolatedRunId, entry)
  }
  const after = snapshotRunRoot(sourceRoot)
  assert.deepEqual(after, before, 'fairtest digest boundary: the source run root changed while cases ran; repair: mutate only isolated copies.')
  return cases.length
}

/**
 * Run the command: resolve the real mounted run root, execute every fixture
 * case on isolated copies, and report the pass line.
 * @returns {number} process exit code
 */
function main() {
  const root = resolveRunRoot()
  const runId = basename(root)
  const { cases } = loadDigestBoundaryFixture()
  const ran = runDigestBoundaryCases({ source: root, runId, cases })
  console.log('fairtest digest boundary: producer-recorded artifact digests bound to the current bytes')
  console.log(`  source run root ${root}`)
  console.log(`  run id          ${runId}`)
  console.log(`  cases           ${ran} passed`)
  console.log('  source run root unchanged')
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
