#!/usr/bin/env node
/* Mutation-proof for TranscriptOutcomeChip (src/ui/transcript/OutcomeChip.jsx).
   Loads the REAL component source through vite's ssrLoadModule with a
   transform plugin that applies ONE production-point find/replace per
   mutation (from the manifest), renders it for the mutation's probe outcome,
   and asserts the fixtured baseline markup fragment is now ABSENT — proving
   the fixture in transcript-outcome-chip.test.mjs actually exercises this
   code path (a mutation the test suite cannot see would leave the fragment
   present). Mutations live in transcript-outcome-chip.manifest.yaml.
   Run: `pnpm test:transcript-outcome-chip:mutations` (wired into build:lib). */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import YAML from 'yaml'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const manifest = loadStrictYaml('testdata/transcript-outcome-chip.manifest.yaml')
validateMutationManifest(manifest)

for (const mutation of manifest.mutations) {
  const plugin = {
    name: 'fairtrade-outcome-chip-mutation',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith(`/${mutation.file}`)) return null
      const occurrences = code.split(mutation.find).length - 1
      if (occurrences !== 1) throw new Error(`${mutation.name}: find string must occur exactly once in ${mutation.file}, found ${occurrences}`)
      return { code: code.split(mutation.find).join(mutation.replace), map: null }
    },
  }
  const server = await createServer({ appType: 'custom', configFile: false, logLevel: 'silent', root: ROOT, plugins: [plugin] })
  try {
    const mod = await server.ssrLoadModule(`/${mutation.file}?mutation=${mutation.name}`)
    const markup = renderToStaticMarkup(React.createElement(mod.default, { outcome: mutation.probeOutcome }))
    if (markup.includes(mutation.expectedAbsentFragment)) {
      throw new Error(`${mutation.name}: mutated component still produced ${JSON.stringify(mutation.expectedAbsentFragment)} for outcome=${mutation.probeOutcome} — mutation had no effect the fixture suite would catch`)
    }
  } finally {
    await server.close()
  }
  console.log(`killed: ${mutation.name}`)
}

console.log(`transcript outcome chip mutations: all ${manifest.mutations.length} production-point mutation(s) were killed.`)

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return document.toJS()
}

function assertNameSet(actualNames, requiredNames, label) {
  const actualSet = new Set(actualNames)
  const requiredSet = new Set(requiredNames)
  if (actualSet.size !== actualNames.length) throw new Error(`${label}: duplicate mutation names`)
  if (actualSet.size !== requiredSet.size || [...requiredSet].some((name) => !actualSet.has(name))) {
    throw new Error(`${label}: mutation names do not match the required-name manifest exactly`)
  }
}

function validateMutationManifest(value) {
  if (!Array.isArray(value.mutations) || value.mutations.length === 0) {
    throw new Error('transcript-outcome-chip manifest mutations must be a non-empty array')
  }
  if (!Array.isArray(value.requiredMutationNames) || value.requiredMutationNames.some((name) => typeof name !== 'string' || name.length === 0)) {
    throw new Error('transcript-outcome-chip manifest requiredMutationNames must be a non-empty string array')
  }
  assertNameSet(value.mutations.map((m) => m.name), value.requiredMutationNames, 'transcript-outcome-chip mutations')
  for (const mutation of value.mutations) {
    for (const field of ['name', 'file', 'find', 'replace', 'probeOutcome', 'expectedAbsentFragment']) {
      if (typeof mutation[field] !== 'string' || mutation[field].length === 0) {
        throw new Error(`transcript-outcome-chip mutation ${mutation.name ?? '(unnamed)'} field ${field} must be a non-empty string`)
      }
    }
  }
}
