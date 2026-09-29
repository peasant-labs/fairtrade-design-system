import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import YAML from 'yaml'
import { GitHubReleaseClient, isMaintainerPermission, parseFairtradeTag, parseReleaseTitle, reduceLatestReviewApproval, titleToFairtradeTag, validateMergedPullRequest, validatePackageVersion } from './release-guard.mjs'

const root = path.resolve(import.meta.dirname, '..')
const fixturePath = path.join(import.meta.dirname, 'testdata/release-guard.yaml')
/** Per-command ceiling for one throwaway-repository git call, in ms. */
const GIT_COMMAND_TIMEOUT_MS = 10000
/** Ceiling for the whole release-tag case, in ms: a regression fails instead of hanging. */
const RELEASE_TAG_CASE_TIMEOUT_MS = 60000
const requiredNativeStackMutations = new Map([
  ['non-main stack trunk', 'stack_trunk'],
  ['requested PR is not a member', 'wrong_member'],
  ['member repository differs', 'wrong_repository'],
  ['member is unmerged', 'unmerged_member'],
  ['merged timeline SHA is missing', 'missing_sha'],
  ['merged timeline repository differs', 'timeline_repository'],
  ['merged commit is disconnected from main', 'disconnected_commit'],
  ['ordinary non-main PR is rejected', 'direct_non_main'],
])
const requiredResolveMutations = new Map([
  ['missing merged timeline event', 'missing_merged'],
  ['merged timeline repository differs', 'resolve_timeline_repository'],
  ['merged commit is disconnected from main', 'resolve_disconnected_commit'],
])
const requiredGitMutations = new Map([
  ['a forced push moves the release tag', 'force_push'],
  ['a delete and re-push moves the release tag', 'delete_then_push'],
])

function object(value, where) { assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${where} must be an object`); return value }
function array(value, where, min) { assert.ok(Array.isArray(value) && value.length >= min, `${where} must contain at least ${min} rows`); return value }
function string(value, where) { assert.ok(typeof value === 'string' && value.length > 0, `${where} must be a non-empty string`); return value }
function keys(value, allowed, where) { object(value, where); assert.deepEqual(Object.keys(value).sort(), [...allowed].sort(), `${where} keys drifted`) }
function named(rows, where) { const names = rows.map((row, index) => string(row.name, `${where}[${index}].name`)); assert.equal(new Set(names).size, names.length, `${where} names must be unique`) }

function validateFixtures(f) {
  keys(f, ['titles', 'tags', 'permissions', 'reviews', 'metadata', 'github', 'workflow', 'git'], 'root')
  for (const kind of ['titles', 'tags']) {
    keys(f[kind], ['valid', 'invalid'], kind); named(array(f[kind].valid, `${kind}.valid`, 3), `${kind}.valid`); named(array(f[kind].invalid, `${kind}.invalid`, kind === 'titles' ? 11 : 8), `${kind}.invalid`)
    for (const row of f[kind].valid) { keys(row, kind === 'titles' ? ['name', 'input', 'version', 'tag'] : ['name', 'input'], `${kind}.valid row`); string(row.input, `${kind}.valid input`) }
    for (const row of f[kind].invalid) { keys(row, ['name', 'input'], `${kind}.invalid row`); string(row.input, `${kind}.invalid input`) }
  }
  keys(f.permissions, ['allowed', 'denied'], 'permissions'); array(f.permissions.allowed, 'permissions.allowed', 2); array(f.permissions.denied, 'permissions.denied', 4)
  named(array(f.reviews, 'reviews', 3), 'reviews'); for (const row of f.reviews) { keys(row, ['name', 'maintainers', 'reviews', 'approved'], 'reviews row'); array(row.maintainers, 'maintainers', 1); array(row.reviews, 'reviews', 1); assert.equal(typeof row.approved, 'boolean'); for (const review of row.reviews) keys(review, ['user', 'state'], 'review') }
  keys(f.metadata, ['valid', 'invalid'], 'metadata'); keys(f.metadata.valid, ['number', 'state', 'merged', 'title', 'user', 'base', 'merge_commit_sha'], 'metadata.valid'); named(array(f.metadata.invalid, 'metadata.invalid', 4), 'metadata.invalid'); for (const row of f.metadata.invalid) { const allowed = row.payload === undefined ? ['name', 'patch'] : ['name', 'payload']; keys(row, allowed, 'metadata.invalid row') }
  keys(f.github, ['resolve', 'malformed_response', 'native_stack', 'pagination'], 'github'); keys(f.github.resolve, ['responses', 'expected_merge_sha', 'expected_paths', 'invalid'], 'github.resolve'); array(f.github.resolve.responses, 'github.resolve.responses', 4); array(f.github.resolve.expected_paths, 'github.resolve.expected_paths', 4)
  named(array(f.github.resolve.invalid, 'github.resolve.invalid', 1), 'github.resolve.invalid')
  const resolveCases = new Map()
  for (const row of f.github.resolve.invalid) { keys(row, ['name', 'mutation'], 'github.resolve.invalid row'); assert.ok([...requiredResolveMutations.values()].includes(row.mutation), `github.resolve.invalid.${row.name} has unknown mutation ${row.mutation}`); resolveCases.set(row.name, row.mutation) }
  for (const [name, mutation] of requiredResolveMutations) assert.equal(resolveCases.get(name), mutation, `github.resolve.invalid must retain required scenario ${name} with mutation ${mutation}`)
  keys(f.github.malformed_response, ['body'], 'github.malformed_response')
  keys(f.github.native_stack, ['valid', 'invalid', 'loader_invalid'], 'github.native_stack'); keys(f.github.native_stack.valid, ['name', 'responses', 'expected_paths', 'expected_merge_sha'], 'github.native_stack.valid'); array(f.github.native_stack.valid.responses, 'github.native_stack.valid.responses', 5); array(f.github.native_stack.valid.expected_paths, 'github.native_stack.valid.expected_paths', 5)
  named(array(f.github.native_stack.invalid, 'github.native_stack.invalid', 1), 'github.native_stack.invalid')
  const nativeStackCases = new Map()
  for (const row of f.github.native_stack.invalid) { keys(row, ['name', 'mutation'], 'github.native_stack.invalid row'); string(row.mutation, `github.native_stack.invalid.${row.name}.mutation`); assert.ok([...requiredNativeStackMutations.values()].includes(row.mutation), `github.native_stack.invalid.${row.name} has unknown mutation ${row.mutation}`); nativeStackCases.set(row.name, row.mutation) }
  for (const [name, mutation] of requiredNativeStackMutations) assert.equal(nativeStackCases.get(name), mutation, `github.native_stack.invalid must retain required scenario ${name} with mutation ${mutation}`)
  named(array(f.github.native_stack.loader_invalid, 'github.native_stack.loader_invalid', 4), 'github.native_stack.loader_invalid')
  for (const row of f.github.native_stack.loader_invalid) { keys(row, ['name', 'operation', 'scenario', 'replacement'], 'github.native_stack.loader_invalid row'); string(row.operation, `github.native_stack.loader_invalid.${row.name}.operation`); string(row.scenario, `github.native_stack.loader_invalid.${row.name}.scenario`); assert.ok(requiredNativeStackMutations.has(row.scenario), `github.native_stack.loader_invalid.${row.name} scenario must name a required case`); assert.ok(['delete', 'replace', 'unknown_dispatch'].includes(row.operation), `github.native_stack.loader_invalid.${row.name} operation is unknown`); if (row.operation === 'delete') assert.equal(row.replacement, null, `github.native_stack.loader_invalid.${row.name}.replacement must be null`); else string(row.replacement, `github.native_stack.loader_invalid.${row.name}.replacement`) }
  named(array(f.github.pagination, 'github.pagination', 2), 'github.pagination')
  for (const row of f.github.pagination) { keys(row, ['name', 'responses', 'approved', 'expected_paths'], 'pagination row'); array(row.responses, 'pagination responses', 3); array(row.expected_paths, 'pagination expected_paths', 3); for (const response of row.responses) keys(response, response.link === undefined ? ['body'] : ['body', 'link'], 'response') }
  keys(f.workflow, ['validate_if', 'tag_if', 'release_needles', 'publish_needles', 'mutations'], 'workflow'); string(f.workflow.validate_if, 'workflow.validate_if'); string(f.workflow.tag_if, 'workflow.tag_if'); array(f.workflow.release_needles, 'workflow.release_needles', 10); array(f.workflow.publish_needles, 'workflow.publish_needles', 2); named(array(f.workflow.mutations, 'workflow.mutations', 3), 'workflow.mutations'); for (const row of f.workflow.mutations) keys(row, ['name', 'target', 'replacement'], 'workflow mutation')
  keys(f.git, ['tag', 'first_message', 'second_message', 'mutations'], 'git'); for (const field of ['tag', 'first_message', 'second_message']) string(f.git[field], `git.${field}`)
  named(array(f.git.mutations, 'git.mutations', 2), 'git.mutations')
  const gitCases = new Map()
  for (const row of f.git.mutations) { keys(row, ['name', 'operation'], 'git.mutations row'); string(row.operation, `git.mutations.${row.name}.operation`); assert.ok([...requiredGitMutations.values()].includes(row.operation), `git.mutations.${row.name} has unknown operation ${row.operation}`); gitCases.set(row.name, row.operation) }
  for (const [name, operation] of requiredGitMutations) assert.equal(gitCases.get(name), operation, `git.mutations must retain required scenario ${name} with operation ${operation}`)
  return f
}

function loadFixtures(source = fs.readFileSync(fixturePath, 'utf8')) {
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length) throw new Error(`fixture YAML invalid: ${document.errors.map((error) => error.message).join('; ')}`)
  if (YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true }).length !== 1) throw new Error('fixture YAML must contain exactly one document')
  return validateFixtures(document.toJS())
}

const fixtures = loadFixtures()
const response = (entry) => ({ ok: true, headers: { get: (name) => name === 'link' ? entry.link ?? null : null }, json: async () => entry.body })

test('fixture loader is strict and rejects unknown keys', () => { assert.throws(() => loadFixtures(`${fs.readFileSync(fixturePath, 'utf8')}\nunknown: true\n`), /keys drifted/) })

test('release title and tag grammar is canonical SemVer', () => {
  for (const row of fixtures.titles.valid) { const parsed = parseReleaseTitle(row.input); assert.equal(parsed.version, row.version, row.name); assert.equal(parsed.tag, row.tag, row.name); assert.equal(titleToFairtradeTag(row.input), row.tag); assert.equal(parseFairtradeTag(row.tag).version, row.version); assert.equal(validatePackageVersion(row.input, row.version), row.version) }
  for (const row of fixtures.titles.invalid) assert.throws(() => parseReleaseTitle(row.input), /expected exactly/, row.name)
  for (const row of fixtures.tags.invalid) assert.throws(() => parseFairtradeTag(row.input), /expected exactly/, row.name)
  assert.throws(() => validatePackageVersion(fixtures.titles.valid[0].input, '9.9.9'), /does not match/)
})

test('maintainer authority and review reduction fail closed', () => {
  for (const value of fixtures.permissions.allowed) assert.equal(isMaintainerPermission(value), true)
  for (const value of fixtures.permissions.denied) assert.equal(isMaintainerPermission(value), false)
  for (const row of fixtures.reviews) assert.equal(reduceLatestReviewApproval(row.reviews, new Set(row.maintainers)), row.approved, row.name)
})

test('merged pull request API metadata is validated', async () => {
  assert.equal(validateMergedPullRequest(fixtures.metadata.valid, 'maintain').tag, 'fairtrade-v0.0.11')
  for (const row of fixtures.metadata.invalid) assert.throws(() => validateMergedPullRequest(row.payload ?? { ...fixtures.metadata.valid, ...row.patch }, 'maintain'), Error, row.name)
  assert.throws(() => validateMergedPullRequest(fixtures.metadata.valid, 'write'), /only admin or maintain/)
  const queue = [...fixtures.github.resolve.responses]; const paths = []
  const client = new GitHubReleaseClient({ token: 'test', repository: 'peasant-labs/fairtrade-design-system', fetchImpl: async (url, options) => { assert.equal(options.headers['x-github-api-version'], '2026-03-10'); paths.push(new URL(url).pathname.replace('/repos/peasant-labs/fairtrade-design-system', '') + new URL(url).search); return response(queue.shift()) } })
  assert.equal((await client.resolveMergedPullRequest(16)).mergeSha, fixtures.github.resolve.expected_merge_sha)
  assert.deepEqual(paths, fixtures.github.resolve.expected_paths)
  for (const row of fixtures.github.resolve.invalid) await assert.rejects(() => runResolve(row.mutation), Error, row.name)
  const malformed = new GitHubReleaseClient({ token: 'test', repository: 'peasant-labs/fairtrade-design-system', fetchImpl: async () => response(fixtures.github.malformed_response) })
  await assert.rejects(() => malformed.resolveMergedPullRequest(16), /user.login/); await assert.rejects(() => malformed.reviews(16), /reviews page 1 must be an array/)
})

function resolveResponses(mutation) {
  const responses = structuredClone(fixtures.github.resolve.responses)
  if (mutation === 'missing_merged') responses[2].body = []
  if (mutation === 'resolve_timeline_repository') responses[2].body[0].commit_url = 'https://api.github.com/repos/other/project/commits/cccccccccccccccccccccccccccccccccccccccc'
  if (mutation === 'resolve_disconnected_commit') { responses[3].body.status = 'diverged'; responses[3].body.merge_base_commit.sha = 'dddddddddddddddddddddddddddddddddddddddd' }
  if (![...requiredResolveMutations.values()].includes(mutation)) throw new Error(`resolve fixture mutation ${mutation} is unknown; add it to the required mutation inventory before using it`)
  return responses
}

function runResolve(mutation) {
  const repository = 'peasant-labs/fairtrade-design-system'
  const queue = [...resolveResponses(mutation)]
  const client = new GitHubReleaseClient({ token: 'test', repository, fetchImpl: async () => response(queue.shift()) })
  return client.resolveMergedPullRequest(16)
}

function nativeStackResponses(mutation) {
  const responses = structuredClone(fixtures.github.native_stack.valid.responses)
  if (mutation === 'stack_trunk') { responses[0].body.stack.base.ref = 'develop'; responses[2].body.base.ref = 'develop' }
  if (mutation === 'wrong_member') responses[2].body.pull_requests[1].number = 80
  if (mutation === 'wrong_repository') responses[2].body.pull_requests[1].head.repo.id = 99
  if (mutation === 'unmerged_member') { responses[2].body.pull_requests[1].state = 'open'; responses[2].body.pull_requests[1].merged_at = null }
  if (mutation === 'missing_sha') responses[3].body[0].commit_id = ''
  if (mutation === 'timeline_repository') responses[3].body[0].commit_url = 'https://api.github.com/repos/other/project/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  if (mutation === 'disconnected_commit') { responses[4].body.status = 'diverged'; responses[4].body.merge_base_commit.sha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }
  if (mutation === 'direct_non_main') { delete responses[0].body.stack; responses.length = 2 }
  if (![...requiredNativeStackMutations.values()].includes(mutation)) throw new Error(`native stack fixture mutation ${mutation} is unknown; add it to the required mutation inventory before using it`)
  return responses
}

test('native stack fixture loader rejects required-case deletion, replacement, and unknown mutations', () => {
  for (const row of fixtures.github.native_stack.loader_invalid) {
    if (row.operation === 'unknown_dispatch') {
      assert.throws(() => nativeStackResponses(row.replacement), /fixture mutation .* is unknown/, row.name)
      continue
    }
    const changed = structuredClone(fixtures)
    const index = changed.github.native_stack.invalid.findIndex((scenario) => scenario.name === row.scenario)
    assert.notEqual(index, -1, row.name)
    if (row.operation === 'delete') changed.github.native_stack.invalid.splice(index, 1)
    else changed.github.native_stack.invalid[index].mutation = row.replacement
    assert.throws(() => loadFixtures(YAML.stringify(changed)), /must retain required scenario|unknown mutation/, row.name)
  }
})

test('canonical native stack metadata resolves the merged release commit and fails closed', async () => {
  const repository = 'peasant-labs/fairtrade-design-system'
  const run = async (responses, paths = []) => {
    const queue = [...responses]
    const client = new GitHubReleaseClient({ token: 'test', repository, fetchImpl: async (url, options) => { assert.equal(options.headers['x-github-api-version'], '2026-03-10'); paths.push(new URL(url).pathname.replace(`/repos/${repository}`, '') + new URL(url).search); return response(queue.shift()) } })
    return client.resolveMergedPullRequest(78)
  }
  const paths = []
  assert.equal((await run(fixtures.github.native_stack.valid.responses, paths)).mergeSha, fixtures.github.native_stack.valid.expected_merge_sha)
  assert.deepEqual(paths, fixtures.github.native_stack.valid.expected_paths)
  for (const row of fixtures.github.native_stack.invalid) await assert.rejects(() => run(nativeStackResponses(row.mutation)), Error, row.name)
})

test('paginated latest review state wins in API order', async () => {
  for (const scenario of fixtures.github.pagination) {
    const queue = [...scenario.responses]; const paths = []
    const client = new GitHubReleaseClient({ token: 'test', repository: 'peasant-labs/fairtrade-design-system', fetchImpl: async (url) => { paths.push(new URL(url).pathname.replace('/repos/peasant-labs/fairtrade-design-system', '') + new URL(url).search); return response(queue.shift()) } })
    assert.equal(await client.hasMaintainerApproval(16), scenario.approved, scenario.name); assert.deepEqual(paths, scenario.expected_paths, scenario.name)
  }
})

function normalizeIf(value) { return value.replace(/\s+/g, ' ').trim() }
function assertWorkflowContract(release, publish, releaseText, publishText) {
  const trigger = release.on ?? release.true; assert.deepEqual(trigger.pull_request.types, ['opened', 'edited', 'synchronize', 'reopened', 'closed']); assert.deepEqual(trigger.pull_request.branches, ['main'])
  assert.deepEqual(Object.keys(trigger.workflow_dispatch.inputs), ['pr_number']); assert.deepEqual(trigger.workflow_dispatch.inputs.pr_number, { description: 'Already-merged release PR number to retry', required: true, type: 'number' })
  assert.deepEqual(release.permissions, { contents: 'read', 'pull-requests': 'read' }); assert.equal(normalizeIf(release.jobs.validate.if), fixtures.workflow.validate_if); assert.equal(normalizeIf(release.jobs.tag.if), fixtures.workflow.tag_if)
  for (const needle of fixtures.workflow.release_needles) assert.ok(releaseText.includes(needle), `missing release workflow contract: ${needle}`)
  assert.doesNotMatch(releaseText, /git (?:push|tag)[^\n]*(?:--force|-f\b)/)
  const publishTrigger = publish.on ?? publish.true; assert.deepEqual(publishTrigger.push.tags, ['fairtrade-v*']); assert.equal(publish.jobs['npm-publish'].environment, 'npm-publish'); assert.equal(publish.jobs['npm-publish'].permissions['id-token'], 'write')
  for (const needle of fixtures.workflow.publish_needles) assert.ok(publishText.includes(needle), `missing publish workflow contract: ${needle}`)
}

test('workflow control flow and release invariants are exact and mutation-proven', () => {
  const releaseText = fs.readFileSync(path.join(root, '.github/workflows/release-pr.yml'), 'utf8'); const publishText = fs.readFileSync(path.join(root, '.github/workflows/npm-publish.yml'), 'utf8'); const release = YAML.parse(releaseText); const publish = YAML.parse(publishText)
  assertWorkflowContract(release, publish, releaseText, publishText)
  for (const mutation of fixtures.workflow.mutations) { const changed = structuredClone(release); changed.jobs[mutation.target === 'tag_if' ? 'tag' : 'validate'].if = mutation.replacement; assert.throws(() => assertWorkflowContract(changed, publish, YAML.stringify(changed), publishText), { name: 'AssertionError' }, mutation.name) }
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
 * Move the remote tag without force, the exact command the release workflow runs.
 * @param {{ remote: string, work: string }} pair the seeded pair
 * @param {Record<string, string>} env the substituted environment
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
    }
    assert.equal(gitOk(pair.work, env, ['config', '--get', 'user.signingKey']).stdout.trim(), '', 'the scratch repository must carry no signing key at step "release tag scratch repository"; repair: keep the empty user.signingKey in the NO_SIGNING per-command opt-out so no key material is required.')
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
      const secondCommit = retagReleaseTag(pair, env)
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
