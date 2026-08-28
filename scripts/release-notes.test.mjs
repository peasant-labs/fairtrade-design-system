#!/usr/bin/env node
/* Fixture-driven verification for release-notes.mjs (CHANGELOG.md -> GitHub
   Release notes extraction) plus a workflow-shape assertion for
   .github/workflows/release.yml - the job graph, trigger, and permissions
   release.yml depends on to run safely and idempotently.

   Extraction cases live in scripts/testdata/release-notes.yaml; the
   required-name inventory (deletion protection) lives in the paired
   .manifest.yaml. Run: `pnpm test:release-notes` (wired into test:gates).
   See scripts/release-notes.mutations.mjs for the mutation-proof companion
   (wired into build:lib). */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import YAML from 'yaml'
import { extractChangelogSection } from './release-notes.mjs'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const fixture = loadStrictYaml('testdata/release-notes.yaml')
const manifest = loadStrictYaml('testdata/release-notes.manifest.yaml')

validateManifest(manifest)
validateFixture(fixture, manifest)

const failures = []
let totalChecks = 0
function check(passed, message) {
  totalChecks += 1
  if (!passed) failures.push(message)
}

for (const testCase of fixture.validCases) {
  try {
    const actual = extractChangelogSection(testCase.changelog, testCase.version)
    check(actual === testCase.expected, `${testCase.name}: expected ${JSON.stringify(testCase.expected)}, received ${JSON.stringify(actual)}`)
  } catch (error) {
    check(false, `${testCase.name}: expected extraction to succeed, threw ${error.message}`)
  }
}

for (const testCase of fixture.invalidCases) {
  try {
    const actual = extractChangelogSection(testCase.changelog, testCase.version)
    check(false, `${testCase.name}: expected extraction to throw, returned ${JSON.stringify(actual)}`)
  } catch (error) {
    const pattern = new RegExp(testCase.errorMatch)
    check(pattern.test(error.message), `${testCase.name}: error message ${JSON.stringify(error.message)} did not match /${testCase.errorMatch}/`)
  }
}

/* ── release.yml job graph / trigger / permissions ───────────────────────── */

function assertReleaseWorkflowContract(workflow, text) {
  const trigger = workflow.on ?? workflow.true
  assert(trigger?.push?.tags?.length === 1 && trigger.push.tags[0] === 'fairtrade-v*', 'trigger must be push.tags == ["fairtrade-v*"]')
  assert(workflow.permissions?.contents === 'write', 'permissions.contents must be write')
  assert(workflow.concurrency?.['cancel-in-progress'] === false, 'concurrency.cancel-in-progress must be false (never cancel a mid-flight publish)')
  assert(!!workflow.jobs?.guard, 'a guard job must exist')
  assert(!!workflow.jobs?.release, 'a release job must exist')
  const needs = workflow.jobs.release.needs
  const needsGuard = needs === 'guard' || (Array.isArray(needs) && needs.includes('guard'))
  assert(needsGuard, 'the release job must declare needs: guard (or an array containing it), so it cannot run detached from the tag guard')
  for (const needle of [
    'release-guard.mjs parse-tag',
    'needs.guard.outputs.version',
    'needs.guard.outputs.kind',
    'release-notes.mjs',
    'CHANGELOG.md',
    'Published as \\`@peasant-labs/fairtrade@',
    'gh release view',
    'gh release edit',
    '--notes-file notes.md',
    '--verify-tag',
    '--prerelease',
    '--latest',
  ]) {
    assert(text.includes(needle), `release.yml is missing expected contract text: ${needle}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  const releaseText = readFileSync(resolve(ROOT, '.github/workflows/release.yml'), 'utf8')
  const workflow = YAML.parse(releaseText)
  assertReleaseWorkflowContract(workflow, releaseText)
  totalChecks += 1

  // Mutation-prove the assertion itself: dropping `needs: guard` from the
  // release job must make assertReleaseWorkflowContract throw. If it doesn't,
  // this checker would silently accept a release job detached from the tag
  // guard.
  const detached = structuredClone(workflow)
  delete detached.jobs.release.needs
  let caughtDetach = false
  try {
    assertReleaseWorkflowContract(detached, releaseText)
  } catch {
    caughtDetach = true
  }
  check(caughtDetach, 'mutation-proof: dropping needs: guard from the release job must be caught by assertReleaseWorkflowContract, but it was not')
} catch (error) {
  check(false, `release.yml workflow-shape contract: ${error.message}`)
}

if (failures.length > 0) {
  console.error([
    'release notes / release workflow verification failed.',
    'What went wrong: release-notes.mjs diverged from a fixtured extraction case, or release.yml diverged from its required job graph / trigger / permissions.',
    'Why it happened: the CHANGELOG section extraction logic changed, or the release workflow lost a required step or its guard dependency.',
    'Where: scripts/release-notes.mjs, .github/workflows/release.yml, and scripts/testdata/release-notes*.yaml.',
    `When: focused release-notes verification (${failures.join('; ')}).`,
    'What it means: a real release tag could produce a GitHub Release with the wrong or missing notes, or the publish job could run without the tag guard.',
    'How to fix: restore the fixtured extraction/workflow contract, then rerun pnpm test:release-notes.',
  ].join('\n'))
  process.exit(1)
}

console.log(`release notes: ${totalChecks} checks across ${fixture.validCases.length} valid, ${fixture.invalidCases.length} invalid extraction cases, and the release.yml workflow-shape contract passed.`)

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return document.toJS()
}

function names(list) {
  return list.map((item) => item.name)
}

function assertNameSet(actualNames, requiredNames, label) {
  const actualSet = new Set(actualNames)
  const requiredSet = new Set(requiredNames)
  if (actualSet.size !== actualNames.length) throw new Error(`${label}: duplicate case names`)
  if (actualSet.size !== requiredSet.size || [...requiredSet].some((name) => !actualSet.has(name))) {
    throw new Error(`${label}: case names do not match the required-name manifest exactly`)
  }
}

function validateManifest(value) {
  for (const field of ['requiredValidNames', 'requiredInvalidNames', 'requiredMutationNames']) {
    if (!Array.isArray(value[field]) || value[field].some((name) => typeof name !== 'string' || name.length === 0)) {
      throw new Error(`release-notes manifest field ${field} must be a non-empty string array`)
    }
  }
  if (!Array.isArray(value.mutations) || value.mutations.length === 0) throw new Error('release-notes manifest mutations must be a non-empty array')
  assertNameSet(value.mutations.map((m) => m.name), value.requiredMutationNames, 'release-notes mutations')
  for (const mutation of value.mutations) {
    for (const field of ['name', 'find', 'probeGroup', 'probeCaseName']) {
      if (typeof mutation[field] !== 'string' || mutation[field].length === 0) {
        throw new Error(`release-notes mutation ${mutation.name ?? '(unnamed)'} field ${field} must be a non-empty string`)
      }
    }
    if (typeof mutation.replace !== 'string') throw new Error(`release-notes mutation ${mutation.name}: replace must be a string (may be empty)`)
    if (!['valid', 'invalid'].includes(mutation.probeGroup)) throw new Error(`release-notes mutation ${mutation.name}: probeGroup must be "valid" or "invalid"`)
  }
}

function validateFixture(value, manifestValue) {
  assertNameSet(names(value.validCases), manifestValue.requiredValidNames, 'validCases')
  assertNameSet(names(value.invalidCases), manifestValue.requiredInvalidNames, 'invalidCases')
  for (const mutation of manifestValue.mutations) {
    const pool = mutation.probeGroup === 'valid' ? value.validCases : value.invalidCases
    if (!pool.some((c) => c.name === mutation.probeCaseName)) {
      throw new Error(`release-notes mutation ${mutation.name}: probeCaseName ${JSON.stringify(mutation.probeCaseName)} is not a ${mutation.probeGroup} case name`)
    }
  }
}
