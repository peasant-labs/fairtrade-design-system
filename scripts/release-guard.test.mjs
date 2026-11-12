import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import YAML from 'yaml'
import { parseFairtradeTag, releaseKind } from './release-guard.mjs'

const root = path.resolve(import.meta.dirname, '..')
const fixturePath = path.join(import.meta.dirname, 'testdata/release-guard.yaml')
/** Per-command ceiling for one throwaway-repository git call, in ms. */
const GIT_COMMAND_TIMEOUT_MS = 10000
/** Ceiling for the whole release-tag case, in ms: a regression fails instead of hanging. */
const RELEASE_TAG_CASE_TIMEOUT_MS = 60000
const requiredGitMutations = new Map([
  ['a forced push moves the release tag', 'force_push'],
  ['a delete and re-push moves the release tag', 'delete_then_push'],
])
const requiredWorkflowMutations = new Map([
  ['re-adding edited to ci.yml is rejected', 'ci.yml'],
  ['cancelling ci on every event is rejected', 'ci.yml'],
  ['unconditional prepack is rejected', 'ci.yml'],
  ['a branch literal in ci classify is rejected', 'ci.yml'],
  ['classify without its base revision is rejected', 'ci.yml'],
  ['dropping edited from title-guard is rejected', 'title-guard.yml'],
  ['a job-level if on the guard job is rejected', 'title-guard.yml'],
  ['warn-and-pass group resolution is rejected', 'title-guard.yml'],
  ['a weakened release-batch verdict is rejected', 'release-batch.yml'],
  ['arming without the gate is rejected', 'release-batch.yml'],
  ['a major cut-release level is rejected', 'cut-release.yml'],
  ['a cut-release on any branch is rejected', 'cut-release.yml'],
  ['a cut-release write without tag mode is rejected', 'cut-release.yml'],
  ['editing the cut-release PR is rejected', 'cut-release.yml'],
  ['arming another branch is rejected', 'cut-release.yml'],
])
const requiredTagValid = new Set(['final', 'candidate', 'zero core'])
const requiredTagInvalid = new Set(['missing namespace', 'missing v', 'beta', 'leading zero major', 'leading zero minor', 'leading zero patch', 'rc zero', 'rc padded'])

function object(value, where) { assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${where} must be an object`); return value }
function array(value, where, min) { assert.ok(Array.isArray(value) && value.length >= min, `${where} must contain at least ${min} rows`); return value }
function string(value, where) { assert.ok(typeof value === 'string' && value.length > 0, `${where} must be a non-empty string`); return value }
function keys(value, allowed, where) { object(value, where); assert.deepEqual(Object.keys(value).sort(), [...allowed].sort(), `${where} keys drifted`) }
function named(rows, where) { const names = rows.map((row, index) => string(row.name, `${where}[${index}].name`)); assert.equal(new Set(names).size, names.length, `${where} names must be unique`) }
function exactNames(rows, required, where) {
  named(rows, where)
  assert.deepEqual(new Set(rows.map((row) => row.name)), new Set(required), `${where} must name exactly the required scenarios`)
}

function validateFixtures(f) {
  keys(f, ['tags', 'workflow', 'git'], 'root')
  keys(f.tags, ['valid', 'invalid'], 'tags')
  exactNames(array(f.tags.valid, 'tags.valid', 1), [...requiredTagValid], 'tags.valid')
  for (const row of f.tags.valid) { keys(row, ['name', 'input'], 'tags.valid row'); string(row.input, 'tags.valid input') }
  exactNames(array(f.tags.invalid, 'tags.invalid', 1), [...requiredTagInvalid], 'tags.invalid')
  for (const row of f.tags.invalid) { keys(row, ['name', 'input'], 'tags.invalid row'); string(row.input, 'tags.invalid input') }
  keys(f.workflow, ['ci_pr_types', 'ci_cancel', 'guard_pr_types', 'cut_levels', 'mutations'], 'workflow')
  assert.deepEqual([...f.workflow.ci_pr_types].sort(), ['opened', 'reopened', 'synchronize'], 'CI runs on open, synchronize, and reopen without rechecking title edits')
  assert.equal(f.workflow.ci_cancel, '${{ github.event_name == \'pull_request\' }}', 'CI cancels in-progress runs on pull_request only, never on a merge group')
  assert.deepEqual([...f.workflow.guard_pr_types].sort(), ['edited', 'opened', 'reopened', 'synchronize'], 'title-guard runs the full check on every pull_request event, including edited')
  assert.deepEqual([...f.workflow.cut_levels], ['patch', 'minor'], 'cut-release offers patch and minor only')
  exactNames(array(f.workflow.mutations, 'workflow.mutations', 1), [...requiredWorkflowMutations.keys()], 'workflow.mutations')
  for (const row of f.workflow.mutations) {
    keys(row, ['name', 'file', 'find', 'replace'], 'workflow.mutations row')
    assert.equal(row.file, requiredWorkflowMutations.get(row.name), `workflow.mutations.${row.name} must probe ${requiredWorkflowMutations.get(row.name)}`)
    string(row.find, `workflow.mutations.${row.name}.find`)
    assert.equal(typeof row.replace, 'string', `workflow.mutations.${row.name}.replace must be a string`)
  }
  keys(f.git, ['tag', 'first_message', 'second_message', 'mutations'], 'git')
  for (const field of ['tag', 'first_message', 'second_message']) string(f.git[field], `git.${field}`)
  exactNames(array(f.git.mutations, 'git.mutations', 1), [...requiredGitMutations.keys()], 'git.mutations')
  for (const row of f.git.mutations) { keys(row, ['name', 'operation'], 'git.mutations row'); assert.equal(row.operation, requiredGitMutations.get(row.name), `git.mutations.${row.name} has unknown operation`) }
  return f
}

function loadFixtures(source = fs.readFileSync(fixturePath, 'utf8')) {
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length) throw new Error(`fixture YAML invalid: ${document.errors.map((error) => error.message).join('; ')}`)
  if (YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true }).length !== 1) throw new Error('fixture YAML must contain exactly one document')
  return validateFixtures(document.toJS())
}

const fixtures = loadFixtures()

function parseWorkflow(relative) {
  const text = fs.readFileSync(path.join(root, '.github/workflows', relative), 'utf8')
  // `on` parses as boolean true under YAML 1.1; read either key like the old contract did.
  const workflow = YAML.parse(text)
  return { text, workflow, trigger: workflow.on ?? workflow.true }
}

function normalizeIf(value) { return value.replace(/\s+/g, ' ').trim() }

/** The one release-intent pin in a workflow file: the literal 40-hex commit
 * in the tool checkout's `ref:`. An env reference or anchor name is not a
 * pin: the policy checker reads the ref value itself. */
function workflowSha(relative, text) {
  const pins = [...text.matchAll(/^\s*ref: ([0-9a-f]{40})$/gm)]
  assert.equal(pins.length, 1, `${relative} must pin the tool checkout once, with a literal 40-hex commit SHA`)
  return pins[0][1]
}

function assertPrepackComposition(scripts) {
  assert.match(scripts.prepack, /assert-package-provenance/)
  assert.match(scripts.prepack, /\bpnpm build:lib\b/)
  assert.match(scripts.prepack, /\bpnpm pack:check\b/)
  assert.doesNotMatch(scripts.prepack, /\btest:/)
  assert.doesNotMatch(scripts['build:lib'], /\btest:|\.test\./)
  assert.equal(scripts['prebuild:lib'], undefined)
}

function assertCITriggers(trigger) {
  assert.deepEqual(trigger.pull_request.types, fixtures.workflow.ci_pr_types, 'CI pull_request types drifted: the lib gate must not re-run on title edits')
  assert.ok('merge_group' in object(trigger, 'ci trigger'), 'CI must trigger on merge_group so every queued entry is checked again after enqueue')
}

function assertCIConcurrency(ci) {
  assert.equal(normalizeIf(String(ci.concurrency.group)), 'ci-${{ github.ref }}', 'CI concurrency must stay keyed on the ref so group builds never share a group')
  assert.equal(normalizeIf(String(ci.concurrency['cancel-in-progress'])), fixtures.workflow.ci_cancel)
}

function assertCIContract(ci, text) {
  assertCITriggers(ci.on ?? ci.true)
  assertCIConcurrency(ci)
  assertLibContract(ci, text)
}

function assertLibContract(ci, text) {
  const lib = object(ci.jobs?.lib, 'ci job lib')
  const classify = lib.steps.find((step) => typeof step.run === 'string' && step.run.includes('release-intent classify'))
  assert.ok(classify, 'ci lib must classify the pull request with the `release-intent classify` command, not a wrapper path')
  assert.match(classify.run, /--author/, 'classify must pass the PR author')
  assert.match(classify.run, /--head-branch/, 'classify must pass the PR head branch')
  assert.match(classify.run, /--rev/, 'classify must judge the base revision release config, never the working tree')
  assert.doesNotMatch(text, /automation\//, 'no workflow decides from a branch literal; the release-PR decision is `classify` output only')
  const prepack = lib.steps.find((step) => step.run === 'pnpm prepack')
  assert.ok(prepack, 'ci lib must keep a canonical prepack step for the release PR')
  assert.equal(normalizeIf(String(prepack.if)), "steps.kind.outputs.kind == 'release'", 'prepack runs on the release PR only (its PR events and its group build)')
  const build = lib.steps.find((step) => step.run === 'pnpm run build:lib')
  assert.ok(build, 'ci lib must keep a build:lib step for every other PR')
  assert.equal(normalizeIf(String(build.if)), "steps.kind.outputs.kind != 'release'", 'build:lib runs everywhere prepack does not')
  const tests = lib.steps.find((step) => step.run === 'pnpm test:lib')
  assert.ok(tests, 'ci lib must keep the library test step')
  assert.equal(tests.if, undefined, 'test:lib runs unconditionally after the build')
  assert.equal(tests.env?.NODE_COMPILE_CACHE, '${{ runner.temp }}/node-compile-cache')
  assert.ok(lib.steps.indexOf(tests) > Math.max(lib.steps.indexOf(prepack), lib.steps.indexOf(build)), 'tests run after the build they exercise')
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts
  assert.equal(scripts['test:lib'], 'node scripts/run-test-lib.mjs')
  assert.ok(scripts['test:lib:serial'].includes('pnpm test:pi-transcript:mounted'))
  assert.ok(scripts['test:lib:serial'].includes('pnpm test:vitest'))
  assertPrepackComposition(scripts)
}

function assertGuardContract(guard, text) {
  const trigger = guard.on ?? guard.true
  assert.deepEqual(trigger.pull_request.types, fixtures.workflow.guard_pr_types, 'title-guard must run the full check on every pull_request event with no early exit')
  assert.ok('merge_group' in object(trigger, 'title-guard trigger'), 'title-guard must check every queued entry again in its group build')
  const job = object(guard.jobs?.['title-guard'], 'title-guard job')
  assert.equal(job.if, undefined, 'the guard job must carry no job-level if, so a body edit can never skip the check')
  assert.notEqual(job['continue-on-error'], true, 'the guard job must not use continue-on-error')
  assert.doesNotMatch(text, /github\.event\.action/, 'the guard workflow must never read the pull-request action')
  assert.doesNotMatch(text, /github\.event\.changes/, 'the guard workflow must never read the changed-file list')
  assert.doesNotMatch(text, /GITHUB_EVENT_PATH/, 'the guard workflow must never read the event file; titles and SHAs come from the live API')
  for (const needle of [
    'release-intent group-pr --ref',
    'failing closed so an unidentified entry never lands unchecked.',
    'gh pr view',
    "printf '%s'",
    'release-intent check-title --base',
    'release-intent classify --author',
    '--rev "${PR_BASE}"',
    'release-intent release-pr --check',
    '--floor',
    'RELEASE_BATCH_FLOOR',
    'release-intent check-config --config',
    'release-intent check-workflows --policy',
  ]) assert.ok(text.includes(needle), `title-guard is missing expected contract text: ${needle}`)
  assert.match(text, /failing closed so an unidentified entry never lands unchecked\."\s*\n\s*exit 1/, 'an unresolvable group entry must fail the job closed, never warn and pass')
  const check = job.steps.find((step) => typeof step.run === 'string' && step.run.includes('release-pr --check'))
  assert.ok(check, 'title-guard must compare the release PR content with `release-pr --check`')
  assert.match(normalizeIf(String(check.if)), /steps\.classify\.outputs\.kind == 'release'/, 'the content check runs on the release PR only, decided by classify')
}

function assertBatchContract(batch, text) {
  const trigger = batch.on ?? batch.true
  assert.deepEqual(trigger.push.branches, ['main'], 'release-batch plans every landed batch from the default branch tip')
  assert.deepEqual(trigger.schedule, [{ cron: '*/30 * * * *' }], 'release-batch runs twice an hour so a held release PR is armed after the queue drains')
  assert.ok('workflow_dispatch' in object(trigger, 'release-batch trigger'), 'release-batch keeps a dispatch retry')
  assert.equal(normalizeIf(String(batch.concurrency.group)), 'release-batch', 'one serialized release job per repo')
  assert.equal(batch.concurrency['cancel-in-progress'], false, 'a release run is never cancelled by a later one')
  const job = object(batch.jobs?.release, 'release-batch job release')
  assert.equal(normalizeIf(String(job.if)), "github.ref == 'refs/heads/main'", 'the App key is minted only on the default branch')
  assert.equal(normalizeIf(String(job.steps.find((step) => step.id === 'mint').if)), "vars.RELEASE_BATCH_MODE == 'tag'", 'the mint step runs only in tag mode, as a single comparison with no disjunction')
  for (const needle of [
    '--mode "${{ vars.RELEASE_BATCH_MODE }}"',
    '--floor "${{ vars.RELEASE_BATCH_FLOOR }}"',
    '--verdict taggable',
    'release-pr --write',
    'git tag -a',
    'refs/tags/',
    'mergeQueue',
    'queue-gate --queue',
    "steps.gate.outputs.gate == 'arm'",
    "steps.gate.outputs.gate == 'hold'",
    'gh pr close',
    '--disable-auto',
    'RELEASE_BATCH_FLOOR',
    "github.ref == 'refs/heads/main'",
    'precheck',
    'proceed',
    '--force-with-lease',
    'PEASANT_RELEASER_APP_ID',
    'merge --auto --squash',
    'queue.json',
    '--current origin/automation/release',
  ]) assert.ok(text.includes(needle), `release-batch is missing expected contract text: ${needle}`)
  assert.doesNotMatch(text, /dequeuePullRequest/, 'on hold the job only turns auto-merge off; a queued release PR is never dequeued')
  assert.doesNotMatch(text, /gh release/, 'the tag step only pushes the tag; the tag-triggered release.yml publishes the GitHub Release')
  assert.equal(text.match(/git tag -a/g)?.length ?? 0, 1, 'exactly one step pushes the tag')
  const tag = job.steps.find((step) => typeof step.run === 'string' && step.run.includes('git tag -a'))
  assert.match(normalizeIf(String(tag.if)), /steps\.plan\.outputs\.action == 'tag'/, 'the tag goes out once, on the verdict plan step tag action')
  for (const spelling of [
    'push --force-with-lease origin automation/release',
    'gh pr create --head automation/release',
    'gh pr list --head automation/release',
    '--current origin/automation/release',
  ]) assert.ok(text.includes(spelling), `release-batch must name the release branch explicitly in its push target: ${spelling}`)
}

function assertCutContract(cut, text) {
  const inputs = object((cut.on ?? cut.true).workflow_dispatch?.inputs, 'cut-release inputs')
  assert.deepEqual(Object.keys(inputs), ['level'], 'cut-release takes exactly one input: the level')
  assert.deepEqual(inputs.level, { description: 'Bump level for the forced release', required: true, type: 'choice', options: fixtures.workflow.cut_levels })
  const job = object(cut.jobs?.cut, 'cut-release job cut')
  assert.equal(normalizeIf(String(job.if)), "github.ref == 'refs/heads/main' && vars.RELEASE_BATCH_MODE == 'tag'", 'the button acts only on the default branch while tag mode is on')
  const tagModeSteps = job.steps.filter((step) => typeof step.run === 'string' && /push --force-with-lease|gh pr (create|merge|close)/.test(step.run))
  assert.ok(tagModeSteps.length >= 3, 'cut-release must push, open, and arm through gated write steps')
  for (const step of tagModeSteps) assert.equal(normalizeIf(String(step.if)), "vars.RELEASE_BATCH_MODE == 'tag'", `cut-release step ${step.name ?? step.id} must test tag mode in its own if, as a single comparison`)
  for (const needle of [
    '--allow-empty',
    'gh pr merge --auto --squash automation/cut-release;',
    'gh pr create --head automation/cut-release',
    'gh pr close automation/cut-release;',
    'PEASANT_RELEASER_APP_ID',
    'RELEASE_BATCH_MODE',
    'push --force-with-lease',
  ]) assert.ok(text.includes(needle), `cut-release is missing expected contract text: ${needle}`)
  assert.doesNotMatch(text, /gh pr edit/, 'only the release job edits a PR; the cut button updates its own by pushing its branch')
  assert.doesNotMatch(text, /release-intent/, 'cut-release carries no tool call: the empty commit under a release title is the whole request')
  assert.doesNotMatch(text, /refs\/tags\/|\bgit tag\b/, 'cut-release never tags')
  for (const spelling of [
    'HEAD:automation/cut-release',
    'gh pr create --head automation/cut-release',
    'gh pr close automation/cut-release;',
    'gh pr merge --auto --squash automation/cut-release;',
    'gh pr list --head automation/cut-release',
  ]) assert.ok(text.includes(spelling), `cut-release must name its own branch explicitly in each push target: ${spelling}`)
}

test('fixture loader is strict and rejects unknown keys', () => { assert.throws(() => loadFixtures(`${fs.readFileSync(fixturePath, 'utf8')}\nunknown: true\n`), /keys drifted/) })

test('release tag grammar stays canonical', () => {
  for (const row of fixtures.tags.valid) {
    const parsed = parseFairtradeTag(row.input)
    assert.equal(parsed.tag, row.input, row.name)
    assert.equal(parsed.version, row.input.slice('fairtrade-v'.length), row.name)
    assert.equal(parsed.kind, releaseKind(parsed.version), row.name)
  }
  for (const row of fixtures.tags.invalid) assert.throws(() => parseFairtradeTag(row.input), /expected exactly/, row.name)
  assert.equal(releaseKind('0.0.68'), 'final')
  assert.equal(releaseKind('0.0.68-rc1'), 'rc')
})

test('required merge-queue checks run canonical commands on every event', () => {
  const ci = parseWorkflow('ci.yml')
  assertCIContract(ci.workflow, ci.text)
  const guard = parseWorkflow('title-guard.yml')
  assertGuardContract(guard.workflow, guard.text)
})

test('the release job carries out exactly the planned action', () => {
  const parsed = parseWorkflow('release-batch.yml')
  assertBatchContract(parsed.workflow, parsed.text)
})

test('the cut-release button stays dispatch-only with a level choice', () => {
  const parsed = parseWorkflow('cut-release.yml')
  assertCutContract(parsed.workflow, parsed.text)
})

test('policy, config, and workflows name the same contract', () => {
  const policy = YAML.parse(fs.readFileSync(path.join(root, '.github/release-guard.policy.yml'), 'utf8'))
  const config = YAML.parse(fs.readFileSync(path.join(root, '.github/release-intent.yaml'), 'utf8'))
  assert.deepEqual(policy.queue.required, [
    { context: 'lib', workflow: 'ci.yml', job: 'lib' },
    { context: 'gates', workflow: 'ci.yml', job: 'gates', aggregator: true },
    { context: 'title-guard', workflow: 'title-guard.yml', job: 'title-guard', guard: true },
  ], 'the required contexts must equal the queue ruleset the operator compares them against')
  assert.deepEqual(policy.queue.release_job, { workflow: 'release-batch.yml', job: 'release', pre_tag_steps: [] })
  assert.deepEqual(policy.queue.bot_jobs, [{ workflow: 'cut-release.yml', job: 'cut', kind: 'cut-release' }])
  assert.equal(config.releases, true)
  assert.equal(config.tag_prefix, 'fairtrade-v')
  assert.equal(config.automation_author, 'peasant-labs-releaser[bot]')
  assert.equal(config.changelog, 'CHANGELOG.md')
  assert.deepEqual(config.version_files, [{ path: 'package.json', field: 'version' }])
  assert.deepEqual(config.bot_branches, { release: 'automation/release', 'cut-release': 'automation/cut-release' })
  const ci = parseWorkflow('ci.yml')
  const guard = parseWorkflow('title-guard.yml')
  const batch = parseWorkflow('release-batch.yml')
  const cut = parseWorkflow('cut-release.yml')
  // The tool pin is one literal per workflow, and every workflow pins the
  // same commit: the integration supervisor re-pins it once.
  const shas = new Set([workflowSha('ci.yml', ci.text), workflowSha('title-guard.yml', guard.text), workflowSha('release-batch.yml', batch.text)])
  assert.equal(shas.size, 1, 'every workflow that builds the tool must pin the same schema commit')
  assert.ok(!cut.text.includes('SCHEMA_SHA'), 'cut-release needs no tool pin: it carries no tool call')
  assert.doesNotMatch(ci.text + guard.text + batch.text + cut.text, /\$\{\{ env\.SCHEMA_SHA \}\}/, 'the pin is the literal commit in each tool checkout, never an env reference the checker cannot resolve')
  // The push targets name the release config's branches explicitly so the
  // checker can resolve them; the config stays the one source and this test
  // pins the equality. No workflow compares a branch literally: every
  // decision reads the tool's outputs.
  assert.equal(config.bot_branches.release, 'automation/release')
  assert.equal(config.bot_branches['cut-release'], 'automation/cut-release')
  assert.ok(batch.text.includes('automation/release'), 'release-batch must push and open on the release branch')
  assert.ok(!batch.text.includes('automation/cut-release'), 'release-batch must never touch the cut-release branch')
  assert.ok(cut.text.includes('automation/cut-release'), 'cut-release must push, open, close, and arm on its own branch')
  assert.ok(!cut.text.includes('automation/release'), 'cut-release must never touch the release branch')
  assert.ok(!/==\s*['"]?automation\//.test(batch.text + cut.text + ci.text + guard.text), 'no workflow compares a bot branch with ==')
  for (const [relative, workflowText] of [['release-batch.yml', batch.text], ['cut-release.yml', cut.text], ['ci.yml', ci.text], ['title-guard.yml', guard.text]]) {
    for (const line of workflowText.split('\n')) {
      assert.ok(!(line.includes('automation/') && (line.includes('==') || line.includes('!='))), `${relative} compares a bot branch literally: ${line.trim()}`)
    }
  }
})

test('each workflow mutation is caught by its contract assertion', () => {
  const contracts = { 'ci.yml': assertCIContract, 'title-guard.yml': assertGuardContract, 'release-batch.yml': assertBatchContract, 'cut-release.yml': assertCutContract }
  for (const mutation of fixtures.workflow.mutations) {
    const { text, workflow } = parseWorkflow(mutation.file)
    assert.ok(text.includes(mutation.find), `${mutation.name}: find text is stale against ${mutation.file}`)
    const changed = text.replaceAll(mutation.find, mutation.replace)
    assert.notEqual(changed, text, `${mutation.name}: replacement must change ${mutation.file}`)
    const parsed = YAML.parse(changed)
    assert.throws(() => contracts[mutation.file](parsed, changed), { name: 'AssertionError' }, mutation.name)
  }
})

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
  gitOk(work, env, ['tag', '-a', fixtures.git.tag, '-m', fixtures.git.first_message])
  gitOk(work, env, ['push', '--quiet', 'origin', `refs/tags/${fixtures.git.tag}`])
  return {
    remote,
    work,
    firstObject: gitOk(parent, env, ['--git-dir', remote, 'rev-parse', fixtures.git.tag]).stdout.trim(),
    firstCommit: gitOk(parent, env, ['--git-dir', remote, 'rev-parse', `${fixtures.git.tag}^{}`]).stdout.trim(),
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
  gitOk(pair.work, env, ['tag', '--delete', fixtures.git.tag])
  gitOk(pair.work, env, ['tag', '-a', fixtures.git.tag, '-m', fixtures.git.second_message])
  return gitOk(pair.work, env, ['rev-parse', `${fixtures.git.tag}^{}`]).stdout.trim()
}

/**
 * Move the remote tag without force, the exact command the release job runs.
 * @param {{ remote: string, work: string }} pair the seeded pair
 * @param {string[]} extraArgs additional push arguments, empty for a plain push
 * @returns {{ status: number, stdout: string, stderr: string }} the captured push
 */
function pushReleaseTag(pair, env, extraArgs = []) {
  return hermeticGit(pair.work, env, ['push', ...extraArgs, 'origin', `refs/tags/${fixtures.git.tag}`])
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
    const refused = pushReleaseTag(pair, env)
    assert.notEqual(refused.status, 0, `a plain push of the existing release tag ${fixtures.git.tag} must be refused; got status 0 and ${refused.stdout}${refused.stderr}`)
    assert.match(refused.stderr, /already exists/, `the refusal must come from the receiver refusing to move an existing tag, not from an unrelated error; got ${refused.stderr}`)
    assert.equal(gitOk(dir, env, ['--git-dir', pair.remote, 'rev-parse', fixtures.git.tag]).stdout.trim(), pair.firstObject, 'the remote release tag object must be unchanged after the refused push')
    assert.equal(gitOk(dir, env, ['--git-dir', pair.remote, 'rev-parse', `${fixtures.git.tag}^{}`]).stdout.trim(), pair.firstCommit, 'the remote release tag must still point at the first release commit after the refused push')

    // The controls: git moves the very same tag the moment the guard is dropped,
    // so the refusal above is the receiver's immutability, not an incidental
    // failure that would have made the assertion pass anyway.
    for (const row of fixtures.git.mutations) {
      const control = path.join(dir, `control-${row.operation}`)
      fs.mkdirSync(control, { recursive: true })
      const pair = seedReleaseTagPair(control, env)
      const secondCommit = retagReleaseTag(pair)
      if (row.operation === 'force_push') {
        assert.equal(pushReleaseTag(pair, env, ['--force']).status, 0, `${row.name}: a forced push must move the tag, or the non-force refusal proves nothing`)
      } else if (row.operation === 'delete_then_push') {
        assert.equal(gitOk(pair.work, env, ['push', '--quiet', 'origin', `:refs/tags/${fixtures.git.tag}`]).status, 0, `${row.name}: deleting the remote tag must be accepted`)
        assert.equal(pushReleaseTag(pair, env).status, 0, `${row.name}: re-pushing the recreated tag must be accepted`)
      } else {
        throw new Error(`release-guard test: git fixture operation ${row.operation} is unknown; add it to requiredGitMutations before using it`)
      }
      assert.equal(gitOk(dir, env, ['--git-dir', pair.remote, 'rev-parse', `${fixtures.git.tag}^{}`]).stdout.trim(), secondCommit, `${row.name}: the remote release tag must have moved, so the plain-push refusal is the guard and not an unrelated failure`)
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
