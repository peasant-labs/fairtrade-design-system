// Bridge contract tests. Every behavioral case lives in the named
// bridge-contract YAML family with a required-name manifest; this file owns
// no case data except small structural unit asserts. Imports the real child
// source and runs browser-free with node builtins plus the declared yaml
// dependency. No service, runner, process, or network is required.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'
import { assertExactFields, checkRequiredNames, loadSingleDocument } from '../src/core/index.mjs'
import {
  BRIDGE_CAPABILITIES,
  BRIDGE_IDENTITY_KINDS,
  BRIDGE_REQUIRED_CAPABILITIES,
  BRIDGE_SIGNALS,
  assertBridgeKind,
  createBridgeDeclaration,
  requiresBridgeCapability,
  validateBridgeCleanup,
  validateBridgeDeclaration,
  validateBridgeIdentity,
  validateBridgeReadiness,
  validateCoreIdentityForBridge,
} from '../src/host-contract/index.mjs'

const TESTDATA = new URL('../testdata/', import.meta.url)
const CONTRACT_DIR = new URL('../src/host-contract/', import.meta.url)
const CHILD_MANIFEST = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])
const CORPUS = 'bridge-contract.yaml'
const MANIFEST = 'bridge-contract.manifest.yaml'
const CHECKS = ['identity', 'declaration', 'readiness', 'cleanup']

/** @returns {Record<string, unknown>} */
function readFamily(relative) {
  return /** @type {Record<string, unknown>} */ (loadSingleDocument(readFileSync(new URL(relative, TESTDATA), 'utf8'), relative))
}

function readSource(relative) {
  return readFileSync(new URL(relative, TESTDATA), 'utf8')
}

/** @param {unknown} value */
function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** @param {Record<string, unknown>} manifest @param {string} label */
function validateManifest(manifest, label) {
  assertExactFields(manifest, ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], label, 'manifest')
  const cases = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(cases).size, cases.length, `${label}: required case names must be unique`)
  assert.equal(manifest.expectedCaseCount, cases.length, `${label}: case count must equal the required-name inventory`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${label}: mutation count must equal the mutation inventory`)
  checkRequiredNames(mutations.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredMutationNames), label)
  for (const [index, mutation] of mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('value')
    assertExactFields(mutation, fields, label, `manifest.mutations[${index}]`)
    assert.ok(MUTATION_KINDS.has(/** @type {string} */ (mutation.kind)), `${label}: mutation ${index} names an unknown kind`)
    if (mutation.kind === 'trailing-document') {
      assert.equal(mutation.target, 'document', `${label}: mutation ${index} trailing-document targets the document`)
    } else {
      assert.ok(cases.includes(/** @type {string} */ (mutation.target)), `${label}: mutation ${index} targets an unknown case`)
    }
  }
}

/** @param {Record<string, unknown>} value @param {string} label @param {number} index */
function checkCaseName(value, label, index) {
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new Error(`${label}: case ${index} is missing its required name at path cases[${index}].name; repair: restore the required case name.`)
  }
}

/** @param {Record<string, unknown>} value */
function validateFamilyShape(value) {
  const label = CORPUS
  assertExactFields(value, ['expectedCaseCount', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no cases at path cases; repair: restore the named cases list.`)
  for (const [index, entry] of cases.entries()) {
    checkCaseName(entry, label, index)
    if (!CHECKS.includes(/** @type {string} */ (entry.check))) {
      throw new Error(`${label}: case "${entry.name}" names an unknown discriminator ${JSON.stringify(entry.check)} for field "check" at path cases[${index}].check; repair: use one of ${CHECKS.join(', ')} for "check".`)
    }
    const path = `cases[${index}]`
    const payload = entry.check === 'identity' ? 'identity' : entry.check
    if (entry.expectValid) {
      assertExactFields(entry, ['name', 'check', payload, 'expectValid'], label, path)
    } else {
      assertExactFields(entry, ['name', 'check', payload, 'expectValid', 'expectedErrorContains'], label, path)
      const fragments = entry.expectedErrorContains
      if (!Array.isArray(fragments) || fragments.length === 0 || fragments.some((fragment) => typeof fragment !== 'string' || fragment.length === 0)) {
        throw new Error(`${label}: expected a non-empty string list at path ${path}.expectedErrorContains; repair: restore the diagnostic fragment list at ${path}.expectedErrorContains.`)
      }
    }
  }
}

/** @param {string[]} fragments @param {string} message @param {string} name */
function expectFragments(fragments, message, name) {
  for (const fragment of fragments) {
    assert.ok(message.includes(fragment), `${name}: diagnostic is missing ${JSON.stringify(fragment)}; got ${message}`)
  }
}

/** @param {Record<string, unknown>} entry */
function runCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    let created = null
    if (entry.check === 'identity') {
      created = validateBridgeIdentity(entry.identity, name)
      assertBridgeKind(created.kind, 'probe')
    } else if (entry.check === 'declaration') {
      created = validateBridgeDeclaration(entry.declaration, name)
    } else if (entry.check === 'readiness') {
      created = validateBridgeReadiness(entry.readiness, name)
    } else {
      created = validateBridgeCleanup(entry.cleanup, name)
    }
    assert.ok(Object.isFrozen(created), `${name}: bridge record must be frozen`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid bridge record failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid bridge record passed validation`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
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

describe('bridge contract fixture family', () => {
  const source = readSource(CORPUS)
  const manifest = readFamily(MANIFEST)
  const parsed = readFamily(CORPUS)

  it('holds a valid manifest inventory', () => {
    validateManifest(manifest, MANIFEST)
  })

  it('holds exact fields and required names', () => {
    validateFamilyShape(parsed)
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    assert.equal(cases.length, manifest.expectedCaseCount, `${CORPUS}: case count must match the manifest`)
    checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
  })

  it('executes every behavioral case', () => {
    for (const entry of /** @type {Record<string, unknown>[]} */ (parsed.cases)) runCase(entry)
  })

  it('fails every executable mutation for its intended field', () => {
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          loadSingleDocument(`${source.trimEnd()}\n---\norphan: true\n`, CORPUS)
        } else {
          const cases = structuredClone(/** @type {Record<string, unknown>[]} */ (parsed.cases))
          applyMutation(cases, mutation)
          validateFamilyShape({ ...parsed, cases })
          checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
          for (const entry of cases) runCase(entry)
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${CORPUS}: mutation "${mutation.name}" passed validation instead of failing`)
      assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${CORPUS}: mutation "${mutation.name}" names the wrong field; got ${message}`)
      assert.ok(message.includes('at path'), `${CORPUS}: mutation "${mutation.name}" is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `${CORPUS}: mutation "${mutation.name}" is missing repair guidance: ${message}`)
    }
  })
})

describe('bridge contract structural units', () => {
  it('pins the bridge command to this contract test', () => {
    assert.ok(
      String(CHILD_MANIFEST.scripts?.['test:bridge-contract'] ?? '').includes('test/bridge-contract.test.mjs'),
      'test:bridge-contract must run the bridge contract test file',
    )
  })

  it('imports the real bridge source and stays Node-only', () => {
    for (const fn of [assertBridgeKind, createBridgeDeclaration, requiresBridgeCapability, validateBridgeCleanup, validateBridgeDeclaration, validateBridgeIdentity, validateBridgeReadiness, validateCoreIdentityForBridge]) {
      assert.equal(typeof fn, 'function', 'host-contract barrel must export every bridge validator')
    }
    assert.deepEqual([...BRIDGE_IDENTITY_KINDS], ['local', 'process'])
    assert.deepEqual([...BRIDGE_SIGNALS], ['completed', 'terminated', 'interrupted'])
    assert.ok(BRIDGE_CAPABILITIES.includes('report-readiness') && BRIDGE_REQUIRED_CAPABILITIES.includes('cleanup-process'), 'bridge capabilities must share the readiness and cleanup vocabulary')
    assert.equal(typeof window, 'undefined', 'contract must not load a window global')
    assert.equal(typeof document, 'undefined', 'contract must not load a document global')
  })

  it('answers capability questions from validated declarations only', () => {
    const declaration = createBridgeDeclaration({
      kind: 'process',
      identity: { kind: 'process', id: 'bridge-process-a', createdAtMs: 1000 },
      capabilities: ['describe-target', 'report-readiness', 'cleanup-process'],
    })
    assert.equal(requiresBridgeCapability(declaration, 'report-readiness'), true)
    assert.equal(requiresBridgeCapability(declaration, 'observe-route'), false)
    assert.throws(() => requiresBridgeCapability({ ...declaration, capabilities: [] }, 'report-readiness'), /capabilities.*at path.*repair:/s, 'capability questions must revalidate the declaration')
  })

  it('keeps bridge identities distinct from core identities', () => {
    const coreIdentity = validateCoreIdentityForBridge({ kind: 'run', id: 'contract-row-a', createdAtMs: 1000 }, 'probe')
    assert.equal(coreIdentity.kind, 'run')
    assert.throws(() => validateBridgeIdentity(coreIdentity, 'probe'), /bridge kind.*at path.*repair:/s, 'core identity must fail the bridge kind check')
  })

  it('carries no runner, live handle, endpoint, or address literal', () => {
    for (const entry of readdirSync(CONTRACT_DIR).filter((name) => name.endsWith('.mjs')).sort()) {
      if (entry !== 'bridge.mjs') continue
      const text = readFileSync(new URL(entry, CONTRACT_DIR), 'utf8')
      assert.ok(!/playwright|puppeteer|jsdom|storybook|agent-browser/i.test(text), `${entry}: source names a runner`)
      assert.ok(!/\bwindow\b|\bnavigator\b|\bglobalThis\b/.test(text), `${entry}: source names a page global`)
      assert.ok(!/localhost|127\.0\.0\.1|https?:\/\//.test(text), `${entry}: source names an endpoint literal`)
      assert.ok(!/:\d{4}(?!\d)/.test(text), `${entry}: source pins a numeric channel literal`)
    }
  })
})
