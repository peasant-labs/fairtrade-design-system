/* Release guard tests: the tag parser the tag-triggered workflows call, the
   fairtrade-owned merge-queue workflow contract, the release-intent tool's own
   policy check over those workflows, and git's release-tag immutability.

   Nothing here restates the release contract. The tag prefix, the bot kinds,
   and the workflow files are read from the release config and the queue policy
   through scripts/release-config.mjs. Rules the release-intent tool owns are
   judged by running the policy and config checks title-guard runs, spelled once
   in title-guard.yml, over this repository and over each policy mutation. Cases
   live in scripts/testdata/release-guard.yaml; the required-name manifest is
   scripts/testdata/release-guard.manifest.yaml. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import YAML from 'yaml'
import { closed } from '../src/ui/closed-value.js'
import { ALL_RELEASE_KINDS, parseReleaseKind, parseReleaseTag } from './release-guard.mjs'
import { REPO_ROOT, RepoPath, loadQueuePolicy, loadReleaseConfig, parseWorkflow, readPackageManifest, readWorkflow } from './release-config.mjs'

const FIXTURE_RELATIVE_PATH = 'testdata/release-guard.yaml'
const MANIFEST_RELATIVE_PATH = 'testdata/release-guard.manifest.yaml'
const fixturePath = path.join(import.meta.dirname, FIXTURE_RELATIVE_PATH)
const manifestPath = path.join(import.meta.dirname, MANIFEST_RELATIVE_PATH)
const PROVENANCE_FIXTURE_RELATIVE_PATH = 'testdata/release-provenance.yaml'
const provenanceFixturePath = path.join(import.meta.dirname, PROVENANCE_FIXTURE_RELATIVE_PATH)
/** Per-command ceiling for one throwaway-repository git call, in ms. */
const GIT_COMMAND_TIMEOUT_MS = 10000
/** Ceiling for the whole release-tag case, in ms: a regression fails instead of hanging. */
const RELEASE_TAG_CASE_TIMEOUT_MS = 60000
/** Ceiling for one release-tool policy or config check, in ms. */
const TOOL_CHECK_TIMEOUT_MS = 30000
/** The job id the queue policy names the library build by; the CI contract reads that job. */
const LIB_JOB = 'lib'
/** The package manager every package-script step runs through. */
const PACKAGE_MANAGER = 'pnpm'
/** Step ids this contract reads in the repository's own workflows. */
const WorkflowStepId = Object.freeze({
  /** title-guard: resolves the merge-group entry PR and must fail closed. */
  GroupEntry: 'entry',
})
/** The files a Go module checkout carries that setup-go reads or caches. */
const GoModuleFile = Object.freeze({ Mod: 'go.mod', Sum: 'go.sum' })
/** The release tool is built from this module in the shared infra repository. */
const RELEASE_TOOL_REPOSITORY = 'peasant-labs/infra'
const RELEASE_TOOL_MODULE = 'tools/release'
/** The status bash reports when the command it runs is not on PATH. */
const COMMAND_NOT_FOUND = 127
/** CI builds the release tool before the tests, so a missing tool there is a failure, not a skip. */
const IN_CI = process.env.CI === 'true'
/** Runner files a step appends to; a check run from a test must never write the test step's own. */
const RUNNER_STEP_FILES = Object.freeze(['GITHUB_OUTPUT', 'GITHUB_STEP_SUMMARY', 'GITHUB_ENV', 'GITHUB_PATH'])

/**
 * A comparison in a step-level `if:` that reads one step output against one
 * quoted value.
 */
const Comparison = Object.freeze({
  Equal: closed('==', 'equals'),
  NotEqual: closed('!=', 'differs from'),
})
const ALL_COMPARISONS = Object.freeze([Comparison.Equal, Comparison.NotEqual])
/** @type {Readonly<Record<string, (typeof ALL_COMPARISONS)[number]>>} */
const COMPARISON_BY_WIRE = Object.freeze(Object.fromEntries(ALL_COMPARISONS.map((comparison) => [comparison.wire, comparison])))
const STEP_OUTPUT_GATE = new RegExp(`^steps\\.([A-Za-z0-9_-]+)\\.outputs\\.([A-Za-z0-9_-]+) (${ALL_COMPARISONS.map((comparison) => comparison.wire).join('|')}) '([^']*)'$`)

/**
 * Parse `steps.<id>.outputs.<key> <op> '<value>'`; anything else fails.
 *
 * @param {unknown} expression
 * @param {string} where
 */
function parseStepOutputGate(expression, where) {
  const match = STEP_OUTPUT_GATE.exec(normalizeIf(String(expression ?? '')))
  assert.ok(match, `${where}: expected one step-output comparison (steps.<id>.outputs.<key> ${ALL_COMPARISONS.map((comparison) => comparison.wire).join(' or ')} '<value>'), found ${JSON.stringify(expression)}`)
  return Object.freeze({ step: match[1], key: match[2], comparison: COMPARISON_BY_WIRE[match[3]], value: match[4] })
}

/**
 * How one fixture row checks a package script. The row carries exactly one of
 * these keys; its value is the operand.
 */
const ScriptCheck = Object.freeze({
  Includes: closed('includes', 'contains', { holds: (/** @type {unknown} */ script, /** @type {unknown} */ operand) => typeof script === 'string' && script.includes(String(operand)) }),
  Excludes: closed('excludes', 'does not contain', { holds: (/** @type {unknown} */ script, /** @type {unknown} */ operand) => typeof script === 'string' && !script.includes(String(operand)) }),
  Equals: closed('equals', 'equals', { holds: (/** @type {unknown} */ script, /** @type {unknown} */ operand) => script === operand }),
  Absent: closed('absent', 'is not defined', { holds: (/** @type {unknown} */ script) => script === undefined }),
})
const ALL_SCRIPT_CHECKS = Object.freeze([ScriptCheck.Includes, ScriptCheck.Excludes, ScriptCheck.Equals, ScriptCheck.Absent])

/**
 * The controls of the release-tag case: each one moves the remote tag the way
 * a guard-free push would, so the plain-push refusal is shown to be the guard.
 */
const GitTagMutation = Object.freeze({
  ForcePush: closed('force_push', 'a forced push', {
    /** @param {{ remote: string, work: string }} pair @param {Record<string, string>} env @param {string} tag @param {string} name */
    apply(pair, env, tag, name) {
      assert.equal(pushReleaseTag(pair, env, tag, ['--force']).status, 0, `${name}: a forced push must move the tag, or the non-force refusal proves nothing`)
    },
  }),
  DeleteThenPush: closed('delete_then_push', 'a delete and re-push', {
    /** @param {{ remote: string, work: string }} pair @param {Record<string, string>} env @param {string} tag @param {string} name */
    apply(pair, env, tag, name) {
      assert.equal(gitOk(pair.work, env, ['push', '--quiet', 'origin', `:refs/tags/${tag}`]).status, 0, `${name}: deleting the remote tag must be accepted`)
      assert.equal(pushReleaseTag(pair, env, tag).status, 0, `${name}: re-pushing the recreated tag must be accepted`)
    },
  }),
})
const ALL_GIT_TAG_MUTATIONS = Object.freeze([GitTagMutation.ForcePush, GitTagMutation.DeleteThenPush])
/** @type {Readonly<Record<string, (typeof ALL_GIT_TAG_MUTATIONS)[number]>>} */
const GIT_TAG_MUTATION_BY_WIRE = Object.freeze(Object.fromEntries(ALL_GIT_TAG_MUTATIONS.map((mutation) => [mutation.wire, mutation])))

/** @param {unknown} raw @param {string} where */
function parseGitTagMutation(raw, where) {
  assert.ok(typeof raw === 'string' && Object.hasOwn(GIT_TAG_MUTATION_BY_WIRE, raw), `${where}: operation ${JSON.stringify(raw)} is not one of ${ALL_GIT_TAG_MUTATIONS.map((mutation) => mutation.wire).join(', ')}`)
  return GIT_TAG_MUTATION_BY_WIRE[/** @type {string} */ (raw)]
}

/* ── fixture loading ─────────────────────────────────────────────────────── */

/** @param {unknown} value @param {string} where @returns {any} */
function object(value, where) { assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${where} must be an object`); return value }
/** @param {unknown} value @param {string} where @returns {any[]} */
function array(value, where) { assert.ok(Array.isArray(value) && value.length > 0, `${where} must be a non-empty list`); return value }
/** @param {unknown} value @param {string} where @returns {string} */
function string(value, where) { assert.ok(typeof value === 'string' && value.length > 0, `${where} must be a non-empty string`); return value }
/** @param {unknown} value @param {readonly string[]} allowed @param {string} where */
function keys(value, allowed, where) { object(value, where); assert.deepEqual(Object.keys(/** @type {object} */ (value)).sort(), [...allowed].sort(), `${where} keys drifted`) }
/** @param {{ name: unknown }[]} rows @param {unknown} required @param {string} where */
function exactNames(rows, required, where) {
  const names = rows.map((row, index) => string(row.name, `${where}[${index}].name`))
  assert.equal(new Set(names).size, names.length, `${where} names must be unique`)
  assert.deepEqual(new Set(names), new Set(array(required, `manifest for ${where}`)), `${where} must name exactly the scenarios ${path.relative(REPO_ROOT, manifestPath)} requires`)
}

/** @param {string} source @param {string} where */
function strictYaml(source, where) {
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length) throw new Error(`${where}: fixture YAML invalid: ${document.errors.map((error) => error.message).join('; ')}`)
  if (YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true }).length !== 1) throw new Error(`${where}: fixture YAML must contain exactly one document`)
  return document.toJS()
}

/**
 * Validate the fixture against the manifest and the queue policy's workflow
 * files, and parse every typed field at this boundary.
 *
 * @param {any} f
 * @param {any} manifest
 * @param {ReadonlySet<string>} workflowFiles the workflows the queue policy names
 * @param {ReadonlySet<string>} checkedFiles every workflow the policy check reads
 */
function validateFixtures(f, manifest, workflowFiles, checkedFiles) {
  keys(manifest, ['requiredValidTagNames', 'requiredInvalidTagNames', 'requiredPackageScriptNames', 'requiredForbiddenTextNames', 'requiredRecoveryGateNames', 'requiredContractMutationNames', 'requiredPolicyMutationNames', 'requiredGitMutationNames'], 'manifest')
  keys(f, ['tags', 'package', 'workflow', 'git'], 'root')
  keys(f.tags, ['valid', 'invalid'], 'tags')
  exactNames(array(f.tags.valid, 'tags.valid'), manifest.requiredValidTagNames, 'tags.valid')
  const valid = f.tags.valid.map((/** @type {any} */ row) => { keys(row, ['name', 'version', 'kind'], 'tags.valid row'); return Object.freeze({ name: row.name, version: string(row.version, `tags.valid.${row.name}.version`), kind: parseReleaseKind(row.kind) }) })
  assert.deepEqual(new Set(valid.map((/** @type {any} */ row) => row.kind)), new Set(ALL_RELEASE_KINDS), 'tags.valid must cover every release kind')
  exactNames(array(f.tags.invalid, 'tags.invalid'), manifest.requiredInvalidTagNames, 'tags.invalid')
  for (const row of f.tags.invalid) { keys(row, ['name', 'input'], 'tags.invalid row'); string(row.input, `tags.invalid.${row.name}.input`) }

  keys(f.package, ['release_build', 'content_build', 'test', 'test_env', 'scripts'], 'package')
  for (const field of ['release_build', 'content_build', 'test']) string(f.package[field], `package.${field}`)
  object(f.package.test_env, 'package.test_env')
  exactNames(array(f.package.scripts, 'package.scripts'), manifest.requiredPackageScriptNames, 'package.scripts')
  const scripts = f.package.scripts.map((/** @type {any} */ row) => {
    const present = ALL_SCRIPT_CHECKS.filter((check) => Object.hasOwn(row, check.wire))
    assert.equal(present.length, 1, `package.scripts.${row.name} must carry exactly one of ${ALL_SCRIPT_CHECKS.map((check) => check.wire).join(', ')}`)
    const [check] = present
    keys(row, ['name', 'script', check.wire], `package.scripts.${row.name}`)
    if (check === ScriptCheck.Absent) assert.equal(row[check.wire], true, `package.scripts.${row.name}.${check.wire} must be true`)
    else string(row[check.wire], `package.scripts.${row.name}.${check.wire}`)
    return Object.freeze({ name: row.name, script: string(row.script, `package.scripts.${row.name}.script`), check, operand: row[check.wire] })
  })

  keys(f.workflow, ['ci_skipped_activity_types', 'forbidden_text', 'recovery_gates', 'contract_mutations', 'policy_mutations'], 'workflow')
  array(f.workflow.ci_skipped_activity_types, 'workflow.ci_skipped_activity_types').forEach((type, index) => string(type, `workflow.ci_skipped_activity_types[${index}]`))
  /** @param {any} row @param {string} where */
  const knownFile = (row, where) => assert.ok(workflowFiles.has(row.file), `${where}.${row.name}.file ${JSON.stringify(row.file)} is not a workflow the queue policy names (${[...workflowFiles].join(', ')})`)
  /** @param {any} row @param {string} where */
  const checkedFile = (row, where) => assert.ok(checkedFiles.has(row.file), `${where}.${row.name}.file ${JSON.stringify(row.file)} is not a workflow in ${RepoPath.Workflows} (${[...checkedFiles].join(', ')})`)
  exactNames(array(f.workflow.forbidden_text, 'workflow.forbidden_text'), manifest.requiredForbiddenTextNames, 'workflow.forbidden_text')
  for (const row of f.workflow.forbidden_text) { keys(row, ['name', 'file', 'text'], 'workflow.forbidden_text row'); knownFile(row, 'workflow.forbidden_text'); string(row.text, `workflow.forbidden_text.${row.name}.text`) }
  exactNames(array(f.workflow.recovery_gates, 'workflow.recovery_gates'), manifest.requiredRecoveryGateNames, 'workflow.recovery_gates')
  for (const row of f.workflow.recovery_gates) {
    keys(row, ['name', 'job', 'step', 'clauses'], 'workflow.recovery_gates row')
    string(row.job, `workflow.recovery_gates.${row.name}.job`)
    string(row.step, `workflow.recovery_gates.${row.name}.step`)
    const clauses = array(row.clauses, `workflow.recovery_gates.${row.name}.clauses`)
    clauses.forEach((clause, index) => string(clause, `workflow.recovery_gates.${row.name}.clauses[${index}]`))
    assert.equal(new Set(clauses).size, clauses.length, `workflow.recovery_gates.${row.name}.clauses must be unique`)
  }
  // A contract mutation breaks a workflow this contract reads; a policy
  // mutation may break any workflow the policy check reads, and names the
  // tool rule that must refuse it.
  for (const [list, required, fields, fileCheck] of [
    ['contract_mutations', manifest.requiredContractMutationNames, ['name', 'file', 'find', 'replace'], knownFile],
    ['policy_mutations', manifest.requiredPolicyMutationNames, ['name', 'file', 'find', 'replace', 'rule'], checkedFile],
  ]) {
    exactNames(array(f.workflow[list], `workflow.${list}`), required, `workflow.${list}`)
    for (const row of f.workflow[list]) {
      const expectedError = list === 'contract_mutations' && Object.hasOwn(row, 'error_contains')
      keys(row, expectedError ? [...fields, 'error_contains'] : [...fields], `workflow.${list} row`)
      fileCheck(row, `workflow.${list}`)
      string(row.find, `workflow.${list}.${row.name}.find`)
      assert.equal(typeof row.replace, 'string', `workflow.${list}.${row.name}.replace must be a string`)
      if (expectedError) string(row.error_contains, `workflow.${list}.${row.name}.error_contains`)
    }
  }
  for (const row of f.workflow.policy_mutations) string(row.rule, `workflow.policy_mutations.${row.name}.rule`)

  keys(f.git, ['version', 'first_message', 'second_message', 'mutations'], 'git')
  for (const field of ['version', 'first_message', 'second_message']) string(f.git[field], `git.${field}`)
  exactNames(array(f.git.mutations, 'git.mutations'), manifest.requiredGitMutationNames, 'git.mutations')
  const gitMutations = f.git.mutations.map((/** @type {any} */ row) => { keys(row, ['name', 'operation'], 'git.mutations row'); return Object.freeze({ name: row.name, operation: parseGitTagMutation(row.operation, `git.mutations.${row.name}`) }) })
  assert.deepEqual(new Set(gitMutations.map((/** @type {any} */ row) => row.operation)), new Set(ALL_GIT_TAG_MUTATIONS), 'git.mutations must exercise every control')

  return Object.freeze({ ...f, tags: Object.freeze({ valid, invalid: f.tags.invalid }), package: Object.freeze({ ...f.package, scripts }), git: Object.freeze({ ...f.git, mutations: gitMutations }) })
}

const config = loadReleaseConfig()
const policy = loadQueuePolicy()
/** Every workflow file the queue policy names: the files this contract reads. */
const workflowFiles = new Set([...policy.required.map((check) => check.workflow), policy.releaseJob.workflow, ...policy.botJobs.map((job) => job.workflow)])
/** Every workflow file the policy check reads: the whole workflows directory. */
const checkedFiles = new Set(fs.readdirSync(path.join(REPO_ROOT, RepoPath.Workflows)).filter((file) => /\.ya?ml$/.test(file)))

/** @param {string} [source] */
function loadFixtures(source = fs.readFileSync(fixturePath, 'utf8')) {
  return validateFixtures(strictYaml(source, fixturePath), strictYaml(fs.readFileSync(manifestPath, 'utf8'), manifestPath), workflowFiles, checkedFiles)
}

const fixtures = loadFixtures()

/* ── the roles the queue policy assigns ──────────────────────────────────── */

/**
 * The library build check, the title guard, and the release job's kind, all
 * read from the queue policy and the release config.
 */
function workflowRoles() {
  const lib = policy.required.find((check) => check.job === LIB_JOB)
  assert.ok(lib, `${RepoPath.QueuePolicy} must list the ${LIB_JOB} job as a required check: the library build runs the release PR's publish build`)
  const guards = policy.required.filter((check) => check.guard)
  assert.equal(guards.length, 1, `${RepoPath.QueuePolicy} must mark exactly one required check as the guard`)
  // The release config's bot kinds that no bot job owns: what is left is the
  // kind of the PR the release job opens. Exactly one must be left, or the
  // library build cannot tell which bot PR carries the release content.
  const botJobKinds = new Set(policy.botJobs.map((job) => job.kind))
  const releaseKinds = [...config.botKinds].filter((kind) => !botJobKinds.has(kind))
  assert.equal(releaseKinds.length, 1, `${RepoPath.ReleaseConfig} bot kinds ${[...config.botKinds].join(', ')} minus the bot jobs' kinds in ${RepoPath.QueuePolicy} must leave exactly the release job's kind, found ${releaseKinds.join(', ') || 'none'}`)
  return Object.freeze({ lib, guard: guards[0], release: policy.releaseJob, releasePRKind: releaseKinds[0] })
}

const roles = workflowRoles()

/** @param {string} value */
function normalizeIf(value) { return value.replace(/\s+/g, ' ').trim() }

/** @param {any} step @param {string} script */
function runsScript(step, script) { return step.run === `${PACKAGE_MANAGER} ${script}` || step.run === `${PACKAGE_MANAGER} run ${script}` }

/** @param {any} job @param {string} script @param {string} where */
function scriptStep(job, script, where) {
  const step = job.steps.find((/** @type {any} */ candidate) => runsScript(candidate, script))
  assert.ok(step, `${where} must run the ${script} package script`)
  return step
}

/** @param {ReturnType<typeof parseWorkflow>} parsed @param {string} jobId */
function jobOf(parsed, jobId) { return object(parsed.workflow.jobs?.[jobId], `${parsed.file} job ${jobId}`) }

/* ── fairtrade-owned contract ────────────────────────────────────────────── */

/**
 * The library build: the release PR (the release job's kind, decided by the
 * classifier step) runs the publish build, every other PR the plain library
 * build, and the tests run after either one.
 *
 * @param {ReturnType<typeof parseWorkflow>} ci
 */
function assertLibraryBuildContract(ci) {
  const types = ci.trigger.pull_request?.types ?? []
  for (const skipped of fixtures.workflow.ci_skipped_activity_types) assert.ok(!types.includes(skipped), `${ci.file} must not run on pull_request ${skipped}: a title or body edit would restart the library gate`)
  const where = `${ci.file} job ${roles.lib.job}`
  const lib = jobOf(ci, roles.lib.job)
  const releaseBuild = scriptStep(lib, fixtures.package.release_build, where)
  const contentBuild = scriptStep(lib, fixtures.package.content_build, where)
  const tests = scriptStep(lib, fixtures.package.test, where)
  const releaseGate = parseStepOutputGate(releaseBuild.if, `${where} ${fixtures.package.release_build} step`)
  const contentGate = parseStepOutputGate(contentBuild.if, `${where} ${fixtures.package.content_build} step`)
  assert.equal(releaseGate.comparison, Comparison.Equal, `${where}: the ${fixtures.package.release_build} step runs only on the release PR`)
  assert.equal(contentGate.comparison, Comparison.NotEqual, `${where}: the ${fixtures.package.content_build} step runs on every other PR`)
  assert.deepEqual([contentGate.step, contentGate.key, contentGate.value], [releaseGate.step, releaseGate.key, releaseGate.value], `${where}: both builds must read the same classifier output against the same kind, so exactly one of them runs`)
  assert.equal(releaseGate.value, roles.releasePRKind, `${where}: the ${fixtures.package.release_build} step must run for the release job's PR kind ${roles.releasePRKind}`)
  const classifier = lib.steps.findIndex((/** @type {any} */ step) => step.id === releaseGate.step)
  assert.ok(classifier >= 0 && classifier < Math.min(lib.steps.indexOf(releaseBuild), lib.steps.indexOf(contentBuild)), `${where}: step ${releaseGate.step} must classify the PR before either build reads it`)
  assert.equal(tests.if, undefined, `${where}: ${fixtures.package.test} runs unconditionally after the build`)
  for (const [name, value] of Object.entries(fixtures.package.test_env)) assert.equal(tests.env?.[name], value, `${where}: ${fixtures.package.test} must set ${name}`)
  assert.ok(lib.steps.indexOf(tests) > Math.max(lib.steps.indexOf(releaseBuild), lib.steps.indexOf(contentBuild)), `${where}: tests run after the build they exercise`)
}

/**
 * The merge-group entry resolution fails closed: an entry PR that cannot be
 * identified fails the guard instead of warning and passing.
 *
 * @param {ReturnType<typeof parseWorkflow>} guard
 */
function assertGuardFailsClosed(guard) {
  const job = jobOf(guard, roles.guard.job)
  const entry = job.steps.find((/** @type {any} */ step) => step.id === WorkflowStepId.GroupEntry)
  assert.ok(entry, `${guard.file} job ${roles.guard.job} must keep step ${WorkflowStepId.GroupEntry}, which resolves the merge-group entry PR`)
  const run = string(entry.run, `${guard.file} step ${WorkflowStepId.GroupEntry} run`)
  assert.doesNotMatch(run, /\bexit 0\b/, `${guard.file} step ${WorkflowStepId.GroupEntry} must never exit 0 on an unresolved entry`)
  assert.match(run, /\bexit [1-9][0-9]*\b/, `${guard.file} step ${WorkflowStepId.GroupEntry} must fail closed when the entry PR cannot be resolved`)
}

/** @param {ReturnType<typeof parseWorkflow>} release */
function assertReleaseRunIsNeverCancelled(release) {
  assert.equal(release.workflow.concurrency?.['cancel-in-progress'], false, `${release.file}: a release run is never cancelled by a later one`)
}

/**
 * The credential job can only run after the separate, read-only bundle check.
 * A status function in its if would override GitHub's implicit success gate.
 *
 * @param {ReturnType<typeof parseWorkflow>} release
 */
function assertIndependentBundleVerification(release) {
  const writer = jobOf(release, roles.release.job)
  const verify = jobOf(release, 'verify')
  assert.ok(Array.isArray(writer.needs) && writer.needs.includes('verify'), `${release.file}: the release job must need the independent verifier`)
  assert.doesNotMatch(normalizeIf(String(writer.if ?? '')), /\b(?:always|cancelled|failure|success)\s*\(/i, `${release.file}: the release job must not bypass the verifier with a status function`)
  assert.deepEqual(verify.needs, ['plan'], `${release.file}: the verifier must depend on the plan`)
  assert.equal(normalizeIf(String(verify.if ?? '')), "needs.plan.outputs.proceed == 'true'", `${release.file}: the verifier must run whenever the plan proceeds`)
  assert.equal(verify['runs-on'], 'ubuntu-latest', `${release.file}: the verifier must use a fresh hosted runner`)
  assert.equal(verify['timeout-minutes'], 10, `${release.file}: the verifier must have a bounded timeout`)
  assert.deepEqual(verify.permissions, { contents: 'read' }, `${release.file}: the verifier must have only contents read permission`)
  assert.doesNotMatch(JSON.stringify(verify), /\$\{\{\s*secrets(?:\.|\[)|actions\/create-github-app-token@/i, `${release.file}: the verifier must not receive App credentials`)
  assert.equal(verify['continue-on-error'], undefined, `${release.file}: the verifier must not ignore a failure`)
  for (const step of verify.steps) assert.equal(step['continue-on-error'], undefined, `${release.file}: verifier steps must not ignore a failure`)
  const checkout = verify.steps.find((/** @type {any} */ step) => step.uses?.startsWith('actions/checkout@') && step.with?.repository === undefined)
  assert.equal(checkout?.with?.['fetch-depth'], 0, `${release.file}: the verifier must check out full history`)
  assert.equal(checkout?.with?.['fetch-tags'], true, `${release.file}: the verifier must check out tags`)
  assert.equal(checkout?.with?.['persist-credentials'], false, `${release.file}: the verifier checkout must not retain credentials`)

  /** @param {string} name @param {string} gate */
  const check = (name, gate) => {
    const matches = verify.steps.filter((/** @type {any} */ step) => step.name === name)
    assert.equal(matches.length, 1, `${release.file}: the verifier must contain exactly one ${name} step`)
    assert.equal(normalizeIf(String(matches[0].if ?? '')), gate, `${release.file}: ${name} must run on its planned action`)
    assert.match(String(matches[0].run ?? ''), /^set -euo pipefail\n/, `${release.file}: ${name} must fail closed`)
    return matches[0]
  }
  const tagCheck = check('Verify the prepared tag', "needs.plan.outputs.tag-action == 'tag'")
  const releaseCheck = check('Verify the prepared release commit', "needs.plan.outputs.action == 'open-pr' && needs.plan.outputs.push == 'true'")
  assert.equal(tagCheck.env?.CANDIDATE, '${{ needs.plan.outputs.candidate }}', `${release.file}: the verifier must compare the planned candidate`)
  assert.equal(tagCheck.env?.TAG, '${{ needs.plan.outputs.tag }}', `${release.file}: the verifier must compare the planned tag`)
  const plan = '"${RUNNER_TEMP}/release-intent" plan --branch origin/main --mode "${{ vars.RELEASE_BATCH_MODE }}" --verdict taggable --floor "${{ vars.RELEASE_BATCH_FLOOR }}" | tee "${plan_file}"'
  const planAt = tagCheck.run.indexOf(plan)
  assert.ok(tagCheck.run.split('\n').includes(plan), `${release.file}: the verifier must independently recompute the tag plan without masking failures`)
  assert.match(tagCheck.run, /^plan_file="\$\{RUNNER_TEMP\}\/verified-plan.txt"$/m, `${release.file}: the verifier must capture the fresh plan`)
  assert.ok(tagCheck.run.indexOf('git fetch --no-tags origin main') >= 0 && tagCheck.run.indexOf('git fetch --no-tags origin main') < planAt, `${release.file}: the verifier must fetch main before recomputing`)
  assert.ok(tagCheck.run.indexOf('git fetch --tags origin') >= 0 && tagCheck.run.indexOf('git fetch --tags origin') < planAt, `${release.file}: the verifier must fetch tags before recomputing`)
  assert.ok(tagCheck.run.indexOf('TIP="$(git rev-parse origin/main)"') >= 0 && tagCheck.run.indexOf('TIP="$(git rev-parse origin/main)"') < planAt, `${release.file}: the verifier must record the fetched tip before recomputing`)
  assert.ok(tagCheck.run.indexOf('git fetch --no-tags bundles/tag.bundle') > planAt, `${release.file}: the verifier must recompute before fetching the prepared tag`)
  assert.match(tagCheck.run, /index\(\$0, key "="\) == 1/, `${release.file}: the verifier must parse the fresh plan by exact key`)
  assert.match(tagCheck.run, /if \(count != 1 \|\| value == ""\)/, `${release.file}: the verifier must reject missing or repeated fresh plan values`)
  assert.match(tagCheck.run, /^  ' "\$\{plan_file\}"$/m, `${release.file}: the verifier must read the captured fresh plan`)
  assert.match(tagCheck.run, /^FRESH_ACTION="\$\(plan_value action\)"$/m, `${release.file}: the verifier must parse the recomputed action`)
  assert.match(tagCheck.run, /^FRESH_CANDIDATE="\$\(plan_value candidate\)"$/m, `${release.file}: the verifier must parse the recomputed candidate`)
  assert.match(tagCheck.run, /^FRESH_TAG="\$\(plan_value tag\)"$/m, `${release.file}: the verifier must parse the recomputed tag`)
  assert.match(tagCheck.run, /^FRESH_VERSION="\$\(plan_value version\)"$/m, `${release.file}: the verifier must parse the recomputed version`)
  assert.match(tagCheck.run, /^test "\$\{FRESH_ACTION\}" = tag \|\| \{ echo "[^"]+"; exit 1; \}$/m, `${release.file}: the verifier must require a tag action`)
  assert.match(tagCheck.run, /^test "\$\{FRESH_CANDIDATE\}" = "\$\{CANDIDATE\}" \|\| \{ echo "[^"]+"; exit 1; \}$/m, `${release.file}: the verifier must compare the recomputed candidate`)
  assert.match(tagCheck.run, /^test "\$\{FRESH_TAG\}" = "\$\{TAG\}" \|\| \{ echo "[^"]+"; exit 1; \}$/m, `${release.file}: the verifier must compare the recomputed tag`)
  assert.ok(tagCheck.run.indexOf('test "${FRESH_ACTION}" = tag') < tagCheck.run.indexOf('git fetch --no-tags bundles/tag.bundle'), `${release.file}: the action check must precede the bundle fetch`)
  assert.ok(tagCheck.run.indexOf('test "${FRESH_CANDIDATE}" = "${CANDIDATE}"') < tagCheck.run.indexOf('git fetch --no-tags bundles/tag.bundle'), `${release.file}: the candidate comparison must precede the bundle fetch`)
  assert.ok(tagCheck.run.indexOf('test "${FRESH_TAG}" = "${TAG}"') < tagCheck.run.indexOf('git fetch --no-tags bundles/tag.bundle'), `${release.file}: the tag comparison must precede the bundle fetch`)
  assert.equal(releaseCheck.env?.SOURCE, '${{ needs.plan.outputs.source }}', `${release.file}: the verifier must receive the prepared source`)
  assert.match(releaseCheck.run, /^test "\$\{SOURCE\}" = "\$\{TIP\}" \|\| \{ echo "[^"]+"; exit 1; \}$/m, `${release.file}: the verifier must require the prepared source to equal the current tip`)
  assert.ok(releaseCheck.run.indexOf('git fetch --no-tags origin main') >= 0 && releaseCheck.run.indexOf('git fetch --no-tags origin main') < releaseCheck.run.indexOf('TIP="$(git rev-parse origin/main)"'), `${release.file}: the verifier must fetch main before recording the release tip`)
  assert.ok(releaseCheck.run.indexOf('git fetch --tags origin') >= 0 && releaseCheck.run.indexOf('git fetch --tags origin') < releaseCheck.run.indexOf('TIP="$(git rev-parse origin/main)"'), `${release.file}: the verifier must fetch tags before checking release content`)
  assert.ok(releaseCheck.run.indexOf('TIP="$(git rev-parse origin/main)"') < releaseCheck.run.indexOf('test "${SOURCE}" = "${TIP}"') && releaseCheck.run.indexOf('test "${SOURCE}" = "${TIP}"') < releaseCheck.run.indexOf('git bundle verify bundles/release.bundle'), `${release.file}: the verifier must compare the current tip before checking the bundle`)
  assert.match(releaseCheck.run, /check-title --base "\$\{TIP\}" --head "\$\{RELEASE\}"/, `${release.file}: the title check must use the fetched tip`)
  assert.match(releaseCheck.run, /release-pr --check --branch "\$\{TIP\}"/, `${release.file}: the release content check must use the fetched tip`)
  const open = writer.steps.find((/** @type {any} */ step) => step.name === 'Open the release PR')
  const update = writer.steps.find((/** @type {any} */ step) => step.name === 'Update the release PR')
  assert.ok(releaseCheck.env?.EXPECTED_TITLE, `${release.file}: the verifier must receive the intended PR title`)
  assert.equal(releaseCheck.env.EXPECTED_TITLE, open?.env?.TITLE, `${release.file}: the verifier and open step must use the same intended title`)
  assert.equal(releaseCheck.env.EXPECTED_TITLE, update?.env?.TITLE, `${release.file}: the verifier and update step must use the same intended title`)
  assert.match(releaseCheck.run, /^test "\$\{TITLE\}" = "\$\{EXPECTED_TITLE\}" \|\| \{ echo "[^"]+"; exit 1; \}$/m, `${release.file}: the verifier must check the prepared commit title against the intended PR title`)
}

/**
 * A fresh existing branch still needs a queue decision. Branch writes, unlike
 * queue reads and arm/hold decisions, run only when preparation says to push.
 * The fixture names every step and its complete set of conjunctive gates.
 *
 * @param {ReturnType<typeof parseWorkflow>} release
 */
function assertReleaseRecoveryGates(release) {
  for (const row of fixtures.workflow.recovery_gates) {
    const job = jobOf(release, row.job)
    const matching = job.steps.filter((/** @type {any} */ step) => step.name === row.step)
    assert.equal(matching.length, 1, `${release.file} job ${row.job} must contain exactly one step named ${row.step}: ${row.name}`)
    const clauses = normalizeIf(string(matching[0].if, `${release.file} step ${row.step} if`)).split(/\s*&&\s*/)
    assert.equal(new Set(clauses).size, clauses.length, `${release.file} step ${row.step} must not repeat a gate: ${row.name}`)
    assert.deepEqual(new Set(clauses), new Set(row.clauses.map(normalizeIf)), `${release.file} step ${row.step} has the wrong gates: ${row.name}`)
  }
}

/**
 * Every workflow that builds the release tool checks out the same commit of
 * the same module, and setup-go and the build in each job read that module.
 * A confined, cache-free build uses the module via -C; the general guard
 * builds run from the module directory with the module checksum cache.
 *
 * @param {ReadonlyMap<string, ReturnType<typeof parseWorkflow>>} byFile
 */
function assertToolCheckouts(byFile) {
  /** @type {any[]} */
  const checkouts = []
  /** @type {Set<string>} */
  const building = new Set()
  for (const parsed of byFile.values()) {
    for (const [jobId, job] of Object.entries(/** @type {Record<string, any>} */ (parsed.workflow.jobs ?? {}))) {
      const steps = job.steps ?? []
      const where = `${parsed.file} job ${jobId}`
      const checkout = steps.find((/** @type {any} */ step) => step.with?.repository !== undefined)
      const build = steps.find((/** @type {any} */ step) => typeof step.run === 'string' && /^\s*go build\b/m.test(step.run) && step.run.includes('./cmd/release-intent'))
      if (!checkout) {
        assert.equal(build, undefined, `${where}: a release-tool build must check out the pinned tool module`)
        continue
      }
      checkouts.push(checkout.with)
      building.add(parsed.file)
      const sparse = string(checkout.with['sparse-checkout'], `${where} tool checkout sparse-checkout`).trim()
      assert.equal(checkout.with.repository, RELEASE_TOOL_REPOSITORY, `${where}: the tool must come from the shared infra repository`)
      assert.equal(sparse, RELEASE_TOOL_MODULE, `${where}: the checkout must read the release tool module`)
      const moduleDir = `${checkout.with.path}/${sparse}`
      const setup = steps.find((/** @type {any} */ step) => step.with?.['go-version-file'] !== undefined)
      assert.equal(setup?.with?.['go-version-file'], `${moduleDir}/${GoModuleFile.Mod}`, `${where}: setup-go must read the tool module's Go version`)
      assert.ok(build, `${where}: the tool must be built from ${moduleDir}`)
      if (setup?.with?.cache === false || steps.some((/** @type {any} */ step) => typeof step.run === 'string' && step.run.includes('verify-tag'))) {
        assert.equal(setup?.with?.cache, false, `${where}: a confined verification build must disable the Go cache`)
        assert.equal(setup?.with?.['cache-dependency-path'], undefined, `${where}: a cache-free build must not specify a cache dependency path`)
        assert.equal(build.run, `go build -C ${moduleDir} -o "\${RUNNER_TEMP}/release-intent" ./cmd/release-intent`, `${where}: the confined build must read the tool module`)
        assert.equal(build.env?.GOWORK, 'off', `${where}: the confined build must disable the Go workspace`)
        assert.equal(build['working-directory'], undefined, `${where}: the confined build must resolve the module from the checkout root`)
      } else {
        assert.equal(setup?.with?.['cache-dependency-path'], `${moduleDir}/${GoModuleFile.Sum}`, `${where}: setup-go must key its cache on the tool module's checksums`)
        assert.equal(build['working-directory'], moduleDir, `${where}: the tool must build from its module directory ${moduleDir}`)
      }
    }
  }
  assert.ok(building.has(roles.guard.workflow), `${roles.guard.workflow} must build the release tool its checks run`)
  for (const checkout of checkouts) assert.deepEqual(checkout, checkouts[0], 'every workflow must check out the same release tool module at the same commit')
}

/** @param {ReadonlyMap<string, ReturnType<typeof parseWorkflow>>} byFile */
function assertForbiddenText(byFile) {
  for (const row of fixtures.workflow.forbidden_text) assert.ok(!byFile.get(row.file)?.text.includes(row.text), `${row.file} must not contain ${JSON.stringify(row.text)}: ${row.name}`)
}

/** @param {ReadonlyMap<string, ReturnType<typeof parseWorkflow>>} byFile */
function assertWorkflowContract(byFile) {
  /** @param {string} file */
  const at = (file) => { const parsed = byFile.get(file); assert.ok(parsed, `${file} must exist in ${RepoPath.Workflows}`); return parsed }
  assertLibraryBuildContract(at(roles.lib.workflow))
  assertGuardFailsClosed(at(roles.guard.workflow))
  assertReleaseRunIsNeverCancelled(at(roles.release.workflow))
  assertIndependentBundleVerification(at(roles.release.workflow))
  assertReleaseRecoveryGates(at(roles.release.workflow))
  assertToolCheckouts(byFile)
  assertForbiddenText(byFile)
}

function readWorkflows() { return new Map([...checkedFiles].map((file) => [file, readWorkflow(file)])) }

/* ── the release tool's own checks, as title-guard runs them ─────────────── */

/**
 * The guard's config and policy checks: the steps that invoke the tool's
 * config and policy commands. Naming a repository file elsewhere in the job
 * (for example, the adopting-PR config probe) is not a second check.
 */
function guardCheckSteps() {
  const steps = jobOf(readWorkflow(roles.guard.workflow), roles.guard.job).steps
  /** @param {string} command @param {string} file */
  const naming = (command, file) => {
    const found = steps.filter((/** @type {any} */ step) => typeof step.run === 'string' && step.run.includes(`release-intent ${command}`) && step.run.includes(file))
    assert.equal(found.length, 1, `${roles.guard.workflow} job ${roles.guard.job} must run exactly one ${command} over ${file}`)
    return found[0]
  }
  const policyStep = naming('check-workflows', RepoPath.QueuePolicy)
  assert.ok(policyStep.run.includes(RepoPath.Workflows), `${roles.guard.workflow}: the policy check must read ${RepoPath.Workflows}`)
  return Object.freeze({ config: naming('check-config', RepoPath.ReleaseConfig), policy: policyStep })
}

/**
 * Run one guard step's script with bash in a directory, never writing the
 * test step's own runner files.
 *
 * @param {string} run
 * @param {string} cwd
 */
function runGuardStep(run, cwd) {
  const env = { ...process.env }
  for (const name of RUNNER_STEP_FILES) delete env[name]
  const result = spawnSync('bash', ['-c', `set -euo pipefail\n${run}`], { cwd, env, encoding: 'utf8', timeout: TOOL_CHECK_TIMEOUT_MS, killSignal: 'SIGKILL' })
  if (result.error) assert.fail(`release-guard test: ${JSON.stringify(run)} could not run in ${cwd} (${result.error.message}); keep bash on PATH and the check under ${TOOL_CHECK_TIMEOUT_MS}ms.`)
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

/* ── tests ───────────────────────────────────────────────────────────────── */

test('fixture loader is strict and rejects unknown keys', () => { assert.throws(() => loadFixtures(`${fs.readFileSync(fixturePath, 'utf8')}\nunknown: true\n`), /keys drifted/) })

test('release tag grammar follows the release config prefix', () => {
  for (const row of fixtures.tags.valid) {
    const tag = `${config.tagPrefix}${row.version}`
    const parsed = parseReleaseTag(tag, config.tagPrefix)
    assert.equal(parsed.tag, tag, row.name)
    assert.equal(parsed.version, row.version, row.name)
    assert.equal(parsed.kind, row.kind, row.name)
  }
  for (const row of fixtures.tags.invalid) assert.throws(() => parseReleaseTag(row.input, config.tagPrefix), /expected exactly/, row.name)
  assert.throws(() => parseReleaseTag(`${config.tagPrefix}${fixtures.tags.valid[0].version}`, ''), /tag prefix/, 'an empty prefix fails closed instead of accepting any tag')
})

test('the package scripts keep the build and test composition', () => {
  const scripts = object(readPackageManifest().scripts, `${RepoPath.PackageManifest} scripts`)
  for (const row of fixtures.package.scripts) assert.ok(row.check.holds(scripts[row.script], row.operand), `${RepoPath.PackageManifest} script ${row.script} ${row.check.label} ${JSON.stringify(row.operand)}: ${row.name}`)
})

test('the merge-queue workflows keep the fairtrade-owned contract', () => {
  assertWorkflowContract(readWorkflows())
})

test('each contract mutation is caught by its contract assertion', () => {
  const byFile = readWorkflows()
  for (const mutation of fixtures.workflow.contract_mutations) {
    const original = /** @type {ReturnType<typeof parseWorkflow>} */ (byFile.get(mutation.file))
    assert.ok(original.text.includes(mutation.find), `${mutation.name}: find text is stale against ${mutation.file}`)
    const changed = original.text.replaceAll(mutation.find, mutation.replace)
    assert.notEqual(changed, original.text, `${mutation.name}: replacement must change ${mutation.file}`)
    const mutated = new Map(byFile).set(mutation.file, parseWorkflow(mutation.file, changed))
    assert.throws(() => assertWorkflowContract(mutated), (error) => {
      assert.equal(error.name, 'AssertionError', mutation.name)
      if (mutation.error_contains) assert.ok(error.message.includes(mutation.error_contains), `${mutation.name}: wrong contract assertion: ${error.message}`)
      return true
    }, mutation.name)
  }
})

test('the release tool accepts this repository and refuses each policy mutation', (t) => {
  const steps = guardCheckSteps()
  const configCheck = runGuardStep(steps.config.run, REPO_ROOT)
  if (configCheck.status === COMMAND_NOT_FOUND) {
    const message = `the release tool title-guard runs is not on PATH (${JSON.stringify(steps.config.run)} exited ${COMMAND_NOT_FOUND}). Build it as ${roles.guard.workflow} does, from the tool checkout every workflow pins, and put it on PATH.`
    if (IN_CI) assert.fail(`${message} CI builds it before the library tests, so this is a broken build step.`)
    t.skip(message)
    return
  }
  assert.equal(configCheck.status, 0, `${JSON.stringify(steps.config.run)} must accept ${RepoPath.ReleaseConfig}:\n${configCheck.output}`)
  const policyCheck = runGuardStep(steps.policy.run, REPO_ROOT)
  assert.equal(policyCheck.status, 0, `${JSON.stringify(steps.policy.run)} must accept ${RepoPath.Workflows}:\n${policyCheck.output}`)
  for (const mutation of fixtures.workflow.policy_mutations) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fairtrade-release-policy-'))
    try {
      for (const relative of [RepoPath.ReleaseConfig, RepoPath.QueuePolicy, RepoPath.Workflows]) fs.cpSync(path.join(REPO_ROOT, relative), path.join(dir, relative), { recursive: true })
      const file = path.join(dir, RepoPath.Workflows, mutation.file)
      const original = fs.readFileSync(file, 'utf8')
      assert.ok(original.includes(mutation.find), `${mutation.name}: find text is stale against ${mutation.file}`)
      fs.writeFileSync(file, original.replaceAll(mutation.find, mutation.replace))
      const result = runGuardStep(steps.policy.run, dir)
      assert.notEqual(result.status, 0, `${mutation.name}: the policy check must refuse the mutated ${mutation.file}, but it passed:\n${result.output}`)
      assert.ok(result.output.includes(mutation.file), `${mutation.name}: the refusal must name ${mutation.file}, the file the row mutated:\n${result.output}`)
      assert.ok(result.output.includes(`rule ${mutation.rule} in ${mutation.file}`), `${mutation.name}: the refusal must come from rule ${mutation.rule} in ${mutation.file}, the rule the row breaks:\n${result.output}`)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
})

/** The release tag the immutability case pushes: the fixture version under the release config's prefix. */
const RELEASE_TAG = `${config.tagPrefix}${fixtures.git.version}`

/** Per-command signing opt-out, so no throwaway-repository git call can reach a signing agent. */
const NO_SIGNING = ['-c', 'tag.gpgsign=false', '-c', 'commit.gpgsign=false', '-c', 'user.signingKey=']

/**
 * The environment every throwaway-repository git call runs under.
 *
 * The release-tag case must observe git's tag immutability and nothing else, so
 * the scratch repository is sealed against the machine it runs on: each inherited
 * GIT_* variable is dropped rather than trusted, the user and system config are
 * replaced by an empty file inside the throwaway directory, and the credential
 * and pinentry helpers are stubbed to fail. A contributor whose global config
 * turns on commit or tag signing therefore observes the same repository this case
 * observes, and no config, ref, tag, or key outside the throwaway directory is
 * read or written.
 * @param {string} dir the throwaway directory owning the scratch repositories
 * @returns {Record<string, string>} the substituted environment
 */
function hermeticGitEnvironment(dir) {
  const inherited = {}
  for (const [key, value] of Object.entries(process.env)) if (!key.startsWith('GIT_')) inherited[key] = value
  const askpass = path.join(dir, 'refuse-interactive.sh')
  fs.writeFileSync(askpass, '#!/bin/sh\necho "release-guard test: refusing an interactive credential or passphrase request" >&2\nexit 1\n')
  fs.chmodSync(askpass, 0o700)
  const globalConfig = path.join(dir, 'global.gitconfig')
  fs.writeFileSync(globalConfig, '')
  return {
    ...inherited,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: askpass,
    SSH_ASKPASS: askpass,
    LC_ALL: 'C',
  }
}

/**
 * Run one git command in the throwaway repository, signing-opted-out and bounded.
 * Every call carries a hard timeout, so a call that would block on a signing
 * agent or a prompt fails the case with a diagnostic instead of hanging the run.
 * @param {string} cwd the throwaway working directory
 * @param {Record<string, string>} env the substituted environment
 * @param {string[]} args the git arguments after the signing opt-out
 * @returns {{ status: number, stdout: string, stderr: string }} the captured result
 */
function hermeticGit(cwd, env, args) {
  const result = spawnSync('git', [...NO_SIGNING, ...args], { cwd, env, encoding: 'utf8', timeout: GIT_COMMAND_TIMEOUT_MS, killSignal: 'SIGKILL' })
  if (result.error) {
    const timedOut = result.error.code === 'ETIMEDOUT'
    assert.fail(
      `release-guard test: git ${args.join(' ')} ${timedOut ? `exceeded the ${GIT_COMMAND_TIMEOUT_MS}ms per-command ceiling` : `could not run (${result.error.message})`} at step "release tag scratch repository"; ` +
      'repair: keep every scratch-repository call under hermeticGit so the empty global config, the failing askpass stub, and the per-command timeout keep a signing agent or prompt from blocking the case.',
    )
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

/**
 * Run one git command that must succeed, reporting the command and its output on failure.
 * @param {string} cwd the throwaway working directory
 * @param {Record<string, string>} env the substituted environment
 * @param {string[]} args the git arguments after the signing opt-out
 * @returns {{ status: number, stdout: string, stderr: string }} the captured result
 */
function gitOk(cwd, env, args) {
  const result = hermeticGit(cwd, env, args)
  assert.equal(result.status, 0, `release-guard test: git ${args.join(' ')} must succeed in the throwaway repository at step "release tag scratch repository"; got status ${result.status} and ${result.stderr}`)
  return result
}

/**
 * Build one scratch pair: a bare remote and a work tree carrying the first
 * release commit, an annotated release tag, and that tag already pushed.
 * @param {string} parent the throwaway directory that owns this pair
 * @param {Record<string, string>} env the substituted environment
 * @returns {{ remote: string, work: string, firstObject: string, firstCommit: string }} the seeded pair
 */
function seedReleaseTagPair(parent, env) {
  const remote = path.join(parent, 'remote.git')
  const work = path.join(parent, 'work')
  gitOk(parent, env, ['init', '--bare', '--quiet', remote])
  gitOk(parent, env, ['init', '--quiet', work])
  gitOk(work, env, ['config', 'user.name', 'release-guard test'])
  gitOk(work, env, ['config', 'user.email', 'release-guard@example.invalid'])
  gitOk(work, env, ['remote', 'add', 'origin', remote])
  fs.writeFileSync(path.join(work, 'file'), 'one')
  gitOk(work, env, ['add', 'file'])
  gitOk(work, env, ['commit', '--quiet', '-m', 'one'])
  gitOk(work, env, ['tag', '-a', RELEASE_TAG, '-m', fixtures.git.first_message])
  gitOk(work, env, ['push', '--quiet', 'origin', `refs/tags/${RELEASE_TAG}`])
  return {
    remote,
    work,
    firstObject: gitOk(parent, env, ['--git-dir', remote, 'rev-parse', RELEASE_TAG]).stdout.trim(),
    firstCommit: gitOk(parent, env, ['--git-dir', remote, 'rev-parse', `${RELEASE_TAG}^{}`]).stdout.trim(),
  }
}

/**
 * Recreate the release tag on a second commit, the state a retried or duplicated
 * release run would be in.
 * @param {{ remote: string, work: string }} pair the seeded pair
 * @param {Record<string, string>} env the substituted environment
 * @returns {string} the second commit the local tag now points at
 */
function retagReleaseTag(pair, env) {
  fs.writeFileSync(path.join(pair.work, 'file'), 'two')
  gitOk(pair.work, env, ['commit', '--quiet', '-am', 'two'])
  gitOk(pair.work, env, ['tag', '--delete', RELEASE_TAG])
  gitOk(pair.work, env, ['tag', '-a', RELEASE_TAG, '-m', fixtures.git.second_message])
  return gitOk(pair.work, env, ['rev-parse', `${RELEASE_TAG}^{}`]).stdout.trim()
}

/**
 * Move the remote tag without force, the exact command the release job runs.
 * @param {{ remote: string, work: string }} pair the seeded pair
 * @param {Record<string, string>} env the substituted environment
 * @param {string} tag the release tag to push
 * @param {string[]} extraArgs additional push arguments, empty for a plain push
 * @returns {{ status: number, stdout: string, stderr: string }} the captured push
 */
function pushReleaseTag(pair, env, tag, extraArgs = []) {
  return hermeticGit(pair.work, env, ['push', ...extraArgs, 'origin', `refs/tags/${tag}`])
}

test('an annotated remote release tag cannot be moved or deleted by a plain push', { timeout: RELEASE_TAG_CASE_TIMEOUT_MS }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fairtrade-release-guard-'))
  try {
    const env = hermeticGitEnvironment(dir)
    assert.ok(env.GIT_CONFIG_GLOBAL.startsWith(dir), 'the substituted global config must live inside the throwaway directory so no contributor config is read or written')
    assert.equal(env.GIT_TERMINAL_PROMPT, '0', 'interactive terminal prompts must stay off so a credential request fails instead of waiting')

    // The invariant: a plain push of an existing release tag is refused and the
    // annotated tag object on the remote is untouched.
    const immutable = path.join(dir, 'immutable')
    fs.mkdirSync(immutable, { recursive: true })
    const pair = seedReleaseTagPair(immutable, env)
    // Hermeticity is asserted, not assumed: a case that passed only because the
    // machine it ran on happened to have signing off would guard nothing on a
    // contributor whose global config turns it on.
    for (const setting of ['tag.gpgsign', 'commit.gpgsign']) {
      assert.equal(gitOk(pair.work, env, ['config', '--get', setting]).stdout.trim(), 'false', `the scratch repository must opt out of ${setting} at step "release tag scratch repository"; repair: keep ${setting}=false in the NO_SIGNING per-command opt-out so the case cannot block on a signing agent.`)
      assert.equal(gitOk(pair.work, env, ['config', '--get', 'user.signingKey']).stdout.trim(), '', 'the scratch repository must carry no signing key at step "release tag scratch repository"; repair: keep the empty user.signingKey in the NO_SIGNING per-command opt-out so no key material is required.')
    }
    const globalScopes = gitOk(pair.work, env, ['config', '--list', '--show-scope']).stdout.split('\n').filter((line) => line.startsWith('global\t'))
    assert.deepEqual(globalScopes, [], `the scratch repository must see no global-scope config, so a contributor's signing settings cannot reach it; got ${globalScopes.join(' | ')}`)
    retagReleaseTag(pair, env)
    const refused = pushReleaseTag(pair, env, RELEASE_TAG)
    assert.notEqual(refused.status, 0, `a plain push of the existing release tag ${RELEASE_TAG} must be refused; got status 0 and ${refused.stdout}${refused.stderr}`)
    assert.match(refused.stderr, /already exists/, `the refusal must come from the receiver refusing to move an existing tag, not from an unrelated error; got ${refused.stderr}`)
    assert.equal(gitOk(dir, env, ['--git-dir', pair.remote, 'rev-parse', RELEASE_TAG]).stdout.trim(), pair.firstObject, 'the remote release tag object must be unchanged after the refused push')
    assert.equal(gitOk(dir, env, ['--git-dir', pair.remote, 'rev-parse', `${RELEASE_TAG}^{}`]).stdout.trim(), pair.firstCommit, 'the remote release tag must still point at the first release commit after the refused push')

    // The controls: git moves the very same tag the moment the guard is dropped,
    // so the refusal above is the receiver's immutability, not an incidental
    // failure that would have made the assertion pass anyway.
    for (const row of fixtures.git.mutations) {
      const control = path.join(dir, `control-${row.operation.wire}`)
      fs.mkdirSync(control, { recursive: true })
      const pair = seedReleaseTagPair(control, env)
      const secondCommit = retagReleaseTag(pair, env)
      row.operation.apply(pair, env, RELEASE_TAG, row.name)
      assert.equal(gitOk(dir, env, ['--git-dir', pair.remote, 'rev-parse', `${RELEASE_TAG}^{}`]).stdout.trim(), secondCommit, `${row.name}: the remote release tag must have moved, so the plain-push refusal is the guard and not an unrelated failure`)
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('release candidate provenance runs the real workflow step', async (t) => {
  const fixture = YAML.parse(fs.readFileSync(provenanceFixturePath, 'utf8'), { merge: true })
  const workflow = YAML.parse(fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/release-batch.yml'), 'utf8'))
  const steps = workflow.jobs.plan.steps
  const step = steps.find((item) => item.id === 'provenance')
  assert.ok(step?.run)
  assert.equal(Object.hasOwn(step, 'continue-on-error'), false)
  assert.match(steps.find((item) => item.name === 'Make the annotated release tag').if, /steps\.provenance\.outcome == 'success'/)
  assert.ok(Object.keys(fixture.provenance_permissions ?? {}).length > 0, 'fixture names no required plan job permissions')
  for (const [scope, level] of Object.entries(fixture.provenance_permissions)) {
    assert.equal(workflow.jobs.plan.permissions[scope], level, `plan job must grant ${scope}: ${level}`)
  }
  const names = fixture.provenance_cases.map((item) => item.name)
  assert.equal(new Set(names).size, names.length)
  for (const name of fixture.provenance_required) assert.ok(names.includes(name), `missing provenance case ${name}`)
  for (const item of fixture.provenance_cases) {
    await t.test(item.name, () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-provenance-'))
      try {
        const bin = path.join(dir, 'bin')
        fs.mkdirSync(bin)
        const commands = {
          git: '#!/bin/sh\n[ "$#" -eq 2 ] && [ "$1" = show ] && [ "$2" = "${PLAN_SOURCE}:.github/release-intent.yaml" ] || { echo UNEXPECTED_STUB_ARGUMENTS:git >&2; exit 90; }\n[ "$TEST_GIT_EXIT" = 0 ] || exit "$TEST_GIT_EXIT"\nprintf "fixture config\\n"\n',
          yq: '#!/bin/sh\n[ "$#" -eq 2 ] && [ "$1" = "-o=json" ] && [ "$2" = "." ] || { echo UNEXPECTED_STUB_ARGUMENTS:yq >&2; exit 91; }\n[ "$TEST_YQ_EXIT" = 0 ] || exit "$TEST_YQ_EXIT"\ncat >/dev/null\nprintf "%s\\n" "$TEST_CONFIG_JSON"\n',
          gh: '#!/bin/sh\n[ "$#" -eq 3 ] && [ "$1" = api ] && [ "$2" = --paginate ] && [ "$3" = "repos/${GITHUB_REPOSITORY}/commits/${CANDIDATE}/pulls?per_page=100" ] && [ "$GH_TOKEN" = readonly-test-token ] || { echo UNEXPECTED_STUB_ARGUMENTS:gh >&2; exit 92; }\nprintf "%s" "$TEST_API_OUTPUT"\nexit "$TEST_API_EXIT"\n',
        }
        for (const [name, body] of Object.entries(commands)) fs.writeFileSync(path.join(bin, name), body, { mode: 0o755 })
        const output = item.raw_output || (item.pages || []).map((page) => JSON.stringify(page) + '\n').join('')
        const result = spawnSync('bash', ['-e', '-c', step.run], {
          cwd: dir, encoding: 'utf8', timeout: 10000,
          env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, RUNNER_TEMP: dir,
            GH_TOKEN: 'readonly-test-token', GITHUB_REPOSITORY: 'peasant-labs/fairtrade-design-system',
            PLAN_SOURCE: 'plan-source', CANDIDATE: item.candidate || fixture.provenance_candidate,
            TEST_CONFIG_JSON: JSON.stringify(item.config || fixture.provenance_config),
            TEST_API_OUTPUT: output, TEST_API_EXIT: String(item.api_exit || 0),
            TEST_GIT_EXIT: String(item.git_exit || 0), TEST_YQ_EXIT: String(item.yq_exit || 0) },
        })
        assert.equal(result.error, undefined)
        assert.ok(!(result.stdout + result.stderr).includes('UNEXPECTED_STUB_ARGUMENTS:'), result.stderr)
        assert.equal(result.status, item.expected_exit, result.stderr + result.stdout)
        if (item.expected_exit !== 0) {
          assert.ok(item.error_contains?.startsWith('::error::'))
          assert.ok((result.stdout + result.stderr).includes(item.error_contains), result.stdout + result.stderr)
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  }
})

test('workflow npm installs stay job-private', () => {
  const directory = path.join(REPO_ROOT, '.github/workflows')
  const config = YAML.parse(fs.readFileSync(path.join(import.meta.dirname, 'testdata/private-install.yaml'), 'utf8'))
  const regex = (pattern) => new RegExp(pattern.replace(/^\(\?m\)/, ''), 'm')
  const global = regex(config.global_pattern)
  const normalize = (s) => s.replace(/\\\n\s*/g, ' ')
  const names = config.cases.map((row) => row.name)
  assert.deepEqual([...new Set(names)].sort(), [...config.required_names].sort()); assert.equal(names.length, new Set(names).size)
  for (const row of config.cases) assert.equal(global.test(normalize(row.input)), row.want, row.name)
  const files = fs.readdirSync(directory).filter((name) => /\.ya?ml$/.test(name))
  assert.ok(files.length > 0)
  const target = []
  for (const file of files) {
    const doc = YAML.parse(fs.readFileSync(path.join(directory, file), 'utf8'))
    for (const [job, value] of Object.entries(doc.jobs ?? {})) {
      for (const step of value.steps ?? []) {
        const run = normalize(step.run ?? '')
        assert.doesNotMatch(run, global, `${file} ${job} ${step.name}`)
        if (file === config.workflow && job === config.job && step.name === config.step) target.push(run)
      }
    }
  }
  assert.equal(target.length, 1)
  for (const pattern of [config.prefix_pattern, config.install_pattern, config.path_pattern]) assert.match(target[0], regex(pattern))
})
