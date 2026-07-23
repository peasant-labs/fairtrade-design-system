#!/usr/bin/env node
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
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

const entryPath = resolve('dist/lib/ui.js')
const entrySource = readFileSync(entryPath, 'utf8')
const providerCandidates = readdirSync(resolve('dist/lib'))
  .filter((name) => name.endsWith('.js'))
  .map((name) => resolve('dist/lib', name))
  .filter((path) => readFileSync(path, 'utf8').includes('Google Antigravity'))
if (providerCandidates.length !== 1) throw new Error(`provider harness mutations require one production provider chunk, received ${providerCandidates.length}`)
const entryImports = [...entrySource.matchAll(/from "\.\/([^"]+\.js)"/g)].map((match) => match[1])
const uiCandidates = entryImports
  .map((name) => resolve('dist/lib', name))
  .filter((path) => readFileSync(path, 'utf8').includes('src/ui/transcript/TurnCard.jsx'))
if (uiCandidates.length !== 1) throw new Error(`provider harness mutations require one production UI chunk, received ${uiCandidates.length}`)
const sourcePaths = { 'provider-policy': providerCandidates[0], ui: uiCandidates[0] }
const artifacts = []

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

// Setup control: prove the harness itself is clean against the real,
// unmutated production bundle BEFORE trusting any mutant result. This rules
// out the possibility that a mutation's designated failure is coincidental
// (e.g. a pre-existing, unrelated failure already present in dist/lib) and
// establishes the exact total check inventory every mutant run must match.
const baseline = runHarnessGate({ FAIRTRADE_PROVIDER_MODULE: undefined }, 'baseline (unmutated dist/lib/ui.js)')
if (baseline.status !== 0 || baseline.report.failedChecks !== 0 || baseline.report.totalChecks < 1) {
  throw new Error(`baseline provider harness gate must pass cleanly with at least one check before any mutation runs; received ${JSON.stringify(baseline.report)}`)
}

try {
  for (const [index, mutation] of manifest.mutations.entries()) {
    if (!mutation || typeof mutation !== 'object' || !Object.hasOwn(sourcePaths, mutation.target)) throw new Error(`mutation ${index} has an unsupported target`)
    const sourcePath = sourcePaths[mutation.target]
    const source = readFileSync(sourcePath, 'utf8')
    const occurrences = source.split(mutation.find).length - 1
    if (occurrences !== 1) throw new Error(`${mutation.name}: mutation target must occur exactly once in the production bundle, received ${occurrences}`)
    const chunkArtifact = resolve(`dist/lib/provider-harness-mutant-${index}.mjs`)
    const entryArtifact = resolve(`dist/lib/ui.provider-harness-mutant-${index}.mjs`)
    writeFileSync(chunkArtifact, source.replace(mutation.find, mutation.replace))
    const sourceBasename = basename(sourcePath)
    if (!entrySource.includes(sourceBasename)) throw new Error(`${mutation.name}: production UI entry does not import ${sourceBasename}`)
    writeFileSync(entryArtifact, entrySource.replaceAll(sourceBasename, basename(chunkArtifact)))
    artifacts.push(chunkArtifact, entryArtifact)

    const { status, report } = runHarnessGate({ FAIRTRADE_PROVIDER_MODULE: entryArtifact }, mutation.name)
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
  }
} finally {
  for (const artifact of artifacts) rmSync(artifact, { force: true })
}

console.log(`provider harness mutations: ${manifest.mutations.length} isolated production mutations were killed, each proven against the full ${baseline.report.totalChecks}-check baseline inventory.`)
