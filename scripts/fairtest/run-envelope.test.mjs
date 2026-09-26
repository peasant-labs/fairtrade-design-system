#!/usr/bin/env node
// Fairtest run-envelope fixture executor.
//
// Loads scripts/testdata/fairtest-run-envelope.yaml and its required-name
// manifest, then executes the named cases against the REAL run-envelope command
// modules (init, list, select, selection-receipt, preflight) in throwaway run
// roots, and against the real .github/workflows/ci.yml source. Every negative
// case is a source mutation that must fail for its named field; the workflow
// mutations edit the workflow text and require the CI guard to go red. No case
// table is inline: combinatorial cases live in the fixture. Browser-free; it
// starts no service.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { loadSingleDocument } from '../fairtest-single-document.mjs'
import { fairtestEvidencePolicyInput } from './fairtest-evidence-policy.mjs'
import {
  CI_ROW_KEYS,
  EVIDENCE_REL,
  FAIRTEST_BUDGET,
  LOCAL_ROW_KEYS,
  MODE_KEYS,
  PRODUCER_ARTIFACT_CLASSES,
  RUN_ENVELOPE_REL,
  RUN_SUBTREES,
  SELECTION_RECEIPT_REL,
  SELECTION_REL,
  UPLOAD_PIN,
  assertExactKeys,
  inventoryReceiptRel,
} from './run-envelope-contract.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CORPUS_REL = 'scripts/testdata/fairtest-run-envelope.yaml'
const MANIFEST_REL = 'scripts/testdata/fairtest-run-envelope.manifest.yaml'
const WORKFLOW_REL = '.github/workflows/ci.yml'

const CHECKS = [
  'key-set', 'pre-service-flow', 'init-missing-root', 'init-wrong-root', 'init-prior-root',
  'select-prior-selection', 'select-run-id-mismatch', 'receipt-missing-selection', 'receipt-tampered-envelope',
  'preflight-missing-root', 'preflight-missing-envelope', 'preflight-missing-inventory-receipt',
  'preflight-missing-selection-receipt', 'preflight-incomplete-evidence', 'preflight-selection-digest-mismatch',
  'preflight-local-mode-selection', 'preflight-undeclared-sibling',
  'preflight-complete-run', 'budget-sum', 'envelope-shape',
  'verify-prior-evidence', 'verify-wrong-root',
  'workflow', 'workflow-order', 'workflow-budget',
]
const CASE_FIELDS = ['name', 'check']
const CASE_OPTIONAL_FIELDS = new Set(['mode', 'keys', 'expectValid', 'expectedErrorContains', 'fragment'])
const MUTATION_KINDS = ['delete-record', 'stale-name', 'duplicate-name', 'delete-field', 'rename-field', 'unknown-field', 'bad-value', 'trailing-document']

const corpusSource = readFileSync(resolve(ROOT, CORPUS_REL), 'utf8')
const manifestSource = readFileSync(resolve(ROOT, MANIFEST_REL), 'utf8')
const manifest = loadSingleDocument(manifestSource, MANIFEST_REL)
const corpus = loadSingleDocument(corpusSource, CORPUS_REL)
const workflowSource = readFileSync(resolve(ROOT, WORKFLOW_REL), 'utf8')

validateManifest(manifest)
validateCorpus(corpus, CORPUS_REL)

let runCounter = 0

/**
 * Run one Fairtest command module as a real child process.
 * @param {string} script repository-relative script path
 * @param {string[]} args command arguments
 * @param {{ root?: string, runId?: string, env?: Record<string, string> }} [options]
 * @returns {{ status: number, stdout: string, stderr: string, combined: string }}
 */
function runCli(script, args, options = {}) {
  const env = { ...process.env, ...options.env }
  if (options.root !== undefined) env.FAIRTEST_RUN_ROOT = options.root
  if (options.runId !== undefined) env.FAIRTEST_RUN_ID = options.runId
  const result = spawnSync(process.execPath, [resolve(ROOT, script), ...args], { cwd: ROOT, encoding: 'utf8', env })
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  return { status: result.status ?? 1, stdout, stderr, combined: `${stdout}\n${stderr}` }
}

/**
 * Create a unique run root whose final path segment is the run id. The parent
 * directory is removed by the caller.
 * @returns {{ parent: string, root: string, runId: string }}
 */
function makeRunRoot() {
  runCounter += 1
  const parent = mkdtempSync(join(tmpdir(), 'fairtest-envelope-'))
  const runId = `run-${process.pid}-${runCounter}`
  const root = join(parent, runId)
  return { parent, root, runId }
}

/**
 * Populate a fresh run root with every pre-service owner's output.
 * @param {{ mode?: string }} [options]
 * @returns {{ parent: string, root: string, runId: string }}
 */
function setupRun(options = {}) {
  const mode = options.mode ?? 'ci'
  const { parent, root, runId } = makeRunRoot()
  const init = runCli('scripts/fairtest/init-fairtest.mjs', [], { root, runId })
  assert.equal(init.status, 0, `init must succeed:\n${init.combined}`)
  const listCi = runCli('scripts/fairtest/list-fairtest.mjs', ['--mode=ci'], { root, runId })
  assert.equal(listCi.status, 0, `list:ci must succeed:\n${listCi.combined}`)
  const listLocal = runCli('scripts/fairtest/list-fairtest.mjs', ['--mode=local'], { root, runId })
  assert.equal(listLocal.status, 0, `list:local must succeed:\n${listLocal.combined}`)
  const select = runCli('scripts/fairtest/select-fairtest.mjs', [`--mode=${mode}`], { root, runId })
  assert.equal(select.status, 0, `select must succeed:\n${select.combined}`)
  const receipt = runCli('scripts/fairtest/selection-receipt.mjs', [], { root, runId })
  assert.equal(receipt.status, 0, `selection-receipt must succeed:\n${receipt.combined}`)
  // The mounted producers own the fourth subtree; this browser-free fixture
  // creates the directory so the preflight's exact-subtree check can pass
  // without running a browser. The preflight reads no producer row here.
  mkdirSync(join(root, 'producer'), { recursive: true })
  return { parent, root, runId }
}

/**
 * Write a synthetic but structurally valid verifier report so the preflight
 * completeness path can be exercised without a browser.
 * @param {string} root run root
 * @param {string} runId run id
 * @param {{ complete?: boolean }} [options]
 * @returns {void}
 */
function writeEvidence(root, runId, options = {}) {
  const complete = options.complete ?? true
  const path = join(root, EVIDENCE_REL)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({
    policyVersion: 1,
    runId,
    mode: 'single-capture',
    complete,
    verdict: complete ? 'pass' : 'fail',
    failureCodes: complete ? [] : ['missing-row'],
    failures: [],
    rows: [],
    artifactClasses: [...PRODUCER_ARTIFACT_CLASSES],
  }, null, 2)}\n`)
}

/**
 * Assert a command failed and that its diagnostic names every expected
 * fragment.
 * @param {{ status: number, combined: string }} result command result
 * @param {string[]} fragments expected substrings
 * @param {string} label case label used in the assertion message
 * @returns {void}
 */
function expectFailure(result, fragments, label) {
  assert.notEqual(result.status, 0, `${label}: command must fail:\n${result.combined}`)
  for (const fragment of fragments) {
    assert.ok(result.combined.includes(fragment), `${label}: diagnostic must include ${JSON.stringify(fragment)}:\n${result.combined}`)
  }
}

/**
 * Cross-check the fixture key sets against the contract and the verifier's
 * required rows, so the fixture cannot drift from production.
 * @param {Record<string, any>} value parsed corpus
 * @returns {void}
 */
function assertKeySetsMatchContract(value) {
  for (const mode of ['ci', 'local']) {
    const actual = value?.keySets?.[mode]?.keys
    const expected = MODE_KEYS[mode]
    if (JSON.stringify(actual) !== JSON.stringify([...expected])) {
      throw new Error(
        `${CORPUS_REL}: key set drifted for field "keySets.${mode}.keys" at path keySets.${mode}.keys; ` +
        `expected ${JSON.stringify([...expected])} observed ${JSON.stringify(actual)}; ` +
        `repair: keep the ${mode} key set equal to the run-envelope contract.`,
      )
    }
  }
  if (JSON.stringify([...CI_ROW_KEYS]) !== JSON.stringify([...MODE_KEYS.ci])) {
    throw new Error(
      `${CORPUS_REL}: CI key set does not match the verifier rows for field "keySets.ci.keys" at path keySets.ci.keys; ` +
      'repair: keep the CI key set equal to the evidence policy required rows.',
    )
  }
  if (LOCAL_ROW_KEYS.some((key) => CI_ROW_KEYS.includes(key))) {
    throw new Error(
      `${CORPUS_REL}: a local key appears in the CI set for field "keySets.local.keys" at path keySets.local.keys; ` +
      'repair: keep local exploration identities out of the CI evidence set.',
    )
  }
}

/* ── fixture shape validation ─────────────────────────────────────────── */

/**
 * Validate the corpus record shape.
 * @param {Record<string, any>} value parsed corpus
 * @param {string} label owning file
 * @returns {void}
 */
function validateCorpus(value, label) {
  checkKeys(value, ['expectedCaseCount', 'keySets', 'cases'], 'document', label)
  const keySets = value.keySets
  if (!keySets || typeof keySets !== 'object') {
    throw new Error(`${label}: missing key sets for field "keySets" at path keySets; repair: restore the ci and local key sets.`)
  }
  for (const mode of ['ci', 'local']) {
    const entry = keySets[mode]
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${label}: missing key set for field "keySets.${mode}" at path keySets.${mode}; repair: restore the ${mode} key set record.`)
    }
    checkKeys(entry, ['keys'], `key set ${mode}`, label, `keySets.${mode}`)
    const keys = entry.keys
    if (!Array.isArray(keys) || keys.length === 0 || keys.some((key) => typeof key !== 'string' || key.length === 0)) {
      throw new Error(`${label}: invalid key list for field "keySets.${mode}.keys" at path keySets.${mode}.keys; repair: name the exact ${mode} keys.`)
    }
  }
  assertKeySetsMatchContract(value)
  const cases = value.cases
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error(`${label}: no cases for field "cases" at path cases; repair: restore the named case list.`)
  }
  const seen = new Set()
  for (const [index, entry] of cases.entries()) {
    const path = `cases[${index}]`
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${label}: malformed case at path ${path}; repair: restore the case record.`)
    }
    for (const field of CASE_FIELDS) {
      if (!(field in entry)) {
        throw new Error(`${label}: missing required field "${field}" at path ${path}.${field}; repair: restore "${field}".`)
      }
    }
    for (const key of Object.keys(entry)) {
      if (!CASE_FIELDS.includes(key) && !CASE_OPTIONAL_FIELDS.has(key)) {
        throw new Error(`${label}: unknown field "${key}" at path ${path}.${key}; repair: remove "${key}" from the case.`)
      }
    }
    if (!CHECKS.includes(entry.check)) {
      throw new Error(`${label}: unknown check discriminator ${JSON.stringify(entry.check)} for field "check" at path ${path}.check; repair: use one of ${CHECKS.join(', ')}.`)
    }
    if (seen.has(entry.name)) {
      throw new Error(`${label}: duplicate case name ${JSON.stringify(entry.name)} at path ${path}.name; repair: give every case a unique name.`)
    }
    seen.add(entry.name)
  }
}

/* ── manifest validation ──────────────────────────────────────────────── */

/**
 * Validate the required-name manifest shape.
 * @param {Record<string, any>} value parsed manifest
 * @returns {void}
 */
function validateManifest(value) {
  checkKeys(value, [
    'expectedCaseCount', 'requiredCaseNames',
    'expectedMutationCount', 'requiredMutationNames', 'mutations',
    'expectedWorkflowMutationCount', 'requiredWorkflowMutationNames', 'workflowMutations',
  ], 'manifest', MANIFEST_REL)
  assert.equal(value.expectedCaseCount, value.requiredCaseNames.length, `${MANIFEST_REL}: case count must equal the required-name inventory at path manifest.expectedCaseCount; repair: align expectedCaseCount with requiredCaseNames.`)
  assert.equal(value.expectedMutationCount, value.mutations.length, `${MANIFEST_REL}: mutation count must equal the inventory at path manifest.expectedMutationCount; repair: align the counts.`)
  assert.equal(value.expectedWorkflowMutationCount, value.workflowMutations.length, `${MANIFEST_REL}: workflow mutation count must equal the inventory at path manifest.expectedWorkflowMutationCount; repair: align the counts.`)
  checkRequiredNames(value.mutations.map((entry) => entry.name), value.requiredMutationNames, MANIFEST_REL)
  checkRequiredNames(value.workflowMutations.map((entry) => entry.name), value.requiredWorkflowMutationNames, MANIFEST_REL)
  for (const [index, mutation] of value.mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'unknown-field', 'bad-value'].includes(mutation.kind)) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(mutation.kind)) fields.push('value')
    if (mutation.kind === 'stale-name') fields.push('value')
    checkKeys(mutation, fields, 'mutation', MANIFEST_REL, `manifest.mutations[${index}]`)
    assert.ok(MUTATION_KINDS.includes(mutation.kind), `${MANIFEST_REL}: mutation ${index} names an unknown kind at path manifest.mutations[${index}].kind; repair: use one of ${MUTATION_KINDS.join(', ')}.`)
  }
  for (const [index, mutation] of value.workflowMutations.entries()) {
    checkKeys(mutation, ['name', 'find', 'replace', 'expectedField'], 'workflow mutation', MANIFEST_REL, `manifest.workflowMutations[${index}]`)
    assert.equal(typeof mutation.find, 'string', `${MANIFEST_REL}: workflow mutation ${index} must declare a find string at path manifest.workflowMutations[${index}].find; repair: restore the exact source substring.`)
  }
}

/**
 * Assert an object holds exactly the declared fields.
 * @param {unknown} value object to check
 * @param {string[]} fields declared fields
 * @param {string} tag record label
 * @param {string} label owning file
 * @param {string} [path] value path
 * @returns {void}
 */
function checkKeys(value, fields, tag, label, path = '') {
  const where = path ? ` at path ${path}` : ''
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${tag}: record is missing or malformed${where} in ${label}; repair: restore the record with exactly: ${fields.join(', ')}.`)
  }
  for (const field of fields) {
    if (!(field in value)) {
      throw new Error(`${tag}: missing required field "${field}"${where} in ${label}; repair: restore "${field}" in ${label}.`)
    }
  }
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) {
      throw new Error(`${tag}: unknown field "${key}"${where} in ${label}; repair: remove "${key}" from ${label}.`)
    }
  }
}

/**
 * Require exact name membership.
 * @param {string[]} actual observed names
 * @param {string[]} required required names
 * @param {string} label owning file
 * @returns {void}
 */
function checkRequiredNames(actual, required, label) {
  if (new Set(actual).size !== actual.length) {
    throw new Error(`${label}: names must be unique at path manifest; repair: list every name once.`)
  }
  const missing = required.filter((name) => !actual.includes(name))
  const unknown = actual.filter((name) => !required.includes(name))
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `${label}: required inventory mismatch at path manifest; missing ${JSON.stringify(missing)} unknown ${JSON.stringify(unknown)}; ` +
      'repair: restore the missing record or update the manifest required names.',
    )
  }
}

/* ── fixture mutations ────────────────────────────────────────────────── */

/**
 * Apply one executable mutation to a cloned corpus.
 * @param {Record<string, any>} value cloned corpus
 * @param {Record<string, any>} mutation mutation record
 * @returns {void}
 */
function applyCorpusMutation(value, mutation) {
  if (mutation.kind === 'duplicate-name') {
    const cases = value.cases
    const donor = cases.find((entry) => entry.name !== mutation.target) ?? cases[0]
    cases.push({ ...structuredClone(donor), name: mutation.target })
    return
  }
  if (mutation.kind === 'delete-record') {
    const index = value.cases.findIndex((entry) => entry.name === mutation.target)
    assert.notEqual(index, -1, `unknown mutation target ${mutation.target}`)
    value.cases.splice(index, 1)
    return
  }
  const [family, identity] = String(mutation.target).split(':')
  let target
  if (family === 'case') target = value.cases.find((entry) => entry.name === identity)
  else if (family === 'keySet') target = value.keySets[identity]
  else throw new Error(`unknown mutation family ${family}`)
  assert.ok(target, `unknown mutation target ${mutation.target}`)
  if (mutation.kind === 'stale-name') {
    target.name = mutation.value
    return
  }
  const segments = String(mutation.field).split('.')
  if (mutation.kind === 'delete-field') {
    deletePath(target, segments)
    return
  }
  if (mutation.kind === 'rename-field') {
    const node = segments.length === 1 ? target : getPath(target, segments.slice(0, -1))
    const last = segments.at(-1)
    const value_ = node[last]
    delete node[last]
    node[mutation.newField] = value_
    return
  }
  setPath(target, segments, structuredClone(mutation.value))
}

/** @param {Record<string, any>} root @param {string[]} segments @returns {any} */
function getPath(root, segments) {
  let node = root
  for (const segment of segments) node = node[segment]
  return node
}

/** @param {Record<string, any>} root @param {string[]} segments @param {any} value @returns {void} */
function setPath(root, segments, value) {
  let node = root
  for (const segment of segments.slice(0, -1)) {
    if (!node[segment] || typeof node[segment] !== 'object') node[segment] = {}
    node = node[segment]
  }
  node[segments.at(-1)] = value
}

/** @param {Record<string, any>} root @param {string[]} segments @returns {void} */
function deletePath(root, segments) {
  const parent = segments.length === 1 ? root : getPath(root, segments.slice(0, -1))
  delete parent[segments.at(-1)]
}

/* ── workflow guard ───────────────────────────────────────────────────── */

/**
 * Throw an actionable workflow-guard failure.
 * @param {string} field the field that is wrong
 * @param {string} detail what was expected and observed
 * @returns {never}
 */
function workflowFail(field, detail) {
  throw new Error(
    `fairtest workflow guard: invalid value for field "${field}" at path ${WORKFLOW_REL}; ${detail}; ` +
    'repair: restore the exact Fairtest CI wiring in .github/workflows/ci.yml.',
  )
}

/**
 * Parse the workflow and return the gates job.
 * @param {string} text workflow source
 * @returns {Record<string, any>} the gates job
 */
function gatesJob(text) {
  let doc
  try {
    doc = YAML.parse(text)
  } catch (error) {
    workflowFail('yaml', `the workflow does not parse: ${error instanceof Error ? error.message : String(error)}`)
  }
  const job = doc?.jobs?.gates
  if (!job) workflowFail('jobs.gates', 'the gates job is missing')
  return job
}

/**
 * Find a step by an exact name.
 * @param {Record<string, any>[]} steps workflow steps
 * @param {string} name exact step name
 * @returns {Record<string, any>} the step
 */
function stepByName(steps, name) {
  const step = steps.find((entry) => entry.name === name)
  if (!step) workflowFail(name, `the step ${JSON.stringify(name)} is missing`)
  return step
}

/**
 * The upload pin guard: the Fairtest upload step is pinned to the declared
 * commit SHA, uploads the run root, fails when no files are found, and is
 * bounded; the preflight runs always.
 * @param {string} text workflow source
 * @returns {void}
 */
function inspectWorkflowPin(text) {
  const job = gatesJob(text)
  const steps = Array.isArray(job.steps) ? job.steps : []
  const upload = steps.find((entry) => entry.name === 'Fairtest evidence upload')
  if (!upload) workflowFail('Fairtest evidence upload', 'the Fairtest evidence upload step is missing')
  if (upload.uses !== `${UPLOAD_PIN.action}@${UPLOAD_PIN.sha}`) {
    workflowFail('uses', `expected ${UPLOAD_PIN.action}@${UPLOAD_PIN.sha} observed ${JSON.stringify(upload.uses)}`)
  }
  if (upload.if !== 'always()') workflowFail('if', `the upload step must run always, observed ${JSON.stringify(upload.if)}`)
  if (!String(upload.with?.path ?? '').includes('FAIRTEST_RUN_ROOT')) {
    workflowFail('path', `the upload path must target the one run root, observed ${JSON.stringify(upload.with?.path)}`)
  }
  if (upload.with?.['if-no-files-found'] !== UPLOAD_PIN.ifNoFilesFound) {
    workflowFail('if-no-files-found', `expected ${JSON.stringify(UPLOAD_PIN.ifNoFilesFound)} observed ${JSON.stringify(upload.with?.['if-no-files-found'])}`)
  }
  if (upload.with?.['retention-days'] !== UPLOAD_PIN.retentionDays) {
    workflowFail('retention-days', `expected ${UPLOAD_PIN.retentionDays} observed ${JSON.stringify(upload.with?.['retention-days'])}`)
  }
  const preflight = steps.find((entry) => entry.name === 'Fairtest evidence preflight')
  if (!preflight) workflowFail('Fairtest evidence preflight', 'the preflight step is missing')
  if (preflight.if !== 'always()') workflowFail('always()', `the preflight must run always, observed ${JSON.stringify(preflight.if)}`)
}

/**
 * The ordering guard: the run starts after the clean builds, the browser-free
 * contracts run before the producers, verification precedes the always-run
 * preflight and upload, and the existing journey and timeline gates remain.
 * @param {string} text workflow source
 * @returns {void}
 */
function inspectWorkflowOrder(text) {
  const job = gatesJob(text)
  const steps = Array.isArray(job.steps) ? job.steps : []
  const names = [
    'Build Storybook',
    'Fairtest run envelope',
    'Fairtest browser-free contracts',
    'Fairtest inventory and selection (browser-free, before services)',
    'Fairtest mounted product producer',
    'Fairtest mounted component producer',
    'Fairtest evidence verification',
    'Fairtest evidence preflight',
  ]
  const indices = names.map((name) => {
    const index = steps.findIndex((entry) => entry.name === name)
    if (index < 0) workflowFail(name, `the step ${JSON.stringify(name)} is missing`)
    return index
  })
  for (let index = 1; index < indices.length; index += 1) {
    if (indices[index] <= indices[index - 1]) {
      workflowFail(names[index], `step ${JSON.stringify(names[index])} must follow ${JSON.stringify(names[index - 1])}`)
    }
  }
  // The cheap browser-free guards must actually run in the contracts step: the
  // run-envelope wiring guard and the SurfaceGate compatibility gate are
  // required gates, so dropping either command turns this guard red.
  const browserFree = stepByName(steps, 'Fairtest browser-free contracts')
  for (const command of ['pnpm test:fairtest:envelope', 'pnpm test:fairtest:compat']) {
    if (!String(browserFree.run ?? '').includes(command)) {
      workflowFail(command, `the browser-free contracts step must run ${command}, observed ${JSON.stringify(browserFree.run)}`)
    }
  }
  const uploadIndex = steps.findIndex((entry) => entry.name === 'Fairtest evidence upload')
  if (uploadIndex < indices[indices.length - 1]) {
    workflowFail('Fairtest evidence upload', 'the upload step must follow the preflight')
  }
  const journey = steps.find((entry) => entry.run === 'pnpm journey:ci')
  if (!journey) workflowFail('pnpm journey:ci', 'the existing journey gate is missing from the job')
  const timeline = steps.find((entry) => typeof entry.run === 'string' && entry.run.includes('pnpm test:timeline-rendered'))
  if (!timeline) workflowFail('pnpm test:timeline-rendered', 'the existing timeline gate is missing from the job')
  const uploadStep = steps[uploadIndex]
  const journeyIndex = steps.indexOf(journey)
  if (uploadStep === undefined || uploadIndex > journeyIndex) {
    workflowFail('Fairtest evidence upload', 'the upload must precede the existing journey gate so partial output is retained on an earlier failure')
  }
}

/**
 * The budget guard: the job stays at 30 minutes and the workflow declares the
 * same 24-minute Fairtest budget the run envelope records.
 * @param {string} text workflow source
 * @returns {void}
 */
function inspectWorkflowBudget(text) {
  const job = gatesJob(text)
  if (job['timeout-minutes'] !== 30) {
    workflowFail('timeout-minutes', `the gates job must stay at 30 minutes, observed ${JSON.stringify(job['timeout-minutes'])}`)
  }
  if (String(job.env?.FAIRTEST_BUDGET_MINUTES) !== String(FAIRTEST_BUDGET.totalMinutes)) {
    workflowFail('FAIRTEST_BUDGET_MINUTES', `expected ${FAIRTEST_BUDGET.totalMinutes} observed ${JSON.stringify(job.env?.FAIRTEST_BUDGET_MINUTES)}`)
  }
  if (!String(job.env?.FAIRTEST_RUN_ROOT ?? '').includes('/review-capture/fairtest/')) {
    workflowFail('FAIRTEST_RUN_ROOT', `the job must declare the one run root, observed ${JSON.stringify(job.env?.FAIRTEST_RUN_ROOT)}`)
  }
  if (!job.env?.FAIRTEST_RUN_ID) workflowFail('FAIRTEST_RUN_ID', 'the job must declare the one run id')
}

/**
 * Run every workflow guard; the first violation throws.
 * @param {string} text workflow source
 * @returns {void}
 */
function inspectWorkflow(text) {
  inspectWorkflowPin(text)
  inspectWorkflowOrder(text)
  inspectWorkflowBudget(text)
}

/* ── case dispatch ────────────────────────────────────────────────────── */

/**
 * Execute one fixture case against the real commands or the real workflow.
 * @param {Record<string, any>} entry case record
 * @returns {void}
 */
function runCase(entry) {
  const name = entry.name
  const expectValid = entry.expectValid !== false
  switch (entry.check) {
    case 'key-set': {
      let message = null
      try {
        assertExactKeys(entry.mode, entry.keys, 'fairtest envelope probe')
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      if (expectValid) assert.equal(message, null, `${name}: expected a valid key set but failed: ${message}`)
      else expectMessage(message, entry.expectedErrorContains, name)
      return
    }
    case 'pre-service-flow': {
      const run = setupRun({ mode: entry.mode ?? 'ci' })
      try {
        for (const rel of [RUN_ENVELOPE_REL, inventoryReceiptRel('ci'), inventoryReceiptRel('local'), SELECTION_REL, SELECTION_RECEIPT_REL]) {
          assert.ok(existsSync(join(run.root, rel)), `${name}: expected owner output ${rel}`)
        }
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'init-missing-root': {
      const { parent, root, runId } = makeRunRoot()
      try {
        const result = runCli('scripts/fairtest/init-fairtest.mjs', [], { runId, env: { FAIRTEST_RUN_ROOT: '' } })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(parent, { recursive: true, force: true })
      }
      return
    }
    case 'init-wrong-root': {
      const { parent, runId } = makeRunRoot()
      const wrong = join(parent, 'not-the-run-id')
      try {
        const result = runCli('scripts/fairtest/init-fairtest.mjs', [], { root: wrong, runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(parent, { recursive: true, force: true })
      }
      return
    }
    case 'init-prior-root': {
      const run = setupRun()
      try {
        const result = runCli('scripts/fairtest/init-fairtest.mjs', [], { root: run.root, runId: run.runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'select-prior-selection': {
      const run = setupRun()
      try {
        const result = runCli('scripts/fairtest/select-fairtest.mjs', [], { root: run.root, runId: run.runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'select-run-id-mismatch': {
      const run = setupRun()
      try {
        const envelopePath = join(run.root, RUN_ENVELOPE_REL)
        const envelope = JSON.parse(readFileSync(envelopePath, 'utf8'))
        envelope.runId = 'another-run-id'
        writeFileSync(envelopePath, `${JSON.stringify(envelope, null, 2)}\n`)
        const result = runCli('scripts/fairtest/select-fairtest.mjs', [], { root: run.root, runId: run.runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'receipt-missing-selection': {
      const run = setupRun()
      try {
        unlinkSync(join(run.root, SELECTION_REL))
        const result = runCli('scripts/fairtest/selection-receipt.mjs', [], { root: run.root, runId: run.runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'receipt-tampered-envelope': {
      const run = setupRun()
      try {
        unlinkSync(join(run.root, SELECTION_RECEIPT_REL))
        const selectionPath = join(run.root, SELECTION_REL)
        const selection = JSON.parse(readFileSync(selectionPath, 'utf8'))
        selection.runEnvelopeDigest = 'deadbeef'
        writeFileSync(selectionPath, `${JSON.stringify(selection, null, 2)}\n`)
        const result = runCli('scripts/fairtest/selection-receipt.mjs', [], { root: run.root, runId: run.runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'preflight-missing-root': {
      const { parent, runId } = makeRunRoot()
      try {
        const result = runCli('scripts/fairtest/preflight-fairtest.mjs', [], { runId, env: { FAIRTEST_RUN_ROOT: '' } })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(parent, { recursive: true, force: true })
      }
      return
    }
    case 'preflight-missing-envelope': {
      const { parent, root, runId } = makeRunRoot()
      try {
        mkdirSync(root, { recursive: true })
        const result = runCli('scripts/fairtest/preflight-fairtest.mjs', [], { root, runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(parent, { recursive: true, force: true })
      }
      return
    }
    case 'preflight-missing-inventory-receipt': {
      const run = setupRun()
      try {
        unlinkSync(join(run.root, inventoryReceiptRel('ci')))
        writeEvidence(run.root, run.runId)
        const result = runCli('scripts/fairtest/preflight-fairtest.mjs', [], { root: run.root, runId: run.runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'preflight-missing-selection-receipt': {
      const run = setupRun()
      try {
        unlinkSync(join(run.root, SELECTION_RECEIPT_REL))
        writeEvidence(run.root, run.runId)
        const result = runCli('scripts/fairtest/preflight-fairtest.mjs', [], { root: run.root, runId: run.runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'preflight-incomplete-evidence': {
      const run = setupRun()
      try {
        writeEvidence(run.root, run.runId, { complete: false })
        const result = runCli('scripts/fairtest/preflight-fairtest.mjs', [], { root: run.root, runId: run.runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'preflight-selection-digest-mismatch': {
      const run = setupRun()
      try {
        writeEvidence(run.root, run.runId)
        const selectionPath = join(run.root, SELECTION_REL)
        const selection = JSON.parse(readFileSync(selectionPath, 'utf8'))
        selection.keys = [...selection.keys].reverse()
        writeFileSync(selectionPath, `${JSON.stringify(selection, null, 2)}\n`)
        const result = runCli('scripts/fairtest/preflight-fairtest.mjs', [], { root: run.root, runId: run.runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'preflight-local-mode-selection': {
      const run = setupRun({ mode: 'local' })
      try {
        writeEvidence(run.root, run.runId)
        const result = runCli('scripts/fairtest/preflight-fairtest.mjs', [], { root: run.root, runId: run.runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'preflight-undeclared-sibling': {
      const run = setupRun()
      try {
        writeEvidence(run.root, run.runId)
        mkdirSync(join(run.root, 'extra-undeclared'), { recursive: true })
        writeFileSync(join(run.root, 'extra-undeclared', 'stray.txt'), 'stray bytes\n')
        const result = runCli('scripts/fairtest/preflight-fairtest.mjs', [], { root: run.root, runId: run.runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'preflight-complete-run': {
      const run = setupRun()
      try {
        writeEvidence(run.root, run.runId)
        const result = runCli('scripts/fairtest/preflight-fairtest.mjs', [], { root: run.root, runId: run.runId })
        assert.equal(result.status, 0, `${name}: preflight must accept a complete run:\n${result.combined}`)
        for (const rel of [RUN_ENVELOPE_REL, EVIDENCE_REL]) {
          assert.ok(result.combined.includes(rel), `${name}: preflight must report the retained ${rel}`)
        }
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'verify-prior-evidence': {
      const { parent, root, runId } = makeRunRoot()
      try {
        const init = runCli('scripts/fairtest/init-fairtest.mjs', [], { root, runId })
        assert.equal(init.status, 0, `${name}: init must succeed:\n${init.combined}`)
        writeEvidence(root, runId)
        const result = runCli('scripts/fairtest/verify-fairtest.mjs', [], { root, runId })
        expectFailure(result, entry.expectedErrorContains, name)
      } finally {
        rmSync(parent, { recursive: true, force: true })
      }
      return
    }
    case 'verify-wrong-root': {
      const { parent, runId } = makeRunRoot()
      const wrong = join(parent, 'not-the-run-id')
      try {
        const result = runCli('scripts/fairtest/verify-fairtest.mjs', [], { root: wrong, runId })
        expectFailure(result, entry.expectedErrorContains, name)
        assert.ok(
          !existsSync(join(wrong, 'evidence', 'evidence.json')),
          `${name}: verify must refuse the wrong root before writing any evidence`,
        )
      } finally {
        rmSync(parent, { recursive: true, force: true })
      }
      return
    }
    case 'budget-sum': {
      const sum = FAIRTEST_BUDGET.stages.reduce((total, stage) => total + stage.minutes, 0)
      assert.ok(Math.abs(sum - FAIRTEST_BUDGET.totalMinutes) < 1e-9, `${name}: stage minutes must sum to ${FAIRTEST_BUDGET.totalMinutes}, observed ${sum}`)
      assert.equal(FAIRTEST_BUDGET.totalMinutes, 24, `${name}: the Fairtest budget must stay 24 minutes`)
      assert.equal(FAIRTEST_BUDGET.retries, 0, `${name}: retries must stay 0`)
      assert.equal(FAIRTEST_BUDGET.journeyHtml, 0, `${name}: JOURNEY_HTML must stay 0`)
      return
    }
    case 'envelope-shape': {
      const run = setupRun()
      try {
        const envelope = JSON.parse(readFileSync(join(run.root, RUN_ENVELOPE_REL), 'utf8'))
        assert.equal(envelope.runId, run.runId, `${name}: envelope run id`)
        assert.equal(envelope.project, 'fairtest', `${name}: envelope project`)
        assert.deepEqual(envelope.subtrees, [...RUN_SUBTREES], `${name}: envelope subtrees`)
        assert.deepEqual(Object.keys(envelope.ownership).sort(), ['evidence', 'guards', 'producer', 'selection'], `${name}: envelope ownership`)
        assert.equal(envelope.upload.action, UPLOAD_PIN.action, `${name}: upload action`)
        assert.equal(envelope.upload.sha, UPLOAD_PIN.sha, `${name}: upload pin`)
        assert.equal(envelope.budget.totalMinutes, FAIRTEST_BUDGET.totalMinutes, `${name}: envelope budget`)
      } finally {
        rmSync(run.parent, { recursive: true, force: true })
      }
      return
    }
    case 'workflow': {
      inspectWorkflowPin(workflowSource)
      return
    }
    case 'workflow-order': {
      inspectWorkflowOrder(workflowSource)
      return
    }
    case 'workflow-budget': {
      inspectWorkflowBudget(workflowSource)
      return
    }
    default:
      throw new Error(`${name}: unknown check ${entry.check}`)
  }
}

/**
 * Assert a message exists and contains every fragment.
 * @param {string | null} message captured failure message
 * @param {string[]} fragments expected substrings
 * @param {string} label case label
 * @returns {void}
 */
function expectMessage(message, fragments, label) {
  assert.ok(message, `${label}: expected a failure but the guard accepted the input`)
  for (const fragment of fragments) {
    assert.ok(message.includes(fragment), `${label}: diagnostic must include ${JSON.stringify(fragment)}; got ${message}`)
  }
}

/* ── tests ────────────────────────────────────────────────────────────── */

test('run-envelope fixture: valid corpus and manifest inventory', () => {
  assert.equal(corpus.cases.length, manifest.expectedCaseCount, `${CORPUS_REL}: case count must match the manifest`)
  checkRequiredNames(corpus.cases.map((entry) => entry.name), manifest.requiredCaseNames, CORPUS_REL)
})

test('run-envelope fixture: key sets match the contract and the verifier rows', () => {
  assertKeySetsMatchContract(corpus)
})

test('run-envelope: the producer artifact classes are the one shared evidence-policy list', () => {
  const policyClasses = fairtestEvidencePolicyInput('run-envelope-fixture').artifactClasses
  assert.deepEqual(
    [...PRODUCER_ARTIFACT_CLASSES],
    [...policyClasses],
    'run-envelope-contract.mjs: PRODUCER_ARTIFACT_CLASSES must be the one shared fairtest-artifacts.mjs list the evidence policy reads at path artifacts; repair: import ARTIFACT_CLASSES instead of re-spelling the six-class set.',
  )
})

test('run-envelope: every named case behaves as declared', () => {
  for (const entry of corpus.cases) runCase(entry)
})

test('run-envelope: fixture mutations fail for their intended field', () => {
  for (const mutation of manifest.mutations) {
    let message = null
    try {
      if (mutation.kind === 'trailing-document') {
        loadSingleDocument(`${corpusSource.trimEnd()}\n---\norphan: true\n`, CORPUS_REL)
      } else {
        const mutated = structuredClone(corpus)
        applyCorpusMutation(mutated, mutation)
        validateCorpus(mutated, CORPUS_REL)
        checkRequiredNames(mutated.cases.map((entry) => entry.name), manifest.requiredCaseNames, CORPUS_REL)
      }
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, `${mutation.name}: mutated input passed validation instead of failing`)
    assert.ok(message.includes(mutation.expectedField), `${mutation.name}: diagnostic names the wrong field; expected ${mutation.expectedField}, received ${message}`)
  }
})

test('run-envelope: workflow mutations fail for their intended field', () => {
  for (const mutation of manifest.workflowMutations) {
    let message = null
    try {
      const occurrences = workflowSource.split(mutation.find).length - 1
      assert.equal(occurrences, 1, `${mutation.name}: find string must match exactly once, observed ${occurrences}`)
      const mutated = workflowSource.split(mutation.find).join(mutation.replace)
      inspectWorkflow(mutated)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, `${mutation.name}: mutated workflow passed the guard instead of failing`)
    assert.ok(message.includes(mutation.expectedField), `${mutation.name}: diagnostic names the wrong field; expected ${mutation.expectedField}, received ${message}`)
  }
})
