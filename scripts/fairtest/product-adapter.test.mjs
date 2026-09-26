// Focused contract test for the Fairtrade product adapter and target
// registry. Every behavioral row lives in product-target.testdata.yaml with
// its required-name manifest; this module owns no row tables, only the fake
// lifecycle driver, shape checks, and mutation wiring. It runs with node
// --test. The stale-served-asset mutation case serves a throwaway dist/ copy
// on a loopback port through the real static driver, the blank-active-view
// mutation case empties the active view on the real served dist/, and the
// unrendered-active-view case walks the declared unrendered modes on that same
// served dist/ inside ONE bounded browser session, so run pnpm build first so
// dist/ holds the exact built app those cases drive. The remaining families
// are browser-free and observe the real functions directly: the rendered
// predicate over one case per declared unrendered mode, the record builders
// over the guard's accepted measurement, the run-subtree ordering through the
// real preparation seam, the Fairtest Playwright config's runner shape, the
// single loopback host/port owner, and the single compact axe report shape.
// The real static-driver start-failure cases below need no built app: they
// drive the real producer driver on scratch loopback ports against a
// throwaway fixture root. The real static driver's fail-closed listener
// controls (out-of-root refusal and loopback-only host) and the adapter's
// declared driver contract are named cases in the same fixture family and run
// there. No Storybook, Puppeteer, or second browser oracle is started.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'
import { importFairtestSource } from '../fairtest-source.mjs'
import { AXE_RESULT_FIELDS, expectTheme } from '../journey/lib/assertions.mjs'
import { createFairtradeAdapter } from './fairtrade-adapter.mjs'
import {
  FAIRTEST_APP_BASE_URL,
  FAIRTEST_APP_HOST,
  FAIRTEST_APP_PORT,
  FAIRTEST_SCRATCH_PORT_BASE,
  FAIRTEST_SCRATCH_PURPOSES,
  PRODUCT_VIEWPORT,
  claimScratchPort,
  fairtestScratchPort,
} from './fairtest-runtime.mjs'
import {
  PRODUCT_ARTIFACT_CLASSES,
  PRODUCT_A11Y_GATE_POINTS,
  PRODUCT_A11Y_PAGE_WIDE_FIELDS,
  PRODUCT_A11Y_RECORD_FIELDS,
  PRODUCT_MIN_BODY_DESCENDANTS,
  PRODUCT_MIN_BODY_TEXT_LENGTH,
  PRODUCT_PRE_ACTION_PARTS,
  PRODUCT_VIEW_SELECTORS,
  assertProductActiveViewMounted,
  assertProductAxeScanShape,
  assertProductObservationTimes,
  buildProductBodyRecord,
  buildProductViewRecord,
  buildProductAccessibilityEvidence,
  createProductStaticDriver,
  prepareProductRowDir,
  productRowDir,
  readProductAccessibilityVerdict,
  resolveProductRunRoot,
} from './product-producer.mjs'
import { PRODUCT_MUTATION_NAMES, PRODUCT_UNRENDERED_RULES, runProductMutation } from './product-mutations.mjs'
import { PRODUCT_UNRENDERED_MODES, PRODUCT_UNRENDERED_REFUSAL_FIELDS } from './fairtrade-targets.mjs'
import * as targets from './fairtrade-targets.mjs'
import { assertServedDigestsMatchRunRoot } from './fairtest-artifacts.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CORPUS_REL = 'scripts/fairtest/product-target.testdata.yaml'
const MANIFEST_REL = 'scripts/fairtest/product-target.testdata.manifest.yaml'
const CONFIG_REL = 'playwright.fairtest.config.mjs'
const RUNTIME_REL = 'scripts/fairtest/fairtest-runtime.mjs'
const INVENTORY_REL = 'scripts/testdata/fairtest-runner-inventory.yaml'
const HOST_CORPUS_REL = 'scripts/fairtest/host-ownership.testdata.yaml'
const HOST_MANIFEST_REL = 'scripts/fairtest/host-ownership.testdata.manifest.yaml'
const HOST_OWNERS = ['runtime-constants-owner', 'app-owned-registry', 'app-owned-adapter', 'browser-bearing-host-runtime']
const HOST_FILE_OWNERS = Object.freeze({
  'fairtest-runtime.mjs': 'runtime-constants-owner',
  'fairtrade-adapter.mjs': 'app-owned-adapter',
  'fairtrade-targets.mjs': 'app-owned-registry',
  'fairtrade-component-target.mjs': 'app-owned-registry',
  'fairtest-artifacts.mjs': 'app-owned-registry',
  'product-producer.mjs': 'browser-bearing-host-runtime',
  'product-mutations.mjs': 'browser-bearing-host-runtime',
  'component-producer.mjs': 'browser-bearing-host-runtime',
  'component-mutations.mjs': 'browser-bearing-host-runtime',
})
// The only host modules whose DECLARED VALUES legitimately spell a token the
// host-global scan forbids as an identifier: the component registry must name
// the Storybook root id and the storybook-static tree. Their scan runs over
// comments-and-STRING-stripped source, so a declared selector is data, not a
// dependency. Every other host module is scanned with strings INTACT, so
// string-encoded runner material (for example `await import('puppeteer')`) is
// still caught.
const STRING_BEARING_REGISTRY_FILES = Object.freeze(['fairtrade-component-target.mjs'])
const HOST_MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'stale-name', 'delete-field', 'rename-field', 'unknown-field', 'bad-value'])
const IMPL_FILES = ['fairtrade-adapter.mjs', 'fairtrade-targets.mjs', 'fairtrade-component-target.mjs']
// The host modules whose every app selector, label, and loopback origin must
// come from an app-owned registry and the single runtime owner.
const PRODUCT_HOST_FILES = ['product-producer.mjs', 'product-mutations.mjs', 'product.journey.mjs', 'component-producer.mjs', 'component-mutations.mjs']
const CHILD_MARKER = ['packages', 'fairtest'].join('/')
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])
const CHECKS = ['theme-row', 'route', 'section-action', 'capability', 'cross-kind', 'lifecycle', 'theme-inference', 'theme-setup', 'theme-observation', 'project-inference', 'product-proof', 'product-mutation', 'wrapper-theme', 'artifact-class', 'a11y-baseline', 'a11y-delta', 'a11y-record', 'observation-time', 'run-root', 'cli-target', 'driver-out-of-root', 'driver-host-refusal', 'driver-stop-contract', 'driver-reset-contract', 'rendered-active-view', 'record-truthfulness', 'row-dir-preparation', 'runner-config', 'port-owner', 'axe-report-shape', 'mounted-row-guard-calls', 'combined-suite-invocation', 'product-contract-command', 'mounted-command', 'host-literal-guard', 'served-digest-comparison']
const A11Y_POINTS = ['initial', 'after-action']
const A11Y_IMPACTS = ['minor', 'moderate', 'serious', 'critical']
const ROW_THEMES = ['dark', 'light']
const PROOF_PARTS = ['chrome', 'body', 'route', 'activeSection', 'view']
// The guard context every rendered-active-view case is decided against, so a
// refusal diagnostic is compared across the healthy and unrendered modes with
// one vocabulary.
const RENDER_GUARD_CONTEXT = Object.freeze({
  label: 'unrendered representative body',
  part: 'body',
  path: 'proof.body',
  repair: 'keep the analytics dashboard laid out and rendered instead of present but invisible',
})
const ACCEPTED_MEASUREMENT_FIELDS = ['roots', 'rendered', 'descendants', 'textLength']
// No suite holds a scratch-port literal. Each real-driver case names the
// purpose it needs and takes the port the single owner hands out, so this file
// and scripts/fairtest/product-mutations.mjs can run in one node --test
// invocation without either of them being blamed for the other's listener.
// The ownership rule that enforces this lives in the host-ownership guard
// below, and it covers the contract suites themselves, not only the host
// modules.
const REAL_DRIVER_PURPOSES = Object.freeze({
  squatter: 'adapter-squatter',
  absentDist: 'adapter-absent-dist',
  outOfRoot: 'adapter-out-of-root',
  hostRefusal: 'adapter-host-refusal',
})

const coreFixtures = await importFairtestSource('src/core/fixtures.mjs')
const contractTargets = await importFairtestSource('src/host-contract/targets.mjs')
const contractLifecycle = await importFairtestSource('src/host-contract/lifecycle.mjs')
const contractResolution = await importFairtestSource('src/host-contract/resolution.mjs')

const corpusSource = readFileSync(resolve(ROOT, CORPUS_REL), 'utf8')
const manifestSource = readFileSync(resolve(ROOT, MANIFEST_REL), 'utf8')

/** @param {unknown} value */
function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** @param {string[]} fragments @param {string} message @param {string} name */
function expectFragments(fragments, message, name) {
  for (const fragment of fragments) {
    assert.ok(message.includes(fragment), `${name}: diagnostic is missing ${JSON.stringify(fragment)}; got ${message}`)
  }
}

/** @param {unknown} value @param {string} label @param {string} path */
function checkFragmentList(value, label, path) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`${label}: expected a non-empty string list at path ${path}; repair: restore the diagnostic fragment list at ${path}.`)
  }
}

/**
 * Validate the manifest inventory shape.
 * @param {Record<string, unknown>} manifest
 */
function validateManifest(manifest) {
  coreFixtures.checkKeys(manifest, ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'manifest record', MANIFEST_REL, 'manifest')
  const cases = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(cases).size, cases.length, `${MANIFEST_REL}: required case names must be unique at path manifest.requiredCaseNames; repair: list every required case name once.`)
  assert.equal(manifest.expectedCaseCount, cases.length, `${MANIFEST_REL}: case count must equal the required-name inventory at path manifest.expectedCaseCount; repair: align expectedCaseCount with requiredCaseNames.`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${MANIFEST_REL}: mutation count must equal the mutation inventory at path manifest.expectedMutationCount; repair: align expectedMutationCount with mutations.`)
  coreFixtures.checkRequiredNames(mutations.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredMutationNames), MANIFEST_REL)
  for (const [index, mutation] of mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('value')
    coreFixtures.checkKeys(mutation, fields, 'mutation record', MANIFEST_REL, `manifest.mutations[${index}]`)
    assert.ok(MUTATION_KINDS.has(/** @type {string} */ (mutation.kind)), `${MANIFEST_REL}: mutation ${index} names an unknown kind at path manifest.mutations[${index}].kind; repair: use one of ${[...MUTATION_KINDS].join(', ')}.`)
    if (mutation.kind === 'trailing-document') {
      assert.equal(mutation.target, 'document', `${MANIFEST_REL}: mutation ${index} trailing-record must target the record at path manifest.mutations[${index}].target; repair: target "document".`)
    } else {
      assert.ok(cases.includes(/** @type {string} */ (mutation.target)), `${MANIFEST_REL}: mutation ${index} targets an unknown case at path manifest.mutations[${index}].target; repair: target one of the required case names.`)
    }
  }
}

/** @param {Record<string, unknown>} entry @param {number} index */
function checkCaseShape(entry, index) {
  const path = `cases[${index}]`
  if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
    throw new Error(`${CORPUS_REL}: case ${index} is missing its required name at path ${path}.name; repair: restore the required case name.`)
  }
  if (!CHECKS.includes(/** @type {string} */ (entry.check))) {
    throw new Error(`${CORPUS_REL}: case "${entry.name}" names an unknown discriminator ${JSON.stringify(entry.check)} for field "check" at path ${path}.check; repair: use one of ${CHECKS.join(', ')} for "check".`)
  }
  if (typeof entry.expectValid !== 'boolean') {
    throw new Error(`${CORPUS_REL}: case "${entry.name}" is missing its verdict for field "expectValid" at path ${path}.expectValid; repair: set expectValid to true or false.`)
  }
  const tail = entry.expectValid ? ['expectValid', 'expectFrozen'] : ['expectValid', 'expectedErrorContains']
  const fieldsByCheck = {
    'theme-row': entry.expectValid
      ? ['name', 'check', 'theme', 'renderedAttribute', 'expectTheme', ...tail]
      : ['name', 'check', 'theme', 'renderedAttribute', ...tail],
    route: ['name', 'check', 'theme', 'route', ...tail],
    'section-action': entry.expectValid
      ? ['name', 'check', 'action', 'fromSection', 'toSection', ...tail]
      : ['name', 'check', 'action', ...tail],
    capability: ['name', 'check', 'capabilities', ...tail],
    'cross-kind': ['name', 'check', 'kind', 'identityKind', ...tail],
    lifecycle: ['name', 'check', 'stages', ...tail],
    'theme-inference': ['name', 'check', 'project', ...tail],
    'theme-setup': entry.expectValid
      ? ['name', 'check', 'theme', 'expectedAttribute', 'route', ...tail]
      : ['name', 'check', 'theme', ...tail],
    'theme-observation': entry.expectValid
      ? ['name', 'check', 'expected', 'renderedAttribute', 'source', 'observedAtMs', 'expectObserved', ...tail]
      : ['name', 'check', 'expected', 'renderedAttribute', 'source', 'observedAtMs', ...tail],
    'project-inference': ['name', 'check', 'project', 'expectValid', 'expectedErrorContains'],
    'product-proof': ['name', 'check', 'rowTheme', 'identity', 'parts', 'themeObservation', 'initialSection', 'activeSectionId', 'action', 'omitPart', 'mounted', ...tail],
    'product-mutation': ['name', 'check', 'mutation', 'boundary', 'expectValid', 'expectedErrorContains'],
    'wrapper-theme': entry.expectValid
      ? ['name', 'check', 'theme', 'renderedAttribute', 'expectValid']
      : ['name', 'check', 'theme', 'renderedAttribute', 'expectValid', 'expectedErrorContains'],
    'artifact-class': entry.expectValid
      ? ['name', 'check', 'artifact', 'expectValid', 'expectFrozen']
      : ('stale' in entry
        ? ['name', 'check', 'artifact', 'stale', 'expectValid', 'expectedErrorContains']
        : ['name', 'check', 'artifact', 'expectValid', 'expectedErrorContains']),
    'run-root': entry.expectValid
      ? ['name', 'check', 'runRootEnv', 'expectRoot', 'expectValid']
      : ['name', 'check', 'runRootEnv', 'expectValid', 'expectedErrorContains'],
    'cli-target': ['name', 'check', 'args', 'expectValid', 'expectExitCode', 'expectedErrorContains'],
    'a11y-baseline': ['name', 'check', 'policy', 'point', 'violations', ...tail],
    'a11y-delta': ['name', 'check', 'point', 'observedSection', 'measured', ...('baseline' in entry ? ['baseline'] : []), ...tail],
    'a11y-record': entry.expectValid
      ? ['name', 'check', 'accessibility', 'informationalChurn', 'expectVerdict', ...tail]
      : ['name', 'check', 'accessibility', 'expectVerdict', ...tail],
    'observation-time': entry.expectValid
      ? ['name', 'check', 'rowStartedAtMs', ...PRODUCT_PRE_ACTION_PARTS, 'theme', 'action', 'expectValid']
      : ['name', 'check', 'rowStartedAtMs', ...PRODUCT_PRE_ACTION_PARTS, 'theme', 'action', ...tail],
    'driver-out-of-root': ['name', 'check', 'servedRoot', 'markerFile', 'markerBody', 'traversalPrefixes', 'refusedStatus', 'inRootRequest', 'inRootStatus', 'expectValid'],
    'driver-host-refusal': ['name', 'check', 'rejectedHosts', 'loopbackHost', 'expectValid'],
    'driver-stop-contract': ['name', 'check', 'startFailure', 'contractRequirement', 'expectValid'],
    'rendered-active-view': entry.expectValid
      ? ['name', 'check', 'mode', 'activeView', 'container', 'expectAccepted', 'expectValid', 'expectFrozen']
      : ['name', 'check', 'mode', 'activeView', 'container', 'expectValid', 'expectedErrorContains'],
    'record-truthfulness': ['name', 'check', 'part', 'accepted', 'activeView', 'container', ...tail],
    'row-dir-preparation': ['name', 'check', 'existingArtifact', 'expectedSteps', 'expectPrepared', 'expectValid', ...tail.filter((field) => field !== 'expectFrozen')],
    'runner-config': ['name', 'check', 'configFile', 'expectedProjects', 'expectedTestMatch', 'expectedTestDir', 'expectedRetries', 'expectedWorkers', 'expectedFullyParallel', 'expectedReducedMotion', 'expectedViewport', 'forbiddenKeys', 'expectValid'],
    'port-owner': ['name', 'check', 'ownerModule', 'consumerModules', 'portEnvName', 'expectValid'],
    'axe-report-shape': ['name', 'check', 'expectValid'],
    'mounted-row-guard-calls': ['name', 'check', 'producerModule', 'expectedGuardPoints', 'deletedCallPoint', 'expectValid'],
    'combined-suite-invocation': ['name', 'check', 'suites', 'selectedCases', 'expectValid'],
    'product-contract-command': ['name', 'check', 'commandName', 'expectedScript', 'expectedSuites', 'expectedNodeArgs', 'ciMountStatus', 'workflowDir', 'expectValid'],
    'mounted-command': ['name', 'check', 'commandName', 'expectedScript', 'ciMountStatus', 'workflowDir', 'expectValid'],
    'host-literal-guard': ['name', 'check', 'hostFiles', 'mutatedLiteral', 'expectValid'],
    'served-digest-comparison': entry.expectValid
      ? ['name', 'check', 'files', 'mutateFile', 'mutateSuffix', 'wiredInto', 'expectValid']
      : ['name', 'check', 'files', 'mutateFile', 'mutateSuffix', 'expectValid', 'expectedErrorContains'],
    'driver-reset-contract': ['name', 'check', 'startFailure', 'contractRequirement', 'cleanupFailure', 'expectValid'],
  }
  coreFixtures.checkKeys(entry, fieldsByCheck[entry.check], 'case record', CORPUS_REL, path)
  if (!entry.expectValid) {
    checkFragmentList(entry.expectedErrorContains, CORPUS_REL, `${path}.expectedErrorContains`)
  }
  if (entry.check === 'product-proof') {
    checkProofCaseShape(entry, path)
  }
  if (entry.check === 'a11y-baseline') {
    checkA11yBaselineShape(entry, path)
  }
  if (entry.check === 'a11y-delta') {
    checkA11yDeltaShape(entry, path)
  }
  if (entry.check === 'a11y-record') {
    checkA11yRecordShape(entry, path)
  }
  if (entry.check === 'observation-time') {
    checkObservationTimeShape(entry, path)
  }
  if (entry.check === 'driver-out-of-root') {
    checkDriverOutOfRootShape(entry, path)
  }
  if (entry.check === 'driver-host-refusal') {
    checkDriverHostShape(entry, path)
  }
  if (entry.check === 'driver-stop-contract') {
    checkDriverStopContractShape(entry, path)
  }
  if (entry.check === 'rendered-active-view') {
    checkRenderedActiveViewShape(entry, path)
  }
  if (entry.check === 'record-truthfulness') {
    checkRecordTruthfulnessShape(entry, path)
  }
  if (entry.check === 'row-dir-preparation') {
    checkRowDirPreparationShape(entry, path)
  }
  if (entry.check === 'runner-config') {
    checkRunnerConfigShape(entry, path)
  }
  if (entry.check === 'port-owner') {
    checkPortOwnerShape(entry, path)
  }
  if (entry.check === 'driver-reset-contract') {
    checkDriverStopContractShape(entry, path)
    for (const field of ['contractRequirement', 'cleanupFailure']) {
      if (typeof entry[field] !== 'string' || entry[field].trim().length === 0) {
        throw new Error(`${CORPUS_REL}: case "${entry.name}" holds an invalid value ${JSON.stringify(entry[field])} for field "${field}" at path ${path}.${field}; repair: declare the non-empty ${field} the idle-reset cleanup is proven against.`)
      }
    }
  }
  if (entry.check === 'artifact-class') {
    if (typeof entry.artifact !== 'string' || entry.artifact.length === 0) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" is missing its artifact class for field "artifact" at path ${path}.artifact; repair: name one of the six producer artifact classes.`)
    }
    if ('stale' in entry && typeof entry.stale !== 'boolean') {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds a non-boolean stale marker for field "stale" at path ${path}.stale; repair: set stale to true or remove it.`)
    }
  }
  if (entry.check === 'product-mutation') {
    if (!PRODUCT_MUTATION_NAMES.includes(/** @type {string} */ (entry.mutation))) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" names an unknown mutation ${JSON.stringify(entry.mutation)} for field "mutation" at path ${path}.mutation; repair: use one of ${PRODUCT_MUTATION_NAMES.join(', ')} for "mutation".`)
    }
    if (typeof entry.boundary !== 'string' || entry.boundary.trim().length === 0) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" is missing its owning boundary for field "boundary" at path ${path}.boundary; repair: name the owning product boundary for "boundary".`)
    }
  }
  if (entry.check === 'run-root') {
    if (entry.runRootEnv !== null && (typeof entry.runRootEnv !== 'string' || entry.runRootEnv.length === 0)) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds a malformed run-root env value for field "runRootEnv" at path ${path}.runRootEnv; repair: declare the FAIRTEST_RUN_ROOT value the case sets, or null for an unset variable.`)
    }
    if (entry.expectValid && (typeof entry.expectRoot !== 'string' || !isAbsolute(entry.expectRoot))) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" is missing the resolved root for field "expectRoot" at path ${path}.expectRoot; repair: declare the absolute run root the producer must resolve.`)
    }
  }
  if (entry.check === 'cli-target') {
    // Every mounted-CLI case in this family asserts a fail-closed rejection:
    // a successful mounted run spawns the real runner, and the mounted
    // command owns that proof, not this browser-free family.
    if (entry.expectValid !== false) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" declares a passing verdict for field "expectValid" at path ${path}.expectValid; repair: declare expectValid false so the case only asserts a fail-closed target rejection.`)
    }
    if (!Array.isArray(entry.args) || entry.args.some((arg) => typeof arg !== 'string')) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds a malformed argument list for field "args" at path ${path}.args; repair: declare the exact CLI arguments the mounted shim receives.`)
    }
    if (!Number.isInteger(entry.expectExitCode)) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" is missing the expected exit code for field "expectExitCode" at path ${path}.expectExitCode; repair: declare the whole exit code the shim must return.`)
    }
  }
}

/**
 * Validate the nested product-proof record: exact part inventory, the
 * omit-part marker, the mounted flag, and the nullable observation and
 * action records.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkProofCaseShape(entry, path) {
  if (!isRecord(entry.identity)) {
    throw new Error(`${CORPUS_REL}: case "${entry.name}" holds no identity record for field "identity" at path ${path}.identity; repair: restore the product-branch identity record.`)
  }
  coreFixtures.checkKeys(entry.identity, ['kind', 'id', 'createdAtMs'], 'identity record', CORPUS_REL, `${path}.identity`)
  if (!isRecord(entry.parts)) {
    throw new Error(`${CORPUS_REL}: case "${entry.name}" holds no parts record for field "parts" at path ${path}.parts; repair: restore the five separately observed parts.`)
  }
  coreFixtures.checkKeys(entry.parts, PROOF_PARTS, 'parts record', CORPUS_REL, `${path}.parts`)
  for (const part of PROOF_PARTS) {
    if (!isRecord(entry.parts[part])) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds no part record for field "${part}" at path ${path}.parts.${part}; repair: restore the observed part record.`)
    }
    coreFixtures.checkKeys(entry.parts[part], ['observed', 'observedAtMs'], 'part record', CORPUS_REL, `${path}.parts.${part}`)
  }
  if (entry.themeObservation !== null) {
    if (!isRecord(entry.themeObservation)) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds no theme observation for field "themeObservation" at path ${path}.themeObservation; repair: restore the observation record or null for the missing case.`)
    }
    coreFixtures.checkKeys(entry.themeObservation, ['expected', 'observed', 'source', 'observedAtMs'], 'theme observation', CORPUS_REL, `${path}.themeObservation`)
  }
  if (entry.action !== null) {
    if (!isRecord(entry.action)) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds no action record for field "action" at path ${path}.action; repair: restore the named action record or null.`)
    }
    coreFixtures.checkKeys(entry.action, ['name', 'completed', 'observedAtMs'], 'action record', CORPUS_REL, `${path}.action`)
  }
  if (entry.omitPart !== 'none' && !PROOF_PARTS.includes(/** @type {string} */ (entry.omitPart))) {
    throw new Error(`${CORPUS_REL}: case "${entry.name}" names an unknown omitted part ${JSON.stringify(entry.omitPart)} for field "omitPart" at path ${path}.omitPart; repair: use one of none, ${PROOF_PARTS.join(', ')} for "omitPart".`)
  }
  if (typeof entry.mounted !== 'boolean') {
    throw new Error(`${CORPUS_REL}: case "${entry.name}" is missing its mounted flag for field "mounted" at path ${path}.mounted; repair: set mounted to true or false.`)
  }
}

/**
 * Validate one declared baseline violation entry: exact fields, a ranked
 * impact, a non-negative integer node count, and a non-empty theme
 * inventory drawn from the closed row vocabulary.
 * @param {Record<string, unknown>} item candidate entry
 * @param {string} path value path for diagnostics
 * @param {string} name owning case name
 */
function checkA11yViolationItem(item, path, name) {
  if (!isRecord(item)) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds a malformed baseline entry for field "violations" at path ${path}; repair: declare each entry with exactly id, impact, nodes, and themes.`)
  }
  coreFixtures.checkKeys(item, ['id', 'impact', 'nodes', 'themes'], 'baseline entry', CORPUS_REL, path)
  if (typeof item.id !== 'string' || item.id.length === 0) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an empty violation id for field "id" at path ${path}.id; repair: use the axe rule id observed on the real built surface for "id".`)
  }
  if (!A11Y_IMPACTS.includes(/** @type {string} */ (item.impact))) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an unknown impact ${JSON.stringify(item.impact)} for field "impact" at path ${path}.impact; repair: use one of ${A11Y_IMPACTS.join(', ')} for "impact".`)
  }
  if (!Number.isInteger(item.nodes) || /** @type {number} */ (item.nodes) < 0) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid node count ${JSON.stringify(item.nodes)} for field "nodes" at path ${path}.nodes; repair: record the measured violating node count as a non-negative integer for "nodes".`)
  }
  if (!Array.isArray(item.themes) || item.themes.length === 0 || item.themes.some((theme) => theme !== 'dark' && theme !== 'light')) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid theme inventory for field "themes" at path ${path}.themes; repair: list every row theme the entry was observed in using dark and light for "themes".`)
  }
}

/**
 * Validate a declared baseline violation list.
 * @param {unknown} value candidate list
 * @param {string} path value path for diagnostics
 * @param {string} name owning case name
 */
function checkA11yViolationList(value, path, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds no violation list for field "violations" at path ${path}; repair: restore the declared per-point violation list for "violations".`)
  }
  value.forEach((item, index) => checkA11yViolationItem(item, `${path}[${index}]`, name))
}

/**
 * Validate one delta probe measurement: exact triple fields with a
 * non-negative integer node count.
 * @param {Record<string, unknown>} item candidate measurement
 * @param {string} path value path for diagnostics
 * @param {string} name owning case name
 */
function checkA11yMeasuredItem(item, path, name) {
  if (!isRecord(item)) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds a malformed measurement for field "measured" at path ${path}; repair: declare each measurement with exactly id, impact, and nodeCount.`)
  }
  coreFixtures.checkKeys(item, ['id', 'impact', 'nodeCount'], 'measured entry', CORPUS_REL, path)
  if (typeof item.id !== 'string' || item.id.length === 0) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an empty violation id for field "id" at path ${path}.id; repair: use the observed axe rule id for "id".`)
  }
  if (!A11Y_IMPACTS.includes(/** @type {string} */ (item.impact))) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an unknown impact ${JSON.stringify(item.impact)} for field "impact" at path ${path}.impact; repair: use one of ${A11Y_IMPACTS.join(', ')} for "impact".`)
  }
  if (!Number.isInteger(item.nodeCount) || /** @type {number} */ (item.nodeCount) < 0) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid node count for field "nodeCount" at path ${path}.nodeCount; repair: record the observed violating node count as a non-negative integer for "nodeCount".`)
  }
}

/**
 * Validate the a11y-baseline declaration shape: the named policy, a known
 * observation point, and the per-point violation list.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkA11yBaselineShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  if (typeof entry.policy !== 'string' || entry.policy.length === 0) {
    throw new Error(`${CORPUS_REL}: case "${name}" is missing its policy name for field "policy" at path ${path}.policy; repair: name the app-owned accessibility policy for "policy".`)
  }
  if (!A11Y_POINTS.includes(/** @type {string} */ (entry.point))) {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unknown observation point ${JSON.stringify(entry.point)} for field "point" at path ${path}.point; repair: use one of ${A11Y_POINTS.join(', ')} for "point".`)
  }
  checkA11yViolationList(entry.violations, `${path}.violations`, name)
}

/**
 * Validate the a11y-delta probe shape: a known observation point, the
 * measured triples, and the optional synthetic baseline override.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkA11yDeltaShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  if (!A11Y_POINTS.includes(/** @type {string} */ (entry.point))) {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unknown observation point ${JSON.stringify(entry.point)} for field "point" at path ${path}.point; repair: use one of ${A11Y_POINTS.join(', ')} for "point".`)
  }
  // The section the scan ran against is the receipt's only observed tie to a
  // moment in the row, so a case may not omit it: a delta probe with no section
  // would produce a receipt nothing in the record could contradict.
  if (typeof entry.observedSection !== 'string' || entry.observedSection.trim().length === 0) {
    throw new Error(`${CORPUS_REL}: case "${name}" is missing its observed section for field "observedSection" at path ${path}.observedSection; repair: declare the section the live page showed when the scan was taken.`)
  }
  if (!Array.isArray(entry.measured)) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds no measurement list for field "measured" at path ${path}.measured; repair: restore the observed violation triples for "measured".`)
  }
  entry.measured.forEach((item, index) => checkA11yMeasuredItem(item, `${path}.measured[${index}]`, name))
  if ('baseline' in entry) {
    checkA11yViolationList(entry.baseline, `${path}.baseline`, name)
  }
}

/**
 * Validate the a11y-record declaration shape: the record accessibility block
 * the verifier-facing reader consumes, the optional informational-count churn
 * that must not move the verdict, and the declared verdict. The block itself
 * is deliberately not shape-checked here: the reader is the contract, so the
 * refusal cases can carry a block the reader must reject.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkA11yRecordShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  if (!isRecord(entry.accessibility)) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds no accessibility record for field "accessibility" at path ${path}.accessibility; repair: declare the record.json accessibility block the verifier reads.`)
  }
  if (!['pass', 'fail', 'none'].includes(/** @type {string} */ (entry.expectVerdict))) {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unknown verdict ${JSON.stringify(entry.expectVerdict)} for field "expectVerdict" at path ${path}.expectVerdict; repair: use pass, fail, or none for a refused record.`)
  }
  if (entry.expectValid && entry.expectVerdict === 'none') {
    throw new Error(`${CORPUS_REL}: case "${name}" declares no verdict for a readable record at path ${path}.expectVerdict; repair: declare the verdict the reader must return for a readable record.`)
  }
  if (!entry.expectValid && entry.expectVerdict !== 'none') {
    throw new Error(`${CORPUS_REL}: case "${name}" declares verdict ${JSON.stringify(entry.expectVerdict)} for a refused record at path ${path}.expectVerdict; repair: declare none for a record the reader must refuse.`)
  }
  if ('informationalChurn' in entry) {
    const churn = entry.informationalChurn
    if (!isRecord(churn) || typeof churn.field !== 'string' || churn.field.length === 0) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds a malformed churn for field "informationalChurn" at path ${path}.informationalChurn; repair: declare the informational page-wide field to churn and its replacement value.`)
    }
    if (!PRODUCT_A11Y_PAGE_WIDE_FIELDS.includes(churn.field) || churn.field === 'informational' || churn.field === 'scope' || churn.field === 'root') {
      throw new Error(`${CORPUS_REL}: case "${name}" churns ${JSON.stringify(churn.field)} for field "informationalChurn" at path ${path}.informationalChurn.field; repair: churn an informational page-wide count from ${PRODUCT_A11Y_PAGE_WIDE_FIELDS.filter((field) => !['informational', 'scope', 'root'].includes(field)).join(', ')}.`)
    }
    if (!('value' in churn)) {
      throw new Error(`${CORPUS_REL}: case "${name}" declares no replacement value for field "informationalChurn" at path ${path}.informationalChurn.value; repair: declare the replacement value the churn writes.`)
    }
  } else if (entry.expectValid) {
    throw new Error(`${CORPUS_REL}: case "${name}" declares no informational churn at path ${path}.informationalChurn; repair: a readable verdict case must prove the page-wide counts cannot move the verdict.`)
  }
}

/**
 * Validate the observation-time declaration shape: the row start reading plus
 * one whole-millisecond reading per observed part.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkObservationTimeShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  for (const field of ['rowStartedAtMs', ...PRODUCT_PRE_ACTION_PARTS, 'theme', 'action']) {
    if (!Number.isInteger(entry[field]) || /** @type {number} */ (entry[field]) < 0) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid observation time ${JSON.stringify(entry[field])} for field "${field}" at path ${path}.${field}; repair: record whole milliseconds since the epoch for "${field}".`)
    }
  }
}

/**
 * Validate the out-of-root case declaration: a served root and a marker file
 * that are single path segments beside each other, distinct encoded traversal
 * prefixes, and the two status codes the real driver must answer with.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkDriverOutOfRootShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  for (const field of ['servedRoot', 'markerFile', 'markerBody', 'inRootRequest']) {
    if (typeof entry[field] !== 'string' || entry[field].trim().length === 0) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid value ${JSON.stringify(entry[field])} for field "${field}" at path ${path}.${field}; repair: declare the non-empty ${field} the real static driver is driven with.`)
    }
  }
  for (const field of ['servedRoot', 'markerFile']) {
    const value = /** @type {string} */ (entry[field])
    if (value.includes('/') || value === '.' || value === '..') {
      throw new Error(`${CORPUS_REL}: case "${name}" holds ${JSON.stringify(value)} for field "${field}" at path ${path}.${field}; repair: name one path segment so the marker stays exactly one level above the served root.`)
    }
  }
  if (!/** @type {string} */ (entry.inRootRequest).startsWith('/')) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds ${JSON.stringify(entry.inRootRequest)} for field "inRootRequest" at path ${path}.inRootRequest; repair: request an absolute in-root path so the case proves the served root is still readable.`)
  }
  const prefixes = entry.traversalPrefixes
  if (!Array.isArray(prefixes) || prefixes.length === 0 || prefixes.some((value) => typeof value !== 'string' || !value.startsWith('/') || !value.includes('%'))) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid traversal prefix list ${JSON.stringify(prefixes)} for field "traversalPrefixes" at path ${path}.traversalPrefixes; repair: declare absolute percent-encoded traversal prefixes such as /..%2f.`)
  }
  if (new Set(prefixes).size !== prefixes.length) {
    throw new Error(`${CORPUS_REL}: case "${name}" repeats a traversal prefix ${JSON.stringify(prefixes)} for field "traversalPrefixes" at path ${path}.traversalPrefixes; repair: declare each encoded traversal form once.`)
  }
  for (const field of ['refusedStatus', 'inRootStatus']) {
    if (!Number.isInteger(entry[field]) || /** @type {number} */ (entry[field]) < 100 || /** @type {number} */ (entry[field]) > 599) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds ${JSON.stringify(entry[field])} for field "${field}" at path ${path}.${field}; repair: record the real HTTP status the loopback driver answers with.`)
    }
  }
}

/**
 * Validate the host-refusal case declaration: distinct non-loopback hosts the
 * real driver must refuse, plus the loopback host it must still accept.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkDriverHostShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  if (typeof entry.loopbackHost !== 'string' || entry.loopbackHost.trim().length === 0) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid value ${JSON.stringify(entry.loopbackHost)} for field "loopbackHost" at path ${path}.loopbackHost; repair: declare the one loopback host the real driver must still accept.`)
  }
  const hosts = entry.rejectedHosts
  if (!Array.isArray(hosts) || hosts.length === 0 || hosts.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid host list ${JSON.stringify(hosts)} for field "rejectedHosts" at path ${path}.rejectedHosts; repair: declare the non-loopback hosts the real driver must refuse.`)
  }
  if (new Set(hosts).size !== hosts.length) {
    throw new Error(`${CORPUS_REL}: case "${name}" repeats a rejected host ${JSON.stringify(hosts)} for field "rejectedHosts" at path ${path}.rejectedHosts; repair: declare each rejected host once.`)
  }
  for (const host of hosts) {
    if (host === entry.loopbackHost) {
      throw new Error(`${CORPUS_REL}: case "${name}" lists the accepted host ${JSON.stringify(host)} for field "rejectedHosts" at path ${path}.rejectedHosts; repair: list only hosts outside "loopbackHost" so the case proves the guard discriminates.`)
    }
  }
}

/**
 * Validate the stop-contract case declaration: the driver failure text the
 * original start diagnostic must still carry, and the driver-surface
 * requirement the adapter must declare for it.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkDriverStopContractShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  for (const field of ['startFailure', 'contractRequirement']) {
    if (typeof entry[field] !== 'string' || entry[field].trim().length === 0) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid value ${JSON.stringify(entry[field])} for field "${field}" at path ${path}.${field}; repair: declare the non-empty ${field} the fake driver and the adapter driver surface are proven against.`)
    }
  }
  if (!entry.startFailure.includes(' ')) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds ${JSON.stringify(entry.startFailure)} for field "startFailure" at path ${path}.startFailure; repair: declare the full driver failure text so the start diagnostic can be proven to carry it.`)
  }
}

/**
 * Validate the measured view a rendered-active-view case is decided against:
 * the active-view measurement with its rendered/total split and its per-root
 * refusals, plus the container totals that must never stand in for it. Every
 * refusal must name one of the declared unrendered modes and carry the exact
 * measured field set, so a case can never invent a mode the guard refuses on.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkMeasuredViewShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  if (!isRecord(entry.activeView)) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds no active-view measurement for field "activeView" at path ${path}.activeView; repair: restore the measured rendered population and its refusals.`)
  }
  coreFixtures.checkKeys(entry.activeView, ['roots', 'rendered', 'descendants', 'textLength', 'refusals'], 'active view record', CORPUS_REL, `${path}.activeView`)
  for (const field of ['roots', 'rendered', 'descendants', 'textLength']) {
    if (!Number.isInteger(entry.activeView[field]) || /** @type {number} */ (entry.activeView[field]) < 0) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid active-view count ${JSON.stringify(entry.activeView[field])} for field "${field}" at path ${path}.activeView.${field}; repair: record whole non-negative counts for "${field}".`)
    }
  }
  if (/** @type {number} */ (entry.activeView.rendered) > /** @type {number} */ (entry.activeView.roots)) {
    throw new Error(`${CORPUS_REL}: case "${name}" declares more rendered roots than roots for field "rendered" at path ${path}.activeView.rendered; repair: the rendered count can never exceed the active-root count.`)
  }
  if (!Array.isArray(entry.activeView.refusals)) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds no refusal list for field "refusals" at path ${path}.activeView.refusals; repair: restore the per-root unrendered refusals.`)
  }
  entry.activeView.refusals.forEach((refusal, index) => {
    const at = `${path}.activeView.refusals[${index}]`
    if (!isRecord(refusal)) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds a malformed refusal for field "refusals" at path ${at}; repair: declare each refusal as a record.`)
    }
    coreFixtures.checkKeys(refusal, PRODUCT_UNRENDERED_REFUSAL_FIELDS, 'unrendered refusal', CORPUS_REL, at)
    if (!PRODUCT_UNRENDERED_MODES.includes(/** @type {string} */ (refusal.mode))) {
      throw new Error(`${CORPUS_REL}: case "${name}" names an unknown unrendered mode ${JSON.stringify(refusal.mode)} for field "mode" at path ${at}.mode; repair: use one of ${PRODUCT_UNRENDERED_MODES.join(', ')}.`)
    }
  })
  if (!isRecord(entry.container)) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds no container measurement for field "container" at path ${path}.container; repair: restore the view container totals.`)
  }
  coreFixtures.checkKeys(entry.container, ['descendants', 'textLength'], 'container record', CORPUS_REL, `${path}.container`)
  for (const field of ['descendants', 'textLength']) {
    if (!Number.isInteger(entry.container[field]) || /** @type {number} */ (entry.container[field]) < 0) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid container count ${JSON.stringify(entry.container[field])} for field "${field}" at path ${path}.container.${field}; repair: record whole non-negative counts for "${field}".`)
    }
  }
}

/**
 * Validate the rendered-active-view declaration: the mode under test, the
 * measured view, and, for a case that must pass, the exact triple the rendered
 * guard returns. A refusal case must name a declared unrendered mode and
 * declare a rendered population of zero, so a case can never assert a refusal
 * that no unrendered root could produce.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkRenderedActiveViewShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  checkMeasuredViewShape(entry, path)
  const mode = /** @type {string} */ (entry.mode)
  if (mode !== 'rendered' && !PRODUCT_UNRENDERED_MODES.includes(mode)) {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unknown render mode ${JSON.stringify(mode)} for field "mode" at path ${path}.mode; repair: use rendered, or one of ${PRODUCT_UNRENDERED_MODES.join(', ')}.`)
  }
  if (entry.expectValid) {
    if (!isRecord(entry.expectAccepted)) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds no accepted measurement for field "expectAccepted" at path ${path}.expectAccepted; repair: declare the exact triple the rendered guard returns.`)
    }
    coreFixtures.checkKeys(entry.expectAccepted, ACCEPTED_MEASUREMENT_FIELDS, 'accepted measurement', CORPUS_REL, `${path}.expectAccepted`)
    if (/** @type {number} */ (entry.activeView.rendered) < 1) {
      throw new Error(`${CORPUS_REL}: case "${name}" declares a passing verdict with no rendered root for field "rendered" at path ${path}.activeView.rendered; repair: a passing case must render at least one active root.`)
    }
  } else {
    if (mode === 'rendered') {
      throw new Error(`${CORPUS_REL}: case "${name}" declares a failing verdict for the healthy mode at path ${path}.mode; repair: name one declared unrendered mode for a refusal case.`)
    }
    if (/** @type {number} */ (entry.activeView.rendered) !== 0) {
      throw new Error(`${CORPUS_REL}: case "${name}" declares a refusing verdict with ${JSON.stringify(entry.activeView.rendered)} rendered roots for field "rendered" at path ${path}.activeView.rendered; repair: a refusal case must declare the unrendered population the guard refuses.`)
    }
    const refusals = /** @type {Record<string, unknown>[]} */ (entry.activeView.refusals)
    if (refusals.length < 1 || !refusals.some((refusal) => refusal.mode === mode)) {
      throw new Error(`${CORPUS_REL}: case "${name}" declares no refusal for the ${JSON.stringify(mode)} mode at path ${path}.activeView.refusals; repair: declare the refusal the real served surface reports for this mode.`)
    }
  }
}

/**
 * Validate the record-truthfulness declaration: the part the recorded block
 * belongs to, the rendered triple the guard accepted, and the measured view
 * the record is built from.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkRecordTruthfulnessShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  if (!['body', 'view'].includes(/** @type {string} */ (entry.part))) {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unknown recorded part ${JSON.stringify(entry.part)} for field "part" at path ${path}.part; repair: use body, or view for "part".`)
  }
  if (!isRecord(entry.accepted)) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds no accepted measurement for field "accepted" at path ${path}.accepted; repair: declare the triple the rendered guard returned.`)
  }
  coreFixtures.checkKeys(entry.accepted, ACCEPTED_MEASUREMENT_FIELDS, 'accepted measurement', CORPUS_REL, `${path}.accepted`)
  checkMeasuredViewShape(entry, path)
}

/**
 * Validate the run-subtree ordering declaration: the artifact class a previous
 * run already wrote (or none), the ordered preparation steps the real seam must
 * cross, and whether the row directory is expected to exist afterwards.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkRowDirPreparationShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  if (entry.existingArtifact !== null && !PRODUCT_ARTIFACT_CLASSES.includes(/** @type {string} */ (entry.existingArtifact))) {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unknown artifact ${JSON.stringify(entry.existingArtifact)} for field "existingArtifact" at path ${path}.existingArtifact; repair: use null, or one of ${PRODUCT_ARTIFACT_CLASSES.join(', ')}.`)
  }
  const steps = entry.expectedSteps
  if (!Array.isArray(steps) || steps.some((step) => !['validated', 'created'].includes(/** @type {string} */ (step)))) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid step list ${JSON.stringify(steps)} for field "expectedSteps" at path ${path}.expectedSteps; repair: declare the validated and created boundaries in the order the real preparation seam must cross them.`)
  }
  if (new Set(steps).size !== steps.length) {
    throw new Error(`${CORPUS_REL}: case "${name}" repeats a preparation step for field "expectedSteps" at path ${path}.expectedSteps; repair: declare each boundary once.`)
  }
  if (typeof entry.expectPrepared !== 'boolean') {
    throw new Error(`${CORPUS_REL}: case "${name}" is missing its preparation expectation for field "expectPrepared" at path ${path}.expectPrepared; repair: set expectPrepared to true or false.`)
  }
  if (!entry.expectValid && entry.existingArtifact === null) {
    throw new Error(`${CORPUS_REL}: case "${name}" declares a refusing verdict with no stale artifact for field "existingArtifact" at path ${path}.existingArtifact; repair: a refusal case must declare the artifact a previous run left behind.`)
  }
}

/**
 * Validate the runner-config declaration: the config under test, the exact
 * project set, journey match set, test dir, retry and worker budget, the
 * reduced-motion marker, and the runner-owned keys the config must never
 * declare.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkRunnerConfigShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  if (entry.configFile !== CONFIG_REL) {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unknown config ${JSON.stringify(entry.configFile)} for field "configFile" at path ${path}.configFile; repair: pin the Fairtest config ${CONFIG_REL} for "configFile".`)
  }
  for (const field of ['expectedProjects', 'expectedTestMatch', 'forbiddenKeys']) {
    const value = entry[field]
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.length === 0)) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid list ${JSON.stringify(value)} for field "${field}" at path ${path}.${field}; repair: declare the non-empty string list the runner shape must match.`)
    }
  }
  if (new Set(entry.expectedProjects).size !== entry.expectedProjects.length) {
    throw new Error(`${CORPUS_REL}: case "${name}" repeats a project name for field "expectedProjects" at path ${path}.expectedProjects; repair: declare each project once.`)
  }
  if (/** @type {string[]} */ (entry.expectedProjects).length !== 1) {
    throw new Error(`${CORPUS_REL}: case "${name}" declares ${JSON.stringify(entry.expectedProjects).length} projects for field "expectedProjects" at path ${path}.expectedProjects; repair: the Fairtest config carries exactly one project.`)
  }
  for (const field of ['expectedRetries', 'expectedWorkers']) {
    if (!Number.isInteger(entry[field]) || /** @type {number} */ (entry[field]) < 0) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid budget ${JSON.stringify(entry[field])} for field "${field}" at path ${path}.${field}; repair: declare the whole retry or worker count the config must carry.`)
    }
  }
  if (typeof entry.expectedFullyParallel !== 'boolean') {
    throw new Error(`${CORPUS_REL}: case "${name}" is missing its parallel marker for field "expectedFullyParallel" at path ${path}.expectedFullyParallel; repair: set expectedFullyParallel to true or false.`)
  }
  for (const field of ['expectedTestDir', 'expectedReducedMotion']) {
    if (typeof entry[field] !== 'string' || entry[field].length === 0) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid value ${JSON.stringify(entry[field])} for field "${field}" at path ${path}.${field}; repair: declare the non-empty ${field} the config must carry.`)
    }
  }
  // The render viewport is a product-evidence parameter, not a cosmetic
  // default, so it is pinned here: the case that runs the config also compares
  // it against the single runtime owner, which is what makes the declared
  // numbers a check on a value and not a second declaration.
  const viewport = entry.expectedViewport
  if (!isRecord(viewport)) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid value ${JSON.stringify(viewport)} for field "expectedViewport" at path ${path}.expectedViewport; repair: declare the render viewport the config must carry.`)
  }
  coreFixtures.checkKeys(viewport, ['width', 'height'], 'viewport record', CORPUS_REL, `${path}.expectedViewport`)
  for (const axis of ['width', 'height']) {
    if (!Number.isInteger(viewport[axis]) || /** @type {number} */ (viewport[axis]) < 1) {
      throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid ${axis} ${JSON.stringify(viewport[axis])} for field "expectedViewport" at path ${path}.expectedViewport.${axis}; repair: declare a whole positive pixel count.`)
    }
  }
}

/**
 * Validate the loopback-owner declaration: the one module allowed to own the
 * host and port, the consumers that must read them from it, and the
 * environment variable name that overrides the port.
 * @param {Record<string, unknown>} entry
 * @param {string} path
 */
function checkPortOwnerShape(entry, path) {
  const name = /** @type {string} */ (entry.name)
  if (entry.ownerModule !== RUNTIME_REL) {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unknown owner ${JSON.stringify(entry.ownerModule)} for field "ownerModule" at path ${path}.ownerModule; repair: the single owner is ${RUNTIME_REL}.`)
  }
  const consumers = entry.consumerModules
  if (!Array.isArray(consumers) || consumers.length < 2 || consumers.includes(/** @type {string} */ (entry.ownerModule))) {
    throw new Error(`${CORPUS_REL}: case "${name}" holds an invalid consumer list ${JSON.stringify(consumers)} for field "consumerModules" at path ${path}.consumerModules; repair: list at least two consumers that must read the owner, never the owner itself.`)
  }
  for (const consumer of /** @type {string[]} */ (consumers)) {
    if (!existsSync(resolve(ROOT, consumer))) {
      throw new Error(`${CORPUS_REL}: case "${name}" names a missing consumer ${JSON.stringify(consumer)} for field "consumerModules" at path ${path}.consumerModules; repair: list repository-relative modules that read the declared owner.`)
    }
  }
  if (entry.portEnvName !== 'FAIRTEST_APP_PORT') {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unknown port override ${JSON.stringify(entry.portEnvName)} for field "portEnvName" at path ${path}.portEnvName; repair: the loopback port is overridden through FAIRTEST_APP_PORT.`)
  }
}

/**
 * Derive the loopback-origin consumer set from the filesystem: every module
 * under scripts/fairtest/ plus the Fairtest Playwright config that reads a
 * FAIRTEST_APP_* origin symbol from the runtime owner. Hand-maintaining this
 * list would let a new consumer read (and potentially re-declare) the origin
 * ungoverned, so the port-owner case compares the declared consumers against
 * exactly this set.
 * @returns {string[]} repository-relative consumer module paths, sorted
 */
function deriveLoopbackOriginConsumers() {
  const candidates = [
    'playwright.fairtest.config.mjs',
    ...readdirSync(HERE).filter((name) => name.endsWith('.mjs')).map((name) => `scripts/fairtest/${name}`),
  ]
  return candidates
    .filter((relative) => {
      const text = readFileSync(resolve(ROOT, relative), 'utf8')
      return /from '[^']*fairtest-runtime\.mjs'/.test(text) && /FAIRTEST_APP_(PORT|HOST|BASE_URL)/.test(text)
    })
    .sort()
}

/**
 * Validate the corpus shape: exact fields per check plus required names.
 * @param {Record<string, unknown>} parsed
 * @param {Record<string, unknown>} manifest
 */
function validateFamily(parsed, manifest) {
  coreFixtures.checkKeys(parsed, ['expectedCaseCount', 'cases'], 'corpus record', CORPUS_REL, 'record')
  const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${CORPUS_REL}: record holds no cases at path cases; repair: restore the named cases list.`)
  assert.equal(cases.length, manifest.expectedCaseCount, `${CORPUS_REL}: case count must match the manifest at path expectedCaseCount; repair: align the cases list with the manifest.`)
  coreFixtures.checkRequiredNames(cases.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS_REL)
  cases.forEach(checkCaseShape)
}

/** @param {Record<string, unknown>} entry */
function runThemeRowCase(entry) {
  const name = /** @type {string} */ (entry.name)
  if (!ROW_THEMES.includes(/** @type {string} */ (entry.theme))) {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unknown row theme ${JSON.stringify(entry.theme)} for field "theme" at path theme; repair: use one of ${ROW_THEMES.join(', ')} for "theme".`)
  }
  let message = null
  try {
    const observed = targets.normalizeRenderedTheme(entry.renderedAttribute)
    assert.equal(observed, entry.expectTheme, `${name}: normalized theme must equal the expected row theme`)
    assert.equal(observed, entry.theme, `${name}: normalized theme must equal the declared row theme`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid theme row failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid theme row passed normalization`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/** @param {Record<string, unknown>} entry */
function runRouteCase(entry) {
  const name = /** @type {string} */ (entry.name)
  assert.equal(targets.productRouteForTheme(entry.theme), entry.route, `${name}: row route must equal the declared route`)
}

/** @param {Record<string, unknown>} entry */
function runSectionActionCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    const action = targets.getProductAction(entry.action)
    assert.equal(action.name, entry.action, `${name}: action name must match`)
    assert.equal(action.from, entry.fromSection, `${name}: action source section must match`)
    assert.equal(action.to, entry.toSection, `${name}: action target section must match`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid section action failed: ${message}`)
  } else {
    assert.ok(message, `${name}: unregistered action passed selection`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/** @param {Record<string, unknown>} entry */
function runCapabilityCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    const validated = contractTargets.validateCapabilityList(entry.capabilities, 'product', name, 'adapter.capabilities')
    assert.ok(Object.isFrozen(validated), `${name}: validated capabilities must be frozen`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid capability inventory failed: ${message}`)
  } else {
    assert.ok(message, `${name}: unknown capability passed validation`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/** @param {Record<string, unknown>} entry */
function runCrossKindCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const declaration = {
    kind: entry.kind,
    identity: { kind: entry.identityKind, id: 'cross-kind-probe', createdAtMs: 1000 },
    capabilities: [...contractTargets.PRODUCT_REQUIRED_CAPABILITIES],
    fixtures: ['cross-kind-fixture'],
    actions: [],
  }
  let declarationMessage = null
  try {
    contractTargets.validateTargetDeclaration(declaration, name)
  } catch (error) {
    declarationMessage = error instanceof Error ? error.message : String(error)
  }
  assert.ok(declarationMessage, `${name}: cross-kind declaration passed validation`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), declarationMessage, name)
  const part = { observed: true, observedAtMs: 1000 }
  const resolution = {
    kind: entry.kind,
    identity: { kind: entry.identityKind, id: 'cross-kind-probe', createdAtMs: 1000 },
    chrome: part,
    body: part,
    route: part,
    activeSection: part,
    view: part,
    theme: { expected: 'dark', observed: 'dark', source: 'cross-kind-probe', observedAtMs: 1000 },
  }
  let resolutionMessage = null
  try {
    contractResolution.validateProductResolution(resolution, name)
  } catch (error) {
    resolutionMessage = error instanceof Error ? error.message : String(error)
  }
  assert.ok(resolutionMessage, `${name}: cross-kind resolution passed as product`)
  assert.ok(resolutionMessage.includes('at path'), `${name}: cross-kind resolution diagnostic is missing path context: ${resolutionMessage}`)
  assert.ok(resolutionMessage.includes('repair:'), `${name}: cross-kind resolution diagnostic is missing repair guidance: ${resolutionMessage}`)
}

/** @param {Record<string, unknown>} entry */
function runLifecycleCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    const trace = contractLifecycle.validateLifecycleTrace({ stages: [.../** @type {string[]} */ (entry.stages)] }, name)
    assert.ok(Object.isFrozen(trace), `${name}: validated trace must be frozen`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid lifecycle trace failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid lifecycle trace passed validation`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/** @param {Record<string, unknown>} entry */
function runThemeInferenceCase(entry) {
  const name = /** @type {string} */ (entry.name)
  assert.equal(typeof targets.themeFromProjectName, 'undefined', `${name}: project-name inference helper must stay absent`)
  let inferred = null
  try {
    inferred = targets.normalizeRenderedTheme(entry.project)
  } catch {
    inferred = null
  }
  if (inferred !== null) {
    throw new Error(`${CORPUS_REL}: case "${name}" inferred theme ${JSON.stringify(inferred)} from project name for field "project" at path theme.project; repair: bind theme from the explicit row key instead of the project name.`)
  }
}

/** @param {Record<string, unknown>} entry */
function runThemeSetupCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    const setup = targets.productThemeSetup(entry.theme)
    assert.equal(setup.theme, entry.theme, `${name}: setup theme must equal the row theme`)
    assert.equal(setup.expectedAttribute, entry.expectedAttribute, `${name}: setup attribute must equal the declared raw value`)
    assert.equal(setup.route, entry.route, `${name}: setup route must equal the declared route`)
    assert.equal(setup.route, targets.productRouteForTheme(entry.theme), `${name}: setup route must match the row route`)
    assert.ok(Object.isFrozen(setup), `${name}: setup descriptor must be frozen`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid theme setup failed: ${message}`)
  } else {
    assert.ok(message, `${name}: unknown row theme passed setup`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/** @param {Record<string, unknown>} entry */
function runThemeObservationCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    const observation = targets.observeProductTheme({
      expected: entry.expected,
      renderedAttribute: entry.renderedAttribute,
      source: entry.source,
      observedAtMs: entry.observedAtMs,
    })
    assert.equal(observation.expected, entry.expected, `${name}: persisted expected theme must match`)
    assert.equal(observation.observed, entry.expectObserved, `${name}: normalized observed theme must match`)
    assert.equal(observation.source, entry.source, `${name}: persisted source must match`)
    assert.equal(observation.observedAtMs, entry.observedAtMs, `${name}: persisted time must match`)
    assert.ok(Object.isFrozen(observation), `${name}: theme observation must be frozen`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid theme observation failed: ${message}`)
  } else {
    assert.ok(message, `${name}: contradictory observation passed instead of failing`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/** @param {Record<string, unknown>} entry */
function runProjectInferenceCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    targets.productThemeFromProjectName(entry.project)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  assert.ok(message, `${name}: project-name inference passed instead of failing`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runProductProofCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const parts = {}
  for (const [key, value] of Object.entries(/** @type {Record<string, unknown>} */ (entry.parts))) {
    parts[key] = { .../** @type {Record<string, unknown>} */ (value) }
  }
  if (entry.omitPart !== 'none') {
    delete parts[/** @type {string} */ (entry.omitPart)]
  }
  const input = {
    rowTheme: entry.rowTheme,
    identity: { .../** @type {Record<string, unknown>} */ (entry.identity) },
    ...parts,
    themeObservation: entry.themeObservation === null ? null : { .../** @type {Record<string, unknown>} */ (entry.themeObservation) },
    initialSection: entry.initialSection,
    activeSectionId: entry.activeSectionId,
    ...(entry.action === null ? {} : { action: { .../** @type {Record<string, unknown>} */ (entry.action) } }),
    ...(entry.mounted ? { mounted: true } : {}),
  }
  let message = null
  try {
    const proof = targets.buildProductProof(input)
    assert.equal(proof.kind, 'product', `${name}: proof kind must stay product`)
    assert.equal(proof.identity.kind, 'product', `${name}: proof identity must stay on the product branch`)
    assert.equal(proof.theme.expected, entry.rowTheme, `${name}: proof theme must match the row theme`)
    for (const part of PROOF_PARTS) {
      assert.equal(proof[part].observed, true, `${name}: part ${part} must be separately observed`)
    }
    assert.ok(Object.isFrozen(proof), `${name}: product proof must be frozen`)
    if (entry.action === null) {
      assert.ok(!('action' in proof), `${name}: proof without an action must carry no action result`)
    } else {
      assert.equal(proof.action.name, /** @type {Record<string, unknown>} */ (entry.action).name, `${name}: proof action name must match`)
    }
    const revalidated = contractResolution.validateProductResolution({ ...proof }, name)
    assert.deepEqual({ ...revalidated }, { ...proof }, `${name}: shared resolver must accept the assembled proof`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid product proof failed: ${message}`)
  } else {
    assert.ok(message, `${name}: broken product proof passed instead of failing`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/** @param {Record<string, unknown>} entry */
async function runProductMutationCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    await runProductMutation(/** @type {string} */ (entry.mutation))
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  assert.ok(message, `${name}: named mutation passed instead of failing at ${entry.boundary}`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/**
 * Remove comments from JavaScript source, keeping one output line per input
 * line so a reported line number still points at the code the reader has to
 * change. String and template bodies stay, because a value spelled inside one
 * is exactly what the app-structure guard is looking for.
 * @param {string} source raw module source
 * @returns {string} the same source with comment bodies blanked
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^\\])\/\/[^\n]*/g, (match, lead) => `${lead}${' '.repeat(Math.max(0, match.length - lead.length))}`)
}

/**
 * Remove comments AND string/template/regex literal bodies from JavaScript
 * source, keeping one output line per input line. Used to scope a token guard
 * to executable code: prose that happens to spell a forbidden word is not a
 * dependency.
 *
 * This is a small character scanner rather than a set of regexes on purpose. A
 * quote-delimited pattern cannot span newlines safely: one unbalanced backtick
 * anywhere in a large file pairs with the next one and blanks every line
 * between them, which turns the guard blind over exactly the region it exists
 * to check. The scanner walks the source once, so delimiters pair where the
 * author put them.
 *
 * Two decisions are worth recording. A regex literal is recognised by the
 * preceding significant token (an assignment, a call argument, an opening
 * bracket), because a regex can contain a quote character and reading that
 * quote as a string delimiter swallows the rest of the file. A `/` after an
 * identifier or a closing bracket is division, not a regex. A `${...}`
 * interpolation inside a template literal is blanked with the template, so a
 * host global reached only through an interpolation is not reported; none of
 * the covered modules does that, and it is stated here rather than left as a
 * surprise.
 * @param {string} source raw module source
 * @returns {string} the same source with comments and literal bodies blanked
 */
function stripCommentsAndStrings(source) {
  const blank = (out, from, to) => {
    for (let index = from; index < to; index += 1) {
      out.push(source[index] === '\n' ? '\n' : ' ')
    }
  }
  const out = []
  let index = 0
  let previous = ''
  const opensRegex = () => previous === '' || '(,=:[!&|?{};+-*%<>~^'.includes(previous)
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '*') {
      const close = source.indexOf('*/', index + 2)
      const stop = close === -1 ? source.length : close + 2
      blank(out, index, stop)
      index = stop
      continue
    }
    if (char === '/' && source[index + 1] === '/') {
      const close = source.indexOf('\n', index)
      const stop = close === -1 ? source.length : close
      blank(out, index, stop)
      index = stop
      continue
    }
    if (char === '/' && opensRegex()) {
      let cursor = index + 1
      let inClass = false
      while (cursor < source.length && source[cursor] !== '\n') {
        const body = source[cursor]
        if (body === '\\') {
          cursor += 2
          continue
        }
        if (body === '[') inClass = true
        else if (body === ']') inClass = false
        else if (body === '/' && !inClass) {
          cursor += 1
          while (cursor < source.length && /[a-z]/i.test(source[cursor])) cursor += 1
          break
        }
        cursor += 1
      }
      blank(out, index, cursor)
      index = cursor
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      let cursor = index + 1
      while (cursor < source.length) {
        if (source[cursor] === '\\') {
          cursor += 2
          continue
        }
        if (source[cursor] === char) {
          cursor += 1
          break
        }
        cursor += 1
      }
      blank(out, index, cursor)
      index = cursor
      previous = 'x'
      continue
    }
    if (!/\s/.test(char)) previous = char
    out.push(char)
    index += 1
  }
  return out.join('')
}

/**
 * The host-global and runner tokens no app-owned registry module may execute.
 * Matched against comment- and literal-stripped source, so each pattern is a
 * whole-token match on real code.
 * @type {{ token: string, pattern: RegExp }[]}
 */
const HOST_GLOBAL_TOKENS = Object.freeze(
  ['playwright', 'puppeteer', 'jsdom', 'storybook', 'agent-browser', 'window', 'document', 'locator', 'globalThis', 'querySelector', 'createElement']
    .map((token) => Object.freeze({ token, pattern: new RegExp(`\\b${token}\\b`) })),
)

/**
 * Fail when executable code in source names a runner, a live handle, or a
 * host global. Scoped to code, and the diagnostic names the token, the file,
 * and where the material belongs instead of blaming a comment.
 * @param {string} source module source to scan
 * @param {string} file path used in the diagnostic
 */
function assertNoHostGlobalTokens(source, file) {
  const code = stripCommentsAndStrings(source)
  for (const { token, pattern } of HOST_GLOBAL_TOKENS) {
    const match = pattern.exec(code)
    assert.equal(
      match,
      null,
      `${file}: runs code that names host-global or runner material ${JSON.stringify(token)} at path ${file}; repair: move that ${JSON.stringify(token)} access into the injected driver or the browser-bearing host runtime, and keep ${file} free of it.`,
    )
  }
}

/**
 * App structure literals the app-owned registries own, for BOTH kinds. A value
 * in a host module is a SECOND owner of app structure whatever quote syntax
 * spells it, so the patterns match the TOKEN, not a quote-delimited pair: a
 * literal inside a template literal (which is exactly how the unrendered-mode
 * stylesheets are assembled) has no quote on both sides of it, and a
 * quote-anchored pattern is green over a file that holds a second owner. The
 * component patterns mirror the product ones: the component registry declares
 * `#storybook-root`, the `.sgd-*` classes, and the Storybook chrome selectors,
 * so a producer that re-spells one is a second owner.
 * @type {{ pattern: RegExp, what: string }[]}
 */
const APP_STRUCTURE_LITERALS = Object.freeze([
  { pattern: /#inuse[\w-]*/, what: 'product selector literal' },
  { pattern: /(?<![\w-])\.?iu-[\w-]+/, what: 'product selector literal' },
  { pattern: /(?<![\w-])code map(?![\w-])/, what: 'product display label literal' },
  { pattern: /(?<![\w-])\.sgd-[\w-]+/, what: 'component selector literal' },
  { pattern: /(?<![\w-])#sgd-[\w-]+/, what: 'component selector literal' },
  { pattern: /#storybook-root/, what: 'component root selector literal' },
  { pattern: /(?<![\w-])\.sb-errordisplay/, what: 'Storybook error selector literal' },
  { pattern: /#error-stack/, what: 'Storybook error selector literal' },
])

/**
 * Fail when a host module carries a product or component selector or display
 * label literal, naming the line that has to change. Comments are removed
 * first, so prose explaining the registry is not reported as a second owner,
 * while the string and template bodies stay in place because the literal IS one
 * of them.
 * @param {string} source module source to scan
 * @param {string} file path used in the diagnostic
 */
function assertNoAppStructureLiterals(source, file) {
  const code = stripComments(source)
  const lineOf = (index) => code.slice(0, index).split('\n').length
  for (const { pattern, what } of APP_STRUCTURE_LITERALS) {
    const match = pattern.exec(code)
    assert.equal(
      match,
      null,
      `${file}: carries a ${what} ${JSON.stringify(match ? match[0] : '')} on line ${String(match ? lineOf(match.index) : 0)} at path ${file}; repair: take the selector or label from PRODUCT_SELECTORS, COMPONENT_SELECTORS, or the target registry instead of repeating it here.`,
    )
  }
}

/**
 * Fail when a non-browser host module runs code that names a runner, a live
 * handle, or a host global. The scan source depends on the module: the one
 * string-bearing component registry declares selector values that legitimately
 * spell a token, so its string bodies are blanked; every other module is
 * scanned with strings INTACT, so a string-encoded runner reference such as
 * `await import('puppeteer')` is still caught. Scoped to code, and the
 * diagnostic names the token, the file, and where the material belongs.
 * @param {string} source module source to scan
 * @param {string} file host module file name
 * @param {string} name ownership row name used in the diagnostic
 * @param {string} owner owner class used in the diagnostic
 */
function assertHostOwnerTokens(source, file, name, owner) {
  const relaxed = STRING_BEARING_REGISTRY_FILES.includes(file)
  const scanSource = relaxed ? stripCommentsAndStrings(source) : stripComments(source)
  for (const { token, pattern } of HOST_GLOBAL_TOKENS) {
    assert.equal(
      pattern.exec(scanSource),
      null,
      `${HOST_CORPUS_REL}: row "${name}" has ${file} running code that names ${JSON.stringify(token)} at path owner; repair: ${file} is ${JSON.stringify(owner)} and must stay free of browser, DOM, and runner material.`,
    )
  }
}

/**
 * Build a fake tree handle that serves one canned attribute value and
 * records the selector read, so the theme wrapper is proven against the
 * read path instead of a hardcoded value.
 * @param {unknown} renderedAttribute canned raw attribute value, absent as nullish
 */
function fakeThemeTree(renderedAttribute) {
  return {
    locator: (selector) => ({
      getAttribute: async (attributeName) => {
        assert.equal(selector, 'html', 'wrapper must read the root element')
        assert.equal(attributeName, 'data-theme', 'wrapper must read the rendered theme attribute')
        return renderedAttribute
      },
    }),
  }
}

/**
 * Assert the product row theme on a mounted tree. The rendered-value rule is
 * the app-owned product target contract: dark is an absent or empty
 * data-theme value and light is the light value. The rule lives in
 * fairtrade-targets.mjs and is what the mounted producer observes; this
 * wrapper only reads the raw attribute, settles it, and hands it to that
 * contract, because the byte-vendored journey helper asserts the attribute
 * value verbatim for consumers that render an explicit dark value.
 * @param {{ locator: (selector: string) => { getAttribute: (name: string) => Promise<string|null> } }} page fake or real page handle
 * @param {string} theme dark or light row theme
 * @param {{ timeoutMs?: number, pollMs?: number }} [options] bounded read budget
 */
async function expectProductTheme(page, theme, options = {}) {
  const timeoutMs = options.timeoutMs ?? 1000
  const pollMs = options.pollMs ?? 20
  const deadlineMs = Date.now() + timeoutMs
  let raw = await page.locator('html').getAttribute('data-theme')
  let observed = null
  for (;;) {
    try {
      observed = targets.normalizeRenderedTheme(raw)
    } catch {
      observed = null
    }
    if (observed === theme) {
      break
    }
    if (Date.now() >= deadlineMs) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
    raw = await page.locator('html').getAttribute('data-theme')
  }
  const settledRaw = raw
  const settledObserved = observed
  targets.observeProductTheme({
    expected: theme,
    renderedAttribute: settledRaw,
    source: 'journey-assertions-expectTheme',
    observedAtMs: Date.now(),
  })
  assert.equal(
    settledObserved,
    theme,
    `rendered theme ${JSON.stringify(settledObserved)} (raw data-theme ${JSON.stringify(settledRaw)}) must equal the expected row theme ${JSON.stringify(theme)}; repair: serve the row route for the expected theme and read the rendered value after it settles.`,
  )
}

/** @param {Record<string, unknown>} entry */
async function runWrapperThemeCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    await expectProductTheme(fakeThemeTree(entry.renderedAttribute), /** @type {string} */ (entry.theme))
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: wrapper rejected a matching theme: ${message}`)
  } else {
    assert.ok(message, `${name}: wrapper accepted a wrong theme instead of failing`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/** @param {Record<string, unknown>} entry */
function runA11yBaselineCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    if (entry.policy !== targets.PRODUCT_A11Y_POLICY) {
      throw new Error(`${CORPUS_REL}: case "${name}" names policy ${JSON.stringify(entry.policy)} for field "policy" at path policy; repair: use ${JSON.stringify(targets.PRODUCT_A11Y_POLICY)} for "policy".`)
    }
    assert.equal(targets.PRODUCT_A11Y_SCOPE_ROOT, targets.PRODUCT_SELECTORS.sectionView, `${name}: the gate scope root must stay the registry section view`)
    assert.ok(Object.isFrozen(targets.PRODUCT_A11Y_BASELINE), `${name}: the declared baseline must be frozen`)
    const runtime = targets.PRODUCT_A11Y_BASELINE.points[/** @type {string} */ (entry.point)]
    assert.ok(Array.isArray(runtime), `${name}: runtime baseline holds no entry list for this point`)
    const declared = /** @type {Record<string, unknown>[]} */ (entry.violations)
    if (declared.length !== runtime.length) {
      throw new Error(`${CORPUS_REL}: case "${name}" declares ${declared.length} violations for field "violations" at path violations; the runtime baseline declares ${runtime.length}; repair: re-measure both themes on the built dist/ and declare exactly the observed per-point set.`)
    }
    declared.forEach((item, index) => {
      const want = runtime[index]
      for (const field of ['id', 'impact', 'nodes']) {
        if (item[field] !== want[field]) {
          throw new Error(`${CORPUS_REL}: case "${name}" declares ${JSON.stringify(item[field])} for field "${field}" at path violations[${index}].${field}; the runtime baseline declares ${JSON.stringify(want[field])}; repair: re-measure both themes on the built dist/ and declare the observed value for "${field}".`)
        }
      }
      try {
        assert.deepEqual([.../** @type {unknown[]} */ (item.themes)], [...want.themes])
      } catch {
        throw new Error(`${CORPUS_REL}: case "${name}" declares themes ${JSON.stringify(item.themes)} for field "themes" at path violations[${index}].themes; the runtime baseline declares ${JSON.stringify(want.themes)}; repair: record every row theme the entry was observed in for "themes".`)
      }
    })
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid baseline declaration failed: ${message}`)
  } else {
    assert.ok(message, `${name}: broken baseline declaration passed instead of failing`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/** @param {Record<string, unknown>} entry */
function runA11yDeltaCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    const input = {
      point: entry.point,
      observedSection: entry.observedSection,
      measured: /** @type {Record<string, unknown>[]} */ (entry.measured).map((item) => ({ ...item })),
      artifactPath: 'fixture-probe/axe.json',
      ...('baseline' in entry ? { baseline: structuredClone(entry.baseline) } : {}),
    }
    const receipt = targets.assertProductAxeBaselineDelta(input)
    assert.equal(receipt.observedSection, entry.observedSection, `${name}: the gate must record the section the page showed verbatim, not the section it declares for the point`)
    assert.equal(receipt.policy, targets.PRODUCT_A11Y_POLICY, `${name}: gate receipt must name the app-owned policy`)
    assert.equal(receipt.result, 'pass', `${name}: gate receipt must record a pass`)
    assert.ok(Object.isFrozen(receipt), `${name}: gate receipt must be frozen`)
    // The real gate output against the policy owner's declared field set, in
    // one browser-free assertion: a receipt that grows or loses a field turns
    // this case red instead of silently changing the durable record contract
    // the verifier-facing reader consumes.
    assert.deepEqual(
      Object.keys(receipt).sort(),
      [...targets.PRODUCT_A11Y_GATE_RECEIPT_FIELDS].sort(),
      `${name}: the real gate receipt must carry exactly the declared field set for field "policy"`,
    )
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid delta probe failed: ${message}`)
  } else {
    assert.ok(message, `${name}: regressed measurement passed the gate instead of failing`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/**
 * Run one artifact-class case against the producer's real run-root guard,
 * reached through the real preparation seam. Every case first proves the clean
 * branch: a real scratch run root with no previous row must clear the guard
 * and create exactly that row directory. A case marked stale then writes the
 * artifact into that same real row directory and must be refused by the guard
 * itself, so the refusal is the producer's own diagnostic rather than a throw
 * this module wrote for itself. The unknown artifact case is a closed-set
 * case: the guard passes a clean directory and the declared six-class
 * vocabulary rejects the name.
 * @param {Record<string, unknown>} entry
 */
function runArtifactClassCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const scratch = mkdtempSync(join(tmpdir(), 'fairtest-row-dir-'))
  const rowDir = productRowDir(scratch, 'dark')
  let message = null
  try {
    const prepared = prepareProductRowDir({ runRoot: scratch, theme: 'dark' })
    assert.equal(prepared.rowDir, rowDir, `${name}: the prepared row directory must be the declared product row directory`)
    if (!PRODUCT_ARTIFACT_CLASSES.includes(/** @type {string} */ (entry.artifact))) {
      throw new Error(
        `${CORPUS_REL}: case "${name}" names an unknown artifact ${JSON.stringify(entry.artifact)} for field "artifact" at path artifact; ` +
        `repair: use one of ${[...PRODUCT_ARTIFACT_CLASSES].join(', ')} for "artifact".`,
      )
    }
    assert.ok(Object.isFrozen(PRODUCT_ARTIFACT_CLASSES), `${name}: producer artifact classes must be frozen`)
    assert.equal(PRODUCT_ARTIFACT_CLASSES.length, 6, `${name}: producer must write exactly six artifact classes`)
    if (entry.stale === true) {
      writeFileSync(join(rowDir, /** @type {string} */ (entry.artifact)), `${CORPUS_REL}: ${name}\n`)
      prepareProductRowDir({ runRoot: scratch, theme: 'dark' })
    }
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid artifact class failed: ${message}`)
  } else {
    assert.ok(message, `${name}: broken artifact class passed instead of failing`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/**
 * Run one run-root case through the producer's real run-root resolution: the
 * declared FAIRTEST_RUN_ROOT value is installed in the process environment,
 * the real resolver reads it, and the environment is restored in a finally
 * block so no case leaks state into the next one.
 * @param {Record<string, unknown>} entry
 */
function runRunRootCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const declared = entry.runRootEnv
  const previous = process.env.FAIRTEST_RUN_ROOT
  let message = null
  let observed = null
  try {
    if (declared === null) {
      delete process.env.FAIRTEST_RUN_ROOT
    } else {
      process.env.FAIRTEST_RUN_ROOT = /** @type {string} */ (declared)
    }
    observed = resolveProductRunRoot()
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  } finally {
    if (previous === undefined) {
      delete process.env.FAIRTEST_RUN_ROOT
    } else {
      process.env.FAIRTEST_RUN_ROOT = previous
    }
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid run root failed: ${message}`)
    assert.equal(observed, resolve(/** @type {string} */ (entry.expectRoot)), `${name}: resolved run root must equal the declared absolute root`)
    assert.ok(isAbsolute(/** @type {string} */ (observed)), `${name}: resolved run root must stay absolute`)
  } else {
    assert.ok(message, `${name}: unusable run root passed instead of failing`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/**
 * Run one mounted-CLI case as a real subprocess of the mounted shim, so the
 * target-flag guard is observed at its own exit code and diagnostic instead
 * of being re-implemented here. The cases only exercise the branches that
 * fail closed before the shim spawns the runner.
 * @param {Record<string, unknown>} entry
 */
function runCliTargetCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const shim = resolve(HERE, 'run-mounted.mjs')
  let status = null
  let stderr = ''
  let failure = null
  try {
    const result = spawnSync(process.execPath, [shim, .../** @type {string[]} */ (entry.args)], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' },
    })
    status = result.status
    stderr = result.stderr || ''
    if (result.error) failure = result.error.message
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  assert.equal(failure, null, `${name}: the mounted shim could not run: ${failure}`)
  assert.equal(status, entry.expectExitCode, `${name}: mounted shim must exit ${String(entry.expectExitCode)}; got ${String(status)} with stderr ${stderr}`)
  // The production diagnostic is the shim's own stderr, so the family uses
  // one fragment vocabulary for every case.
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), stderr, name)
  assert.ok(!stderr.includes('playwright'), `${name}: a rejected target must fail before the runner spawns; got ${stderr}`)
}

/**
 * Run one a11y-record case through the verifier-facing reader: read the
 * verdict, prove the frozen verdict shape, and prove the informational
 * page-wide census cannot move it.
 * @param {Record<string, unknown>} entry
 */
function runA11yRecordCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const accessibility = structuredClone(entry.accessibility)
  let message = null
  let verdict = null
  try {
    verdict = readProductAccessibilityVerdict(accessibility)
    assert.equal(verdict.result, entry.expectVerdict, `${name}: verdict must read the declared gate result`)
    assert.ok(Object.isFrozen(verdict), `${name}: the read verdict must be frozen`)
    assert.ok(Object.isFrozen(verdict.points), `${name}: the gate receipts must be frozen`)
    if ('informationalChurn' in entry) {
      const churn = /** @type {Record<string, unknown>} */ (entry.informationalChurn)
      const churned = structuredClone(accessibility)
      const census = /** @type {Record<string, unknown>} */ (churned.pageWide)
      census[/** @type {string} */ (churn.field)] = churn.value
      const after = readProductAccessibilityVerdict(churned)
      assert.equal(after.result, verdict.result, `${name}: churning the informational page-wide ${String(churn.field)} must not move the verdict`)
      assert.equal(after.gatedScope, verdict.gatedScope, `${name}: the churned record must still name the gated scope`)
    }
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: readable accessibility record failed: ${message}`)
  } else {
    assert.ok(message, `${name}: ambiguous accessibility record was read instead of refused`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/**
 * Run one rendered-active-view case through the producer's single rendered
 * predicate. The healthy case must return the declared accepted triple, and
 * every declared unrendered mode must be refused with a diagnostic that names
 * the mode, the observed part, and its record path, so a present but
 * unrendered active view can never clear a floor.
 * @param {Record<string, unknown>} entry
 */
function runRenderedActiveViewCase(entry) {
  const name = /** @type {string} */ (entry.name)
  // Every declared unrendered mode must be exercised by the one real-browser
  // named mutation as well as by the pure case, so the two never drift apart.
  if (PRODUCT_UNRENDERED_MODES.includes(/** @type {string} */ (entry.mode))) {
    assert.ok(
      Object.hasOwn(PRODUCT_UNRENDERED_RULES, /** @type {string} */ (entry.mode)),
      `${name}: the declared mode ${JSON.stringify(entry.mode)} has no real-served-surface rule; repair: add the stylesheet that produces this mode on the built surface.`,
    )
  }
  const observed = { activeView: structuredClone(entry.activeView), container: structuredClone(entry.container) }
  let message = null
  let accepted = null
  try {
    accepted = assertProductActiveViewMounted(observed, { ...RENDER_GUARD_CONTEXT })
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: rendered active view failed: ${message}`)
    assert.deepEqual({ ...accepted }, { ...entry.expectAccepted }, `${name}: the rendered predicate must return the declared accepted measurement`)
    assert.ok(Object.isFrozen(accepted), `${name}: the accepted rendered measurement must be frozen`)
  } else {
    assert.ok(message, `${name}: an unrendered active view cleared the rendered predicate`)
    expectFragments([`${RENDER_GUARD_CONTEXT.label}`, `at path ${RENDER_GUARD_CONTEXT.path}`, `${entry.mode}`, 'repair:'], message, name)
  }
}

/**
 * Run one record-truthfulness case through the real record builders. The
 * recorded body and view blocks must carry the rendered measurement the guard
 * accepted, and a case whose measured view was swapped to the container totals
 * must be refused before a record is written.
 * @param {Record<string, unknown>} entry
 */
function runRecordTruthfulnessCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const accepted = structuredClone(entry.accepted)
  const observation = { activeView: structuredClone(entry.activeView), container: structuredClone(entry.container) }
  let message = null
  let record = null
  try {
    record = entry.part === 'view'
      ? buildProductViewRecord({ accepted, observation, stageDescendantsAfter: 812 })
      : buildProductBodyRecord({ accepted, observation, box: { width: 1216, height: 1653 } })
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: a truthful record build failed: ${message}`)
    const containerField = entry.part === 'view' ? 'containerDescendantsAfter' : 'containerDescendants'
    const descendantsField = entry.part === 'view' ? 'viewDescendantsAfter' : 'descendants'
    const textField = entry.part === 'view' ? 'viewTextLengthAfter' : 'textLength'
    const renderedField = entry.part === 'view' ? 'renderedRootsAfter' : 'renderedRoots'
    const containerTextField = entry.part === 'view' ? 'containerTextLengthAfter' : 'containerTextLength'
    assert.equal(record[descendantsField], accepted.descendants, `${name}: the recorded descendants must be the rendered measurement the guard accepted`)
    assert.equal(record[textField], accepted.textLength, `${name}: the recorded text length must be the rendered measurement the guard accepted`)
    assert.equal(record[renderedField], accepted.rendered, `${name}: the recorded rendered-root count must be the rendered measurement the guard accepted`)
    assert.equal(record[containerField], entry.container.descendants, `${name}: the labelled container total must stay beside the rendered numbers`)
    assert.ok(record[descendantsField] < record[containerField], `${name}: the rendered descendants must stay strictly below the container total they are never confused with`)
    assert.ok(record[textField] < record[containerTextField], `${name}: the rendered text must stay strictly below the container total it is never confused with`)
    assert.ok(Object.isFrozen(record), `${name}: the recorded block must be frozen`)
  } else {
    assert.ok(message, `${name}: a record carrying container totals was written instead of failing`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/**
 * Run one run-subtree ordering case through the real preparation seam. The
 * observed step sequence IS the ordering proof: a fresh row must cross
 * validated before created, and a row directory a previous run already wrote
 * into must be refused with no step observed at all and its previous bytes
 * untouched, which is what "a rerun must use a fresh run root" means.
 * @param {Record<string, unknown>} entry
 */
function runRowDirPreparationCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const scratch = mkdtempSync(join(tmpdir(), 'fairtest-row-order-'))
  const artifact = /** @type {string | null} */ (entry.existingArtifact)
  const artifactPath = artifact ? join(productRowDir(scratch, 'dark'), artifact) : null
  if (artifactPath) {
    mkdirSync(dirname(artifactPath), { recursive: true })
    writeFileSync(artifactPath, `${CORPUS_REL}: ${name} previous run\n`)
  }
  const previousBytes = artifactPath ? readFileSync(artifactPath, 'utf8') : null
  const steps = []
  let message = null
  let prepared = null
  try {
    prepared = prepareProductRowDir({ runRoot: scratch, theme: 'dark', observe: (step) => steps.push(step) })
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  try {
    assert.deepEqual(steps, /** @type {string[]} */ (entry.expectedSteps), `${CORPUS_REL}: case "${name}" observed the steps ${JSON.stringify(steps)} for field "expectedSteps" at path cases[${name}].expectedSteps; repair: declare the boundaries the real preparation seam must cross in the order it crosses them, validated before created.`)
    assert.equal(prepared !== null, entry.expectPrepared, `${name}: the real preparation seam must ${entry.expectPrepared ? 'return' : 'refuse'} the row directory`)
    if (previousBytes !== null) {
      assert.equal(readFileSync(/** @type {string} */ (artifactPath), 'utf8'), previousBytes, `${name}: a refused row directory must keep the previous run's bytes exactly`)
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: a fresh row directory was refused: ${message}`)
  } else {
    assert.ok(message, `${name}: a stale row directory was prepared instead of being refused`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/**
 * Run one runner-config case against the real Fairtest Playwright config. The
 * config is imported, never re-described: exactly one project, the exact
 * product/component journey matches with no journey module left unmatched, the
 * declared retry and worker budget, the reduced-motion marker, and no
 * runner-managed server key anywhere in the config source.
 * @param {Record<string, unknown>} entry
 */
async function runRunnerConfigCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const configPath = resolve(ROOT, /** @type {string} */ (entry.configFile))
  const config = /** @type {Record<string, any>} */ ((await import(pathToFileURL(configPath).href)).default)
  const forbidden = /** @type {string[]} */ (entry.forbiddenKeys)
  for (const key of forbidden) {
    assert.ok(!(key in config), `${CORPUS_REL}: case "${name}" found a runner-managed ${JSON.stringify(key)} entry for field "forbiddenKeys" at path cases.${name}.forbiddenKeys; repair: the Fairtrade adapter owns the service lifecycle, so the config must declare no ${key}.`)
  }
  const source = readFileSync(configPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const key of forbidden) {
    assert.ok(!new RegExp(`\\b${key}\\b`).test(source), `${CORPUS_REL}: case "${name}" found ${JSON.stringify(key)} in the config source for field "forbiddenKeys" at path cases.${name}.forbiddenKeys; repair: keep the runner-managed server controls out of the Fairtest config source.`)
  }
  assert.deepEqual(config.projects.map((project) => project.name), /** @type {string[]} */ (entry.expectedProjects), `${CORPUS_REL}: case "${name}" declares projects ${JSON.stringify(entry.expectedProjects)} for field "expectedProjects" at path cases.${name}.expectedProjects; repair: the Fairtest config carries exactly the one fairtest project.`)
  assert.equal(config.retries, entry.expectedRetries, `${CORPUS_REL}: case "${name}" declares retries ${JSON.stringify(entry.expectedRetries)} for field "expectedRetries" at path cases.${name}.expectedRetries; repair: the mounted rows are single-attempt evidence, so retries must stay ${JSON.stringify(entry.expectedRetries)}.`)
  assert.equal(config.workers, entry.expectedWorkers, `${CORPUS_REL}: case "${name}" declares workers ${JSON.stringify(entry.expectedWorkers)} for field "expectedWorkers" at path cases.${name}.expectedWorkers; repair: the rows share one fixed loopback origin, so workers must stay ${JSON.stringify(entry.expectedWorkers)}.`)
  assert.equal(config.fullyParallel, entry.expectedFullyParallel, `${CORPUS_REL}: case "${name}" declares fullyParallel ${JSON.stringify(entry.expectedFullyParallel)} for field "expectedFullyParallel" at path cases.${name}.expectedFullyParallel; repair: the mounted rows write one immutable run subtree and must stay serial.`)
  assert.equal(config.testDir, entry.expectedTestDir, `${CORPUS_REL}: case "${name}" declares testDir ${JSON.stringify(entry.expectedTestDir)} for field "expectedTestDir" at path cases.${name}.expectedTestDir; repair: the Fairtest config selects only the Fairtest journey directory.`)
  assert.equal(config.use.reducedMotion, entry.expectedReducedMotion, `${CORPUS_REL}: case "${name}" declares reducedMotion ${JSON.stringify(entry.expectedReducedMotion)} for field "expectedReducedMotion" at path cases.${name}.expectedReducedMotion; repair: the mounted rows must render with reduced motion.`)
  // One viewport owner: the config's declared value must match the fixture AND
  // the single runtime owner, so a fourth declaration beside them cannot appear
  // without one of the two comparisons failing.
  const runtime = /** @type {Record<string, any>} */ (await import(pathToFileURL(resolve(ROOT, RUNTIME_REL)).href))
  assert.deepEqual({ ...config.use.viewport }, { ...entry.expectedViewport }, `${CORPUS_REL}: case "${name}" declares viewport ${JSON.stringify(config.use.viewport)} for field "expectedViewport" at path cases.${name}.expectedViewport; repair: declare the shared render viewport for "expectedViewport".`)
  assert.deepEqual({ ...config.use.viewport }, { ...runtime.PRODUCT_VIEWPORT }, `${CORPUS_REL}: case "${name}" declares viewport ${JSON.stringify(config.use.viewport)} which is not the one owner in ${RUNTIME_REL} for field "expectedViewport" at path cases.${name}.expectedViewport; repair: read the render viewport from ${RUNTIME_REL} instead of declaring it again.`)
  const matches = Array.isArray(config.testMatch) ? config.testMatch : [config.testMatch]
  assert.deepEqual(matches, /** @type {string[]} */ (entry.expectedTestMatch), `${CORPUS_REL}: case "${name}" declares testMatch ${JSON.stringify(entry.expectedTestMatch)} for field "expectedTestMatch" at path cases.${name}.expectedTestMatch; repair: the config must select exactly the declared product and component journey entries.`)
  // Every mounted journey module on disk must be selected, so a component
  // journey that lands later cannot be added without widening the match.
  const journeyDir = resolve(ROOT, /** @type {string} */ (entry.expectedTestDir))
  const journeyModules = readdirSync(journeyDir)
    .filter((name) => name.endsWith('.journey.mjs'))
    .sort()
  assert.ok(journeyModules.length > 0, `${CORPUS_REL}: case "${name}" found no mounted journey module under ${String(entry.expectedTestDir)}; repair: keep the Fairtest journey directory populated.`)
  for (const module of journeyModules) {
    assert.ok(
      /** @type {string[]} */ (entry.expectedTestMatch).some((pattern) => pattern.includes(module.replace(/\.mjs$/, ''))),
      `${CORPUS_REL}: case "${name}" leaves the mounted journey ${JSON.stringify(module)} unselected for field "expectedTestMatch" at path cases.${name}.expectedTestMatch; repair: widen the match to the journey module, never the whole directory.`,
    )
  }
}

/**
 * Run one loopback-owner case. The declared owner is the only module allowed
 * to declare the host and port, every consumer must read that same value, the
 * driver's own defaults must come from it, and no consumer may carry a second
 * declaration of either value.
 * @param {Record<string, unknown>} entry
 */
async function runPortOwnerCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const ownerModule = /** @type {string} */ (entry.ownerModule)
  const owner = /** @type {Record<string, any>} */ (await import(pathToFileURL(resolve(ROOT, ownerModule)).href))
  const config = /** @type {Record<string, any>} */ (await import(pathToFileURL(resolve(ROOT, CONFIG_REL)).href))
  for (const key of ['FAIRTEST_APP_HOST', 'FAIRTEST_APP_PORT', 'FAIRTEST_APP_BASE_URL']) {
    assert.equal(config[key], owner[key], `${CORPUS_REL}: case "${name}" found the config declaring its own ${key} for field "ownerModule" at path cases.${name}.ownerModule; repair: import ${key} from ${ownerModule} instead of declaring it again.`)
  }
  assert.equal(owner.FAIRTEST_APP_BASE_URL, `http://${owner.FAIRTEST_APP_HOST}:${owner.FAIRTEST_APP_PORT}`, `${CORPUS_REL}: case "${name}" found a base URL outside the declared host and port for field "ownerModule" at path cases.${name}.ownerModule; repair: derive the base URL from the declared pair.`)
  assert.equal(config.default.use.baseURL, owner.FAIRTEST_APP_BASE_URL, `${CORPUS_REL}: case "${name}" found the runner resolving a different base URL for field "ownerModule" at path cases.${name}.ownerModule; repair: build use.baseURL from the declared owner.`)
  const driver = createProductStaticDriver()
  assert.equal(driver.port, owner.FAIRTEST_APP_PORT, `${CORPUS_REL}: case "${name}" found the static driver defaulting to another port for field "portEnvName" at path cases.${name}.portEnvName; repair: default the driver to the declared owner.`)
  assert.equal(driver.host, owner.FAIRTEST_APP_HOST, `${CORPUS_REL}: case "${name}" found the static driver defaulting to another host for field "ownerModule" at path cases.${name}.ownerModule; repair: default the driver to the declared owner.`)
  // The consumer inventory is DERIVED, not a hand list: every module that
  // reads a loopback-origin symbol from the runtime owner must be inventoried
  // here, and every inventoried module must actually read it. Closed in both
  // directions, so a new consumer is required onto the list and a dropped one
  // turns the case red.
  const derivedConsumers = deriveLoopbackOriginConsumers()
  assert.deepEqual(
    [.../** @type {string[]} */ (entry.consumerModules)].sort(),
    derivedConsumers,
    `${CORPUS_REL}: case "${name}" found the consumer inventory ${JSON.stringify([.../** @type {string[]} */ (entry.consumerModules)].sort())} for field "consumerModules" at path cases.${name}.consumerModules; repair: the derived set of modules reading a loopback-origin symbol from ${ownerModule} is ${JSON.stringify(derivedConsumers)}; list exactly that set.`,
  )
  const ownerText = readFileSync(resolve(ROOT, ownerModule), 'utf8')
  const hostLiteral = String(owner.FAIRTEST_APP_HOST)
  const portLiteral = String(owner.FAIRTEST_APP_PORT)
  assert.ok(ownerText.includes(hostLiteral), `${CORPUS_REL}: case "${name}" found no ${JSON.stringify(hostLiteral)} declaration in the owner for field "ownerModule" at path cases.${name}.ownerModule; repair: declare the loopback host in the owner.`)
  assert.ok(ownerText.includes(portLiteral), `${CORPUS_REL}: case "${name}" found no ${JSON.stringify(portLiteral)} declaration in the owner for field "portEnvName" at path cases.${name}.portEnvName; repair: declare the loopback port default in the owner.`)
  for (const consumer of /** @type {string[]} */ (entry.consumerModules)) {
    const text = readFileSync(resolve(ROOT, consumer), 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, index) => {
      if (new RegExp(`(['"\`])${hostLiteral}\\1`).test(line)) {
        throw new Error(
          `${CORPUS_REL}: case "${name}" found a second loopback host declaration in ${consumer} on line ${String(index + 1)} for field "ownerModule" at path cases.${name}.ownerModule; ` +
          `repair: read the host from ${ownerModule} instead of repeating ${JSON.stringify(hostLiteral)}.`,
        )
      }
      if (new RegExp(`(FAIRTEST_APP_PORT|FAIRTEST_APP_HOST|FAIRTEST_APP_BASE_URL)\\s*=`).test(line) && !line.includes('import')) {
        throw new Error(
          `${CORPUS_REL}: case "${name}" found a second loopback origin declaration in ${consumer} on line ${String(index + 1)} for field "ownerModule" at path cases.${name}.ownerModule; ` +
          `repair: import the origin from ${ownerModule} instead of declaring it again.`,
        )
      }
    })
  }
}

/**
 * Every rendered-view guard call site the mounted row makes, read out of the
 * real producer source. A call site is the guard invocation plus the report it
 * pushes immediately after, so the pair cannot be half-deleted without the
 * reported sequence changing.
 * @param {string} source product-producer.mjs source
 * @returns {{ observation: string, part: string, path: string, point: string, text: string }[]} the call sites in source order
 */
function mountedRowGuardCallSites(source) {
  const start = source.indexOf('export async function captureProductRow')
  assert.notEqual(start, -1, 'product-producer.mjs: the mounted row is missing at path producer.captureProductRow; repair: keep the row that writes the six artifact classes.')
  const row = source.slice(start)
  const pattern = /activeViewGuard\((\w+),\s*\{\s*label: '([^']*)',\s*part: '([^']*)',\s*path: '([^']*)',[\s\S]*?\}\)\s*\n\s*activeViewGuardCalls\.push\('([^']+)'\)/g
  return [...row.matchAll(pattern)].map((match) => ({
    observation: match[1],
    label: match[2],
    part: match[3],
    path: match[4],
    point: match[5],
    text: match[0],
  }))
}

/**
 * Run one served-digest comparison case. The recorded provenance digests are
 * read over HTTP by the row, so something has to compare them to a real tree or
 * a record's digests describe nothing. This case builds a throwaway build tree,
 * takes the digests the served side would report, and requires the producer's
 * real comparison to accept them when they match the tree and to refuse them
 * when the served bytes differ or the asset is absent.
 * @param {Record<string, unknown>} entry
 */
function runServedDigestComparisonCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const scratch = mkdtempSync(join(tmpdir(), 'fairtest-served-digest-'))
  let message = null
  let receipt = null
  try {
    const distRoot = join(scratch, 'dist')
    mkdirSync(join(distRoot, 'assets'), { recursive: true })
    /** @type {Record<string, string>} */
    const assetDigests = {}
    for (const [relative, body] of /** @type {[string, string][]} */ (entry.files)) {
      writeFileSync(join(distRoot, relative), body)
      assetDigests[relative] = createHash('sha256').update(body).digest('hex')
    }
    if (entry.mutateFile !== null) {
      // The served side answered with different bytes than the tree holds, which
      // is exactly what an unrelated server already holding the port produces.
      assetDigests[String(entry.mutateFile)] = createHash('sha256').update(`${String(entry.mutateFile)}${String(entry.mutateSuffix)}`).digest('hex')
    }
    receipt = assertServedDigestsMatchRunRoot({ assetDigests, distRoot })
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${CORPUS_REL}: case "${name}" refused a served tree that matches the run build: ${message}`)
    // The comparison has to be REACHED, not merely exist: a function nobody
    // calls would leave every one of these behavioural cases green while the
    // written provenance described bytes nothing had compared.
    const producer = readFileSync(resolve(HERE, 'product-producer.mjs'), 'utf8')
    const start = producer.indexOf(`function ${String(entry.wiredInto)}(`)
    assert.notEqual(start, -1, `${name}: the producer no longer declares ${String(entry.wiredInto)} at path producer.${String(entry.wiredInto)}; repair: keep the served-provenance collector.`)
    const body = producer.slice(start, producer.indexOf('\n}\n', start))
    assert.ok(
      /assertServedDigestsMatchRunRoot\(/.test(body),
      `${name}: ${String(entry.wiredInto)} no longer compares the served digests with the run build tree at path producer.${String(entry.wiredInto)}; repair: compare every recorded digest against the built tree before the provenance is written.`,
    )
    assert.equal(receipt.against, 'run-root-dist', `${name}: the receipt must name the tree the digests were compared against`)
    assert.equal(receipt.commitCorrespondence, 'verifier-owned', `${name}: the receipt must say who owns the commit correspondence`)
    assert.deepEqual([...receipt.entries], /** @type {string[]} */ (entry.files).map(([relative]) => relative).sort(), `${name}: the receipt must name every compared entry`)
  } else {
    assert.ok(message, `${name}: a served tree that does not match the run build was accepted`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/**
 * Run one mounted-row guard-call case. The mounted row reaches the
 * rendered-active-view predicate through one seam and must call it at BOTH
 * declared observation points: the pre-action body read and the post-action
 * view read. Each call site's reported point must agree with the part and path
 * it was handed, so a call cannot be moved to the wrong observation point while
 * still counting.
 *
 * The case then deletes each call site from the real source in memory and
 * requires the same extraction to stop reporting it, which is the source
 * mutation that makes the requirement load-bearing: a row with only one call
 * site is a row whose post-action floor (or pre-action floor) is not enforced.
 * @param {Record<string, unknown>} entry
 */
function runMountedRowGuardCallsCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const producerModule = /** @type {string} */ (entry.producerModule)
  const expected = /** @type {string[]} */ (entry.expectedGuardPoints)
  const deletedCallPoint = /** @type {string} */ (entry.deletedCallPoint)
  const source = readFileSync(resolve(HERE, producerModule), 'utf8')
  const callSites = mountedRowGuardCallSites(source)
  const points = callSites.map((site) => site.point)

  // The real path: both declared call sites, in declared order, each naming the
  // observation point its context actually carried.
  for (const site of callSites) {
    assert.equal(
      site.point,
      `${site.part}@${site.path}`,
      `${CORPUS_REL}: case "${name}" has a rendered-view guard call whose reported point ${JSON.stringify(site.point)} does not match the ${JSON.stringify(site.part)} at ${JSON.stringify(site.path)} it was handed for field "expectedGuardPoints" at path cases.${name}.expectedGuardPoints; repair: report the observation point the guard context actually carries.`,
    )
    assert.match(site.observation, /^active(Before|After)$/, `${CORPUS_REL}: case "${name}" has a guard call on ${JSON.stringify(site.observation)}; repair: guard the pre-action and post-action measurements the row reads.`)
  }
  assert.deepEqual(
    points,
    expected,
    `${CORPUS_REL}: case "${name}" found the mounted row invoking the rendered-view guard at ${JSON.stringify(points)} for field "expectedGuardPoints" at path cases.${name}.expectedGuardPoints; repair: keep one guard call at each declared observation point (${expected.join(', ')}); deleting a call site leaves its observation point unguarded.`,
  )

  // The source mutation: delete the named call site and require the extraction
  // to notice. This is what a reviewer gets when they remove one call to see
  // whether anything goes red.
  const target = callSites.find((site) => site.point === deletedCallPoint)
  assert.ok(target, `${CORPUS_REL}: case "${name}" found no call site ${JSON.stringify(deletedCallPoint)} to delete for field "deletedCallPoint" at path cases.${name}.deletedCallPoint; repair: name one of the declared guard points.`)
  const mutated = mountedRowGuardCallSites(source.replace(target.text, ''))
  assert.notDeepEqual(
    mutated.map((site) => site.point),
    expected,
    `${CORPUS_REL}: case "${name}" still reports every declared guard point after the ${JSON.stringify(deletedCallPoint)} call site was deleted for field "deletedCallPoint" at path cases.${name}.deletedCallPoint; repair: the extraction must read the row's real call sites so a deleted one is visible.`,
  )
  assert.ok(
    !mutated.some((site) => site.point === deletedCallPoint),
    `${CORPUS_REL}: case "${name}" still reports the deleted ${JSON.stringify(deletedCallPoint)} call site for field "deletedCallPoint" at path cases.${name}.deletedCallPoint; repair: report the call site the row actually makes.`,
  )
}

/**
 * Run one combined-suite-invocation case. The two browser-backed product
 * suites are the pair that used to collide: Node runs test FILES concurrently by
 * default, so both opened listeners in the same instant. This case runs them
 * together in ONE `node --test` invocation, with the declared serial file
 * execution, and requires both selected cases to pass from that single run, so
 * a future second hard-coded scratch port cannot hide behind "they are never run
 * together".
 * @param {Record<string, unknown>} entry
 */
async function runCombinedSuiteInvocationCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const suites = /** @type {string[]} */ (entry.suites)
  const selected = /** @type {string[]} */ (entry.selectedCases)
  assert.ok(existsSync(join(ROOT, 'dist', 'index.html')), `${name}: the selected browser-backed case reads the built app; repair: run pnpm build before this suite.`)
  for (const suite of suites) {
    assert.ok(existsSync(resolve(ROOT, suite)), `${CORPUS_REL}: case "${name}" names a missing suite ${JSON.stringify(suite)} for field "suites" at path cases.${name}.suites; repair: list repository-relative suite paths.`)
  }
  const contract = await import('./run-product-contract.mjs')
  assert.ok(
    contract.PRODUCT_CONTRACT_NODE_ARGS.includes('--test-concurrency=1'),
    `${CORPUS_REL}: case "${name}" found the declared command without serial file execution for field "suites" at path cases.${name}.suites; repair: keep --test-concurrency=1 in PRODUCT_CONTRACT_NODE_ARGS so the browser-backed suites cannot race.`,
  )
  for (const suite of suites) {
    assert.ok(
      contract.PRODUCT_CONTRACT_SUITES.includes(suite),
      `${CORPUS_REL}: case "${name}" names a suite ${JSON.stringify(suite)} the declared command does not run for field "suites" at path cases.${name}.suites; repair: declare the suite in PRODUCT_CONTRACT_SUITES.`,
    )
  }
  // The pattern selects one cheap case from each suite by name, so the child
  // process runs both files without re-entering this one: neither selected name
  // is a case that spawns another node --test invocation.
  // Node refuses a nested `node --test` from inside a running test file, and the
  // marker it keys on is NODE_TEST_CONTEXT in the child environment. This run is
  // a genuinely independent invocation of the two suites, so the marker is
  // cleared for the child: without that, the runner skips every file and exits
  // green with no report at all, which would make this case pass vacuously.
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(
    process.execPath,
    ['--test', '--test-reporter=tap', '--test-concurrency=1', `--test-name-pattern=${selected.map((caseName) => caseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}`, ...suites],
    { cwd: ROOT, encoding: 'utf8', env },
  )
  const output = `${result.stdout || ''}${result.stderr || ''}`
  assert.equal(result.status, 0, `${name}: one node --test invocation over ${suites.join(' and ')} failed\n${output}`)
  // One invocation, one report: each selected case must appear on its own TAP
  // `ok` line, which is only possible if both files were discovered and run by
  // this single command.
  for (const caseName of selected) {
    const escaped = caseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const okLine = output.split('\n').find((line) => new RegExp(`^\\s*ok \\d+ - ${escaped}$`).test(line))
    assert.ok(okLine, `${name}: the single node --test invocation over ${suites.join(' and ')} never reported ${JSON.stringify(caseName)} as passing\n${output}`)
  }
  assert.ok(/^# fail 0$/m.test(output), `${name}: the single invocation over ${suites.join(' and ')} reported a failing case\n${output}`)
}

/**
 * Run one product-contract-command case. Reachability is only real if a
 * package script, a runner-inventory row, and the suites the command declares
 * all agree, and if the deferred required-CI mount is stated rather than
 * implied: the case reads the declared status and requires that no required CI
 * workflow invokes the command yet, so "declared" can never be misread as
 * "enforced".
 * @param {Record<string, unknown>} entry
 */
async function runProductContractCommandCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const commandName = /** @type {string} */ (entry.commandName)
  const expectedScript = /** @type {string} */ (entry.expectedScript)
  const expectedSuites = /** @type {string[]} */ (entry.expectedSuites)
  const expectedNodeArgs = /** @type {string[]} */ (entry.expectedNodeArgs)
  const ciMountStatus = /** @type {string} */ (entry.ciMountStatus)
  const workflowDir = /** @type {string} */ (entry.workflowDir)

  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
  const script = pkg.scripts?.[commandName]
  assert.equal(script, expectedScript, `${CORPUS_REL}: case "${name}" found package script ${JSON.stringify(script)} for field "commandName" at path cases.${name}.commandName; repair: declare "${commandName}" as ${JSON.stringify(expectedScript)} so the contract suites are reachable from one command.`)

  const contract = await import('./run-product-contract.mjs')
  assert.deepEqual([...contract.PRODUCT_CONTRACT_SUITES], expectedSuites, `${CORPUS_REL}: case "${name}" found the declared suites ${JSON.stringify([...contract.PRODUCT_CONTRACT_SUITES])} for field "expectedSuites" at path cases.${name}.expectedSuites; repair: declare every host-contract suite in PRODUCT_CONTRACT_SUITES, in this order.`)
  assert.deepEqual([...contract.PRODUCT_CONTRACT_NODE_ARGS], expectedNodeArgs, `${CORPUS_REL}: case "${name}" found the declared node arguments ${JSON.stringify([...contract.PRODUCT_CONTRACT_NODE_ARGS])} for field "expectedNodeArgs" at path cases.${name}.expectedNodeArgs; repair: execute the declared suites in one node --test invocation with serial file execution.`)
  for (const suite of expectedSuites) {
    assert.ok(existsSync(resolve(ROOT, suite)), `${CORPUS_REL}: case "${name}" names a missing declared suite ${JSON.stringify(suite)} for field "expectedSuites" at path cases.${name}.expectedSuites; repair: point the command at a suite that exists.`)
  }

  // The inventory row: one required command, invoked exactly as the package
  // script is named, or the command graph is an orphan script again.
  const inventory = coreFixtures.loadSingleDocument(readFileSync(resolve(ROOT, INVENTORY_REL), 'utf8'), INVENTORY_REL)
  const rows = /** @type {Record<string, unknown>[]} */ (inventory.commands).filter((row) => row.name === commandName)
  assert.equal(rows.length, 1, `${CORPUS_REL}: case "${name}" found ${String(rows.length)} runner-inventory rows for field "commandName" at path cases.${name}.commandName; repair: declare ${JSON.stringify(commandName)} exactly once in ${INVENTORY_REL}.`)
  assert.equal(rows[0].invocation, `pnpm ${commandName}`, `${CORPUS_REL}: case "${name}" found inventory invocation ${JSON.stringify(rows[0].invocation)} for field "commandName" at path cases.${name}.commandName; repair: declare the exact pnpm invocation for the command.`)

  // The deferral, stated and checked. Required-CI mounting is not done, so
  // this case fails the moment a workflow starts running the command, which is
  // the point: the status must be flipped in the same change that mounts it.
  assert.equal(contract.PRODUCT_CONTRACT_REQUIRED_CI_MOUNT.status, ciMountStatus, `${CORPUS_REL}: case "${name}" found required-CI mount status ${JSON.stringify(contract.PRODUCT_CONTRACT_REQUIRED_CI_MOUNT.status)} for field "ciMountStatus" at path cases.${name}.ciMountStatus; repair: ${contract.PRODUCT_CONTRACT_REQUIRED_CI_MOUNT.reason}.`)
  const workflows = readdirSync(resolve(ROOT, workflowDir)).filter((entryName) => entryName.endsWith('.yml') || entryName.endsWith('.yaml'))
  for (const workflow of workflows) {
    const text = readFileSync(resolve(ROOT, workflowDir, workflow), 'utf8')
    assert.ok(
      !text.includes(commandName),
      `${CORPUS_REL}: case "${name}" found ${JSON.stringify(commandName)} in ${workflowDir}/${workflow} while the declared required-CI mount status is ${JSON.stringify(ciMountStatus)} for field "ciMountStatus" at path cases.${name}.ciMountStatus; repair: mount it in required CI and flip PRODUCT_CONTRACT_REQUIRED_CI_MOUNT.status and this case's ciMountStatus in the same change.`,
    )
  }
}

/**
 * Run one mounted-command case. The mounted evidence command carries the same
 * declared-not-ci standard the product-contract command carries: its package
 * script, its runner-inventory row, and its declared required-CI mount status
 * must all agree, and while the status is declared-not-ci no required CI
 * workflow may invoke the command, so "declared" can never be misread as
 * "enforced". The mount lands in a later slice and must flip this status and
 * the case's ciMountStatus in the same change.
 * @param {Record<string, unknown>} entry
 */
async function runMountedCommandCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const commandName = /** @type {string} */ (entry.commandName)
  const expectedScript = /** @type {string} */ (entry.expectedScript)
  const ciMountStatus = /** @type {string} */ (entry.ciMountStatus)
  const workflowDir = /** @type {string} */ (entry.workflowDir)

  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
  const script = pkg.scripts?.[commandName]
  assert.equal(script, expectedScript, `${CORPUS_REL}: case "${name}" found package script ${JSON.stringify(script)} for field "commandName" at path cases.${name}.commandName; repair: declare "${commandName}" as ${JSON.stringify(expectedScript)} so the mounted evidence path stays reachable from one command.`)

  const inventory = coreFixtures.loadSingleDocument(readFileSync(resolve(ROOT, INVENTORY_REL), 'utf8'), INVENTORY_REL)
  const rows = /** @type {Record<string, unknown>[]} */ (inventory.commands).filter((row) => row.name === commandName)
  assert.equal(rows.length, 1, `${CORPUS_REL}: case "${name}" found ${String(rows.length)} runner-inventory rows for field "commandName" at path cases.${name}.commandName; repair: declare ${JSON.stringify(commandName)} exactly once in ${INVENTORY_REL}.`)
  assert.equal(rows[0].invocation, `pnpm ${commandName}`, `${CORPUS_REL}: case "${name}" found inventory invocation ${JSON.stringify(rows[0].invocation)} for field "commandName" at path cases.${name}.commandName; repair: declare the exact pnpm invocation for the command.`)

  const mounted = await import('./run-mounted.mjs')
  assert.ok(mounted.MOUNTED_REQUIRED_CI_MOUNT, `${CORPUS_REL}: case "${name}" found no declared required-CI mount in run-mounted.mjs for field "ciMountStatus" at path cases.${name}.ciMountStatus; repair: declare MOUNTED_REQUIRED_CI_MOUNT so the deferral is observable.`)
  assert.equal(mounted.MOUNTED_REQUIRED_CI_MOUNT.status, ciMountStatus, `${CORPUS_REL}: case "${name}" found required-CI mount status ${JSON.stringify(mounted.MOUNTED_REQUIRED_CI_MOUNT.status)} for field "ciMountStatus" at path cases.${name}.ciMountStatus; repair: ${mounted.MOUNTED_REQUIRED_CI_MOUNT.reason}.`)

  // The deferral, stated and checked. While the status is declared-not-ci,
  // this case fails the moment a workflow starts running the command, which is
  // the point: the status must be flipped in the same change that mounts it.
  // Once the mount lands and the status flips, the direction inverts: at
  // least one workflow must invoke the command, so the flip cannot be
  // declared without the mount either.
  const workflows = readdirSync(resolve(ROOT, workflowDir)).filter((workflowEntry) => workflowEntry.endsWith('.yml') || workflowEntry.endsWith('.yaml'))
  let referenced = null
  for (const workflow of workflows) {
    const text = readFileSync(resolve(ROOT, workflowDir, workflow), 'utf8')
    if (text.includes(commandName)) {
      referenced = workflow
      break
    }
  }
  if (ciMountStatus === 'declared-not-ci') {
    assert.equal(
      referenced,
      null,
      `${CORPUS_REL}: case "${name}" found ${JSON.stringify(commandName)} in ${workflowDir}/${referenced} while the declared required-CI mount status is ${JSON.stringify(ciMountStatus)} for field "ciMountStatus" at path cases.${name}.ciMountStatus; repair: mount it in required CI and flip MOUNTED_REQUIRED_CI_MOUNT.status and this case's ciMountStatus in the same change.`,
    )
  } else {
    assert.ok(
      referenced,
      `${CORPUS_REL}: case "${name}" declared the required-CI mount ${JSON.stringify(ciMountStatus)} but no workflow in ${workflowDir} invokes ${JSON.stringify(commandName)} for field "ciMountStatus" at path cases.${name}.ciMountStatus; repair: mount the command in required CI or keep the status declared-not-ci.`,
    )
  }
}

/**
 * Run one host-literal-guard case. The real product host files must carry no
 * app-structure literal in any quote syntax, and a copy with a product literal
 * moved into a TEMPLATE literal must be refused. The template form is the
 * realistic vector because that is the syntax the unrendered-mode stylesheets
 * already use, so a guard that only understands single and double quotes would
 * pass over a second owner.
 * @param {Record<string, unknown>} entry
 */
function runHostLiteralGuardCase(entry) {
  const name = /** @type {string} */ (entry.name)
  for (const file of /** @type {string[]} */ (entry.hostFiles)) {
    assertNoAppStructureLiterals(readFileSync(resolve(HERE, file), 'utf8'), file)
  }
  const mutated = /** @type {{ file: string, from: string, to: string }} */ (entry.mutatedLiteral)
  const source = readFileSync(resolve(HERE, mutated.file), 'utf8')
  assert.ok(source.includes(mutated.from), `${CORPUS_REL}: case "${name}" found no ${JSON.stringify(mutated.from)} in ${mutated.file} to mutate for field "mutatedLiteral" at path cases.${name}.mutatedLiteral; repair: point the mutation at source text that exists.`)
  assert.ok(
    !APP_STRUCTURE_LITERALS.some(({ pattern }) => pattern.test(mutated.from)),
    `${CORPUS_REL}: case "${name}" is mutating a literal the guard already covers for field "mutatedLiteral" at path cases.${name}.mutatedLiteral; repair: mutate the quote syntax the guard must learn, not one it already sees.`,
  )
  const moved = source.replace(mutated.from, mutated.to)
  let message = null
  try {
    assertNoAppStructureLiterals(moved, mutated.file)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  assert.ok(message, `${CORPUS_REL}: case "${name}" accepted the mutated literal ${JSON.stringify(mutated)} for field "mutatedLiteral" at path cases.${name}.mutatedLiteral; repair: cover every quote syntax a value can take, template literals included.`)
  expectFragments(['carries a product selector literal', 'at path', 'repair:'], message, name)
}

/**
 * Run one axe-report-shape case. The compact scan shape has one owner: the
 * shared journey primitive and its declared field set. The producer's
 * fail-closed shape check must accept exactly that set and refuse both an
 * extra and a missing field, so no second local mapping can drift beside it.
 * @param {Record<string, unknown>} entry
 */
function runAxeReportShapeCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const canned = {
    tags: ['wcag2a', 'wcag2aa'],
    violations: [{ id: 'color-contrast', impact: 'serious', nodes: [['nav']] }],
    incomplete: [],
    passes: 12,
  }
  const declared = [...AXE_RESULT_FIELDS]
  assert.ok(declared.length > 0, `${name}: the shared axe primitive must declare its compact result field set`)
  assert.deepEqual(Object.keys(canned).sort(), [...declared].sort(), `${CORPUS_REL}: case "${name}" holds a canned scan outside the shared declared shape for field "check" at path cases.${name}.check; repair: build the canned scan from AXE_RESULT_FIELDS so the two reports in axe.json share one shape.`)
  assertProductAxeScanShape(canned, 'pageWide', 'evidence.axe.pageWide')
  for (const mutation of [{ ...canned, ruleIds: [] }, Object.fromEntries(Object.entries(canned).slice(1))]) {
    let message = null
    try {
      assertProductAxeScanShape(mutation, 'scopedBefore', 'evidence.axe.scoped')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, `${name}: a scan outside the declared shared shape was accepted; repair: keep the producer's axe shape check exact.`)
    expectFragments(['axeScan', 'at path evidence.axe.scoped', 'repair:'], message, name)
  }
}

/**
 * Run one observation-time case through the producer's own fail-closed
 * timing guard.
 * @param {Record<string, unknown>} entry
 */
function runObservationTimeCase(entry) {  const name = /** @type {string} */ (entry.name)
  const input = {}
  for (const field of ['rowStartedAtMs', ...PRODUCT_PRE_ACTION_PARTS, 'theme', 'action']) {
    input[field] = entry[field]
  }
  let message = null
  try {
    assertProductObservationTimes(input)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: real observation times failed: ${message}`)
  } else {
    assert.ok(message, `${name}: synthetic observation times passed the timing guard`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/**
 * Read one real response from the loopback origin, keeping the status and the
 * served bytes. A refused request is only proven fail-closed when the bytes it
 * did return are checked as well, so the body is never discarded here. The
 * request never reuses a pooled connection: these cases stop and restart a
 * driver on the same fixed port, and a kept-alive socket to the previous
 * server would surface as a socket hang up instead of a refusal.
 * @param {string} url loopback URL to request
 * @returns {Promise<{ status: number, body: string }>} the observed response
 */
function readLoopbackResponse(url) {
  return new Promise((responseResolve, responseReject) => {
    http.get(url, { agent: false }, (res) => {
      res.setEncoding('utf8')
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => responseResolve({ status: res.statusCode, body }))
    }).on('error', responseReject)
  })
}

/**
 * Run one out-of-root case against the real static driver. The served root is
 * a throwaway directory whose parent holds a marker file, so a traversal that
 * escapes the root resolves to a genuinely readable file: the refusal is then
 * proven on the wire, over real HTTP, with no built app involved.
 * @param {Record<string, unknown>} entry
 */
async function runDriverOutOfRootCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const markerFile = /** @type {string} */ (entry.markerFile)
  const markerBody = /** @type {string} */ (entry.markerBody)
  const scratch = mkdtempSync(join(tmpdir(), 'fairtest-driver-out-of-root-'))
  const servedRoot = createStaticFixtureRoot(scratch)
  const { port } = await claimScratchPort(REAL_DRIVER_PURPOSES.outOfRoot)
  if (basename(servedRoot) !== entry.servedRoot) {
    throw new Error(
      `${CORPUS_REL}: case "${name}" served the root ${JSON.stringify(basename(servedRoot))} where the declared served root is ${JSON.stringify(entry.servedRoot)} at path cases.${name}.servedRoot; ` +
      'repair: declare the directory the real static fixture root is created under so the marker stays one level above it.',
    )
  }
  writeFileSync(join(scratch, markerFile), markerBody)
  let inRoot = null
  try {
    const driver = createProductStaticDriver({ port, host: FAIRTEST_APP_HOST, distRoot: servedRoot })
    try {
      await driver.start()
      inRoot = await readLoopbackResponse(`${driver.baseUrl}${entry.inRootRequest}`)
      if (inRoot.status !== entry.inRootStatus) {
        throw new Error(
          `${CORPUS_REL}: case "${name}" observed status ${inRoot.status} for the in-root request ${JSON.stringify(entry.inRootRequest)} where the declared in-root status is ${JSON.stringify(entry.inRootStatus)} at path cases.${name}.inRootStatus; ` +
          'repair: keep the served root readable so this case proves a real refusal instead of an unreadable service.',
        )
      }
      for (const prefix of /** @type {string[]} */ (entry.traversalPrefixes)) {
        const requestPath = `${prefix}${markerFile}`
        const refused = await readLoopbackResponse(`${driver.baseUrl}${requestPath}`)
        if (refused.status !== entry.refusedStatus) {
          throw new Error(
            `${CORPUS_REL}: case "${name}" observed status ${refused.status} for the out-of-root request ${JSON.stringify(requestPath)} where the declared refusal status is ${JSON.stringify(entry.refusedStatus)} at path cases.${name}.refusedStatus; ` +
            'repair: keep the out-of-root guard so every resolved path outside the served root is refused.',
          )
        }
        if (refused.body.includes(markerBody)) {
          throw new Error(
            `${CORPUS_REL}: case "${name}" disclosed the out-of-root marker bytes for field "markerBody" at path cases.${name}.markerBody on the out-of-root request ${JSON.stringify(requestPath)}; ` +
            'repair: keep the out-of-root guard so a file beside the served root is never disclosed to the browser under test.',
          )
        }
      }
    } finally {
      await driver.stop()
    }
    await assertPortReleased(port)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
  assert.equal(existsSync(scratch), false, `${name}: the throwaway static root must be removed once the case finishes`)
  assert.ok(inRoot !== null && inRoot.body.includes('id="root"'), `${name}: the in-root control request must still serve the real app mount point`)
}

/**
 * Run one host-refusal case against the real static driver. The loopback host
 * must still build a driver, and every declared non-loopback host must be
 * refused at construction with the actionable driver.host diagnostic, so the
 * validation origin can never become a wildcard or named listener. The
 * scratch port is proved still free afterwards: the refusal happens before
 * any listener is opened.
 * @param {Record<string, unknown>} entry
 */
async function runDriverHostRefusalCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const scratch = mkdtempSync(join(tmpdir(), 'fairtest-driver-host-'))
  const distRoot = createStaticFixtureRoot(scratch)
  const { port } = await claimScratchPort(REAL_DRIVER_PURPOSES.hostRefusal)
  try {
    const loopbackHost = /** @type {string} */ (entry.loopbackHost)
    const accepted = createProductStaticDriver({ port, host: loopbackHost, distRoot })
    if (accepted.host !== loopbackHost) {
      throw new Error(
        `${CORPUS_REL}: case "${name}" built a driver on host ${JSON.stringify(accepted.host)} where the declared loopback host is ${JSON.stringify(loopbackHost)} at path cases.${name}.loopbackHost; ` +
        'repair: keep the loopback host accepted so this case proves the guard discriminates rather than refusing everything.',
      )
    }
    for (const host of /** @type {string[]} */ (entry.rejectedHosts)) {
      let message = null
      try {
        createProductStaticDriver({ port, host, distRoot })
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      if (!message) {
        throw new Error(
          `${CORPUS_REL}: case "${name}" accepted the non-loopback host ${JSON.stringify(host)} for field "rejectedHosts" at path cases.${name}.rejectedHosts; ` +
          'repair: keep the non-loopback guard so the built app can never bind a wildcard or named listener.',
        )
      }
      expectFragments(
        ['product producer: non-loopback host', `"${host}"`, 'field "host"', 'at path driver.host', 'repair:'],
        message,
        name,
      )
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
  await assertPortReleased(port)
}

/**
 * Run one stop-contract case. The declared driver surface must state the
 * idle-stop requirement where a driver author reads it, and a driver that
 * rejects a stop it is not running for must still leave the original start
 * diagnostic as the failure: the failure path stops the running driver once,
 * and teardown for a run that never started must not ask for a second stop
 * that would surface as a cleanup failure in the journey's afterAll.
 * @param {Record<string, unknown>} entry
 */
async function runDriverStopContractCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let declared = null
  try {
    await createFairtradeAdapter({
      runId: 'adapter-probe-no-stop',
      driver: { start: async () => {}, reset: async () => {}, isRunning: () => false },
      createdAtMs: 1000,
    })
  } catch (error) {
    declared = error instanceof Error ? error.message : String(error)
  }
  if (!declared) {
    throw new Error(
      `${CORPUS_REL}: case "${name}" accepted a driver with no stop method for field "contractRequirement" at path cases.${name}.contractRequirement; ` +
      'repair: keep the driver surface requirement so an unusable driver is refused at construction.',
    )
  }
  if (!declared.includes(/** @type {string} */ (entry.contractRequirement))) {
    throw new Error(
      `${CORPUS_REL}: case "${name}" declares no ${JSON.stringify(entry.contractRequirement)} for field "contractRequirement" at path cases.${name}.contractRequirement; got ${declared}; ` +
      'repair: declare on the adapter driver surface that stop must be safe to call when the driver is not running.',
    )
  }
  expectFragments(['adapter.driver.stop', 'repair:'], declared, name)
  const driver = createFakeDriver({
    failStart: true,
    startFailure: /** @type {string} */ (entry.startFailure),
    failStopWhenIdle: true,
  })
  const adapter = await createFairtradeAdapter({ runId: 'adapter-probe-idle-stop', driver, createdAtMs: 1000 })
  let startMessage = null
  try {
    await adapter.start()
  } catch (error) {
    startMessage = error instanceof Error ? error.message : String(error)
  }
  if (!startMessage) {
    throw new Error(
      `${CORPUS_REL}: case "${name}" resolved a start that failed with ${JSON.stringify(entry.startFailure)} for field "startFailure" at path cases.${name}.startFailure; ` +
      'repair: keep the failed start failing so its diagnostic is the one a maintainer reads.',
    )
  }
  expectFragments(
    ['fairtrade adapter: driver start failed', 'field "driver"', 'at path adapter.start', 'repair:', `caused by ${entry.startFailure}`],
    startMessage,
    name,
  )
  const teardown = await adapter.teardown()
  assert.deepEqual(teardown, { released: true, noop: false, stops: 1 }, `${name}: teardown after a failed start must release without asking the driver to stop again`)
  assert.equal(driver.calls.stops, 1, `${name}: the driver must never be asked to stop while it is not running`)
  assert.equal(driver.calls.resets, 1, `${name}: the failure path must still reset exactly once`)
  assert.equal(adapter.stats().stops, 1, `${name}: the adapter must count exactly one stop for the failed run`)
  assert.deepEqual([...adapter.lifecycleTrace().stages], ['declared'], `${name}: a run that never started must stay at the declared stage`)
  const repeat = await adapter.teardown()
  assert.deepEqual(repeat, { released: true, noop: true, stops: 1 }, `${name}: the repeated teardown must stay a no-op reporting the same stop count`)
}

/**
 * Prove the declared reset requirement on the failure path. A start that
 * failed before the service came up leaves the driver not running, and the
 * failure path cleans that partial start with reset before stop, so a reset
 * that rejects there is a case the driver contract rules out. The start
 * diagnostic is what a maintainer must still read, so the cleanup failure is
 * reported beside it instead of replacing it, and the run still holds the
 * canonical receipts: one reset, one stop, a declared-stage trace, and a
 * teardown that never asks the driver to stop again.
 * @param {Record<string, unknown>} entry declared case
 */
async function runDriverResetContractCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let declared = null
  try {
    await createFairtradeAdapter({
      runId: 'adapter-probe-no-reset',
      driver: { start: async () => {}, stop: async () => {}, isRunning: () => false },
      createdAtMs: 1000,
    })
  } catch (error) {
    declared = error instanceof Error ? error.message : String(error)
  }
  if (!declared) {
    throw new Error(
      `${CORPUS_REL}: case "${name}" accepted a driver with no reset method for field "contractRequirement" at path cases.${name}.contractRequirement; ` +
      'repair: keep the driver surface requirement so an unusable driver is refused at construction.',
    )
  }
  if (!declared.includes(/** @type {string} */ (entry.contractRequirement))) {
    throw new Error(
      `${CORPUS_REL}: case "${name}" declares no ${JSON.stringify(entry.contractRequirement)} for field "contractRequirement" at path cases.${name}.contractRequirement; got ${declared}; ` +
      'repair: declare on the adapter driver surface that reset must be safe to call when the driver is not running.',
    )
  }
  expectFragments(['adapter.driver.reset', 'repair:'], declared, name)
  const driver = createFakeDriver({
    failStartWhileIdle: true,
    startFailure: /** @type {string} */ (entry.startFailure),
    failResetWhenIdle: true,
  })
  const adapter = await createFairtradeAdapter({ runId: 'adapter-probe-idle-reset', driver, createdAtMs: 1000 })
  let startMessage = null
  try {
    await adapter.start()
  } catch (error) {
    startMessage = error instanceof Error ? error.message : String(error)
  }
  if (!startMessage) {
    throw new Error(
      `${CORPUS_REL}: case "${name}" resolved a start that failed with ${JSON.stringify(entry.startFailure)} for field "startFailure" at path cases.${name}.startFailure; ` +
      'repair: keep the failed start failing so its diagnostic is the one a maintainer reads.',
    )
  }
  expectFragments(
    [
      'fairtrade adapter: driver start failed',
      'field "driver"',
      'at path adapter.start',
      'repair:',
      `caused by ${entry.startFailure}`,
      `caused by ${entry.cleanupFailure}`,
    ],
    startMessage,
    name,
  )
  assert.equal(driver.calls.resets, 1, `${name}: the failure path must reset exactly once even when the reset rejects`)
  assert.equal(driver.calls.stops, 1, `${name}: the failure path must still stop the driver it cleaned`)
  assert.equal(adapter.isRunning(), false, `${name}: no service may remain after a failed start`)
  assert.equal(adapter.stats().stops, 1, `${name}: the adapter must count exactly one stop for the failed run`)
  const teardown = await adapter.teardown()
  assert.deepEqual(teardown, { released: true, noop: false, stops: 1 }, `${name}: teardown after a failed start must release without asking the driver to stop again`)
  assert.equal(driver.calls.stops, 1, `${name}: teardown must never repeat the failure path's stop`)
  assert.deepEqual([...adapter.lifecycleTrace().stages], ['declared'], `${name}: a run that never started must stay at the declared stage`)
  const repeat = await adapter.teardown()
  assert.deepEqual(repeat, { released: true, noop: true, stops: 1 }, `${name}: the repeated teardown must stay a no-op reporting the same stop count`)
}

const RUNNERS = {
  'theme-row': runThemeRowCase,
  route: runRouteCase,
  'section-action': runSectionActionCase,
  capability: runCapabilityCase,
  'cross-kind': runCrossKindCase,
  lifecycle: runLifecycleCase,
  'theme-inference': runThemeInferenceCase,
  'theme-setup': runThemeSetupCase,
  'theme-observation': runThemeObservationCase,
  'project-inference': runProjectInferenceCase,
  'product-proof': runProductProofCase,
  'product-mutation': runProductMutationCase,
  'wrapper-theme': runWrapperThemeCase,
  'artifact-class': runArtifactClassCase,
  'a11y-baseline': runA11yBaselineCase,
  'a11y-delta': runA11yDeltaCase,
  'a11y-record': runA11yRecordCase,
  'observation-time': runObservationTimeCase,
  'run-root': runRunRootCase,
  'cli-target': runCliTargetCase,
  'driver-out-of-root': runDriverOutOfRootCase,
  'driver-host-refusal': runDriverHostRefusalCase,
  'driver-stop-contract': runDriverStopContractCase,
  'rendered-active-view': runRenderedActiveViewCase,
  'record-truthfulness': runRecordTruthfulnessCase,
  'row-dir-preparation': runRowDirPreparationCase,
  'runner-config': runRunnerConfigCase,
  'port-owner': runPortOwnerCase,
  'axe-report-shape': runAxeReportShapeCase,
  'driver-reset-contract': runDriverResetContractCase,
  'mounted-row-guard-calls': runMountedRowGuardCallsCase,
  'combined-suite-invocation': runCombinedSuiteInvocationCase,
  'product-contract-command': runProductContractCommandCase,
  'mounted-command': runMountedCommandCase,
  'host-literal-guard': runHostLiteralGuardCase,
  'served-digest-comparison': runServedDigestComparisonCase,
}

/** @param {Record<string, unknown>} entry */
async function runCase(entry) {
  const runner = RUNNERS[entry.check]
  assert.ok(runner, `${CORPUS_REL}: case "${entry.name}" names an unknown check ${JSON.stringify(entry.check)}`)
  await runner(entry)
}

/**
 * Validate mutated cases the way the owning guards do: exact shape plus
 * required names over the whole mutated corpus, then the ONE case the mutation
 * touched. The family carries real-browser cases, so re-running the whole
 * corpus once per manifest mutation would multiply a full browser launch (and
 * a loopback port) by the mutation count for no extra coverage: a mutation
 * either fails a shape or inventory rule for the whole corpus, or it fails in
 * the case it changed, and both diagnostics are checked by the caller.
 * @param {Record<string, unknown>[]} cases
 * @param {Record<string, unknown>} manifest
 * @param {Record<string, unknown>} mutation
 */
async function validateMutated(cases, manifest, mutation) {
  cases.forEach(checkCaseShape)
  coreFixtures.checkRequiredNames(cases.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS_REL)
  const target = cases.find((entry) => entry.name === mutation.target)
  if (target) {
    await runCase(target)
  }
}
/**
 * @param {Record<string, unknown>[]} cases
 * @param {Record<string, unknown>} mutation
 */
function applyMutation(cases, mutation) {
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
    let node = target
    for (const segment of segments.slice(0, -1)) node = /** @type {Record<string, unknown>} */ (node[segment])
    delete node[segments.at(-1)]
    return
  }
  if (mutation.kind === 'rename-field') {
    let node = target
    for (const segment of segments.slice(0, -1)) node = /** @type {Record<string, unknown>} */ (node[segment])
    const last = segments.at(-1)
    const value = node[last]
    delete node[last]
    node[/** @type {string} */ (mutation.newField)] = value
    return
  }
  let node = target
  for (const segment of segments.slice(0, -1)) {
    // An array is a traversable node like a record: replacing it with a fresh
    // object here would rewrite the whole list and hide which field the
    // mutation was aimed at.
    if (node[segment] === null || typeof node[segment] !== 'object') node[segment] = {}
    node = /** @type {Record<string, unknown>} */ (node[segment])
  }
  node[segments.at(-1)] = structuredClone(mutation.value)
}

/**
 * Create a fake injected lifecycle driver with observable calls. The
 * failStart switch models a driver that acquired a service and then failed
 * before readiness, so the failure path stops a running driver; the
 * failStartWhileIdle switch models a driver that failed before the service
 * came up, so the failure path cleans one that is not running; the
 * failStopWhenIdle and failResetWhenIdle switches model a driver that
 * refuses an idle stop or reset, the cases the adapter's declared driver
 * contract rules out. A cleanup failure must never displace the start
 * diagnostic the failure path reports.
 * @param {object} [behavior] failure switches
 * @param {boolean} [behavior.hangStart] never settle the start
 * @param {boolean} [behavior.failStart] fail after acquiring
 * @param {boolean} [behavior.failStartWhileIdle] fail before the service comes up
 * @param {string} [behavior.startFailure] driver failure text reported by start
 * @param {boolean} [behavior.failStop] reject every stop
 * @param {boolean} [behavior.failStopWhenIdle] reject a stop while not running
 * @param {boolean} [behavior.failResetWhenIdle] reject a reset while not running
 */
function createFakeDriver(behavior = {}) {
  const calls = { starts: 0, stops: 0, resets: 0 }
  let running = false
  return {
    calls,
    isRunning: () => running,
    async start() {
      calls.starts += 1
      if (behavior.hangStart) {
        await new Promise(() => {})
      }
      if (behavior.failStartWhileIdle) {
        throw new Error(behavior.startFailure || 'fake start failed before the service came up')
      }
      if (behavior.failStart) {
        running = true
        throw new Error(behavior.startFailure || 'fake start failed mid-way')
      }
      running = true
    },
    async reset() {
      calls.resets += 1
      if (behavior.failResetWhenIdle && !running) {
        throw new Error('fake reset refused: the driver is not running')
      }
    },
    async stop() {
      calls.stops += 1
      if (behavior.failStop) {
        throw new Error('fake stop failed')
      }
      if (behavior.failStopWhenIdle && !running) {
        throw new Error('fake stop refused: the driver is not running')
      }
      running = false
    },
    async readiness() {
      return { ready: true }
    },
  }
}

/**
 * Wrap one real lifecycle driver in a delegating observer. Every call reaches
 * the real driver unchanged; the observer only records the ordered calls, so
 * the reset-before-stop guarantee can be observed on the real driver whose
 * own reset and stop are otherwise indistinguishable no-ops.
 * @param {object} driver the real injected driver
 * @returns {object} the delegating observed driver
 */
function observeDriverCalls(driver) {
  const calls = []
  return {
    calls,
    start: (...args) => {
      calls.push('start')
      return driver.start(...args)
    },
    reset: (...args) => {
      calls.push('reset')
      return driver.reset(...args)
    },
    stop: (...args) => {
      calls.push('stop')
      return driver.stop(...args)
    },
    isRunning: () => driver.isRunning(),
    readiness: () => driver.readiness(),
    stats: () => driver.stats(),
  }
}

/**
 * Create a throwaway static root holding only the mount point the real static
 * driver requires. A start failure never serves these bytes, so the fixture
 * keeps the case hermetic: no built dist/ tree and no repository byte is
 * read, and the whole root is removed in the caller's finally block.
 * @param {string} scratchRoot scratch parent directory
 * @returns {string} the fixture root handed to the driver as its distRoot
 */
function createStaticFixtureRoot(scratchRoot) {
  const fixtureRoot = join(scratchRoot, 'dist')
  mkdirSync(fixtureRoot, { recursive: true })
  writeFileSync(join(fixtureRoot, 'index.html'), '<!doctype html><html><body><div id="root"></div></body></html>\n')
  return fixtureRoot
}

/**
 * Point the real driver at a static root that does not exist, so its own
 * built-app precondition fails before it ever opens a listener.
 * @param {string} scratchRoot scratch parent directory
 * @returns {string} the absent root handed to the driver as its distRoot
 */
function createAbsentStaticRoot(scratchRoot) {
  return join(scratchRoot, 'absent-dist-root')
}

/**
 * Bind a real loopback server on a scratch port so the real driver's own
 * listen fails with a genuine address-in-use error, and release it on demand.
 * @param {number} port scratch loopback port
 * @returns {object} the squatter handle
 */
function squatOnPort(port) {
  const server = http.createServer((_request, response) => {
    response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('fairtest adapter lifecycle squatter')
  })
  return {
    async bind() {
      try {
        await new Promise((responseResolve, responseReject) => {
          server.on('error', responseReject)
          server.listen(port, FAIRTEST_APP_HOST, () => responseResolve(undefined))
        })
      } catch (error) {
        const cause = error instanceof Error ? error.message : String(error)
        throw new Error(
          `adapter lifecycle case: scratch port ${port} is already held on ${FAIRTEST_APP_HOST}; caused by ${cause}; ` +
          'repair: free the scratch lifecycle port or run the adapter lifecycle cases one at a time.',
        )
      }
    },
    async release() {
      await new Promise((responseResolve) => server.close(() => responseResolve(undefined)))
    },
  }
}

/**
 * Assert nothing still holds a scratch port by binding and releasing a fresh
 * listener on it. A half-bound server the driver failed to clean up fails
 * here with EADDRINUSE.
 * @param {number} port scratch loopback port
 */
async function assertPortReleased(port) {
  const probe = http.createServer()
  try {
    await new Promise((responseResolve, responseReject) => {
      probe.on('error', responseReject)
      probe.listen(port, FAIRTEST_APP_HOST, () => responseResolve(undefined))
    })
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `product driver case: port ${port} is still held after the driver stopped; caused by ${cause}; ` +
      'repair: drop or close the half-bound server on the driver start-failure path and release the real driver in the case finally block so no scratch port stays held.',
    )
  }
  await new Promise((responseResolve) => probe.close(() => responseResolve(undefined)))
}

/**
 * Drive one real static-driver start failure through the real adapter and
 * assert the cleanup guarantees against the real driver: it rejects rather
 * than resolves, reset runs before stop exactly once, stop runs exactly once
 * on the failure path, the adapter and the driver both report no running
 * service, the lifecycle trace stays at the declared stage, teardown releases
 * without asking the already-stopped driver to stop again and stays
 * idempotent, the scratch port is free again, and the throwaway static root is
 * gone. The finally block stops the real driver and releases the squatter, so
 * a regressed driver fails with its own diagnostic instead of hanging the run
 * on a listener it left bound.
 * @param {object} input case inputs
 * @param {string} input.runId adapter run id
 * @param {number} input.port scratch loopback port handed to the driver
 * @param {boolean} input.holdPort bind a real squatter on the scratch port first
 * @param {(scratchRoot: string) => string} input.distRoot builds the driver distRoot from the scratch root
 * @returns {Promise<object>} the observed failure record
 */
async function driveRealStaticDriverStartFailure({ runId, port, holdPort, distRoot }) {
  const scratch = mkdtempSync(join(tmpdir(), 'fairtest-adapter-lifecycle-'))
  const squatter = squatOnPort(port)
  let driver = null
  let squatterBound = false
  let failureRecord = null
  try {
    if (holdPort) {
      await squatter.bind()
      squatterBound = true
    }
    driver = createProductStaticDriver({ port, host: FAIRTEST_APP_HOST, distRoot: distRoot(scratch) })
    const observed = observeDriverCalls(driver)
    const adapter = await createFairtradeAdapter({ runId, driver: observed, createdAtMs: 1000 })
    let message = null
    try {
      await adapter.start()
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, `${runId}: the real static driver must reject adapter.start instead of resolving`)
    expectFragments(
      ['fairtrade adapter: driver start failed', 'field "driver"', 'at path adapter.start', 'repair:', 'caused by'],
      message,
      runId,
    )
    assert.deepEqual(observed.calls, ['start', 'reset', 'stop'], `${runId}: the real driver must see reset exactly once before stop exactly once`)
    assert.deepEqual(adapter.stats(), { stops: 1, resets: 1 }, `${runId}: the adapter must run one reset and one stop for the failed start`)
    assert.equal(driver.isRunning(), false, `${runId}: the real driver must not report a running service after the failed start`)
    assert.equal(adapter.isRunning(), false, `${runId}: the adapter must not report a running service after the failed start`)
    assert.deepEqual([...adapter.lifecycleTrace().stages], ['declared'], `${runId}: a failed start must leave the lifecycle at the declared stage`)
    assert.equal(driver.stats().stops, 0, `${runId}: the real driver never reached a running service, so its own stop must stay the idempotent no-op`)
    failureRecord = {
      message,
      calls: [...observed.calls],
      driverRoot: driver.distRoot,
      driverPort: driver.port,
    }
    const teardown = await adapter.teardown()
    assert.deepEqual(teardown, { released: true, noop: false, stops: 1 }, `${runId}: teardown after a failed start must release without repeating the stop the failure path already ran`)
    const repeat = await adapter.teardown()
    assert.deepEqual(repeat, { released: true, noop: true, stops: 1 }, `${runId}: teardown after a failed start must stay idempotent`)
    assert.deepEqual(observed.calls, ['start', 'reset', 'stop'], `${runId}: a run that never started must never ask the driver to stop again`)
    assert.equal(driver.isRunning(), false, `${runId}: the real driver must stay stopped after teardown`)
    assert.equal(adapter.isRunning(), false, `${runId}: the adapter must stay stopped after teardown`)
    assert.deepEqual([...adapter.lifecycleTrace().stages], ['declared'], `${runId}: teardown after a failed start must leave the trace at the declared stage, never a released stage behind a missing acquired stage`)
    if (squatterBound) {
      await squatter.release()
      squatterBound = false
    }
    await assertPortReleased(port)
  } finally {
    if (driver) {
      await driver.stop()
    }
    if (squatterBound) {
      await squatter.release()
    }
    rmSync(scratch, { recursive: true, force: true })
  }
  assert.equal(existsSync(failureRecord.driverRoot), false, `${runId}: the throwaway static root must be removed once the case finishes`)
  return failureRecord
}

describe('product target fixture family', () => {
  const manifest = /** @type {Record<string, unknown>} */ (coreFixtures.loadSingleDocument(manifestSource, MANIFEST_REL))
  const parsed = /** @type {Record<string, unknown>} */ (coreFixtures.loadSingleDocument(corpusSource, CORPUS_REL))

  it('holds a valid manifest inventory', () => {
    validateManifest(manifest)
  })

  it('holds exact fields and required names', () => {
    validateFamily(parsed, manifest)
  })

  it('executes every named case', async () => {
    for (const entry of /** @type {Record<string, unknown>[]} */ (parsed.cases)) {
      await runCase(entry)
    }
  })

  it('accepts a legal leading start marker as one record', () => {
    const leading = coreFixtures.loadSingleDocument(`---\n${corpusSource}`, CORPUS_REL)
    validateFamily(leading, manifest)
  })

  it('rejects a trailing record after the end marker', () => {
    let message = null
    try {
      coreFixtures.loadSingleDocument(`${corpusSource.trimEnd()}\n---\norphan: true\n`, CORPUS_REL)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, 'trailing record must fail single-record loading')
    assert.ok(message.includes('trailing'), `trailing rejection must name the trailing record; got ${message}`)
    assert.match(message, /at path.*repair:/s, 'trailing rejection must carry path and repair')
  })

  it('fails every executable mutation for its intended field', async () => {
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          coreFixtures.loadSingleDocument(`${corpusSource.trimEnd()}\n---\norphan: true\n`, CORPUS_REL)
        } else {
          const mutated = structuredClone(cases)
          applyMutation(mutated, mutation)
          await validateMutated(mutated, manifest, mutation)
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${mutation.name}: mutated input passed validation instead of failing`)
      assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${mutation.name}: diagnostic names the wrong field; got ${message}`)
      assert.ok(message.includes('at path'), `${mutation.name}: diagnostic is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `${mutation.name}: diagnostic is missing repair guidance: ${message}`)
    }
  })
})

describe('product target registry and theme rows', () => {
  it('declares exactly one product target with the real surface selectors', () => {
    assert.deepEqual(Object.keys(targets.PRODUCT_TARGET_REGISTRY), [targets.PRODUCT_TARGET_ID])
    const selected = targets.selectProductTarget(targets.PRODUCT_TARGET_ID)
    assert.equal(selected.kind, 'product')
    assert.ok(Object.isFrozen(selected), 'target record must be frozen')
    assert.deepEqual({ ...selected.selectors }, {
      // The in-use shell root the ARIA snapshot is taken from.
      shell: '#inuse',
      chrome: '.iu-bar',
      body: '.iu-view',
      // The active view excludes the permanently mounted hidden changes view,
      // so the body and view floors can never be satisfied by that sibling.
      activeView: '.iu-view > :not([hidden])',
      sectionNav: 'nav[aria-label="peasant sections"]',
      // The section-item and active-state classes the row's probes read, and
      // the nav-scoped active query assembled from them.
      sectionItem: '.iu-subnav-item',
      activeSectionItem: '.iu-subnav-item.active',
      activeSection: 'nav[aria-label="peasant sections"] .iu-subnav-item[aria-current="page"]',
      sectionView: '#inuse-stage[role="tabpanel"]',
    })
    assert.equal(selected.initialSection, 'analytics')
    // Membership, not order: PRODUCT_SECTIONS is read only through .includes()
    // (the row navigates by label and aria-current, never by index), so a
    // behavior-preserving nav reorder must not turn this red. The comparison
    // sorts both sides; adding, removing, or renaming a section id stays a
    // deliberate red that names the vocabulary.
    assert.deepEqual(
      [...selected.sections].sort(),
      ['analytics', 'changes', 'map'],
      'the section vocabulary must stay exactly analytics, changes, and map at path target.sections; repair: keep the section ids in PRODUCT_SECTIONS; their order is deliberately not pinned.',
    )
  })

  it('rejects unknown target ids with an actionable diagnostic', () => {
    assert.throws(
      () => targets.selectProductTarget('invented-target'),
      /"invented-target".*field "id".*at path target\.id.*repair:/s,
      'unknown target id must fail',
    )
  })

  it('normalizes absent and empty values to dark, light to light', () => {
    assert.equal(targets.normalizeRenderedTheme(undefined), 'dark')
    assert.equal(targets.normalizeRenderedTheme(null), 'dark')
    assert.equal(targets.normalizeRenderedTheme(''), 'dark')
    assert.equal(targets.normalizeRenderedTheme('light'), 'light')
    for (const wrong of ['dark', 'LIGHT', 'none', 0]) {
      assert.throws(
        () => targets.normalizeRenderedTheme(wrong),
        /renderedAttribute.*at path theme\.renderedAttribute.*repair:/s,
        `wrong rendered value ${JSON.stringify(wrong)} must fail`,
      )
    }
  })

  it('builds the row route per theme and rejects unknown rows', () => {
    assert.equal(targets.productRouteForTheme('dark'), '/?app=graph&fb=off&theme=none#inuse')
    assert.equal(targets.productRouteForTheme('light'), '/?app=graph&fb=off&theme=light#inuse')
    assert.throws(
      () => targets.productRouteForTheme('dusk'),
      /"dusk".*field "theme".*at path route\.theme.*repair:/s,
      'unknown row theme must fail',
    )
    assert.deepEqual(targets.productThemeRow('dark'), {
      theme: 'dark',
      route: '/?app=graph&fb=off&theme=none#inuse',
      expectedAttribute: '',
      initialSection: 'analytics',
    })
  })

  it('describes the provenance source without routes or selectors', () => {
    const source = targets.PRODUCT_PROVENANCE_SOURCE
    assert.ok(Object.isFrozen(source), 'provenance source must be frozen')
    assert.deepEqual(Object.keys(source).sort(), ['entries', 'fields', 'root', 'source'])
    const text = JSON.stringify(source)
    assert.ok(!text.includes('#inuse'), 'provenance source must not name surface selectors')
    assert.ok(!text.includes('?app='), 'provenance source must not name routes')
  })

  it('proves the declared target against the shared contract', async () => {
    const receipt = await targets.validateProductTargetContract({ createdAtMs: 1000 })
    assert.equal(receipt.kind, 'product')
    for (const required of contractTargets.PRODUCT_REQUIRED_CAPABILITIES) {
      assert.ok(receipt.capabilities.includes(required), `declared capabilities must include ${required}`)
      assert.equal(contractTargets.requiresCapability(receipt.declaration, required), true)
    }
    assert.equal(receipt.declaration.kind, 'product')
    assert.deepEqual([...receipt.declaration.actions], [targets.PRODUCT_ACTION_NAME])
  })
})

describe('product proof record schema and shared vocabulary', () => {
  it('matches the shared product-only field set with no silent extras', () => {
    const schema = targets.PRODUCT_PROOF_RECORD_SCHEMA
    assert.ok(Object.isFrozen(schema), 'proof schema must be frozen')
    assert.equal(schema.kind, 'product', 'proof schema kind must stay product')
    assert.deepEqual(
      [...schema.fields],
      ['kind', 'identity', ...contractResolution.PRODUCT_ONLY_FIELDS, 'theme'],
      'proof fields must equal the shared product record shape',
    )
    assert.deepEqual(
      [...schema.fieldsWithAction],
      ['kind', 'identity', ...contractResolution.PRODUCT_ONLY_FIELDS, 'theme', 'action'],
      'proof fields with an action must add exactly the action result',
    )
    assert.deepEqual([...schema.partFields], ['observed', 'observedAtMs'], 'proof part fields must stay exact')
    assert.deepEqual([...schema.themeFields], ['expected', 'observed', 'source', 'observedAtMs'], 'proof theme fields must stay exact')
    assert.deepEqual([...schema.actionFields], ['name', 'completed', 'observedAtMs'], 'proof action fields must stay exact')
    assert.deepEqual([...schema.identityFields], ['kind', 'id', 'createdAtMs'], 'proof identity fields must stay exact')
  })

  it('describes the row setup without project-name inference', () => {
    for (const theme of ['dark', 'light']) {
      const setup = targets.productThemeSetup(theme)
      assert.equal(targets.normalizeRenderedTheme(setup.expectedAttribute), theme, `setup attribute must normalize to ${theme}`)
    }
    assert.throws(
      () => targets.productThemeFromProjectName('product-dark'),
      /field "project".*at path theme\.project.*"product-dark".*repair:/s,
      'project-name inference must fail with the observed value and repair',
    )
  })
})

describe('verifier-facing record accessibility evidence', () => {
  /**
   * Build the two scan scopes and the two gate receipts a real row measures:
   * a clean gated scope before the action, one declared-baseline violation
   * after it, and a page-wide population carrying a serious violation the
   * gate never sees. Shared by the reader wiring proofs in this family.
   * @param {object} [input] receipt overrides
   * @param {string} [input.gateAfterResult] after-action gate result
   * @returns {object} producer accessibility inputs
   */
  function producerAccessibilityInputs({ gateAfterResult = 'pass' } = {}) {
    const tags = ['wcag2a', 'wcag2aa']
    return {
      pageWide: {
        tags,
        violations: [
          { id: 'color-contrast', impact: 'serious', nodes: [['nav']] },
          { id: 'link-name', impact: 'minor', nodes: [['a']] },
        ],
        incomplete: ['color-contrast'],
        passes: 120,
      },
      scopedBefore: { tags, violations: [], incomplete: [], passes: 41 },
      scopedAfter: {
        tags,
        violations: [{ id: 'aria-required-children', impact: 'critical', nodes: [['g'], ['g'], ['g']] }],
        incomplete: [],
        passes: 38,
      },
      gateBefore: { policy: targets.PRODUCT_A11Y_POLICY, point: 'initial', observedSection: targets.PRODUCT_A11Y_POINT_LABELS.initial, result: 'pass', measured: 0, baseline: 0 },
      gateAfter: { policy: targets.PRODUCT_A11Y_POLICY, point: 'after-action', observedSection: targets.PRODUCT_A11Y_POINT_LABELS['after-action'], result: gateAfterResult, measured: 1, baseline: 1 },
    }
  }

  it('keeps the page-wide census nested and marked informational', () => {
    const record = buildProductAccessibilityEvidence(producerAccessibilityInputs())
    assert.deepEqual(Object.keys(record).sort(), [...PRODUCT_A11Y_RECORD_FIELDS].sort(), 'the record block must carry exactly the declared fields')
    assert.equal(record.gatedScope, 'product-view', 'the gated scope must be named explicitly')
    assert.equal(record.scopeRoot, targets.PRODUCT_A11Y_SCOPE_ROOT, 'the gate scope root must be the registry section view')
    assert.equal(record.pageWide.informational, true, 'the page-wide census must be marked informational')
    assert.equal(record.pageWide.scope, 'page', 'the page-wide census must name its own scope')
    assert.equal(record.pageWide.root, 'document', 'the page-wide census must name its own root')
    assert.equal(record.pageWide.blocking, 1, 'the page-wide census reports the serious-or-worse population')
    assert.deepEqual(Object.keys(record.gate).sort(), [...PRODUCT_A11Y_GATE_POINTS].sort(), 'the gate must carry one receipt per observation point')
    assert.equal(record.blocking, undefined, 'an unqualified blocking count must not sit beside the gate receipts')
    assert.equal(record.violations, undefined, 'an unqualified violations count must not sit beside the gate receipts')
    assert.deepEqual(Object.keys(record.pageWide).sort(), [...PRODUCT_A11Y_PAGE_WIDE_FIELDS].sort(), 'the page-wide block must carry exactly the declared fields')
  })

  it('reads the verdict from the gate receipts and not from the page-wide counts', () => {
    const passing = buildProductAccessibilityEvidence(producerAccessibilityInputs())
    const verdict = readProductAccessibilityVerdict(passing)
    assert.equal(verdict.result, 'pass', 'two passing gate receipts read as a pass')
    assert.equal(verdict.gatedScope, 'product-view', 'the verdict must stay attributed to the gated scope')

    const churned = buildProductAccessibilityEvidence({
      ...producerAccessibilityInputs(),
      pageWide: { ...passing.pageWide, violations: [], blocking: 0, blockingIds: [], incomplete: [], passes: 9 },
    })
    assert.equal(readProductAccessibilityVerdict(churned).result, 'pass', 'churning the informational counts must not move the verdict')

    const failing = buildProductAccessibilityEvidence(producerAccessibilityInputs({ gateAfterResult: 'fail' }))
    assert.equal(readProductAccessibilityVerdict(failing).result, 'fail', 'a failing gate receipt must read as a fail')
    const failingQuiet = buildProductAccessibilityEvidence({
      ...producerAccessibilityInputs({ gateAfterResult: 'fail' }),
      pageWide: { ...passing.pageWide, violations: [], blocking: 0, blockingIds: [], incomplete: [], passes: 9 },
    })
    assert.equal(readProductAccessibilityVerdict(failingQuiet).result, 'fail', 'a silent page-wide census must not rescue a failing gate')
  })

  it('refuses an ambiguous record carrying unqualified page-wide counts', () => {
    const record = buildProductAccessibilityEvidence(producerAccessibilityInputs())
    for (const field of PRODUCT_A11Y_PAGE_WIDE_FIELDS) {
      const ambiguous = { ...record, [field]: record.pageWide[field] }
      assert.throws(
        () => readProductAccessibilityVerdict(ambiguous),
        new RegExp(`unknown field ${JSON.stringify(field)}.*at path record\\.accessibility.*repair:`, 's'),
        `an unqualified ${field} must be refused instead of read as a verdict input`,
      )
    }
  })

  it('refuses a record that drops the gate receipts or the informational marker', () => {
    const record = buildProductAccessibilityEvidence(producerAccessibilityInputs())
    for (const field of ['gatedScope', 'scopeRoot', 'scopedBefore', 'scopedAfter', 'gate', 'pageWide']) {
      const { [field]: dropped, ...rest } = record
      assert.throws(
        () => readProductAccessibilityVerdict(rest),
        new RegExp(`missing required field ${JSON.stringify(field)}.*at path record\\.accessibility.*repair:`, 's'),
        `a record without ${field} must be refused`,
      )
    }
    assert.throws(
      () => readProductAccessibilityVerdict({ ...record, pageWide: { ...record.pageWide, informational: false } }),
      /informational.*at path record\.accessibility\.pageWide\.informational.*repair:/s,
      'an unmarked page-wide census must be refused',
    )
  })

  it('refuses a record that mislabels its gated population', () => {
    const record = buildProductAccessibilityEvidence(producerAccessibilityInputs())
    assert.throws(
      () => readProductAccessibilityVerdict({ ...record, gatedScope: 'page' }),
      /mislabeled gated scope "page".*at path record\.accessibility\.gatedScope.*"product-view".*repair:/s,
      'a page-wide gated scope must be refused instead of read as the gated product view',
    )
    assert.throws(
      () => readProductAccessibilityVerdict({ ...record, scopeRoot: 'body' }),
      /mislabeled scope root "body".*at path record\.accessibility\.scopeRoot.*inuse-stage.*repair:/s,
      'a foreign scope root must be refused',
    )
  })

  it('refuses a foreign gate receipt or one measured at the wrong point', () => {
    const record = buildProductAccessibilityEvidence(producerAccessibilityInputs())
    assert.throws(
      () => readProductAccessibilityVerdict({
        ...record,
        gate: { ...record.gate, after: { ...record.gate.after, policy: 'page-wide-baseline-delta' } },
      }),
      /foreign gate receipt policy.*at path record\.accessibility\.gate\.after\.policy.*repair:/s,
      'a receipt from another policy must be refused',
    )
    assert.throws(
      () => readProductAccessibilityVerdict({
        ...record,
        gate: { ...record.gate, before: { ...record.gate.before, point: 'after-action' } },
      }),
      /mismatched gate observation point.*at path record\.accessibility\.gate\.before\.observedSection.*repair:/s,
      'a receipt claiming the wrong observation point must be refused',
    )
    // The section the page actually showed is the value that can contradict the
    // point a receipt claims, so a receipt handed the other slot's scan is the
    // refusal that matters: the point name still matches its own slot here.
    assert.throws(
      () => readProductAccessibilityVerdict({
        ...record,
        gate: { ...record.gate, after: { ...record.gate.after, observedSection: targets.PRODUCT_INITIAL_SECTION } },
      }),
      /mismatched gate observation point.*at path record\.accessibility\.gate\.after\.observedSection.*observed as "analytics".*repair:/s,
      'a receipt whose observed section belongs to the other slot must be refused',
    )
  })

  it('refuses a scoped count that contradicts the gate receipt beside it', () => {
    const record = buildProductAccessibilityEvidence(producerAccessibilityInputs())
    assert.throws(
      () => readProductAccessibilityVerdict({
        ...record,
        scopedAfter: { ...record.scopedAfter, violations: 0, ids: [] },
      }),
      /contradicts the gate receipt.*at path record\.accessibility\.scopedAfter\.violations.*record\.accessibility\.gate\.after\.measured recorded 1.*repair:/s,
      'a scoped count disagreeing with its own gate receipt must be refused',
    )
    // The declared receipts from the real gate carry exactly the fields the
    // reader consumes, so a healthy record stays readable end to end.
    const verdict = readProductAccessibilityVerdict(record)
    assert.equal(verdict.result, 'pass')
    assert.deepEqual(
      Object.keys(record.gate.after).sort(),
      [...targets.PRODUCT_A11Y_GATE_RECEIPT_FIELDS].sort(),
      'the assembled receipt must carry the declared field set the reader consumes',
    )
  })
})

describe('product row observation times', () => {
  it('accepts one real reading shared by the pre-action parts in observation order', () => {
    assert.doesNotThrow(() => assertProductObservationTimes({
      rowStartedAtMs: 1790353572800,
      chrome: 1790353589111,
      body: 1790353589111,
      route: 1790353589111,
      theme: 1790353589111,
      action: 1790353590386,
    }), 'a real reading shared by one evaluate must pass')
  })

  it('refuses the assembly-order offsets the row used to synthesize', () => {
    assert.throws(
      () => assertProductObservationTimes({
        rowStartedAtMs: 1790353572800,
        chrome: 1790353572800,
        body: 1790353572801,
        route: 1790353572802,
        theme: 1790353589115,
        action: 1790353590386,
      }),
      /claims its own observation time.*at path resolution\.body\.observedAtMs.*per-part offsets/s,
      'per-part offsets off the row start must be refused',
    )
    assert.throws(
      () => assertProductObservationTimes({
        rowStartedAtMs: 1790353572800,
        chrome: 1790353572800,
        body: 1790353572800,
        route: 1790353572800,
        theme: 1790353589115,
        action: 1790353590386,
      }),
      /row start.*at path resolution\.chrome\.observedAtMs.*repair:/s,
      'a part claiming the row start as its observation time must be refused',
    )
  })

  it('refuses readings that run backwards through the row sequence', () => {
    for (const [later, earlier] of [['theme', 'chrome'], ['action', 'theme']]) {
      const times = {
        rowStartedAtMs: 1790353572800,
        chrome: 1790353589111,
        body: 1790353589111,
        route: 1790353589111,
        theme: 1790353589115,
        action: 1790353590386,
        [later]: 1790353580000,
      }
      assert.throws(
        () => assertProductObservationTimes(times),
        new RegExp(`precedes the ${JSON.stringify(earlier)} observation.*at path resolution\\.${later}\\.observedAtMs.*repair:`, 's'),
        `a ${later} reading before the ${earlier} reading must be refused`,
      )
    }
    assert.throws(
      () => assertProductObservationTimes({ rowStartedAtMs: 1, chrome: 'later', body: 2, route: 2, theme: 3, action: 4 }),
      /invalid observation time.*at path producer\.observationTimes\.chrome.*repair:/s,
      'a non-integer reading must be refused',
    )
  })
})

describe('journey compatibility and import resolution', () => {
  it('keeps the assertion surface intact for existing consumers', async () => {
    const assertions = await import('../journey/lib/assertions.mjs')
    assert.deepEqual(assertions.DEFAULT_AXE_TAGS, ['wcag2a', 'wcag2aa'], 'axe tags must stay pinned')
    assert.equal(typeof assertions.scanAxe, 'function', 'scanAxe must stay exported')
    assert.equal(typeof assertions.seriousViolations, 'function', 'seriousViolations must stay exported')
    assert.equal(typeof assertions.expectTheme, 'function', 'expectTheme must stay exported')
    assert.equal(typeof assertions.expectComputedTokens, 'function', 'expectComputedTokens must stay exported')
    assert.ok(Object.isFrozen(assertions.AXE_RESULT_FIELDS), 'the declared axe result shape must stay frozen')
    assert.deepEqual(
      [...assertions.AXE_RESULT_FIELDS],
      ['tags', 'violations', 'incomplete', 'passes'],
      'the declared axe result shape must cover exactly the compact report the producer writes into its artifact',
    )
    assert.deepEqual(
      assertions.seriousViolations({ violations: [{ impact: 'critical' }, { impact: 'minor' }] }).map((entry) => entry.impact),
      ['critical'],
      'serious violations must still filter critical and serious impact only',
    )
  })

  it('resolves the existing journey module graph without consumer edits', () => {
    const files = [
      'scripts/journey/lib/assertions.mjs',
      'scripts/journey/lib/fixtures.mjs',
      'scripts/journey/lib/determinism.mjs',
      'scripts/journey/lib/determinism-constants.mjs',
      'scripts/journey/app-validate.journey.mjs',
      'scripts/journey/session-group-disclosure.journey.mjs',
      'scripts/journey/storybook-smoke.journey.mjs',
      'scripts/fairtest/fairtrade-targets.mjs',
      'scripts/fairtest/fairtrade-adapter.mjs',
      'scripts/fairtest/fairtest-runtime.mjs',
      'scripts/fairtest/product-producer.mjs',
      'scripts/fairtest/product.journey.mjs',
      'scripts/fairtest/product-mutations.mjs',
      'scripts/fairtest/product-mutations.test.mjs',
      'scripts/fairtest/run-mounted.mjs',
      'playwright.fairtest.config.mjs',
    ]
    for (const file of files) {
      execFileSync('node', ['--check', file], { cwd: ROOT, stdio: 'pipe' })
    }
  })
})

describe('shared journey theme assertion contract', () => {
  /**
   * Build a fake page whose rendered theme settles after a bounded number
   * of reads, modelling a consumer theme toggle that writes data-theme
   * asynchronously after the click.
   * @param {object} [input] settling behavior
   */
  function fakeSettlingThemePage({ darkReads = 3, settledValue = 'light' } = {}) {
    let calls = 0
    return {
      calls: () => calls,
      locator: (selector) => ({
        getAttribute: async (attributeName) => {
          assert.equal(selector, 'html', 'assertion must read the root element')
          assert.equal(attributeName, 'data-theme', 'assertion must read the rendered theme attribute')
          calls += 1
          await new Promise((resolve) => setTimeout(resolve, 5))
          return calls <= darkReads ? null : settledValue
        },
      }),
    }
  }

  it('carries no app-owned rendered-value rule of its own', () => {
    const shared = readFileSync(resolve(HERE, '..', 'journey', 'lib', 'assertions.mjs'), 'utf8')
    assert.ok(!shared.includes('normalizeRenderedTheme'), 'the vendored helper must not own the app rendered-theme rule')
    assert.ok(!shared.includes('observeProductTheme'), 'the vendored helper must not own the app theme observation')
    assert.ok(!shared.includes('fairtrade'), 'the vendored helper must not name a fairtrade-owned module')
    const specifiers = [...shared.matchAll(/from\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
    assert.deepEqual(specifiers, ['@playwright/test', '@axe-core/playwright'], 'the vendored helper must declare only its two dependencies')
    // The attribute contract a consumer renders is passed through verbatim, so
    // a server-rendered data-theme="dark" default still satisfies a dark row.
    assert.match(shared, /toHaveAttribute\('data-theme', theme\)/, 'the vendored helper must assert the rendered attribute value verbatim')
  })

  it('keeps the app-owned rendered-value rule on the product target contract', { timeout: 10000 }, async () => {
    const page = fakeSettlingThemePage({ darkReads: 3, settledValue: 'light' })
    await expectProductTheme(page, 'light')
    assert.ok(page.calls() > 3, `the product theme observation must re-read until the value settles; got ${page.calls()} read(s)`)
    assert.equal(targets.normalizeRenderedTheme(undefined), 'dark')
    assert.equal(targets.normalizeRenderedTheme(null), 'dark')
    assert.equal(targets.normalizeRenderedTheme(''), 'dark')
    assert.equal(targets.normalizeRenderedTheme('light'), 'light')
    assert.throws(() => targets.normalizeRenderedTheme('dark'), /unexpected rendered theme "dark".*at path.*repair:/s)
  })
})

describe('product adapter lifecycle with a fake driver', () => {
  it('runs reset before stop on partial start failure and leaves no service', async () => {
    const driver = createFakeDriver({ failStart: true })
    const adapter = await createFairtradeAdapter({ runId: 'adapter-probe-1', driver, createdAtMs: 1000 })
    await assert.rejects(() => adapter.start(), /driver start failed.*field "driver".*at path adapter\.start.*repair:/s)
    assert.equal(driver.calls.resets, 1, 'partial start must reset once')
    assert.equal(driver.calls.stops, 1, 'partial start must stop once')
    assert.equal(adapter.isRunning(), false, 'no service may remain after failure')
    assert.equal(adapter.stats().resets, 1)
    assert.equal(adapter.stats().stops, 1)
    const trace = adapter.lifecycleTrace()
    assert.deepEqual([...trace.stages], ['declared'])
    await adapter.teardown()
    assert.equal(adapter.isRunning(), false)
  })

  it('cleans reset before stop on the timeout path', async () => {
    const driver = createFakeDriver({ hangStart: true })
    const adapter = await createFairtradeAdapter({ runId: 'adapter-probe-2', driver, createdAtMs: 1000 })
    await assert.rejects(() => adapter.start({ timeoutMs: 25 }), /timed out.*field "timeoutMs".*at path adapter\.start.*repair:/s)
    assert.equal(driver.calls.resets, 1, 'timed-out start must reset once')
    assert.equal(driver.calls.stops, 1, 'timed-out start must stop once')
    assert.equal(adapter.isRunning(), false, 'no service may remain after a timeout')
  })

  it('marks ready once and tears down idempotently with exactly one stop', async () => {
    const driver = createFakeDriver()
    const adapter = await createFairtradeAdapter({ runId: 'adapter-probe-3', driver, createdAtMs: 1000 })
    const started = await adapter.start()
    assert.equal(started.started, true)
    assert.deepEqual([...adapter.lifecycleTrace().stages], ['declared', 'acquired'])
    const ready = await adapter.readiness()
    assert.equal(ready.ready, true)
    assert.deepEqual([...adapter.lifecycleTrace().stages], ['declared', 'acquired', 'ready'])
    const first = await adapter.teardown()
    assert.deepEqual(first, { released: true, noop: false, stops: 1 })
    const second = await adapter.teardown()
    assert.deepEqual(second, { released: true, noop: true, stops: 1 })
    assert.equal(driver.calls.stops, 1, 'idempotent teardown must stop exactly once')
    const trace = adapter.lifecycleTrace()
    assert.deepEqual([...trace.stages], ['declared', 'acquired', 'ready', 'released'])
  })

  it('still releases handles and records release when stop fails', async () => {
    const driver = createFakeDriver({ failStop: true })
    const adapter = await createFairtradeAdapter({ runId: 'adapter-probe-4', driver, createdAtMs: 1000 })
    await adapter.start()
    await adapter.readiness()
    const handle = adapter.mintHandle()
    await assert.rejects(() => adapter.teardown(), /fake stop failed/)
    assert.throws(
      () => adapter.requireHandle(handle),
      /revoked.*field "revoked".*at path handle\.revoked.*repair:/s,
      'teardown must revoke handles even when stop fails',
    )
    const second = await adapter.teardown()
    assert.equal(second.noop, true, 'release is recorded despite the stop failure')
    assert.deepEqual([...adapter.lifecycleTrace().stages], ['declared', 'acquired', 'ready', 'released'])
  })

  it('rejects unknown actions and capabilities with actionable diagnostics', async () => {
    const driver = createFakeDriver()
    const adapter = await createFairtradeAdapter({ runId: 'adapter-probe-5', driver, createdAtMs: 1000 })
    await adapter.start()
    await assert.rejects(
      () => adapter.performAction('select-changes-section'),
      /"select-changes-section".*field "action".*at path adapter\.action.*repair:/s,
      'unknown action must fail',
    )
    const result = await adapter.performAction(targets.PRODUCT_ACTION_NAME, { observedAtMs: 2000 })
    assert.deepEqual(result, { name: targets.PRODUCT_ACTION_NAME, completed: true, observedAtMs: 2000 })
    await assert.rejects(
      () => createFairtradeAdapter({
        runId: 'adapter-probe-6',
        driver: createFakeDriver(),
        createdAtMs: 1000,
        capabilities: [...contractTargets.PRODUCT_REQUIRED_CAPABILITIES, 'observe-screenshot'],
      }),
      /"observe-screenshot".*at path adapter\.capabilities.*repair:/s,
      'unknown capability must fail',
    )
    await adapter.teardown()
  })

  it('enforces exact opaque handle membership and revocation', async () => {
    const driver = createFakeDriver()
    const adapter = await createFairtradeAdapter({ runId: 'adapter-probe-7', driver, createdAtMs: 1000 })
    await adapter.start()
    const handle = adapter.mintHandle()
    assert.ok(Object.isFrozen(handle), 'minted handle must be frozen')
    assert.deepEqual(adapter.requireHandle(handle), handle)
    assert.throws(
      () => adapter.requireHandle({ token: 'other-run-handle-1', revoked: false }),
      /"other-run-handle-1".*field "token".*at path handle\.token.*repair:/s,
      'a handle from another run must fail membership',
    )
    assert.throws(
      () => adapter.requireHandle({ token: 'bad token!', revoked: false }),
      /token.*at path handle\.token.*repair:/s,
      'an unsafe token must fail shape validation',
    )
    await adapter.teardown()
    assert.throws(
      () => adapter.requireHandle(handle),
      /revoked.*field "revoked".*at path handle\.revoked.*repair:/s,
      'a revoked handle must stay unusable',
    )
  })
})

describe('fairtest host export ownership', async () => {
  const hostManifest = /** @type {Record<string, unknown>} */ (coreFixtures.loadSingleDocument(readFileSync(resolve(ROOT, HOST_MANIFEST_REL), 'utf8'), HOST_MANIFEST_REL))
  const hostParsed = /** @type {Record<string, unknown>} */ (coreFixtures.loadSingleDocument(readFileSync(resolve(ROOT, HOST_CORPUS_REL), 'utf8'), HOST_CORPUS_REL))
  // The guarded module set is DERIVED, not hand-maintained: the ownership
  // rows are the single declaration of which files are host modules, and the
  // directory-closure case below fails any scripts/fairtest/*.mjs module that
  // is neither classified here nor on the declared unclassified list. A new
  // host module — for example the component producer the config header
  // anticipates — therefore has to declare an owner before every gate is
  // green again, rather than sitting silently ungoverned.
  const hostFiles = [...new Set(hostParsed.exports.map((entry) => String(entry.file)))].sort()
  const directoryModules = readdirSync(HERE).filter((name) => name.endsWith('.mjs')).sort()
  const declaredUnclassifiedFiles = Object.freeze([
    'product-adapter.test.mjs',
    'product-mutations.test.mjs',
    'component-adapter.test.mjs',
    'component-mutations.test.mjs',
    'product.journey.mjs',
    'component.journey.mjs',
    'run-mounted.mjs',
    'run-product-contract.mjs',
    'verify-fairtest.mjs',
    'fairtest-evidence-policy.mjs',
    'run-envelope-contract.mjs',
    'init-fairtest.mjs',
    'list-fairtest.mjs',
    'select-fairtest.mjs',
    'selection-receipt.mjs',
    'preflight-fairtest.mjs',
    'run-envelope.test.mjs',
  ])
  const hostModules = {}
  for (const file of hostFiles) {
    hostModules[file] = await import(pathToFileURL(resolve(HERE, file)).href)
  }

  /**
   * Validate the host manifest: exact keys, a required-name inventory that is
   * unique and matches the declared count, and mutation records whose kind,
   * target, and field are all declared.
   * @param {Record<string, unknown>} manifest parsed manifest
   */
  function validateHostManifest(manifest) {
    coreFixtures.checkKeys(manifest, ['expectedExportCount', 'requiredExportNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'host manifest record', HOST_MANIFEST_REL, 'manifest')
    const names = /** @type {string[]} */ (manifest.requiredExportNames)
    const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
    assert.equal(new Set(names).size, names.length, `${HOST_MANIFEST_REL}: required export names must be unique at path manifest.requiredExportNames; repair: list every classified export once.`)
    assert.equal(manifest.expectedExportCount, names.length, `${HOST_MANIFEST_REL}: export count must equal the required-name inventory at path manifest.expectedExportCount; repair: align expectedExportCount with requiredExportNames.`)
    assert.equal(manifest.expectedMutationCount, mutations.length, `${HOST_MANIFEST_REL}: mutation count must equal the mutation inventory at path manifest.expectedMutationCount; repair: align expectedMutationCount with mutations.`)
    coreFixtures.checkRequiredNames(mutations.map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredMutationNames), HOST_MANIFEST_REL)
    for (const [index, mutation] of mutations.entries()) {
      const fields = ['name', 'kind', 'target', 'expectedField']
      if (['delete-field', 'unknown-field', 'bad-value'].includes(String(mutation.kind))) fields.push('field')
      if (mutation.kind === 'rename-field') fields.push('field', 'newField')
      if (['unknown-field', 'bad-value'].includes(String(mutation.kind))) fields.push('value')
      coreFixtures.checkKeys(mutation, fields, 'host mutation record', HOST_MANIFEST_REL, `manifest.mutations[${index}]`)
      assert.ok(HOST_MUTATION_KINDS.has(String(mutation.kind)), `${HOST_MANIFEST_REL}: mutation ${index} names an unknown kind at path manifest.mutations[${index}].kind; repair: use one of ${[...HOST_MUTATION_KINDS].join(', ')}.`)
      assert.ok(names.includes(String(mutation.target)), `${HOST_MANIFEST_REL}: mutation ${index} targets an unknown row at path manifest.mutations[${index}].target; repair: target one of the required export rows.`)
    }
  }

  /**
   * The live export set of one host module, read from the module namespace
   * rather than from a text pattern, so a re-export or a renamed symbol is
   * seen exactly as a consumer would see it.
   * @param {string} file host module file name
   * @returns {string[]} the sorted export names
   */
  function liveExports(file) {
    return Object.keys(hostModules[file]).sort()
  }

  /**
   * Check one ownership row against the live modules and against the owning
   * class's real restriction, so a row cannot claim an owner whose rules the
   * file breaks.
   * @param {Record<string, unknown>} entry ownership row
   */
  function checkHostOwnershipRow(entry) {
    const name = String(entry.name)
    const file = String(entry.file)
    const symbol = String(entry.symbol)
    const owner = String(entry.owner)
    if (!HOST_OWNERS.includes(owner)) {
      throw new Error(`${HOST_CORPUS_REL}: row "${name}" names an unknown owner ${JSON.stringify(owner)} at path owner; repair: use one of ${HOST_OWNERS.join(', ')} for "owner".`)
    }
    if (!HOST_FILE_OWNERS[file]) {
      throw new Error(`${HOST_CORPUS_REL}: row "${name}" names a file outside the host modules ${JSON.stringify(file)} at path file; repair: classify a module under scripts/fairtest/ for "file".`)
    }
    if (!liveExports(file).includes(symbol)) {
      // Name the field that is actually wrong: a row that points a real export
      // at the wrong module is a `file` mistake, and a row that names a symbol
      // nobody exports is a `symbol` mistake.
      const elsewhere = hostFiles.filter((other) => other !== file && liveExports(other).includes(symbol))
      if (elsewhere.length > 0) {
        throw new Error(`${HOST_CORPUS_REL}: row "${name}" names ${JSON.stringify(symbol)} in ${JSON.stringify(file)} at path file; repair: it is exported by ${elsewhere.map((other) => JSON.stringify(other)).join(', ')}, so point "file" there.`)
      }
      throw new Error(`${HOST_CORPUS_REL}: row "${name}" names an unexported symbol ${JSON.stringify(symbol)} at path symbol; repair: classify an actually exported symbol, or delete the export from ${file} if nothing consumes it.`)
    }
    if (owner !== HOST_FILE_OWNERS[file]) {
      throw new Error(`${HOST_CORPUS_REL}: row "${name}" assigns ${JSON.stringify(symbol)} from ${JSON.stringify(file)} to ${JSON.stringify(owner)} at path owner; repair: ${file} is owned by ${JSON.stringify(HOST_FILE_OWNERS[file])}; the app/host split is decided per module, not per symbol.`)
    }
    const source = readFileSync(resolve(HERE, file), 'utf8')
    const code = stripComments(source)
    if (owner === 'browser-bearing-host-runtime') {
      // These two MAY drive a page. What they may not do is own app structure
      // or a runtime value: the registry, the viewport, and the scratch ports
      // all have an owner, and a second declaration is a value production code
      // does not read.
      assertNoAppStructureLiterals(source, file)
      // The render viewport is evidence-bearing, so no host module may declare
      // its own; the host module that opens throwaway listeners must also take
      // those ports from the same owner.
      assert.ok(
        /from '\.\/fairtest-runtime\.mjs'/.test(source),
        `${HOST_CORPUS_REL}: row "${name}" has ${file} outside the runtime constant owner at path owner; repair: read the render viewport from fairtest-runtime.mjs instead of declaring it here.`,
      )
      // Reading the owner and declaring a local value of the same name are
      // different acts, so the check is on the DECLARATION, not on the name:
      // an import that is then shadowed by a local object is a second owner.
      assert.equal(
        /\b(?:const|let|var)\s+PRODUCT_VIEWPORT\b/.exec(code),
        null,
        `${HOST_CORPUS_REL}: row "${name}" has ${file} declaring its own render viewport at path owner; repair: read PRODUCT_VIEWPORT from fairtest-runtime.mjs instead of declaring it here.`,
      )
      assert.ok(
        /PRODUCT_VIEWPORT/.test(code.replace(/^import[^\n]*$/gm, '')),
        `${HOST_CORPUS_REL}: row "${name}" has ${file} not reading the shared render viewport at path owner; repair: render every product surface at PRODUCT_VIEWPORT.`,
      )
      // No suite may hold a port literal at all. Checking the call is not
      // enough: one suite that still calls the owner for three of its four
      // listeners can declare the fourth beside it, and the collision then
      // shows up as an unrelated case losing its listener.
      assert.equal(
        /\bport\s*[:=]\s*\d/.exec(code),
        null,
        `${HOST_CORPUS_REL}: row "${name}" has ${file} declaring a loopback port literal at path owner; repair: take every port from FAIRTEST_APP_PORT or claimScratchPort in fairtest-runtime.mjs, never a number.`,
      )
      // The scratch-port rule is DERIVED, not a hand list: any browser-bearing
      // host module that references the runtime's scratch-port API must take
      // its ports through claimScratchPort, the binding call. A module that
      // never touches the API needs nothing, so a new host module is covered
      // the moment it starts using throwaway listeners.
      if (/claimScratchPort|fairtestScratchPort|FAIRTEST_SCRATCH_PORT_BASE|FAIRTEST_SCRATCH_PURPOSES/.test(code)) {
        assert.ok(
          /claimScratchPort\(/.test(source),
          `${HOST_CORPUS_REL}: row "${name}" has ${file} declaring a scratch port of its own at path owner; repair: take every throwaway loopback port from claimScratchPort in fairtest-runtime.mjs.`,
        )
      }
      assert.ok(
        /from '\.\/fairtrade-targets\.mjs'/.test(source) && /productRouteForTheme|PRODUCT_SELECTORS/.test(source)
          || /from '\.\/fairtrade-component-target\.mjs'/.test(source) && /componentStoryUrl|COMPONENT_SELECTORS/.test(source),
        `${HOST_CORPUS_REL}: row "${name}" has ${file} outside the app-owned registry at path owner; repair: take the route/URL and selectors from fairtrade-targets.mjs or fairtrade-component-target.mjs.`,
      )
      return
    }
    // The app-owned layers and the constant owner: no browser, DOM, or runner
    // material may appear in their executable code, checked here per row so
    // the boundary is enforced by the inventory rather than by a sibling case
    // that could be skipped.
    assertHostOwnerTokens(source, file, name, owner)
    if (owner === 'runtime-constants-owner') {
      for (const spec of [...source.matchAll(/from\s*'([^']+)'/g)].map((match) => match[1])) {
        assert.ok(spec.startsWith('node:'), `${HOST_CORPUS_REL}: row "${name}" has ${file} importing ${JSON.stringify(spec)} at path owner; repair: the constant owner imports node builtins only, never another host module.`)
      }
    }
  }

  it('holds a valid host-ownership manifest inventory', () => {
    validateHostManifest(hostManifest)
  })

  it('classifies every host export with no unclassified row and no phantom row', () => {
    coreFixtures.checkKeys(hostParsed, ['expectedExportCount', 'exports'], 'host corpus record', HOST_CORPUS_REL, 'record')
    const rows = /** @type {Record<string, unknown>[]} */ (hostParsed.exports)
    assert.ok(Array.isArray(rows) && rows.length > 0, `${HOST_CORPUS_REL}: record holds no rows at path exports; repair: restore the classified export rows.`)
    assert.equal(rows.length, hostManifest.expectedExportCount, `${HOST_CORPUS_REL}: row count must match the manifest at path expectedExportCount; repair: align the exports list with the manifest.`)
    assert.equal(rows.length, hostParsed.expectedExportCount, `${HOST_CORPUS_REL}: row count must match the record's own declared expectedExportCount at path expectedExportCount; repair: align the declared count with the exports list.`)
    coreFixtures.checkRequiredNames(rows.map((entry) => String(entry.name)), /** @type {string[]} */ (hostManifest.requiredExportNames), HOST_CORPUS_REL)
    for (const entry of rows) {
      coreFixtures.checkKeys(entry, ['name', 'file', 'symbol', 'owner'], 'host ownership row', HOST_CORPUS_REL, `exports.${String(entry.name)}`)
    }
    // The inventory is the export set: no module export may be unclassified and
    // no row may name something a module does not export.
    const live = hostFiles.flatMap((file) => liveExports(file).map((symbol) => `${file}:${symbol}`)).sort()
    const declared = rows.map((entry) => `${String(entry.file)}:${String(entry.symbol)}`).sort()
    assert.deepEqual(declared, live, `${HOST_CORPUS_REL}: the classified rows do not equal the live export set at path exports; repair: classify every export of ${hostFiles.join(', ')} exactly once and delete rows for symbols that no longer exist.`)
  })

  it('enforces each owner class against the real host sources', () => {
    for (const entry of /** @type {Record<string, unknown>[]} */ (hostParsed.exports)) {
      checkHostOwnershipRow(entry)
    }
  })

  it('fails every host-ownership mutation for its intended field', () => {
    const mutations = /** @type {Record<string, unknown>[]} */ (hostManifest.mutations)
    for (const mutation of mutations) {
      const rows = structuredClone(/** @type {Record<string, unknown>[]} */ (hostParsed.exports))
      let message = null
      try {
        applyHostMutation(rows, mutation)
        for (const entry of rows) {
          coreFixtures.checkKeys(entry, ['name', 'file', 'symbol', 'owner'], 'host ownership row', HOST_CORPUS_REL, `exports.${String(entry.name)}`)
        }
        coreFixtures.checkRequiredNames(rows.map((entry) => String(entry.name)), /** @type {string[]} */ (hostManifest.requiredExportNames), HOST_CORPUS_REL)
        for (const entry of rows) {
          checkHostOwnershipRow(entry)
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${String(mutation.name)}: mutated host inventory passed instead of failing`)
      assert.ok(message.includes(String(mutation.expectedField)), `${String(mutation.name)}: diagnostic names the wrong field; expected ${String(mutation.expectedField)}, received ${message}`)
    }
  })

  it('resolves every host module with node --check', () => {
    for (const file of hostFiles) {
      const result = spawnSync(process.execPath, ['--check', resolve(HERE, file)], { encoding: 'utf8' })
      assert.equal(result.status, 0, `host module ${file} does not parse:\n${result.stderr || ''}`)
    }
  })

  it('requires every module in the directory to be classified or declared unclassified', () => {
    // The guarded set is closed in both directions: a module on disk that no
    // row classifies and no declared list names is ungoverned, and a declared
    // name that the directory no longer holds is a stale declaration. Either
    // way the repair names the file.
    assert.ok(directoryModules.length > 0, `${HOST_CORPUS_REL}: no modules found under scripts/fairtest/ at path directory; repair: run this guard from a checkout that holds the host modules.`)
    const unclassified = directoryModules.filter((file) => !hostFiles.includes(file) && !declaredUnclassifiedFiles.includes(file))
    assert.deepEqual(
      unclassified,
      [],
      `${HOST_CORPUS_REL}: module ${JSON.stringify(unclassified[0])} under scripts/fairtest/ is neither classified by an ownership row nor declared unclassified at path exports; repair: add ownership rows for ${JSON.stringify(unclassified[0])} or record it on the declared unclassified list, never leave a host module ungoverned.`,
    )
    const phantom = declaredUnclassifiedFiles.filter((file) => !directoryModules.includes(file))
    assert.deepEqual(
      phantom,
      [],
      `${HOST_CORPUS_REL}: declared unclassified module ${JSON.stringify(phantom[0])} does not exist under scripts/fairtest/ at path exports; repair: drop the stale declared name or restore the module.`,
    )
    for (const file of hostFiles) {
      assert.ok(
        directoryModules.includes(file),
        `${HOST_CORPUS_REL}: ownership rows classify ${JSON.stringify(file)} but the directory does not hold it at path exports; repair: delete the rows for the removed module or restore the module.`,
      )
      assert.ok(
        HOST_FILE_OWNERS[file],
        `${HOST_CORPUS_REL}: classified module ${JSON.stringify(file)} has no declared owner at path exports; repair: record the module's owner class in HOST_FILE_OWNERS.`,
      )
    }
  })

  it('keeps the contract suites themselves free of port literals', async () => {
    // The no-port-literal ownership rule cannot stop at the host modules: the
    // test files run in the same node --test invocation and could hold the
    // same second declaration. The suite list comes from the declared command
    // graph, so a suite the contract command runs is covered the moment it is
    // declared there.
    const contract = await import('./run-product-contract.mjs')
    for (const file of contract.PRODUCT_CONTRACT_SUITES) {
      const code = stripComments(readFileSync(resolve(ROOT, file), 'utf8'))
      assert.equal(
        /\bport\s*[:=]\s*\d/.exec(code),
        null,
        `${file}: declares a loopback port literal at path ${file}; repair: take every port from claimScratchPort in scripts/fairtest/fairtest-runtime.mjs, never a number.`,
      )
    }
  })
})

/**
 * Apply one executable mutation to a cloned host-ownership row set. The kinds
 * mirror the product fixture family so both inventories read the same way.
 * @param {Record<string, unknown>[]} rows cloned ownership rows
 * @param {Record<string, unknown>} mutation named mutation
 */
function applyHostMutation(rows, mutation) {
  if (mutation.kind === 'duplicate-name') {
    const donor = rows.find((entry) => entry.name !== mutation.target) ?? rows[0]
    rows.push({ ...structuredClone(donor), name: mutation.target })
    return
  }
  if (mutation.kind === 'delete-record') {
    const index = rows.findIndex((entry) => entry.name === mutation.target)
    assert.notEqual(index, -1, `${String(mutation.name)}: unknown mutation target ${String(mutation.target)}`)
    rows.splice(index, 1)
    return
  }
  const target = rows.find((entry) => entry.name === mutation.target)
  assert.ok(target, `${String(mutation.name)}: unknown mutation target ${String(mutation.target)}`)
  if (mutation.kind === 'stale-name') {
    target.name = String(mutation.value)
    return
  }
  const segments = String(mutation.field).split('.')
  if (mutation.kind === 'delete-field') {
    let node = target
    for (const segment of segments.slice(0, -1)) node = /** @type {Record<string, unknown>} */ (node[segment])
    delete node[segments.at(-1)]
    return
  }
  if (mutation.kind === 'rename-field') {
    let node = target
    for (const segment of segments.slice(0, -1)) node = /** @type {Record<string, unknown>} */ (node[segment])
    const last = segments.at(-1)
    const value = node[last]
    delete node[last]
    node[String(mutation.newField)] = value
    return
  }
  let node = target
  for (const segment of segments.slice(0, -1)) {
    if (node[segment] === null || typeof node[segment] !== 'object') node[segment] = {}
    node = /** @type {Record<string, unknown>} */ (node[segment])
  }
  node[segments.at(-1)] = structuredClone(mutation.value)
}

describe('product adapter lifecycle with the real static driver', () => {
  it('cleans a squatted real static-driver start with reset before stop and no listener residue', { timeout: 30000 }, async () => {
    const { port } = await claimScratchPort(REAL_DRIVER_PURPOSES.squatter)
    const record = await driveRealStaticDriverStartFailure({
      runId: 'real-driver-squatter',
      port,
      holdPort: true,
      distRoot: createStaticFixtureRoot,
    })
    expectFragments(
      [
        'product producer: driver start failed',
        'field "port"',
        'at path driver.start',
        `could not listen on ${FAIRTEST_APP_HOST}:${port}`,
        'EADDRINUSE',
        'repair:',
      ],
      record.message,
      'real-driver-squatter',
    )
    assert.equal(record.driverPort, port, 'the real driver must have been driven on the scratch port the single owner claimed')
    assert.equal(port, fairtestScratchPort(REAL_DRIVER_PURPOSES.squatter), 'the claimed port must be the one the single owner declares for this purpose')
    assert.deepEqual(record.calls, ['start', 'reset', 'stop'], 'the squatted start must still run one reset before one stop')
  })

  it('cleans a real static-driver start that never finds its built app, again with no residue', { timeout: 30000 }, async () => {
    const { port } = await claimScratchPort(REAL_DRIVER_PURPOSES.absentDist)
    const record = await driveRealStaticDriverStartFailure({
      runId: 'real-driver-absent-dist',
      port,
      holdPort: false,
      distRoot: createAbsentStaticRoot,
    })
    expectFragments(
      [
        'product producer: built app is missing',
        'field "dist"',
        'at path driver.distRoot',
        'looked for',
        'repair:',
      ],
      record.message,
      'real-driver-absent-dist',
    )
    assert.ok(
      record.message.includes(record.driverRoot),
      `the adapter diagnostic must name the absent static root the real driver looked for; got ${record.message}`,
    )
    assert.equal(record.driverPort, port, 'the real driver must have been driven on the second claimed scratch port')
    assert.notEqual(port, fairtestScratchPort(REAL_DRIVER_PURPOSES.squatter), 'two purposes must never share one declared scratch port')
    assert.deepEqual(record.calls, ['start', 'reset', 'stop'], 'the absent-build failure must still run one reset before one stop')
  })
})

describe('adapter source boundary', () => {
  it('loads child values only through the sole source route', () => {
    for (const file of IMPL_FILES) {
      const text = readFileSync(resolve(HERE, file), 'utf8')
      assert.ok(!text.includes(CHILD_MARKER), `${file}: names a second route into the private child at path import; repair: load child values only through ../fairtest-source.mjs.`)
      const specs = [...text.matchAll(/from\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
      assert.ok(specs.length > 0, `${file}: holds no imports`)
      for (const spec of specs) {
        const allowed = spec.startsWith('node:') || spec === '../fairtest-source.mjs' || spec === './fairtrade-targets.mjs' || spec === './fairtrade-component-target.mjs'
        assert.ok(allowed, `${file}: import ${JSON.stringify(spec)} bypasses the sole source route at path import; repair: import child values through ../fairtest-source.mjs.`)
      }
      const dynamic = [...text.matchAll(/importFairtestSource\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1])
      for (const spec of dynamic) {
        assert.ok(spec.startsWith('src/'), `${file}: source spec ${JSON.stringify(spec)} escapes the child tree at path import; repair: use a child-relative src/ path.`)
      }
    }
  })

  it('carries no runner, live-handle, or host-global literal', () => {
    // Scoped to EXECUTABLE code. A comment or a diagnostic string that happens
    // to spell one of these words is prose, not a second dependency, and a
    // guard that reports prose as a production mapping defect sends the next
    // reader after a defect that is not there. Comments and string/template
    // literals are removed first; what is left is the code the module runs.
    for (const file of IMPL_FILES) {
      const source = readFileSync(resolve(HERE, file), 'utf8')
      const code = stripCommentsAndStrings(source)
      for (const { token, pattern } of HOST_GLOBAL_TOKENS) {
        const match = pattern.exec(code)
        assert.equal(
          match,
          null,
          `${file}: runs code that names host-global or runner material ${JSON.stringify(token)} at path ${file}; repair: move that ${JSON.stringify(token)} access into the injected driver or the browser-bearing host runtime, and keep ${file} free of it.`,
        )
      }
    }
  })

  it('still reports a real host-global access the comment-scoped guard catches', () => {
    // The narrowed scope must not have made the guard vacuous: a token in a
    // real code position is still reported, and the same token in a comment or
    // a message string is not.
    const planted = [
      'export function readTheme(tree) {',
      '  // the document is mounted by the caller, not here',
      "  const label = 'the document title is read by the driver'",
      '  return tree.locator(label).getAttribute(label)',
      '}',
      '',
    ].join('\n')
    let message = null
    try {
      assertNoHostGlobalTokens(planted, 'fairtrade-adapter.mjs')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, 'a host-global access in real code must still be reported')
    expectFragments(['runs code that names host-global or runner material', '"locator"', 'repair:'], message, 'planted-host-global')
    for (const token of ['document', 'locator', 'getAttribute']) {
      assert.ok(planted.includes(token), `the planted fixture must exercise ${JSON.stringify(token)}`)
    }
  })

  it('catches string-encoded runner material in a non-relaxed host row', () => {
    // The host-global scan is relaxed to string-stripped source ONLY for the
    // string-bearing component registry. Every other app-owned module is
    // scanned with strings INTACT, so a runner reference encoded inside a
    // string literal (for example `await import('puppeteer')`) is caught. The
    // relaxed registry still passes because its selector values are data.
    const planted = [
      'export async function loadRunner() {',
      "  return await import('puppeteer')",
      '}',
      '',
    ].join('\n')
    let message = null
    try {
      assertHostOwnerTokens(planted, 'fairtrade-adapter.mjs', 'planted-string-runner', 'app-owned-adapter')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, 'a string-encoded runner reference in a non-relaxed host row must be reported')
    expectFragments(['"puppeteer"', 'at path owner', 'repair:'], message, 'planted-string-runner')
    // The one relaxed registry legitimately declares selector strings, so its
    // real source passes the relaxed scan.
    assertHostOwnerTokens(
      readFileSync(resolve(HERE, STRING_BEARING_REGISTRY_FILES[0]), 'utf8'),
      STRING_BEARING_REGISTRY_FILES[0],
      'component-registry-relaxed',
      'app-owned-registry',
    )
  })

  it('catches a re-spelled component selector literal in a host module', () => {
    const planted = "const root = document.querySelector('#sgd-story-rows')\n"
    let message = null
    try {
      assertNoAppStructureLiterals(planted, 'component-producer.mjs')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, 'a re-spelled component selector literal must be reported')
    expectFragments(['component selector literal', '#sgd-story-rows', 'repair:'], message, 'planted-component-literal')
  })

  it('keeps every product and component selector and label literal in the app-owned registries', () => {
    for (const file of PRODUCT_HOST_FILES) {
      assertNoAppStructureLiterals(readFileSync(resolve(HERE, file), 'utf8'), file)
    }
  })

  it('carries no unreachable re-check of a scan the shape assertion already validated', () => {
    // assertProductAxeScanShape refuses a scan that is not a record with the
    // exact declared field set and an array of violations, so a second
    // presence check after a scan call can never fire. A dead guard in a
    // fail-closed row is worse than none: it invites a maintainer to relax the
    // real assertion while believing a second check still covers it.
    const source = readFileSync(resolve(HERE, 'product-producer.mjs'), 'utf8')
    const code = stripComments(source)
    const row = code.slice(code.indexOf('export async function captureProductRow'))
    for (const dead of [/!Array\.isArray\(/, /!scoped(Before|After)\b/, /!pageWide\b/]) {
      const match = dead.exec(row)
      assert.equal(
        match,
        null,
        `product-producer.mjs: the mounted row re-checks a validated scan for ${JSON.stringify(match ? match[0] : '')} at path producer.captureProductRow; repair: let assertProductAxeScanShape own the compact-report shape and delete the unreachable duplicate.`,
      )
    }
    const scanCalls = [...row.matchAll(/scanProductViewAxe\(/g)].length
    assert.equal(scanCalls, 2, `product-producer.mjs: the mounted row runs ${String(scanCalls)} scoped scans; repair: keep one scoped scan at each declared observation point.`)
  })

  it('carries no second axe report mapping and no second loopback origin', () => {
    const producer = readFileSync(resolve(HERE, 'product-producer.mjs'), 'utf8')
    for (const token of ['AxeBuilder', 'withTags(', '@axe-core/playwright', 'results.passes.length', 'results.violations.map']) {
      assert.ok(!producer.includes(token), `product-producer.mjs: names ${JSON.stringify(token)} at path product-producer.mjs; repair: keep the axe primitive and its compact report shape in the shared journey assertion.`)
    }
    assert.ok(producer.includes('scanAxe(page, { root })'), 'product-producer.mjs: must run the scoped scan through the shared scanAxe contract; repair: call scanAxe(page, { root }) instead of a local scanner.')
    assert.ok(producer.includes('AXE_RESULT_FIELDS'), 'product-producer.mjs: must pin the scan shape to the shared AXE_RESULT_FIELDS; repair: validate every scan against the shared declared field set.')
    const ownerText = readFileSync(resolve(ROOT, RUNTIME_REL), 'utf8')
    // Spelled in two parts so this source line never itself matches the
    // port-owner guard's second-declaration scan: this suite is itself an
    // inventoried consumer of the loopback origin, so a bare declaration
    // pattern on this line would read as a second owner.
    const portDefaultDeclaration = ['export const FAIRTEST_APP_PORT ', '= Number(process.env.FAIRTEST_APP_PORT || '].join('')
    assert.ok(ownerText.includes(portDefaultDeclaration), `${RUNTIME_REL}: must declare the loopback port as the env-overridable default; repair: keep the port override in the single owner.`)
  })

  it('keeps the mounted row preparing its run subtree before any artifact write', () => {
    const source = readFileSync(resolve(HERE, 'product-producer.mjs'), 'utf8')
    const row = source.slice(source.indexOf('export async function captureProductRow'))
    assert.ok(row.length > 0, 'product-producer.mjs: the mounted row is missing at path producer.captureProductRow; repair: keep the row that writes the six artifact classes.')
    const prepared = row.indexOf('prepareProductRowDir(')
    const firstWrite = row.indexOf('writeFileSync(')
    assert.ok(prepared > -1, 'product-producer.mjs: the mounted row no longer prepares its run directory at path producer.captureProductRow; repair: call prepareProductRowDir({ runRoot, theme }) so the freshness guard runs first.')
    assert.ok(!/assertProductRowDirFresh/.test(source), 'product-producer.mjs: still exposes the old named run-root guard at path producer.assertProductRowDirFresh; repair: keep the refusal private to the preparation seam so a row cannot reach it after a write.')
    assert.equal(source.split('refuseStaleRunSubtree(').length - 1, 2, 'product-producer.mjs: the stale-subtree refusal must have exactly one call site at path producer.refuseStaleRunSubtree; repair: call it once, inside prepareProductRowDir, before the row directory is created.')
    assert.ok(!/mkdirSync\(\s*rowDir/.test(row), 'product-producer.mjs: the mounted row creates its row directory directly at path producer.captureProductRow; repair: let prepareProductRowDir create it after validating freshness.')
    assert.ok(firstWrite > prepared, 'product-producer.mjs: the mounted row writes an artifact before preparing its run directory at path producer.captureProductRow; repair: prepare the run directory before any artifact write.')
  })

  it('keeps the existing boundary and source guards green', () => {
    const boundary = execFileSync('node', ['scripts/assert-fairtest-boundary.mjs'], { cwd: ROOT, encoding: 'utf8' })
    assert.match(boundary, /passed/, 'boundary guard must stay green')
    const smoke = execFileSync('node', ['scripts/fairtest-source.mjs', '--smoke'], { cwd: ROOT, encoding: 'utf8' })
    assert.match(smoke, /checks behaved/, 'source route smoke must stay green')
  })
})
