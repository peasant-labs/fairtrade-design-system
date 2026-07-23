import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import YAML from 'yaml'

const manifestPaths = [
  resolve('scripts/testdata/transcript-initial-position.manifest.yaml'),
  resolve('scripts/testdata/transcript-initial-position.render.manifest.yaml'),
]
const productionPaths = {
  hook: resolve('src/ui/transcript/useTranscriptInitialPosition.jsx'),
  normalizer: resolve('src/ui/transcript/initial-position.js'),
  viewer: resolve('src/ui/transcript/TranscriptViewer.jsx'),
}

const mutations = manifestPaths.flatMap((manifestPath) => {
  const document = YAML.parseDocument(readFileSync(manifestPath, 'utf8'), { strict: true, uniqueKeys: true })
  if (document.errors.length) throw new Error(`${manifestPath} is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
  const manifest = document.toJS()
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || !Array.isArray(manifest.mutations) || !Number.isSafeInteger(manifest.expectedMutationCount) || manifest.expectedMutationCount !== manifest.mutations.length) throw new Error(`${manifestPath} must contain its exact production mutation inventory`)
  return manifest.mutations
})
if (new Set(mutations.map((row) => row?.name)).size !== mutations.length) throw new Error('Fairtrade production mutation names must be globally unique')

const production = Object.fromEntries(Object.entries(productionPaths).map(([name, path]) => [name, readFileSync(path, 'utf8')]))
const temp = mkdtempSync(join(tmpdir(), 'fairtrade-initial-position-'))
try {
  for (const [index, mutation] of mutations.entries()) {
    if (!mutation || typeof mutation !== 'object' || Array.isArray(mutation)) throw new Error(`mutation ${index} must be an object`)
    const fields = ['name', 'file', 'find', 'replace', 'expectedError']
    const keys = Object.keys(mutation)
    if (keys.length !== fields.length || keys.some((field) => !fields.includes(field)) || fields.some((field) => !(field in mutation))) throw new Error(`mutation ${index} fields are invalid`)
    if (!Object.hasOwn(production, mutation.file) || ['name', 'find', 'expectedError'].some((field) => typeof mutation[field] !== 'string' || mutation[field].length === 0) || typeof mutation.replace !== 'string') throw new Error(`mutation ${index} values are invalid`)
    if (/^(?:AssertionError|Expected)$/.test(mutation.expectedError)) throw new Error(`${mutation.name}: expectedError must identify the violated invariant`)
    const source = production[mutation.file]
    const occurrences = source.split(mutation.find).length - 1
    if (occurrences !== 1) throw new Error(`${mutation.name}: mutation target must occur exactly once, received ${occurrences}`)
    let result
    if (mutation.file === 'normalizer') {
      const artifactPath = join(temp, `initial-position-${index}.mjs`)
      writeFileSync(artifactPath, source.replace(mutation.find, mutation.replace))
      result = spawnSync(process.execPath, ['scripts/transcript-initial-position.test.mjs'], {
        cwd: process.cwd(), encoding: 'utf8',
        env: { ...process.env, FAIRTRADE_INITIAL_POSITION_MODULE: artifactPath },
      })
    } else {
      result = spawnSync(process.execPath, ['scripts/transcript-initial-position.render.test.mjs'], {
        cwd: process.cwd(), encoding: 'utf8',
        env: { ...process.env, FAIRTRADE_SOURCE_MUTATION: JSON.stringify(mutation) },
      })
    }
    if (result.status === 0) throw new Error(`${mutation.name}: executable production mutation survived the focused behavior gate`)
    const output = `${result.stdout}\n${result.stderr}`
    if (!output.includes(mutation.expectedError)) throw new Error(`${mutation.name}: focused gate failed for an unrelated reason; expected ${mutation.expectedError}, received ${output.trim()}`)
  }
} finally {
  rmSync(temp, { recursive: true, force: true })
}

console.log(`transcript initial-position mutations: ${mutations.length} isolated executable production mutations were killed without modifying tracked sources`)
