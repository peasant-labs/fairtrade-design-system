// Validator for the journey helper-ownership inventory.
//
// Assigns every exported helper of scripts/journey/lib/ to exactly one
// owner (browser-neutral-core-policy, app-owned-host-runtime, or
// compatibility-re-export) and proves the classification is real:
// - every row names a file, symbol, and owner with exact fields;
// - the row set equals the actual module export set (no helper
//   unclassified, no phantom row);
// - only the two pinned pure constants are core-owned, and their file
//   carries no browser/DOM/runner token;
// - every compatibility re-export holds value identity with its canonical
//   file and is a re-export, never a redefinition;
// - the pinned pure values appear nowhere in the private child package,
//   so no pure policy is duplicated into core.
// Runs with node --test and starts no browser or service.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { importFairtestSource } from '../../fairtest-source.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const CORPUS_REL = 'scripts/journey/lib/helper-ownership.testdata.yaml'
const MANIFEST_REL = 'scripts/journey/lib/helper-ownership.testdata.manifest.yaml'
const LIB_FILES = ['determinism-constants.mjs', 'determinism.mjs', 'assertions.mjs', 'fixtures.mjs']
const OWNERS = ['browser-neutral-core-policy', 'app-owned-host-runtime', 'compatibility-re-export']
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])

/** Pinned pure values: the only symbols the core owner may hold. */
const CORE_ROWS = new Set([
  'determinism-constants.mjs:FROZEN_EPOCH_MS',
  'determinism-constants.mjs:PRNG_SEED',
])

/** Word-boundary browser/DOM/runner tokens no core-owned file may carry. */
const BROWSER_TOKEN_PATTERN = /\b(page|locator|document|window|playwright|addInitScript|getComputedStyle|AxeBuilder|context|storybook)\b/

const coreFixtures = await importFairtestSource('src/core/fixtures.mjs')

const corpusSource = readFileSync(join(ROOT, CORPUS_REL), 'utf8')
const manifestSource = readFileSync(join(ROOT, MANIFEST_REL), 'utf8')

const libModules = {}
for (const file of LIB_FILES) {
  libModules[file] = await import(`./${file}`)
}

/** @param {Record<string, unknown>} manifest */
function validateManifest(manifest) {
  coreFixtures.checkKeys(manifest, ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'manifest record', MANIFEST_REL, 'manifest')
  const names = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(names).size, names.length, `${MANIFEST_REL}: required case names must be unique at path manifest.requiredCaseNames; repair: list every required case name once.`)
  assert.equal(manifest.expectedCaseCount, names.length, `${MANIFEST_REL}: case count must equal the required-name inventory at path manifest.expectedCaseCount; repair: align expectedCaseCount with requiredCaseNames.`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${MANIFEST_REL}: mutation count must equal the mutation inventory at path manifest.expectedMutationCount; repair: align expectedMutationCount with mutations.`)
  coreFixtures.checkRequiredNames(mutations.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredMutationNames), MANIFEST_REL)
  for (const [index, mutation] of mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('value')
    coreFixtures.checkKeys(mutation, fields, 'mutation record', MANIFEST_REL, `manifest.mutations[${index}]`)
    assert.ok(MUTATION_KINDS.has(/** @type {string} */ (mutation.kind)), `${MANIFEST_REL}: mutation ${index} names an unknown kind at path manifest.mutations[${index}].kind; repair: use one of ${[...MUTATION_KINDS].join(', ')}.`)
    assert.ok(names.includes(/** @type {string} */ (mutation.target)), `${MANIFEST_REL}: mutation ${index} targets an unknown case at path manifest.mutations[${index}].target; repair: target one of the required case names.`)
  }
}

/** @param {Record<string, unknown>} entry @param {number} index */
function checkCaseShape(entry, index) {
  const path = `cases[${index}]`
  if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
    throw new Error(`${CORPUS_REL}: case ${index} is missing its required name at path ${path}.name; repair: restore the required case name.`)
  }
  coreFixtures.checkKeys(entry, ['name', 'file', 'symbol', 'owner'], 'case record', CORPUS_REL, path)
  if (!LIB_FILES.includes(/** @type {string} */ (entry.file))) {
    throw new Error(`${CORPUS_REL}: case "${entry.name}" names an unknown file ${JSON.stringify(entry.file)} for field "file" at path ${path}.file; repair: use one of ${LIB_FILES.join(', ')} for "file".`)
  }
  if (typeof entry.symbol !== 'string' || entry.symbol.trim().length === 0) {
    throw new Error(`${CORPUS_REL}: case "${entry.name}" is missing its symbol for field "symbol" at path ${path}.symbol; repair: name the exported helper for "symbol".`)
  }
  if (typeof entry.owner !== 'string' || entry.owner.trim().length === 0) {
    throw new Error(`${CORPUS_REL}: case "${entry.name}" is missing its owner for field "owner" at path ${path}.owner; repair: assign one owner for "owner".`)
  }
}

/**
 * Validate the ownership semantics of one row against the live modules.
 * @param {Record<string, unknown>} entry
 */
function checkRowOwnership(entry) {
  const name = /** @type {string} */ (entry.name)
  const file = /** @type {string} */ (entry.file)
  const symbol = /** @type {string} */ (entry.symbol)
  const owner = /** @type {string} */ (entry.owner)
  if (!OWNERS.includes(owner)) {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unknown owner ${JSON.stringify(owner)} for field "owner" at path owner; repair: use one of ${OWNERS.join(', ')} for "owner".`)
  }
  const module = libModules[file]
  if (!(symbol in module)) {
    throw new Error(`${CORPUS_REL}: case "${name}" names an unexported symbol ${JSON.stringify(symbol)} for field "symbol" at path symbol; repair: classify an actually exported helper for "symbol".`)
  }
  const key = `${file}:${symbol}`
  if (owner === 'browser-neutral-core-policy') {
    if (!CORE_ROWS.has(key)) {
      throw new Error(`${CORPUS_REL}: case "${name}" assigns ${JSON.stringify(symbol)} from ${JSON.stringify(file)} to the core for field "owner" at path owner; repair: assign browser/DOM helpers to app-owned-host-runtime and keep only the pinned pure constants in browser-neutral-core-policy.`)
    }
    const text = readFileSync(join(HERE, file), 'utf8')
    const hit = text.match(BROWSER_TOKEN_PATTERN)
    if (hit) {
      throw new Error(`${CORPUS_REL}: case "${name}" assigns a core owner to a file carrying browser material ${JSON.stringify(hit[0])} for field "owner" at path owner; repair: keep browser/DOM helpers in app-owned-host-runtime.`)
    }
  }
  if (owner === 'compatibility-re-export') {
    const canonical = libModules['determinism-constants.mjs']
    if (!(symbol in canonical)) {
      throw new Error(`${CORPUS_REL}: case "${name}" re-exports an unknown canonical symbol ${JSON.stringify(symbol)} for field "symbol" at path symbol; repair: re-export only the pinned pure constants for "symbol".`)
    }
    assert.equal(module[symbol], canonical[symbol], `${CORPUS_REL}: case "${name}" re-export must hold value identity with the canonical file at path symbol; repair: re-export the canonical value instead of redefining it.`)
    const text = readFileSync(join(HERE, file), 'utf8')
    if (text.includes(`export const ${symbol}`) || text.includes(`export let ${symbol}`)) {
      throw new Error(`${CORPUS_REL}: case "${name}" redefines ${JSON.stringify(symbol)} instead of re-exporting it for field "symbol" at path symbol; repair: re-export the canonical pure value without redefining it.`)
    }
  }
}

/** List every source file under the private child package. */
function listChildSources() {
  const roots = [join(ROOT, 'packages', 'fairtest', 'src'), join(ROOT, 'packages', 'fairtest', 'test')]
  const found = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && full.endsWith('.mjs')) found.push(full)
    }
  }
  for (const root of roots) walk(root)
  return found
}

describe('helper ownership inventory', () => {
  const manifest = /** @type {Record<string, unknown>} */ (coreFixtures.loadSingleDocument(manifestSource, MANIFEST_REL))
  const parsed = /** @type {Record<string, unknown>} */ (coreFixtures.loadSingleDocument(corpusSource, CORPUS_REL))

  it('holds a valid manifest inventory', () => {
    validateManifest(manifest)
  })

  it('holds exact fields and required names', () => {
    coreFixtures.checkKeys(parsed, ['expectedCaseCount', 'cases'], 'corpus record', CORPUS_REL, 'record')
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    assert.ok(Array.isArray(cases) && cases.length > 0, `${CORPUS_REL}: record holds no cases at path cases; repair: restore the named cases list.`)
    assert.equal(cases.length, manifest.expectedCaseCount, `${CORPUS_REL}: case count must match the manifest at path expectedCaseCount; repair: align the cases list with the manifest.`)
    coreFixtures.checkRequiredNames(cases.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS_REL)
    cases.forEach(checkCaseShape)
  })

  it('assigns every exported helper to exactly one owner with no gaps', () => {
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    const actual = new Set()
    for (const file of LIB_FILES) {
      for (const symbol of Object.keys(libModules[file])) {
        actual.add(`${file}:${symbol}`)
      }
    }
    const inventoried = new Set(cases.map((entry) => `${entry.file}:${entry.symbol}`))
    assert.equal(inventoried.size, cases.length, `${CORPUS_REL}: inventory holds a duplicate (file, symbol) pair at path cases; repair: classify every helper exactly once.`)
    for (const key of actual) {
      assert.ok(inventoried.has(key), `${CORPUS_REL}: exported helper ${JSON.stringify(key)} is unclassified at path cases; repair: add the helper to the inventory with its owning boundary.`)
    }
    for (const key of inventoried) {
      assert.ok(actual.has(key), `${CORPUS_REL}: inventory row ${JSON.stringify(key)} names no live export at path cases; repair: remove the phantom row or restore the export.`)
    }
    for (const entry of cases) {
      checkRowOwnership(entry)
    }
  })

  it('keeps the pinned pure values byte-identical and out of the child package', () => {
    const constants = libModules['determinism-constants.mjs']
    assert.equal(constants.FROZEN_EPOCH_MS, Date.UTC(2024, 0, 1, 12, 0, 0), 'FROZEN_EPOCH_MS must stay pinned at path determinism-constants.FROZEN_EPOCH_MS; repair: restore the frozen epoch instead of retuning it.')
    assert.equal(constants.PRNG_SEED, 0x9e3779b9, 'PRNG_SEED must stay pinned at path determinism-constants.PRNG_SEED; repair: restore the pinned seed instead of retuning it.')
    for (const file of listChildSources()) {
      const text = readFileSync(file, 'utf8')
      for (const token of ['FROZEN_EPOCH_MS', 'PRNG_SEED']) {
        assert.ok(!text.includes(token), `${file}: duplicates pure journey policy ${JSON.stringify(token)} at path ${file}; repair: keep pure journey values in scripts/journey/lib with a single owner.`)
      }
    }
  })

  it('fails every executable mutation for its intended field', async () => {
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        const mutated = structuredClone(cases)
        if (mutation.kind === 'duplicate-name') {
          const donor = mutated.find((entry) => entry.name !== mutation.target) ?? mutated[0]
          mutated.push({ ...structuredClone(donor), name: mutation.target })
        } else if (mutation.kind === 'delete-record') {
          const index = mutated.findIndex((entry) => entry.name === mutation.target)
          assert.notEqual(index, -1, `unknown mutation target ${mutation.target}`)
          mutated.splice(index, 1)
        } else {
          const target = mutated.find((entry) => entry.name === mutation.target)
          assert.ok(target, `unknown mutation target ${mutation.target}`)
          if (mutation.kind === 'delete-field') {
            delete target[/** @type {string} */ (mutation.field)]
          } else if (mutation.kind === 'rename-field') {
            const value = target[/** @type {string} */ (mutation.field)]
            delete target[/** @type {string} */ (mutation.field)]
            target[/** @type {string} */ (mutation.newField)] = value
          } else {
            target[/** @type {string} */ (mutation.field)] = structuredClone(mutation.value)
          }
        }
        mutated.forEach(checkCaseShape)
        coreFixtures.checkRequiredNames(mutated.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS_REL)
        for (const entry of mutated) {
          checkRowOwnership(entry)
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

  it('resolves the helper module graph with node --check', () => {
    for (const file of [...LIB_FILES, 'helper-ownership.test.mjs', 'journey-compat.test.mjs']) {
      execFileSync('node', ['--check', join('scripts', 'journey', 'lib', file)], { cwd: ROOT, stdio: 'pipe' })
    }
  })
})
