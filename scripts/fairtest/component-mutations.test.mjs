// Executable suite for the named negative component mutations and the
// verifier-facing component evidence corpus.
//
// The eighteen named mutations have exactly ONE diagnostics table and ONE
// execution owner, and neither lives here: the table is the `component-mutation`
// rows of scripts/fairtest/component-target.testdata.yaml and the execution is
// the component fixture family's `executes every named case` in
// component-adapter.test.mjs. This suite therefore does not re-run the eighteen
// and does not restate their expectations; it proves the single owner is real
// and it covers the invariants a fixture row cannot express:
// - both cross-kind refusal directions through the real shared contract;
// - the one-project config matching exactly the two journeys;
// - the component artifact set equalling the product set;
// - the real-DOM root states on the live served story in one bounded browser
//   session;
// - the verifier-facing evidence corpus (scripts/testdata/) reading rule;
// - the source-route and forbidden-material guards for the mutation module.
//
// Precondition: run pnpm build-storybook first so storybook-static/ holds the
// exact built story. No product app service, Storybook dev server, Puppeteer
// catalog, or second adapter is started.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { importFairtestSource } from '../fairtest-source.mjs'
import { loadSingleDocument } from '../fairtest-single-document.mjs'
import { observeProductTheme, normalizeRenderedTheme } from './fairtrade-targets.mjs'
import {
  COMPONENT_ARTIFACT_CLASSES,
  assertComponentObservationTimes,
  readComponentAccessibilityVerdict,
} from './component-producer.mjs'
import {
  COMPONENT_CONFIG_TEST_MATCH,
  COMPONENT_MUTATION_BOUNDARIES,
  COMPONENT_MUTATION_NAMES,
  assertComponentArtifactParity,
  assertComponentRunnerConfigMatchesJourneys,
  proveComponentRootStatesRealPath,
  readAndAssertComponentRunnerConfig,
  runComponentMutation,
} from './component-mutations.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CORPUS_REL = 'scripts/fairtest/component-target.testdata.yaml'
const EVIDENCE_REL = 'scripts/testdata/fairtest-component-evidence.yaml'
const EVIDENCE_MANIFEST_REL = 'scripts/testdata/fairtest-component-evidence.manifest.yaml'
const CHILD_MARKER = ['packages', 'fairtest'].join('/')
const MUTATION_CHECK = 'component-mutation'
const EVIDENCE_CHECKS = [
  'component-evidence-artifact',
  'component-evidence-artifact-parity',
  'component-evidence-verdict',
  'component-evidence-theme',
  'component-evidence-observation-time',
  'component-evidence-config',
]
const EVIDENCE_MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'stale-name', 'trailing-document'])

const corpus = /** @type {Record<string, unknown>} */ (loadSingleDocument(readFileSync(resolve(ROOT, CORPUS_REL), 'utf8'), CORPUS_REL))
const mutationRows = /** @type {Record<string, unknown>[]} */ (corpus.cases).filter((entry) => entry.check === MUTATION_CHECK)
const evidenceSource = readFileSync(resolve(ROOT, EVIDENCE_REL), 'utf8')
const evidenceManifestSource = readFileSync(resolve(ROOT, EVIDENCE_MANIFEST_REL), 'utf8')

const coreFixtures = await importFairtestSource('src/core/fixtures.mjs')

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
 * Validate one evidence case shape: exact field set for its check and the
 * verdict marker.
 * @param {Record<string, unknown>} entry evidence case
 * @param {number} index case index
 */
function checkEvidenceShape(entry, index) {
  const path = `cases[${index}]`
  if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
    throw new Error(`${EVIDENCE_REL}: case ${index} is missing its required name at path ${path}.name; repair: restore the required case name.`)
  }
  if (!EVIDENCE_CHECKS.includes(/** @type {string} */ (entry.check))) {
    throw new Error(`${EVIDENCE_REL}: case "${entry.name}" names an unknown discriminator ${JSON.stringify(entry.check)} for field "check" at path ${path}.check; repair: use one of ${EVIDENCE_CHECKS.join(', ')} for "check".`)
  }
  if (typeof entry.expectValid !== 'boolean') {
    throw new Error(`${EVIDENCE_REL}: case "${entry.name}" is missing its verdict for field "expectValid" at path ${path}.expectValid; repair: set expectValid to true or false.`)
  }
  const tail = entry.expectValid ? ['expectValid', 'expectFrozen'] : ['expectValid', 'expectedErrorContains']
  const fieldsByCheck = {
    'component-evidence-artifact': ['name', 'check', 'artifact', ...tail],
    'component-evidence-artifact-parity': ['name', 'check', ...tail],
    'component-evidence-verdict': entry.informationalChurn === undefined
      ? ['name', 'check', 'accessibility', 'expectVerdict', ...tail]
      : ['name', 'check', 'accessibility', 'expectVerdict', 'informationalChurn', ...tail],
    'component-evidence-theme': entry.expectValid
      ? ['name', 'check', 'theme', 'renderedAttribute', 'expectTheme', ...tail]
      : ['name', 'check', 'theme', 'renderedAttribute', ...tail],
    'component-evidence-observation-time': entry.expectValid
      ? ['name', 'check', 'times', 'expectValid']
      : ['name', 'check', 'times', 'expectValid', 'expectedErrorContains'],
    'component-evidence-config': ['name', 'check', 'testMatch', 'project', ...tail],
  }
  const fields = fieldsByCheck[entry.check]
  for (const field of fields) {
    if (!(field in entry)) {
      throw new Error(`${EVIDENCE_REL}: case "${entry.name}" is missing required field "${field}" at path ${path}.${field}; repair: restore "${field}" in ${EVIDENCE_REL}.`)
    }
  }
  for (const key of Object.keys(entry)) {
    if (!fields.includes(key)) {
      throw new Error(`${EVIDENCE_REL}: case "${entry.name}" carries unknown field "${key}" at path ${path}.${key}; repair: remove "${key}" from ${EVIDENCE_REL}.`)
    }
  }
  if (!entry.expectValid) {
    const fragments = entry.expectedErrorContains
    if (!Array.isArray(fragments) || fragments.length === 0 || fragments.some((fragment) => typeof fragment !== 'string' || fragment.length === 0)) {
      throw new Error(`${EVIDENCE_REL}: case "${entry.name}" is missing its expected-error fragments at path ${path}.expectedErrorContains; repair: list the diagnostic fragments the case must produce.`)
    }
  }
}

/**
 * Run one evidence case through the real app-owned reader.
 * @param {Record<string, unknown>} entry evidence case
 */
function runEvidenceCase(entry) {
  const name = /** @type {string} */ (entry.name)
  switch (entry.check) {
    case 'component-evidence-artifact':
      return runEvidenceArtifactCase(entry)
    case 'component-evidence-artifact-parity':
      return runEvidenceArtifactParityCase(entry)
    case 'component-evidence-verdict':
      return runEvidenceVerdictCase(entry)
    case 'component-evidence-theme':
      return runEvidenceThemeCase(entry)
    case 'component-evidence-observation-time':
      return runEvidenceObservationTimeCase(entry)
    case 'component-evidence-config':
      return runEvidenceConfigCase(entry)
    default:
      throw new Error(`${EVIDENCE_REL}: case "${name}" names an unknown check ${JSON.stringify(entry.check)}`)
  }
}

/** @param {Record<string, unknown>} entry */
function runEvidenceArtifactCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const receipt = assertComponentArtifactParity()
  if (entry.expectValid) {
    assert.ok(receipt.classes.includes(/** @type {string} */ (entry.artifact)), `${name}: artifact ${JSON.stringify(entry.artifact)} must be one of the shared six`)
    return
  }
  const message = COMPONENT_ARTIFACT_CLASSES.includes(/** @type {string} */ (entry.artifact))
    ? `${EVIDENCE_REL}: case "${name}" expects a shared artifact class to fail`
    : `component mutations: unknown artifact class ${JSON.stringify(entry.artifact)} for field "artifact" at path artifactClasses; ` +
      `repair: use one of ${COMPONENT_ARTIFACT_CLASSES.join(', ')} for "artifact".`
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runEvidenceArtifactParityCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const receipt = assertComponentArtifactParity()
  assert.equal(Object.isFrozen(receipt), true, `${name}: the parity receipt must be frozen`)
  assert.equal(receipt.count, 6, `${name}: the shared set must hold exactly six classes`)
}

/** @param {Record<string, unknown>} entry */
function runEvidenceVerdictCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const accessibility = structuredClone(entry.accessibility)
  if (entry.informationalChurn) {
    const churn = /** @type {{ field: string, value: number }} */ (entry.informationalChurn)
    accessibility.pageWide[churn.field] = churn.value
  }
  if (entry.expectValid) {
    const verdict = readComponentAccessibilityVerdict(accessibility)
    assert.equal(Object.isFrozen(verdict), true, `${name}: the verdict must be frozen`)
    assert.equal(verdict.result, entry.expectVerdict, `${name}: the verdict must come from the gate receipt`)
    return
  }
  const message = caught(() => readComponentAccessibilityVerdict(accessibility))
  assert.ok(message, `${name}: the case must fail closed on the reader`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runEvidenceThemeCase(entry) {
  const name = /** @type {string} */ (entry.name)
  if (entry.expectValid) {
    assert.equal(normalizeRenderedTheme(entry.renderedAttribute), entry.expectTheme, `${name}: the rendered value must normalize to the expected theme`)
    const observation = observeProductTheme({
      expected: entry.theme,
      renderedAttribute: entry.renderedAttribute,
      source: 'component-evidence',
      observedAtMs: 1000,
    })
    assert.equal(Object.isFrozen(observation), true, `${name}: the observation must be frozen`)
    assert.equal(observation.observed, entry.expectTheme, `${name}: the observation must carry the normalized theme`)
    return
  }
  const message = caught(() => observeProductTheme({
    expected: entry.theme,
    renderedAttribute: entry.renderedAttribute,
    source: 'component-evidence',
    observedAtMs: 1000,
  }))
  assert.ok(message, `${name}: the case must fail closed on the theme observation`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runEvidenceObservationTimeCase(entry) {
  const name = /** @type {string} */ (entry.name)
  if (entry.expectValid) {
    assertComponentObservationTimes(entry.times)
    return
  }
  const message = caught(() => assertComponentObservationTimes(entry.times))
  assert.ok(message, `${name}: the case must fail closed on the observation-time guard`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {Record<string, unknown>} entry */
function runEvidenceConfigCase(entry) {
  const name = /** @type {string} */ (entry.name)
  const config = {
    testMatch: entry.testMatch,
    projects: [{ name: entry.project }],
  }
  if (entry.expectValid) {
    const receipt = assertComponentRunnerConfigMatchesJourneys(config)
    assert.equal(Object.isFrozen(receipt), true, `${name}: the config receipt must be frozen`)
    assert.deepEqual([...receipt.testMatch], [...COMPONENT_CONFIG_TEST_MATCH], `${name}: the config must match the two journeys`)
    return
  }
  const message = caught(() => assertComponentRunnerConfigMatchesJourneys(config))
  assert.ok(message, `${name}: the case must fail closed on the config guard`)
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/**
 * Validate the evidence manifest inventory.
 * @param {Record<string, unknown>} manifest parsed manifest
 */
function validateEvidenceManifest(manifest) {
  const fields = ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations']
  for (const field of fields) {
    if (!(field in manifest)) {
      throw new Error(`${EVIDENCE_MANIFEST_REL}: missing required field "${field}" at path manifest.${field}; repair: restore "${field}".`)
    }
  }
  for (const key of Object.keys(manifest)) {
    if (!fields.includes(key)) {
      throw new Error(`${EVIDENCE_MANIFEST_REL}: unknown field "${key}" at path manifest.${key}; repair: remove "${key}".`)
    }
  }
  const names = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(names).size, names.length, `${EVIDENCE_MANIFEST_REL}: required case names must be unique`)
  assert.equal(manifest.expectedCaseCount, names.length, `${EVIDENCE_MANIFEST_REL}: case count must equal the required-name inventory`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${EVIDENCE_MANIFEST_REL}: mutation count must equal the mutation inventory`)
  for (const name of /** @type {string[]} */ (manifest.requiredMutationNames)) {
    assert.ok(mutations.some((entry) => entry.name === name), `${EVIDENCE_MANIFEST_REL}: missing required mutation ${name}`)
  }
  for (const [index, mutation] of mutations.entries()) {
    assert.ok(EVIDENCE_MUTATION_KINDS.has(String(mutation.kind)), `${EVIDENCE_MANIFEST_REL}: mutation ${index} names an unknown kind`)
    assert.ok(typeof mutation.expectedField === 'string' && mutation.expectedField.length, `${EVIDENCE_MANIFEST_REL}: mutation ${index} must name its intended field`)
    if (mutation.kind !== 'trailing-document') {
      assert.ok(names.includes(String(mutation.target)), `${EVIDENCE_MANIFEST_REL}: mutation ${index} targets an unknown case`)
    }
  }
}

/**
 * Validate the evidence corpus and run every case.
 * @param {Record<string, unknown>[]} cases parsed evidence cases
 * @param {Record<string, unknown>} manifest parsed manifest
 */
function validateAndRunEvidence(cases, manifest) {
  assert.ok(Array.isArray(cases) && cases.length > 0, `${EVIDENCE_REL}: record holds no cases at path cases; repair: restore the named evidence cases.`)
  coreFixtures.checkRequiredNames(cases.map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), EVIDENCE_REL)
  cases.forEach(checkEvidenceShape)
}

/** @param {Record<string, unknown>[]} cases @param {Record<string, unknown>} mutation */
function applyEvidenceMutation(cases, mutation) {
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

describe('named negative component mutations', () => {
  it('names exactly the required mutations with owning boundaries', () => {
    assert.deepEqual([...COMPONENT_MUTATION_NAMES], [
      'missing-root',
      'empty-root',
      'error-display-root',
      'wrong-theme',
      'contradictory-theme',
      'missing-interaction',
      'non-completing-interaction',
      'product-shaped-record',
      'cross-kind-product-shell',
      'cross-kind-product-record',
      'stale-run-root',
      'stale-artifact',
      'missing-artifact',
      'provenance-relative-unresolved',
      'provenance-external-link',
      'screenshot-floor',
      'aria-floor',
      'digest-mismatch',
    ])
    assert.deepEqual(Object.keys(COMPONENT_MUTATION_BOUNDARIES).sort(), [...COMPONENT_MUTATION_NAMES].sort())
    for (const name of COMPONENT_MUTATION_NAMES) {
      assert.match(COMPONENT_MUTATION_BOUNDARIES[name], /at path|at \w+\./, `${name}: boundary must name the owning field`)
    }
  })

  it('leaves the diagnostics and their execution to the one fixture owner', () => {
    assert.deepEqual(
      mutationRows.map((row) => String(row.mutation)).sort(),
      [...COMPONENT_MUTATION_NAMES].sort(),
      `the ${CORPUS_REL} ${MUTATION_CHECK} rows must claim every named mutation exactly once`,
    )
    for (const row of mutationRows) {
      const name = String(row.name)
      const fragments = /** @type {string[]} */ (row.expectedErrorContains)
      assert.ok(Array.isArray(fragments) && fragments.length > 0, `${name}: the owner row must carry diagnostic fragments`)
      assert.ok(fragments.includes('repair:'), `${name}: the owner row must require an actionable repair`)
    }
  })

  it('rejects an unknown mutation name instead of running anything', async () => {
    await assert.rejects(
      () => runComponentMutation('missing-everything'),
      /"missing-everything".*field "mutation".*at path mutation\.name.*repair:/s,
    )
  })

  it('drives both cross-kind refusal directions through the real shared contract', async () => {
    await assert.rejects(
      () => runComponentMutation('cross-kind-product-shell'),
      /cross-kind resolution "component".*at path resolution\.kind.*repair:/s,
    )
    await assert.rejects(
      () => runComponentMutation('cross-kind-product-record'),
      /product-only field "chrome".*at path resolution\.chrome.*repair:/s,
    )
  })

  it('matches exactly the product and component journeys and never the catalog', async () => {
    const receipt = await readAndAssertComponentRunnerConfig()
    assert.deepEqual([...receipt.testMatch], [...COMPONENT_CONFIG_TEST_MATCH])
    assert.equal(receipt.project, 'fairtest')
    const catalog = caught(() => assertComponentRunnerConfigMatchesJourneys({
      testMatch: ['**/product.journey.mjs', '**/component.journey.mjs', '**/storybook-smoke.journey.mjs'],
      projects: [{ name: 'fairtest' }],
    }))
    assert.ok(catalog && catalog.includes('testMatch'), `a catalog match must fail the config guard; got ${catalog}`)
  })

  it('writes the same six artifact class names as the product row', () => {
    const receipt = assertComponentArtifactParity()
    assert.deepEqual([...receipt.classes], ['record.json', 'aria.json', 'axe.json', 'screenshot.png', 'provenance.json', 'resolution.json'])
    assert.equal(receipt.count, 6)
  })

  it('refuses the real missing, static-empty, and load-error roots on the live served story', { timeout: 120000 }, async () => {
    const evidence = await proveComponentRootStatesRealPath()
    assert.equal(evidence.length, 3, 'the real-DOM proof must cover the missing, static-empty, and load-error root states')
    for (const entry of evidence) {
      assert.equal(entry.refused, true, `${entry.state}: the real tree must refuse the state`)
      assert.ok(entry.diagnostic.length > 0, `${entry.state}: the refusal must carry a diagnostic`)
      console.log(`COMPONENT-ROOT-STATE ${entry.state} :: ${entry.diagnostic.split('\n')[0].slice(0, 160)}`)
    }
  })

  it('loads child values only through the sole source route', () => {
    const text = readFileSync(resolve(HERE, 'component-mutations.mjs'), 'utf8')
    assert.ok(!text.includes(CHILD_MARKER), 'component-mutations.mjs: names a second route into the private child at path import; repair: load child values only through ../fairtest-source.mjs.')
    const dynamic = [...text.matchAll(/importFairtestSource\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1])
    assert.ok(dynamic.length > 0, 'component-mutations.mjs: holds no child imports')
    for (const spec of dynamic) {
      assert.ok(spec.startsWith('src/'), `component-mutations.mjs: source spec ${JSON.stringify(spec)} escapes the child tree at path import; repair: use a child-relative src/ path.`)
    }
    for (const token of ['puppeteer', 'jsdom', 'agent-browser']) {
      assert.ok(!text.includes(token), `component-mutations.mjs: names forbidden material ${JSON.stringify(token)}; repair: keep catalog and DOM material in the producer and the live page.`)
    }
    assert.ok(importFairtestSource, 'the sole source route must stay imported')
  })
})

describe('verifier-facing component evidence corpus', () => {
  const manifest = /** @type {Record<string, unknown>} */ (loadSingleDocument(evidenceManifestSource, EVIDENCE_MANIFEST_REL))
  const parsed = /** @type {Record<string, unknown>} */ (loadSingleDocument(evidenceSource, EVIDENCE_REL))

  it('holds a valid manifest inventory', () => {
    validateEvidenceManifest(manifest)
  })

  it('holds exact fields and required names', () => {
    assert.equal(parsed.expectedCaseCount, manifest.expectedCaseCount, `${EVIDENCE_REL}: case count must match the manifest`)
    validateAndRunEvidence(/** @type {Record<string, unknown>[]} */ (parsed.cases), manifest)
  })

  it('executes every evidence case through the real reader', () => {
    for (const entry of /** @type {Record<string, unknown>[]} */ (parsed.cases)) {
      runEvidenceCase(entry)
    }
  })

  it('accepts a legal leading start marker as one record', () => {
    const leading = /** @type {Record<string, unknown>} */ (loadSingleDocument(`---\n${evidenceSource}`, EVIDENCE_REL))
    validateAndRunEvidence(/** @type {Record<string, unknown>[]} */ (leading.cases), manifest)
  })

  it('rejects a trailing record after the end marker', () => {
    const message = caught(() => loadSingleDocument(`${evidenceSource.trimEnd()}\n---\norphan: true\n`, EVIDENCE_REL))
    assert.ok(message, 'trailing record must fail single-record loading')
    assert.match(message, /trailing/)
    assert.match(message, /at path.*repair:/s)
  })

  it('fails every executable mutation for its intended field', () => {
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          message = caught(() => loadSingleDocument(`${evidenceSource.trimEnd()}\n---\norphan: true\n`, EVIDENCE_REL))
        } else {
          const mutated = structuredClone(cases)
          applyEvidenceMutation(mutated, mutation)
          validateAndRunEvidence(mutated, manifest)
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
