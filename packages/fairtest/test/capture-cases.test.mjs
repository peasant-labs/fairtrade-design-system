// @ts-check

// Capture-case contract tests. Every behavioral case lives in the named
// capture-cases YAML family with a required-name manifest; this file owns no
// case data. Composes the real child capture model without a browser, service,
// runner, or network.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { checkRequiredNames, loadSingleDocument } from '../src/core/index.mjs'
import { captureRowKey, captureRowTargets, loadCaptureCases, validateCaptureCases } from '../src/capture/index.mjs'

const TESTDATA = new URL('../testdata/', import.meta.url)
const CORPUS = 'capture-cases.yaml'
const MANIFEST = 'capture-cases.manifest.yaml'
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])

/** @param {string} relative @returns {string} */
function readSource(relative) {
  return readFileSync(new URL(relative, TESTDATA), 'utf8')
}

/** @param {string} relative @returns {Record<string, unknown>} */
function readFamily(relative) {
  return /** @type {Record<string, unknown>} */ (loadSingleDocument(readSource(relative), relative))
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
  for (const field of ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations']) {
    assert.ok(field in manifest, `${label}: manifest is missing ${field}`)
  }
  const cases = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(cases).size, cases.length, `${label}: required case names must be unique`)
  assert.equal(manifest.expectedCaseCount, cases.length, `${label}: case count must equal the required-name inventory`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${label}: mutation count must equal the mutation inventory`)
  checkRequiredNames(mutations.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredMutationNames), label)
  for (const mutation of mutations) {
    assert.ok(MUTATION_KINDS.has(/** @type {string} */ (mutation.kind)), `${label}: mutation ${String(mutation.name)} names an unknown kind`)
    if (mutation.kind === 'trailing-document') {
      assert.equal(mutation.target, 'document', `${label}: trailing-document targets the document`)
    } else {
      assert.ok(cases.includes(/** @type {string} */ (mutation.target)), `${label}: mutation ${String(mutation.name)} targets an unknown case`)
    }
  }
}

/**
 * @param {Record<string, unknown>[]} surfaces
 * @param {Record<string, unknown>} mutation
 */
function applyMutation(surfaces, mutation) {
  if (mutation.kind === 'duplicate-name') {
    const donor = surfaces.find((entry) => entry.id !== mutation.target) ?? surfaces[0]
    surfaces.push({ ...structuredClone(donor), id: mutation.target })
    return
  }
  if (mutation.kind === 'delete-record') {
    const index = surfaces.findIndex((entry) => entry.id === mutation.target)
    assert.notEqual(index, -1, `unknown mutation target ${String(mutation.target)}`)
    surfaces.splice(index, 1)
    return
  }
  const target = surfaces.find((entry) => entry.id === mutation.target)
  assert.ok(target, `unknown mutation target ${String(mutation.target)}`)
  const segments = String(mutation.field).split('.')
  if (mutation.kind === 'delete-field') {
    delete target[segments[segments.length - 1]]
    return
  }
  if (mutation.kind === 'rename-field') {
    const last = segments[segments.length - 1]
    const value = target[last]
    delete target[last]
    target[String(mutation.newField)] = value
    return
  }
  target[segments[segments.length - 1]] = structuredClone(mutation.value)
}

describe('capture cases fixture', () => {
  const manifest = readFamily(MANIFEST)
  const corpus = readFamily(CORPUS)

  it('loads the case document and matches the required surface inventory', () => {
    validateManifest(manifest, MANIFEST)
    const cases = loadCaptureCases(readSource(CORPUS), CORPUS)
    assert.ok(Object.isFrozen(cases), 'a validated case document must be frozen')
    checkRequiredNames(cases.surfaces.map((surface) => surface.id), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
    assert.deepEqual(cases.states, ['before', 'after'], 'the state order must be preserved')
    assert.deepEqual(cases.widths, [320, 1440], 'the width order must be preserved')
    assert.deepEqual(cases.themes, ['dark', 'light'], 'the theme order must be preserved')
  })

  it('expands one state into ordered row targets with surface-width-theme keys', () => {
    const cases = validateCaptureCases(corpus, CORPUS)
    const targets = captureRowTargets(cases, 'before')
    assert.equal(targets.length, 8, 'two surfaces x two widths x two themes must expand to eight rows')
    assert.equal(targets[0].key, 'alpha-controls--320--dark', 'the first row key must name surface, width, and theme')
    assert.equal(targets[7].key, 'beta-seg--1440--light', 'the last row key must name surface, width, and theme')
    assert.equal(captureRowKey('alpha-controls', 390, 'light'), 'alpha-controls--390--light', 'the row key must join surface, width, and theme')
    assert.ok(targets.every((target) => target.kind === 'component'), 'every surface kind must carry into its row target')
  })

  it('fails every named mutation for its intended field', () => {
    const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
    for (const mutation of mutations) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          loadSingleDocument(`${readSource(CORPUS).trimEnd()}\n---\norphan: true\n`, CORPUS)
        } else {
          const surfaces = structuredClone(/** @type {Record<string, unknown>[]} */ (corpus.surfaces))
          applyMutation(surfaces, mutation)
          const validated = validateCaptureCases({ ...corpus, surfaces }, CORPUS)
          checkRequiredNames(validated.surfaces.map((surface) => surface.id), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${String(mutation.name)}: mutated input passed validation instead of failing`)
      assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${String(mutation.name)}: diagnostic names the wrong field; got ${message}`)
      assert.ok(message.includes('at path'), `${String(mutation.name)}: diagnostic is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `${String(mutation.name)}: diagnostic is missing repair guidance: ${message}`)
    }
  })

  it('rejects a cross-kind host kind and an out-of-vocabulary theme', () => {
    assert.throws(() => validateCaptureCases({ ...corpus, themes: ['sepia'] }, CORPUS), /themes[\s\S]*at path[\s\S]*repair:/, 'an out-of-vocabulary theme must fail')
    const surfaces = structuredClone(/** @type {Record<string, unknown>[]} */ (corpus.surfaces))
    surfaces[0].kind = 'widget'
    assert.throws(() => validateCaptureCases({ ...corpus, surfaces }, CORPUS), /host kind[\s\S]*at path[\s\S]*repair:/, 'an unknown host kind must fail')
  })
})

describe('capture cases shape', () => {
  it('names the declared surface fields exactly', () => {
    const cases = validateCaptureCases(readFamily(CORPUS), CORPUS)
    const surface = cases.surfaces[0]
    assert.deepEqual(Object.keys(surface), ['id', 'kind', 'path', 'query', 'hash', 'root', 'probes', 'focus'], 'a surface must carry exactly the declared fields')
    assert.equal(isRecord(surface.probes[0]), true, 'a probe must be a record')
  })
})
