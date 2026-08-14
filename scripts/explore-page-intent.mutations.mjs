/* Non-vacuity proof for the mounted Explore pagination-intent regression.

   Each named source mutation in scripts/testdata/explore-page-intent.manifest.yaml
   is injected into src/ui/commons/Explore.jsx through the render test's Vite
   transform (FAIRTRADE_SOURCE_MUTATION) — never by editing the tracked file — and
   must make explore-page-intent.render.test.mjs fail with the invariant the
   mutation violates. A surviving mutation means the behavior test cannot see the
   regression it claims to guard. The manifest inventory (count + required names)
   is validated so a mutation cannot be silently dropped. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import YAML from 'yaml'

const manifestPath = resolve('scripts/testdata/explore-page-intent.manifest.yaml')
const explorePath = resolve('src/ui/commons/Explore.jsx')
const document = YAML.parseDocument(readFileSync(manifestPath, 'utf8'), { strict: true, uniqueKeys: true })
if (document.errors.length) throw new Error(`${manifestPath} is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
const manifest = document.toJS()
if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || !Array.isArray(manifest.requiredMutationNames) || !Array.isArray(manifest.mutations) || !Number.isSafeInteger(manifest.expectedMutationCount) || manifest.expectedMutationCount !== manifest.mutations.length || manifest.requiredMutationNames.length !== manifest.expectedMutationCount) throw new Error(`${manifestPath} must carry its exact source mutation inventory`)
const names = manifest.mutations.map((row) => row?.name)
if (new Set(manifest.requiredMutationNames).size !== manifest.requiredMutationNames.length || manifest.requiredMutationNames.some((name) => !names.includes(name)) || names.some((name) => !manifest.requiredMutationNames.includes(name)) || new Set(names).size !== names.length) throw new Error(`${manifestPath} required source mutation names do not match its inventory`)

const source = readFileSync(explorePath, 'utf8')
const fields = ['name', 'find', 'replace', 'expectedError']
for (const [index, mutation] of manifest.mutations.entries()) {
  if (!mutation || typeof mutation !== 'object' || Array.isArray(mutation)) throw new Error(`mutation ${index} must be an object`)
  const keys = Object.keys(mutation)
  if (keys.length !== fields.length || keys.some((field) => !fields.includes(field)) || fields.some((field) => !(field in mutation))) throw new Error(`mutation ${index} fields are invalid`)
  if (['name', 'find', 'expectedError'].some((field) => typeof mutation[field] !== 'string' || mutation[field].length === 0) || typeof mutation.replace !== 'string') throw new Error(`mutation ${index} values are invalid`)
  if (/^(?:AssertionError|Expected)$/.test(mutation.expectedError)) throw new Error(`${mutation.name}: expectedError must name the violated invariant`)
  const occurrences = source.split(mutation.find).length - 1
  if (occurrences !== 1) throw new Error(`${mutation.name}: mutation target must occur exactly once in Explore.jsx, received ${occurrences}`)
  const result = spawnSync(process.execPath, ['scripts/explore-page-intent.render.test.mjs'], {
    cwd: process.cwd(), encoding: 'utf8',
    env: { ...process.env, FAIRTRADE_SOURCE_MUTATION: JSON.stringify(mutation) },
  })
  if (result.status === 0) throw new Error(`${mutation.name}: source mutation survived the mounted behavior gate`)
  const output = `${result.stdout}\n${result.stderr}`
  if (!output.includes(mutation.expectedError)) throw new Error(`${mutation.name}: mounted gate failed for an unrelated reason; expected ${mutation.expectedError}, received ${output.trim()}`)
}

console.log(`explore page intent mutations: ${manifest.mutations.length} isolated production mutations were killed without modifying tracked sources`)
