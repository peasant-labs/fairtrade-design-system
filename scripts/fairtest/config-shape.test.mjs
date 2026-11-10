// @ts-check

// Browser-free shape guard for the Fairtest Playwright config.
//
// Required CI runs this through `test:fairtest:envelope`. The full
// fixture-backed check stays in `product-adapter.test.mjs` under the deferred
// product contract; this file owns the invariants a re-added fixed origin, a
// second project, a lost fullyParallel, or a changed worker/retry budget would
// violate, so those regressions fail the required contracts step.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { FAIRTEST_DEFAULT_MOUNTED_WORKERS, FAIRTEST_MOUNTED_WORKERS, PRODUCT_VIEWPORT } from './fairtest-runtime.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CONFIG_PATH = join(ROOT, 'playwright.fairtest.config.mjs')
const configModule = await import(pathToFileURL(CONFIG_PATH).href)
const config = /** @type {{
  workers?: unknown,
  fullyParallel?: unknown,
  retries?: unknown,
  testDir?: unknown,
  testMatch?: unknown,
  timeout?: unknown,
  projects?: Array<{ name?: string }>,
  use?: { baseURL?: unknown, viewport?: Record<string, unknown>, reducedMotion?: unknown },
  expect?: { timeout?: unknown },
  webServer?: unknown,
}} */ (configModule.default)

test('the Fairtest config keeps one project and no runner-managed server', () => {
  assert.deepEqual((config.projects ?? []).map((project) => project.name), ['fairtest'])
  assert.ok(!('webServer' in config), 'the adapter owns the service lifecycle, so the config must declare no webServer')
  assert.ok(!('baseURL' in (config.use ?? {})), 'rows navigate by the running worker driver.baseUrl, so the config must declare no fixed use.baseURL')
})

test('the Fairtest config keeps the parallel row budget', () => {
  assert.equal(config.fullyParallel, true)
  assert.equal(config.workers, FAIRTEST_MOUNTED_WORKERS)
  assert.equal(config.retries, 0)
  assert.equal(FAIRTEST_DEFAULT_MOUNTED_WORKERS, 4)
})

test('the worker override reaches the config without changing the declared default', () => {
  const result = spawnSync(process.execPath, ['-e', "import('./playwright.fairtest.config.mjs').then((module) => console.log(module.default.workers))"], {
    cwd: ROOT,
    env: { ...process.env, FAIRTEST_MOUNTED_WORKERS: '8' },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), '8')
})

test('the Fairtest config declares no loopback origin', () => {
  for (const key of ['FAIRTEST_APP_HOST', 'FAIRTEST_APP_PORT', 'FAIRTEST_APP_BASE_URL']) {
    assert.ok(!(key in configModule), `the config must not re-export ${key}; fairtest-runtime.mjs is the only loopback origin owner`)
  }
})

test('the Fairtest config selects exactly the mounted journeys', () => {
  assert.equal(config.testDir, './scripts/fairtest')
  const configuredMatch = config.testMatch
  const matches = typeof configuredMatch === 'string'
    ? [configuredMatch]
    : Array.isArray(configuredMatch)
      ? /** @type {string[]} */ (configuredMatch)
      : []
  assert.deepEqual(matches, ['**/product.journey.mjs', '**/component.journey.mjs'])
  const journeyModules = readdirSync(join(ROOT, 'scripts', 'fairtest'))
    .filter((name) => name.endsWith('.journey.mjs'))
    .sort()
  assert.ok(journeyModules.length > 0, 'the Fairtest journey directory must stay populated')
  for (const module of journeyModules) {
    assert.ok(
      matches.some((pattern) => pattern.includes(module.replace(/\.mjs$/, ''))),
      `the config leaves the mounted journey ${JSON.stringify(module)} unselected`,
    )
  }
})

test('the Fairtest config keeps the evidence viewport and reduced motion', () => {
  assert.deepEqual({ ...(config.use?.viewport ?? {}) }, { ...PRODUCT_VIEWPORT })
  assert.equal(config.use?.reducedMotion, 'reduce')
  assert.equal(config.timeout, 120_000)
  assert.equal(config.expect?.timeout, 15_000)
})
