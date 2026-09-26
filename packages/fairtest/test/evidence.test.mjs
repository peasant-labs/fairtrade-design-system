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
import {
  EVIDENCE_FAILURE_CODES,
  EVIDENCE_MODES,
  artifactDigest,
  createArtifactObservation,
  createEvidencePolicy,
  createEvidenceRow,
  createEvidenceRun,
  validateEvidenceReport,
  verifyEvidenceRun,
} from '../src/evidence/index.mjs'

const TESTDATA = new URL('../testdata/', import.meta.url)
const CORE_DIR = new URL('../src/core/', import.meta.url)
const EVIDENCE_DIR = new URL('../src/evidence/', import.meta.url)
const ROOT_MANIFEST = new URL('../../../package.json', import.meta.url)
const VERIFIER_CLI = new URL('../../../scripts/fairtest/verify-fairtest.mjs', import.meta.url)
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
    if (fresh !== entry.expectFresh) {
      throw new Error(`${name}: freshness mismatch for field "expectFresh" at path case.expectFresh; got fresh=${JSON.stringify(fresh)}; repair: restore the expected behavioral outcome in ${name}.`)
    }
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

  it('imports only node builtins and neutral child modules', () => {
    const self = readFileSync(new URL(import.meta.url), 'utf8')
    const specifiers = [...self.matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
    assert.ok(specifiers.length > 0, 'evidence contract test must declare its imports statically')
    for (const specifier of specifiers) {
      if (specifier.startsWith('node:')) continue
      assert.ok(
        specifier.startsWith('../src/core/') || specifier.startsWith('../src/evidence/'),
        `evidence contract test import ${JSON.stringify(specifier)} escapes the neutral child source`,
      )
    }
  })

  it('keeps core fixture helpers free of browser globals', () => {
    assert.equal(typeof window, 'undefined', 'contract must not load a window global')
    assert.equal(typeof document, 'undefined', 'contract must not load a document global')
    const names = readdirSync(CORE_DIR).filter((entry) => entry.endsWith('.mjs')).sort()
    assert.ok(names.includes('evidence.mjs'), 'neutral core must keep the evidence module')
  })
})

const EVIDENCE_CASES = 'evidence-cases.yaml'
const EVIDENCE_CASES_MANIFEST = 'evidence-cases.manifest.yaml'
const CASE_MUTATION_KINDS = new Set([
  'none',
  'delete-row',
  'add-row',
  'patch-row',
  'delete-artifact',
  'add-artifact',
  'set-artifact-content',
  'set-artifact-digest',
  'set-required',
  'set-policy',
  'set-run-id',
  'set-mode',
])
const CHECK_DISCRIMINATORS = ['verdict', 'run']
const TEMPLATE_FIELDS = [
  'key',
  'kind',
  'theme',
  'identityId',
  'proofIdentityId',
  'proof',
  'observedAtMs',
  'provenance',
  'themeObservation',
  'artifacts',
]

/** @param {Record<string, unknown>} value */
function validateEvidenceManifest(value) {
  const label = EVIDENCE_CASES_MANIFEST
  assertExactFields(
    value,
    ['expectedCaseCount', 'requiredCaseNames', 'expectedGuardCount', 'requiredGuardNames', 'guards', 'expectedMutationCount', 'requiredMutationNames', 'mutations'],
    label,
    'manifest',
  )
  const cases = /** @type {string[]} */ (value.requiredCaseNames)
  const guards = /** @type {Record<string, unknown>[]} */ (value.guards)
  const mutations = /** @type {Record<string, unknown>[]} */ (value.mutations)
  assert.equal(new Set(cases).size, cases.length, `${label}: required case names must be unique`)
  assert.equal(value.expectedCaseCount, cases.length, `${label}: case count must equal the required-name inventory`)
  assert.equal(value.expectedGuardCount, guards.length, `${label}: guard count must equal the guard inventory`)
  assert.equal(value.expectedMutationCount, mutations.length, `${label}: mutation count must equal the mutation inventory`)
  checkRequiredNames(guards.map((entry) => entry.name), /** @type {string[]} */ (value.requiredGuardNames), label)
  checkRequiredNames(mutations.map((entry) => entry.name), /** @type {string[]} */ (value.requiredMutationNames), label)
  for (const [index, guard] of guards.entries()) {
    assertExactFields(guard, ['name', 'case', 'code'], label, `manifest.guards[${index}]`)
    assert.ok(cases.includes(/** @type {string} */ (guard.case)), `${label}: guard ${index} names an unknown case`)
    assert.ok(EVIDENCE_FAILURE_CODES.includes(/** @type {string} */ (guard.code)), `${label}: guard ${index} names an unknown code`)
  }
  for (const [index, mutation] of mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('value')
    assertExactFields(mutation, fields, label, `manifest.mutations[${index}]`)
    if (!MUTATION_KINDS.has(/** @type {string} */ (mutation.kind))) {
      throw new Error(`${label}: mutation ${index} names an unknown kind at path manifest.mutations[${index}].kind; repair: use one of ${[...MUTATION_KINDS].join(', ')}.`)
    }
    if (mutation.kind !== 'trailing-document' && !cases.includes(/** @type {string} */ (mutation.target))) {
      throw new Error(`${label}: mutation ${index} targets an unknown case at path manifest.mutations[${index}].target; repair: target one of the required case names.`)
    }
  }
  for (const code of EVIDENCE_FAILURE_CODES) {
    if (!guards.some((entry) => entry.code === code)) {
      throw new Error(`${label}: missing guard for code ${JSON.stringify(code)} at path manifest.guards; repair: add a guard case that turns ${JSON.stringify(code)} red.`)
    }
  }
}

/** @param {Record<string, unknown>} value @param {string} label */
function assertStringArray(value, label, path) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`${label}: expected a string list at path ${path}; repair: restore the list of closed failure codes at ${path}.`)
  }
}

/** @param {Record<string, unknown>} value */
function validateEvidenceFamilyShape(value) {
  const label = EVIDENCE_CASES
  assertExactFields(value, ['expectedCaseCount', 'base', 'templates', 'cases', 'forbiddenVerifierPatterns'], label, 'document')
  const base = /** @type {Record<string, unknown>} */ (value.base)
  assertExactFields(base, ['runId', 'mode', 'nowMs', 'policy', 'rows'], label, 'base')
  assertExactFields(base.policy, ['version', 'artifactClasses', 'requiredRows', 'duplicateScopes', 'maxAgeMs', 'maxOutputBytes'], label, 'base.policy')
  const templates = /** @type {Record<string, Record<string, unknown>>} */ (value.templates)
  for (const [name, template] of Object.entries(templates)) {
    assertExactFields(template, TEMPLATE_FIELDS, label, `templates.${name}`)
  }
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no cases at path cases; repair: restore the named case list.`)
  for (const [index, entry] of cases.entries()) {
    const path = `cases[${index}]`
    if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
      throw new Error(`${label}: case ${index} is missing its required name at path ${path}.name; repair: restore the required case name.`)
    }
    if (!CHECK_DISCRIMINATORS.includes(/** @type {string} */ (entry.check))) {
      throw new Error(`${label}: case "${entry.name}" names an unknown discriminator ${JSON.stringify(entry.check)} for field "check" at path ${path}.check; repair: use one of ${CHECK_DISCRIMINATORS.join(', ')} for "check".`)
    }
    if (entry.check === 'verdict') {
      assertExactFields(entry, ['name', 'check', 'mutations', 'expectComplete', 'expectedCodes'], label, path)
      if (!Array.isArray(entry.mutations) || entry.mutations.length === 0) {
        throw new Error(`${label}: case "${entry.name}" holds no mutations at path ${path}.mutations; repair: keep at least one mutation so the case is executable.`)
      }
      for (const [mIndex, mutation] of /** @type {Record<string, unknown>[]} */ (entry.mutations).entries()) {
        if (!CASE_MUTATION_KINDS.has(/** @type {string} */ (mutation.kind))) {
          throw new Error(`${label}: case "${entry.name}" names an unknown mutation kind ${JSON.stringify(mutation.kind)} for field "kind" at path ${path}.mutations[${mIndex}].kind; repair: use one of ${[...CASE_MUTATION_KINDS].join(', ')} for "kind".`)
        }
      }
      if (typeof entry.expectComplete !== 'boolean') {
        throw new Error(`${label}: case "${entry.name}" is missing a boolean outcome at path ${path}.expectComplete; repair: restore the expected completeness boolean.`)
      }
      assertStringArray(entry.expectedCodes, label, `${path}.expectedCodes`)
    } else {
      assertExactFields(entry, ['name', 'check', 'run', 'expectValid', ...(entry.expectValid ? [] : ['expectedErrorContains'])], label, path)
      if ('expectedErrorContains' in entry) assertStringArray(entry.expectedErrorContains, label, `${path}.expectedErrorContains`)
    }
  }
  if (!Array.isArray(value.forbiddenVerifierPatterns) || value.forbiddenVerifierPatterns.length === 0) {
    throw new Error(`${label}: expected a non-empty pattern list at path forbiddenVerifierPatterns; repair: restore the forbidden verifier patterns.`)
  }
  for (const [index, entry] of /** @type {Record<string, unknown>[]} */ (value.forbiddenVerifierPatterns).entries()) {
    assertExactFields(entry, ['name', 'pattern'], label, `forbiddenVerifierPatterns[${index}]`)
    try {
      new RegExp(/** @type {string} */ (entry.pattern))
    } catch {
      throw new Error(`${label}: invalid pattern at path forbiddenVerifierPatterns[${index}].pattern; repair: restore a valid pattern.`)
    }
  }
}

/** @param {Record<string, unknown>} spec @returns {Record<string, unknown>} */
function buildProof(spec) {
  const kind = spec.proofKind ?? spec.kind
  const identity = { kind, id: spec.proofIdentityId ?? spec.identityId, createdAtMs: 1000 }
  const observed = { observed: true, observedAtMs: spec.observedAtMs }
  const theme = { expected: spec.theme, observed: spec.theme, source: 'fixture-proof', observedAtMs: spec.observedAtMs }
  if (kind === 'product') {
    return {
      kind: 'product',
      identity,
      chrome: { ...observed },
      body: { ...observed },
      route: { ...observed },
      activeSection: { ...observed },
      view: { ...observed },
      theme,
    }
  }
  return { kind: 'component', identity, root: { mounted: true, observedAtMs: spec.observedAtMs }, theme }
}

/** @param {Record<string, unknown>} entry @param {Record<string, Record<string, unknown>>} templates */
function buildRow(entry, templates) {
  const use = entry.use
  const spec = use
    ? { ...structuredClone(templates[use]), ...(entry.patch ?? {}) }
    : { ...entry }
  const recorded = /** @type {Record<string, string>} */ (spec.recordedDigests ?? {})
  const artifacts = Object.entries(/** @type {Record<string, string>} */ (spec.artifacts ?? {})).map(([name, content]) =>
    createArtifactObservation({ name, content, digest: recorded[name] ?? artifactDigest(content) }))
  return createEvidenceRow({
    key: /** @type {string} */ (spec.key),
    kind: /** @type {string} */ (spec.kind),
    theme: /** @type {string} */ (spec.theme),
    identity: { kind: /** @type {string} */ (spec.kind), id: /** @type {string} */ (spec.identityId), createdAtMs: 1000 },
    proof: spec.proof === 'absent' ? null : buildProof(spec),
    themeObservation: {
      expected: /** @type {Record<string, string>} */ (spec.themeObservation).expected,
      observed: /** @type {Record<string, string>} */ (spec.themeObservation).observed,
      source: 'fixture',
      observedAtMs: /** @type {number} */ (spec.observedAtMs),
    },
    provenance: spec.provenance === null
      ? null
      : { root: /** @type {Record<string, string>} */ (spec.provenance).root, servedFrom: /** @type {Record<string, string>} */ (spec.provenance).servedFrom },
    artifacts,
    observedAtMs: /** @type {number} */ (spec.observedAtMs),
  })
}

/** @param {Record<string, unknown>} spec @param {string} target @param {Record<string, Record<string, unknown>>} templates */
function findRow(spec, target, templates) {
  const rows = /** @type {Record<string, unknown>[]} */ (spec.rows)
  const index = rows.findIndex((row) => row.use === target)
  if (index === -1) throw new Error(`unknown mutation target ${target}`)
  const row = rows[index]
  return row
}

/** @param {Record<string, unknown>} row @param {Record<string, Record<string, unknown>>} templates @returns {Record<string, string>} */
function currentArtifacts(row, templates) {
  const template = templates[/** @type {string} */ (row.use)]
  const patch = /** @type {Record<string, unknown>} */ (row.patch ?? {})
  const base = /** @type {Record<string, string>} */ (patch.artifacts ?? template.artifacts ?? {})
  return { ...base }
}

/** @param {Record<string, unknown>} base @param {Record<string, unknown>} mutation @param {Record<string, Record<string, unknown>>} templates @param {string} label */
function applyCaseMutation(base, mutation, templates, label) {
  const spec = base
  const kind = /** @type {string} */ (mutation.kind)
  if (kind === 'none') return
  if (kind === 'set-run-id') { spec.actualRunId = mutation.value; return }
  if (kind === 'set-mode') { spec.mode = mutation.value; return }
  if (kind === 'set-policy') {
    /** @type {Record<string, unknown>} */ (spec.policy)[/** @type {string} */ (mutation.field)] = structuredClone(mutation.value)
    return
  }
  if (kind === 'set-required') {
    const required = /** @type {Record<string, unknown>[]} */ (/** @type {Record<string, unknown>} */ (spec.policy).requiredRows).find((row) => row.key === mutation.target)
    if (!required) throw new Error(`${label}: unknown required-row target ${mutation.target}`)
    if ('rowKind' in mutation) required.kind = mutation.rowKind
    if ('theme' in mutation) required.theme = mutation.theme
    if ('root' in mutation) required.root = mutation.root
    return
  }
  if (kind === 'delete-row') {
    spec.rows = /** @type {Record<string, unknown>[]} */ (spec.rows).filter((row) => row.use !== mutation.target)
    return
  }
  if (kind === 'add-row') {
    /** @type {Record<string, unknown>[]} */ (spec.rows).push(structuredClone(mutation.row))
    return
  }
  if (kind === 'patch-row') {
    const row = findRow(spec, /** @type {string} */ (mutation.target), templates)
    row.patch = { .../** @type {Record<string, unknown>} */ (row.patch ?? {}), ...structuredClone(mutation.patch) }
    return
  }
  const row = findRow(spec, /** @type {string} */ (mutation.target), templates)
  if (kind === 'delete-artifact') {
    const artifacts = currentArtifacts(row, templates)
    delete artifacts[/** @type {string} */ (mutation.artifact)]
    row.patch = { .../** @type {Record<string, unknown>} */ (row.patch ?? {}), artifacts }
    return
  }
  if (kind === 'add-artifact' || kind === 'set-artifact-content') {
    const artifacts = currentArtifacts(row, templates)
    artifacts[/** @type {string} */ (mutation.artifact)] = /** @type {string} */ (mutation.content)
    row.patch = { .../** @type {Record<string, unknown>} */ (row.patch ?? {}), artifacts }
    return
  }
  if (kind === 'set-artifact-digest') {
    const patch = /** @type {Record<string, unknown>} */ (row.patch ?? {})
    row.patch = {
      ...patch,
      recordedDigests: { .../** @type {Record<string, string>} */ (patch.recordedDigests ?? {}), [/** @type {string} */ (mutation.artifact)]: mutation.digest },
    }
    return
  }
  throw new Error(`${label}: unsupported case mutation kind ${kind}`)
}

/** @param {Record<string, unknown>} base @param {Record<string, Record<string, unknown>>} templates @param {string} label */
function materializeRun(base, templates, label) {
  const spec = structuredClone(base)
  const rows = /** @type {Record<string, unknown>[]} */ (spec.rows).map((row) => buildRow(row, templates))
  const run = {
    identity: { kind: 'run', id: spec.actualRunId ?? spec.runId, createdAtMs: 1000 },
    mode: spec.mode,
    rows,
  }
  const policySpec = /** @type {Record<string, unknown>} */ (spec.policy)
  const policy = createEvidencePolicy({
    version: policySpec.version,
    runId: spec.runId,
    mode: EVIDENCE_MODES[0],
    artifactClasses: policySpec.artifactClasses,
    requiredRows: policySpec.requiredRows,
    duplicateScopes: policySpec.duplicateScopes,
    maxAgeMs: policySpec.maxAgeMs,
    maxOutputBytes: policySpec.maxOutputBytes,
  })
  return { run, policy, nowMs: spec.nowMs }
}

/** @param {Record<string, unknown>} entry @param {Record<string, unknown>} family */
function executeEvidenceCase(entry, family) {
  if (entry.check === 'run') {
    let message = null
    try {
      createEvidenceRun(/** @type {never} */ (entry.run))
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    if (entry.expectValid) {
      assert.equal(message, null, `${entry.name}: valid run failed construction: ${message}`)
      return { report: null }
    }
    assert.ok(message, `${entry.name}: invalid run passed construction`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, /** @type {string} */ (entry.name))
    return { report: null }
  }
  const base = /** @type {Record<string, unknown>} */ (family.base)
  const templates = /** @type {Record<string, Record<string, unknown>>} */ (family.templates)
  const spec = structuredClone(base)
  for (const [index, mutation] of /** @type {Record<string, unknown>[]} */ (entry.mutations).entries()) {
    applyCaseMutation(spec, mutation, templates, `${entry.name}.mutations[${index}]`)
  }
  const { run, policy, nowMs } = materializeRun(spec, templates, /** @type {string} */ (entry.name))
  const report = verifyEvidenceRun(run, policy, { nowMs })
  validateEvidenceReport(report, /** @type {string} */ (entry.name))
  assert.equal(
    report.complete,
    entry.expectComplete,
    `${entry.name}: report.complete ${report.complete} does not match expected at path case.expectComplete; repair: restore the expected completeness outcome.`,
  )
  assert.equal(
    report.verdict,
    entry.expectComplete ? 'pass' : 'fail',
    `${entry.name}: report.verdict contradicts complete at path case.expectComplete; repair: derive the verdict from the failure list.`,
  )
  assert.deepEqual(
    [...report.failureCodes].sort(),
    [.../** @type {string[]} */ (entry.expectedCodes)].sort(),
    `${entry.name}: failure codes ${JSON.stringify(report.failureCodes)} do not match expected at path case.expectedCodes; repair: restore the intended guard outcome.`,
  )
  return { report }
}

describe('evidence verifier fixture family', () => {
  const source = readFileSync(new URL(EVIDENCE_CASES, TESTDATA), 'utf8')
  const manifest = /** @type {Record<string, unknown>} */ (readFamily(EVIDENCE_CASES_MANIFEST))
  const parsed = /** @type {Record<string, unknown>} */ (readFamily(EVIDENCE_CASES))

  it('holds a valid manifest and guard inventory', () => {
    validateEvidenceManifest(manifest)
  })

  it('holds exact fields, templates, and required names', () => {
    validateEvidenceFamilyShape(parsed)
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    assert.equal(cases.length, manifest.expectedCaseCount, `${EVIDENCE_CASES}: case count must match the manifest`)
    checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), EVIDENCE_CASES)
  })

  it('executes every behavioral and constructor case', () => {
    for (const entry of /** @type {Record<string, unknown>[]} */ (parsed.cases)) executeEvidenceCase(entry, parsed)
  })

  it('turns every named guard code red through its owning case', () => {
    const byName = new Map(/** @type {Record<string, unknown>[]} */ (parsed.cases).map((entry) => [entry.name, entry]))
    for (const guard of /** @type {Record<string, unknown>[]} */ (manifest.guards)) {
      const entry = byName.get(/** @type {string} */ (guard.case))
      assert.ok(entry, `${guard.name}: unknown case ${guard.case}`)
      const { report } = executeEvidenceCase(entry, parsed)
      assert.ok(report, `${guard.name}: guard case ${guard.case} is not a verdict case`)
      assert.ok(
        report.failureCodes.includes(/** @type {string} */ (guard.code)),
        `${guard.name}: case ${guard.case} did not produce ${guard.code}; got ${JSON.stringify(report.failureCodes)}`,
      )
    }
  })

  it('fails every executable fixture mutation for its intended field', () => {
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          loadSingleDocument(`${source.trimEnd()}\n---\norphan: true\n`, EVIDENCE_CASES)
        } else {
          const cases = structuredClone(/** @type {Record<string, unknown>[]} */ (parsed.cases))
          applyMutation(cases, mutation)
          validateEvidenceFamilyShape({ ...parsed, cases })
          checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), EVIDENCE_CASES)
          for (const entry of cases) executeEvidenceCase(entry, { ...parsed, cases })
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${EVIDENCE_CASES}: mutation "${mutation.name}" passed validation instead of failing`)
      assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${EVIDENCE_CASES}: mutation "${mutation.name}" names the wrong field; got ${message}`)
      assert.ok(message.includes('at path'), `${EVIDENCE_CASES}: mutation "${mutation.name}" is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `${EVIDENCE_CASES}: mutation "${mutation.name}" is missing repair guidance: ${message}`)
    }
  })

  it('keeps the verifier and core free of route, selector, and threshold literals', () => {
    const sources = [
      ...readdirSync(EVIDENCE_DIR).filter((name) => name.endsWith('.mjs')).map((name) => ({
        file: `src/evidence/${name}`,
        text: readFileSync(new URL(name, EVIDENCE_DIR), 'utf8'),
      })),
      { file: 'scripts/fairtest/verify-fairtest.mjs', text: readFileSync(VERIFIER_CLI, 'utf8') },
    ]
    for (const entry of /** @type {Record<string, unknown>[]} */ (parsed.forbiddenVerifierPatterns)) {
      const pattern = new RegExp(/** @type {string} */ (entry.pattern))
      for (const sourceFile of sources) {
        assert.ok(!pattern.test(sourceFile.text), `${sourceFile.file}: matches forbidden verifier pattern ${(/** @type {string} */ (entry.name))}`)
      }
    }
  })

  it('declares the verify command in the root manifest and keeps it browser-free', () => {
    const rootManifest = JSON.parse(readFileSync(ROOT_MANIFEST, 'utf8'))
    assert.ok(
      String(rootManifest.scripts?.['test:fairtest:verify'] ?? '').includes('scripts/fairtest/verify-fairtest.mjs'),
      'test:fairtest:verify must run the browser-neutral verifier CLI',
    )
    const cli = readFileSync(VERIFIER_CLI, 'utf8')
    assert.ok(cli.includes('fairtest-source.mjs'), 'verifier CLI must reach the child source through the sole source route')
    assert.ok(!/from\s*['"](?:playwright|puppeteer|@playwright\/test)['"]/.test(cli), 'verifier CLI must import no browser runner')
  })
})
