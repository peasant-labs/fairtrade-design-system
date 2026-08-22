/* Runs every executable production mutation declared in the condense manifest against
   the mounted condense gate (through the gate's own vite transform, never by editing
   tracked sources) and fails if any mutation survives or trips an unrelated invariant. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import YAML from 'yaml'

const manifestPath = resolve('scripts/testdata/transcript-header-condense.manifest.yaml')
const viewerSource = readFileSync(resolve('src/ui/transcript/TranscriptViewer.jsx'), 'utf8')
const document = YAML.parseDocument(readFileSync(manifestPath, 'utf8'), { strict: true, uniqueKeys: true })
if (document.errors.length) throw new Error(`${manifestPath} is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
const manifest = document.toJS()
if (!manifest || !Array.isArray(manifest.mutations) || !Array.isArray(manifest.requiredMutationNames) || manifest.expectedMutationCount !== manifest.mutations.length || manifest.requiredMutationNames.length !== manifest.expectedMutationCount) throw new Error(`${manifestPath} must contain its exact production mutation inventory`)
const names = manifest.mutations.map((row) => row?.name)
if (new Set(names).size !== names.length || manifest.requiredMutationNames.some((name) => !names.includes(name))) throw new Error(`${manifestPath} required production mutation names do not match its inventory`)

for (const [index, mutation] of manifest.mutations.entries()) {
  const fields = ['name', 'file', 'find', 'replace', 'expectedError']
  const keys = Object.keys(mutation ?? {})
  if (keys.length !== fields.length || keys.some((field) => !fields.includes(field))) throw new Error(`mutation ${index} fields are invalid`)
  if (mutation.file !== 'viewer' || ['name', 'find', 'expectedError'].some((field) => typeof mutation[field] !== 'string' || mutation[field].length === 0) || typeof mutation.replace !== 'string') throw new Error(`mutation ${index} values are invalid`)
  const occurrences = viewerSource.split(mutation.find).length - 1
  if (occurrences !== 1) throw new Error(`${mutation.name}: mutation target must occur exactly once, received ${occurrences}`)
  const result = spawnSync(process.execPath, ['scripts/transcript-header-condense.test.mjs'], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, FAIRTRADE_SOURCE_MUTATION: JSON.stringify(mutation) } })
  if (result.status === 0) throw new Error(`${mutation.name}: executable production mutation survived the condense gate`)
  const output = `${result.stdout}\n${result.stderr}`
  if (!output.includes(mutation.expectedError)) throw new Error(`${mutation.name}: condense gate failed for an unrelated reason; expected ${mutation.expectedError}, received ${output.trim()}`)
}
console.log(`transcript header condense mutations: ${manifest.mutations.length} isolated executable production mutations were killed without modifying tracked sources`)
