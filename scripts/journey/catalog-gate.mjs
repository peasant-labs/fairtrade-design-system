// List mode loads the real Playwright catalog without launching browsers or servers.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { PROJECT_THEMES } from './theme-rows.mjs'

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
  if (missing.length || extra.length) throw new Error(`catalog membership mismatch: missing ${missing.join(', ')}; extra ${extra.join(', ')}. For an intentional change regenerate with node scripts/journey/catalog-gate.mjs --write and review the diff.`)
}

export function listCatalog() {
  const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--list', '--reporter=json', '--config', 'playwright.journey.config.mjs'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`journey catalog list failed: ${result.stderr || result.stdout || result.error}`)
  return catalogPairs(JSON.parse(result.stdout))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const actual = listCatalog()
    const path = 'scripts/testdata/journey-catalog.json'
    if (process.argv[2] === '--write') {
      if (process.argv.length !== 3) throw new Error('usage: node scripts/journey/catalog-gate.mjs [--write]')
      checkCatalog(actual, actual)
      const projects = new Set(actual.map((pair) => pair.project))
      if (projects.size !== PROJECT_THEMES.length || PROJECT_THEMES.some((project) => !projects.has(project))) throw new Error('cannot regenerate: the live catalog must contain both journey projects')
      actual.sort((a, b) => a.project.localeCompare(b.project) || a.title.localeCompare(b.title))
      writeFileSync(path, `${JSON.stringify(actual, null, 2)}\n`)
      console.log(`wrote ${path}; review the diff before committing`)
    } else {
      if (process.argv.length !== 2) throw new Error('usage: node scripts/journey/catalog-gate.mjs [--write]')
      checkCatalog(actual, JSON.parse(readFileSync(path, 'utf8')))
    }
    console.log('journey catalog:', Object.fromEntries([...new Set(actual.map((pair) => pair.project))].map((project) => [project, actual.filter((pair) => pair.project === project).length])))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
