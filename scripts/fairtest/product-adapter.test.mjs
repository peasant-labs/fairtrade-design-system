// Focused contract test for the Fairtrade product adapter and target
// registry. Every behavioral row lives in product-target.testdata.yaml with
// its required-name manifest; this module owns no row tables, only the fake
// lifecycle driver, shape checks, and mutation wiring. It runs with node
// --test and starts no service or runner.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { importFairtestSource } from '../fairtest-source.mjs'
import { createFairtradeAdapter } from './fairtrade-adapter.mjs'
import * as targets from './fairtrade-targets.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CORPUS_REL = 'scripts/fairtest/product-target.testdata.yaml'
const MANIFEST_REL = 'scripts/fairtest/product-target.testdata.manifest.yaml'
const IMPL_FILES = ['fairtrade-adapter.mjs', 'fairtrade-targets.mjs']
const CHILD_MARKER = ['packages', 'fairtest'].join('/')
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])
const CHECKS = ['theme-row', 'route', 'section-action', 'capability', 'cross-kind', 'lifecycle', 'theme-inference']
const ROW_THEMES = ['dark', 'light']

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
  }
  coreFixtures.checkKeys(entry, fieldsByCheck[entry.check], 'case record', CORPUS_REL, path)
  if (!entry.expectValid) {
    checkFragmentList(entry.expectedErrorContains, CORPUS_REL, `${path}.expectedErrorContains`)
  }
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

const RUNNERS = {
  'theme-row': runThemeRowCase,
  route: runRouteCase,
  'section-action': runSectionActionCase,
  capability: runCapabilityCase,
  'cross-kind': runCrossKindCase,
  lifecycle: runLifecycleCase,
  'theme-inference': runThemeInferenceCase,
}

/** @param {Record<string, unknown>} entry */
function runCase(entry) {
  const runner = RUNNERS[entry.check]
  assert.ok(runner, `${CORPUS_REL}: case "${entry.name}" names an unknown check ${JSON.stringify(entry.check)}`)
  runner(entry)
}

/**
 * Validate mutated cases the way the owning guards do: exact shape plus
 * required names plus behavior, without the manifest count pin, so a removed
 * record fails on its missing required name.
 * @param {Record<string, unknown>[]} cases
 * @param {Record<string, unknown>} manifest
 */
function validateMutated(cases, manifest) {
  cases.forEach(checkCaseShape)
  coreFixtures.checkRequiredNames(cases.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS_REL)
  for (const entry of cases) {
    runCase(entry)
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
    if (!isRecord(node[segment])) node[segment] = {}
    node = /** @type {Record<string, unknown>} */ (node[segment])
  }
  node[segments.at(-1)] = structuredClone(mutation.value)
}

/**
 * Create a fake injected lifecycle driver with observable calls.
 * @param {object} [behavior] failure switches
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
      if (behavior.failStart) {
        running = true
        throw new Error('fake start failed mid-way')
      }
      running = true
    },
    async reset() {
      calls.resets += 1
    },
    async stop() {
      calls.stops += 1
      if (behavior.failStop) {
        throw new Error('fake stop failed')
      }
      running = false
    },
    async readiness() {
      return { ready: true }
    },
  }
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

  it('executes every named case', () => {
    for (const entry of /** @type {Record<string, unknown>[]} */ (parsed.cases)) {
      runCase(entry)
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

  it('fails every executable mutation for its intended field', () => {
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          coreFixtures.loadSingleDocument(`${corpusSource.trimEnd()}\n---\norphan: true\n`, CORPUS_REL)
        } else {
          const mutated = structuredClone(cases)
          applyMutation(mutated, mutation)
          validateMutated(mutated, manifest)
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
      chrome: '.iu-bar',
      body: '.iu-view',
      sectionNav: 'nav[aria-label="peasant sections"]',
      activeSection: 'nav[aria-label="peasant sections"] .iu-subnav-item[aria-current="page"]',
      sectionView: '#inuse-stage[role="tabpanel"]',
    })
    assert.equal(selected.initialSection, 'analytics')
    assert.deepEqual([...selected.sections], ['analytics', 'changes', 'map'])
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

describe('adapter source boundary', () => {
  it('loads child values only through the sole source route', () => {
    for (const file of IMPL_FILES) {
      const text = readFileSync(resolve(HERE, file), 'utf8')
      assert.ok(!text.includes(CHILD_MARKER), `${file}: names a second route into the private child at path import; repair: load child values only through ../fairtest-source.mjs.`)
      const specs = [...text.matchAll(/from\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
      assert.ok(specs.length > 0, `${file}: holds no imports`)
      for (const spec of specs) {
        const allowed = spec.startsWith('node:') || spec === '../fairtest-source.mjs' || spec === './fairtrade-targets.mjs'
        assert.ok(allowed, `${file}: import ${JSON.stringify(spec)} bypasses the sole source route at path import; repair: import child values through ../fairtest-source.mjs.`)
      }
      const dynamic = [...text.matchAll(/importFairtestSource\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1])
      for (const spec of dynamic) {
        assert.ok(spec.startsWith('src/'), `${file}: source spec ${JSON.stringify(spec)} escapes the child tree at path import; repair: use a child-relative src/ path.`)
      }
    }
  })

  it('carries no runner, live-handle, or host-global literal', () => {
    const forbidden = ['playwright', 'puppeteer', 'jsdom', 'storybook', 'agent-browser', 'window', 'document', 'locator', 'globalThis', 'querySelector', 'createElement']
    for (const file of IMPL_FILES) {
      const text = readFileSync(resolve(HERE, file), 'utf8')
      for (const token of forbidden) {
        assert.ok(!text.includes(token), `${file}: names forbidden material ${JSON.stringify(token)} at path ${file}; repair: keep runner and host-global material in the injected driver.`)
      }
    }
  })

  it('keeps the existing boundary and source guards green', () => {
    const boundary = execFileSync('node', ['scripts/assert-fairtest-boundary.mjs'], { cwd: ROOT, encoding: 'utf8' })
    assert.match(boundary, /passed/, 'boundary guard must stay green')
    const smoke = execFileSync('node', ['scripts/fairtest-source.mjs', '--smoke'], { cwd: ROOT, encoding: 'utf8' })
    assert.match(smoke, /checks behaved/, 'source route smoke must stay green')
  })
})
