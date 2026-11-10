// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { GENERATED_ARTIFACT_PATHS } from './generated-artifacts.mjs'
import { changedArtifacts, checkGeneratedArtifacts, snapshotArtifacts } from './check-generated-artifacts.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
/** @type {string[]} */
const scratchDirs = []

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** @returns {string} a cleaned-up scratch root */
function scratchRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'gen-check-'))
  scratchDirs.push(dir)
  return dir
}

test('the checked paths are the required-name manifest, both ways', () => {
  const fixture = YAML.parse(readFileSync(join(HERE, 'testdata', 'generated-artifacts.yaml'), 'utf8'))
  assert.deepEqual([...GENERATED_ARTIFACT_PATHS].sort(), [...fixture.requiredPaths].sort())
})

test('a generator that rewrites a checked file fails freshness', () => {
  const root = scratchRoot()
  mkdirSync(join(root, 'public'))
  writeFileSync(join(root, 'public', 'tokens.json'), 'stale\n')
  const changed = checkGeneratedArtifacts({
    root,
    paths: ['public/tokens.json'],
    run: () => writeFileSync(join(root, 'public', 'tokens.json'), 'fresh\n'),
  })
  assert.deepEqual(changed, ['public/tokens.json'])
})

test('a generator that writes identical bytes passes freshness', () => {
  const root = scratchRoot()
  mkdirSync(join(root, 'public'))
  writeFileSync(join(root, 'public', 'tokens.json'), '{"a":1}\n')
  const changed = checkGeneratedArtifacts({
    root,
    paths: ['public/tokens.json'],
    run: () => writeFileSync(join(root, 'public', 'tokens.json'), '{"a":1}\n'),
  })
  assert.deepEqual(changed, [])
})

test('a missing checked file that regeneration creates fails freshness', () => {
  const root = scratchRoot()
  const changed = checkGeneratedArtifacts({
    root,
    paths: ['public/tokens.json'],
    run: () => {
      mkdirSync(join(root, 'public'))
      writeFileSync(join(root, 'public', 'tokens.json'), 'fresh\n')
    },
  })
  assert.deepEqual(changed, ['public/tokens.json'])
})

test('a missing checked file that regeneration leaves missing fails freshness', () => {
  const root = scratchRoot()
  const changed = checkGeneratedArtifacts({ root, paths: ['public/tokens.json'], run: () => {} })
  assert.deepEqual(changed, ['public/tokens.json'])
})

test('snapshot comparison sees binary changes, not just text', () => {
  const before = new Map([['a.bin', Buffer.from([0, 1, 2])]])
  const after = new Map([['a.bin', Buffer.from([0, 1, 3])]])
  assert.deepEqual(changedArtifacts(before, after), ['a.bin'])
})

test('the freshness gate never shells out to git', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  assert.equal(typeof pkg.scripts['gen:check'], 'string')
  assert.doesNotMatch(pkg.scripts['gen:check'], /\bgit\b/)
  assert.equal(pkg.scripts['gen:check'], 'node scripts/check-generated-artifacts.mjs')
})

test('snapshotArtifacts reads the checked list from one root', () => {
  const root = scratchRoot()
  mkdirSync(join(root, 'public'))
  writeFileSync(join(root, 'public', 'tokens.json'), 'x')
  const snapshot = snapshotArtifacts(root, ['public/tokens.json', 'public/components.json'])
  assert.deepEqual([...snapshot.keys()], ['public/tokens.json', 'public/components.json'])
  assert.equal(snapshot.get('public/tokens.json')?.toString(), 'x')
  assert.equal(snapshot.get('public/components.json'), null)
})
