#!/usr/bin/env node
/* Packed-tarball consumer roundtrip.
   Packs the REAL artifact (`pnpm pack`), extracts the published bytes into a
   throwaway consumer whose node_modules holds only that tarball plus symlinked
   runtime externals, then imports the package's own exports map and runs the
   canonical `adaptTranscript` on the fixture payload + read metadata. Asserts
   the release-readiness oracles that previously lived only in review prose: the
   native text/thinking pair retains all five turns, inputSubmissionCount is a
   measured 1 (present, not absent), relationship navigation is cooked, all six
   host importables resolve, and unsupported payloads are REFUSED rather than
   stripped.

   The package under test is never a link or dependency replace: it is the
   extracted tarball, guarded by a realpath check on both sides. Requires a prior
   `pnpm build:lib`; `pnpm smoke:tarball` remains the generic export-map smoke. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

/**
 * @typedef {object} RoundtripFixture
 * @property {number} expectedCaseCount
 * @property {RoundtripCase[]} cases
 * @property {ImportGroup[]} importables
 * @property {RefusalCase[]} refusals
 *
 * @typedef {object} RoundtripCase
 * @property {string} name
 * @property {Record<string, unknown>} payload    canonical durable payload
 * @property {Array<Record<string, unknown>>} navigation  separately authorized read metadata
 * @property {RoundtripExpectation} expect
 *
 * @typedef {object} RoundtripExpectation
 * @property {number[]} turnIndices
 * @property {number} turnCount
 * @property {number} inputSubmissionCount
 * @property {number} textTurnIndex
 * @property {string} textContent
 * @property {number} thinkingTurnIndex
 * @property {string} thinkingText
 * @property {string[]} relationshipLabels
 * @property {string[]} relationshipTargets
 * @property {string} contextNavigationStatus
 * @property {string} contextAnchorRevision
 * @property {string} starterNavigationStatus
 *
 * @typedef {object} ImportGroup
 * @property {string} subpath  exports-map key (for example "ui")
 * @property {string[]} names  live exports a host imports from that subpath
 *
 * @typedef {object} RefusalCase
 * @property {string} name
 * @property {string} caseName
 * @property {Record<string, unknown>} overlay  merged onto the named case payload
 * @property {string} expectedError
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONSUMER = join(ROOT, 'scripts', 'packed-tarball-consumer.mjs')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

const fixture = loadStrictYaml('testdata/packed_tarball_roundtrip.yaml')
const manifest = loadStrictYaml('testdata/packed_tarball_roundtrip.manifest.yaml')
validateManifest(manifest)
validateFixture(fixture, manifest)
verifyManifestTeeth(fixture, manifest)

if (!existsSync(join(ROOT, 'dist', 'lib', 'ui.js'))) {
  throw new Error('packed-tarball roundtrip aborted in scripts/packed-tarball-roundtrip.test.mjs: dist/lib/ui.js is missing. Run `pnpm build:lib` before `pnpm test:packed-tarball`.')
}
if (!existsSync(CONSUMER)) {
  throw new Error(`packed-tarball roundtrip aborted in scripts/packed-tarball-roundtrip.test.mjs: consumer harness ${CONSUMER} is missing.`)
}

const tmp = mkdtempSync(join(tmpdir(), 'fairtrade-packed-roundtrip-'))
try {
  // 1. Pack the real artifact. `prepack` is build:lib plus a mounted browser
  //    check, and build:lib must already have run; disable lifecycle scripts so
  //    packing cannot recurse into it, exactly as assert-pack-contents does.
  const packOut = execFileSync('pnpm', ['pack', '--json', '--config.ignore-scripts=true', '--pack-destination', tmp], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const report = JSON.parse(packOut)
  const tgz = isAbsolute(report.filename) ? report.filename : join(tmp, report.filename)
  if (!existsSync(tgz)) {
    throw new Error(`packed-tarball roundtrip failed in scripts/packed-tarball-roundtrip.test.mjs: \`pnpm pack\` reported ${report.filename}, but no tarball exists at ${tgz}. Check the pack destination and package.json files[].`)
  }

  // 2. Lay out the throwaway consumer from the packed bytes.
  const nm = join(tmp, 'node_modules')
  const pkgDir = join(nm, '@peasant-labs', 'fairtrade')
  mkdirSync(pkgDir, { recursive: true })
  execFileSync('tar', ['-xzf', tgz, '-C', pkgDir, '--strip-components=1'], { stdio: 'inherit' })

  // 2a. Guard the install source: the package under test is the extracted
  //     tarball, never a symlink or dependency replace back to this worktree.
  if (lstatSync(pkgDir).isSymbolicLink()) {
    throw new Error(`packed-tarball roundtrip failed in scripts/packed-tarball-roundtrip.test.mjs: ${pkgDir} is a symlink. Install the extracted tarball bytes, never a link or dependency replace.`)
  }
  const realTmp = realpathSync(tmp)
  if (!realpathSync(pkgDir).startsWith(realTmp + sep)) {
    throw new Error(`packed-tarball roundtrip failed in scripts/packed-tarball-roundtrip.test.mjs: the installed package resolves to ${realpathSync(pkgDir)}, outside the throwaway consumer ${realTmp}. The packed bytes were not the package under test.`)
  }
  const installed = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  assert.equal(installed.name, pkg.name, 'the packed package name must match the package being tested')
  assert.equal(installed.version, pkg.version, 'the packed package version must match the package being tested')

  // 3. Symlink runtime externals from this repo's store (no network install).
  for (const dep of new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})])) {
    const fromRepo = join(ROOT, 'node_modules', dep)
    if (!existsSync(fromRepo)) continue
    const target = join(nm, dep)
    mkdirSync(dirname(target), { recursive: true })
    if (!existsSync(target)) symlinkSync(fromRepo, target, 'dir')
  }
  if (existsSync(join(pkgDir, 'node_modules', 'react')) || existsSync(join(pkgDir, 'node_modules', 'react-dom'))) {
    throw new Error('packed-tarball roundtrip failed in scripts/packed-tarball-roundtrip.test.mjs: the packed package contains a private React runtime. Keep react and react-dom peer-only and external.')
  }

  // 4. Materialize the fixture JSON and copy the consumer harness into place.
  const payloadByCase = new Map(fixture.cases.map((testCase) => [testCase.name, testCase.payload]))
  const navigationByCase = new Map(fixture.cases.map((testCase) => [testCase.name, testCase.navigation]))
  const consumerInput = {
    packageName: pkg.name,
    consumerRoot: realTmp,
    importGroups: fixture.importables.map((group) => ({ subpath: group.subpath, names: group.names })),
    cases: fixture.cases.map((testCase) => ({ name: testCase.name, payload: testCase.payload, navigation: testCase.navigation, expect: testCase.expect })),
    refusals: fixture.refusals.map((refusal) => ({
      name: refusal.name,
      payload: applyOverlay(payloadByCase.get(refusal.caseName), refusal.overlay),
      navigation: navigationByCase.get(refusal.caseName),
      expectedError: refusal.expectedError,
    })),
  }
  writeFileSync(join(tmp, 'fixture.json'), JSON.stringify(consumerInput, null, 2))
  copyFileSync(CONSUMER, join(tmp, 'consumer.mjs'))

  // 5. Run the consumer from the throwaway directory against the packed package.
  let stdout
  try {
    stdout = execFileSync('node', [join(tmp, 'consumer.mjs'), join(tmp, 'fixture.json')], { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    throw new Error(
      [
        'packed-tarball roundtrip FAILED in scripts/packed-tarball-roundtrip.test.mjs (throwaway consumer importing the packed tarball):',
        (err.stderr || err.stdout || err.message || String(err)).trim(),
        'Why it matters: these are the release-readiness oracles for the published bytes; an application installing the tarball would hit the same break.',
        'How to fix: run `pnpm build:lib`, keep the fixture payload schema-valid, and re-run `pnpm test:packed-tarball`.',
      ].join('\n'),
    )
  }
  process.stdout.write(`  ${stdout.trim()}\n`)
  console.log(`packed-tarball roundtrip: ${fixture.cases.length} case(s), ${fixture.importables.flatMap((group) => group.names).length} importables, ${fixture.refusals.length} refusals verified against the packed tarball.`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

/* ── fixture loader ──────────────────────────────────────────────────────── */

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys and no extra documents`)
  }
  return document.toJS()
}

function validateManifest(value) {
  assertExactFields(value, ['requiredCaseNames', 'requiredImportables', 'requiredRefusalNames'], 'manifest')
  for (const [key, list] of Object.entries(value)) {
    assert.ok(Array.isArray(list) && list.length > 0, `manifest.${key} must be a non-empty list of required names`)
    assert.equal(new Set(list).size, list.length, `manifest.${key} names must be unique`)
  }
}

function validateFixture(value, manifestValue) {
  assertExactFields(value, ['expectedCaseCount', 'cases', 'importables', 'refusals'], 'fixture')
  assert.equal(value.expectedCaseCount, value.cases.length, 'fixture expectedCaseCount must equal its case count')
  assert.equal(value.expectedCaseCount, manifestValue.requiredCaseNames.length, 'fixture case count must equal the manifest case count')

  const caseNames = new Set()
  for (const [index, testCase] of value.cases.entries()) {
    const label = `fixture.cases[${index}]`
    assertExactFields(testCase, ['name', 'payload', 'navigation', 'expect'], label)
    assert.ok(typeof testCase.name === 'string' && testCase.name.length > 0, `${label}: name must be a non-empty string`)
    assert.ok(!caseNames.has(testCase.name), `${label}: case names must be unique`)
    caseNames.add(testCase.name)
    validatePayload(testCase.payload, `${label}.payload`)
    validateNavigation(testCase.navigation, `${label}.navigation`)
    validateExpectation(testCase.expect, `${label}.expect`)
  }
  assertRequiredNames(caseNames, manifestValue.requiredCaseNames, 'cases', 'requiredCaseNames')

  const importNames = []
  for (const [index, group] of value.importables.entries()) {
    const label = `fixture.importables[${index}]`
    assertExactFields(group, ['subpath', 'names'], label)
    assert.ok(typeof group.subpath === 'string' && group.subpath.length > 0, `${label}: subpath must be a non-empty exports-map key`)
    assert.ok(Array.isArray(group.names) && group.names.length > 0, `${label}: names must be a non-empty list`)
    importNames.push(...group.names)
  }
  assertRequiredNames(new Set(importNames), manifestValue.requiredImportables, 'importables', 'requiredImportables')
  assert.equal(importNames.length, new Set(importNames).size, 'fixture importable names must be unique across groups')

  const refusalNames = new Set()
  for (const [index, refusal] of value.refusals.entries()) {
    const label = `fixture.refusals[${index}]`
    assertExactFields(refusal, ['name', 'caseName', 'overlay', 'expectedError'], label)
    assert.ok(typeof refusal.name === 'string' && refusal.name.length > 0, `${label}: name must be a non-empty string`)
    assert.ok(!refusalNames.has(refusal.name), `${label}: refusal names must be unique`)
    refusalNames.add(refusal.name)
    assert.ok(caseNames.has(refusal.caseName), `${label}: caseName must reference a fixture case`)
    assert.ok(refusal.overlay && typeof refusal.overlay === 'object' && !Array.isArray(refusal.overlay) && Object.keys(refusal.overlay).length > 0, `${label}: overlay must be a non-empty mapping merged onto the case payload`)
    assert.ok(typeof refusal.expectedError === 'string' && refusal.expectedError.length > 0, `${label}: expectedError must be a non-empty message fragment`)
  }
  assertRequiredNames(refusalNames, manifestValue.requiredRefusalNames, 'refusals', 'requiredRefusalNames')
}

function validatePayload(payload, label) {
  assert.ok(payload && typeof payload === 'object' && !Array.isArray(payload), `${label}: payload must be a mapping`)
  for (const field of ['id', 'harness', 'startTime', 'endTime', 'turnCount', 'inputSubmissionCount', 'relationships', 'turns']) {
    assert.ok(Object.hasOwn(payload, field), `${label}: payload must declare ${field}`)
  }
  assert.ok(Array.isArray(payload.turns) && payload.turns.length > 0, `${label}: turns must be a non-empty list`)
  assert.equal(payload.turns.length, payload.turnCount, `${label}: turnCount must match the turns list`)
  for (const [index, turn] of payload.turns.entries()) {
    for (const field of ['index', 'role', 'entryType', 'depth', 'content', 'timestamp', 'sourceEntryRef', 'provenance']) {
      assert.ok(Object.hasOwn(turn, field), `${label}.turns[${index}]: turn must declare ${field}`)
    }
    for (const field of ['origin', 'actor', 'delivery', 'ownership', 'evidence', 'inputModality']) {
      assert.ok(Object.hasOwn(turn.provenance, field), `${label}.turns[${index}].provenance: must declare ${field}`)
    }
  }
  const textTurns = payload.turns.filter((turn) => turn.entryType === 'text')
  const thinkingTurns = payload.turns.filter((turn) => turn.entryType === 'thinking')
  assert.ok(textTurns.length > 0 && thinkingTurns.length > 0, `${label}: must carry both a native text turn and a thinking turn`)
}

function validateNavigation(navigation, label) {
  assert.ok(Array.isArray(navigation) && navigation.length > 0, `${label}: navigation must be a non-empty list of authorized read rows`)
  for (const [index, row] of navigation.entries()) {
    assert.ok(Object.hasOwn(row, 'kind'), `${label}[${index}]: navigation row must declare kind`)
    assert.ok(Object.hasOwn(row, 'status'), `${label}[${index}]: navigation row must declare status`)
    assert.ok(Object.hasOwn(row, 'localId') || Object.hasOwn(row, 'transcriptId'), `${label}[${index}]: navigation row must name a target`)
  }
}

function validateExpectation(expect, label) {
  assertExactFields(expect, ['turnIndices', 'turnCount', 'inputSubmissionCount', 'textTurnIndex', 'textContent', 'thinkingTurnIndex', 'thinkingText', 'relationshipLabels', 'relationshipTargets', 'contextNavigationStatus', 'contextAnchorRevision', 'starterNavigationStatus'], `${label}.expect`)
  assert.ok(Array.isArray(expect.turnIndices) && expect.turnIndices.length === expect.turnCount, `${label}.expect: turnIndices must match turnCount`)
  assert.equal(typeof expect.inputSubmissionCount, 'number', `${label}.expect: inputSubmissionCount must be a measured number, not absent`)
  assert.equal(expect.relationshipLabels.length, expect.relationshipTargets.length, `${label}.expect: every cooked relationship label must have a target`)
}

/** Mutation teeth: renaming a case, importable, or refusal must drop a required
    NAME from the fixture and be rejected, so the manifest protects membership
    rather than a bare count. */
function verifyManifestTeeth(value, manifestValue) {
  const renamedCase = structuredClone(value)
  renamedCase.cases[0].name = `renamed_${renamedCase.cases[0].name}`
  assert.throws(() => validateFixture(renamedCase, manifestValue), /missing required case/, 'a renamed fixture case must be rejected')

  const renamedImportable = structuredClone(value)
  renamedImportable.importables[0].names[0] = `Renamed${renamedImportable.importables[0].names[0]}`
  assert.throws(() => validateFixture(renamedImportable, manifestValue), /missing required importable/, 'a renamed importable must be rejected')

  const renamedRefusal = structuredClone(value)
  renamedRefusal.refusals[0].name = `renamed_${renamedRefusal.refusals[0].name}`
  assert.throws(() => validateFixture(renamedRefusal, manifestValue), /missing required refusal/, 'a renamed refusal must be rejected')
}

function assertRequiredNames(actual, required, noun, manifestKey) {
  const missing = required.filter((name) => !actual.has(name))
  assert.deepEqual(missing, [], `fixture: missing required ${noun} named by manifest.${manifestKey}: ${missing.join(', ')}`)
  const extra = [...actual].filter((name) => !required.includes(name))
  assert.deepEqual(extra, [], `fixture: ${noun} not named by manifest.${manifestKey}: ${extra.join(', ')}`)
}

function assertExactFields(value, fields, label) {
  const actual = Object.keys(value ?? {}).sort()
  const expected = fields.slice().sort()
  assert.deepEqual(actual, expected, `${label}: fields must be exact`)
}

function applyOverlay(base, overlay) {
  const out = structuredClone(base)
  mergeInto(out, overlay)
  return out
}

function mergeInto(target, overlay) {
  for (const [key, value] of Object.entries(overlay)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      mergeInto(target[key], value)
    } else {
      target[key] = structuredClone(value)
    }
  }
}
