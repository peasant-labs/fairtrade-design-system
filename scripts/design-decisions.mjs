import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, loadStrictYaml, assertExactNames } from './css-source.mjs'

/** @typedef {{file: string, contains: string}} Reference */
/** @typedef {{name: string, id: number, disposition: 'DEMO'|'RECORD'|'SPLIT', binding: null|{codeReference: Reference, pointerRemoved: string, lineRemoved: string|null, lineRemovalNote?: string, restatingFilesAmended: Reference[]}}} Decision */

export function loadDecisionFixtures() {
  /** @type {{decisions: Decision[]}} */
  const register = loadStrictYaml('scripts/testdata/design-decisions.yaml')
  /** @type {{requiredNames: string[], requiredCases: string[], requiredMutations: string[]}} */
  const manifest = loadStrictYaml('scripts/testdata/design-decisions.manifest.yaml')
  /** @type {{sourceRoots: string[], allowedMiddots: string[], restatingFiles: string[], cases: Array<{name: string, row?: Decision, sources: Record<string,string>}>, mutations: Array<{name: string, case: string, file?: string, append?: string, replace?: string, clearBinding?: boolean, error: string}>}} */
  const guards = loadStrictYaml('scripts/testdata/design-decision-guards.yaml')
  assertExactNames(register.decisions.map(row => row.name), manifest.requiredNames, 'design decisions')
  assert.deepEqual(guards.sourceRoots, ['src/ui', 'src/mockups'], 'middot scan must cover both complete source trees')
  assert.deepEqual(guards.allowedMiddots, [], 'middot allowed set must remain empty')
  assert.deepEqual(guards.restatingFiles, ['DESIGN.md', 'llm/NEUROINCLUSIVE.md', 'AGENTS.md', 'CONTRIBUTING.md', 'llms.txt', 'scripts/gen-llm-artifacts.mjs'], 'record scan coverage')
  register.decisions.forEach((row, index) => {
    assert.equal(row.id, index + 1, `${row.name}: decision id/order changed`)
    assert.ok(['DEMO', 'RECORD', 'SPLIT'].includes(row.disposition), `${row.name}: unknown disposition`)
    assert.ok(row.binding === null || (row.binding && typeof row.binding === 'object'), `${row.name}: binding must be null or evidence`)
  })
  return { register, guards, manifest }
}

/** @param {Record<string,string>} sources @param {string[]} allowed */
export function assertNoMiddots(sources, allowed) {
  assert.deepEqual(allowed, [], 'middot allowed set must remain empty')
  const violations = []
  for (const [file, source] of Object.entries(sources)) {
    source.split('\n').forEach((line, index) => {
      if (line.includes('\u00b7')) violations.push(`${file}:${index + 1}`)
    })
  }
  assert.equal(violations.length, 0, `middot forbidden during source audit at ${violations.join(', ')}; replace separators in the final source sweep before enabling this gate`)
}

/** @param {Decision} row @param {Record<string,string>} sources @param {string[]} restatingFiles */
export function assertDecisionResolved(row, sources, restatingFiles) {
  const binding = row.binding
  assert.ok(binding, `${row.name}: unresolved decision; bind existing code and record amendments before claiming resolution`)
  const verifyReference = (reference, kind) => {
    assert.ok(reference && typeof reference.file === 'string' && typeof reference.contains === 'string' && reference.contains.trim(), `${row.name}: ${kind} evidence requires a file and nonempty source excerpt`)
    assert.ok(sources[reference.file]?.includes(reference.contains), `${row.name}: ${kind} reference missing at ${reference.file}; record evidence only after its source exists`)
  }
  assert.ok(typeof binding.codeReference?.file === 'string' && binding.codeReference.file.startsWith('src/'), `${row.name}: code evidence must reference src/`)
  verifyReference(binding.codeReference, 'code')
  assert.equal(binding.pointerRemoved, `#136/${row.id}`, `${row.name}: pointer identity`)
  assert.ok((typeof binding.lineRemoved === 'string' && binding.lineRemoved.includes(binding.pointerRemoved)) ||
    (binding.lineRemoved === null && typeof binding.lineRemovalNote === 'string' && binding.lineRemovalNote.trim()),
  `${row.name}: record the exact removed conflict line, or explain why no original line existed`)
  assert.ok(Array.isArray(binding.restatingFilesAmended) && binding.restatingFilesAmended.length > 0, `${row.name}: record restating-file amendments`)
  const amended = new Set()
  for (const reference of binding.restatingFilesAmended) {
    assert.ok(restatingFiles.includes(reference.file) && !amended.has(reference.file), `${row.name}: unknown or duplicate restating file ${reference.file}`)
    amended.add(reference.file)
    verifyReference(reference, 'record')
  }
  assert.ok(amended.has('DESIGN.md'), `${row.name}: canonical record amendment missing`)
  const pointer = new RegExp(`#136/${row.id}(?![0-9])`)
  for (const file of restatingFiles) {
    assert.equal(typeof sources[file], 'string', `${row.name}: cannot audit missing restating file ${file}`)
    assert.ok(!pointer.test(sources[file]), `${row.name}: resolved pointer retained at ${file}; remove the pointer and conflict line before binding`)
    if (binding.lineRemoved !== null) assert.ok(!sources[file].includes(binding.lineRemoved), `${row.name}: conflict line retained at ${file}`)
  }
}

function readSources(roots) {
  const sources = {}
  const visit = file => {
    for (const entry of readdirSync(join(ROOT, file), {withFileTypes: true})) {
      const child = `${file}/${entry.name}`
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile()) sources[child] = readFileSync(join(ROOT, child), 'utf8')
      else throw new Error(`source audit cannot inspect ${child}; replace symlinks or special files with auditable source files`)
    }
  }
  roots.forEach(visit)
  return sources
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {register, guards} = loadDecisionFixtures()
  const sourceTrees = readSources(guards.sourceRoots)
  const sources = {...sourceTrees}
  for (const file of guards.restatingFiles) sources[file] = readFileSync(join(ROOT, file), 'utf8')
  const failures = []
  try { assertNoMiddots(sourceTrees, guards.allowedMiddots) } catch (error) { failures.push(error.message) }
  for (const row of register.decisions) {
    try { assertDecisionResolved(row, sources, guards.restatingFiles) } catch (error) { failures.push(error.message) }
  }
  if (failures.length) {
    console.error(failures.join('\n'))
    process.exitCode = 1
  } else console.log('PASS design decision resolution and middot source audit')
}
