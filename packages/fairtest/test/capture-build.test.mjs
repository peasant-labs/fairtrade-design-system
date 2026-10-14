// @ts-check

// Served-build record contract tests. Every behavioral case lives in the named
// capture-build YAML family with a required-name manifest; this file owns no
// case data. Composes the real child served-build record and the
// served-versus-dist proof without a browser, service, runner, or network.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { assertExactFields, checkRequiredNames, loadSingleDocument } from '../src/core/index.mjs'
import { assertServedMatchesDist, validateServedBuild } from '../src/capture/index.mjs'

const TESTDATA = new URL('../testdata/', import.meta.url)
const CORPUS = 'capture-build.yaml'
const MANIFEST = 'capture-build.manifest.yaml'
const CHECKS = ['valid', 'matches']
const MUTATIONS = ['none', 'drop-served', 'served-false', 'duplicate-asset', 'non-hex-head']
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])

/** @param {string} relative @returns {string} */
function readSource(relative) {
  return readFileSync(new URL(relative, TESTDATA), 'utf8')
}

/** @param {string} relative @returns {Record<string, unknown>} */
function readFamily(relative) {
  return /** @type {Record<string, unknown>} */ (loadSingleDocument(readSource(relative), relative))
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {string} label
 */
function validateManifest(manifest, label) {
  for (const field of ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations']) {
    assert.ok(field in manifest, `${label}: manifest is missing ${field}`)
  }
  const names = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(names).size, names.length, `${label}: required case names must be unique`)
  assert.equal(manifest.expectedCaseCount, names.length, `${label}: case count must equal the required-name inventory`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${label}: mutation count must equal the mutation inventory`)
  checkRequiredNames(mutations.map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredMutationNames), label)
  for (const mutation of mutations) {
    assert.ok(MUTATION_KINDS.has(String(mutation.kind)), `${label}: mutation ${String(mutation.name)} names an unknown kind`)
    if (mutation.kind === 'trailing-document') assert.equal(mutation.target, 'document', `${label}: trailing-document targets the document`)
    else assert.ok(names.includes(String(mutation.target)), `${label}: mutation ${String(mutation.name)} targets an unknown case`)
  }
}

/**
 * @param {Record<string, unknown>} corpus
 * @param {string} label
 */
function validateFamilyShape(corpus, label) {
  assertExactFields(corpus, ['expectedCaseCount', 'build', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (corpus.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no cases at path cases; repair: restore the named cases list.`)
  for (const [index, entry] of cases.entries()) {
    if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
      throw new Error(`${label}: case ${index} is missing its required name at path cases[${index}].name; repair: restore the required case name.`)
    }
    if (!CHECKS.includes(/** @type {string} */ (entry.check))) {
      throw new Error(`${label}: case "${entry.name}" names an unknown discriminator ${JSON.stringify(entry.check)} for field "check" at path cases[${index}].check; repair: use one of ${CHECKS.join(', ')} for "check".`)
    }
    if (!MUTATIONS.includes(/** @type {string} */ (entry.mutation))) {
      throw new Error(`${label}: case "${entry.name}" names an unknown mutation ${JSON.stringify(entry.mutation)} for field "mutation" at path cases[${index}].mutation; repair: use one of ${MUTATIONS.join(', ')} for "mutation".`)
    }
    const fields = entry.expectValid === true
      ? ['name', 'check', 'mutation', 'expectValid']
      : ['name', 'check', 'mutation', 'expectValid', 'expectedErrorContains']
    assertExactFields(entry, fields, label, `cases[${index}]`)
  }
}

/**
 * Apply one mutation to a mutable copy of the build record.
 * @param {Record<string, unknown>} build mutable build copy
 * @param {string} mutation mutation name
 * @returns {Record<string, unknown>}
 */
function mutateBuild(build, mutation) {
  if (mutation === 'drop-served') {
    build.served = /** @type {unknown[]} */ (build.served).slice(0, -1)
  } else if (mutation === 'served-false') {
    const served = /** @type {Record<string, unknown>[]} */ (build.served)
    served[0].servedEqualsDist = false
  } else if (mutation === 'duplicate-asset') {
    const assets = /** @type {unknown[]} */ (build.assets)
    assets.push(structuredClone(assets[0]))
  } else if (mutation === 'non-hex-head') {
    build.head = 'not-a-commit'
  }
  return build
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
    assert.notEqual(index, -1, `unknown mutation target ${String(mutation.target)}`)
    cases.splice(index, 1)
    return
  }
  const target = cases.find((entry) => entry.name === mutation.target)
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

describe('capture build fixture', () => {
  const manifest = readFamily(MANIFEST)
  const corpus = readFamily(CORPUS)

  it('loads the fixture and matches the required case inventory', () => {
    validateManifest(manifest, MANIFEST)
    validateFamilyShape(corpus, CORPUS)
    checkRequiredNames(/** @type {Record<string, unknown>[]} */ (corpus.cases).map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
  })

  it('validates the certified served build and rejects malformed shapes', () => {
    const base = /** @type {Record<string, unknown>} */ (corpus.build)
    const validated = assertServedMatchesDist(structuredClone(base), CORPUS)
    assert.equal(validated.assets.length, 2, 'the fixture must declare two built assets')
    assert.ok(validated.assets.every((asset) => asset.sha256.length === 64), 'every built asset must carry a 64-character digest')
  })

  it('behaves every named served-build mutation', () => {
    const base = /** @type {Record<string, unknown>} */ (corpus.build)
    for (const entry of /** @type {Record<string, unknown>[]} */ (corpus.cases)) {
      const build = mutateBuild(structuredClone(base), String(entry.mutation))
      let message = null
      let passed = false
      try {
        if (entry.check === 'matches') assertServedMatchesDist(build, 'build')
        else validateServedBuild(build, 'build')
        passed = true
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      if (entry.expectValid === true) {
        assert.ok(passed, `${String(entry.name)}: a valid served build must pass; got ${message}`)
        continue
      }
      assert.ok(message, `${String(entry.name)}: mutated build passed instead of failing`)
      assert.ok(!passed, `${String(entry.name)}: mutated build must not pass`)
      for (const fragment of /** @type {string[]} */ (entry.expectedErrorContains)) {
        assert.ok(message.includes(fragment), `${String(entry.name)}: diagnostic is missing ${JSON.stringify(fragment)}; got ${message}`)
      }
    }
  })

  it('fails every named corpus mutation for its intended field', () => {
    const cases = /** @type {Record<string, unknown>[]} */ (corpus.cases)
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          loadSingleDocument(`${readSource(CORPUS).trimEnd()}\n---\norphan: true\n`, CORPUS)
        } else {
          const mutated = structuredClone(cases)
          applyMutation(mutated, mutation)
          validateFamilyShape({ ...corpus, cases: mutated }, CORPUS)
          checkRequiredNames(mutated.map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
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
})
