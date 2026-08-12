#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import YAML from 'yaml'

const root = resolve(new URL('..', import.meta.url).pathname)
const manifestPath = resolve(root, 'scripts/testdata/transcript-turn-model.manifest.yaml')
const source = readFileSync(manifestPath, 'utf8')
const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
if (document.errors.length) throw new Error(`turn-model mutation manifest is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
const manifest = document.toJS()
assert.equal(manifest.expectedMutationCount, 10, 'turn-model mutation manifest exact count guard')
assert.equal(manifest.mutations.length, manifest.expectedMutationCount, 'turn-model mutation inventory count')
assert.deepEqual([...manifest.mutations.map((item) => item.name)].sort(), [...manifest.requiredMutationNames].sort(), 'turn-model mutation exact required-name inventory')

for (const mutation of manifest.mutations) {
  const result = spawnSync(process.execPath, ['scripts/transcript-turn-model.test.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, FAIRTRADE_TURN_MODEL_MUTATION: JSON.stringify(mutation) },
  })
  if (result.status === 0) throw new Error(`${mutation.name}: complete baseline survived its production-point mutation`)
  const output = `${result.stdout}\n${result.stderr}`
  if (!output.includes(mutation.expectedDiagnostic)) throw new Error(`${mutation.name}: failed outside its designated behavior; expected ${mutation.expectedDiagnostic}, received ${output.trim()}`)
  const caseDiagnostics = manifest.requiredNames.filter((name) => output.includes(`${name}:`))
  assert.deepEqual(caseDiagnostics, [mutation.expectedDiagnostic], `${mutation.name}: only the designated fixture may fail`)
}

console.log(`sticky turn-model mutations: all ${manifest.mutations.length} production-point mutations were killed by exactly one designated baseline case.`)
