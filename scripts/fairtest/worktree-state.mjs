// @ts-check

// The one resolver for the worktree identity Fairtest provenance records.
//
// A mounted row must name the commit its built tree came from. Locally that is
// `git rev-parse HEAD` plus `git status --porcelain`; refusing to guess is
// correct because a row run outside a worktree cannot prove what it tested.
//
// In GitHub Actions the checkout already identifies the tree: GITHUB_SHA is the
// exact commit actions/checkout materialized. A fallback container can lose the
// repository metadata before the first gate, so CI resolves the same identity
// from GITHUB_SHA instead of failing the whole evidence run. The fallback is
// CI-only and requires a full 40-character SHA; a missing or malformed value is
// refused so a broken environment cannot silently record an unknown commit as
// clean.

import { execFileSync } from 'node:child_process'

const COMMIT_SHA_RE = /^[0-9a-f]{40}$/

/**
 * @typedef {object} WorktreeState
 * @property {string} commit the integration commit
 * @property {boolean} dirty whether the worktree had uncommitted changes
 * @property {'git' | 'github-sha'} source where the identity came from
 */

/**
 * @typedef {(file: string, args: string[], options: { encoding: 'utf8', cwd: string }) => string} ExecUtf8
 */

/**
 * Read the integration commit and dirty state for a built tree.
 * @param {{ label?: string, cwd?: string, env?: Record<string, string | undefined>, exec?: ExecUtf8 }} [options]
 * @returns {WorktreeState} resolved worktree state
 */
export function readWorktreeState({
  label = 'fairtest producer',
  cwd = process.cwd(),
  env = process.env,
  exec = (file, args, options) => /** @type {string} */ (execFileSync(file, args, options)),
} = {}) {
  /** @type {string | null} */
  let commit = null
  /** @type {unknown} */
  let gitError = null
  try {
    commit = exec('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd }).trim()
  } catch (error) {
    commit = null
    gitError = error
  }

  // Git ran and answered: trust the answer or refuse it, but never replace a
  // malformed answer with a different identity.
  if (commit !== null) {
    if (!COMMIT_SHA_RE.test(commit)) {
      throw new Error(
        `${label}: cannot read the integration commit for field "commit" at path provenance.commit; ` +
        `git rev-parse HEAD returned ${JSON.stringify(commit)}, not a full commit SHA; ` +
        'repair: run the mounted row inside a healthy fairtrade worktree, or remove the broken repository metadata.',
      )
    }
    let dirty = true
    try {
      dirty = exec('git', ['status', '--porcelain'], { encoding: 'utf8', cwd }).trim().length > 0
    } catch {
      dirty = true
    }
    return { commit, dirty, source: 'git' }
  }

  // Git could not run at all. GitHub Actions already identifies the checkout,
  // so record that exact commit instead of failing the evidence run. Locally,
  // an absent repository is still a hard error because the row cannot prove
  // which tree it tested.
  const sha = env.GITHUB_SHA
  if (env.GITHUB_ACTIONS === 'true' && typeof sha === 'string' && COMMIT_SHA_RE.test(sha)) {
    return { commit: sha, dirty: false, source: 'github-sha' }
  }
  const cause = gitError instanceof Error ? gitError.message : String(gitError)
  throw new Error(
    `${label}: cannot read the integration commit for field "commit" at path provenance.commit; caused by ${cause}; ` +
    'repair: run the mounted row inside the fairtrade worktree so git rev-parse HEAD resolves, or run in GitHub Actions where GITHUB_SHA identifies the checkout.',
  )
}
