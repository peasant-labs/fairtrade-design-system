// List mode loads the real Playwright catalog without launching browsers or servers.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function catalogPairs(report) {
  const pairs = []
  function visit(suite, ancestors) {
    const path = [...ancestors, suite.title]
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) pairs.push({ project: test.projectName, title: [...path, spec.title].join(' › ') })
    }
    for (const child of suite.suites || []) visit(child, path)
  }
  for (const suite of report.suites || []) visit(suite, [])
  return pairs
}

export function checkCatalog(actual, expected) {
  const key = (pair) => JSON.stringify([pair.project, pair.title])
  const keys = (pairs, label) => {
    const result = new Set()
    for (const pair of pairs) {
      if (!pair || typeof pair.project !== 'string' || !pair.project || typeof pair.title !== 'string' || !pair.title) throw new Error(`${label}: invalid project/title pair`)
      const value = key(pair)
      if (result.has(value)) throw new Error(`${label}: duplicate ${value}`)
      result.add(value)
    }
    return result
  }
  const observed = keys(actual, 'catalog')
  const required = keys(expected, 'manifest')
  const missing = [...required].filter((value) => !observed.has(value))
  const extra = [...observed].filter((value) => !required.has(value))
  if (missing.length || extra.length) throw new Error(`catalog membership mismatch: missing ${missing.join(', ')}; extra ${extra.join(', ')}`)
}

export function listCatalog() {
  const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--list', '--reporter=json', '--config', 'playwright.journey.config.mjs'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`journey catalog list failed: ${result.stderr || result.stdout || result.error}`)
  return catalogPairs(JSON.parse(result.stdout))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const expected = JSON.parse(readFileSync('scripts/testdata/journey-catalog.json', 'utf8'))
    const actual = listCatalog()
    checkCatalog(actual, expected)
    console.log('journey catalog:', Object.fromEntries([...new Set(actual.map((pair) => pair.project))].map((project) => [project, actual.filter((pair) => pair.project === project).length])))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
