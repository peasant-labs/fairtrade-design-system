import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import YAML from 'yaml'
import { GitHubReleaseClient, isMaintainerPermission, parseFairtradeTag, parseReleaseTitle, reduceLatestReviewApproval, titleToFairtradeTag, validateMergedPullRequest, validatePackageVersion } from './release-guard.mjs'

const root = path.resolve(import.meta.dirname, '..')
const fixturePath = path.join(import.meta.dirname, 'testdata/release-guard.yaml')

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
  keys(f.github, ['resolve', 'malformed_response', 'pagination'], 'github'); keys(f.github.resolve, ['responses', 'expected_merge_sha'], 'github.resolve'); array(f.github.resolve.responses, 'github.resolve.responses', 2); keys(f.github.malformed_response, ['body'], 'github.malformed_response'); named(array(f.github.pagination, 'github.pagination', 2), 'github.pagination')
  for (const row of f.github.pagination) { keys(row, ['name', 'responses', 'approved', 'expected_paths'], 'pagination row'); array(row.responses, 'pagination responses', 3); array(row.expected_paths, 'pagination expected_paths', 3); for (const response of row.responses) keys(response, response.link === undefined ? ['body'] : ['body', 'link'], 'response') }
  keys(f.workflow, ['validate_if', 'tag_if', 'release_needles', 'publish_needles', 'mutations'], 'workflow'); string(f.workflow.validate_if, 'workflow.validate_if'); string(f.workflow.tag_if, 'workflow.tag_if'); array(f.workflow.release_needles, 'workflow.release_needles', 10); array(f.workflow.publish_needles, 'workflow.publish_needles', 2); named(array(f.workflow.mutations, 'workflow.mutations', 3), 'workflow.mutations'); for (const row of f.workflow.mutations) keys(row, ['name', 'target', 'replacement'], 'workflow mutation')
  keys(f.git, ['tag', 'first_message', 'second_message'], 'git')
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
  const queue = [...fixtures.github.resolve.responses]; const client = new GitHubReleaseClient({ token: 'test', repository: 'peasant-labs/fairtrade-design-system', fetchImpl: async () => response(queue.shift()) })
  assert.equal((await client.resolveMergedPullRequest(16)).mergeSha, fixtures.github.resolve.expected_merge_sha)
  const malformed = new GitHubReleaseClient({ token: 'test', repository: 'peasant-labs/fairtrade-design-system', fetchImpl: async () => response(fixtures.github.malformed_response) })
  await assert.rejects(() => malformed.resolveMergedPullRequest(16), /user.login/); await assert.rejects(() => malformed.reviews(16), /reviews page 1 must be an array/)
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

test('an annotated remote tag cannot be moved by a second non-force push', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fairtrade-release-guard-')); const remote = path.join(dir, 'remote.git'); const work = path.join(dir, 'work'); execFileSync('git', ['init', '--bare', remote]); execFileSync('git', ['init', work]); const git = (...args) => execFileSync('git', ['-C', work, ...args], { stdio: 'pipe' })
  git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.invalid'); git('remote', 'add', 'origin', remote); fs.writeFileSync(path.join(work, 'file'), 'one'); git('add', 'file'); git('commit', '-m', 'one'); git('tag', '-a', fixtures.git.tag, '-m', fixtures.git.first_message); git('push', 'origin', `refs/tags/${fixtures.git.tag}`)
  const first = execFileSync('git', ['--git-dir', remote, 'rev-parse', `${fixtures.git.tag}^{}`], { encoding: 'utf8' }).trim(); fs.writeFileSync(path.join(work, 'file'), 'two'); git('commit', '-am', 'two'); git('tag', '-d', fixtures.git.tag); git('tag', '-a', fixtures.git.tag, '-m', fixtures.git.second_message)
  assert.notEqual(spawnSync('git', ['-C', work, 'push', 'origin', `refs/tags/${fixtures.git.tag}`]).status, 0); assert.equal(execFileSync('git', ['--git-dir', remote, 'rev-parse', `${fixtures.git.tag}^{}`], { encoding: 'utf8' }).trim(), first)
})
