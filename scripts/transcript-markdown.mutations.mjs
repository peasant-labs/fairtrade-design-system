#!/usr/bin/env node
/* Reversible bite proof for the built renderer gate. Each mutation is declared in the strict
   manifest, applied only by a Vite transform in a child process, and must make the production
   behavior assertions fail. The checked-out source is never changed. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import YAML from 'yaml'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const manifestPath = resolve(ROOT, 'scripts/testdata/transcript-markdown.manifest.yaml')
const sourcePath = resolve(ROOT, 'src/ui/transcript/Markdown.jsx')
const document = YAML.parseDocument(readFileSync(manifestPath, 'utf8'), { strict: true, uniqueKeys: true })
if (document.errors.length) throw new Error(`Markdown mutation manifest is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
const manifest = document.toJS()
if (!Array.isArray(manifest?.mutations) || manifest.expectedMutationCount !== manifest.mutations.length) throw new Error('Markdown mutation manifest must contain its exact mutation inventory')

const source = readFileSync(sourcePath, 'utf8')
for (const mutation of manifest.mutations) {
  const occurrences = source.split(mutation.find).length - 1
  if (occurrences !== 1) throw new Error(`${mutation.name}: source mutation anchor occurred ${occurrences} times`)
  const result = spawnSync(process.execPath, ['scripts/transcript-markdown.test.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FAIRTRADE_MARKDOWN_SOURCE_MUTATION: JSON.stringify(mutation) },
  })
  if (result.status === 0) throw new Error(`${mutation.name}: the isolated production mutation survived the fixture gate`)
  const output = `${result.stdout}\n${result.stderr}`
  if (!output.includes(mutation.expectedError)) throw new Error(`${mutation.name}: gate failed for an unrelated reason; expected ${mutation.expectedError}, received ${output.trim()}`)
  if (source !== readFileSync(sourcePath, 'utf8')) throw new Error(`${mutation.name}: mutation changed the checked-out production source`)
}

console.log(`transcript markdown mutations: ${manifest.mutations.length} isolated production mutation was killed and the source was restored.`)
