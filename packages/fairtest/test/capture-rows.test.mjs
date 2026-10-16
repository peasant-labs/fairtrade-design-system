// @ts-check

// Capture-row contract tests. Every behavioral case lives in the named
// capture-rows YAML family with a required-name manifest; this file owns no
// case data. Composes the real child capture model and the real neutral
// verifier without a browser, service, runner, or network.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { assertExactFields, checkRequiredNames, loadSingleDocument } from '../src/core/index.mjs'
import { artifactDigest, verifyEvidenceRun } from '../src/evidence/index.mjs'
import {
  assertCaptureShotsDigest,
  buildCaptureRun,
  captureRecordDigest,
  classifyCaptureTarget,
  createCaptureRecord,
  reconcileCaptureRecord,
} from '../src/capture/index.mjs'

/**
 * @typedef {import('../src/capture/record.mjs').CaptureRecord} CaptureRecord
 * @typedef {import('../src/evidence/policy.mjs').EvidencePolicyInput} EvidencePolicyInput
 * @typedef {import('../src/evidence/record.mjs').EvidenceProvenance} EvidenceProvenance
 * @typedef {object} VerificationReport
 * @property {string} verdict
 * @property {string[]} failureCodes
 * @property {{ repair: string }[]} failures
 * @property {Record<string, unknown>[]} rows
 */

const TESTDATA = new URL('../testdata/', import.meta.url)
const CORPUS = 'capture-rows.yaml'
const MANIFEST = 'capture-rows.manifest.yaml'
const CHECKS = ['verify', 'fixture']
const MUTATIONS = ['none', 'drop-artifact', 'tamper-digest', 'drop-proof', 'cross-root', 'theme-mismatch', 'shot-without-file', 'silent-miss', 'both-shot-and-reason', 'shot-digest-mismatch']
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])

/** @param {string} relative @returns {string} */
function readSource(relative) {
  return readFileSync(new URL(relative, TESTDATA), 'utf8')
}

/** @param {string} relative @returns {Record<string, unknown>} */
function readFamily(relative) {
  return /** @type {Record<string, unknown>} */ (loadSingleDocument(readSource(relative), relative))
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Verify one run and read the report through its declared shape.
 * @param {object} run evidence run
 * @param {EvidencePolicyInput} policy caller-owned policy
 * @param {number} nowMs reference clock
 * @returns {VerificationReport}
 */
function verify(run, policy, nowMs) {
  return /** @type {VerificationReport} */ (verifyEvidenceRun(run, policy, { nowMs }))
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
  assertExactFields(corpus, ['expectedCaseCount', 'run', 'rows', 'cases'], label, 'document')
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
    const fields = entry.check === 'verify'
      ? ['name', 'check', 'mutation', 'expectVerdict', 'expectedFailureCodes']
      : ['name', 'check', 'mutation', 'expectedDiagnostic']
    assertExactFields(entry, fields, label, `cases[${index}]`)
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

/**
 * @typedef {object} Scenario
 * @property {ReturnType<typeof buildCaptureRun>} run evidence run
 * @property {EvidencePolicyInput} policy caller-owned policy
 * @property {CaptureRecord[]} records certified capture records
 * @property {string[]} shotFiles capture-root-relative shot files
 * @property {number} nowMs reference clock
 */

/**
 * Build the certified run, its policy, and its records from the fixture spec.
 * @param {Record<string, unknown>} corpus fixture document
 * @returns {Scenario}
 */
function buildScenario(corpus) {
  const runSpec = /** @type {Record<string, unknown>} */ (corpus.run)
  const state = String(runSpec.state)
  const root = String(runSpec.root)
  const observedAtMs = Number(runSpec.observedAtMs)
  /** @type {string[]} */
  const shotFiles = []
  /** @type {CaptureRecord[]} */
  const records = []
  /** @type {Record<string, Record<string, string>>} */
  const artifacts = {}
  const rows = /** @type {Record<string, unknown>[]} */ (corpus.rows)
  for (const row of rows) {
    const key = `${String(row.surface)}--${String(row.width)}--${String(row.theme)}`
    const targets = /** @type {Record<string, unknown>[]} */ (row.targets).map((target) => {
      if (target.shot === true) {
        const file = `shots/${state}/${key}-${String(target.name)}.png`
        shotFiles.push(file)
        return { target: target.name, kind: target.kind, selector: target.selector, read: null, contrast: null, shot: { file, sha256: artifactDigest(`SHOT:${file}`) }, unshootable: null }
      }
      return { target: target.name, kind: target.kind, selector: target.selector, read: null, contrast: null, shot: null, unshootable: { reason: String(target.unshootable) } }
    })
    records.push(/** @type {CaptureRecord} */ ({
      state,
      surface: String(row.surface),
      kind: String(row.kind),
      width: Number(row.width),
      theme: String(row.theme),
      observedTheme: String(row.observedTheme ?? row.theme),
      observedAtMs,
      servedAssets: [{ asset: String(row.asset), sha256: artifactDigest(String(row.asset)) }],
      targets,
    }))
    artifacts[key] = { 'capture.json': `CAPTURE:${key}`, 'surface.png': `PNG:${key}`, 'provenance.json': `PROV:${root}` }
  }
  const run = buildCaptureRun({
    identity: { kind: 'capture-run', id: String(runSpec.runId), createdAtMs: observedAtMs },
    state,
    root,
    themeSource: String(runSpec.themeSource),
    records,
    artifacts,
    shotFiles,
    observedAtMs,
  })
  const policy = /** @type {EvidencePolicyInput} */ ({
    version: 1,
    runId: String(runSpec.runId),
    mode: 'single-capture',
    artifactClasses: ['capture.json', 'surface.png', 'provenance.json'],
    requiredRows: records.map((record) => ({ key: `${record.surface}--${record.width}--${record.theme}`, kind: record.kind, theme: record.theme, root })),
    duplicateScopes: ['same-key'],
    maxAgeMs: 100000,
    maxOutputBytes: 100000000,
  })
  return { run, policy, records, shotFiles, nowMs: Number(runSpec.nowMs) }
}

/**
 * Apply one verify mutation to a mutable copy of the run.
 * @param {ReturnType<typeof buildCaptureRun>} run mutable run copy
 * @param {string} mutation mutation name
 * @returns {ReturnType<typeof buildCaptureRun>}
 */
function mutateRun(run, mutation) {
  const rows = run.rows
  if (mutation === 'drop-artifact') {
    rows[0].artifacts = rows[0].artifacts.filter((artifact) => artifact.name !== 'surface.png')
  } else if (mutation === 'tamper-digest') {
    rows[0].artifacts[0].content = 'TAMPERED'
  } else if (mutation === 'drop-proof') {
    rows[0].proof = null
  } else if (mutation === 'cross-root') {
    /** @type {EvidenceProvenance} */ (rows[0].provenance).root = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  } else if (mutation === 'theme-mismatch') {
    const observation = /** @type {{ expected: string, observed: string }} */ (rows[0].themeObservation)
    observation.observed = observation.observed === 'dark' ? 'light' : 'dark'
  }
  return run
}

describe('capture rows fixture', () => {
  const manifest = readFamily(MANIFEST)
  const corpus = readFamily(CORPUS)

  it('loads the fixture and matches the required case inventory', () => {
    validateManifest(manifest, MANIFEST)
    validateFamilyShape(corpus, CORPUS)
    checkRequiredNames(/** @type {Record<string, unknown>[]} */ (corpus.cases).map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
  })

  it('builds a certified run that verifies green with the declared row keys', () => {
    const scenario = buildScenario(corpus)
    const report = verify(scenario.run, scenario.policy, scenario.nowMs)
    assert.equal(report.verdict, 'pass', `the certified run must verify green; got ${JSON.stringify(report.failures)}`)
    assert.deepEqual(scenario.run.rows.map((row) => row.key), ['alpha-controls--320--dark', 'beta-seg--320--dark'], 'the run must carry one row per surface, width, and theme')
  })

  it('fails every named verify mutation with its exact failure codes', () => {
    const cases = /** @type {Record<string, unknown>[]} */ (corpus.cases)
    for (const entry of cases) {
      if (entry.check !== 'verify') continue
      const scenario = buildScenario(corpus)
      const mutated = mutateRun(structuredClone(scenario.run), String(entry.mutation))
      const report = verify(mutated, scenario.policy, scenario.nowMs)
      assert.equal(report.verdict, entry.expectVerdict, `${String(entry.name)}: unexpected verdict`)
      assert.deepEqual(report.failureCodes, entry.expectedFailureCodes, `${String(entry.name)}: unexpected failure codes`)
      for (const failure of report.failures) {
        assert.ok(typeof failure.repair === 'string' && failure.repair.length > 0, `${String(entry.name)}: every failure must carry a repair`)
      }
    }
  })

  it('fails every named producer invariant with an actionable diagnostic', () => {
    const cases = /** @type {Record<string, unknown>[]} */ (corpus.cases)
    const scenario = buildScenario(corpus)
    for (const entry of cases) {
      if (entry.check !== 'fixture') continue
      let message = null
      try {
        const record = structuredClone(scenario.records[0])
        if (entry.mutation === 'shot-without-file') {
          reconcileCaptureRecord(record, ['other.png'], 'fixture')
        } else if (entry.mutation === 'both-shot-and-reason') {
          record.targets[0].unshootable = { reason: 'redundant reason beside a shot' }
          createCaptureRecord(record)
        } else if (entry.mutation === 'shot-digest-mismatch') {
          const shot = record.targets[0].shot
          assert.ok(shot, 'the first target must carry a shot for this case')
          assertCaptureShotsDigest(record, { [shot.file]: 'DIFFERENT-BYTES' }, 'fixture')
        } else {
          record.targets[0].shot = null
          record.targets[0].unshootable = null
          createCaptureRecord(record)
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${String(entry.name)}: mutated record passed instead of failing`)
      for (const fragment of /** @type {string[]} */ (entry.expectedDiagnostic)) {
        assert.ok(message.includes(fragment), `${String(entry.name)}: diagnostic is missing ${JSON.stringify(fragment)}; got ${message}`)
      }
    }
  })

  it('classifies shot and unshootable targets and digests a record stably', () => {
    const scenario = buildScenario(corpus)
    const shot = classifyCaptureTarget(scenario.records[0].targets[0], 'shot')
    assert.equal(shot.shootable, true, 'a shot target must classify shootable')
    const unshootable = classifyCaptureTarget(scenario.records[1].targets[0], 'unshootable')
    assert.equal(unshootable.shootable, false, 'an unshootable target must classify unshootable')
    if (!unshootable.shootable) assert.match(unshootable.reason, /no element matched/, 'the unshootable classification must carry the explicit reason')
    const record = scenario.records[0]
    const permuted = /** @type {import('../src/capture/record.mjs').CaptureRecord} */ ({
      targets: record.targets,
      servedAssets: record.servedAssets,
      observedAtMs: record.observedAtMs,
      observedTheme: record.observedTheme,
      theme: record.theme,
      width: record.width,
      kind: record.kind,
      surface: record.surface,
      state: record.state,
    })
    assert.equal(captureRecordDigest(permuted), captureRecordDigest(record), 'the canonical record digest must be stable under a key permutation')
    assert.notEqual(
      captureRecordDigest({ ...record, targets: record.targets.map((target, index) => (index === 0 ? { ...target, target: `${target.target}-other` } : target)) }),
      captureRecordDigest(record),
      'a changed target name must change the canonical record digest',
    )
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

describe('capture rows shape', () => {
  it('rejects a malformed served asset digest', () => {
    const scenario = buildScenario(readFamily(CORPUS))
    const record = { ...scenario.records[0], servedAssets: [{ asset: '/assets/index-a.js', sha256: 'NOT-HEX' }] }
    assert.throws(() => createCaptureRecord(record), /NOT-HEX[\s\S]*at path[\s\S]*repair:/, 'a malformed served asset digest must fail')
  })

  it('keeps isRecord honest for the fixture rows', () => {
    assert.equal(isRecord(readFamily(CORPUS).run), true, 'the run spec must be a record')
  })
})
