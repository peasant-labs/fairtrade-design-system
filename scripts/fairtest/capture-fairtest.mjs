#!/usr/bin/env node
// @ts-check

// App-owned capture CLI.
//
// Serves the before tree and the after tree in turn, captures every case x
// width x theme against each, composes the interleaved before-beside-after
// contact sheets from the certified records, builds one single-capture evidence
// run per state, verifies both runs against the app-owned capture policy, and
// writes the reports. It exits non-zero unless both verdicts pass.
//
// Every capture root, row key, artifact class, sheet, and report is derived from
// the browser-free child model, so the shape written here matches the shape the
// neutral verifier reads.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importFairtestSource } from '../fairtest-source.mjs'
import { capturePolicyInput } from './capture-policy.mjs'
import { captureState, gitInfo, serveDist } from './capture-driver.mjs'
import { renderSheets } from './capture-sheets.mjs'

const capture = await importFairtestSource('src/capture/index.mjs')
const fixtures = await importFairtestSource('src/core/fixtures.mjs')
const identity = await importFairtestSource('src/core/identity.mjs')
const verify = await importFairtestSource('src/evidence/verify.mjs')

const USAGE = [
  'usage: node scripts/fairtest/capture-fairtest.mjs',
  '  --before-dir <dist> [--before-label <commit>]',
  '  --after-dir  <dist> [--after-label  <commit>]',
  '  --out <capture-root>',
  '  [--cases <capture-cases.yaml>] [--cases-manifest <manifest.yaml>] [--run-prefix <slug>]',
].join('\n')

/**
 * Parse `--name value` and `--name=value` arguments into one record.
 * @param {string[]} argv command arguments
 * @returns {Record<string, string>}
 */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`capture: unexpected argument ${JSON.stringify(token)} at path argv; repair: use --name value pairs. ${USAGE}`)
    const [name, inline] = token.slice(2).split('=')
    const value = inline ?? argv[index + 1]
    if (typeof value !== 'string' || value.length === 0) throw new Error(`capture: missing value for ${token} at path argv; repair: pass --${name} <value>. ${USAGE}`)
    if (inline === undefined) index += 1
    options[name] = value
  }
  return options
}

/**
 * Write one JSON record with a trailing newline.
 * @param {string} path destination path
 * @param {unknown} value record to write
 * @returns {void}
 */
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * Resolve the build label for one state: the explicit label when given, else the
 * worktree head the served tree was built from.
 * @param {string} state state id
 * @param {string} dir served built tree
 * @param {string | undefined} explicit explicit label
 * @returns {string}
 */
function resolveLabel(state, dir, explicit) {
  if (explicit !== undefined) return explicit
  try {
    return gitInfo(dir).head
  } catch (error) {
    throw new Error(
      `capture: cannot read the worktree head for the ${state} tree ${JSON.stringify(dir)} at path --${state}-label; ` +
      `${error instanceof Error ? error.message : String(error)}; ` +
      `repair: pass --${state}-label <commit> for a served tree outside a git worktree.`,
    )
  }
}

const options = parseArgs(process.argv.slice(2))
const outRoot = options.out
if (!outRoot) throw new Error(`capture: missing output root at path --out; repair: pass --out <capture-root>. ${USAGE}`)
const casesPath = options.cases ?? fileURLToPath(new URL('capture-cases.testdata.yaml', import.meta.url))
const manifestPath = options['cases-manifest'] ?? casesPath.replace(/\.yaml$/, '.manifest.yaml')
const runPrefix = options['run-prefix'] ?? 'capture'

/** @type {Record<string, string | undefined>} */
const dirs = { before: options['before-dir'], after: options['after-dir'] }
/** @type {Record<string, string | undefined>} */
const labels = { before: options['before-label'], after: options['after-label'] }

const cases = capture.loadCaptureCases(readFileSync(casesPath, 'utf8'), casesPath)
const manifest = fixtures.loadSingleDocument(readFileSync(manifestPath, 'utf8'), manifestPath)
fixtures.checkKeys(manifest, ['expectedSurfaceCount', 'requiredSurfaceNames'], 'manifest', manifestPath)
if (manifest.expectedSurfaceCount !== manifest.requiredSurfaceNames.length) {
  throw new Error(`capture: manifest surface count must equal its required-name inventory at path ${manifestPath}.expectedSurfaceCount; repair: align expectedSurfaceCount with requiredSurfaceNames.`)
}
fixtures.checkRequiredNames(cases.surfaces.map((/** @type {{ id: string }} */ surface) => surface.id), manifest.requiredSurfaceNames, manifestPath)

/** @type {string[]} */
const states = [...cases.states]
for (const state of states) {
  const dir = dirs[state]
  if (!dir) throw new Error(`capture: missing served tree for state ${JSON.stringify(state)} at path --${state}-dir; repair: pass --${state}-dir <dist> for every declared state. ${USAGE}`)
  if (!existsSync(dir)) throw new Error(`capture: served tree ${JSON.stringify(dir)} for state ${JSON.stringify(state)} does not exist at path --${state}-dir; repair: pass a built dist tree.`)
}

mkdirSync(outRoot, { recursive: true })
const startedAtMs = Date.now()
const { chromium } = await import('@playwright/test')
const browser = await chromium.launch({ headless: true })

/** @type {import('./capture-driver.mjs').CaptureRecordLike[]} */
const records = []
/** @type {string[]} */
const files = []
/** @type {Record<string, string>} */
const verdicts = {}
/** @type {Record<string, string>} */
const failureCodes = {}

try {
  for (const state of states) {
    const dir = /** @type {string} */ (dirs[state])
    const label = resolveLabel(state, dir, labels[state])
    const server = await serveDist(dir)
    /** @type {{ build: import('./capture-driver.mjs').CaptureBuildLike, records: import('./capture-driver.mjs').CaptureRecordLike[], files: string[] }} */
    let captured
    try {
      captured = await captureState({ state, origin: server.origin, distRoot: dir, label, cases, outRoot, browser })
    } finally {
      await server.close()
    }
    writeJson(join(outRoot, 'build', `${state}.json`), captured.build)
    for (const record of captured.records) records.push(record)
    for (const file of captured.files) files.push(file)

    const nowMs = Date.now()
    const runId = `${runPrefix}-${state}`
    /** @type {Record<string, Record<string, string | Uint8Array>>} */
    const artifacts = {}
    for (const record of captured.records) {
      const key = capture.captureRowKey(record.surface, record.width, record.theme)
      artifacts[key] = {
        'capture.json': readFileSync(join(outRoot, 'rows', state, key, 'capture.json'), 'utf8'),
        'surface.png': readFileSync(join(outRoot, 'rows', state, key, 'surface.png')),
        'provenance.json': readFileSync(join(outRoot, 'rows', state, key, 'provenance.json'), 'utf8'),
      }
    }
    const run = capture.buildCaptureRun({
      identity: identity.createIdentity({ kind: 'capture-run', id: runId, createdAtMs: nowMs }),
      state,
      root: label,
      themeSource: 'rendered theme attribute',
      records: captured.records,
      artifacts,
      shotFiles: captured.files,
      observedAtMs: nowMs,
    })
    const policy = capturePolicyInput({ runId, cases, state, root: label })
    const report = verify.verifyEvidenceRun(run, policy, { nowMs })
    writeJson(join(outRoot, 'evidence', `${state}.json`), report)
    verdicts[state] = report.verdict
    failureCodes[state] = report.failureCodes.join(',')
    console.log(`capture ${state}: ${report.verdict} (${report.rows.length} rows, ${report.failureCodes.length} failure codes)`)
  }

  const plan = capture.planSheets({ cases, records })
  const sheetEntries = await renderSheets({ plan, captureRoot: outRoot, outRoot })
  const sheetManifest = capture.validateSheetManifest({
    version: 1,
    order: capture.DEFAULT_SHEET_ORDER,
    runIds: states.map((state) => ({ state, runId: `${runPrefix}-${state}` })),
    sheets: sheetEntries,
  }, 'sheets/manifest.json')
  capture.assertSheetManifestMatchesPlan(plan, sheetManifest, 'sheets/manifest.json')
  writeJson(join(outRoot, 'sheets', 'manifest.json'), sheetManifest)

  const unshootable = records.reduce((total, record) => total + record.targets.filter((target) => target.unshootable !== null).length, 0)
  const shots = records.reduce((total, record) => total + record.targets.filter((target) => target.shot !== null).length, 0)
  const elapsedSeconds = Math.round((Date.now() - startedAtMs) / 100) / 10
  const summary = {
    rows: records.length,
    shots,
    unshootable,
    sheets: sheetEntries.length,
    verdicts,
    failureCodes,
    elapsedSeconds,
    out: outRoot,
  }
  console.log(`capture summary: ${JSON.stringify(summary)}`)
  if (states.some((state) => verdicts[state] !== 'pass')) process.exitCode = 1
} finally {
  await browser.close()
}
