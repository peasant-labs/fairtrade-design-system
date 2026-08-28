#!/usr/bin/env node
/* Mutation-proof for the standalone transcript helpers (turnNav.js / time.js /
   title.js). For each mutation in transcript-helpers.manifest.yaml, patches
   ONE exact string in the named production source file, writes the mutated
   copy to a temp file, and re-spawns transcript-helpers.test.mjs with that
   module substituted in via its FAIRTRADE_*_MODULE override — proving the
   fixture in transcript-helpers.test.mjs actually kills a real break in each
   ported module (break, see fail, restore). Asserts the run FAILS and its
   diagnostic names exactly the mutation's designated case.
   Run: `pnpm test:transcript-helpers:mutations` (wired into build:lib). */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import YAML from 'yaml'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const manifest = loadStrictYaml('testdata/transcript-helpers.manifest.yaml')
validateMutationManifest(manifest)

const tmpDir = mkdtempSync(join(tmpdir(), 'fairtrade-transcript-helpers-mutation-'))
try {
  for (const mutation of manifest.mutations) {
    const sourcePath = join(ROOT, mutation.file)
    const source = readFileSync(sourcePath, 'utf8')
    const occurrences = source.split(mutation.find).length - 1
    if (occurrences !== 1) {
      throw new Error(`${mutation.name}: find string must occur exactly once in ${mutation.file}, found ${occurrences}`)
    }
    const mutatedPath = join(tmpDir, mutation.outFile)
    writeFileSync(mutatedPath, source.split(mutation.find).join(mutation.replace))

    const result = spawnSync(process.execPath, ['scripts/transcript-helpers.test.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, [mutation.envVar]: mutatedPath },
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
} finally {
  rmSync(tmpDir, { recursive: true, force: true })
}

console.log(`transcript helpers mutations: all ${manifest.mutations.length} production-point mutations were killed.`)

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return document.toJS()
}

function validateMutationManifest(value) {
  if (!Number.isSafeInteger(value.expectedMutationCount) || value.expectedMutationCount < 1) {
    throw new Error('transcript-helpers manifest expectedMutationCount must be a positive safe integer')
  }
  if (!Array.isArray(value.mutations) || value.mutations.length !== value.expectedMutationCount) {
    throw new Error('transcript-helpers manifest mutations do not match expectedMutationCount')
  }
  if (!Array.isArray(value.requiredMutationNames) || value.requiredMutationNames.length !== value.mutations.length) {
    throw new Error('transcript-helpers manifest requiredMutationNames does not match the mutation inventory')
  }
  const names = value.mutations.map((m) => m.name)
  if (new Set(names).size !== names.length || value.requiredMutationNames.some((name) => !names.includes(name))) {
    throw new Error('transcript-helpers manifest mutations do not match their required-name inventory')
  }
  for (const mutation of value.mutations) {
    for (const field of ['name', 'file', 'find', 'replace', 'envVar', 'outFile', 'expectedDiagnostic']) {
      if (typeof mutation[field] !== 'string' || mutation[field].length === 0) {
        throw new Error(`transcript-helpers mutation ${mutation.name ?? '(unnamed)'} field ${field} must be a non-empty string`)
      }
    }
  }
}
