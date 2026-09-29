#!/usr/bin/env node
/* Mutation proof for a mounted-source part gate. Usage:
     node scripts/parts-mutations.mjs <gate script> <manifest yaml>
   For every mutation the manifest names, re-run the gate with FAIRTRADE_PARTS_MUTATION set, so
   scripts/mounted-parts.mjs rewrites the named production file before it loads. Each run must
   fail, and its output must name the mutation's expected diagnostic: the gate caught the break
   for the intended reason, not an unrelated one. */
import { spawnSync } from 'node:child_process'
import { ROOT, loadStrictYaml, assertExactNames } from './mounted-parts.mjs'

const [gate, manifestPath] = process.argv.slice(2)
if (!gate || !manifestPath) throw new Error('usage: node scripts/parts-mutations.mjs <gate script> <manifest yaml>')
const manifest = loadStrictYaml(manifestPath)
const mutations = manifest.mutations ?? []
if (mutations.length === 0) throw new Error(`${manifestPath}: no mutations to run`)
assertExactNames(mutations.map((mutation) => mutation.name), manifest.requiredMutationNames, `${manifestPath} mutations`)

for (const mutation of mutations) {
  const result = spawnSync(process.execPath, [gate], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FAIRTRADE_PARTS_MUTATION: JSON.stringify(mutation) },
  })
  const output = `${result.stdout}\n${result.stderr}`
  if (result.status === 0) throw new Error(`${mutation.name}: the gate passed with the mutation applied`)
  if (!output.includes(mutation.expectedDiagnostic)) {
    throw new Error(`${mutation.name}: the gate failed for another reason; expected ${JSON.stringify(mutation.expectedDiagnostic)}, received:\n${output.trim()}`)
  }
  console.log(`killed: ${mutation.name}`)
}
console.log(`${gate}: all ${mutations.length} production mutation(s) were killed.`)
