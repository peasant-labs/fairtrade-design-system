#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import YAML from 'yaml'

const fixturePath = resolve('scripts/testdata/transcript-turn-model.yaml')
const document = YAML.parseDocument(readFileSync(fixturePath, 'utf8'), { strict: true, uniqueKeys: true })
if (document.errors.length > 0) throw new Error(`turn model fixture is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
const fixture = document.toJS()
assert.equal(fixture.expectedMutationCount, fixture.mutations.length, 'turn model fixture must contain its exact mutation inventory')

const sourcePath = resolve('src/ui/transcript/adapter.js')
const source = readFileSync(sourcePath, 'utf8')
const temp = mkdtempSync(join(tmpdir(), 'fairtrade-turn-model-'))

try {
  for (const [index, mutation] of fixture.mutations.entries()) {
    const occurrences = source.split(mutation.find).length - 1
    if (occurrences !== 1) throw new Error(`${mutation.name}: mutation target must occur exactly once, received ${occurrences}`)
    const artifact = join(temp, `${basename(sourcePath, '.js')}-${index}.mjs`)
    const rewritten = source
      .replaceAll("from './adapter.parse.js'", `from '${pathToFileURL(resolve('src/ui/transcript/adapter.parse.js')).href}'`)
      .replaceAll("from './analytics.js'", `from '${pathToFileURL(resolve('src/ui/transcript/analytics.js')).href}'`)
      .replace(mutation.find, mutation.replace)
    writeFileSync(artifact, rewritten)
    const result = spawnSync(process.execPath, ['scripts/transcript-turn-model.test.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, FAIRTRADE_SCHEMA_TURN_MODEL_ADAPTER_MODULE: artifact },
    })
    if (result.status === 0) throw new Error(`${mutation.name}: isolated production mutation survived the focused behavior gate`)
    const output = `${result.stdout}\n${result.stderr}`
    if (!output.includes(mutation.expectedError)) {
      throw new Error(`${mutation.name}: gate failed for an unrelated reason; expected ${mutation.expectedError}, received ${output.trim()}`)
    }
  }
} finally {
  rmSync(temp, { recursive: true, force: true })
}

console.log(`turn model mutations: ${fixture.mutations.length} isolated adapter mutations were killed.`)
