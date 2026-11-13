#!/usr/bin/env node
/* Fixture-driven verification for release-notes.mjs (changelog -> GitHub
   Release notes extraction) plus a workflow-shape assertion for
   .github/workflows/release.yml - the job graph, trigger, permissions,
   release-config reads, and notes handoff release.yml depends on to run
   safely and idempotently. What the release-intent tool owns there (the
   verify job's tag check, which jobs may hold a credential and what they may
   run) is judged by the tool's own policy check in release-guard.test.mjs.

   Extraction cases live in scripts/testdata/release-notes.yaml; the
   required-name inventory (deletion protection) lives in the paired
   .manifest.yaml. Run: `pnpm test:release-notes` (wired into test:gates).
   See scripts/release-notes.mutations.mjs for the mutation-proof companion
   (wired into build:lib). */
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { ConfigKey, RepoPath, loadReleaseConfig, readPackageManifest } from './release-config.mjs'
import { ALL_RELEASE_KINDS, ALL_TAG_OUTPUTS, GuardCommand, TagOutput, parseReleaseKind } from './release-guard.mjs'
import { loadStrictYaml, parsedMutations } from './release-notes-fixture.mjs'
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

/* ── release.yml job graph / trigger / config reads ──────────────────────── */

// The tag prefix, the changelog path, the parser's command and output keys,
// the release kinds, the script paths, and the package name are all read from
// their owners; the GitHub CLI text the job must (or must never) carry lives
// in the fixture's releaseWorkflow section.

/** The tag-triggered workflow that publishes the GitHub Release. */
const RELEASE_WORKFLOW = 'release.yml'
/**
 * The job ids of release.yml: the tag parser, the tool's tag check against
 * the default branch, the notes builder, and the one job that publishes.
 */
const ReleaseJobId = Object.freeze({ Guard: 'guard', Verify: 'verify', Notes: 'notes', Publish: 'release' })
/** Every job, in graph order. */
const ALL_RELEASE_JOB_IDS = Object.freeze([ReleaseJobId.Guard, ReleaseJobId.Verify, ReleaseJobId.Notes, ReleaseJobId.Publish])
/** The jobs the publish job must wait for, so it never runs on an unparsed, unverified tag or without its notes. */
const PUBLISH_NEEDS = Object.freeze([ReleaseJobId.Guard, ReleaseJobId.Verify, ReleaseJobId.Notes])
/** The environment variable the guard and publish jobs bind the triggering tag to. */
const TAG_ENV = 'TAG'

const config = loadReleaseConfig()
const packageName = String(readPackageManifest().name)
const guardScript = repoRelative(new URL('./release-guard.mjs', import.meta.url))
const notesScript = repoRelative(new URL('./release-notes.mjs', import.meta.url))
// The guard job checks out only what parse-tag loads: the script and its
// relative imports, read from the script itself, plus the release config.
const guardImports = [...readFileSync(new URL('./release-guard.mjs', import.meta.url), 'utf8').matchAll(/^import .* from '(\.\.?\/[^']+)'$/gm)]
  .map((match) => repoRelative(new URL(match[1], new URL('./release-guard.mjs', import.meta.url))))

function repoRelative(url) { return relative(ROOT, fileURLToPath(url)) }

/** Step-output and job-output expressions, built from their keys. */
function stepOutput(stepId, key) { return `\${{ steps.${stepId}.outputs.${key} }}` }
function needsOutput(jobId, key) { return `\${{ needs.${jobId}.outputs.${key} }}` }
/** The expression that is true when the guard parsed a tag of this kind. */
function kindIs(kind) { return `\${{ needs.${ReleaseJobId.Guard}.outputs.${TagOutput.Kind.wire} == '${kind.wire}' }}` }

/** The env var a mapping binds to an expression, or undefined. */
function envBoundTo(env, expression) { return Object.entries(env ?? {}).find(([, value]) => value === expression)?.[0] }

/** A job's needs as a list. */
function needsOf(job) { return job.needs === undefined ? [] : [job.needs].flat() }

/** Logical commands any step of the workflow runs that start with head, continuation lines joined. */
function commandsStartingWith(workflow, head) {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []).filter((step) => typeof step.run === 'string')
    .flatMap((step) => step.run.replace(/\\\n\s*/g, ' ').split('\n').map((line) => line.trim())).filter((line) => line.startsWith(head))
}

function assertReleaseWorkflowContract(workflow, text) {
  const contract = fixture.releaseWorkflow
  const trigger = workflow.on ?? workflow.true
  assert(JSON.stringify(trigger?.push?.tags) === JSON.stringify([`${config.tagPrefix}*`]), `trigger must be push.tags == ["${config.tagPrefix}*"], the release config's tag prefix`)
  assert(JSON.stringify(workflow.permissions) === JSON.stringify(contract.permissions), `workflow permissions must be exactly ${JSON.stringify(contract.permissions)}`)
  assert(workflow.concurrency?.['cancel-in-progress'] === false, 'concurrency.cancel-in-progress must be false (never cancel a mid-flight publish)')
  for (const id of ALL_RELEASE_JOB_IDS) assert(!!workflow.jobs?.[id], `a ${id} job must exist`)
  const { [ReleaseJobId.Guard]: guard, [ReleaseJobId.Notes]: notes, [ReleaseJobId.Publish]: release } = workflow.jobs

  // Only the publish job holds the write-capable token; every other job
  // declares the read-only scopes.
  for (const id of ALL_RELEASE_JOB_IDS) {
    const expected = id === ReleaseJobId.Publish ? contract.publishPermissions : contract.jobPermissions
    assert(JSON.stringify(workflow.jobs[id].permissions) === JSON.stringify(expected), `the ${id} job's permissions must be exactly ${JSON.stringify(expected)}`)
  }
  for (const id of PUBLISH_NEEDS) assert(needsOf(release).includes(id), `the ${ReleaseJobId.Publish} job must need ${id}, so it cannot run detached from it`)
  assert(needsOf(notes).includes(ReleaseJobId.Guard), `the ${ReleaseJobId.Notes} job must need ${ReleaseJobId.Guard}, whose outputs it reads`)
  for (const job of [guard, release]) assert(job.env?.[TAG_ENV] === contract.triggeringTag, `the ${ReleaseJobId.Guard} and ${ReleaseJobId.Publish} jobs must bind ${TAG_ENV} to the tag that triggered the run (${contract.triggeringTag})`)

  // The guard checks out the parser, its imports, and the release config.
  const sparse = String(guard.steps.find((step) => step.with?.['sparse-checkout'] !== undefined)?.with['sparse-checkout'] ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
  for (const needed of [guardScript, ...guardImports, RepoPath.ReleaseConfig]) assert(sparse.includes(needed), `the ${ReleaseJobId.Guard} job's sparse checkout must include ${needed}`)

  // The guard reads the tag prefix and the changelog path from the release
  // config, and parses the tag under that prefix.
  const configStep = guard.steps.find((step) => typeof step.run === 'string' && step.run.includes(RepoPath.ReleaseConfig))
  assert(configStep?.id, `the ${ReleaseJobId.Guard} job must read ${RepoPath.ReleaseConfig} in a step with an id`)
  for (const key of [ConfigKey.TagPrefix, ConfigKey.Changelog]) assert(configStep.run.includes(`'.${key.wire}' ${RepoPath.ReleaseConfig}`), `the ${ReleaseJobId.Guard} job must read ${key.wire} from ${RepoPath.ReleaseConfig}`)
  const parseStep = guard.steps.find((step) => typeof step.run === 'string' && step.run.startsWith(`node ${guardScript} ${GuardCommand.ParseTag.wire} `))
  assert(parseStep?.id, `the ${ReleaseJobId.Guard} job must run node ${guardScript} ${GuardCommand.ParseTag.wire} in a step with an id`)
  const prefixEnv = envBoundTo(parseStep.env, stepOutput(configStep.id, ConfigKey.TagPrefix.wire))
  assert(prefixEnv && parseStep.run === `node ${guardScript} ${GuardCommand.ParseTag.wire} "$${TAG_ENV}" "$${prefixEnv}"`, `the ${GuardCommand.ParseTag.wire} step must parse "$${TAG_ENV}" under the tag prefix read from ${RepoPath.ReleaseConfig}`)
  for (const key of ALL_TAG_OUTPUTS) assert(guard.outputs?.[key.wire] === stepOutput(parseStep.id, key.wire), `the ${ReleaseJobId.Guard} job must expose ${key.wire} from the ${GuardCommand.ParseTag.wire} step`)
  assert(guard.outputs?.[ConfigKey.Changelog.wire] === stepOutput(configStep.id, ConfigKey.Changelog.wire), `the ${ReleaseJobId.Guard} job must expose the release config's ${ConfigKey.Changelog.wire}`)

  // The notes job reads the parsed version and the changelog path from the
  // guard, never a restated value, and extracts the section into a file.
  const versionEnv = envBoundTo(notes.env, needsOutput(ReleaseJobId.Guard, TagOutput.Version.wire))
  const changelogEnv = envBoundTo(notes.env, needsOutput(ReleaseJobId.Guard, ConfigKey.Changelog.wire))
  assert(versionEnv && changelogEnv, `the ${ReleaseJobId.Notes} job must bind the guard's ${TagOutput.Version.wire} and ${ConfigKey.Changelog.wire} outputs`)
  const extraction = `node ${notesScript} "$${versionEnv}" "$${changelogEnv}" > `
  const extractions = notes.steps.flatMap((step) => typeof step.run === 'string' ? step.run.split('\n').map((line) => line.trim()).filter((line) => line.startsWith(extraction)) : [])
  assert(extractions.length === 1, `the ${ReleaseJobId.Notes} job must extract the notes once with node ${notesScript} from the release config's changelog`)
  const notesFile = extractions[0].slice(extraction.length)
  assert(text.includes(`Published as \\\`${packageName}@`), `the notes must name the published package ${packageName}`)

  // The notes travel as an artifact: the notes job uploads the file's
  // directory under a name, and the publish job downloads that name into the
  // same directory before any release command reads the file.
  const notesDir = dirname(notesFile)
  const upload = notes.steps.find((step) => step.with?.path === notesDir && typeof step.with?.name === 'string')
  assert(upload, `the ${ReleaseJobId.Notes} job must upload ${notesDir}, the directory it writes ${notesFile} to, as a named artifact`)
  const downloadIndex = release.steps.findIndex((step) => step.with?.name === upload.with.name && step.with?.path === notesDir)
  assert(downloadIndex === 0, `the ${ReleaseJobId.Publish} job's first step must download the ${upload.with.name} artifact into ${notesDir}`)

  // Each release command reads the extracted notes and marks the release by
  // the parsed kind: one flag per kind, each bound to that kind's expression.
  for (const row of contract.commands) {
    const commands = commandsStartingWith(workflow, row.head)
    assert(commands.length === row.count, `${RELEASE_WORKFLOW} must run ${row.head} exactly ${row.count} time(s), found ${commands.length}: ${row.name}`)
    for (const command of commands) for (const needed of row.includes) assert(command.includes(needed), `${row.head} must include ${needed}: ${row.name}`)
  }
  const publishing = release.steps.filter((step) => typeof step.run === 'string' && contract.commands.some((row) => step.run.startsWith(row.head)))
  assert(publishing.length === contract.commands.length, `the ${ReleaseJobId.Publish} job must run each of ${contract.commands.map((row) => row.head).join(', ')} in a step of its own`)
  for (const step of publishing) {
    assert(step.run.includes(`--notes-file ${notesFile}`), `${JSON.stringify(step.name)} must read the notes from ${notesFile}, the file the ${ReleaseJobId.Notes} job wrote`)
    for (const { kind, flag } of contract.kindFlags) {
      const flagEnv = envBoundTo(step.env, kindIs(kind))
      assert(flagEnv && step.run.includes(`${flag}="$${flagEnv}"`), `${JSON.stringify(step.name)} must pass ${flag} from whether the guard parsed a ${kind.label} (${kindIs(kind)})`)
    }
  }

  for (const row of contract.requiredText) assert(text.includes(row.text), `${RELEASE_WORKFLOW} is missing ${JSON.stringify(row.text)}: ${row.name}`)
  for (const row of contract.forbiddenText) assert(!text.includes(row.text), `${RELEASE_WORKFLOW} must not contain ${JSON.stringify(row.text)}: ${row.name}`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  const releaseText = readFileSync(resolve(ROOT, RepoPath.Workflows, RELEASE_WORKFLOW), 'utf8')
  const workflow = YAML.parse(releaseText)
  assertReleaseWorkflowContract(workflow, releaseText)
  totalChecks += 1

  // Mutation-prove the job graph: dropping any one job the publish job needs
  // must make assertReleaseWorkflowContract throw. If it doesn't, this
  // checker would silently accept a publish job detached from the tag guard,
  // the tag check, or the notes.
  for (const id of PUBLISH_NEEDS) {
    const detached = structuredClone(workflow)
    detached.jobs[ReleaseJobId.Publish].needs = needsOf(detached.jobs[ReleaseJobId.Publish]).filter((need) => need !== id)
    let caughtDetach = false
    try {
      assertReleaseWorkflowContract(detached, releaseText)
    } catch {
      caughtDetach = true
    }
    check(caughtDetach, `mutation-proof: dropping needs: ${id} from the ${ReleaseJobId.Publish} job must be caught by assertReleaseWorkflowContract, but it was not`)
  }

  // Each text mutation breaks one row of the contract; it must be caught.
  for (const mutation of fixture.releaseWorkflow.mutations) {
    if (!releaseText.includes(mutation.find)) {
      check(false, `mutation-proof: ${mutation.name}: find text is stale against ${RELEASE_WORKFLOW}`)
      continue
    }
    const changed = releaseText.replaceAll(mutation.find, mutation.replace)
    let caught = false
    try {
      assertReleaseWorkflowContract(YAML.parse(changed), changed)
    } catch {
      caught = true
    }
    check(caught, `mutation-proof: ${mutation.name} must be caught by assertReleaseWorkflowContract, but it was not`)
  }
} catch (error) {
  check(false, `${RELEASE_WORKFLOW} workflow-shape contract: ${error.message}`)
}

if (failures.length > 0) {
  console.error([
    'release notes / release workflow verification failed.',
    'What went wrong: release-notes.mjs diverged from a fixtured extraction case, or release.yml diverged from its required job graph / trigger / permissions / release-config reads.',
    'Why it happened: the changelog section extraction logic changed, or the release workflow lost a required step, a job its publish job needs, the notes handoff, or a release-config read.',
    'Where: scripts/release-notes.mjs, .github/workflows/release.yml, and scripts/testdata/release-notes*.yaml.',
    `When: focused release-notes verification (${failures.join('; ')}).`,
    'What it means: a real release tag could produce a GitHub Release with the wrong or missing notes, or the publish job could run without the tag guard.',
    'How to fix: restore the fixtured extraction/workflow contract, then rerun pnpm test:release-notes.',
  ].join('\n'))
  process.exit(1)
}

console.log(`release notes: ${totalChecks} checks across ${fixture.validCases.length} valid, ${fixture.invalidCases.length} invalid extraction cases, and the release.yml workflow-shape contract passed.`)

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
  for (const field of ['requiredValidNames', 'requiredInvalidNames', 'requiredMutationNames', 'requiredWorkflowTextNames', 'requiredWorkflowCommandNames', 'requiredForbiddenWorkflowTextNames', 'requiredWorkflowMutationNames']) {
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
  }
}

function validateFixture(value, manifestValue) {
  assertNameSet(names(value.validCases), manifestValue.requiredValidNames, 'validCases')
  assertNameSet(names(value.invalidCases), manifestValue.requiredInvalidNames, 'invalidCases')
  for (const mutation of parsedMutations(manifestValue)) {
    if (!mutation.probeGroup.cases(value).some((c) => c.name === mutation.probeCaseName)) {
      throw new Error(`release-notes mutation ${mutation.name}: probeCaseName ${JSON.stringify(mutation.probeCaseName)} is not one of the ${mutation.probeGroup.label}`)
    }
  }
  const contract = value.releaseWorkflow
  if (!contract || typeof contract !== 'object') throw new Error('release-notes fixture releaseWorkflow must be a mapping')
  const expectedKeys = ['permissions', 'jobPermissions', 'publishPermissions', 'triggeringTag', 'kindFlags', 'requiredText', 'commands', 'forbiddenText', 'mutations']
  if (JSON.stringify(Object.keys(contract).sort()) !== JSON.stringify([...expectedKeys].sort())) throw new Error(`release-notes fixture releaseWorkflow keys must be exactly ${expectedKeys.join(', ')}`)
  for (const key of ['permissions', 'jobPermissions', 'publishPermissions']) {
    if (!contract[key] || typeof contract[key] !== 'object' || Array.isArray(contract[key])) throw new Error(`releaseWorkflow.${key} must be a mapping`)
  }
  // One GitHub CLI flag per release kind, parsed at this boundary; every kind
  // must have exactly one.
  if (!Array.isArray(contract.kindFlags)) throw new Error('releaseWorkflow.kindFlags must be a list')
  contract.kindFlags = contract.kindFlags.map((row) => {
    if (JSON.stringify(Object.keys(row ?? {}).sort()) !== JSON.stringify(['flag', 'kind'])) throw new Error('releaseWorkflow.kindFlags rows must carry exactly kind and flag')
    if (typeof row.flag !== 'string' || !row.flag.startsWith('--')) throw new Error(`releaseWorkflow.kindFlags.${row.kind}.flag must be a long flag`)
    return Object.freeze({ kind: parseReleaseKind(row.kind), flag: row.flag })
  })
  const flagged = contract.kindFlags.map((row) => row.kind)
  if (flagged.length !== new Set(flagged).size || ALL_RELEASE_KINDS.some((kind) => !flagged.includes(kind))) throw new Error(`releaseWorkflow.kindFlags must name each of ${ALL_RELEASE_KINDS.map((kind) => kind.wire).join(', ')} exactly once`)
  if (typeof contract.triggeringTag !== 'string' || contract.triggeringTag.length === 0) throw new Error('releaseWorkflow.triggeringTag must be a non-empty string')
  for (const [list, required, fields] of [
    ['requiredText', manifestValue.requiredWorkflowTextNames, ['name', 'text']],
    ['commands', manifestValue.requiredWorkflowCommandNames, ['name', 'head', 'count', 'includes']],
    ['forbiddenText', manifestValue.requiredForbiddenWorkflowTextNames, ['name', 'text']],
    ['mutations', manifestValue.requiredWorkflowMutationNames, ['name', 'find', 'replace']],
  ]) {
    if (!Array.isArray(contract[list]) || contract[list].length === 0) throw new Error(`releaseWorkflow.${list} must be a non-empty list`)
    assertNameSet(names(contract[list]), required, `releaseWorkflow.${list}`)
    for (const row of contract[list]) {
      if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify([...fields].sort())) throw new Error(`releaseWorkflow.${list}.${row.name} keys must be exactly ${fields.join(', ')}`)
    }
  }
  for (const row of contract.commands) {
    if (!Number.isInteger(row.count) || row.count < 1) throw new Error(`releaseWorkflow.commands.${row.name}.count must be a positive integer`)
    if (!Array.isArray(row.includes) || row.includes.some((text) => typeof text !== 'string' || text.length === 0)) throw new Error(`releaseWorkflow.commands.${row.name}.includes must be a list of non-empty strings`)
  }
}
