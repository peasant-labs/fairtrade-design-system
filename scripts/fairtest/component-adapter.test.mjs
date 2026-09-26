// Fairtrade component target contract test.
//
// Browser-free. Consumes scripts/fairtest/component-target.testdata.yaml (the
// single source for the component target rows) and its required-name manifest,
// proves the target through the shared host contract via the sole source route,
// and runs every named executable mutation against the real validator, so a
// deleted case, a renamed discriminator, an invented theme, or a product-shaped
// component record fails for its intended field. Starts no service and no
// browser; the mounted component proof lives in the component journey.

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { importFairtestSource } from '../fairtest-source.mjs'
import { storyUrl } from '../journey/lib/fixtures.mjs'
import { normalizeRenderedTheme } from './fairtrade-targets.mjs'
import { createFairtradeAdapter } from './fairtrade-adapter.mjs'
import { captureComponentRow, resolveComponentRunRoot } from './component-producer.mjs'
import * as targets from './fairtrade-component-target.mjs'
import { COMPONENT_MUTATION_NAMES, runComponentMutation } from './component-mutations.mjs'
import { PRODUCT_ONLY_FIELDS as PROOF_PRODUCT_ONLY_FIELDS } from './fairtest-artifacts.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CORPUS_REL = 'scripts/fairtest/component-target.testdata.yaml'
const MANIFEST_REL = 'scripts/fairtest/component-target.testdata.manifest.yaml'
const TARGET_MODULE = 'fairtrade-component-target.mjs'
const CHILD_MARKER = ['packages', 'fairtest'].join('/')

const coreFixtures = await importFairtestSource('src/core/fixtures.mjs')
const contractTargets = await importFairtestSource('src/host-contract/targets.mjs')
const contractResolution = await importFairtestSource('src/host-contract/resolution.mjs')

const CHECKS = ['component-row', 'component-url', 'component-setup', 'component-project', 'component-mount', 'component-declaration', 'component-action', 'component-proof', 'component-proof-blanket', 'component-cross-kind', 'component-mutation', 'component-run-root', 'component-capture-envelope']
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'stale-name', 'trailing-document'])
const ROW_THEMES = ['dark', 'light']

const corpusSource = readFileSync(resolve(ROOT, CORPUS_REL), 'utf8')
const manifestSource = readFileSync(resolve(ROOT, MANIFEST_REL), 'utf8')

/**
 * Assert every fragment appears in a diagnostic.
 * @param {string[]} fragments expected fragments
 * @param {string} message produced diagnostic
 * @param {string} name case or mutation name
 */
function expectFragments(fragments, message, name) {
  for (const fragment of fragments) {
    assert.ok(message.includes(fragment), `${name}: diagnostic is missing ${JSON.stringify(fragment)}; got ${message}`)
  }
}

/**
 * Assert an expected-error fragment list is a non-empty string list.
 * @param {unknown} value candidate list
 * @param {string} label owning file
 * @param {string} path value path
 */
function checkFragmentList(value, label, path) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
    throw new Error(`${label}: missing expected-error fragments at path ${path}; repair: list the diagnostic fragments the case must produce.`)
  }
}

/**
 * Run one value and return the caught diagnostic.
 * @param {() => unknown} fn thunk
 * @returns {string | null} the diagnostic, or null when no error was thrown
 */
function caught(fn) {
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return null
}

/**
 * Validate the manifest: exact keys, count agreement, unique required names,
 * and mutation records whose kind, target, and field are all declared.
 * @param {Record<string, unknown>} manifest parsed manifest
 */
function validateManifest(manifest) {
  coreFixtures.checkKeys(manifest, ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'manifest', MANIFEST_REL)
  const names = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(names).size, names.length, `${MANIFEST_REL}: required case names must be unique at path manifest.requiredCaseNames; repair: list every case name once.`)
  assert.equal(manifest.expectedCaseCount, names.length, `${MANIFEST_REL}: case count must equal the required-name inventory at path manifest.expectedCaseCount; repair: align expectedCaseCount with requiredCaseNames.`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${MANIFEST_REL}: mutation count must equal the mutation inventory at path manifest.expectedMutationCount; repair: align expectedMutationCount with mutations.`)
  coreFixtures.checkRequiredNames(mutations.map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredMutationNames), MANIFEST_REL)
  for (const [index, mutation] of mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (mutation.kind === 'delete-field') fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(String(mutation.kind))) fields.push('field', 'value')
    if (mutation.kind === 'stale-name') fields.push('value')
    coreFixtures.checkKeys(mutation, fields, 'mutation record', MANIFEST_REL, `manifest.mutations[${index}]`)
    assert.ok(MUTATION_KINDS.has(String(mutation.kind)), `${MANIFEST_REL}: mutation ${index} names an unknown kind at path manifest.mutations[${index}].kind; repair: use one of ${[...MUTATION_KINDS].join(', ')}.`)
    assert.ok(typeof mutation.expectedField === 'string' && mutation.expectedField.length, `${MANIFEST_REL}: mutation ${index} must name its intended field at path manifest.mutations[${index}].expectedField.`)
    if (mutation.kind === 'trailing-document') {
      assert.equal(mutation.target, 'document', `${MANIFEST_REL}: mutation ${index} must target the document at path manifest.mutations[${index}].target.`)
    } else {
      assert.ok(names.includes(String(mutation.target)), `${MANIFEST_REL}: mutation ${index} targets an unknown case at path manifest.mutations[${index}].target; repair: target one of the required case names.`)
    }
  }
}

/**
 * Validate one case shape: exact field set for its check, the verdict marker,
 * and the nested records the proof, mount, and cross-kind checks require.
 * @param {Record<string, unknown>} entry case record
 * @param {number} index case index
 */
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
    'component-row': entry.expectValid
      ? ['name', 'check', 'theme', 'renderedAttribute', 'expectTheme', ...tail]
      : ['name', 'check', 'theme', 'renderedAttribute', ...tail],
    'component-url': ['name', 'check', 'theme', 'url', 'expectValid', 'expectFrozen'],
    'component-setup': entry.expectValid
      ? ['name', 'check', 'theme', 'expectedAttribute', 'url', ...tail]
      : ['name', 'check', 'theme', ...tail],
    'component-project': ['name', 'check', 'project', 'expectValid', 'expectedErrorContains'],
    'component-mount': entry.expectValid
      ? ['name', 'check', 'observation', ...tail]
      : ['name', 'check', 'observation', ...tail],
    'component-declaration': entry.expectValid
      ? ['name', 'check', 'capabilities', ...tail]
      : ['name', 'check', 'capabilities', ...tail],
    'component-action': entry.expectValid
      ? ['name', 'check', 'action', ...tail]
      : ['name', 'check', 'action', ...tail],
    'component-proof': ['name', 'check', 'rowTheme', 'identity', 'root', 'themeObservation', 'interaction', ...tail],
    'component-proof-blanket': ['name', 'check', 'mounted', 'expectValid', 'expectedErrorContains'],
    'component-cross-kind': ['name', 'check', 'record', 'presentedTo', 'expectValid', 'expectedErrorContains'],
    'component-mutation': ['name', 'check', 'mutation', 'boundary', 'expectValid', 'expectedErrorContains'],
    'component-run-root': entry.expectValid
      ? ['name', 'check', 'runRootEnv', 'runIdEnv', 'seedEnvelope', 'expectRoot', 'expectValid']
      : ['name', 'check', 'runRootEnv', 'runIdEnv', 'seedEnvelope', 'envelopeRunId', 'expectValid', 'expectedErrorContains'],
    'component-capture-envelope': ['name', 'check', 'runRootEnv', 'runIdEnv', 'seedEnvelope', 'envelopeRunId', 'theme', 'expectValid', 'expectedErrorContains'],
  }
  coreFixtures.checkKeys(entry, fieldsByCheck[entry.check], 'case record', CORPUS_REL, path)
  if (!entry.expectValid) {
    checkFragmentList(entry.expectedErrorContains, CORPUS_REL, `${path}.expectedErrorContains`)
  }
  if (entry.check === 'component-mount') {
    coreFixtures.checkKeys(entry.observation, ['rootChildCount', 'bodyClass', 'errorDisplay', 'errorStackText'], 'mount observation', CORPUS_REL, `${path}.observation`)
  }
  if (entry.check === 'component-proof') {
    if (!entry.identity || typeof entry.identity !== 'object') {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds no identity record for field "identity" at path ${path}.identity; repair: restore the component-branch identity record.`)
    }
    if (!entry.root || typeof entry.root !== 'object') {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds no root record for field "root" at path ${path}.root; repair: restore the mounted-root record or null.`)
    }
    if (entry.themeObservation !== null && (typeof entry.themeObservation !== 'object' || Array.isArray(entry.themeObservation))) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds a malformed theme observation for field "themeObservation" at path ${path}.themeObservation; repair: restore the theme observation record or null.`)
    }
    if (entry.interaction !== null && (typeof entry.interaction !== 'object' || Array.isArray(entry.interaction))) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds a malformed interaction for field "interaction" at path ${path}.interaction; repair: restore the completed interaction record or null.`)
    }
  }
  if (entry.check === 'component-cross-kind') {
    if (!entry.record || typeof entry.record !== 'object' || Array.isArray(entry.record)) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds no resolution record for field "record" at path ${path}.record; repair: restore the resolution record under test.`)
    }
    if (entry.presentedTo !== 'component' && entry.presentedTo !== 'product') {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" names an unknown resolver ${JSON.stringify(entry.presentedTo)} for field "presentedTo" at path ${path}.presentedTo; repair: use component or product.`)
    }
  }
  if (entry.check === 'component-mutation') {
    if (!COMPONENT_MUTATION_NAMES.includes(/** @type {string} */ (entry.mutation))) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" names an unknown mutation ${JSON.stringify(entry.mutation)} for field "mutation" at path ${path}.mutation; repair: use one of ${COMPONENT_MUTATION_NAMES.join(', ')} for "mutation".`)
    }
    if (typeof entry.boundary !== 'string' || entry.boundary.trim().length === 0) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" is missing its owning boundary for field "boundary" at path ${path}.boundary; repair: name the owning component boundary for "boundary".`)
    }
  }
  if (entry.check === 'component-run-root' || entry.check === 'component-capture-envelope') {
    if (entry.runRootEnv !== null && (typeof entry.runRootEnv !== 'string' || entry.runRootEnv.length === 0)) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds a malformed run-root env value for field "runRootEnv" at path ${path}.runRootEnv; repair: declare the FAIRTEST_RUN_ROOT value the case sets, or null for an unset variable.`)
    }
    if (entry.expectValid && (typeof entry.expectRoot !== 'string' || !isAbsolute(entry.expectRoot))) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" is missing the resolved root for field "expectRoot" at path ${path}.expectRoot; repair: declare the absolute run root the component producer must resolve.`)
    }
    if ('seedEnvelope' in entry && typeof entry.seedEnvelope !== 'boolean') {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" holds a non-boolean seed marker for field "seedEnvelope" at path ${path}.seedEnvelope; repair: set seedEnvelope to true or remove it.`)
    }
    for (const field of ['runIdEnv', 'envelopeRunId']) {
      if (field in entry && (typeof entry[field] !== 'string' || entry[field].length === 0)) {
        throw new Error(`${CORPUS_REL}: case "${entry.name}" holds an invalid value ${JSON.stringify(entry[field])} for field "${field}" at path ${path}.${field}; repair: declare the run id the case sets.`)
      }
    }
  }
  if (entry.check === 'component-capture-envelope') {
    if (!ROW_THEMES.includes(/** @type {string} */ (entry.theme))) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" names an unknown row theme ${JSON.stringify(entry.theme)} for field "theme" at path ${path}.theme; repair: use one of ${ROW_THEMES.join(', ')} for "theme".`)
    }
    if (entry.expectValid !== false) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" declares a passing verdict for field "expectValid" at path ${path}.expectValid; repair: declare expectValid false so the capture seam can only assert a fail-closed refusal.`)
    }
  }
  if (entry.check === 'component-run-root' && !entry.expectValid) {
    if (entry.seedEnvelope !== true) {
      throw new Error(`${CORPUS_REL}: case "${entry.name}" is missing its seeded envelope for field "seedEnvelope" at path ${path}.seedEnvelope; repair: set seedEnvelope true so the refusal is observed against a real envelope.`)
    }
  }
}

/**
 * Validate the corpus: exact case shapes plus the required-name inventory.
 * @param {Record<string, unknown>} parsed parsed corpus
 * @param {Record<string, unknown>} manifest parsed manifest
 */
function validateFamily(parsed, manifest) {
  coreFixtures.checkKeys(parsed, ['expectedCaseCount', 'cases'], 'corpus record', CORPUS_REL, 'record')
  const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${CORPUS_REL}: record holds no cases at path cases; repair: restore the named component target cases.`)
  assert.equal(cases.length, manifest.expectedCaseCount, `${CORPUS_REL}: case count must match the manifest at path expectedCaseCount; repair: align the cases list with the manifest.`)
  assert.equal(cases.length, parsed.expectedCaseCount, `${CORPUS_REL}: case count must match the declared expectedCaseCount at path expectedCaseCount.`)
  coreFixtures.checkRequiredNames(cases.map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS_REL)
  cases.forEach(checkCaseShape)
}

/**
 * Run one case through the real target validators.
 * @param {Record<string, unknown>} entry case record
 * @returns {Promise<void>|void} resolves when the case has been checked
 */
function runCase(entry) {
  const name = /** @type {string} */ (entry.name)
  switch (entry.check) {
    case 'component-row':
      return runComponentRowCase(entry)
    case 'component-url':
      return runComponentUrlCase(entry)
    case 'component-setup':
      return runComponentSetupCase(entry)
    case 'component-project':
      return runComponentProjectCase(entry)
    case 'component-mount':
      return runComponentMountCase(entry)
    case 'component-declaration':
      return runComponentDeclarationCase(entry)
    case 'component-action':
      return runComponentActionCase(entry)
    case 'component-proof':
      return runComponentProofCase(entry)
    case 'component-proof-blanket':
      return runComponentProofBlanketCase(entry)
    case 'component-cross-kind':
      return runComponentCrossKindCase(entry)
    case 'component-mutation':
      return runComponentMutationCase(entry)
    case 'component-run-root':
      return runComponentRunRootCase(entry)
    case 'component-capture-envelope':
      return runComponentCaptureEnvelopeCase(entry)
    default:
      throw new Error(`${CORPUS_REL}: case "${name}" names an unknown check ${JSON.stringify(entry.check)}`)
  }
}

/** @param {Record<string, unknown>} entry */
function runComponentRowCase(entry) {
  const name = /** @type {string} */ (entry.name)
  if (entry.expectValid) {
    assert.equal(normalizeRenderedTheme(entry.renderedAttribute), entry.expectTheme, `${name}: the rendered value must normalize to the expected theme`)
    const row = targets.componentThemeRow(entry.theme)
    assert.equal(Object.isFrozen(row), true, `${name}: the row record must be frozen`)
    assert.equal(row.expectedAttribute, entry.renderedAttribute === 'light' ? 'light' : '', `${name}: the expected attribute must be the raw rendered marker`)
    return
  }
  const message = caught(() => {
    normalizeRenderedTheme(entry.renderedAttribute)
    targets.componentThemeRow(entry.theme)
  })
  assert.ok(message, `${name}: the case must fail closed on the real target`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runComponentUrlCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const url = targets.componentStoryUrl(targets.COMPONENT_STORY_ID, entry.theme)
  assert.equal(url, entry.url, `${name}: the direct iframe URL must match the declared shape`)
  if (entry.theme === 'dark') {
    assert.ok(!url.includes('globals='), `${name}: the dark row must carry no globals parameter`)
  } else {
    assert.ok(url.includes('&globals=theme:light'), `${name}: the light row must carry the light global`)
  }
  assert.ok(Object.isFrozen(targets.componentThemeRow(entry.theme)), `${name}: the row record must be frozen`)
}

/** @param {Record<string, unknown>} entry */
function runComponentSetupCase(entry) {
  const name = /** @type {string} */ (entry.name)
  if (entry.expectValid) {
    const setup = targets.componentThemeSetup(entry.theme)
    assert.ok(Object.isFrozen(setup), `${name}: the setup descriptor must be frozen`)
    assert.equal(setup.expectedAttribute, entry.expectedAttribute, `${name}: the setup must own the raw expected attribute`)
    assert.equal(setup.url, entry.url, `${name}: the setup must own the direct iframe URL`)
    return
  }
  const message = caught(() => targets.componentThemeSetup(entry.theme))
  assert.ok(message, `${name}: the case must fail closed on the real setup`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runComponentProjectCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const message = caught(() => targets.componentThemeFromProjectName(entry.project))
  assert.ok(message, `${name}: project-name inference must fail`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runComponentMountCase(entry) {
  const name = /** @type {string} */ (entry.name)
  if (entry.expectValid) {
    const mounted = targets.assertComponentMounted(entry.observation)
    assert.ok(Object.isFrozen(mounted), `${name}: the mount observation must be frozen`)
    assert.equal(mounted.mounted, true, `${name}: a healthy story must prove a mount`)
    return
  }
  const message = caught(() => targets.assertComponentMounted(entry.observation))
  assert.ok(message, `${name}: the case must fail closed on the real mount guard`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runComponentDeclarationCase(entry) {
  const name = /** @type {string} */ (entry.name)
  if (entry.expectValid) {
    const capabilities = contractTargets.validateCapabilityList(entry.capabilities, 'component', 'fairtrade component fixture', 'case.capabilities')
    assert.ok(Object.isFrozen(capabilities), `${name}: the validated capability list must be frozen`)
    for (const required of contractTargets.COMPONENT_REQUIRED_CAPABILITIES) {
      assert.ok(capabilities.includes(required), `${name}: declared capabilities must include ${required}`)
    }
    return
  }
  const message = caught(() => contractTargets.validateCapabilityList(entry.capabilities, 'component', 'fairtrade component fixture', 'case.capabilities'))
  assert.ok(message, `${name}: the case must fail closed on the real capability validator`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runComponentActionCase(entry) {
  const name = /** @type {string} */ (entry.name)
  if (entry.expectValid) {
    const action = targets.getComponentAction(entry.action)
    assert.ok(Object.isFrozen(action), `${name}: the action record must be frozen`)
    assert.equal(action.name, targets.COMPONENT_ACTION_NAME, `${name}: the registered action must be the expand-disclosure`)
    return
  }
  const message = caught(() => targets.getComponentAction(entry.action))
  assert.ok(message, `${name}: the case must fail closed on the real action registry`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runComponentProofCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const build = () => {
    const input = {
      rowTheme: entry.rowTheme,
      identity: entry.identity,
      root: entry.root,
      themeObservation: entry.themeObservation,
    }
    if (entry.interaction !== null) input.interaction = entry.interaction
    return targets.buildComponentProof(input)
  }
  if (entry.expectValid) {
    const proof = build()
    assert.ok(Object.isFrozen(proof), `${name}: the proof record must be frozen`)
    assert.equal(proof.kind, 'component', `${name}: the proof kind must stay component`)
    const expectedFields = entry.interaction !== null
      ? targets.COMPONENT_PROOF_RECORD_SCHEMA.fieldsWithInteraction
      : targets.COMPONENT_PROOF_RECORD_SCHEMA.fields
    assert.deepEqual(Object.keys(proof).sort(), [...expectedFields].sort(), `${name}: the proof must carry exactly the declared component fields`)
    for (const productOnly of PROOF_PRODUCT_ONLY_FIELDS) {
      assert.ok(!(productOnly in proof), `${name}: a component proof must never carry the product-only field ${JSON.stringify(productOnly)}`)
    }
    return
  }
  const message = caught(build)
  assert.ok(message, `${name}: the case must fail closed on the real proof builder`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runComponentProofBlanketCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const message = caught(() => targets.buildComponentProof({ mounted: entry.mounted }))
  assert.ok(message, `${name}: a blanket mounted flag must be refused`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runComponentCrossKindCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const resolver = entry.presentedTo === 'product' ? contractResolution.validateProductResolution : contractResolution.validateComponentResolution
  const message = caught(() => resolver(entry.record, 'fairtrade component fixture'))
  assert.ok(message, `${name}: the case must fail closed on the real shared resolver`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
async function runComponentMutationCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    await runComponentMutation(/** @type {string} */ (entry.mutation))
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  assert.ok(message, `${name}: named mutation passed instead of failing at ${entry.boundary}`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/**
 * A page stand-in that throws on every property access. The component capture
 * seam must refuse a foreign run envelope BEFORE it touches the page, so
 * reaching this object at all proves the guard ran too late.
 * @type {object}
 */
const TORN_COMPONENT_PAGE = new Proxy({}, {
  get(_target, property) {
    throw new Error(
      `component producer: the run-envelope guard must run before the page is touched for field "page" at path row.page (accessed ${String(property)}); ` +
      'repair: keep requireEnvelopeForRun before prepareComponentRowDir so a foreign root is refused before any browser work.',
    )
  },
})

/**
 * Install the case's declared run-root environment, seed the run envelope the
 * case names, run the thunk against the real component producer seam, then
 * restore the environment and remove the seeded root in every exit path. The
 * optional observe hook runs after the thunk settles and before the seeded
 * root is removed, so a case can read filesystem state the thunk left behind.
 * The root is a throwaway path and no service or browser is started.
 * @param {Record<string, unknown>} entry the run-envelope case
 * @param {() => unknown} run the thunk that drives the real component seam
 * @param {(seededRoot: string | null) => unknown} [observe] pre-cleanup filesystem probe
 * @returns {Promise<{ message: string | null, value: unknown, observed: unknown }>} the caught diagnostic, returned value, and probe result
 */
async function withSeededEnvelope(entry, run, observe) {
  const declared = /** @type {string | null} */ (entry.runRootEnv)
  const declaredRunId = /** @type {string | null} */ (entry.runIdEnv ?? null)
  const previousRoot = process.env.FAIRTEST_RUN_ROOT
  const previousRunId = process.env.FAIRTEST_RUN_ID
  let seeded = null
  let message = null
  let value = null
  let observed = null
  try {
    if (entry.seedEnvelope === true && typeof declared === 'string' && isAbsolute(declared)) {
      rmSync(declared, { recursive: true, force: true })
      mkdirSync(join(declared, 'guards'), { recursive: true })
      writeFileSync(
        join(declared, 'guards', 'run-envelope.json'),
        `${JSON.stringify({ runId: entry.envelopeRunId ?? declaredRunId, project: 'fairtest' }, null, 2)}\n`,
      )
      seeded = declared
    }
    if (declared === null) {
      delete process.env.FAIRTEST_RUN_ROOT
    } else {
      process.env.FAIRTEST_RUN_ROOT = declared
    }
    if (declaredRunId === null) {
      delete process.env.FAIRTEST_RUN_ID
    } else {
      process.env.FAIRTEST_RUN_ID = declaredRunId
    }
    value = await run()
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  } finally {
    if (observe) observed = observe(seeded)
    if (seeded !== null) rmSync(seeded, { recursive: true, force: true })
    if (previousRoot === undefined) {
      delete process.env.FAIRTEST_RUN_ROOT
    } else {
      process.env.FAIRTEST_RUN_ROOT = previousRoot
    }
    if (previousRunId === undefined) {
      delete process.env.FAIRTEST_RUN_ID
    } else {
      process.env.FAIRTEST_RUN_ID = previousRunId
    }
  }
  return { message, value, observed }
}

/**
 * Run one component run-root case through the producer's REAL root resolver.
 * The declared FAIRTEST_RUN_ROOT and FAIRTEST_RUN_ID are installed in the
 * process environment, the real resolver reads them, and the environment is
 * restored in a finally block. A matching envelope must resolve to the
 * declared absolute root; a foreign envelope must be refused before any row
 * directory is created.
 * @param {Record<string, unknown>} entry case record
 * @returns {Promise<void>} resolves when the case has been checked
 */
async function runComponentRunRootCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const { message, value } = await withSeededEnvelope(entry, () => resolveComponentRunRoot())
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: a matching envelope must resolve the component run root; got ${message}`)
    assert.equal(value, resolve(/** @type {string} */ (entry.expectRoot)), `${name}: the resolved component run root must equal the declared absolute root`)
    assert.ok(isAbsolute(/** @type {string} */ (value)), `${name}: the resolved component run root must stay absolute`)
  } else {
    assert.ok(message, `${name}: an unusable component run root passed instead of failing`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

/**
 * Run one capture-seam case through the producer's REAL capture wrapper. The
 * run root is passed explicitly so the resolver seam is bypassed and only the
 * re-require before the row directory is observed: the wrapper must refuse a
 * foreign envelope before it touches the page or creates the row directory.
 * @param {Record<string, unknown>} entry case record
 * @returns {Promise<void>} resolves when the case has been checked
 */
async function runComponentCaptureEnvelopeCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const declaredRunRoot = /** @type {string} */ (entry.runRootEnv)
  const theme = /** @type {string} */ (entry.theme)
  const { message, observed } = await withSeededEnvelope(
    entry,
    () => captureComponentRow(TORN_COMPONENT_PAGE, theme, { runRoot: declaredRunRoot }),
    () => existsSync(join(declaredRunRoot, 'producer', `component-${theme}`)),
  )
  assert.ok(message, `${name}: the component capture seam accepted a foreign run envelope instead of refusing it`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  assert.equal(observed, false, `${name}: the capture seam must refuse a foreign envelope before creating the row directory`)
}

/**
 * Validate a mutated corpus the way the owning guards do: case shapes plus the
 * required-name inventory, then the one case the mutation touched.
 * @param {Record<string, unknown>[]} cases mutated cases
 * @param {Record<string, unknown>} manifest parsed manifest
 * @param {Record<string, unknown>} mutation named mutation
 * @returns {Promise<void>} resolves when the touched case has been checked
 */
async function validateMutated(cases, manifest, mutation) {
  cases.forEach(checkCaseShape)
  coreFixtures.checkRequiredNames(cases.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS_REL)
  const target = cases.find((entry) => entry.name === mutation.target)
  if (target) await runCase(target)
}

/**
 * Apply one executable mutation to a cloned case list.
 * @param {Record<string, unknown>[]} cases cloned cases
 * @param {Record<string, unknown>} mutation named mutation
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

describe('component target fixture family', () => {
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
    const message = caught(() => coreFixtures.loadSingleDocument(`${corpusSource.trimEnd()}\n---\norphan: true\n`, CORPUS_REL))
    assert.ok(message, 'trailing record must fail single-record loading')
    assert.match(message, /trailing/)
    assert.match(message, /at path.*repair:/s)
  })

  it('fails every executable mutation for its intended field', async () => {
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      if (mutation.kind === 'trailing-document') {
        message = caught(() => coreFixtures.loadSingleDocument(`${corpusSource.trimEnd()}\n---\norphan: true\n`, CORPUS_REL))
      } else {
        try {
          const mutated = structuredClone(cases)
          applyMutation(mutated, mutation)
          await validateMutated(mutated, manifest, mutation)
        } catch (error) {
          message = error instanceof Error ? error.message : String(error)
        }
      }
      assert.ok(message, `${mutation.name}: mutated input passed validation instead of failing`)
      assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${mutation.name}: diagnostic names the wrong field; got ${message}`)
      assert.ok(message.includes('at path'), `${mutation.name}: diagnostic is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `${mutation.name}: diagnostic is missing repair guidance: ${message}`)
    }
  })
})

describe('component target registry and theme rows', () => {
  it('declares exactly one component target with the real story selectors', () => {
    assert.deepEqual(Object.keys(targets.COMPONENT_TARGET_REGISTRY), [targets.COMPONENT_TARGET_ID])
    const selected = targets.selectComponentTarget(targets.COMPONENT_TARGET_ID)
    assert.equal(selected.kind, 'component')
    assert.equal(selected.storyId, targets.COMPONENT_STORY_ID)
    assert.ok(Object.isFrozen(selected), 'target record must be frozen')
    assert.deepEqual({ ...selected.selectors }, {
      root: '#storybook-root',
      trigger: '.sgd-trigger',
      toggle: '[data-testid="session-group-disclosure-toggle"]',
      label: '[data-testid="session-group-disclosure-label"]',
      count: '.sgd-count',
      rows: '#sgd-story-rows',
      rowItem: '#sgd-story-rows li',
      errorDisplay: '.sb-errordisplay',
      errorStack: '#error-stack',
    })
    assert.deepEqual([...selected.actions], [targets.COMPONENT_ACTION_NAME])
    assert.deepEqual([...targets.COMPONENT_MOUNT_BODY_CLASSES], ['sb-main-centered', 'sb-show-main'])
  })

  it('rejects unknown target ids with an actionable diagnostic', () => {
    const message = caught(() => targets.selectComponentTarget('invented-target'))
    assert.ok(message && /"invented-target".*field "id".*at path target\.id.*repair:/s.test(message), `unknown target id must fail; got ${message}`)
  })

  it('builds the direct iframe URL per theme and rejects unknown rows', () => {
    assert.equal(targets.componentStoryUrl(targets.COMPONENT_STORY_ID, 'dark'), '/iframe.html?id=components-sessiongroupdisclosure--playground&viewMode=story')
    assert.equal(targets.componentStoryUrl(targets.COMPONENT_STORY_ID, 'light'), '/iframe.html?id=components-sessiongroupdisclosure--playground&viewMode=story&globals=theme:light')
    // Drift guard: the component row URL must stay byte-identical to the shared
    // journey story URL the compatibility journey sends for the same story.
    for (const theme of ROW_THEMES) {
      assert.equal(
        targets.componentStoryUrl(targets.COMPONENT_STORY_ID, theme),
        storyUrl(targets.COMPONENT_STORY_ID, theme),
        `the component row URL for ${theme} must match the shared journey story URL`,
      )
    }
    assert.match(String(caught(() => targets.componentStoryUrl(targets.COMPONENT_STORY_ID, 'dusk'))), /dusk.*field "theme".*at path row\.theme.*repair:/s)
    assert.deepEqual(targets.componentThemeRow('dark').expectedAttribute, '')
    assert.equal(targets.componentThemeRow('dark').url, '/iframe.html?id=components-sessiongroupdisclosure--playground&viewMode=story')
  })

  it('describes the provenance source without routes or selectors', () => {
    const source = targets.COMPONENT_PROVENANCE_SOURCE
    assert.ok(Object.isFrozen(source), 'provenance source must be frozen')
    assert.deepEqual(Object.keys(source).sort(), ['entries', 'fields', 'root', 'source'])
    const text = JSON.stringify(source)
    assert.ok(!text.includes('#storybook-root'), 'provenance source must not name surface selectors')
    assert.ok(source.fields.includes('storyId'), 'component provenance must name the story id field')
  })

  it('proves the declared target against the shared contract', async () => {
    const receipt = await targets.validateComponentTargetContract({ createdAtMs: 1000 })
    assert.equal(receipt.kind, 'component')
    for (const required of contractTargets.COMPONENT_REQUIRED_CAPABILITIES) {
      assert.ok(receipt.capabilities.includes(required), `declared capabilities must include ${required}`)
      assert.equal(contractTargets.requiresCapability(receipt.declaration, required), true)
    }
    assert.equal(receipt.declaration.kind, 'component')
    assert.deepEqual([...receipt.declaration.actions], [targets.COMPONENT_ACTION_NAME])
  })
})

describe('component proof record schema and shared vocabulary', () => {
  it('matches the shared component-only field set with no product-only member', () => {
    const schema = targets.COMPONENT_PROOF_RECORD_SCHEMA
    assert.ok(Object.isFrozen(schema), 'proof schema must be frozen')
    assert.equal(schema.kind, 'component', 'proof schema kind must stay component')
    assert.deepEqual([...schema.fields], ['kind', 'identity', 'root', 'theme'])
    assert.deepEqual([...schema.fieldsWithInteraction], ['kind', 'identity', 'root', 'theme', 'interaction'])
    for (const productOnly of PROOF_PRODUCT_ONLY_FIELDS) {
      assert.ok(!schema.fields.includes(productOnly), `the component proof fields must never include ${productOnly}`)
      assert.ok(!schema.fieldsWithInteraction.includes(productOnly), `the component proof fields must never include ${productOnly}`)
    }
    assert.deepEqual([...schema.rootFields], ['mounted', 'observedAtMs'])
    assert.deepEqual([...schema.themeFields], ['expected', 'observed', 'source', 'observedAtMs'])
    assert.deepEqual([...schema.interactionFields], ['name', 'completed', 'observedAtMs'])
    assert.deepEqual([...schema.identityFields], ['kind', 'id', 'createdAtMs'])
    // The single-sourced product-only field list must equal the shared
    // contract's list, so a drift in fairtest-artifacts.mjs turns red here.
    assert.deepEqual(
      [...PROOF_PRODUCT_ONLY_FIELDS],
      [...contractResolution.PRODUCT_ONLY_FIELDS],
      'the shared product-only field list must equal the shared host contract list',
    )
  })

  it('describes the theme setup without project-name inference', () => {
    for (const theme of ROW_THEMES) {
      const setup = targets.componentThemeSetup(theme)
      const row = targets.componentThemeRow(theme)
      assert.equal(row.expectedAttribute, setup.expectedAttribute)
    }
    assert.match(String(caught(() => targets.componentThemeFromProjectName('component-dark'))), /field "project".*at path theme\.project.*"component-dark".*repair:/s)
  })

  it('builds a frozen component resolution with no product-only field', () => {
    const proof = targets.buildComponentProof({
      rowTheme: 'dark',
      identity: { kind: 'component', id: targets.COMPONENT_TARGET_ID, createdAtMs: 1000 },
      root: { mounted: true, observedAtMs: 2000 },
      themeObservation: { expected: 'dark', observed: 'dark', source: 'component-target-test', observedAtMs: 2100 },
      interaction: { name: targets.COMPONENT_ACTION_NAME, completed: true, observedAtMs: 3000 },
    })
    assert.ok(Object.isFrozen(proof), 'proof record must be frozen')
    assert.equal(proof.kind, 'component')
    assert.deepEqual(Object.keys(proof).sort(), ['identity', 'interaction', 'kind', 'root', 'theme'])
    assert.equal(proof.interaction.name, targets.COMPONENT_ACTION_NAME)
    assert.deepEqual(contractResolution.validateComponentResolution(proof, 'component-target-test'), proof, 'the component resolver must accept the built proof')
  })
})

describe('shared adapter kind selection', () => {
  /**
   * Minimal fake lifecycle driver: enough surface for the adapter contract, no
   * browser or service.
   * @returns {object} the fake driver
   */
  function fakeDriver() {
    let running = false
    return {
      isRunning: () => running,
      async start() { running = true },
      async reset() {},
      async stop() { running = false },
      async readiness() { return { ready: true } },
    }
  }

  it('selects the component target, capabilities, and action for kind component', async () => {
    const adapter = await createFairtradeAdapter({ runId: 'component-adapter-probe', driver: fakeDriver(), kind: 'component', createdAtMs: 1000 })
    assert.equal(adapter.targetId, targets.COMPONENT_TARGET_ID, 'kind component must select the component target')
    assert.equal(adapter.declaration.kind, 'component', 'the declaration must stay on the component branch')
    for (const required of contractTargets.COMPONENT_REQUIRED_CAPABILITIES) {
      assert.ok(adapter.capabilities.includes(required), `component capabilities must include ${required}`)
    }
    await adapter.start()
    const result = await adapter.performAction(targets.COMPONENT_ACTION_NAME, { observedAtMs: 2000 })
    assert.deepEqual(result, { name: targets.COMPONENT_ACTION_NAME, completed: true, observedAtMs: 2000 })
    await assert.rejects(
      () => adapter.performAction('select-map-section'),
      /"select-map-section".*field "action".*at path adapter\.action.*repair:/s,
      'a product action must not be accepted by a component adapter',
    )
    await adapter.teardown()
  })

  it('still defaults to the product target and refuses an unknown kind', async () => {
    const adapter = await createFairtradeAdapter({ runId: 'product-adapter-probe-default', driver: fakeDriver(), createdAtMs: 1000 })
    assert.equal(adapter.declaration.kind, 'product', 'an omitted kind must stay product')
    await assert.rejects(
      () => createFairtradeAdapter({ runId: 'bad-kind-probe', driver: fakeDriver(), kind: 'widget', createdAtMs: 1000 }),
      /unknown host kind "widget".*field "kind".*at path adapter\.kind.*repair:/s,
      'an unknown kind must fail closed',
    )
  })
})

describe('component target source boundary', () => {
  it('loads child values only through the sole source route', () => {
    const text = readFileSync(resolve(HERE, TARGET_MODULE), 'utf8')
    assert.ok(!text.includes(CHILD_MARKER), `${TARGET_MODULE}: names a second route into the private child at path import; repair: load child values only through ../fairtest-source.mjs.`)
    const specs = [...text.matchAll(/from\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
    assert.ok(specs.length > 0, `${TARGET_MODULE}: holds no imports`)
    for (const spec of specs) {
      const allowed = spec.startsWith('node:') || spec === '../fairtest-source.mjs' || spec === './fairtrade-targets.mjs'
      assert.ok(allowed, `${TARGET_MODULE}: import ${JSON.stringify(spec)} bypasses the sole source route at path import; repair: import child values through ../fairtest-source.mjs.`)
    }
    const dynamic = [...text.matchAll(/importFairtestSource\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1])
    for (const spec of dynamic) {
      assert.ok(spec.startsWith('src/'), `${TARGET_MODULE}: source spec ${JSON.stringify(spec)} escapes the child tree at path import; repair: use a child-relative src/ path.`)
    }
  })

  it('resolves the target module with node --check', () => {
    const result = execFileSync(process.execPath, ['--check', resolve(HERE, TARGET_MODULE)], { encoding: 'utf8' })
    assert.equal(typeof result, 'string')
  })
})
