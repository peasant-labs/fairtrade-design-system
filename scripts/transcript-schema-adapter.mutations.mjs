#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import YAML from 'yaml'

const manifestPath = resolve('scripts/testdata/transcript-schema-adapter.manifest.yaml')
const document = YAML.parseDocument(readFileSync(manifestPath, 'utf8'), { strict: true, uniqueKeys: true })
if (document.errors.length > 0) throw new Error(`schema adapter manifest is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
const manifest = document.toJS()
if (!Array.isArray(manifest?.mutations) || manifest.expectedMutationCount !== manifest.mutations.length) throw new Error('schema adapter manifest must contain its exact mutation inventory')

const sourcePaths = {
  adapter: resolve('src/ui/transcript/adapter.js'),
  wireTypes: resolve('src/ui/transcript/wire-types.js'),
}
const sources = Object.fromEntries(Object.entries(sourcePaths).map(([name, path]) => [name, readFileSync(path, 'utf8')]))
const temp = mkdtempSync(join(tmpdir(), 'fairtrade-schema-adapter-'))

try {
  for (const [index, mutation] of manifest.mutations.entries()) {
    if (!mutation || typeof mutation !== 'object' || !Object.hasOwn(sourcePaths, mutation.file)) throw new Error(`mutation ${index} has an unsupported source file`)
    const source = sources[mutation.file]
    const occurrences = source.split(mutation.find).length - 1
    if (occurrences !== 1) throw new Error(`${mutation.name}: mutation target must occur exactly once, received ${occurrences}`)
    const artifact = join(temp, `${basename(sourcePaths[mutation.file], '.js')}-${index}.mjs`)
    const rewritten = source
      .replaceAll("from './adapter.parse.js'", `from '${new URL('../src/ui/transcript/adapter.parse.js', import.meta.url).href}'`)
      .replaceAll("from './analytics.js'", `from '${new URL('../src/ui/transcript/analytics.js', import.meta.url).href}'`)
      .replace("from '@peasant-labs/schema'", `from '${pathToFileURL(resolve('node_modules/@peasant-labs/schema/dist/index.js')).href}'`)
      .replace(mutation.find, mutation.replace)
    writeFileSync(artifact, rewritten)
    const envName = mutation.file === 'adapter' ? 'FAIRTRADE_SCHEMA_ADAPTER_MODULE' : 'FAIRTRADE_SCHEMA_WIRE_TYPES_MODULE'
    const result = spawnSync(process.execPath, ['scripts/transcript-schema-adapter.test.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, [envName]: artifact },
    })
    if (result.status === 0) throw new Error(`${mutation.name}: isolated production mutation survived the focused behavior gate`)
    const output = `${result.stdout}\n${result.stderr}`
    if (!output.includes(mutation.expectedError)) throw new Error(`${mutation.name}: gate failed for an unrelated reason; expected ${mutation.expectedError}, received ${output.trim()}`)
  }
} finally {
  rmSync(temp, { recursive: true, force: true })
}

console.log(`transcript schema adapter mutations: ${manifest.mutations.length} isolated production mutations were killed.`)
