// Evidence contract tests. Every behavioral case lives in the named
// evidence-contract YAML family with a required-name manifest; this file
// owns no case data except small structural unit asserts. Composes the real
// core identity and evidence primitives without a browser, service, runner,
// or network.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  assertExactFields,
  assertFresh,
  checkDuplicate,
  checkRequiredNames,
  createDuplicateSet,
  createEvidenceRecord,
  createIdentity,
  isFresh,
  loadSingleDocument,
} from '../src/core/index.mjs'

const TESTDATA = new URL('../testdata/', import.meta.url)
const CORE_DIR = new URL('../src/core/', import.meta.url)
const CHILD_MANIFEST = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])
const CORPUS = 'evidence-contract.yaml'
const MANIFEST = 'evidence-contract.manifest.yaml'

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
    const actual = entry.check
    if (!['bound-record', 'duplicate', 'fresh'].includes(/** @type {string} */ (actual))) {
      throw new Error(`${label}: case "${entry.name}" names an unknown discriminator ${JSON.stringify(actual)} for field "check" at path cases[${index}].check; repair: use one of bound-record, duplicate, fresh for "check".`)
    }
    const path = `cases[${index}]`
    if (entry.check === 'bound-record') {
      assertExactFields(entry, ['name', 'check', 'identity', 'record', 'expectValid', ...(entry.expectValid ? [] : ['expectedErrorContains'])], label, path)
    } else if (entry.check === 'duplicate') {
      assertExactFields(entry, ['name', 'check', 'scope', 'digests', 'expectDuplicates'], label, path)
    } else {
      assertExactFields(entry, ['name', 'check', 'observedAtMs', 'nowMs', 'maxAgeMs', 'expectFresh'], label, path)
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
  if (entry.check === 'duplicate') {
    let set = createDuplicateSet(/** @type {string} */ (entry.scope))
    const digests = /** @type {string[]} */ (entry.digests)
    const outcomes = /** @type {boolean[]} */ (entry.expectDuplicates)
    assert.equal(digests.length, outcomes.length, `${name}: every digest must pair with an outcome`)
    digests.forEach((digest, index) => {
      const checked = checkDuplicate(set, digest)
      assert.equal(checked.duplicate, outcomes[index], `${name}: digest ${index} duplicate mismatch`)
      assert.ok(Object.isFrozen(checked.updated), `${name}: updated set must be frozen`)
      set = checked.updated
    })
    return
  }
  if (entry.check === 'fresh') {
    const fresh = isFresh(/** @type {number} */ (entry.observedAtMs), /** @type {number} */ (entry.nowMs), /** @type {number} */ (entry.maxAgeMs))
    assert.equal(fresh, entry.expectFresh, `${name}: freshness mismatch`)
    return
  }
  let message = null
  try {
    const identity = createIdentity(/** @type {never} */ (entry.identity))
    const record = createEvidenceRecord(/** @type {never} */ (entry.record))
    assert.ok(Object.isFrozen(identity) && Object.isFrozen(record), `${name}: identity and record must be frozen`)
    if (record.identityId !== identity.id) {
      throw new Error(`${name}: record identity ${JSON.stringify(record.identityId)} does not bind identity ${JSON.stringify(identity.id)} at path record.identityId; repair: persist the owning identity id in record.identityId.`)
    }
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid bound record failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid bound record passed validation`)
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

describe('evidence contract fixture family', () => {
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

describe('evidence contract structural units', () => {
  it('pins the evidence command to this contract test', () => {
    assert.ok(
      String(CHILD_MANIFEST.scripts?.['test:evidence'] ?? '').includes('test/evidence.test.mjs'),
      'test:evidence must run the evidence contract test file',
    )
  })

  it('binds stale clocks to assertFresh with actionable diagnostics', () => {
    const stale = /** @type {Record<string, unknown>} */ (readFamily(CORPUS).cases.find((entry) => /** @type {Record<string, unknown>} */ (entry).name === 'fresh-stale-clock'))
    assert.throws(
      () => assertFresh(/** @type {number} */ (stale.observedAtMs), /** @type {number} */ (stale.nowMs), /** @type {number} */ (stale.maxAgeMs), 'probe'),
      /observedAtMs.*repair:/s,
      'stale contract clock must fail assertFresh',
    )
  })

  it('imports only node builtins and neutral core modules', () => {
    const self = readFileSync(new URL(import.meta.url), 'utf8')
    const specifiers = [...self.matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
    assert.ok(specifiers.length > 0, 'evidence contract test must declare its imports statically')
    for (const specifier of specifiers) {
      if (specifier.startsWith('node:')) continue
      assert.ok(specifier.startsWith('../src/core/'), `evidence contract test import ${JSON.stringify(specifier)} escapes neutral core`)
    }
  })

  it('keeps core fixture helpers free of browser globals', () => {
    assert.equal(typeof window, 'undefined', 'contract must not load a window global')
    assert.equal(typeof document, 'undefined', 'contract must not load a document global')
    const names = readdirSync(CORE_DIR).filter((entry) => entry.endsWith('.mjs')).sort()
    assert.ok(names.includes('evidence.mjs'), 'neutral core must keep the evidence module')
  })
})
