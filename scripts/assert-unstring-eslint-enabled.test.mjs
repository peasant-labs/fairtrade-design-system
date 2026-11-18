import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { assertExactNames } from './css-source.mjs'
import { checkDirectory } from './assert-unstring-eslint-enabled.mjs'

const fixture = YAML.parse(await readFile(new URL('./testdata/unstring-eslint-guard.yaml', import.meta.url), 'utf8'))
const manifest = YAML.parse(await readFile(new URL('./testdata/unstring-eslint-guard.manifest.yaml', import.meta.url), 'utf8'))
assertExactNames(fixture.cases.map((entry) => entry.name), manifest.requiredCaseNames, 'ESLint guard cases')

const directory = await mkdtemp(join(tmpdir(), 'unstring-eslint-guard-'))
try {
  for (const entry of fixture.cases) {
    await writeFile(join(directory, 'source.jsx'), entry.source)
    if (entry.rejected) {
      await assert.rejects(checkDirectory(directory), /unstring\/closed-set-literal/, entry.name)
    } else {
      await assert.doesNotReject(checkDirectory(directory), entry.name)
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true })
}
console.log('ESLint guard fixture cases passed')
