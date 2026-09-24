#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSectionWidthFixtures, validateSectionWidthContract } from './section-width.test.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TRACKED_INPUTS = Object.freeze([
  'src/index.css',
  'packages/tokens/base.css',
  'scripts/gen-llm-artifacts.mjs',
])
const READ_ONLY_LINKS = Object.freeze([
  'llm/DESIGN.md',
  'scripts/transcript-composite-width.test.mjs',
  'scripts/testdata/transcript-composite-width-invariants.yaml',
  'src/App.jsx',
  'src/DocSections.jsx',
  'src/ComponentSections.jsx',
  'src/sections-react',
])
const MUTATIONS = Object.freeze([
  Object.freeze({
    name: 'restore-bare-selector',
    file: 'src/index.css',
    find: 'section.band { max-width: var(--maxw); margin: 0 auto; }',
    replace: 'section { max-width: var(--maxw); margin: 0 auto; padding: 0 var(--gutter); }',
  }),
  Object.freeze({
    name: 'remove-explicit-band',
    file: 'src/index.css',
    find: 'section.band { max-width: var(--maxw); margin: 0 auto; }',
    replace: 'section.band { }',
  }),
  Object.freeze({
    name: 'generator-output-drift',
    file: 'packages/tokens/base.css',
    find: 'section.band { max-width: var(--maxw); margin: 0 auto; }',
    replace: 'section.band { max-width: 960px; margin: 0; }',
  }),
])

const scopedStatusBefore = gitStatus(TRACKED_INPUTS)
if (scopedStatusBefore) throw actionable(`mutation baseline is dirty\ncase: clean-source-generated-baseline\nfile: ${TRACKED_INPUTS.join(', ')}\nobserved: ${JSON.stringify(scopedStatusBefore)}\nexpected: no tracked status entries\nremedy: commit or restore these tracked inputs before running source/generated mutations`)
const beforeHashes = snapshotHashes()
const { fixture, manifest } = loadSectionWidthFixtures(ROOT)
console.log(`PASS clean-source-generated-baseline: ${TRACKED_INPUTS.length} tracked source/generated inputs are clean`)

let temporaryRoot
try {
  validateSectionWidthContract({ root: ROOT, fixture, manifest })
  console.log('PASS unmodified-source-generated-baseline: source guard accepted the clean authored and generated contract')
  temporaryRoot = mkdtempSync(join(tmpdir(), 'fairtrade-section-width-'))
  prepareTemporaryRoot(temporaryRoot)

  for (const mutation of MUTATIONS) {
    const expectedDiagnostic = manifest.mutationCases[mutation.name]
    assert.equal(typeof expectedDiagnostic, 'string', `manifest mutation ${mutation.name} must name an exact diagnostic`)
    const destination = resolve(temporaryRoot, mutation.file)
    const original = readFileSync(destination, 'utf8')
    const occurrences = original.split(mutation.find).length - 1
    if (occurrences !== 1) throw actionable(`mutation target drifted\ncase: ${mutation.name}\nfile: ${mutation.file}\nobserved: ${occurrences} exact target occurrence(s)\nexpected: one exact target occurrence\nremedy: keep the mutation fixture aligned with the named source/generated contract or update both inventories together`)
    const mutated = original.replace(mutation.find, mutation.replace)
    if (mutated === original) throw actionable(`mutation was not observable\ncase: ${mutation.name}\nfile: ${mutation.file}\nobserved: unchanged bytes\nexpected: a temporary source/generated change\nremedy: choose a non-empty replacement that exercises the named diagnostic`)
    writeFileSync(destination, mutated)

    let observedDiagnostic
    try {
      validateSectionWidthContract({ root: temporaryRoot, fixture, manifest })
    } catch (error) {
      observedDiagnostic = error instanceof Error ? error.message.split('\n')[0] : String(error)
    }
    if (observedDiagnostic !== expectedDiagnostic) throw actionable(`mutation was not killed by its named diagnostic\ncase: ${mutation.name}\nfile: ${mutation.file}\nobserved: ${JSON.stringify(observedDiagnostic ?? 'mutation survived')}\nexpected: ${JSON.stringify(expectedDiagnostic)}\nremedy: route this temporary mutation to the named source/generated case; generic parse, server, or browser failures do not count`)
    console.log(`PASS ${mutation.name}: ${observedDiagnostic}`)
    writeFileSync(destination, original)
  }
} finally {
  if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true })
  if (temporaryRoot) assert.equal(existsSync(temporaryRoot), false, `temporary mutation root was not removed: ${temporaryRoot}`)
  const afterHashes = snapshotHashes()
  const afterStatus = gitStatus(TRACKED_INPUTS)
  assert.deepEqual(afterHashes, beforeHashes, `source/generated mutation cleanup changed tracked bytes: ${JSON.stringify({ beforeHashes, afterHashes })}`)
  assert.equal(afterStatus, scopedStatusBefore, `source/generated mutation cleanup changed tracked status: before=${JSON.stringify(scopedStatusBefore)} after=${JSON.stringify(afterStatus)}`)
  console.log(`PASS mutation-cleanup: tracked hashes and scoped status are unchanged (${Object.keys(afterHashes).sort().join(', ')})`)
}

function prepareTemporaryRoot(root) {
  for (const relative of TRACKED_INPUTS) {
    const destination = resolve(root, relative)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(resolve(ROOT, relative), destination)
  }
  for (const relative of READ_ONLY_LINKS) {
    const destination = resolve(root, relative)
    mkdirSync(dirname(destination), { recursive: true })
    symlinkSync(resolve(ROOT, relative), destination, 'dir')
  }
}

function snapshotHashes() {
  return Object.fromEntries(TRACKED_INPUTS.map((relative) => [relative, hashFile(resolve(ROOT, relative))]))
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function gitStatus(paths) {
  return execFileSync('git', ['status', '--porcelain', '--', ...paths], { cwd: ROOT, encoding: 'utf8' })
}

function actionable(message) {
  return new Error(message)
}
