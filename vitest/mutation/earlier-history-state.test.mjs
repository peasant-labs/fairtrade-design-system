import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import YAML from 'yaml'

// Compile isolated copies, never editing a tracked source read by another lane.
const root = process.cwd()
const fixture = YAML.parse(readFileSync(resolve(root, 'scripts/testdata/transcript-segments.yaml'), 'utf8'))
const manifest = YAML.parse(readFileSync(resolve(root, 'scripts/testdata/transcript-segments.manifest.yaml'), 'utf8'))

describe('earlier history state type mutations', () => {
  it('runs the complete named mutation inventory', () => {
    expect(fixture.typeMutations.map(row => row.name).sort()).toEqual([...manifest.requiredTypeMutationNames].sort())
  })
  for (const row of fixture.typeMutations) {
    it(row.name, () => {
      const scratch = mkdtempSync(join(tmpdir(), 'fairtrade-history-type-'))
      try {
        const target = join(scratch, 'src/ui/transcript')
        mkdirSync(target, { recursive: true })
        cpSync(resolve(root, 'src/ui/closed-value.js'), join(scratch, 'src/ui/closed-value.js'))
        for (const name of ['earlier-history-state.js', 'earlier-history-state.contract.type-test.js']) cpSync(resolve(root, 'src/ui/transcript', name), join(target, name))
        symlinkSync(resolve(root, 'node_modules'), join(scratch, 'node_modules'), 'dir')
        writeFileSync(join(scratch, 'tsconfig.json'), JSON.stringify({ compilerOptions: { allowJs: true, checkJs: false, strict: true, noEmit: true, module: 'ESNext', moduleResolution: 'Bundler', target: 'ES2020', skipLibCheck: true }, include: ['src/ui/transcript/earlier-history-state.contract.type-test.js'] }))
        const compile = () => spawnSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', join(scratch, 'tsconfig.json')], { cwd: scratch, encoding: 'utf8', timeout: 60_000 })
        const baseline = compile()
        expect(baseline.status, `${baseline.stdout}\n${baseline.stderr}`).toBe(0)
        const path = join(target, 'earlier-history-state.js')
        const source = readFileSync(path, 'utf8')
        expect(source.split(row.find)).toHaveLength(2)
        writeFileSync(path, source.replace(row.find, row.replace))
        const result = compile()
        const test = readFileSync(join(target, 'earlier-history-state.contract.type-test.js'), 'utf8')
        const line = test.slice(0, test.indexOf('const allMembers = true')).split('\n').length
        expect(result.status).not.toBe(0)
        expect(result.stdout).toContain(`earlier-history-state.contract.type-test.js(${line},`)
        expect(result.stdout).toContain("Type 'true' is not assignable to type 'never'")
      } finally {
        rmSync(scratch, { recursive: true, force: true })
      }
    }, 120_000)
  }
})
