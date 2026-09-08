import fs from 'node:fs'

const CORE_NUMBER = '(?:0|[1-9][0-9]*)'
const VERSION_GRAMMAR = `v${CORE_NUMBER}\\.${CORE_NUMBER}\\.${CORE_NUMBER}(?:-rc[1-9][0-9]*)?`
const TITLE = new RegExp(`^release\\((${VERSION_GRAMMAR})\\): (\\S.*)$`)
const TAG = new RegExp(`^fairtrade-(${VERSION_GRAMMAR})$`)
const ALLOWED_PERMISSIONS = new Set(['admin', 'maintain'])
const MAX_REVIEW_PAGES = 10
const GITHUB_API_VERSION = '2026-03-10'
const SHA = /^[0-9a-f]{40}$/

export function parseReleaseTitle(title) {
  if (typeof title !== 'string') throw new Error('Release title validation failed: the title was not a string. Use release(vX.Y.Z[-rcN]): subject.')
  const match = TITLE.exec(title)
  if (!match) throw new Error(`Release title validation failed for ${JSON.stringify(title)}: expected exactly release(vX.Y.Z[-rcN]): subject with a non-empty subject. Edit the PR title and retry.`)
  return { version: match[1].slice(1), versionWithV: match[1], subject: match[2], tag: `fairtrade-${match[1]}` }
}

// kind classifies the tag for the release.yml GitHub Release job: "rc" gets
// --prerelease, "final" gets --latest. Derived once here (the tested source),
// never re-derived by a shell substring match in the workflow.
export function releaseKind(version) { return version.includes('-rc') ? 'rc' : 'final' }

export function parseFairtradeTag(tag) {
  if (typeof tag !== 'string') throw new Error('Release tag validation failed: the tag was not a string. Use fairtrade-vX.Y.Z[-rcN].')
  const match = TAG.exec(tag)
  if (!match) throw new Error(`Release tag validation failed for ${JSON.stringify(tag)}: expected exactly fairtrade-vX.Y.Z[-rcN]. Use the tag derived from the release PR title.`)
  const version = match[1].slice(1)
  return { version, versionWithV: match[1], tag, kind: releaseKind(version) }
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

function requireRepository(payload, repository) {
  const fullName = nonEmptyString(payload?.base?.repo?.full_name, 'base.repo.full_name')
  if (fullName.toLowerCase() !== repository.toLowerCase() || payload?.head?.repo?.id !== payload?.base?.repo?.id) throw new Error(`Native stack release validation failed for PR #${payload?.number}: the pull request repositories do not match ${repository}. Move the release into a native stack in the release repository and retry.`)
  return payload.base.repo.id
}

export function validateNativeStack(payload, stack, repository) {
  const number = payload?.number
  if (!Number.isSafeInteger(payload?.stack?.number) || payload.stack.number <= 0) throw new Error(`Native stack release validation failed for PR #${number}: stack.number must identify a canonical GitHub stack. Recreate the native stack and retry.`)
  if (!stack || typeof stack !== 'object' || Array.isArray(stack) || stack.number !== payload.stack.number) throw new Error(`Native stack release validation failed for PR #${number}: GitHub returned mismatched stack metadata. Inspect the stack and retry.`)
  if (stack.base?.ref !== 'main' || payload.stack.base?.ref !== 'main') throw new Error(`Native stack release validation failed for PR #${number}: the stack trunk is not main. Only a native stack targeting main may cut a release.`)
  if (stack.open !== false) throw new Error(`Native stack release validation failed for PR #${number}: the stack is still open. Merge the stack into main before retrying.`)
  const repositoryId = requireRepository(payload, repository)
  if (!Array.isArray(stack.pull_requests)) throw new Error(`Native stack release validation failed for PR #${number}: pull_requests must be an array. The release cannot be tagged; inspect GitHub's stack response and retry.`)
  const members = stack.pull_requests.filter((member) => member?.number === number)
  if (members.length !== 1) throw new Error(`Native stack release validation failed for PR #${number}: the requested pull request is not exactly one member of stack #${stack.number}. Repair the stack membership and retry.`)
  const member = members[0]
  if (member.state !== 'closed' || typeof member.merged_at !== 'string' || member.merged_at.length === 0) throw new Error(`Native stack release validation failed for PR #${number}: the stack member is not recorded as merged. Wait for the asynchronous stack merge to finish and retry.`)
  if (member.head?.repo?.id !== repositoryId || member.base?.repo?.id !== repositoryId) throw new Error(`Native stack release validation failed for PR #${number}: the stack member belongs to a different repository. Recreate the stack in ${repository} and retry.`)
  return stack.number
}

export function resolveMergedTimelineSha(number, timeline, repository) {
  if (!Array.isArray(timeline)) throw new Error(`Native stack release validation failed for PR #${number}: the issue timeline must be an array. The release cannot be tagged; retry after GitHub API recovers.`)
  const merged = timeline.filter((event) => event?.event === 'merged')
  if (merged.length !== 1) throw new Error(`Native stack release validation failed for PR #${number}: expected exactly one canonical merged timeline event, found ${merged.length}. Inspect the pull request timeline and retry.`)
  const mergeSha = nonEmptyString(merged[0].commit_id, 'merged timeline commit_id')
  const expectedURL = `https://api.github.com/repos/${repository}/commits/${mergeSha}`
  if (!SHA.test(mergeSha) || merged[0].commit_url !== expectedURL) throw new Error(`Native stack release validation failed for PR #${number}: the merged timeline commit is not a canonical commit in ${repository}. Inspect the pull request timeline and retry.`)
  return mergeSha
}

export function validateMainReachability(number, mergeSha, comparison) {
  if (!comparison || typeof comparison !== 'object' || Array.isArray(comparison) || !['ahead', 'identical'].includes(comparison.status) || comparison.merge_base_commit?.sha !== mergeSha) throw new Error(`Merged release validation failed for PR #${number}: merge SHA ${mergeSha} is not proven reachable from main. Wait for the asynchronous merge to land on main, then retry.`)
  return mergeSha
}

export class GitHubReleaseClient {
  constructor({ token, repository = process.env.GITHUB_REPOSITORY, fetchImpl = globalThis.fetch } = {}) {
    if (!token) throw new Error('GitHub client setup failed: no token was provided. Set GH_TOKEN to the read-only workflow token and retry.')
    if (!/^[-\w]+\/[-.\w]+$/.test(repository ?? '')) throw new Error('GitHub client setup failed: GITHUB_REPOSITORY must be owner/repository. Run this command in GitHub Actions or provide a valid repository.')
    this.token = token; this.repository = repository; this.fetchImpl = fetchImpl
  }
  async getResponse(path) {
    const response = await this.fetchImpl(`https://api.github.com/repos/${this.repository}${path}`, { headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${this.token}`, 'x-github-api-version': GITHUB_API_VERSION } })
    if (!response?.ok) throw new Error(`GitHub API request failed for ${path} with status ${response?.status ?? 'unknown'}. Check token permissions and GitHub availability, then retry.`)
    try { return { payload: await response.json(), link: response.headers?.get?.('link') ?? null } } catch (error) { throw new Error(`GitHub API response parsing failed for ${path}: ${error.message}. Retry after GitHub API returns valid JSON.`) }
  }
  async get(path) { return (await this.getResponse(path)).payload }
  async permission(login) {
    const payload = await this.get(`/collaborators/${encodeURIComponent(login)}/permission`)
    return nonEmptyString(payload?.permission, 'permission')
  }
  async pullRequest(number) { return this.get(`/pulls/${number}`) }
  async stack(number) { return this.get(`/stacks/${number}`) }
  async timeline(number) { return this.get(`/issues/${number}/timeline?per_page=100`) }
  async comparison(mergeSha) { return this.get(`/compare/${mergeSha}...main`) }
  async reviews(number) {
    let path = `/pulls/${number}/reviews?per_page=100`
    const seen = new Set(); const reviews = []
    for (let page = 1; page <= MAX_REVIEW_PAGES; page += 1) {
      if (seen.has(path)) throw new Error(`GitHub review pagination failed for PR #${number}: next link forms a cycle at ${path}. Approval cannot be trusted; inspect GitHub's Link header and retry.`)
      seen.add(path)
      const { payload, link } = await this.getResponse(path)
      if (!Array.isArray(payload)) throw new Error(`GitHub API response validation failed: pull request reviews page ${page} must be an array. Approval cannot be established; inspect the API response and retry.`)
      reviews.push(...payload.map((review, index) => ({ user: nonEmptyString(review?.user?.login, `reviews page ${page}[${index}].user.login`), state: nonEmptyString(review?.state, `reviews page ${page}[${index}].state`) })))
      if (!link) return reviews
      const nextMatches = [...link.matchAll(/<([^>]+)>;\s*rel="next"/g)]
      if (nextMatches.length !== 1) throw new Error(`GitHub review pagination failed for PR #${number}: Link header must contain exactly one valid rel="next" URL. Approval cannot be trusted; retry after GitHub returns valid pagination.`)
      const next = new URL(nextMatches[0][1])
      const prefix = `/repos/${this.repository}`
      if (next.origin !== 'https://api.github.com' || !next.pathname.startsWith(`${prefix}/pulls/${number}/reviews`)) throw new Error(`GitHub review pagination failed for PR #${number}: next link points outside the expected reviews endpoint. Approval cannot be trusted; inspect the Link header.`)
      path = `${next.pathname.slice(prefix.length)}${next.search}`
    }
    throw new Error(`GitHub review pagination failed for PR #${number}: exceeded the ${MAX_REVIEW_PAGES}-page safety bound. Reduce review history or raise the audited bound before enabling approval enforcement.`)
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
    const permission = await this.permission(login)
    if (payload?.base?.ref === 'main') return validateMergedPullRequest(payload, permission)
    if (!payload?.stack) return validateMergedPullRequest(payload, permission)
    validateNativeStack(payload, await this.stack(payload.stack.number), this.repository)
    const mergeSha = resolveMergedTimelineSha(number, await this.timeline(number), this.repository)
    validateMainReachability(number, mergeSha, await this.comparison(mergeSha))
    return validateMergedPullRequest({ ...payload, base: { ...payload.base, ref: 'main' }, merge_commit_sha: mergeSha }, permission)
  }
}

function output(values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n'
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines); else process.stdout.write(lines)
}

async function cli(argv) {
  const [command, ...args] = argv
  if (command === 'parse-title') return output(parseReleaseTitle(args.join(' ')))
  if (command === 'parse-tag') return output(parseFairtradeTag(args[0] ?? process.env.TAG ?? ''))
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
  throw new Error('Release guard command failed: expected parse-title, parse-tag, check-package, check-open, resolve-pr, or check-approval. Use a supported workflow command.')
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) cli(process.argv.slice(2)).catch((error) => { console.error(`::error::${error.message}`); process.exitCode = 1 })
