import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, dirname, resolve } from 'node:path'
import { assertDataTableHostBoundary } from './datatable-host-boundary.mjs'
import { loadDataTableFixtures } from './datatable-fixtures.mjs'

const fixtures = loadDataTableFixtures()
const files = assertDataTableHostBoundary()
for (const mutation of fixtures.guardMutations) {
  const scratch = mkdtempSync(join(tmpdir(), 'datatable-boundary-'))
  try {
    for (const file of files) {
      const copy = join(scratch, relative(resolve('.'), file))
      mkdirSync(dirname(copy), { recursive: true })
      writeFileSync(copy, readFileSync(file))
    }
    const entry = join(scratch, 'src/ui/DataTable.jsx')
    if (mutation.helper) {
      writeFileSync(join(dirname(entry), 'table-helper.js'), mutation.code)
      writeFileSync(entry, readFileSync(entry, 'utf8') + '\nimport "./table-helper.js"\n')
    } else writeFileSync(entry, readFileSync(entry, 'utf8') + '\n' + mutation.code)
    assert.throws(() => assertDataTableHostBoundary(entry), (error) => error.message.includes('DataTable host boundary:') && error.message.includes(`accesses ${mutation.diagnostic}`), mutation.name)
    console.log(`killed: ${mutation.name}`)
  } finally { rmSync(scratch, { recursive: true, force: true }) }
}
console.log('DataTable host boundary passes on production imports')
