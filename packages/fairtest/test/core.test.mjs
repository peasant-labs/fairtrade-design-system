// Browser-neutral core tests. Every behavioral case lives in a named YAML
// fixture family with a required-name manifest; this file owns no case data
// except small structural unit asserts. Runs with node builtins plus the
// declared yaml dependency. No service, runner, or network is required.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, sep } from 'node:path'
import { createRequire } from 'node:module'
import { describe, it } from 'node:test'
import {
  assertExactFields,
  assertFresh,
  assertIntegerInRange,
  assertNonEmptyString,
  assertNumberInRange,
  assertStringList,
  assertWithinRoot,
  checkDuplicate,
  checkRequiredNames,
  countDistinct,
  createDuplicateSet,
  createEvidenceRecord,
  createIdentity,
  createMeasurementPolicy,
  createVendorRecord,
  digestHex,
  evaluateMeasurement,
  fractionWhere,
  freezeRecord,
  isAllowedImport,
  isFresh,
  isPlainRecord,
  loadSingleDocument,
  sameIdentity,
  summarizeBytes,
} from '../src/core/index.mjs'

const TESTDATA = new URL('../testdata/', import.meta.url)
const CORE_DIR = new URL('../src/core/', import.meta.url)
const CHILD_ROOT = new URL('..', import.meta.url)
const CHILD_MANIFEST = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const DECLARED_DEPS = new Set(Object.keys(CHILD_MANIFEST.dependencies ?? {}))
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])

const FAMILIES = [
  { id: 'values', corpus: 'core-values.yaml', manifest: 'core-values.manifest.yaml' },
  { id: 'identity', corpus: 'core-identity.yaml', manifest: 'core-identity.manifest.yaml' },
  { id: 'measurement', corpus: 'core-measurement.yaml', manifest: 'core-measurement.manifest.yaml' },
  { id: 'evidence', corpus: 'core-evidence.yaml', manifest: 'core-evidence.manifest.yaml' },
  { id: 'vendor', corpus: 'core-vendor.yaml', manifest: 'core-vendor.manifest.yaml' },
]

/** @returns {Record<string, unknown>} */
function readFamily(relative) {
  return /** @type {Record<string, unknown>} */ (loadSingleDocument(readFileSync(new URL(relative, TESTDATA), 'utf8'), relative))
}

function readSource(relative) {
  return readFileSync(new URL(relative, TESTDATA), 'utf8')
}

function coreSourceFiles() {
  return readdirSync(CORE_DIR).filter((entry) => entry.endsWith('.mjs')).sort()
}

function coreSourceText() {
  return coreSourceFiles().map((entry) => readFileSync(new URL(entry, CORE_DIR), 'utf8')).join('\n')
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

// ── values family ────────────────────────────────────────────────────────────

const VALUE_CHECKS = ['exact-fields', 'text', 'int-range', 'number-range', 'plain-record', 'string-list']

/** @param {Record<string, unknown>} value */
function validateValuesFamily(value) {
  const label = 'core-values.yaml'
  assertExactFields(value, ['expectedCaseCount', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no cases at path cases; repair: restore the named cases list.`)
  for (const [index, entry] of cases.entries()) {
    checkCaseName(entry, label, index)
    checkDiscriminator(entry, 'check', VALUE_CHECKS, label, index)
    const path = `cases[${index}]`
    if (entry.check === 'exact-fields') {
      assertExactFields(entry, ['name', 'check', 'fields', 'value', 'expectValid', ...(entry.expectValid ? [] : ['expectedErrorContains'])], label, path)
    } else if (entry.check === 'text' || entry.check === 'plain-record' || entry.check === 'string-list') {
      assertExactFields(entry, ['name', 'check', 'value', 'expectValid', ...(entry.expectValid ? [] : ['expectedErrorContains'])], label, path)
    } else {
      assertExactFields(entry, ['name', 'check', 'value', 'min', 'max', 'expectValid', ...(entry.expectValid ? [] : ['expectedErrorContains'])], label, path)
      assert.equal(typeof entry.min, 'number', `${label}: case "${entry.name}" must declare min at path ${path}.min; repair: restore the numeric min.`)
      assert.equal(typeof entry.max, 'number', `${label}: case "${entry.name}" must declare max at path ${path}.max; repair: restore the numeric max.`)
    }
  }
}

/** @param {Record<string, unknown>} entry */
function runValuesCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    if (entry.check === 'exact-fields') {
      assertExactFields(entry.value, /** @type {string[]} */ (entry.fields), name, 'case.value')
    } else if (entry.check === 'text') {
      assertNonEmptyString(entry.value, 'value', 'case.value')
    } else if (entry.check === 'string-list') {
      assertStringList(entry.value, 'value', 'case.value')
    } else if (entry.check === 'int-range') {
      assertIntegerInRange(entry.value, 'value', 'case.value', { min: /** @type {number} */ (entry.min), max: /** @type {number} */ (entry.max) })
    } else if (entry.check === 'number-range') {
      assertNumberInRange(entry.value, 'value', 'case.value', { min: /** @type {number} */ (entry.min), max: /** @type {number} */ (entry.max) })
    } else {
      assert.ok(isPlainRecord(entry.value) === entry.expectValid, `${name}: plain-record outcome mismatch`)
      return
    }
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid input failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid input passed validation`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

// ── identity family ──────────────────────────────────────────────────────────

/** @param {Record<string, unknown>} value */
function validateIdentityFamily(value) {
  const label = 'core-identity.yaml'
  assertExactFields(value, ['expectedCaseCount', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  for (const [index, entry] of cases.entries()) {
    checkCaseName(entry, label, index)
    checkDiscriminator(entry, 'action', ['create', 'same'], label, index)
    const path = `cases[${index}]`
    if (entry.action === 'create') {
      assertExactFields(entry, ['name', 'action', 'input', 'expectValid', ...(entry.expectValid ? ['expectFrozen'] : ['expectedErrorContains'])], label, path)
    } else {
      assertExactFields(entry, ['name', 'action', 'first', 'second', 'expectSame'], label, path)
    }
  }
}

/** @param {Record<string, unknown>} entry */
function runIdentityCase(entry) {
  const name = /** @type {string} */ (entry.name)
  if (entry.action === 'same') {
    assert.equal(sameIdentity(/** @type {never} */ (entry.first), /** @type {never} */ (entry.second)), entry.expectSame, `${name}: identity comparison mismatch`)
    return
  }
  let message = null
  let created = null
  try {
    created = createIdentity(/** @type {never} */ (entry.input))
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid identity failed: ${message}`)
    if (entry.expectFrozen) {
      assert.ok(Object.isFrozen(created), `${name}: identity must be frozen`)
    }
  } else {
    assert.ok(message, `${name}: invalid identity passed validation`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

// ── measurement family ───────────────────────────────────────────────────────

/** @param {Record<string, unknown>} value */
function validateMeasurementFamily(value) {
  const label = 'core-measurement.yaml'
  assertExactFields(value, ['expectedCaseCount', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  for (const [index, entry] of cases.entries()) {
    const path = `cases[${index}]`
    assert.ok(typeof entry.name === 'string' && entry.name.trim().length > 0, `${label}: case ${index} must carry a required name at path ${path}.name; repair: restore the required case name.`)
    if ('expectPolicyErrorContains' in entry) {
      assertExactFields(entry, ['name', 'policy', 'measurement', 'expectPolicyErrorContains'], label, path)
      checkFragmentList(entry.expectPolicyErrorContains, label, `${path}.expectPolicyErrorContains`)
    } else if ('expectMeasurementErrorContains' in entry) {
      assertExactFields(entry, ['name', 'policy', 'measurement', 'expectMeasurementErrorContains'], label, path)
      checkFragmentList(entry.expectMeasurementErrorContains, label, `${path}.expectMeasurementErrorContains`)
    } else {
      assertExactFields(entry, ['name', 'policy', 'measurement', 'expectPass', ...('expectedFailuresContains' in entry ? ['expectedFailuresContains'] : [])], label, path)
      if (typeof entry.expectPass !== 'boolean') {
        throw new Error(`${label}: case "${entry.name}" holds an invalid expectPass at path ${path}.expectPass; repair: use true or false for "expectPass".`)
      }
      if ('expectedFailuresContains' in entry) checkFragmentList(entry.expectedFailuresContains, label, `${path}.expectedFailuresContains`)
    }
  }
}

/** @param {Record<string, unknown>} entry */
function runMeasurementCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let policy = null
  try {
    policy = createMeasurementPolicy(/** @type {never} */ (entry.policy))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    assert.ok('expectPolicyErrorContains' in entry, `${name}: policy creation failed unexpectedly: ${message}`)
    expectFragments(/** @type {string[]} */ (entry.expectPolicyErrorContains), message, name)
    return
  }
  assert.ok(!('expectPolicyErrorContains' in entry), `${name}: invalid policy passed validation`)
  let verdict = null
  try {
    verdict = evaluateMeasurement(/** @type {never} */ (entry.measurement), policy)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    assert.ok('expectMeasurementErrorContains' in entry, `${name}: measurement failed unexpectedly: ${message}`)
    expectFragments(/** @type {string[]} */ (entry.expectMeasurementErrorContains), message, name)
    return
  }
  assert.ok(!('expectMeasurementErrorContains' in entry), `${name}: invalid measurement passed validation`)
  assert.ok(Object.isFrozen(verdict), `${name}: verdict must be frozen`)
  if (verdict.pass !== entry.expectPass) {
    throw new Error(`${name}: verdict mismatch for field "expectPass" at path case.expectPass; got pass=${JSON.stringify(verdict.pass)} with failures [${verdict.failures.join('; ')}]; repair: restore the expected behavioral outcome in ${name}.`)
  }
  if (entry.expectPass) {
    assert.deepEqual(verdict.failures, [], `${name}: passing verdict must list no failures`)
  } else {
    expectFragments(/** @type {string[]} */ (entry.expectedFailuresContains ?? []), verdict.failures.join('; '), name)
  }
}

// ── evidence family ──────────────────────────────────────────────────────────

/** @param {Record<string, unknown>} value */
function validateEvidenceFamily(value) {
  const label = 'core-evidence.yaml'
  assertExactFields(value, ['expectedCaseCount', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  for (const [index, entry] of cases.entries()) {
    checkCaseName(entry, label, index)
    checkDiscriminator(entry, 'check', ['duplicates', 'fresh', 'record'], label, index)
    const path = `cases[${index}]`
    if (entry.check === 'duplicates') {
      assertExactFields(entry, ['name', 'check', 'scope', 'digests', 'expectDuplicates'], label, path)
      assert.equal(/** @type {unknown[]} */ (entry.digests).length, /** @type {unknown[]} */ (entry.expectDuplicates).length, `${label}: case "${entry.name}" must pair every digest with an outcome at path ${path}; repair: align digests with expectDuplicates.`)
    } else if (entry.check === 'fresh') {
      assertExactFields(entry, ['name', 'check', 'observedAtMs', 'nowMs', 'maxAgeMs', 'expectFresh'], label, path)
    } else {
      assertExactFields(entry, ['name', 'check', 'record', 'expectValid', ...(entry.expectValid ? [] : ['expectedErrorContains'])], label, path)
    }
  }
}

/** @param {Record<string, unknown>} entry */
function runEvidenceCase(entry) {
  const name = /** @type {string} */ (entry.name)
  if (entry.check === 'duplicates') {
    let set = createDuplicateSet(/** @type {string} */ (entry.scope))
    const digests = /** @type {string[]} */ (entry.digests)
    const outcomes = /** @type {boolean[]} */ (entry.expectDuplicates)
    digests.forEach((digest, index) => {
      const before = set.seen.length
      const checked = checkDuplicate(set, digest)
      assert.equal(checked.duplicate, outcomes[index], `${name}: digest ${index} duplicate mismatch`)
      assert.equal(set.seen.length, before, `${name}: input set must stay immutable`)
      assert.ok(Object.isFrozen(checked.updated), `${name}: updated set must be frozen`)
      set = checked.updated
    })
    return
  }
  if (entry.check === 'fresh') {
    const fresh = isFresh(/** @type {number} */ (entry.observedAtMs), /** @type {number} */ (entry.nowMs), /** @type {number} */ (entry.maxAgeMs))
    assert.equal(fresh, entry.expectFresh, `${name}: freshness mismatch`)
    if (entry.expectFresh) {
      assertFresh(/** @type {number} */ (entry.observedAtMs), /** @type {number} */ (entry.nowMs), /** @type {number} */ (entry.maxAgeMs), name)
    } else {
      assert.throws(() => assertFresh(/** @type {number} */ (entry.observedAtMs), /** @type {number} */ (entry.nowMs), /** @type {number} */ (entry.maxAgeMs), name), /observedAtMs.*repair:/s, `${name}: stale clock must fail assertFresh`)
    }
    return
  }
  let message = null
  try {
    const record = createEvidenceRecord(/** @type {never} */ (entry.record))
    assert.ok(Object.isFrozen(record), `${name}: record must be frozen`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid record failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid record passed validation`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

// ── vendor family ────────────────────────────────────────────────────────────

/** @param {Record<string, unknown>} value */
function validateVendorFamily(value) {
  const label = 'core-vendor.yaml'
  assertExactFields(value, ['expectedCaseCount', 'cases', 'isolationProbes'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  for (const [index, entry] of cases.entries()) {
    checkCaseName(entry, label, index)
    checkDiscriminator(entry, 'check', ['vendor-record', 'import', 'within-root'], label, index)
    const path = `cases[${index}]`
    if (entry.check === 'vendor-record') {
      assertExactFields(entry, ['name', 'check', 'input', 'expectValid', ...(entry.expectValid ? ['expectFrozen'] : ['expectedErrorContains'])], label, path)
    } else if (entry.check === 'import') {
      assertExactFields(entry, ['name', 'check', 'specifier', 'allowlist', 'expectAllowed'], label, path)
    } else {
      assertExactFields(entry, ['name', 'check', 'resolved', 'root', 'expectValid', ...(entry.expectValid ? [] : ['expectedErrorContains'])], label, path)
    }
  }
  const probes = /** @type {Record<string, unknown>[]} */ (value.isolationProbes)
  assert.ok(Array.isArray(probes) && probes.length > 0, `${label}: isolationProbes must be a non-empty list at path isolationProbes; repair: restore the probe list.`)
  const names = new Set()
  for (const [index, probe] of probes.entries()) {
    assertExactFields(probe, ['name', 'snippet'], label, `isolationProbes[${index}]`)
    assert.ok(typeof probe.name === 'string' && probe.name.length > 0, `${label}: probe ${index} must be named`)
    assert.ok(typeof probe.snippet === 'string' && probe.snippet.length > 0, `${label}: probe "${probe.name}" must carry a snippet`)
    assert.ok(!names.has(probe.name), `${label}: probe names must be unique`)
    names.add(probe.name)
  }
}

/** @param {Record<string, unknown>} entry */
function runVendorCase(entry) {
  const name = /** @type {string} */ (entry.name)
  if (entry.check === 'import') {
    assert.equal(isAllowedImport(entry.specifier, /** @type {string[]} */ (entry.allowlist)), entry.expectAllowed, `${name}: import decision mismatch`)
    return
  }
  if (entry.check === 'within-root') {
    let message = null
    try {
      assertWithinRoot(/** @type {string} */ (entry.resolved), /** @type {string} */ (entry.root))
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    if (entry.expectValid) {
      assert.equal(message, null, `${name}: contained path failed: ${message}`)
    } else {
      assert.ok(message, `${name}: escaping path passed containment`)
      expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
    }
    return
  }
  let message = null
  try {
    const record = createVendorRecord(/** @type {never} */ (entry.input))
    if (entry.expectFrozen) assert.ok(Object.isFrozen(record), `${name}: vendor record must be frozen`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid vendor record failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid vendor record passed validation`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
  }
}

// ── family wiring ────────────────────────────────────────────────────────────

const VALIDATORS = {
  values: validateValuesFamily,
  identity: validateIdentityFamily,
  measurement: validateMeasurementFamily,
  evidence: validateEvidenceFamily,
  vendor: validateVendorFamily,
}
const RUNNERS = {
  values: runValuesCase,
  identity: runIdentityCase,
  measurement: runMeasurementCase,
  evidence: runEvidenceCase,
  vendor: runVendorCase,
}

for (const family of FAMILIES) {
  describe(`core fixture family ${family.id}`, () => {
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

describe('core structural units', () => {
  it('hashes deterministically without pinned literals', () => {
    assert.equal(digestHex('sample input'), digestHex('sample input'))
    assert.equal(digestHex('sample input').length, 64)
    assert.equal(digestHex('sample input', 'md5').length, 32)
    const summary = summarizeBytes('sample input')
    assert.equal(summary.sha256, digestHex('sample input'))
    assert.equal(summary.bytes, Buffer.byteLength('sample input'))
    assert.ok(Object.isFrozen(summary))
  })

  it('counts and ratios samples generically', () => {
    assert.equal(countDistinct(['a', 'a', 'b']), 2)
    assert.equal(countDistinct([]), 0)
    assert.equal(fractionWhere([1, 2, 3, 4], (value) => /** @type {number} */ (value) % 2 === 0), 0.5)
    assert.equal(fractionWhere([], () => true), 0)
  })

  it('requires every caller bound instead of defaulting', () => {
    assert.throws(() => createMeasurementPolicy(/** @type {never} */ ({ version: 1, minDistinct: 1, minFraction: 0 })), /minBytes/)
    assert.throws(() => createMeasurementPolicy(/** @type {never} */ ({ version: 1, minBytes: 1, minDistinct: 1, minFraction: 0, extra: 1 })), /extra/)
  })

  it('freezes shared records deeply', () => {
    const frozen = freezeRecord({ top: { nested: [1] } })
    assert.ok(Object.isFrozen(frozen) && Object.isFrozen(frozen.top) && Object.isFrozen(frozen.top.nested))
  })
})

// ── isolation: imports, escapes, leakage ─────────────────────────────────────

/** @param {string} text */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

describe('core isolation', () => {
  it('declares every static import', () => {
    const allowedBare = new Set([...DECLARED_DEPS])
    for (const entry of coreSourceFiles()) {
      const text = readFileSync(new URL(entry, CORE_DIR), 'utf8')
      const code = stripComments(text)
      assert.ok(!code.includes('require('), `${entry}: require() calls are not allowed in neutral core`)
      assert.ok(!/import\s*\(/.test(code), `${entry}: dynamic import() is not allowed in neutral core`)
      const sideEffect = [...code.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)].map((match) => match[1])
      assert.deepEqual(sideEffect, [], `${entry}: side-effect imports are not allowed in neutral core; got [${sideEffect.join(', ')}]`)
      for (const match of text.matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)) {
        const specifier = match[1]
        if (specifier.startsWith('node:')) continue
        if (specifier.startsWith('./') || specifier.startsWith('../')) {
          assert.ok(!specifier.includes('..'), `${entry}: parent traversal escapes the core directory`)
          continue
        }
        const root = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
        assert.ok(allowedBare.has(root), `${entry}: undeclared import ${JSON.stringify(specifier)} resolves outside the child manifest`)
      }
    }
  })

  it('rejects root-relative source escapes', () => {
    assertWithinRoot('/scope/packages/fairtest/src/core/values.mjs', '/scope/packages/fairtest')
    assert.throws(() => assertWithinRoot('/scope/packages/other.mjs', '/scope/packages/fairtest'), /escapes its root/)
    assert.throws(() => assertWithinRoot('/etc/hostname', '/scope/packages/fairtest'), /escapes its root/)
    assert.equal(isAllowedImport('/etc/hostname', [...DECLARED_DEPS]), false)
    assert.equal(isAllowedImport('../package.json', [...DECLARED_DEPS]), true)
  })

  it('carries no runner global or product literal', () => {
    const text = coreSourceText()
    assert.ok(!/\b(window|navigator|globalThis)\b/.test(text), 'neutral core must not name page globals')
    assert.ok(!/\bdocument\s*\.\s*(createElement|querySelector|querySelectorAll|getElementById|body|head|documentElement|addEventListener|cookie|title|write|location)\b/i.test(text), 'neutral core must not touch the live document object')
    assert.ok(!/playwright|puppeteer|jsdom|storybook|agent-browser/i.test(text), 'neutral core must not name a runner')
    const vendor = readFamily('core-vendor.yaml')
    for (const probe of /** @type {Record<string, unknown>[]} */ (vendor.isolationProbes)) {
      assert.ok(!text.includes(/** @type {string} */ (probe.snippet)), `neutral core must not contain ${(/** @type {string} */ (probe.name))}`)
    }
  })

  it('fails app-material injection as an unknown field', () => {
    const vendor = readFamily('core-vendor.yaml')
    for (const probe of /** @type {Record<string, unknown>[]} */ (vendor.isolationProbes)) {
      const snippet = /** @type {string} */ (probe.snippet)
      let message = null
      try {
        assertExactFields({ alpha: 'x', beta: 'y', [snippet]: 'injected' }, ['alpha', 'beta'], 'probe', 'case.value')
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `probe "${probe.name}" passed validation instead of failing`)
      assert.ok(message.includes(snippet), `probe "${probe.name}" diagnostic must name the injected material`)
      assert.ok(message.includes('at path') && message.includes('repair:'), `probe "${probe.name}" diagnostic must stay actionable`)
    }
  })
})

describe('core single-document loader', () => {
  it('loads a valid document with a leading start marker', () => {
    const parsed = loadSingleDocument('---\nrecords: []\n', 'probe.yaml')
    assert.deepEqual(parsed, { records: [] })
  })

  it('rejects a trailing document after an end marker', () => {
    assert.throws(
      () => loadSingleDocument('records: []\n...\n---\norphan: true\n', 'probe.yaml'),
      /trailing YAML document at path document\[1\].*repair:/s,
      'trailing document after ... must fail closed',
    )
  })
})

// ── external-root execution without runner packages ──────────────────────────

describe('core external root', () => {
  it('runs from a temporary root with no runner packages present', () => {
    const external = mkdtempSync(join(tmpdir(), 'fairtest-core-external-'))
    try {
      mkdirSync(join(external, 'core'), { recursive: true })
      for (const entry of coreSourceFiles()) {
        copyFileSync(new URL(entry, CORE_DIR), join(external, 'core', basename(entry)))
      }
      mkdirSync(join(external, 'node_modules', 'yaml'), { recursive: true })
      const realYaml = new URL('../../node_modules/yaml/', CHILD_ROOT)
      try {
        realpathSync(new URL('package.json', realYaml))
      } catch {
        throw new Error('external-root check needs the installed yaml dependency; run pnpm install first.')
      }
      rmSync(join(external, 'node_modules', 'yaml'), { recursive: true, force: true })
      symlinkSync(realpathSync(new URL('.', realYaml)), join(external, 'node_modules', 'yaml'), 'dir')
      const scoped = createRequire(join(external, 'probe.mjs'))
      for (const missing of ['playwright', 'puppeteer-core', 'jsdom', '@playwright/test']) {
        assert.throws(() => scoped.resolve(missing), /Cannot find module/, `${missing} must not resolve from the external root`)
      }
      writeFileSync(join(external, 'smoke.mjs'), [
        "import { realpathSync } from 'node:fs'",
        "import * as core from './core/index.mjs'",
        "const policy = core.createMeasurementPolicy({ version: 1, minBytes: 2, minDistinct: 1, minFraction: 0 })",
        "const verdict = core.evaluateMeasurement({ bytes: 2, distinct: 1, fraction: 0 }, policy)",
        "if (!verdict.pass) throw new Error('external smoke policy failed')",
        "const id = core.createIdentity({ kind: 'run', id: 'smoke-1', createdAtMs: 1 })",
        "if (id.id !== 'smoke-1' || !Object.isFrozen(id)) throw new Error('external smoke identity failed')",
        "const here = realpathSync(new URL('./core/index.mjs', import.meta.url))",
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
