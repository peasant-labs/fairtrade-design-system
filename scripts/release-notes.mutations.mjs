#!/usr/bin/env node
/* Mutation-proof for release-notes.mjs's extraction logic. Applies ONE
   production-point find/replace per mutation (from release-notes.manifest
   .yaml) to a temp copy of release-notes.mjs, imports it, runs it against the
   probe fixture case, and asserts the fixtured baseline behaviour NO LONGER
   holds - proving release-notes.test.mjs actually exercises this code path
   (a mutation the test suite cannot see would leave the baseline behaviour
   intact). Run: `pnpm test:release-notes:mutations` (wired into build:lib). */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import YAML from 'yaml'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const SOURCE_PATH = resolve(ROOT, 'scripts/release-notes.mjs')
const manifest = loadStrictYaml('testdata/release-notes.manifest.yaml')
const fixture = loadStrictYaml('testdata/release-notes.yaml')

const baseline = readFileSync(SOURCE_PATH, 'utf8')
let killed = 0

for (const mutation of manifest.mutations) {
  const occurrences = baseline.split(mutation.find).length - 1
  if (occurrences !== 1) throw new Error(`${mutation.name}: find string must occur exactly once in release-notes.mjs, found ${occurrences}`)
  const mutated = baseline.split(mutation.find).join(mutation.replace)

  const pool = mutation.probeGroup === 'valid' ? fixture.validCases : fixture.invalidCases
  const probeCase = pool.find((c) => c.name === mutation.probeCaseName)
  if (!probeCase) throw new Error(`${mutation.name}: probe case ${JSON.stringify(mutation.probeCaseName)} not found in ${mutation.probeGroup}Cases`)

  const dir = mkdtempSync(join(tmpdir(), 'fairtrade-release-notes-mutation-'))
  const mutatedPath = join(dir, 'release-notes.mutated.mjs')
  writeFileSync(mutatedPath, mutated)
  try {
    const { extractChangelogSection } = await import(`file://${mutatedPath}?cachebust=${mutation.name.replace(/\W+/g, '-')}`)

    if (mutation.probeGroup === 'valid') {
      let actual
      let threw = false
      try {
        actual = extractChangelogSection(probeCase.changelog, probeCase.version)
      } catch {
        threw = true
      }
      const stillMatchesBaseline = !threw && actual === probeCase.expected
      if (stillMatchesBaseline) {
        throw new Error(`${mutation.name}: mutated extraction still returned the fixtured baseline for ${JSON.stringify(probeCase.name)} - mutation had no effect the fixture suite would catch`)
      }
    } else {
      let threw = false
      try {
        extractChangelogSection(probeCase.changelog, probeCase.version)
      } catch {
        threw = true
      }
      if (threw) {
        throw new Error(`${mutation.name}: mutated extraction still threw for ${JSON.stringify(probeCase.name)} - mutation had no effect the fixture suite would catch`)
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  killed += 1
  console.log(`killed: ${mutation.name}`)
}

console.log(`release notes mutations: all ${killed} production-point mutation(s) were killed.`)

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return document.toJS()
}
