#!/usr/bin/env node
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import YAML from 'yaml'

const manifestPath = resolve('scripts/testdata/provider-harnesses.manifest.yaml')
const document = YAML.parseDocument(readFileSync(manifestPath, 'utf8'), { strict: true, uniqueKeys: true })
if (document.errors.length > 0) throw new Error(`provider harness manifest is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
const manifest = document.toJS()
if (!Array.isArray(manifest?.mutations) || manifest.expectedMutationCount !== manifest.mutations.length) throw new Error('provider harness manifest must contain its exact mutation inventory')
for (const [index, mutation] of manifest.mutations.entries()) {
  if (!Number.isInteger(mutation?.expectedFailedCheckCount) || mutation.expectedFailedCheckCount < 1) {
    throw new Error(`provider harness manifest mutation ${index} (${mutation?.name ?? 'unnamed'}) must declare a positive integer expectedFailedCheckCount`)
  }
}

const libraryPath = resolve('dist/lib')
const entryPath = resolve(libraryPath, 'ui.js')
const entrySource = readFileSync(entryPath, 'utf8')
const providerCandidates = readdirSync(libraryPath)
  .filter((name) => name.endsWith('.js'))
  .map((name) => resolve(libraryPath, name))
  .filter((path) => readFileSync(path, 'utf8').includes('Google Antigravity'))
if (providerCandidates.length !== 1) throw new Error(`provider harness mutations require one production provider chunk, received ${providerCandidates.length}`)
const entryImports = [...entrySource.matchAll(/from "\.\/([^"]+\.js)"/g)].map((match) => match[1])
const uiCandidates = entryImports
  .map((name) => resolve(libraryPath, name))
  .filter((path) => readFileSync(path, 'utf8').includes('src/ui/transcript/TurnCard.jsx'))
if (uiCandidates.length !== 1) throw new Error(`provider harness mutations require one production UI chunk, received ${uiCandidates.length}`)
const sourcePaths = { 'provider-policy': providerCandidates[0], ui: uiCandidates[0] }
const librarySnapshot = snapshotLibrary(libraryPath)
const STRATEGIES = new Set(['graph-turn-invalid-fallback', 'omit-antigravity-inventory', 'accept-arbitrary-string'])

const REPORT_LINE = /^PROVIDER_HARNESS_REPORT=(.+)$/m

/**
 * Run scripts/provider-harnesses.test.mjs (optionally against a mutated
 * production entry module) and parse its structured PROVIDER_HARNESS_REPORT
 * trailer -- the single source of truth for how many checks executed and
 * how many failed. Never inspect combined stdout/stderr for a bare
 * substring: that only proves SOME text appeared somewhere, not that the
 * full expected check inventory ran with exactly the designated failures.
 */
function runHarnessGate(env, label) {
  const result = spawnSync(process.execPath, ['scripts/provider-harnesses.test.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, ...env },
  })
  if (result.error) throw new Error(`${label}: process failed to start (${result.error.message})`)
  const match = REPORT_LINE.exec(result.stdout ?? '')
  if (!match) {
    throw new Error(`${label}: provider-harnesses.test.mjs did not print a PROVIDER_HARNESS_REPORT trailer; stdout was ${JSON.stringify(result.stdout)}, stderr was ${JSON.stringify(result.stderr)}`)
  }
  let report
  try {
    report = JSON.parse(match[1])
  } catch (error) {
    throw new Error(`${label}: PROVIDER_HARNESS_REPORT trailer was not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Number.isInteger(report.totalChecks) || !Number.isInteger(report.failedChecks) || !Array.isArray(report.failures) || report.failures.length !== report.failedChecks) {
    throw new Error(`${label}: PROVIDER_HARNESS_REPORT trailer had an inconsistent shape: ${JSON.stringify(report)}`)
  }
  return { status: result.status, report }
}

let baseline
try {
  // Setup control: prove the harness itself is clean against the real,
  // unmutated production bundle BEFORE trusting any mutant result. This rules
  // out the possibility that a mutation's designated failure is coincidental
  // (e.g. a pre-existing, unrelated failure already present in dist/lib) and
  // establishes the exact total check inventory every mutant run must match.
  baseline = runHarnessGate({ FAIRTRADE_PROVIDER_MODULE: undefined }, 'baseline (unmutated dist/lib/ui.js)')
  if (baseline.status !== 0 || baseline.report.failedChecks !== 0 || baseline.report.totalChecks < 1) {
    throw new Error(`baseline provider harness gate must pass cleanly with at least one check before any mutation runs; received ${JSON.stringify(baseline.report)}`)
  }

  for (const [index, mutation] of manifest.mutations.entries()) {
    if (!mutation || typeof mutation !== 'object' || !Object.hasOwn(sourcePaths, mutation.target)) throw new Error(`mutation ${index} has an unsupported target`)
    const sourcePath = sourcePaths[mutation.target]
    const source = readFileSync(sourcePath, 'utf8')
    const mutatedSource = applyMutation(source, mutation)
    const sourceBasename = basename(sourcePath)
    if (!entrySource.includes(sourceBasename)) throw new Error(`${mutation.name}: production UI entry does not import ${sourceBasename}`)
    const isolatedRoot = createIsolatedBundle()
    try {
      const isolatedLibraryPath = resolve(isolatedRoot, 'lib')
      const isolatedSourcePath = resolve(isolatedLibraryPath, relative(libraryPath, sourcePath))
      writeFileSync(isolatedSourcePath, mutatedSource)

      const { status, report } = runHarnessGate({ FAIRTRADE_PROVIDER_MODULE: resolve(isolatedLibraryPath, 'ui.js') }, mutation.name)
      if (status === 0) throw new Error(`${mutation.name}: isolated production mutation survived the focused behavior gate; report was ${JSON.stringify(report)}`)
      if (report.totalChecks !== baseline.report.totalChecks) {
        throw new Error(`${mutation.name}: expected the full baseline check inventory (${baseline.report.totalChecks}) to run under the mutation, received ${report.totalChecks}; the mutation likely short-circuited the gate before every check executed`)
      }
      if (report.failedChecks !== mutation.expectedFailedCheckCount) {
        throw new Error(`${mutation.name}: expected exactly ${mutation.expectedFailedCheckCount} failed check(s) and every other check in the ${baseline.report.totalChecks}-check inventory to pass, received ${report.failedChecks} failed: ${JSON.stringify(report.failures)}`)
      }
      if (!report.failures.some((failure) => failure.includes(mutation.expectedError))) {
        throw new Error(`${mutation.name}: none of the ${report.failedChecks} failed check(s) matched the designated diagnostic; expected a failure containing ${JSON.stringify(mutation.expectedError)}, received ${JSON.stringify(report.failures)}`)
      }
    } finally {
      rmSync(isolatedRoot, { recursive: true, force: true })
    }
  }
} finally {
  assertLibrarySnapshot(librarySnapshot)
  assertNoProviderMutationDirectories()
}

console.log(`provider harness mutations: ${manifest.mutations.length} isolated production mutations were killed, each proven against the full ${baseline.report.totalChecks}-check baseline inventory.`)

function applyMutation(source, mutation) {
  if (!mutation.strategy) {
    const occurrences = source.split(mutation.find).length - 1
    if (occurrences !== 1) throw new Error(`${mutation.name}: literal mutation target must occur exactly once in the production bundle, received ${occurrences}`)
    return source.replace(mutation.find, mutation.replace)
  }
  if (!STRATEGIES.has(mutation.strategy)) throw new Error(`${mutation.name}: unsupported production mutation strategy ${JSON.stringify(mutation.strategy)}`)
  if (mutation.strategy === 'graph-turn-invalid-fallback') {
    return mutateRegion(source, mutation, 'src/ui/transcript/graph/GraphTurnNode.jsx', /([A-Za-z_$][\w$]*) === void 0 \? "amber" : ([A-Za-z_$][\w$]*)\(\1\)/, (_match, provider, accent) => `${provider} === void 0 || ${provider} === "google" ? "amber" : ${accent}(${provider})`)
  }
  if (mutation.strategy === 'omit-antigravity-inventory') {
    return mutateRegion(source, mutation, 'src/ui/provider-policy.js', /Object\.freeze\(Object\.values\(([A-Za-z_$][\w$]*)\)\)/, (_match, inventory) => `Object.freeze(Object.values(${inventory}).filter((value) => value !== "antigravity"))`)
  }
  return mutateRegion(source, mutation, 'src/ui/provider-policy.js', /if \(([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*)\)\) return;/, (_match, _predicate, value) => `if (typeof ${value} === "string") return;`)
}

function createIsolatedBundle() {
  const root = mkdtempSync(join(tmpdir(), 'fairtrade-provider-harness-'))
  try {
    cpSync(libraryPath, resolve(root, 'lib'), { recursive: true })
    symlinkSync(resolve('node_modules'), resolve(root, 'node_modules'), 'dir')
    return root
  } catch (error) {
    rmSync(root, { recursive: true, force: true })
    throw error
  }
}

function assertNoProviderMutationDirectories() {
  const directories = []
  collectProviderMutationDirectories(resolve('dist'), directories)
  if (directories.length > 0) {
    throw new Error(`provider mutation cleanup left directories beneath dist: ${directories.join(', ')}; remove them before packaging and rerun the mutation gate`)
  }
}

function snapshotLibrary(directory) {
  const files = new Map()
  collectLibraryFiles(directory, files)
  return files
}

function collectLibraryFiles(directory, files) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      collectLibraryFiles(path, files)
    } else if (entry.isFile()) {
      files.set(relative(libraryPath, path), createHash('sha256').update(readFileSync(path)).digest('hex'))
    } else {
      throw new Error(`provider mutation snapshot encountered a non-regular dist/lib entry at ${path}; remove it before running the mutation gate`)
    }
  }
}

function assertLibrarySnapshot(before) {
  const after = snapshotLibrary(libraryPath)
  const differences = []
  for (const [path, hash] of before) {
    if (!after.has(path)) differences.push(`removed ${path}`)
    else if (after.get(path) !== hash) differences.push(`modified ${path}`)
  }
  for (const path of after.keys()) {
    if (!before.has(path)) differences.push(`added ${path}`)
  }
  if (differences.length > 0) {
    throw new Error(`provider mutation changed the packed dist/lib tree: ${differences.sort().join(', ')}; mutation sandboxes must remain outside dist/lib`)
  }
}

function collectProviderMutationDirectories(directory, matches) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.provider-harness-') || entry.name.startsWith('fairtrade-provider-harness-')) matches.push(path)
    collectProviderMutationDirectories(path, matches)
  }
}

function mutateRegion(source, mutation, sourceName, pattern, replacement) {
  const marker = `//#region ${sourceName}`
  const start = source.indexOf(marker)
  const end = source.indexOf('//#endregion', start)
  if (start < 0 || end < 0) throw new Error(`${mutation.name}: production bundle is missing the ${sourceName} region marker`)
  const region = source.slice(start, end)
  const matches = [...region.matchAll(new RegExp(pattern.source, 'g'))]
  if (matches.length !== 1) throw new Error(`${mutation.name}: semantic mutation target must occur exactly once in ${sourceName}, received ${matches.length}`)
  return source.slice(0, start) + region.replace(pattern, replacement) + source.slice(end)
}
