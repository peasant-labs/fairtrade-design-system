#!/usr/bin/env node
/* Mutation-proof for the mounted TranscriptViewer outcome-chip wiring. For
   each mutation in transcript-viewer-outcome.manifest.yaml, re-spawns
   transcript-viewer-outcome.test.mjs with FAIRTRADE_VIEWER_OUTCOME_MUTATION
   set, which transforms the named production file (OutcomeChip.jsx) via a
   vite plugin before it is loaded — proving the mounted-viewer fixture
   actually kills a real tone-map break (break, see fail, restore). Asserts
   the run FAILS and its diagnostic names exactly the mutation's designated
   case. Run: `pnpm test:transcript-viewer-outcome:mutations` (wired into
   build:lib). */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import YAML from 'yaml'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const manifest = loadStrictYaml('testdata/transcript-viewer-outcome.manifest.yaml')

for (const mutation of manifest.mutations) {
  const result = spawnSync(process.execPath, ['scripts/transcript-viewer-outcome.test.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FAIRTRADE_VIEWER_OUTCOME_MUTATION: JSON.stringify(mutation) },
  })
  if (result.status === 0) {
    throw new Error(`${mutation.name}: complete baseline survived its production-point mutation`)
  }
  const output = `${result.stdout}\n${result.stderr}`
  if (!output.includes(mutation.expectedDiagnostic)) {
    throw new Error(`${mutation.name}: failed outside its designated behavior; expected diagnostic ${JSON.stringify(mutation.expectedDiagnostic)}, received: ${output.trim()}`)
  }
  console.log(`killed: ${mutation.name}`)
}

console.log(`transcript viewer outcome mutations: all ${manifest.mutations.length} production-point mutation(s) were killed.`)

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return document.toJS()
}
