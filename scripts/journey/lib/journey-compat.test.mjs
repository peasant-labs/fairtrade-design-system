// Compatibility proof for the existing journey surface.
//
// The broad legacy validation path keeps working exactly as before: this
// module proves the current journey helpers still load, the pinned pure
// values are unchanged, and expectTheme still asserts the rendered
// data-theme value under Playwright's own retry budget. It also pins the two
// documented theme paths apart: the legacy project-name fixture stays for
// the broad catalog, and the row-scoped helper binds only explicit row keys.
//
// The vendored boundary is proven by behavior, not by a syntax check. A
// hermetic consumer tree is built in a temporary directory that holds only
// the shared helper bodies plus recording doubles for the two declared
// dependencies, exactly the shape a consumer copies into its own journey
// harness. Loading that copy proves the file resolves in a tree that has no
// app module and no private workspace package; exercising it proves the
// attribute contract a real consumer (a server-rendered data-theme="dark"
// default) depends on and that the retry budget still comes from the
// runner's own polling expectation. Runs with node --test and starts no
// browser, service, or catalog run.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')

const assertions = await import('./assertions.mjs')
const constants = await import('./determinism-constants.mjs')
const determinism = await import('./determinism.mjs')
const fixtures = await import('./fixtures.mjs')

/** The dependency specifiers a byte-vendored journey helper may declare. */
const VENDORED_FILES = ['assertions.mjs', 'determinism.mjs', 'determinism-constants.mjs']

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
 * Build a fake tree whose rendered theme settles after darkReads dark reads,
 * modelling a consumer theme toggle that writes data-theme asynchronously.
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

/**
 * Copy the shared helper bodies into a temporary consumer tree that holds
 * nothing else, then load the copy through that tree's own resolution. The
 * doubles model only the delegated surface of the two declared dependencies:
 * a polling `toHaveAttribute` and a recording axe builder. A vendored body
 * importing an app module, a target registry, or a private workspace package
 * cannot resolve here, which is the property being proven.
 * @returns {Promise<object>} the loaded copy plus its double-side recorders
 */
async function loadVendoredCopy() {
  const scratch = mkdtempSync(join(tmpdir(), 'journey-vendored-load-'))
  const lib = join(scratch, 'scripts', 'journey', 'lib')
  const runnerModule = join(scratch, 'node_modules', '@playwright', 'test')
  const axeModule = join(scratch, 'node_modules', '@axe-core', 'playwright')
  mkdirSync(lib, { recursive: true })
  mkdirSync(runnerModule, { recursive: true })
  mkdirSync(axeModule, { recursive: true })
  for (const file of VENDORED_FILES) {
    writeFileSync(join(lib, file), readFileSync(join(HERE, file), 'utf8'))
  }
  // The polling expectation the real runner provides, so a helper that keeps
  // delegating to it re-reads until the value settles instead of reading once.
  writeFileSync(
    join(runnerModule, 'index.mjs'),
    [
      "export const polls = []",
      'export function expect(received) {',
      '  return {',
      '    toBe: (wanted) => {',
      "      if (received !== wanted) throw new Error(`expected ${String(received)} to be ${String(wanted)}`)",
      '      return undefined',
      '    },',
      '    toHaveAttribute: async (name, wanted) => {',
      '      polls.push({ name, wanted })',
      '      let value',
      '      for (let attempt = 0; attempt < 5; attempt += 1) {',
      '        value = await received[name]()',
      '        if (value === wanted) return undefined',
      '        await new Promise((settle) => setTimeout(settle, 1))',
      '      }',
      "      throw new Error(`expected attribute ${name} to be ${String(wanted)}; got ${String(value)}`)",
      '    },',
      '  }',
      '}',
      '',
    ].join('\n'),
  )
  writeFileSync(join(runnerModule, 'package.json'), '{"name":"@playwright/test","type":"module","exports":"./index.mjs"}\n')
  // The axe builder records the scope chain so a root argument is observable.
  writeFileSync(
    join(axeModule, 'index.mjs'),
    [
      'export const builders = []',
      'export class AxeBuilder {',
      '  constructor({ page }) {',
      '    this.page = page',
      '    this.root = undefined',
      '    builders.push(this)',
      '  }',
      '  withTags(tags) {',
      '    this.tags = tags',
      '    return this',
      '  }',
      '  include(root) {',
      '    this.root = root',
      '    return this',
      '  }',
      '  async analyze() {',
      '    return {',
      "      violations: [{ id: 'color-contrast', impact: 'serious', nodes: [{ target: ['#root'] }] }],",
      "      incomplete: [{ id: 'color-contrast' }],",
      "      passes: [{ id: 'region' }],",
      '    }',
      '  }',
      '}',
      '',
    ].join('\n'),
  )
  writeFileSync(join(axeModule, 'package.json'), '{"name":"@axe-core/playwright","type":"module","exports":"./index.mjs"}\n')
  const url = pathToFileURL(join(lib, 'assertions.mjs')).href
  const loaded = await import(url)
  const runner = await import(pathToFileURL(join(runnerModule, 'index.mjs')).href)
  const axe = await import(pathToFileURL(join(axeModule, 'index.mjs')).href)
  return { scratch, loaded, runner, axe }
}

describe('journey helper compatibility', () => {
  it('keeps every helper module loadable with its current exports', async () => {
    assert.deepEqual(assertions.DEFAULT_AXE_TAGS, ['wcag2a', 'wcag2aa'], 'axe tags must stay pinned')
    for (const symbol of ['scanAxe', 'seriousViolations', 'expectTheme', 'expectComputedTokens']) {
      assert.equal(typeof assertions[symbol], 'function', `${symbol} must stay exported from assertions.mjs`)
    }
    assert.ok(Object.isFrozen(assertions.AXE_RESULT_FIELDS), 'the declared axe result shape must stay frozen')
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

  it('loads the byte-vendored copy in a tree holding only the shared bodies', async () => {
    const { scratch, loaded } = await loadVendoredCopy()
    try {
      for (const symbol of ['scanAxe', 'seriousViolations', 'expectTheme', 'expectComputedTokens']) {
        assert.equal(typeof loaded[symbol], 'function', `${symbol} must load from a vendored tree that has no app module`)
      }
      assert.deepEqual([...loaded.AXE_RESULT_FIELDS], [...assertions.AXE_RESULT_FIELDS], 'the vendored copy must carry the same declared axe result shape')
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it('keeps the vendored theme assertion on the attribute contract a consumer renders', async () => {
    const { scratch, loaded, runner } = await loadVendoredCopy()
    try {
      // A server-rendered data-theme="dark" default is the value a real
      // consumer renders, and the attribute contract is what it must keep.
      await loaded.expectTheme({ locator: () => ({ 'data-theme': async () => 'dark' }) }, 'dark')
      await loaded.expectTheme({ locator: () => ({ 'data-theme': async () => 'light' }) }, 'light')
      assert.deepEqual(
        runner.polls.map((poll) => [poll.name, poll.wanted]),
        [['data-theme', 'dark'], ['data-theme', 'light']],
        'the vendored theme assertion must read the rendered data-theme attribute',
      )
      // The dark-attribute behavior is not negotiable: a body that also
      // accepted an absent value would pass a consumer that never rendered
      // the theme at all.
      await assert.rejects(
        () => loaded.expectTheme({ locator: () => ({ 'data-theme': async () => '' }) }, 'dark'),
        /expected attribute data-theme to be dark/,
        'an absent rendered theme must not satisfy a dark row',
      )
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it('keeps the vendored theme assertion on the runner retry budget', async () => {
    const { scratch, loaded } = await loadVendoredCopy()
    try {
      let reads = 0
      const tree = {
        locator: () => ({
          'data-theme': async () => {
            reads += 1
            return reads < 3 ? '' : 'light'
          },
        }),
      }
      await loaded.expectTheme(tree, 'light')
      assert.ok(reads > 1, `the vendored theme assertion must keep polling until the value settles; got ${reads} read(s)`)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it('keeps the vendored axe result shape declared once for every scope', async () => {
    const { scratch, loaded, axe } = await loadVendoredCopy()
    try {
      const pageWide = await loaded.scanAxe({})
      const scoped = await loaded.scanAxe({}, { root: '#view' })
      assert.deepEqual([...loaded.AXE_RESULT_FIELDS], ['tags', 'violations', 'incomplete', 'passes'], 'the declared axe result shape must stay pinned')
      for (const [label, scan] of [['page-wide', pageWide], ['scoped', scoped]]) {
        assert.deepEqual(Object.keys(scan), [...loaded.AXE_RESULT_FIELDS], `the ${label} scan must carry exactly the declared result fields`)
        assert.deepEqual(
          Object.keys(scan.violations[0]),
          ['id', 'impact', 'nodes'],
          `the ${label} scan must carry the same compact violation fields`,
        )
      }
      assert.deepEqual(
        axe.builders.map((builder) => builder.root),
        [undefined, '#view'],
        'a scan must stay page-wide without a root and honor the root it is given',
      )
      assert.deepEqual(
        axe.builders.map((builder) => builder.tags),
        [loaded.DEFAULT_AXE_TAGS, loaded.DEFAULT_AXE_TAGS],
        'both scopes must run the pinned default axe tags',
      )
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
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
