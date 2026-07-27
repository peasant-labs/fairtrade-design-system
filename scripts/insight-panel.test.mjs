#!/usr/bin/env node
/* Grouping by kind, provenance markers (mechanical
   vs mined glyph), evidence links, the empty state, and unknown-kind fail-
   closed validation. Renders the REAL production InsightPanel from
   dist/lib/graph.js.

   Run: `node scripts/insight-panel.test.mjs` (wired into build:lib, after the lib build). */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import React from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import YAML from 'yaml'
import { InsightPanel } from '../dist/lib/graph.js'

const h = React.createElement
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const GRAPH_DIR = resolve(ROOT, 'src/ui/graph')
const SOURCE_SNAPSHOT = snapshotDirectory(GRAPH_DIR)

const fixture = parseOne(readFileSync(resolve(HERE, 'testdata/insight-panel.yaml'), 'utf8'), 'insight-panel fixture')
const manifest = parseOne(readFileSync(resolve(HERE, 'testdata/insight-panel.manifest.yaml'), 'utf8'), 'insight-panel manifest')

if (manifest.expectedCaseCount !== manifest.caseNames.length) throw new Error('manifest expectedCaseCount does not match its own caseNames length')
if (fixture.expectedCaseCount !== manifest.expectedCaseCount) throw new Error('fixture expectedCaseCount does not match the manifest')
if (fixture.cases.length !== fixture.expectedCaseCount) throw new Error(`fixture must contain exactly ${fixture.expectedCaseCount} cases`)
const fixtureNames = new Set(fixture.cases.map((c) => c.name))
if (fixtureNames.size !== fixture.cases.length) throw new Error('fixture has a duplicate case name')
for (const name of manifest.caseNames) if (!fixtureNames.has(name)) throw new Error(`manifest declares a case name absent from the fixture: ${name}`)
for (const name of fixtureNames) if (!manifest.caseNames.includes(name)) throw new Error(`fixture declares a case name absent from the manifest: ${name}`)

function runCase(testCase, mod) {
  let markup
  let thrown
  try {
    markup = render(h(mod.InsightPanel, { insights: testCase.insights, onOpenEvidence: () => {} }))
  } catch (error) {
    thrown = error
  }
  assert.equal(!!thrown, testCase.expectThrows, `${testCase.name}: expectThrows`)
  if (testCase.expectThrows) {
    for (const needle of testCase.expectErrorContains ?? []) {
      assert.ok(thrown.message.includes(needle), `${testCase.name}: error message must contain ${JSON.stringify(needle)}`)
    }
    return
  }
  for (const needle of testCase.mustContain ?? []) assert.ok(markup.includes(needle), `${testCase.name}: markup must contain ${JSON.stringify(needle)}`)
  for (const needle of testCase.mustNotContain ?? []) assert.ok(!markup.includes(needle), `${testCase.name}: markup must NOT contain ${JSON.stringify(needle)}`)
}

for (const testCase of fixture.cases) runCase(testCase, { InsightPanel })
console.log(`insight panel: ${fixture.cases.length} fixture cases passed against the built production component`)

// ── mutation guards ──────────────────────────────────────────────────────────
const { build } = await import('vite')
const react = (await import('@vitejs/plugin-react')).default

let killed = 0
const mutationRoot = mkdtempSync(join(tmpdir(), 'fairtrade-insight-panel-'))
try {
  symlinkSync(resolve(ROOT, 'node_modules'), join(mutationRoot, 'node_modules'), 'dir')
  for (const [index, mutation] of manifest.mutationCases.entries()) {
    const testCase = fixture.cases.find((c) => c.name === mutation.case)
    if (!testCase) throw new Error(`mutation ${JSON.stringify(mutation.name)} references an unknown case ${JSON.stringify(mutation.case)}`)
    const realPath = resolve(GRAPH_DIR, mutation.file)
    const original = readFileSync(realPath, 'utf8')
    const occurrences = original.split(mutation.find).length - 1
    if (occurrences !== 1) throw new Error(`mutation ${JSON.stringify(mutation.name)}: find text must occur exactly once in ${mutation.file}, found ${occurrences}`)
    const outDir = join(mutationRoot, `${String(index).padStart(2, '0')}-${mutation.name.replace(/[^a-z0-9]+/gi, '-')}`)
    let threw = false
    try {
      await build({
        root: ROOT,
        configFile: false,
        logLevel: 'silent',
        plugins: [react(), inMemorySourcePlugin(new Map([[realPath, original.replace(mutation.find, mutation.replace)]]))],
        build: {
          outDir,
          emptyOutDir: true,
          lib: { entry: resolve(GRAPH_DIR, 'index.js'), formats: ['es'], fileName: () => 'mutant.mjs' },
          rollupOptions: { external: ['@peasant-labs/schema', '@tanstack/react-table', 'lucide-react', 'react', 'react-dom', 'react/jsx-runtime', 'recharts'] },
          minify: false,
        },
      })
      try {
        const mod = await import(resolve(outDir, 'mutant.mjs') + `?t=${Date.now()}`)
        runCase(testCase, mod)
      } catch {
        threw = true
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
    if (!threw) throw new Error(`mutation ${JSON.stringify(mutation.name)} survived: case ${JSON.stringify(mutation.case)} still passed against the mutated component`)
    killed += 1
  }
} finally {
  rmSync(mutationRoot, { recursive: true, force: true })
  assertSnapshotUnchanged(SOURCE_SNAPSHOT)
  assertNoMutationResidue()
}
console.log(`insight panel: ${killed} mutation(s) killed (each named guard genuinely reddens)`)

function inMemorySourcePlugin(sources) {
  const normalized = new Map([...sources].map(([path, source]) => [normalize(path), source]))
  return {
    name: 'in-memory-insight-panel-mutation',
    enforce: 'pre',
    load(id) {
      return normalized.get(normalize(id.split('?')[0])) ?? null
    },
  }
}

function snapshotDirectory(directory) {
  const snapshot = new Map()
  collectFiles(directory, snapshot)
  return snapshot
}

function collectFiles(directory, snapshot) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) collectFiles(path, snapshot)
    else if (entry.isFile()) snapshot.set(path, createHash('sha256').update(readFileSync(path)).digest('hex'))
    else throw new Error(`insight-panel mutation snapshot found a non-regular source entry at ${path}`)
  }
}

function assertSnapshotUnchanged(before) {
  const after = snapshotDirectory(GRAPH_DIR)
  const differences = []
  for (const [path, hash] of before) {
    if (!after.has(path)) differences.push(`removed ${path}`)
    else if (after.get(path) !== hash) differences.push(`modified ${path}`)
  }
  for (const path of after.keys()) if (!before.has(path)) differences.push(`added ${path}`)
  if (differences.length > 0) throw new Error(`insight-panel mutation changed src/ui/graph: ${differences.sort().join(', ')}`)
}

function assertNoMutationResidue() {
  const residue = []
  for (const root of [resolve(ROOT, 'src'), resolve(ROOT, 'dist'), HERE]) {
    if (existsSync(root)) collectResidue(root, residue)
  }
  if (residue.length > 0) throw new Error(`insight-panel mutation residue remains beneath src/dist or scripts: ${residue.sort().join(', ')}`)
}

function collectResidue(directory, residue) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.name.includes('insight-panel-mutant')) residue.push(path)
    if (entry.isDirectory()) collectResidue(path, residue)
  }
}

function parseOne(text, label) {
  const documents = YAML.parseAllDocuments(text, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (errors.length) throw new Error(`${label} has invalid strict YAML or a duplicate key: ${errors.map((error) => error.message).join('; ')}`)
  if (documents.length !== 1) throw new Error(`${label} must contain exactly one YAML document`)
  return documents[0].toJS()
}
