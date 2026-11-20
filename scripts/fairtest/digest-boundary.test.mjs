// @ts-check

// Browser-free contract and regression tests for the row-owned artifact digest
// record. The fixture pair lives in digest-boundary.testdata.yaml plus its
// required-name manifest; named mutations prove the fixture family itself is
// shape-validated. The end-to-end case builds a full policy-shaped run root
// through the REAL writer helpers, then runs the REAL digest-boundary command
// and verifier CLI over it. The mounted CI job runs the same command over the
// actual product and component producer output, so this local layer stays
// bounded and starts no browser.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { importFairtestSource } from '../fairtest-source.mjs'
import { loadSingleDocument } from '../fairtest-single-document.mjs'
import {
  ARTIFACT_DIGEST_RECORD,
  readVerifiedRowArtifacts,
  writeArtifactDigestRecord,
  writeRowArtifact,
} from './artifact-digest-record.mjs'
import {
  validateDigestBoundaryCorpus,
  validateDigestBoundaryManifest,
} from './digest-boundary.mjs'
import { ARTIFACT_CLASSES } from './fairtest-artifacts.mjs'
import { fairtestEvidencePolicyInput } from './fairtest-evidence-policy.mjs'
import { fairtestRelative } from './fairtest-paths.mjs'
import { componentRowDir, prepareComponentRowDir } from './component-producer.mjs'
import { prepareProductRowDir, productRowDir } from './product-producer.mjs'
import { resolveRunRootFor } from './run-envelope-contract.mjs'
import { parseVerifiedJson } from './verify-fairtest.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CORPUS_REL = 'scripts/fairtest/digest-boundary.testdata.yaml'
const MANIFEST_REL = 'scripts/fairtest/digest-boundary.testdata.manifest.yaml'
const DIGEST_COMMAND = resolve(ROOT, 'scripts/fairtest/digest-boundary.mjs')

// The shared host-kind contract validates this named boundary value once; the
// test never relies on the closed set's array ordering.
const kindsContract = await importFairtestSource('src/host-contract/kinds.mjs')
/** @type {'product'} */
const PRODUCT_KIND = 'product'
kindsContract.assertHostKind(PRODUCT_KIND, 'digest-boundary.test.productKind')

const corpusSource = readFileSync(resolve(HERE, 'digest-boundary.testdata.yaml'), 'utf8')
const manifestSource = readFileSync(resolve(HERE, 'digest-boundary.testdata.manifest.yaml'), 'utf8')
const manifest = /** @type {Record<string, unknown>} */ (loadSingleDocument(manifestSource, MANIFEST_REL))
const corpus = /** @type {Record<string, unknown>} */ (loadSingleDocument(corpusSource, CORPUS_REL))

/**
 * The structural manifest shape these tests read.
 * @typedef {object} RequiredManifest
 * @property {number} expectedCaseCount
 * @property {string[]} requiredCaseNames
 * @property {number} expectedMutationCount
 * @property {string[]} requiredMutationNames
 * @property {Record<string, unknown>[]} mutations
 */

/**
 * Hash bytes for an independent expected value in these tests.
 * @param {Buffer | string} bytes
 * @returns {string}
 */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Write a complete six-artifact row through the production writer.
 * @param {string} rowDir prepared row directory
 * @param {string} rowKey row key
 * @returns {void}
 */
function writeCompleteRow(rowDir, rowKey) {
  /** @type {Record<string, string | Buffer>} */
  const contents = {
    'record.json': `{"row":${JSON.stringify(rowKey)}}\n`,
    'aria.json': `{"row":${JSON.stringify(rowKey)},"artifact":"aria.json"}\n`,
    'axe.json': `{"row":${JSON.stringify(rowKey)},"artifact":"axe.json"}\n`,
    'screenshot.png': Buffer.from(`screenshot:${rowKey}\n`),
    'provenance.json': `{"row":${JSON.stringify(rowKey)},"artifact":"provenance.json"}\n`,
    'resolution.json': `{"row":${JSON.stringify(rowKey)},"artifact":"resolution.json"}\n`,
  }
  const writes = ARTIFACT_CLASSES.map((name) => writeRowArtifact(rowDir, name, contents[name]))
  writeArtifactDigestRecord(rowDir, writes)
}

/**
 * Build a minimal but contract-valid proof for one policy row.
 * @param {'product' | 'component'} kind row kind
 * @param {'dark' | 'light'} theme row theme
 * @param {string} identityId target identity id
 * @param {number} observedAtMs observation time
 * @returns {Record<string, unknown>} resolution record
 */
function buildProof(kind, theme, identityId, observedAtMs) {
  const identity = { kind, id: identityId, createdAtMs: 0 }
  const themeObservation = { expected: theme, observed: theme, source: 'digest-boundary-fixture', observedAtMs }
  if (kind === PRODUCT_KIND) {
    const observed = { observed: true, observedAtMs }
    return {
      kind,
      identity,
      chrome: { ...observed },
      body: { ...observed },
      route: { ...observed },
      activeSection: { ...observed },
      view: { ...observed },
      theme: themeObservation,
    }
  }
  return { kind, identity, root: { mounted: true, observedAtMs }, theme: themeObservation }
}

/**
 * Build a full policy-shaped run root through the real artifact writer. The
 * record/proof values are minimal valid evidence fixtures, not a copy of the
 * mounted producer; the mounted producer's own output is exercised by the
 * required CI command.
 * @param {string} parent scratch parent directory
 * @param {string} runId run identity
 * @returns {string} the run root
 */
function buildFixtureRunRoot(parent, runId) {
  const root = join(parent, runId)
  mkdirSync(join(root, 'guards'), { recursive: true })
  writeFileSync(join(root, 'guards', 'run-envelope.json'), `${JSON.stringify({ version: 1, runId }, null, 2)}\n`)
  const policy = fairtestEvidencePolicyInput(runId)
  for (const required of policy.requiredRows) {
    const rowDir = join(root, 'producer', required.key)
    mkdirSync(rowDir, { recursive: true })
    const observedAtMs = Date.now()
    const kind = /** @type {'product' | 'component'} */ (required.kind)
    const theme = /** @type {'dark' | 'light'} */ (required.theme)
    // Every artifact carries its row key so the duplicate scopes see distinct
    // bytes, as a real mounted row does. The proof identity is row-unique for
    // the same reason.
    const identityId = kind === PRODUCT_KIND ? `product-target-${required.key}` : `component-target-${required.key}`
    const record = {
      target: required.key,
      kind,
      rowTheme: theme,
      theme: { expected: theme, observed: theme, source: 'digest-boundary-fixture', observedAtMs },
      producedAtMs: observedAtMs,
    }
    const proof = buildProof(kind, theme, identityId, observedAtMs)
    /** @type {Record<string, string | Buffer>} */
    const contents = {
      'record.json': `${JSON.stringify(record, null, 2)}\n`,
      'aria.json': `${JSON.stringify({ target: required.key, snapshot: `aria:${required.key}` }, null, 2)}\n`,
      'axe.json': `${JSON.stringify({ target: required.key, passes: 1, nonce: `axe:${required.key}` }, null, 2)}\n`,
      'screenshot.png': Buffer.from(`screenshot:${required.key}\n`),
      'provenance.json': `${JSON.stringify({ root: required.root, servedFrom: kind === PRODUCT_KIND ? 'run-root-dist' : fairtestRelative('storybookRoot'), nonce: `provenance:${required.key}` }, null, 2)}\n`,
      'resolution.json': `${JSON.stringify(proof, null, 2)}\n`,
    }
    const writes = ARTIFACT_CLASSES.map((name) => writeRowArtifact(rowDir, name, contents[name]))
    writeArtifactDigestRecord(rowDir, writes)
  }
  return root
}

/**
 * Apply one corpus mutation so the fixture validator can be driven.
 * @param {Record<string, unknown>} value cloned corpus
 * @param {Record<string, unknown>} mutation manifest mutation
 * @returns {void}
 */
function applyCorpusMutation(value, mutation) {
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  const kind = String(mutation.kind)
  if (kind === 'delete-record') {
    const index = cases.findIndex((entry) => entry.name === mutation.target)
    assert.notEqual(index, -1, `${String(mutation.name)}: unknown target ${String(mutation.target)}`)
    cases.splice(index, 1)
    return
  }
  if (kind === 'duplicate-name') {
    const source = cases.find((entry) => entry.name === mutation.target)
    assert.ok(source, `${String(mutation.name)}: unknown target ${String(mutation.target)}`)
    cases.push(structuredClone(source))
    return
  }
  const entry = cases.find((item) => item.name === mutation.target)
  assert.ok(entry, `${String(mutation.name)}: unknown target ${String(mutation.target)}`)
  const field = String(mutation.field)
  if (kind === 'bad-value' || kind === 'unknown-field') {
    entry[field] = mutation.value
    return
  }
  if (kind === 'delete-field') {
    delete entry[field]
    return
  }
  throw new Error(`${String(mutation.name)}: unsupported mutation kind ${kind}`)
}

describe('digest-boundary fixture family', () => {
  it('loads the required case inventory and every mutation fails for its intended field', () => {
    validateDigestBoundaryManifest(manifest, MANIFEST_REL)
    validateDigestBoundaryCorpus(corpus, CORPUS_REL, /** @type {RequiredManifest} */ (manifest))
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          loadSingleDocument(`${corpusSource.trimEnd()}\n---\norphan: true\n`, CORPUS_REL)
        } else {
          const mutated = structuredClone(corpus)
          applyCorpusMutation(mutated, mutation)
          validateDigestBoundaryCorpus(mutated, CORPUS_REL, /** @type {RequiredManifest} */ (manifest))
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${String(mutation.name)}: mutated input passed validation instead of failing`)
      assert.ok(message.includes(String(mutation.expectedField)), `${String(mutation.name)}: diagnostic must name ${JSON.stringify(mutation.expectedField)}; got ${message}`)
    }
  })
})

describe('artifact digest record writer and reader', () => {
  it('records the exact bytes handed to the writer, not a later file read', () => {
    const parent = mkdtempSync(join(tmpdir(), 'fairtest-digest-writer-'))
    try {
      const rowDir = join(parent, 'product-dark')
      mkdirSync(rowDir, { recursive: true })
      writeCompleteRow(rowDir, 'product-dark')
      const record = JSON.parse(readFileSync(join(rowDir, ARTIFACT_DIGEST_RECORD), 'utf8'))
      const screenshot = readFileSync(join(rowDir, 'screenshot.png'))
      assert.equal(record.artifacts['screenshot.png'], sha256(screenshot), 'the recorded screenshot digest must hash the exact written bytes')
      assert.equal(Object.keys(record.artifacts).sort().join(','), [...ARTIFACT_CLASSES].sort().join(','), 'the record must name exactly the six classes')

      // Change the file after the record was written. A reader that re-hashed
      // the current file as the expected value would pass; the real reader
      // must report the recorded digest against the changed bytes.
      writeFileSync(join(rowDir, 'screenshot.png'), Buffer.from('changed-after-record\n'))
      assert.throws(
        () => readVerifiedRowArtifacts({ rowDir, rowKey: 'product-dark', artifactClasses: ARTIFACT_CLASSES }),
        /digest-mismatch.*screenshot\.png.*repair:/s,
        'a changed screenshot must fail against the recorded digest',
      )
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })

  it('parses the verified byte snapshot instead of re-reading the row files', () => {
    const parent = mkdtempSync(join(tmpdir(), 'fairtest-digest-snapshot-'))
    try {
      const rowDir = join(parent, 'product-dark')
      mkdirSync(rowDir, { recursive: true })
      writeCompleteRow(rowDir, 'product-dark')
      const verified = readVerifiedRowArtifacts({ rowDir, rowKey: 'product-dark', artifactClasses: ARTIFACT_CLASSES })
      const recordArtifact = verified.artifacts.find((entry) => entry.name === 'record.json')
      assert.ok(recordArtifact, 'the verified set must carry the record buffer')

      // Mutate the files after validation. Parsing the verified buffer must
      // still read the original snapshot; a second file read would see these
      // invalid bytes and fail.
      for (const name of ['record.json', 'resolution.json', 'provenance.json']) {
        writeFileSync(join(rowDir, name), '{\n')
      }
      assert.deepEqual(
        parseVerifiedJson(recordArtifact.content, 'producer/product-dark/record.json', 'product-dark/record.json'),
        { row: 'product-dark' },
        'the row JSON must come from the verified buffer, not a post-validation file read',
      )
      assert.throws(
        () => parseVerifiedJson(readFileSync(join(rowDir, 'record.json')), 'producer/product-dark/record.json', 'product-dark/record.json'),
        /invalid JSON in verified bytes.*repair:/s,
        'the parser must keep actionable invalid-JSON context',
      )

      // A deterministic post-validation filesystem race is not available
      // without a production test seam, so this narrow source guard proves the
      // CLI is wired to the verified buffers rather than readJson(re-read).
      const source = readFileSync(resolve(HERE, 'verify-fairtest.mjs'), 'utf8')
      assert.match(source, /verifiedArtifactContent\(verified\.artifacts, 'record\.json', required\.key\)/, 'the verifier must parse the verified record buffer')
      assert.match(source, /verifiedArtifactContent\(verified\.artifacts, 'resolution\.json', required\.key\)/, 'the verifier must parse the verified resolution buffer')
      assert.match(source, /verifiedArtifactContent\(verified\.artifacts, 'provenance\.json', required\.key\)/, 'the verifier must parse the verified provenance buffer')
      assert.match(source, /content: entry\.content, digest: entry\.digest/, 'the neutral verifier must receive the verified artifact bytes')
      assert.doesNotMatch(source, /readJson\(join\(dir, 'record\.json'\)/, 'the verifier must not re-read record.json after validation')
      assert.doesNotMatch(source, /readJson\(join\(dir, 'resolution\.json'\)/, 'the verifier must not re-read resolution.json after validation')
      assert.doesNotMatch(source, /readJson\(join\(dir, 'provenance\.json'\)/, 'the verifier must not re-read provenance.json after validation')
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })

  it('refuses to overwrite an artifact or a previously existing digest record', () => {
    const parent = mkdtempSync(join(tmpdir(), 'fairtest-digest-stale-'))
    try {
      const rowDir = join(parent, 'component-dark')
      mkdirSync(rowDir, { recursive: true })
      writeCompleteRow(rowDir, 'component-dark')
      assert.throws(
        () => writeRowArtifact(rowDir, 'record.json', 'again\n'),
        /stale artifact "record\.json".*repair:/s,
        'an existing artifact must not be overwritten',
      )
      const writes = ARTIFACT_CLASSES.map((name) => ({ name, sha256: sha256(`fresh:${name}`) }))
      assert.throws(
        () => writeArtifactDigestRecord(rowDir, writes),
        /stale digest record.*repair:/s,
        'a pre-existing digest record must not be silently accepted',
      )
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })

  it('keeps producer row preparation refusing a pre-existing digest record', () => {
    const parent = mkdtempSync(join(tmpdir(), 'fairtest-digest-prepare-'))
    try {
      const productDir = productRowDir(parent, 'dark')
      mkdirSync(productDir, { recursive: true })
      writeFileSync(join(productDir, ARTIFACT_DIGEST_RECORD), '{}\n')
      assert.throws(
        () => prepareProductRowDir({ runRoot: parent, theme: 'dark' }),
        /stale artifact "digests\.json".*repair:/s,
        'the product preparation seam must refuse a previous digest record',
      )

      const componentDir = componentRowDir(parent, 'light')
      mkdirSync(componentDir, { recursive: true })
      writeFileSync(join(componentDir, ARTIFACT_DIGEST_RECORD), '{}\n')
      assert.throws(
        () => prepareComponentRowDir({ runRoot: parent, theme: 'light' }),
        /stale artifact "digests\.json".*repair:/s,
        'the component preparation seam must refuse a previous digest record',
      )
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })
})

describe('screenshot digest source binding', () => {
  it('hashes the browser-returned buffer instead of a later file read', () => {
    const product = readFileSync(resolve(HERE, 'product-producer.mjs'), 'utf8')
    assert.match(product, /const screenshotBuffer = await page\.screenshot\(\)/, 'the product row must capture the browser buffer')
    assert.match(product, /writeRowArtifact\(rowDir, 'screenshot\.png', screenshotBuffer\)/, 'the product row must write the captured buffer')
    assert.doesNotMatch(product, /page\.screenshot\(\{\s*path/, 'the product row must not write the screenshot through Playwright')
    assert.doesNotMatch(product, /statSync\(screenshotPath\)/, 'the product row must not size a later screenshot file read')

    const component = readFileSync(resolve(HERE, 'component-producer.mjs'), 'utf8')
    assert.match(component, /const screenshotBuffer = await page\.locator\([^)]*\)\.screenshot\(\)/, 'the component row must capture the browser buffer')
    assert.match(component, /writeRowArtifact\(rowDir, 'screenshot\.png', screenshotBuffer\)/, 'the component row must write the captured buffer')
    assert.doesNotMatch(component, /\.screenshot\(\{\s*path/, 'the component row must not write the screenshot through Playwright')
    assert.doesNotMatch(component, /statSync\(screenshotPath\)/, 'the component row must not size a later screenshot file read')
  })
})

describe('digest-boundary command over a real writer-built run root', () => {
  it('refuses a parent-path escape run id before constructing an isolated copy', () => {
    const parent = mkdtempSync(join(tmpdir(), 'fairtest-digest-run-id-'))
    try {
      const escapedRunId = '../escape'
      const result = spawnSync(process.execPath, [DIGEST_COMMAND], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, FAIRTEST_RUN_ROOT: join(parent, 'safe-root'), FAIRTEST_RUN_ID: escapedRunId },
      })
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
      assert.equal(result.status, 1, `run id ${JSON.stringify(escapedRunId)} must fail before any isolated copy:\n${output}`)
      assert.match(output, /wrong run root.*run id.*repair:/s, 'the parent-path run id must be refused by the existing root contract')

      // The existing envelope contract still accepts a benign name that is not
      // lowercase when the source root's final segment names it.
      const benignRoot = join(parent, 'Bad.Run')
      mkdirSync(benignRoot, { recursive: true })
      assert.equal(resolveRunRootFor(benignRoot, 'Bad.Run'), resolve(benignRoot), 'a matching non-lowercase run id must stay accepted')
      assert.throws(
        () => resolveRunRootFor(benignRoot, '../escape'),
        /wrong run root.*repair:/s,
        'a parent-directory run id cannot match the validated source segment',
      )
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })

  it('verifies an untouched root and every fixture mutation through the real verifier CLI', () => {
    const parent = mkdtempSync(join(tmpdir(), 'fairtest-digest-run-'))
    try {
      const runId = 'digest-boundary-fixture-run'
      const root = buildFixtureRunRoot(parent, runId)
      const result = spawnSync(process.execPath, [DIGEST_COMMAND], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, FAIRTEST_RUN_ROOT: root, FAIRTEST_RUN_ID: runId },
      })
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
      assert.equal(result.status, 0, `digest boundary command must pass:\n${output}`)
      assert.match(output, /cases\s+26 passed/, 'the command must run every required fixture case')
      assert.match(output, /source run root unchanged/, 'the command must prove the source root was untouched')
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })
})
