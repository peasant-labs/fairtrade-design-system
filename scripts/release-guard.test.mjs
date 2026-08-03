import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import YAML from 'yaml'
import {
  GitHubReleaseClient, isMaintainerPermission, parseFairtradeTag, parseReleaseTitle,
  reduceLatestReviewApproval, titleToFairtradeTag, validateMergedPullRequest, validatePackageVersion,
} from './release-guard.mjs'

const root = path.resolve(import.meta.dirname, '..')
const fixtures = YAML.parse(fs.readFileSync(path.join(import.meta.dirname, 'testdata/release-guard.yaml'), 'utf8'))

test('fixture corpus has required coverage', () => {
  assert.ok(fixtures.titles.valid.length >= 2 && fixtures.titles.invalid.length >= 6)
  assert.ok(fixtures.metadata.invalid.length >= 4 && fixtures.reviews.length >= 3)
})

test('release title and tag grammar is exact', () => {
  for (const row of fixtures.titles.valid) {
    const parsed = parseReleaseTitle(row.input)
    assert.equal(parsed.version, row.version); assert.equal(parsed.tag, row.tag)
    assert.equal(titleToFairtradeTag(row.input), row.tag); assert.equal(parseFairtradeTag(row.tag).version, row.version)
    assert.equal(validatePackageVersion(row.input, row.version), row.version)
  }
  for (const input of fixtures.titles.invalid) assert.throws(() => parseReleaseTitle(input), /expected exactly/)
  for (const input of fixtures.tags.invalid) assert.throws(() => parseFairtradeTag(input), /expected exactly/)
  assert.throws(() => validatePackageVersion(fixtures.titles.valid[0].input, '9.9.9'), /does not match/)
})

test('maintainer authority and latest review reduction fail closed', () => {
  for (const value of fixtures.permissions.allowed) assert.equal(isMaintainerPermission(value), true)
  for (const value of fixtures.permissions.denied) assert.equal(isMaintainerPermission(value), false)
  for (const row of fixtures.reviews) assert.equal(reduceLatestReviewApproval(row.reviews, new Set(row.maintainers)), row.approved, row.name)
})

test('merged pull request metadata is validated at the API boundary', async () => {
  const valid = fixtures.metadata.valid
  assert.equal(validateMergedPullRequest(valid, 'maintain').tag, 'fairtrade-v0.0.11')
  for (const row of fixtures.metadata.invalid) {
    const payload = row.payload ?? { ...valid, ...row.patch }
    assert.throws(() => validateMergedPullRequest(payload, 'maintain'), Error, row.name)
  }
  assert.throws(() => validateMergedPullRequest(valid, 'write'), /only admin or maintain/)
  const responses = [valid, { permission: 'admin' }]
  const client = new GitHubReleaseClient({ token: 'test', repository: 'peasant-labs/fairtrade-design-system', fetchImpl: async () => ({ ok: true, json: async () => responses.shift() }) })
  assert.equal((await client.resolveMergedPullRequest(16)).mergeSha, 'abc123')
  const malformed = new GitHubReleaseClient({ token: 'test', repository: 'peasant-labs/fairtrade-design-system', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) })
  await assert.rejects(() => malformed.resolveMergedPullRequest(16), /user.login/)
  await assert.rejects(() => malformed.reviews(16), /reviews must be an array/)
})

test('GitHub client applies the latest-review maintainer approval reduction', async () => {
  const responses = [
    [{ user: { login: 'alice' }, state: 'APPROVED' }, { user: { login: 'bob' }, state: 'APPROVED' }],
    { permission: 'maintain' }, { permission: 'write' },
  ]
  const client = new GitHubReleaseClient({ token: 'test', repository: 'peasant-labs/fairtrade-design-system', fetchImpl: async () => ({ ok: true, json: async () => responses.shift() }) })
  assert.equal(await client.hasMaintainerApproval(16), true)
})

test('release workflows preserve the release and OIDC contracts', () => {
  const releaseText = fs.readFileSync(path.join(root, '.github/workflows/release-pr.yml'), 'utf8')
  const publishText = fs.readFileSync(path.join(root, '.github/workflows/npm-publish.yml'), 'utf8')
  const release = YAML.parse(releaseText)
  const publish = YAML.parse(publishText)
  const trigger = release.on ?? release.true
  assert.deepEqual(trigger.pull_request.types, ['opened', 'edited', 'synchronize', 'reopened', 'closed'])
  assert.deepEqual(trigger.pull_request.branches, ['main'])
  assert.deepEqual(Object.keys(trigger.workflow_dispatch.inputs), ['pr_number'])
  assert.equal(trigger.workflow_dispatch.inputs.pr_number.type, 'number')
  assert.deepEqual(release.permissions, { contents: 'read', 'pull-requests': 'read' })
  for (const needle of ['inputs.pr_number', 'PEASANT_RELEASER_APP_ID', 'PEASANT_RELEASER_APP_PRIVATE_KEY', 'owner: peasant-labs', 'repositories: fairtrade-design-system', 'actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1', 'ref: ${{ steps.release.outputs.mergeSha }}', 'git tag -a "$TAG" "$MERGE_SHA" -m "$PR_TITLE"', 'git rev-parse -q --verify', 'git ls-remote --exit-code --tags']) assert.match(releaseText, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(releaseText, /git (?:push|tag)[^\n]*(?:--force|-f\b)/)
  const publishTrigger = publish.on ?? publish.true
  assert.deepEqual(publishTrigger.push.tags, ['fairtrade-v*'])
  assert.equal(publish.jobs['npm-publish'].environment, 'npm-publish')
  assert.equal(publish.jobs['npm-publish'].permissions['id-token'], 'write')
  assert.match(publishText, /npm publish --access public/)
})

test('an annotated remote tag cannot be moved by a second non-force push', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fairtrade-release-guard-'))
  const remote = path.join(dir, 'remote.git'); const work = path.join(dir, 'work')
  execFileSync('git', ['init', '--bare', remote]); execFileSync('git', ['init', work])
  const git = (...args) => execFileSync('git', ['-C', work, ...args], { stdio: 'pipe' })
  git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.invalid'); git('remote', 'add', 'origin', remote)
  fs.writeFileSync(path.join(work, 'file'), 'one'); git('add', 'file'); git('commit', '-m', 'one')
  git('tag', '-a', fixtures.git.tag, '-m', fixtures.git.first_message); git('push', 'origin', `refs/tags/${fixtures.git.tag}`)
  const first = execFileSync('git', ['--git-dir', remote, 'rev-parse', `${fixtures.git.tag}^{}`], { encoding: 'utf8' }).trim()
  fs.writeFileSync(path.join(work, 'file'), 'two'); git('commit', '-am', 'two'); git('tag', '-d', fixtures.git.tag); git('tag', '-a', fixtures.git.tag, '-m', fixtures.git.second_message)
  const result = spawnSync('git', ['-C', work, 'push', 'origin', `refs/tags/${fixtures.git.tag}`], { encoding: 'utf8' })
  assert.notEqual(result.status, 0); assert.equal(execFileSync('git', ['--git-dir', remote, 'rev-parse', `${fixtures.git.tag}^{}`], { encoding: 'utf8' }).trim(), first)
})
