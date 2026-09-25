// Compatibility proof for the existing journey surface.
//
// The broad legacy validation path keeps working exactly as before: this
// module proves the current journey helpers still load, the pinned pure
// values are unchanged, and expectTheme still accepts absent/empty as dark
// and light as light, still rejects a wrong value, and still waits for a
// settling value instead of failing on the first read. It also pins the two
// documented theme paths apart: the legacy project-name fixture stays for
// the broad catalog, and the row-scoped helper binds only explicit row keys.
// Runs with node --test and starts no browser, service, or catalog run.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')

const assertions = await import('./assertions.mjs')
const constants = await import('./determinism-constants.mjs')
const determinism = await import('./determinism.mjs')
const fixtures = await import('./fixtures.mjs')

/**
 * Build a fake tree handle serving one canned attribute value.
 * @param {unknown} renderedAttribute canned raw attribute value, absent as nullish
 */
function fakeThemeTree(renderedAttribute) {
  return {
    locator: (selector) => ({
      getAttribute: async (attributeName) => {
        assert.equal(selector, 'html', 'expectTheme must read the root element')
        assert.equal(attributeName, 'data-theme', 'expectTheme must read the rendered theme attribute')
        return renderedAttribute
      },
    }),
  }
}

/**
 * Build a fake tree whose rendered theme settles after darkReads dark reads.
 * @param {object} [input] settling behavior
 */
function fakeSettlingThemeTree({ darkReads = 3, settledValue = 'light' } = {}) {
  let calls = 0
  return {
    calls: () => calls,
    locator: () => ({
      getAttribute: async () => {
        calls += 1
        await new Promise((responseResolve) => setTimeout(responseResolve, 5))
        return calls <= darkReads ? null : settledValue
      },
    }),
  }
}

describe('journey helper compatibility', () => {
  it('keeps every helper module loadable with its current exports', async () => {
    assert.deepEqual(assertions.DEFAULT_AXE_TAGS, ['wcag2a', 'wcag2aa'], 'axe tags must stay pinned')
    for (const symbol of ['scanAxe', 'seriousViolations', 'expectTheme', 'expectComputedTokens']) {
      assert.equal(typeof assertions[symbol], 'function', `${symbol} must stay exported from assertions.mjs`)
    }
    assert.equal(typeof determinism.installDeterminism, 'function', 'installDeterminism must stay exported from determinism.mjs')
    assert.equal(typeof fixtures.test, 'function', 'test must stay exported from fixtures.mjs')
    assert.equal(typeof fixtures.storyUrl, 'function', 'storyUrl must stay exported from fixtures.mjs')
    assert.equal(typeof fixtures.resolveRowTheme, 'function', 'resolveRowTheme must stay exported from fixtures.mjs')
    assert.deepEqual(
      assertions.seriousViolations({ violations: [{ impact: 'critical' }, { impact: 'minor' }] }).map((entry) => entry.impact),
      ['critical'],
      'serious violations must still filter critical and serious impact only',
    )
    assert.equal(fixtures.storyUrl('demo-id', 'light'), '/iframe.html?id=demo-id&viewMode=story&globals=theme:light')
    assert.equal(fixtures.storyUrl('demo-id', 'dark'), '/iframe.html?id=demo-id&viewMode=story')
  })

  it('keeps the pinned pure values byte-identical', () => {
    assert.equal(constants.FROZEN_EPOCH_MS, Date.UTC(2024, 0, 1, 12, 0, 0), 'FROZEN_EPOCH_MS must stay pinned')
    assert.equal(constants.PRNG_SEED, 0x9e3779b9, 'PRNG_SEED must stay pinned')
    assert.equal(determinism.FROZEN_EPOCH_MS, constants.FROZEN_EPOCH_MS, 'determinism re-export must hold value identity')
    assert.equal(determinism.PRNG_SEED, constants.PRNG_SEED, 'determinism re-export must hold value identity')
  })

  it('still accepts absent and empty as dark and light as light', { timeout: 15000 }, async () => {
    await assertions.expectTheme(fakeThemeTree(null), 'dark')
    await assertions.expectTheme(fakeThemeTree(''), 'dark')
    await assertions.expectTheme(fakeThemeTree('light'), 'light')
  })

  it('still rejects a wrong value and a contradiction instead of passing', { timeout: 15000 }, async () => {
    await assert.rejects(
      () => assertions.expectTheme(fakeThemeTree('dark'), 'dark', { timeoutMs: 120, pollMs: 10 }),
      /"dark".*renderedAttribute.*at path.*repair:/s,
      'wrong rendered value must fail',
    )
    await assert.rejects(
      () => assertions.expectTheme(fakeThemeTree(null), 'light', { timeoutMs: 120, pollMs: 10 }),
      /at path.*"light".*"dark".*repair:/s,
      'contradictory observation must fail',
    )
  })

  it('still waits for a settling value instead of failing on the first read', { timeout: 15000 }, async () => {
    const tree = fakeSettlingThemeTree({ darkReads: 3, settledValue: 'light' })
    await assertions.expectTheme(tree, 'light')
    assert.ok(tree.calls() > 3, `retry must re-read until the value settles; got ${tree.calls()} read(s)`)
  })

  it('keeps the two theme paths apart: project name for the catalog, row key for Fairtest', () => {
    const text = readFileSync(join(HERE, 'fixtures.mjs'), 'utf8')
    assert.ok(text.includes('testInfo.project.name'), 'legacy theme fixture must keep reading the project name for the broad catalog')
    assert.equal(fixtures.resolveRowTheme('dark'), 'dark')
    assert.equal(fixtures.resolveRowTheme('light'), 'light')
    assert.throws(
      () => fixtures.resolveRowTheme('product-dark'),
      /"product-dark".*field "rowKey".*at path fixtures\.rowTheme.*repair:/s,
      'row-scoped helper must reject a project name instead of inferring from it',
    )
    assert.throws(
      () => fixtures.resolveRowTheme('dusk'),
      /"dusk".*field "rowKey".*at path fixtures\.rowTheme.*repair:/s,
      'row-scoped helper must reject an unknown row key',
    )
  })

  it('keeps the broad legacy validation path syntactically intact and scoped', () => {
    for (const file of [
      join('scripts', 'journey', 'app-validate.journey.mjs'),
      join('scripts', 'journey', 'lib', 'assertions.mjs'),
      join('scripts', 'journey', 'lib', 'determinism.mjs'),
      join('scripts', 'journey', 'lib', 'determinism-constants.mjs'),
      join('scripts', 'journey', 'lib', 'fixtures.mjs'),
      'playwright.journey.config.mjs',
    ]) {
      execFileSync('node', ['--check', file], { cwd: ROOT, stdio: 'pipe' })
    }
    const text = readFileSync(join(ROOT, 'scripts', 'journey', 'app-validate.journey.mjs'), 'utf8')
    assert.ok(text.includes('passes the twenty interaction checks'), 'legacy path must keep its twenty-check test')
    assert.ok(text.includes('http://localhost:5180/?fb=off'), 'legacy path must keep driving the built documentation page')
  })
})
