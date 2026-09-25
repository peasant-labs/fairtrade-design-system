#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

export function resolveFeatureGitIdentity({ sourceRoot = process.cwd(), base = process.env.BREADCRUMB_BASE, expectedHead = process.env.BREADCRUMB_HEAD, expectedBranch = process.env.BREADCRUMB_BRANCH } = {}) {
  const root = resolve(sourceRoot)
  const head = expectedHead || runGit(root, 'rev-parse', '--verify', 'HEAD^{commit}')
  const resolvedBase = base || resolveBase(root, head)
  const branch = expectedBranch !== undefined ? expectedBranch || undefined : runGit(root, 'branch', '--show-current') || undefined
  return { base: resolvedBase, expectedHead: head, expectedBranch: branch }
}

function resolveBase(root, head) {
  for (const ref of ['origin/main', 'refs/remotes/origin/main']) {
    try {
      return runGit(root, 'merge-base', head, ref)
    } catch {
      // A detached or non-main checkout may not have the remote-tracking ref.
    }
  }
  return runGit(root, 'rev-parse', '--verify', 'HEAD^')
}

function runGit(root, ...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    throw new Error(`feature git identity failed: git ${args.join(' ')} did not resolve from ${root}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
