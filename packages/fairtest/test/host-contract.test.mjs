// Host-contract tests. Every behavioral case lives in a named YAML fixture
// family with a required-name manifest; this file owns no case data except
// small structural unit asserts. Imports the real child source and runs
// browser-free with node builtins plus the declared yaml dependency. No
// service, runner, or network is required.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, sep } from 'node:path'
import { describe, it } from 'node:test'
import { assertExactFields, checkRequiredNames, loadSingleDocument } from '../src/core/index.mjs'
import {
  COMPONENT_CAPABILITIES,
  COMPONENT_REQUIRED_CAPABILITIES,
  HOST_KINDS,
  LIFECYCLE_STAGES,
  PRODUCT_CAPABILITIES,
  PRODUCT_ONLY_FIELDS,
  PRODUCT_REQUIRED_CAPABILITIES,
  THEME_NAMES,
  assertHostKind,
  capabilitiesFor,
  createTargetDeclaration,
  requiredCapabilitiesFor,
  requiresCapability,
  validateComponentResolution,
  validateLifecycleTrace,
  validateMountedRoot,
  validateNamedResult,
  validateObservedPart,
  validateOpaqueHandle,
  validateProductResolution,
  validateResolution,
  validateTargetDeclaration,
  validateTargetIdentity,
  validateThemeObservation,
} from '../src/host-contract/index.mjs'

const TESTDATA = new URL('../testdata/', import.meta.url)
const CONTRACT_DIR = new URL('../src/host-contract/', import.meta.url)
const CHILD_ROOT = new URL('..', import.meta.url)
const CHILD_MANIFEST = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])

const FAMILIES = [
  { id: 'targets', corpus: 'host-contract-targets.yaml', manifest: 'host-contract-targets.manifest.yaml' },
  { id: 'resolution', corpus: 'host-contract-resolution.yaml', manifest: 'host-contract-resolution.manifest.yaml' },
  { id: 'handles', corpus: 'host-contract-handles.yaml', manifest: 'host-contract-handles.manifest.yaml' },
]

/** @returns {Record<string, unknown>} */
function readFamily(relative) {
  return /** @type {Record<string, unknown>} */ (loadSingleDocument(readFileSync(new URL(relative, TESTDATA), 'utf8'), relative))
}

function readSource(relative) {
  return readFileSync(new URL(relative, TESTDATA), 'utf8')
}

function contractSourceFiles() {
  return readdirSync(CONTRACT_DIR).filter((entry) => entry.endsWith('.mjs')).sort()
}

function contractSourceText() {
  return contractSourceFiles().map((entry) => readFileSync(new URL(entry, CONTRACT_DIR), 'utf8')).join('\n')
}

/** @param {unknown} value */
function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {string} label
 */
function validateManifest(manifest, label) {
  assertExactFields(manifest, ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], label, 'manifest')
  assert.equal(typeof manifest.expectedCaseCount, 'number', `${label}: manifest expectedCaseCount must be a number`)
  assert.equal(typeof manifest.expectedMutationCount, 'number', `${label}: manifest expectedMutationCount must be a number`)
  for (const key of ['requiredCaseNames', 'requiredMutationNames', 'mutations']) {
    assert.ok(Array.isArray(manifest[key]), `${label}: manifest ${key} must be a list`)
  }
  const cases = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(cases).size, cases.length, `${label}: required case names must be unique`)
  assert.equal(manifest.expectedCaseCount, cases.length, `${label}: case count must equal the required-name inventory`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${label}: mutation count must equal the mutation inventory`)
  const mutationNames = mutations.map((entry) => entry.name)
  checkRequiredNames(mutationNames, /** @type {string[]} */ (manifest.requiredMutationNames), label)
  for (const [index, mutation] of mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('value')
    assertExactFields(mutation, fields, label, `manifest.mutations[${index}]`)
    assert.ok(MUTATION_KINDS.has(/** @type {string} */ (mutation.kind)), `${label}: mutation ${index} names an unknown kind`)
    assert.ok(typeof mutation.expectedField === 'string' && mutation.expectedField.length > 0, `${label}: mutation ${index} must name its expected field`)
    if (mutation.kind === 'trailing-document') {
      assert.equal(mutation.target, 'document', `${label}: mutation ${index} trailing-document targets the document`)
    } else {
      assert.ok(cases.includes(/** @type {string} */ (mutation.target)), `${label}: mutation ${index} targets an unknown case`)
    }
  }
}

/**
 * @param {Record<string, unknown>[]} cases
 * @param {Record<string, unknown>} manifest
 * @param {string} label
 * @param {(value: Record<string, unknown>, index: number) => void} validateCase
 */
function validateFamily(cases, manifest, label, validateCase) {
  assert.equal(cases.length, manifest.expectedCaseCount, `${label}: case count must match the manifest`)
  checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), label)
  cases.forEach(validateCase)
}

/** @param {Record<string, unknown>} value */
function checkCaseName(value, label, index) {
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new Error(`${label}: case ${index} is missing its required name at path cases[${index}].name; repair: restore the required case name.`)
  }
}

/** @param {Record<string, unknown>} value @param {string} key */
function checkDiscriminator(value, key, kinds, label, index) {
  const actual = value[key]
  if (!kinds.includes(/** @type {string} */ (actual))) {
    throw new Error(`${label}: case "${value.name}" names an unknown discriminator ${JSON.stringify(actual)} for field "${key}" at path cases[${index}].${key}; repair: use one of ${kinds.join(', ')} for "${key}".`)
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
 * @param {string} source
 * @param {Record<string, unknown>} parsed
 * @param {Record<string, unknown>} manifest
 * @param {string} label
 * @param {(value: Record<string, unknown>) => void} validate
 */
function runMutations(source, parsed, manifest, label, validate) {
  for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
    let message = null
    try {
      if (mutation.kind === 'trailing-document') {
        loadSingleDocument(`${source.trimEnd()}\n---\norphan: true\n`, label)
      } else {
        const cases = structuredClone(/** @type {Record<string, unknown>[]} */ (parsed.cases))
        applyMutation(cases, mutation)
        validate({ ...parsed, cases })
        checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), label)
      }
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, `${label}: mutation "${mutation.name}" passed validation instead of failing`)
    assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${label}: mutation "${mutation.name}" names the wrong field; got ${message}`)
    assert.ok(message.includes('at path'), `${label}: mutation "${mutation.name}" is missing path context: ${message}`)
    assert.ok(message.includes('repair:'), `${label}: mutation "${mutation.name}" is missing repair guidance: ${message}`)
  }
}

/** @param {unknown} value @param {string} label @param {string} path */
function checkFragmentList(value, label, path) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`${label}: expected a non-empty string list at path ${path}; repair: restore the diagnostic fragment list at ${path}.`)
  }
}

/** @param {string[]} fragments @param {string} message @param {string} name */
function expectFragments(fragments, message, name) {
  for (const fragment of fragments) {
    assert.ok(message.includes(fragment), `${name}: diagnostic is missing ${JSON.stringify(fragment)}; got ${message}`)
  }
}

/** @param {unknown} created @param {string} name @param {string} kind */
function expectFrozenRecord(created, name, kind) {
  assert.ok(created && typeof created === 'object', `${name}: expected a ${kind} record`)
  assert.ok(Object.isFrozen(created), `${name}: ${kind} must be frozen`)
}

// ── targets family ───────────────────────────────────────────────────────────

const TARGET_CHECKS = ['target-product', 'target-component', 'lifecycle']

/** @param {Record<string, unknown>} value */
function validateTargetsFamily(value) {
  const label = 'host-contract-targets.yaml'
  assertExactFields(value, ['expectedCaseCount', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no cases at path cases; repair: restore the named cases list.`)
  for (const [index, entry] of cases.entries()) {
    checkCaseName(entry, label, index)
    checkDiscriminator(entry, 'check', TARGET_CHECKS, label, index)
    const path = `cases[${index}]`
    const payload = entry.check === 'lifecycle' ? 'trace' : 'declaration'
    if (entry.expectValid) {
      assertExactFields(entry, ['name', 'check', payload, 'expectValid', 'expectFrozen'], label, path)
    } else {
      assertExactFields(entry, ['name', 'check', payload, 'expectValid', 'expectedErrorContains'], label, path)
      checkFragmentList(entry.expectedErrorContains, label, `${path}.expectedErrorContains`)
    }
  }
}

/** @param {Record<string, unknown>} entry */
function runTargetsCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    let created = null
    if (entry.check === 'lifecycle') {
      created = validateLifecycleTrace(entry.trace, name)
    } else {
      created = validateTargetDeclaration(entry.declaration, name)
      assert.equal(created.kind, entry.check === 'target-product' ? 'product' : 'component', `${name}: declaration kind must match the case branch`)
    }
    expectFrozenRecord(created, name, 'target')
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid target failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid target passed validation`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

// ── resolution family ────────────────────────────────────────────────────────

const RESOLUTION_CHECKS = ['resolution-product', 'resolution-component']

/** @param {Record<string, unknown>} value */
function validateResolutionFamily(value) {
  const label = 'host-contract-resolution.yaml'
  assertExactFields(value, ['expectedCaseCount', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no cases at path cases; repair: restore the named cases list.`)
  for (const [index, entry] of cases.entries()) {
    checkCaseName(entry, label, index)
    checkDiscriminator(entry, 'check', RESOLUTION_CHECKS, label, index)
    const path = `cases[${index}]`
    if (entry.expectValid) {
      assertExactFields(entry, ['name', 'check', 'record', 'expectValid', 'expectFrozen'], label, path)
    } else {
      assertExactFields(entry, ['name', 'check', 'record', 'expectValid', 'expectedErrorContains'], label, path)
      checkFragmentList(entry.expectedErrorContains, label, `${path}.expectedErrorContains`)
    }
  }
}

/** @param {Record<string, unknown>} entry */
function runResolutionCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    const created = entry.check === 'resolution-product'
      ? validateProductResolution(entry.record, name)
      : validateComponentResolution(entry.record, name)
    assert.equal(created.kind, entry.check === 'resolution-product' ? 'product' : 'component', `${name}: resolution kind must match the case branch`)
    expectFrozenRecord(created, name, 'resolution')
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid resolution failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid resolution passed validation`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

// ── handles family ───────────────────────────────────────────────────────────

const HANDLE_CHECKS = ['handle']

/** @param {Record<string, unknown>} value */
function validateHandlesFamily(value) {
  const label = 'host-contract-handles.yaml'
  assertExactFields(value, ['expectedCaseCount', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no cases at path cases; repair: restore the named cases list.`)
  for (const [index, entry] of cases.entries()) {
    checkCaseName(entry, label, index)
    checkDiscriminator(entry, 'check', HANDLE_CHECKS, label, index)
    const path = `cases[${index}]`
    if (entry.expectValid) {
      assertExactFields(entry, ['name', 'check', 'record', 'expectValid', 'expectFrozen'], label, path)
    } else {
      assertExactFields(entry, ['name', 'check', 'record', 'expectValid', 'expectedErrorContains'], label, path)
      checkFragmentList(entry.expectedErrorContains, label, `${path}.expectedErrorContains`)
    }
  }
}

/** @param {Record<string, unknown>} entry */
function runHandlesCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    expectFrozenRecord(validateOpaqueHandle(entry.record, name), name, 'handle')
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid handle failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid handle passed validation`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

// ── family wiring ────────────────────────────────────────────────────────────

const VALIDATORS = {
  targets: validateTargetsFamily,
  resolution: validateResolutionFamily,
  handles: validateHandlesFamily,
}
const RUNNERS = {
  targets: runTargetsCase,
  resolution: runResolutionCase,
  handles: runHandlesCase,
}

for (const family of FAMILIES) {
  describe(`host-contract fixture family ${family.id}`, () => {
    const source = readSource(family.corpus)
    const manifest = readFamily(family.manifest)
    const parsed = readFamily(family.corpus)
    const validateShape = VALIDATORS[family.id]
    const runCase = RUNNERS[family.id]
    const validate = (value) => {
      validateShape(value)
      for (const entry of /** @type {Record<string, unknown>[]} */ (value.cases)) runCase(entry)
    }

    it('holds a valid manifest inventory', () => {
      validateManifest(manifest, family.manifest)
    })

    it('holds exact fields and required names', () => {
      validateShape(parsed)
      validateFamily(/** @type {Record<string, unknown>[]} */ (parsed.cases), manifest, family.corpus, (entry) => validateShape({ ...parsed, cases: [entry], expectedCaseCount: 1 }))
    })

    it('executes every behavioral case', () => {
      for (const entry of /** @type {Record<string, unknown>[]} */ (parsed.cases)) runCase(entry)
    })

    it('fails every executable mutation for its intended field', () => {
      runMutations(source, parsed, manifest, family.corpus, validate)
    })
  })
}

// ── structural unit asserts (no combinatorial data) ──────────────────────────

describe('host-contract structural units', () => {
  it('imports the real child source and stays Node-only', () => {
    for (const fn of [assertHostKind, validateThemeObservation, validateTargetIdentity, validateTargetDeclaration, createTargetDeclaration, validateLifecycleTrace, validateProductResolution, validateComponentResolution, validateResolution, validateOpaqueHandle]) {
      assert.equal(typeof fn, 'function', 'host-contract barrel must export every validator')
    }
    assert.deepEqual([...HOST_KINDS], ['product', 'component'])
    assert.deepEqual([...THEME_NAMES], ['dark', 'light'])
    assert.equal(typeof window, 'undefined', 'contract must not load a window global')
    assert.equal(typeof document, 'undefined', 'contract must not load a document global')
    assert.ok(!('window' in globalThis) && !('document' in globalThis), 'contract must not install browser globals')
    // navigator ships with Node itself; the isolation scan below proves the contract never names it.
  })

  it('rejects live references YAML cannot express', () => {
    assert.throws(() => validateOpaqueHandle({ token: () => 'live', revoked: false }, 'probe'), /token.*at path.*repair:/s, 'function token must fail as unsafe')
    class LiveHandle {
      constructor() {
        this.token = 'synthetic-handle-a'
        this.revoked = false
      }
    }
    assert.throws(() => validateOpaqueHandle(new LiveHandle(), 'probe'), /record.*at path.*repair:/s, 'instance handle must fail as a non-record')
    assert.throws(() => validateProductResolution([], 'probe'), /record.*at path.*repair:/s, 'list resolution must fail as a non-record')
    assert.throws(() => validateComponentResolution(null, 'probe'), /record.*at path.*repair:/s, 'null resolution must fail as a non-record')
  })

  it('routes the closed resolution union through one dispatcher', () => {
    const product = validateResolution({
      kind: 'product',
      identity: { kind: 'product', id: 'product-row-a', createdAtMs: 1000 },
      chrome: { observed: true, observedAtMs: 1000 },
      body: { observed: true, observedAtMs: 1000 },
      route: { observed: true, observedAtMs: 1000 },
      activeSection: { observed: true, observedAtMs: 1000 },
      view: { observed: true, observedAtMs: 1000 },
      theme: { expected: 'dark', observed: 'dark', source: 'synthetic-host-a', observedAtMs: 1000 },
    }, 'probe')
    assert.equal(product.kind, 'product')
    const component = validateResolution({
      kind: 'component',
      identity: { kind: 'component', id: 'component-row-a', createdAtMs: 1000 },
      root: { mounted: true, observedAtMs: 1000 },
      theme: { expected: 'light', observed: 'light', source: 'synthetic-host-a', observedAtMs: 1000 },
    }, 'probe')
    assert.equal(component.kind, 'component')
    assert.throws(() => validateResolution({ kind: 'invented', identity: {} }, 'probe'), /kind.*at path.*repair:/s, 'unknown resolution kind must fail closed')
  })

  it('answers capability questions from validated declarations only', () => {
    const declaration = createTargetDeclaration({
      kind: 'product',
      identity: { kind: 'product', id: 'product-target-a', createdAtMs: 1000 },
      capabilities: [...PRODUCT_REQUIRED_CAPABILITIES],
      fixtures: ['synthetic-fixture-a'],
      actions: [],
    })
    assert.equal(requiresCapability(declaration, 'observe-route'), true)
    assert.equal(requiresCapability(declaration, 'observe-root'), false)
    assert.deepEqual([...capabilitiesFor('product')], [...PRODUCT_CAPABILITIES])
    assert.deepEqual([...requiredCapabilitiesFor('component')], [...COMPONENT_REQUIRED_CAPABILITIES])
    assert.ok(COMPONENT_CAPABILITIES.includes('observe-theme'), 'both kinds share the theme observation capability')
    assert.throws(() => requiresCapability({ ...declaration, capabilities: [] }, 'observe-route'), /capabilities.*at path.*repair:/s, 'capability questions must revalidate the declaration')
  })

  it('keeps part, root, and result units composable', () => {
    assert.deepEqual(validateObservedPart({ observed: true, observedAtMs: 1000 }, 'probe', 'probe.part'), { observed: true, observedAtMs: 1000 })
    assert.deepEqual(validateMountedRoot({ mounted: true, observedAtMs: 1000 }, 'probe', 'probe.root'), { mounted: true, observedAtMs: 1000 })
    assert.deepEqual(
      validateNamedResult({ name: 'synthetic-action-a', completed: true, observedAtMs: 2000 }, 'probe', 'probe.result'),
      { name: 'synthetic-action-a', completed: true, observedAtMs: 2000 },
    )
    assert.deepEqual([...PRODUCT_ONLY_FIELDS], ['chrome', 'body', 'route', 'activeSection', 'view'])
    assert.deepEqual([...LIFECYCLE_STAGES], ['declared', 'acquired', 'ready', 'released'])
  })

  it('pins the adapter command to this contract test', () => {
    assert.ok(
      String(CHILD_MANIFEST.scripts?.['test:adapter'] ?? '').includes('test/host-contract.test.mjs'),
      'test:adapter must run the host-contract test file',
    )
  })
})

// ── isolation: imports, literals, fixture scalars ────────────────────────────

const FORBIDDEN = [
  /playwright|puppeteer|jsdom|storybook|agent-browser/i,
  /\bwindow\b|\bnavigator\b|\bglobalThis\b/,
  /document\s*\.\s*(createElement|querySelector|querySelectorAll|getElementById|body|head|documentElement|addEventListener|cookie|title|write|location)/i,
  /fairtrade|inuse|transcript|disclosure/i,
  /localhost|127\.0\.0\.1|https?:\/\//,
  /#inuse|\[data-|\?app=/,
  /:\d{4}(?!\d)/,
]

/** @param {string} text */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/** @param {unknown} value @param {(text: string) => void} visit */
function walkScalars(value, visit) {
  if (typeof value === 'string') {
    visit(value)
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) walkScalars(entry, visit)
    return
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      visit(key)
      walkScalars(value[key], visit)
    }
  }
}

describe('host-contract isolation', () => {
  it('declares only relative and node imports', () => {
    for (const entry of contractSourceFiles()) {
      const text = readFileSync(new URL(entry, CONTRACT_DIR), 'utf8')
      const code = stripComments(text)
      assert.ok(!code.includes('require('), `${entry}: require() calls are not allowed in the host contract`)
      assert.ok(!/import\s*\(/.test(code), `${entry}: dynamic import() is not allowed in the host contract`)
      for (const match of text.matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)) {
        const specifier = match[1]
        if (specifier.startsWith('node:')) continue
        assert.ok(
          /^\.\/[A-Za-z-]+\.mjs$/.test(specifier) || /^\.\.\/core\/[A-Za-z]+\.mjs$/.test(specifier),
          `${entry}: import ${JSON.stringify(specifier)} escapes the contract and neutral core`,
        )
      }
    }
  })

  it('re-exports every contract module through the barrel', () => {
    const index = readFileSync(new URL('index.mjs', CONTRACT_DIR), 'utf8')
    for (const entry of contractSourceFiles()) {
      if (entry === 'index.mjs') continue
      assert.ok(index.includes(`./${entry}`), `barrel must re-export ${entry}`)
    }
  })

  it('carries no runner, document, app, or network literal', () => {
    for (const entry of contractSourceFiles()) {
      const text = readFileSync(new URL(entry, CONTRACT_DIR), 'utf8')
      for (const pattern of FORBIDDEN) {
        assert.ok(!pattern.test(text), `${entry}: source names forbidden material ${pattern}`)
      }
    }
    for (const family of FAMILIES) {
      for (const relative of [family.corpus, family.manifest]) {
        const text = readSource(relative)
        for (const pattern of FORBIDDEN) {
          assert.ok(!pattern.test(text), `${relative}: fixture names forbidden material ${pattern}`)
        }
      }
    }
  })

  it('keeps every fixture scalar free of route, selector, and address shapes', () => {
    for (const family of FAMILIES) {
      for (const relative of [family.corpus, family.manifest]) {
        const parsed = readFamily(relative)
        walkScalars(parsed, (text) => {
          assert.ok(!text.startsWith('/'), `${relative}: scalar ${JSON.stringify(text)} looks like a path`)
          assert.ok(!text.startsWith('#') && !text.startsWith('['), `${relative}: scalar ${JSON.stringify(text)} looks like a selector`)
          assert.ok(!text.includes('://'), `${relative}: scalar ${JSON.stringify(text)} looks like an address`)
        })
      }
    }
  })
})

// ── external-root execution without runner packages ──────────────────────────

describe('host-contract external root', () => {
  it('runs from a temporary root with no runner packages present', () => {
    const external = mkdtempSync(join(tmpdir(), 'fairtest-host-external-'))
    try {
      mkdirSync(join(external, 'core'), { recursive: true })
      mkdirSync(join(external, 'host-contract'), { recursive: true })
      for (const entry of readdirSync(new URL('src/core/', CHILD_ROOT)).filter((name) => name.endsWith('.mjs')).sort()) {
        copyFileSync(new URL(`src/core/${entry}`, CHILD_ROOT), join(external, 'core', basename(entry)))
      }
      for (const entry of contractSourceFiles()) {
        copyFileSync(new URL(entry, CONTRACT_DIR), join(external, 'host-contract', basename(entry)))
      }
      writeFileSync(join(external, 'smoke.mjs'), [
        "import { realpathSync } from 'node:fs'",
        "import * as contract from './host-contract/index.mjs'",
        "const target = contract.validateTargetDeclaration({ kind: 'product',",
        "  identity: { kind: 'product', id: 'product-target-a', createdAtMs: 1000 },",
        "  capabilities: [...contract.PRODUCT_REQUIRED_CAPABILITIES],",
        "  fixtures: ['synthetic-fixture-a'], actions: [] }, 'smoke')",
        "if (target.kind !== 'product' || !Object.isFrozen(target)) throw new Error('external smoke target failed')",
        "const resolution = contract.validateResolution({ kind: 'component',",
        "  identity: { kind: 'component', id: 'component-row-a', createdAtMs: 1000 },",
        "  root: { mounted: true, observedAtMs: 1000 },",
        "  theme: { expected: 'dark', observed: 'dark', source: 'synthetic-host-a', observedAtMs: 1000 } }, 'smoke')",
        "if (resolution.kind !== 'component' || !Object.isFrozen(resolution)) throw new Error('external smoke resolution failed')",
        "contract.validateLifecycleTrace({ stages: ['declared', 'acquired'] }, 'smoke')",
        "contract.validateOpaqueHandle({ token: 'synthetic-handle-a', revoked: false }, 'smoke')",
        "let crossKindFailed = false",
        "try { contract.validateComponentResolution({ ...resolution, chrome: { observed: true, observedAtMs: 1000 } }, 'smoke') } catch { crossKindFailed = true }",
        "if (!crossKindFailed) throw new Error('external smoke cross-kind passed instead of failing')",
        "const here = realpathSync(new URL('./host-contract/index.mjs', import.meta.url))",
        "console.log(JSON.stringify({ ok: true, here }))",
        '',
      ].join('\n'))
      const stdout = execFileSync('node', [join(external, 'smoke.mjs')], { cwd: external, encoding: 'utf8' })
      const receipt = JSON.parse(stdout.trim().split('\n').at(-1))
      assert.equal(receipt.ok, true, 'external smoke must pass from the temporary root')
      assert.ok(receipt.here.startsWith(realpathSync(external) + sep), `external module resolved to ${receipt.here}, outside ${external}`)
    } finally {
      rmSync(external, { recursive: true, force: true })
    }
  })
})
