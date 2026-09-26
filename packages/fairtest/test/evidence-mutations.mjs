// Executable fail-closed evidence mutation family.
//
// Every required mutation disposition lives in the named case table
// scripts/testdata/fairtest-evidence-mutations.yaml plus its required-name
// manifest; this file owns no case data except the small builders that turn a
// case's mutation into a real run root or a real in-memory run model. Each
// mutation names the ONE boundary that owns its failure and is run through
// that boundary, never a hand-made assertion:
//
//   - run-root: a fresh synthetic run root is written under a temporary
//     directory and the real browser-neutral verifier CLI
//     (scripts/fairtest/verify-fairtest.mjs) is spawned over it; the typed
//     report it writes at evidence/evidence.json must carry the named code.
//   - verifier: the neutral verifyEvidenceRun is called with the fixture's
//     caller-owned policy; its returned report must carry the named code.
//   - surface-manifest: the real SurfaceGate consumer guard
//     (scripts/fairtest-surface-manifest.mjs) inspects the real consumer
//     corpus; a mutated workflow or corpus must be refused for its named field.
//
// The specialized screenshot consumers are protected compatibility evidence,
// present and never claimed as required CI; the cheap importer/signature/policy
// gate stays required. No case deletes or migrates a consumer. Browser-free:
// node builtins, the declared yaml dependency, and the pinned run-root CLI.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { checkRequiredNames, loadSingleDocument } from '../src/core/index.mjs'
import {
  artifactDigest,
  createArtifactObservation,
  createEvidencePolicy,
  createEvidenceRow,
  createEvidenceRun,
  validateEvidenceReport,
  verifyEvidenceRun,
} from '../src/evidence/index.mjs'
import { inspectConsumerClassification } from '../../../scripts/fairtest-surface-manifest.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const CORPUS_REL = 'scripts/testdata/fairtest-evidence-mutations.yaml'
const MANIFEST_REL = 'scripts/testdata/fairtest-evidence-mutations.manifest.yaml'
const CONSUMER_CORPUS_REL = 'scripts/testdata/fairtest-surface-consumers.yaml'
const CONSUMER_MANIFEST_REL = 'scripts/testdata/fairtest-surface-consumers.manifest.yaml'
const WORKFLOW_REL = '.github/workflows/ci.yml'
const VERIFY_CLI = join(ROOT, 'scripts', 'fairtest', 'verify-fairtest.mjs')

const OWNERS = ['run-root', 'run-root-refusal', 'verifier', 'surface-manifest']
const EVIDENCE_MUTATION_KINDS = ['none', 'delete-artifact', 'stale-artifact-digest', 'copy-artifact', 'set-row-kind', 'delete-producer-row', 'set-provenance-root', 'cap-output', 'delete-produced-at']
const CLASSIFICATION_MUTATION_KINDS = ['none', 'invoke-specialized-in-ci', 'reclassify-importer', 'require-all-consumers']
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])
const STALE_DIGEST = '0'.repeat(64)

const corpusSource = readFileSync(resolve(ROOT, CORPUS_REL), 'utf8')
const manifestSource = readFileSync(resolve(ROOT, MANIFEST_REL), 'utf8')
const corpus = loadSingleDocument(corpusSource, CORPUS_REL)
const manifest = loadSingleDocument(manifestSource, MANIFEST_REL)
const consumerCorpusSource = readFileSync(resolve(ROOT, CONSUMER_CORPUS_REL), 'utf8')
const consumerManifestSource = readFileSync(resolve(ROOT, CONSUMER_MANIFEST_REL), 'utf8')
const consumerCorpus = loadSingleDocument(consumerCorpusSource, CONSUMER_CORPUS_REL)
const consumerManifest = loadSingleDocument(consumerManifestSource, CONSUMER_MANIFEST_REL)
const workflowSource = readFileSync(resolve(ROOT, WORKFLOW_REL), 'utf8')

/** @param {unknown} value */
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

/** @param {string} message @returns {never} */
function fail(message) {
  throw new Error(message)
}

/** @param {unknown} value @param {string[]} fields @param {string} tag @param {string} label @param {string} path */
function checkExact(value, fields, tag, label, path) {
  if (!isRecord(value)) {
    fail(`${tag}: record is missing or malformed at path ${path} in ${label}; repair: restore the record with exactly: ${fields.join(', ')}.`)
  }
  const record = /** @type {Record<string, unknown>} */ (value)
  for (const field of fields) {
    if (!(field in record)) fail(`${tag}: missing required field "${field}" at path ${path}.${field} in ${label}; repair: restore "${field}".`)
  }
  for (const key of Object.keys(record)) {
    if (!fields.includes(key)) fail(`${tag}: unknown field "${key}" at path ${path}.${key} in ${label}; repair: remove "${key}".`)
  }
}

/** @param {unknown} value @param {string} path @param {string} label */
function checkStringArray(value, path, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    fail(`${label}: expected a non-empty string list at path ${path}; repair: restore the list of closed failure codes at ${path}.`)
  }
}

/* ── manifest and corpus validation ───────────────────────────────────── */

/** @param {Record<string, unknown>} value */
function validateManifest(value) {
  const label = MANIFEST_REL
  checkExact(
    value,
    ['expectedCaseCount', 'requiredCaseNames', 'expectedFamilyCount', 'requiredFamilyNames', 'expectedOwnerCount', 'requiredOwnerNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'],
    'manifest',
    label,
    'manifest',
  )
  const cases = /** @type {string[]} */ (value.requiredCaseNames)
  const families = /** @type {string[]} */ (value.requiredFamilyNames)
  const owners = /** @type {string[]} */ (value.requiredOwnerNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (value.mutations)
  assert.equal(new Set(cases).size, cases.length, `${label}: required case names must be unique at path manifest.requiredCaseNames; repair: list every required case name once.`)
  assert.equal(new Set(families).size, families.length, `${label}: required family names must be unique at path manifest.requiredFamilyNames; repair: list every required family once.`)
  assert.equal(value.expectedCaseCount, cases.length, `${label}: case count must equal the required-name inventory at path manifest.expectedCaseCount; repair: align the count.`)
  assert.equal(value.expectedFamilyCount, families.length, `${label}: family count must equal the required-name inventory at path manifest.expectedFamilyCount; repair: align the count.`)
  assert.equal(value.expectedOwnerCount, owners.length, `${label}: owner count must equal the required-name inventory at path manifest.expectedOwnerCount; repair: align the count.`)
  assert.equal(value.expectedMutationCount, mutations.length, `${label}: mutation count must equal the mutation inventory at path manifest.expectedMutationCount; repair: align the count.`)
  checkRequiredNames(mutations.map((entry) => String(entry.name)), /** @type {string[]} */ (value.requiredMutationNames), label)
  for (const [index, mutation] of mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('value')
    checkExact(mutation, fields, 'mutation', label, `manifest.mutations[${index}]`)
    if (!MUTATION_KINDS.has(/** @type {string} */ (mutation.kind))) {
      fail(`${label}: unknown mutation kind ${JSON.stringify(mutation.kind)} at path manifest.mutations[${index}].kind; repair: use one of ${[...MUTATION_KINDS].join(', ')}.`)
    }
    if (mutation.kind !== 'trailing-document' && !cases.includes(/** @type {string} */ (mutation.target))) {
      fail(`${label}: mutation ${index} targets an unknown case at path manifest.mutations[${index}].target; repair: target one of the required case names.`)
    }
  }
}

/** @param {Record<string, unknown>} value */
function validateCorpus(value) {
  const label = CORPUS_REL
  checkExact(value, ['expectedCaseCount', 'run', 'artifactTemplates', 'cases'], 'document', label, 'document')
  const run = /** @type {Record<string, unknown>} */ (value.run)
  checkExact(run, ['runId', 'nowMs', 'servedFrom', 'roots', 'identity', 'policy', 'rows'], 'run', label, 'run')
  checkExact(run.roots, ['product', 'component'], 'roots', label, 'run.roots')
  checkExact(run.identity, ['product', 'component'], 'identity', label, 'run.identity')
  checkExact(run.policy, ['version', 'artifactClasses', 'duplicateScopes', 'maxAgeMs', 'maxOutputBytes'], 'policy', label, 'run.policy')
  if (!Array.isArray(run.rows) || run.rows.length === 0) {
    fail(`${label}: document holds no rows at path run.rows; repair: restore the required row list.`)
  }
  const rowKeys = new Set()
  for (const [index, row] of /** @type {Record<string, unknown>[]} */ (run.rows).entries()) {
    checkExact(row, ['key', 'kind', 'theme'], 'row', label, `run.rows[${index}]`)
    if (rowKeys.has(row.key)) fail(`${label}: duplicate row key ${JSON.stringify(row.key)} at path run.rows[${index}].key; repair: list every required row once.`)
    rowKeys.add(row.key)
  }
  const templates = /** @type {Record<string, unknown>} */ (value.artifactTemplates)
  if (!isRecord(templates) || Object.keys(templates).length === 0) {
    fail(`${label}: document holds no artifact templates at path artifactTemplates; repair: restore the artifact content templates.`)
  }
  for (const [name, template] of Object.entries(templates)) {
    if (typeof template !== 'string' || template.length === 0) {
      fail(`${label}: invalid artifact template at path artifactTemplates.${name}; repair: restore a non-empty content template.`)
    }
  }
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  if (!Array.isArray(cases) || cases.length === 0) {
    fail(`${label}: document holds no cases at path cases; repair: restore the named case list.`)
  }
  const seen = new Set()
  for (const [index, entry] of cases.entries()) {
    const path = `cases[${index}]`
    if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
      fail(`${label}: case ${index} is missing its required name at path ${path}.name; repair: restore the required case name.`)
    }
    if (seen.has(entry.name)) fail(`${label}: duplicate case name ${JSON.stringify(entry.name)} at path ${path}.name; repair: give every case a unique name.`)
    seen.add(entry.name)
    if (!OWNERS.includes(/** @type {string} */ (entry.owner))) {
      fail(`${label}: case "${entry.name}" names an unknown owner ${JSON.stringify(entry.owner)} for field "owner" at path ${path}.owner; repair: use one of ${OWNERS.join(', ')}.`)
    }
    if (!isRecord(entry.mutation)) {
      fail(`${label}: case "${entry.name}" is missing its mutation at path ${path}.mutation; repair: restore the mutation record.`)
    }
    const kind = /** @type {Record<string, unknown>} */ (entry.mutation).kind
    if (entry.owner === 'surface-manifest') {
      checkExact(entry, ['name', 'family', 'owner', 'mutation', 'expectValid', ...(entry.expectValid ? [] : ['expectedField'])], 'case', label, path)
      if (typeof entry.expectValid !== 'boolean') {
        fail(`${label}: case "${entry.name}" is missing a boolean outcome at path ${path}.expectValid; repair: restore the expected validity boolean.`)
      }
      if (!CLASSIFICATION_MUTATION_KINDS.includes(/** @type {string} */ (kind))) {
        fail(`${label}: case "${entry.name}" names an unknown classification mutation ${JSON.stringify(kind)} for field "mutation" at path ${path}.mutation.kind; repair: use one of ${CLASSIFICATION_MUTATION_KINDS.join(', ')}.`)
      }
    } else if (entry.owner === 'run-root-refusal') {
      checkExact(entry, ['name', 'family', 'owner', 'mutation', 'expectStatus', 'expectedField'], 'case', label, path)
      if (!Number.isInteger(entry.expectStatus) || /** @type {number} */ (entry.expectStatus) === 0) {
        fail(`${label}: case "${entry.name}" is missing a non-zero refusal exit code at path ${path}.expectStatus; repair: name the exit code the verifier refuses with.`)
      }
      if (typeof entry.expectedField !== 'string' || entry.expectedField.length === 0) {
        fail(`${label}: case "${entry.name}" is missing the refused field at path ${path}.expectedField; repair: name the field the refusal must call out.`)
      }
      if (!EVIDENCE_MUTATION_KINDS.includes(/** @type {string} */ (kind))) {
        fail(`${label}: case "${entry.name}" names an unknown evidence mutation ${JSON.stringify(kind)} for field "mutation" at path ${path}.mutation.kind; repair: use one of ${EVIDENCE_MUTATION_KINDS.join(', ')}.`)
      }
    } else {
      checkExact(entry, ['name', 'family', 'owner', 'mutation', 'expectComplete', 'expectedCodes'], 'case', label, path)
      if (typeof entry.expectComplete !== 'boolean') {
        fail(`${label}: case "${entry.name}" is missing a boolean outcome at path ${path}.expectComplete; repair: restore the expected completeness boolean.`)
      }
      checkStringArray(entry.expectedCodes, `${path}.expectedCodes`, label)
      if (!EVIDENCE_MUTATION_KINDS.includes(/** @type {string} */ (kind))) {
        fail(`${label}: case "${entry.name}" names an unknown evidence mutation ${JSON.stringify(kind)} for field "mutation" at path ${path}.mutation.kind; repair: use one of ${EVIDENCE_MUTATION_KINDS.join(', ')}.`)
      }
    }
  }
}

/** @param {Record<string, unknown>[]} cases @param {string[]} requiredFamilies */
function checkFamilyCoverage(cases, requiredFamilies) {
  const label = CORPUS_REL
  for (const family of requiredFamilies) {
    if (!cases.some((entry) => entry.family === family)) {
      fail(`${label}: required family ${JSON.stringify(family)} has no case at path cases[].family; repair: add the case that drives family "${family}".`)
    }
  }
  for (const family of requiredFamilies) {
    if (family === 'baseline' || family === 'classification') continue
    const matches = cases.filter((entry) => entry.family === family)
    if (matches.length !== 1) {
      fail(`${label}: family ${JSON.stringify(family)} must have exactly one case at path cases[].family; observed ${matches.length}; repair: keep one named case per mutation disposition.`)
    }
  }
}

/* ── run materialization and mutations ────────────────────────────────── */

/** @param {string} kind @param {Record<string, unknown>} run */
function identityIdFor(kind, run) {
  return kind === 'product' ? /** @type {string} */ (run.identity.product) : /** @type {string} */ (run.identity.component)
}

/** @param {string} kind @param {string} theme @param {string} identityId @param {number} observedAtMs */
function buildProof(kind, theme, identityId, observedAtMs) {
  const themeObservation = { expected: theme, observed: theme, source: 'mutation-fixture', observedAtMs }
  const identity = { kind, id: identityId, createdAtMs: 0 }
  if (kind === 'product') {
    const part = { observed: true, observedAtMs }
    return { kind, identity, chrome: { ...part }, body: { ...part }, route: { ...part }, activeSection: { ...part }, view: { ...part }, theme: themeObservation }
  }
  return { kind, identity, root: { mounted: true, observedAtMs }, theme: themeObservation }
}

/** @param {Record<string, unknown>} corpusValue @param {Record<string, unknown>} run */
function makeSpec(corpusValue, run) {
  const templates = /** @type {Record<string, string>} */ (corpusValue.artifactTemplates)
  const requiredRoot = (kind) => kind === 'product' ? /** @type {string} */ (run.roots.product) : /** @type {string} */ (run.roots.component)
  return {
    policy: { .../** @type {Record<string, unknown>} */ (run.policy) },
    rows: /** @type {Record<string, unknown>[]} */ (run.rows).map((row) => ({
      key: row.key,
      requiredKind: row.kind,
      requiredRoot: requiredRoot(/** @type {string} */ (row.kind)),
      kind: row.kind,
      theme: row.theme,
      provenanceRoot: requiredRoot(/** @type {string} */ (row.kind)),
      artifacts: Object.fromEntries(Object.entries(templates).map(([name, template]) => [name, template.replaceAll('{row}', /** @type {string} */ (row.key))])),
      deleted: false,
      stale: /** @type {Record<string, string>} */ ({}),
    })),
  }
}

/** @param {Record<string, unknown>} spec @param {Record<string, unknown>} mutation */
function applyEvidenceMutation(spec, mutation) {
  const rows = /** @type {Record<string, any>[]} */ (spec.rows)
  const kind = /** @type {string} */ (mutation.kind)
  if (kind === 'none') return
  if (kind === 'cap-output') {
    /** @type {Record<string, unknown>} */ (spec.policy).maxOutputBytes = mutation.value
    return
  }
  if (kind === 'delete-produced-at') {
    const row = rows.find((entry) => entry.key === mutation.target)
    if (!row) fail(`${CORPUS_REL}: mutation target ${JSON.stringify(mutation.target)} is not a declared row; repair: target one of the required row keys.`)
    row.dropProducedAt = true
    return
  }
  const row = rows.find((entry) => entry.key === mutation.target)
  if (!row) fail(`${CORPUS_REL}: mutation target ${JSON.stringify(mutation.target)} is not a declared row; repair: target one of the required row keys.`)
  if (kind === 'delete-producer-row') { row.deleted = true; return }
  if (kind === 'set-row-kind') { row.kind = mutation.value; return }
  if (kind === 'set-provenance-root') { row.provenanceRoot = mutation.value; return }
  if (kind === 'delete-artifact') { delete row.artifacts[/** @type {string} */ (mutation.artifact)]; return }
  if (kind === 'stale-artifact-digest') { row.stale[/** @type {string} */ (mutation.artifact)] = STALE_DIGEST; return }
  if (kind === 'copy-artifact') {
    const source = rows.find((entry) => entry.key === mutation.from)
    if (!source) fail(`${CORPUS_REL}: copy-artifact source ${JSON.stringify(mutation.from)} is not a declared row; repair: name a declared source row.`)
    row.artifacts[/** @type {string} */ (mutation.artifact)] = source.artifacts[/** @type {string} */ (mutation.artifact)]
    return
  }
  fail(`${CORPUS_REL}: unsupported evidence mutation kind ${kind} at path case.mutation.kind; repair: use a declared evidence mutation kind.`)
}

/** @param {Record<string, unknown>} spec @param {Record<string, unknown>} run */
function writeRunRoot(spec, run) {
  const parent = mkdtempSync(join(tmpdir(), 'fairtest-evidence-mutations-'))
  const root = join(parent, /** @type {string} */ (run.runId))
  mkdirSync(join(root, 'guards'), { recursive: true })
  writeFileSync(join(root, 'guards', 'run-envelope.json'), `${JSON.stringify({ runId: run.runId }, null, 2)}\n`)
  mkdirSync(join(root, 'producer'), { recursive: true })
  for (const row of /** @type {Record<string, any>[]} */ (spec.rows)) {
    if (row.deleted) continue
    const dir = join(root, 'producer', row.key)
    mkdirSync(dir, { recursive: true })
    const observedAtMs = Date.now()
    const identityId = identityIdFor(row.kind, run)
    const record = { target: row.key, kind: row.kind, rowTheme: row.theme, theme: { expected: row.theme, observed: row.theme, source: 'mutation-fixture', observedAtMs } }
    if (row.dropProducedAt !== true) record.producedAtMs = observedAtMs
    writeFileSync(join(dir, 'record.json'), `${JSON.stringify(record, null, 2)}\n`)
    writeFileSync(join(dir, 'resolution.json'), `${JSON.stringify(buildProof(row.kind, row.theme, identityId, observedAtMs), null, 2)}\n`)
    writeFileSync(join(dir, 'provenance.json'), `${JSON.stringify({ root: row.provenanceRoot, servedFrom: run.servedFrom, row: row.key }, null, 2)}\n`)
    for (const [name, content] of Object.entries(row.artifacts)) writeFileSync(join(dir, name), /** @type {string} */ (content))
  }
  return { parent, root }
}

/** @param {Record<string, any>} row @param {Record<string, unknown>} run */
function derivedArtifacts(row, run) {
  const observedAtMs = Date.now()
  const identityId = identityIdFor(row.kind, run)
  return {
    'record.json': JSON.stringify({ target: row.key, kind: row.kind, rowTheme: row.theme }),
    'resolution.json': JSON.stringify(buildProof(row.kind, row.theme, identityId, observedAtMs)),
    'provenance.json': JSON.stringify({ root: row.provenanceRoot, servedFrom: run.servedFrom, row: row.key }),
  }
}

/** @param {Record<string, unknown>} spec @param {Record<string, unknown>} run */
function buildRunModel(spec, run) {
  const observedAtMs = /** @type {number} */ (run.nowMs) - 1000
  const rows = /** @type {Record<string, any>[]} */ (spec.rows)
    .filter((row) => !row.deleted)
    .map((row) => {
      const identityId = identityIdFor(row.kind, run)
      const contents = { ...row.artifacts, ...derivedArtifacts(row, run) }
      const artifacts = Object.entries(contents).map(([name, content]) =>
        createArtifactObservation({
          name,
          content: /** @type {string} */ (content),
          digest: row.stale[name] ?? artifactDigest(/** @type {string} */ (content)),
        }))
      return createEvidenceRow({
        key: row.key,
        kind: row.kind,
        theme: row.theme,
        identity: { kind: row.kind, id: identityId, createdAtMs: 0 },
        proof: buildProof(row.kind, row.theme, identityId, observedAtMs),
        themeObservation: { expected: row.theme, observed: row.theme, source: 'mutation-fixture', observedAtMs },
        provenance: { root: row.provenanceRoot, servedFrom: run.servedFrom },
        artifacts,
        observedAtMs,
      })
    })
  return createEvidenceRun({ identity: { kind: 'run', id: run.runId, createdAtMs: 0 }, mode: 'single-capture', rows })
}

/** @param {Record<string, unknown>} spec @param {Record<string, unknown>} run */
function buildPolicy(spec, run) {
  const policy = /** @type {Record<string, unknown>} */ (spec.policy)
  return createEvidencePolicy({
    version: policy.version,
    runId: run.runId,
    mode: 'single-capture',
    artifactClasses: policy.artifactClasses,
    requiredRows: /** @type {Record<string, any>[]} */ (spec.rows).map((row) => ({ key: row.key, kind: row.requiredKind, theme: row.theme, root: row.requiredRoot })),
    duplicateScopes: policy.duplicateScopes,
    maxAgeMs: policy.maxAgeMs,
    maxOutputBytes: policy.maxOutputBytes,
  })
}

/** @param {string} root @param {string} runId */
function runVerifyCli(root, runId) {
  const result = spawnSync(process.execPath, [VERIFY_CLI], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FAIRTEST_RUN_ROOT: root, FAIRTEST_RUN_ID: runId },
  })
  return { status: result.status ?? 1, combined: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}

/** @param {object} report @param {Record<string, unknown>} entry */
function assertReport(report, entry) {
  const name = /** @type {string} */ (entry.name)
  validateEvidenceReport(report, name)
  assert.equal(/** @type {Record<string, any>} */ (report).complete, entry.expectComplete, `${name}: report.complete does not match case.expectComplete at path case.expectComplete; repair: restore the expected completeness outcome.`)
  assert.equal(/** @type {Record<string, any>} */ (report).verdict, entry.expectComplete ? 'pass' : 'fail', `${name}: report.verdict contradicts complete at path case.expectComplete; repair: derive the verdict from the failure list.`)
  assert.deepEqual(
    [.../** @type {Record<string, any>} */ (report).failureCodes].sort(),
    [.../** @type {string[]} */ (entry.expectedCodes)].sort(),
    `${name}: failure codes do not match case.expectedCodes at path case.expectedCodes; repair: restore the intended owning-boundary outcome.`,
  )
  for (const code of /** @type {string[]} */ (entry.expectedCodes)) {
    const failure = /** @type {Record<string, any>[]} */ (/** @type {Record<string, any>} */ (report).failures).find((item) => item.code === code)
    assert.ok(failure, `${name}: report carries no typed failure for code ${JSON.stringify(code)} at path failures; repair: keep the owning boundary emitting ${code}.`)
    assert.ok(typeof failure.path === 'string' && failure.path.includes('.'), `${name}: failure ${JSON.stringify(code)} is missing a value path at path failures[].path; repair: name the failing value path.`)
    assert.ok(typeof failure.repair === 'string' && failure.repair.length > 0, `${name}: failure ${JSON.stringify(code)} is missing repair guidance at path failures[].repair; repair: append an actionable repair hint.`)
  }
}

/* ── case execution ───────────────────────────────────────────────────── */

/** @param {Record<string, unknown>} entry @param {Record<string, unknown>} run */
function runEvidenceCase(entry, run) {
  const spec = makeSpec(corpus, run)
  applyEvidenceMutation(spec, /** @type {Record<string, unknown>} */ (entry.mutation))
  if (entry.owner === 'run-root-refusal') {
    const { parent, root } = writeRunRoot(spec, run)
    try {
      const result = runVerifyCli(root, /** @type {string} */ (run.runId))
      assert.equal(result.status, entry.expectStatus, `${entry.name}: run-root verifier exited ${result.status} for field "expectStatus" at path case.expectStatus; expected exit ${entry.expectStatus}; repair: restore the fail-closed refusal.\n${result.combined}`)
      assert.ok(result.combined.includes(/** @type {string} */ (entry.expectedField)), `${entry.name}: refusal must name ${entry.expectedField} at path case.expectedField; observed ${result.combined}`)
      assert.ok(!existsSync(join(root, 'evidence', 'evidence.json')), `${entry.name}: a refused run must not write evidence/evidence.json`)
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
    return
  }
  if (entry.owner === 'run-root') {
    const { parent, root } = writeRunRoot(spec, run)
    try {
      const result = runVerifyCli(root, /** @type {string} */ (run.runId))
      const expectedStatus = entry.expectComplete ? 0 : 1
      assert.equal(result.status, expectedStatus, `${entry.name}: run-root verifier exited ${result.status} for field "expectComplete" at path case.expectComplete; expected exit ${expectedStatus}; repair: restore the expected completeness outcome.\n${result.combined}`)
      const report = JSON.parse(readFileSync(join(root, 'evidence', 'evidence.json'), 'utf8'))
      assertReport(report, entry)
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
    return
  }
  const report = verifyEvidenceRun(buildRunModel(spec, run), buildPolicy(spec, run), { nowMs: run.nowMs })
  assertReport(report, entry)
}

/** @param {Record<string, unknown>} mutation @param {Record<string, unknown>[]} importers */
function applyClassificationMutation(mutation, importers) {
  const kind = /** @type {string} */ (mutation.kind)
  if (kind === 'none') return { importers, workflowText: workflowSource, requiredGate: consumerManifest.requiredGateImporterPaths, specializedPresent: (path) => existsSync(join(ROOT, path)) }
  if (kind === 'invoke-specialized-in-ci') {
    return {
      importers,
      workflowText: `${workflowSource}\n      - name: borrowed specialized probe\n        run: node ${mutation.consumer}\n`,
      requiredGate: consumerManifest.requiredGateImporterPaths,
      specializedPresent: (path) => existsSync(join(ROOT, path)),
    }
  }
  if (kind === 'reclassify-importer') {
    const target = importers.find((entry) => entry.path === mutation.target)
    assert.ok(target, `${CORPUS_REL}: reclassify-importer target ${JSON.stringify(mutation.target)} is not a declared consumer; repair: target a declared consumer path.`)
    target.classification = mutation.value
    return { importers, workflowText: workflowSource, requiredGate: consumerManifest.requiredGateImporterPaths, specializedPresent: (path) => existsSync(join(ROOT, path)) }
  }
  if (kind === 'require-all-consumers') {
    for (const entry of importers) entry.classification = 'required-gate'
    return { importers, workflowText: workflowSource, requiredGate: importers.map((entry) => entry.path), specializedPresent: (path) => existsSync(join(ROOT, path)) }
  }
  fail(`${CORPUS_REL}: unsupported classification mutation ${kind} at path case.mutation.kind; repair: use a declared classification mutation kind.`)
}

/** @param {Record<string, unknown>} entry */
function runClassificationCase(entry) {
  const importers = structuredClone(/** @type {Record<string, unknown>[]} */ (consumerCorpus.importers))
  const applied = applyClassificationMutation(/** @type {Record<string, unknown>} */ (entry.mutation), importers)
  let message = null
  try {
    inspectConsumerClassification({
      importers: applied.importers,
      requiredGateImporterPaths: applied.requiredGate,
      workflowText: applied.workflowText,
      specializedPresent: applied.specializedPresent,
      label: CONSUMER_CORPUS_REL,
    })
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${entry.name}: honest classification was refused: ${message}`)
    return
  }
  assert.ok(message, `${entry.name}: mutated classification passed the consumer guard`)
  assert.ok(message.includes(/** @type {string} */ (entry.expectedField)), `${entry.name}: diagnostic names the wrong field; expected ${entry.expectedField}, received ${message}`)
  assert.ok(message.includes('at path'), `${entry.name}: diagnostic is missing path context: ${message}`)
  assert.ok(message.includes('repair:'), `${entry.name}: diagnostic is missing repair guidance: ${message}`)
}

/** @param {Record<string, unknown>} entry @param {Record<string, unknown>} run */
function runCase(entry, run) {
  if (entry.owner === 'surface-manifest') runClassificationCase(entry)
  else runEvidenceCase(entry, run)
}

/* ── fixture-shape mutations ──────────────────────────────────────────── */

/** @param {Record<string, unknown>[]} cases @param {Record<string, unknown>} mutation */
function applyFixtureMutation(cases, mutation) {
  if (mutation.kind === 'duplicate-name') {
    const donor = cases.find((entry) => entry.name !== mutation.target) ?? cases[0]
    cases.push({ ...structuredClone(donor), name: mutation.target })
    return
  }
  if (mutation.kind === 'delete-record') {
    const index = cases.findIndex((entry) => entry.name === mutation.target)
    assert.notEqual(index, -1, `unknown mutation target ${mutation.target}`)
    cases.splice(index, 1)
    return
  }
  const target = cases.find((entry) => entry.name === mutation.target)
  assert.ok(target, `unknown mutation target ${mutation.target}`)
  const segments = /** @type {string} */ (mutation.field).split('.')
  if (mutation.kind === 'delete-field') {
    const node = segments.length === 1 ? target : segments.slice(0, -1).reduce((acc, segment) => /** @type {Record<string, unknown>} */ (acc[segment]), target)
    delete node[segments.at(-1)]
    return
  }
  if (mutation.kind === 'rename-field') {
    const node = segments.length === 1 ? target : segments.slice(0, -1).reduce((acc, segment) => /** @type {Record<string, unknown>} */ (acc[segment]), target)
    const last = segments.at(-1)
    const value = node[last]
    delete node[last]
    node[/** @type {string} */ (mutation.newField)] = value
    return
  }
  const node = segments.length === 1 ? target : segments.slice(0, -1).reduce((acc, segment) => /** @type {Record<string, unknown>} */ (acc[segment]), target)
  node[segments.at(-1)] = structuredClone(mutation.value)
}

/* ── tests ────────────────────────────────────────────────────────────── */

describe('fairtest evidence mutations', () => {
  const run = /** @type {Record<string, unknown>} */ (corpus.run)
  const cases = /** @type {Record<string, unknown>[]} */ (corpus.cases)

  it('holds a valid manifest inventory', () => {
    validateManifest(manifest)
  })

  it('holds exact fields, required names, and one case per family', () => {
    validateCorpus(corpus)
    assert.equal(cases.length, manifest.expectedCaseCount, `${CORPUS_REL}: case count must match the manifest`)
    checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS_REL)
    checkFamilyCoverage(cases, /** @type {string[]} */ (manifest.requiredFamilyNames))
  })

  it('executes every named case through its owning boundary', () => {
    for (const entry of cases) runCase(entry, run)
  })

  it('fails every executable fixture mutation for its intended field', () => {
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          loadSingleDocument(`${corpusSource.trimEnd()}\n---\norphan: true\n`, CORPUS_REL)
        } else {
          const mutated = structuredClone(cases)
          applyFixtureMutation(mutated, mutation)
          validateCorpus({ ...corpus, cases: mutated })
          checkRequiredNames(mutated.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS_REL)
          checkFamilyCoverage(mutated, /** @type {string[]} */ (manifest.requiredFamilyNames))
          runCase(/** @type {Record<string, unknown>} */ (mutated.find((entry) => entry.name === mutation.target)), run)
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${CORPUS_REL}: mutation "${mutation.name}" passed validation instead of failing`)
      assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${CORPUS_REL}: mutation "${mutation.name}" names the wrong field; expected ${mutation.expectedField}, received ${message}`)
      assert.ok(message.includes('at path'), `${CORPUS_REL}: mutation "${mutation.name}" is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `${CORPUS_REL}: mutation "${mutation.name}" is missing repair guidance: ${message}`)
    }
  })

  it('keeps the mutation fixture free of route, selector, and threshold literals', () => {
    const forbidden = ['#inuse', '\\[data-theme', 'txn-scrubber', '#storybook-root', 'storybook-static/', '127\\.0\\.0\\.1', 'https?://']
    for (const pattern of forbidden) {
      assert.ok(!new RegExp(pattern).test(corpusSource), `${CORPUS_REL}: matches forbidden fixture pattern ${pattern}`)
    }
    assert.ok(!/@xyflow/.test(corpusSource), `${CORPUS_REL}: names a graph package`)
  })
})
