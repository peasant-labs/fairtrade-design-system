import fs from 'node:fs'

const TITLE = /^release\((v\d+\.\d+\.\d+(?:-rc\d+)?)\): (\S.*)$/
const TAG = /^fairtrade-(v\d+\.\d+\.\d+(?:-rc\d+)?)$/
const ALLOWED_PERMISSIONS = new Set(['admin', 'maintain'])

export function parseReleaseTitle(title) {
  if (typeof title !== 'string') throw new Error('Release title validation failed: the title was not a string. Use release(vX.Y.Z[-rcN]): subject.')
  const match = TITLE.exec(title)
  if (!match) throw new Error(`Release title validation failed for ${JSON.stringify(title)}: expected exactly release(vX.Y.Z[-rcN]): subject with a non-empty subject. Edit the PR title and retry.`)
  return { version: match[1].slice(1), versionWithV: match[1], subject: match[2], tag: `fairtrade-${match[1]}` }
}

export function parseFairtradeTag(tag) {
  if (typeof tag !== 'string') throw new Error('Release tag validation failed: the tag was not a string. Use fairtrade-vX.Y.Z[-rcN].')
  const match = TAG.exec(tag)
  if (!match) throw new Error(`Release tag validation failed for ${JSON.stringify(tag)}: expected exactly fairtrade-vX.Y.Z[-rcN]. Use the tag derived from the release PR title.`)
  return { version: match[1].slice(1), versionWithV: match[1], tag }
}

export function titleToFairtradeTag(title) { return parseReleaseTitle(title).tag }

export function validatePackageVersion(titleOrVersion, packageVersion) {
  const expected = titleOrVersion.startsWith?.('release(') ? parseReleaseTitle(titleOrVersion).version : titleOrVersion.replace(/^v/, '')
  if (typeof packageVersion !== 'string' || packageVersion !== expected) throw new Error(`Package version validation failed: release version ${expected} does not match package.json version ${packageVersion}. Update package.json in the release PR or correct its title.`)
  return expected
}

export function isMaintainerPermission(permission) { return ALLOWED_PERMISSIONS.has(permission) }
export function requireMaintainerPermission(permission, login = 'PR author') {
  if (!isMaintainerPermission(permission)) throw new Error(`Release authority validation failed for ${login}: repository permission is ${JSON.stringify(permission)}, but only admin or maintain may cut a release. Ask a maintainer to author the release PR.`)
  return permission
}

export function reduceLatestReviewApproval(reviews, maintainerLogins) {
  if (!Array.isArray(reviews) || !(maintainerLogins instanceof Set)) throw new Error('Review approval reduction failed: reviews must be an array and maintainerLogins must be a Set. Validate GitHub responses before reducing reviews.')
  const latest = new Map()
  for (const review of reviews) {
    if (maintainerLogins.has(review.user) && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) latest.set(review.user, review.state)
  }
  return [...latest.values()].some((state) => state === 'APPROVED')
}

function nonEmptyString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`GitHub API response validation failed: ${field} must be a non-empty string. The release cannot be tagged; inspect the pull request metadata and retry.`)
  return value
}

export function validateMergedPullRequest(payload, permission) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('GitHub API response validation failed: pull request metadata must be an object. The release cannot be tagged; retry after GitHub API recovers.')
  const number = payload.number
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error('GitHub API response validation failed: pull request number must be a positive integer. Supply an already-merged PR number.')
  if (payload.merged !== true || payload.state !== 'closed') throw new Error(`Merged release validation failed for PR #${number}: the pull request is not merged. Merge it into main before retrying.`)
  if (payload.base?.ref !== 'main') throw new Error(`Merged release validation failed for PR #${number}: base is ${JSON.stringify(payload.base?.ref)}, not main. Only releases merged to main may be tagged.`)
  const title = nonEmptyString(payload.title, 'title')
  const login = nonEmptyString(payload.user?.login, 'user.login')
  const mergeSha = nonEmptyString(payload.merge_commit_sha, 'merge_commit_sha')
  requireMaintainerPermission(permission, login)
  return { number, title, login, mergeSha, ...parseReleaseTitle(title) }
}

export class GitHubReleaseClient {
  constructor({ token, repository = process.env.GITHUB_REPOSITORY, fetchImpl = globalThis.fetch } = {}) {
    if (!token) throw new Error('GitHub client setup failed: no token was provided. Set GH_TOKEN to the read-only workflow token and retry.')
    if (!/^[-\w]+\/[-.\w]+$/.test(repository ?? '')) throw new Error('GitHub client setup failed: GITHUB_REPOSITORY must be owner/repository. Run this command in GitHub Actions or provide a valid repository.')
    this.token = token; this.repository = repository; this.fetchImpl = fetchImpl
  }
  async get(path) {
    const response = await this.fetchImpl(`https://api.github.com/repos/${this.repository}${path}`, { headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${this.token}`, 'x-github-api-version': '2022-11-28' } })
    if (!response?.ok) throw new Error(`GitHub API request failed for ${path} with status ${response?.status ?? 'unknown'}. Check token permissions and GitHub availability, then retry.`)
    try { return await response.json() } catch (error) { throw new Error(`GitHub API response parsing failed for ${path}: ${error.message}. Retry after GitHub API returns valid JSON.`) }
  }
  async permission(login) {
    const payload = await this.get(`/collaborators/${encodeURIComponent(login)}/permission`)
    return nonEmptyString(payload?.permission, 'permission')
  }
  async pullRequest(number) { return this.get(`/pulls/${number}`) }
  async reviews(number) {
    const payload = await this.get(`/pulls/${number}/reviews?per_page=100`)
    if (!Array.isArray(payload)) throw new Error('GitHub API response validation failed: pull request reviews must be an array. Approval cannot be established; inspect the API response and retry.')
    return payload.map((review, index) => ({
      user: nonEmptyString(review?.user?.login, `reviews[${index}].user.login`),
      state: nonEmptyString(review?.state, `reviews[${index}].state`),
    }))
  }
  async hasMaintainerApproval(number) {
    const reviews = await this.reviews(number)
    const maintainers = new Set()
    for (const login of new Set(reviews.map((review) => review.user))) if (isMaintainerPermission(await this.permission(login))) maintainers.add(login)
    return reduceLatestReviewApproval(reviews, maintainers)
  }
  async resolveMergedPullRequest(number) {
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error('Dispatch input validation failed: pr_number must be a positive integer identifying an already-merged PR.')
    const payload = await this.pullRequest(number)
    const login = nonEmptyString(payload?.user?.login, 'user.login')
    return validateMergedPullRequest(payload, await this.permission(login))
  }
}

function output(values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n'
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines); else process.stdout.write(lines)
}

async function cli(argv) {
  const [command, ...args] = argv
  if (command === 'parse-title') return output(parseReleaseTitle(args.join(' ')))
  if (command === 'check-package') {
    const parsed = parseReleaseTitle(process.env.PR_TITLE ?? '')
    const pkg = JSON.parse(fs.readFileSync(args[0] ?? 'package.json', 'utf8'))
    validatePackageVersion(parsed.version, pkg.version); return output(parsed)
  }
  const client = new GitHubReleaseClient({ token: process.env.GH_TOKEN })
  if (command === 'check-open') {
    const parsed = parseReleaseTitle(process.env.PR_TITLE ?? '')
    requireMaintainerPermission(await client.permission(process.env.PR_AUTHOR), process.env.PR_AUTHOR)
    const pkg = JSON.parse(fs.readFileSync(args[0] ?? 'package.json', 'utf8'))
    validatePackageVersion(parsed.version, pkg.version); return output(parsed)
  }
  if (command === 'resolve-pr') return output(await client.resolveMergedPullRequest(Number(args[0])))
  if (command === 'check-approval') {
    const number = Number(args[0])
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error('Approval input validation failed: PR number must be a positive integer. Pass the merged release PR number.')
    if (!await client.hasMaintainerApproval(number)) throw new Error(`Release approval validation failed for PR #${number}: no maintainer's latest review is APPROVED. Obtain a current approval from an admin or maintainer and retry.`)
    return output({ approved: true })
  }
  throw new Error('Release guard command failed: expected parse-title, check-package, check-open, resolve-pr, or check-approval. Use a supported workflow command.')
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) cli(process.argv.slice(2)).catch((error) => { console.error(`::error::${error.message}`); process.exitCode = 1 })
