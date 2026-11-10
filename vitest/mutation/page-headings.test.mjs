import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import YAML from 'yaml'

/* Mutation pilot: the mutation orchestrator stays a subprocess. That is
 * deliberate. Each mutant needs its own Vite transform and its own process so
 * the tracked source is never edited and one mutant cannot leak into the next.
 * Running the orchestrator from Vitest proves the runner can drive that
 * isolation without flattening it into one shared module graph. */

// Vitest exposes a transformed import.meta.url, not always a file: URL, so the
// repository root and fixture path come from the command's working directory.
const ROOT = process.cwd()
const PKG = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
const mutationScript = PKG.scripts['test:page-headings:mutations']
if (typeof mutationScript !== 'string') throw new Error('package.json: test:page-headings:mutations must be declared')
const command = mutationScript.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
if (command[0] !== 'node' || command.length < 4) {
  throw new Error(`package.json: test:page-headings:mutations must be a node orchestrator command; got ${JSON.stringify(mutationScript)}`)
}
const manifestRel = command[command.length - 1]
const manifest = YAML.parse(readFileSync(resolve(ROOT, manifestRel), 'utf8'))
const mutationCount = manifest.mutations.length

describe('mutation orchestrator under Vitest', () => {
  it('kills every page-headings mutant for its intended diagnostic', () => {
    const result = spawnSync(
      process.execPath,
      command.slice(1),
      { cwd: ROOT, encoding: 'utf8', timeout: 120_000 },
    )
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(result.stdout).toContain(`all ${mutationCount} production mutation(s) were killed`)
  }, 150_000)
})
