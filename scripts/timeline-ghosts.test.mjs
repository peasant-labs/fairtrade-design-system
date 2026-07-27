#!/usr/bin/env node
/* Collapsed/expanded ghost groups via
   toggle-ghost-group, each confidence rendering (filled/half/open tether
   terminal), and the unresolved-on-lane placement (an unresolved ghost hangs
   off its session lane, not any commit's ghost group). Renders the REAL
   production components from dist/lib/graph.js.

   Run: `node scripts/timeline-ghosts.test.mjs` (wired into build:lib, after the lib build). */

import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import YAML from 'yaml'
import { GhostGroup, GhostCommitNode, SessionLane } from '../dist/lib/graph.js'

const h = React.createElement
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const GRAPH_DIR = resolve(ROOT, 'src/ui/graph')

const fixture = parseOne(readFileSync(resolve(HERE, 'testdata/timeline-ghosts.yaml'), 'utf8'), 'timeline-ghosts fixture')
const manifest = parseOne(readFileSync(resolve(HERE, 'testdata/timeline-ghosts.manifest.yaml'), 'utf8'), 'timeline-ghosts manifest')

if (manifest.expectedCaseCount !== manifest.caseNames.length) throw new Error('manifest expectedCaseCount does not match its own caseNames length')
if (fixture.expectedCaseCount !== manifest.expectedCaseCount) throw new Error('fixture expectedCaseCount does not match the manifest')
if (fixture.cases.length !== fixture.expectedCaseCount) throw new Error(`fixture must contain exactly ${fixture.expectedCaseCount} cases`)
const fixtureNames = new Set(fixture.cases.map((c) => c.name))
if (fixtureNames.size !== fixture.cases.length) throw new Error('fixture has a duplicate case name')
for (const name of manifest.caseNames) if (!fixtureNames.has(name)) throw new Error(`manifest declares a case name absent from the fixture: ${name}`)
for (const name of fixtureNames) if (!manifest.caseNames.includes(name)) throw new Error(`fixture declares a case name absent from the manifest: ${name}`)

function renderCase(testCase, mod) {
  if (testCase.control === 'ghost-group') {
    return render(h(mod.GhostGroup, { ...testCase.props, ghosts: fixture.ghosts, onToggle: () => {} }))
  }
  if (testCase.control === 'ghost-commit-node') {
    return render(h(mod.GhostCommitNode, testCase.props))
  }
  if (testCase.control === 'session-lane') {
    return render(h(mod.SessionLane, { ...testCase.props, onHover: () => {}, onSelect: () => {} }))
  }
  throw new Error(`timeline-ghosts fixture: unknown control ${JSON.stringify(testCase.control)}`)
}

function assertCase(testCase, markup) {
  for (const needle of testCase.mustContain ?? []) assert.ok(markup.includes(needle), `${testCase.name}: markup must contain ${JSON.stringify(needle)}`)
  for (const needle of testCase.mustNotContain ?? []) assert.ok(!markup.includes(needle), `${testCase.name}: markup must NOT contain ${JSON.stringify(needle)}`)
}

for (const testCase of fixture.cases) assertCase(testCase, renderCase(testCase, { GhostGroup, GhostCommitNode, SessionLane }))
console.log(`timeline ghosts: ${fixture.cases.length} fixture cases passed against the built production components`)

// ── mutation guards (rebuild the graph entry with vite after each source patch) ──
const { build } = await import('vite')
const react = (await import('@vitejs/plugin-react')).default

let killed = 0
for (const mutation of manifest.mutationCases) {
  const testCase = fixture.cases.find((c) => c.name === mutation.case)
  if (!testCase) throw new Error(`mutation ${JSON.stringify(mutation.name)} references an unknown case ${JSON.stringify(mutation.case)}`)
  const realPath = resolve(GRAPH_DIR, mutation.file)
  const original = readFileSync(realPath, 'utf8')
  const occurrences = original.split(mutation.find).length - 1
  if (occurrences !== 1) throw new Error(`mutation ${JSON.stringify(mutation.name)}: find text must occur exactly once in ${mutation.file}, found ${occurrences}`)
  const outDir = resolve(HERE, `.timeline-ghosts-mutant-${mutation.name.replace(/[^a-z0-9]+/gi, '-')}`)
  writeFileSync(realPath, original.replace(mutation.find, mutation.replace))
  let threw = false
  try {
    await build({
      root: ROOT,
      logLevel: 'silent',
      plugins: [react()],
      build: {
        outDir,
        emptyOutDir: true,
        lib: { entry: resolve(GRAPH_DIR, 'index.js'), formats: ['es'], fileName: () => 'mutant.mjs' },
        rollupOptions: { external: ['@peasant-labs/schema', '@tanstack/react-table', 'lucide-react', 'react', 'react-dom', 'react/jsx-runtime', 'recharts'] },
        minify: false,
      },
    })
    const mod = await import(resolve(outDir, 'mutant.mjs') + `?t=${Date.now()}`)
    try {
      assertCase(testCase, renderCase(testCase, mod))
    } catch {
      threw = true
    }
    const { rmSync } = await import('node:fs')
    rmSync(outDir, { recursive: true, force: true })
  } finally {
    writeFileSync(realPath, original)
  }
  if (!threw) throw new Error(`mutation ${JSON.stringify(mutation.name)} survived: case ${JSON.stringify(mutation.case)} still passed against the mutated component`)
  killed += 1
}
console.log(`timeline ghosts: ${killed} mutation(s) killed (each named guard genuinely reddens)`)

function parseOne(text, label) {
  const documents = YAML.parseAllDocuments(text, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (errors.length) throw new Error(`${label} has invalid strict YAML or a duplicate key: ${errors.map((error) => error.message).join('; ')}`)
  if (documents.length !== 1) throw new Error(`${label} must contain exactly one YAML document`)
  return documents[0].toJS()
}
