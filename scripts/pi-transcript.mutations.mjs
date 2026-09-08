import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import YAML from 'yaml'

const manifest = YAML.parse(readFileSync('scripts/testdata/pi-transcript.manifest.yaml', 'utf8'), { strict: true, uniqueKeys: true })
if (manifest.mutations?.length !== 1 || manifest.mutations[0] !== 'namespace-presence-dispatch') throw new Error('Pi transcript mutation inventory is incomplete')
const source = readFileSync('src/ui/transcript/adapter.js', 'utf8')
const find = ' || hasToolNamespace ||'
if (source.split(find).length !== 2) throw new Error('namespace presence mutation target must occur exactly once')
const temp = mkdtempSync(join(tmpdir(), 'fairtrade-pi-transcript-'))
try {
  const artifact = join(temp, 'adapter.mjs')
  const rewritten = source
    .replaceAll("from './adapter.parse.js'", `from '${new URL('../src/ui/transcript/adapter.parse.js', import.meta.url).href}'`)
    .replaceAll("from './analytics.js'", `from '${new URL('../src/ui/transcript/analytics.js', import.meta.url).href}'`)
    .replaceAll("from './usage.js'", `from '${new URL('../src/ui/transcript/usage.js', import.meta.url).href}'`)
    .replace("from '@peasant-labs/schema'", `from '${pathToFileURL(resolve('node_modules/@peasant-labs/schema/dist/index.js')).href}'`)
    .replace(find, ' ||')
  writeFileSync(artifact, rewritten)
  const result = spawnSync(process.execPath, ['scripts/pi-transcript.test.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, FAIRTRADE_PI_ADAPTER_MODULE: artifact },
  })
  const output = `${result.stdout}\n${result.stderr}`
  if (result.status === 0) throw new Error('namespace presence dispatch mutation survived the production adapter gate')
  if (!output.includes('namespace-non-pi-null-rejected')) throw new Error(`namespace mutation failed for an unrelated reason: ${output.trim()}`)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
console.log('Pi transcript mutations: namespace presence dispatch mutation killed.')
