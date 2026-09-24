#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const BASE = process.env.BREADCRUMB_BASE || '6afc3fe4ac49c43d9ff093610fd131f0492118dd'
const BRANCH = process.env.BREADCRUMB_BRANCH || 'fairtrade-44--fix--breadcrumb-links-case'
const manifest = loadManifest(resolve(HERE, 'testdata/breadcrumb.manifest.yaml'))
const trackedSourceFiles = ['src/index.css', 'src/ui/Breadcrumb.jsx']
const sourceBefore = new Map(trackedSourceFiles.map((file) => [file, readFileSync(resolve(ROOT, file))]))
const outputRoot = mkdtempSync(join(tmpdir(), 'fairtrade-breadcrumb-mutants-'))

try {
  const cleanSource = await runNode('scripts/breadcrumb.test.mjs')
  assert.equal(cleanSource.code, 0, `unmodified source baseline failed:\n${cleanSource.output}`)
  const cleanMounted = await runNode('scripts/breadcrumb-rendered-probe.mjs', {
    BREADCRUMB_DIST_ROOT: resolve(ROOT, 'dist'),
    BREADCRUMB_PROVENANCE_ALLOW_DIRTY: '1',
    BREADCRUMB_BASE: BASE,
    BREADCRUMB_BRANCH: BRANCH,
  })
  assert.equal(cleanMounted.code, 0, `unmodified mounted baseline failed:\n${cleanMounted.output}`)

  for (const mutation of manifest.mutations) {
    const artifactRoot = join(outputRoot, mutation.name)
    await build({
      root: ROOT,
      configFile: resolve(ROOT, 'vite.config.js'),
      logLevel: 'silent',
      plugins: [inMemoryMutation(mutation)],
      build: { outDir: artifactRoot, emptyOutDir: true },
    })
    assert.ok(existsSync(join(artifactRoot, 'index.html')), `${mutation.name}: isolated build did not emit index.html`)

    const result = mutation.file.endsWith('.jsx')
      ? await runNode('scripts/breadcrumb.test.mjs', {
          BREADCRUMB_MUTATION_FILE: mutation.file,
          BREADCRUMB_MUTATION_FIND: mutation.find,
          BREADCRUMB_MUTATION_REPLACE: mutation.replace,
          BREADCRUMB_SOURCE_CASE: mutation.designatedCase,
        })
      : await runNode('scripts/breadcrumb-rendered-probe.mjs', {
          BREADCRUMB_DIST_ROOT: artifactRoot,
          BREADCRUMB_MOUNTED_CASE: 'commons-detail-dark',
          BREADCRUMB_PROVENANCE_ALLOW_DIRTY: '1',
          BREADCRUMB_BASE: BASE,
          BREADCRUMB_BRANCH: BRANCH,
        })
    assert.notEqual(result.code, 0, `${mutation.name}: designated mutation survived`)
    assert.ok(result.output.includes(mutation.diagnostic), `${mutation.name}: failed for an unrelated reason; expected ${JSON.stringify(mutation.diagnostic)}, received:\n${result.output}`)
    for (const [file, bytes] of sourceBefore) assert.ok(readFileSync(resolve(ROOT, file)).equals(bytes), `${mutation.name}: tracked source bytes changed in ${file}`)
    console.log(`${mutation.name}: killed at ${mutation.designatedCase}`)
  }
  for (const [file, bytes] of sourceBefore) assert.ok(readFileSync(resolve(ROOT, file)).equals(bytes), `tracked source bytes changed in ${file}`)
  console.log('breadcrumb mutations: clean source and mounted baselines passed; all designated mutants were killed')
} finally {
  rmSync(outputRoot, { recursive: true, force: true })
}

function inMemoryMutation(mutation) {
  const sourcePath = normalize(resolve(ROOT, mutation.file))
  const source = readFileSync(sourcePath, 'utf8')
  const occurrences = source.split(mutation.find).length - 1
  assert.equal(occurrences, 1, `${mutation.name}: mutation target must occur exactly once`)
  return {
    name: `in-memory-${mutation.name}`,
    enforce: 'pre',
    load(id) {
      return normalize(id.split('?')[0]) === sourcePath ? source.replace(mutation.find, mutation.replace) : null
    },
  }
}

function runNode(script, extraEnv = {}) {
  return new Promise((resolveResult) => {
    execFile(process.execPath, [script], {
      cwd: ROOT,
      env: { ...process.env, ...extraEnv },
      maxBuffer: 20 * 1024 * 1024,
    }, (error, stdout, stderr) => resolveResult({ code: error?.code ?? 0, output: `${stdout}\n${stderr}` }))
  })
}

function loadManifest(path) {
  const source = readFileSync(path, 'utf8')
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (documents.length !== 1 || errors.length || (source.match(/^---\s*$/gm) ?? []).length) throw new Error(`breadcrumb mutation manifest is not one strict unique-key YAML document: ${errors.map((error) => error.message).join('; ')}`)
  const value = documents[0].toJS()
  assert.deepEqual(value.mutations.map((mutation) => mutation.name), ['restore-global-crumb-lowercase', 'apply-per-item-crumb-lowercase', 'remove-link-component-forwarding'], 'breadcrumb mutation manifest names')
  return value
}
