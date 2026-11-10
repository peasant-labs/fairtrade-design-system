// @ts-check

import assert from 'node:assert/strict'
import test from 'node:test'
import { readWorktreeState } from './worktree-state.mjs'

const HEAD_SHA = 'a'.repeat(40)

/**
 * Build an exec stub that records calls and answers by git subcommand.
 * @param {{ revParse?: string, status?: string, fail?: string }} reply
 * @returns {{ calls: string[], exec: (file: string, args: string[], options: { encoding: 'utf8', cwd: string }) => string }}
 */
function execStub({ revParse = `${HEAD_SHA}\n`, status = '', fail }) {
  /** @type {string[]} */
  const calls = []
  return {
    calls,
    exec: (file, args) => {
      calls.push([file, ...args].join(' '))
      if (fail !== undefined) throw new Error(fail)
      if (args[0] === 'rev-parse') return revParse
      if (args[0] === 'status') return status
      throw new Error(`unexpected git command: ${args.join(' ')}`)
    },
  }
}

test('git identity carries the commit, dirty state, and source', () => {
  const stub = execStub({ status: ' M src/index.css\n' })
  const state = readWorktreeState({ env: {}, exec: stub.exec })
  assert.deepEqual(state, { commit: HEAD_SHA, dirty: true, source: 'git' })
  assert.deepEqual(stub.calls, ['git rev-parse HEAD', 'git status --porcelain'])
})

test('a clean git worktree records dirty false', () => {
  const stub = execStub({ status: '' })
  const state = readWorktreeState({ env: {}, exec: stub.exec })
  assert.deepEqual(state, { commit: HEAD_SHA, dirty: false, source: 'git' })
})

test('git wins over GITHUB_SHA when both are available', () => {
  const stub = execStub({ status: '' })
  const state = readWorktreeState({ env: { GITHUB_ACTIONS: 'true', GITHUB_SHA: 'b'.repeat(40) }, exec: stub.exec })
  assert.deepEqual(state, { commit: HEAD_SHA, dirty: false, source: 'git' })
})

test('GitHub Actions falls back to GITHUB_SHA when git is unavailable', () => {
  const stub = execStub({ fail: 'fatal: not a git repository' })
  const state = readWorktreeState({ env: { GITHUB_ACTIONS: 'true', GITHUB_SHA: HEAD_SHA }, exec: stub.exec })
  assert.deepEqual(state, { commit: HEAD_SHA, dirty: false, source: 'github-sha' })
})

test('a local missing git checkout still refuses to guess', () => {
  const stub = execStub({ fail: 'fatal: not a git repository' })
  assert.throws(
    () => readWorktreeState({ label: 'product producer', env: {}, exec: stub.exec }),
    /product producer: cannot read the integration commit.*repair: run the mounted row inside the fairtrade worktree/s,
  )
})

test('CI with a malformed GITHUB_SHA refuses to guess', () => {
  const stub = execStub({ fail: 'fatal: not a git repository' })
  assert.throws(
    () => readWorktreeState({ env: { GITHUB_ACTIONS: 'true', GITHUB_SHA: 'abc123' }, exec: stub.exec }),
    /cannot read the integration commit/,
  )
})

test('CI with no GITHUB_SHA refuses to guess', () => {
  const stub = execStub({ fail: 'fatal: not a git repository' })
  assert.throws(
    () => readWorktreeState({ env: { GITHUB_ACTIONS: 'true' }, exec: stub.exec }),
    /cannot read the integration commit/,
  )
})

test('a git rev-parse result that is not a full SHA refuses to guess', () => {
  const stub = execStub({ revParse: 'deadbeef\n' })
  assert.throws(
    () => readWorktreeState({ env: { GITHUB_ACTIONS: 'true', GITHUB_SHA: HEAD_SHA }, exec: stub.exec }),
    /not a full commit SHA/,
  )
})

test('a failing git status keeps the commit and marks the tree dirty', () => {
  /** @type {(file: string, args: string[]) => string} */
  const exec = (file, args) => {
    if (args[0] === 'rev-parse') return `${HEAD_SHA}\n`
    throw new Error('git status failed')
  }
  const state = readWorktreeState({ env: {}, exec })
  assert.deepEqual(state, { commit: HEAD_SHA, dirty: true, source: 'git' })
})
