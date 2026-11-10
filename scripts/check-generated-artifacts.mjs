#!/usr/bin/env node
// @ts-check

// Generated-artifact freshness gate.
//
// The invariant is byte equality: snapshot the checked files, run the
// generator, then fail when any file's bytes changed. A stale checkout, a
// missing generated file, or a generator that stopped writing an expected
// artifact all fail. No git repository is required, so the gate also runs in a
// container, an exported tarball, or any workspace without `.git`; the previous
// `git diff --exit-code` stopped the required CI job when the fallback runner
// lost the repository metadata.
//
// `package.json` exposes this as `gen:check`. `pnpm build` still runs
// `scripts/gen-llm-artifacts.mjs` directly, because the build must write the
// artifacts, not compare them.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENERATED_ARTIFACT_PATHS } from './generated-artifacts.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const GENERATOR = join(HERE, 'gen-llm-artifacts.mjs')

/**
 * Read the current bytes of each checked artifact.
 * @param {string} root repository root
 * @param {readonly string[]} paths repo-relative artifact paths
 * @returns {Map<string, Buffer | null>} path to bytes, or null when missing
 */
export function snapshotArtifacts(root, paths) {
  return new Map(paths.map((path) => {
    const file = join(root, path)
    return [path, existsSync(file) ? readFileSync(file) : null]
  }))
}

/**
 * Name the artifacts whose bytes differ between two snapshots.
 * @param {Map<string, Buffer | null>} before snapshot before regeneration
 * @param {Map<string, Buffer | null>} after snapshot after regeneration
 * @returns {string[]} changed repo-relative paths
 */
export function changedArtifacts(before, after) {
  /** @type {string[]} */
  const changed = []
  for (const [path, prior] of before) {
    const next = after.get(path) ?? null
    // A checked artifact must exist after regeneration: a generator that
    // stopped writing one, or a committed deletion, is stale output too.
    if (next === null) {
      changed.push(path)
      continue
    }
    if (prior === null || !prior.equals(next)) changed.push(path)
  }
  return changed
}

/**
 * Snapshot, regenerate, and report the artifacts the regeneration changed.
 * @param {{ root?: string, paths?: readonly string[], run?: () => void }} [options]
 * @returns {string[]} changed repo-relative paths
 */
export function checkGeneratedArtifacts({ root = ROOT, paths = GENERATED_ARTIFACT_PATHS, run = () => {} } = {}) {
  const before = snapshotArtifacts(root, paths)
  run()
  return changedArtifacts(before, snapshotArtifacts(root, paths))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const changed = checkGeneratedArtifacts({
    run: () => {
      const result = spawnSync(process.execPath, [GENERATOR], { stdio: 'inherit' })
      if (result.error) throw result.error
      if (result.status !== 0) process.exit(result.status ?? 1)
    },
  })
  if (changed.length > 0) {
    console.error('gen:check: generated artifacts are stale; regenerate and commit the result:')
    for (const path of changed) console.error(`  ${path}`)
    process.exit(1)
  }
  console.log('gen:check: generated artifacts are fresh')
}
