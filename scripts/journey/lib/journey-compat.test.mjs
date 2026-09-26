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
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const SHAPE_CORPUS_REL = 'scripts/journey/lib/journey-compat.testdata.yaml'
const SHAPE_MANIFEST_REL = 'scripts/journey/lib/journey-compat.testdata.manifest.yaml'

const assertions = await import('./assertions.mjs')
const constants = await import('./determinism-constants.mjs')
const determinism = await import('./determinism.mjs')
const fixtures = await import('./fixtures.mjs')

/** The dependency specifiers a byte-vendored journey helper may declare. */
const VENDORED_FILES = ['assertions.mjs', 'determinism.mjs', 'determinism-constants.mjs']

/** Exact fields every call-shape inventory row carries. */
const SHAPE_FIELDS = ['name', 'shape', 'accepted', 'expected_tags', 'expected_root', 'expected_shape_phrase']

/** Parse exactly one YAML document, refusing trailing documents and non-record roots. */
function loadSingleDocument(source, label) {
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  if (documents.length !== 1) {
    throw new Error(`${label}: fixture must hold exactly one document at path document; repair: remove every trailing document from ${label}.`)
  }
  const [parsed] = documents
  if (parsed.errors.length > 0) {
    throw new Error(`${label}: invalid YAML at path document; ${parsed.errors.map((entry) => entry.message).join('; ')}; repair: fix the YAML syntax in ${label}.`)
  }
  const value = parsed.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}: document root must be a record at path document; repair: restore the mapping root in ${label}.`)
  }
  return value
}

/** Assert the record holds exactly the declared fields. */
function checkKeys(value, fields, tag, label, path) {
  const where = path ? ` at path ${path}` : ''
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${tag}: record is missing or malformed${where} in ${label}; repair: restore the record with exactly: ${fields.join(', ')}.`)
  }
  for (const field of fields) {
    if (!(field in value)) {
      throw new Error(`${tag}: missing required field "${field}"${where} in ${label}; repair: restore "${field}" in ${label}.`)
    }
  }
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) {
      throw new Error(`${tag}: unknown field "${key}"${where} in ${label}; repair: remove "${key}" from ${label}.`)
    }
  }
}

/** Assert the actual names match the required inventory exactly, with no duplicates. */
function checkRequiredNames(actual, required, label) {
  if (new Set(actual).size !== actual.length) {
    throw new Error(`${label}: duplicate record name at path records; repair: give every record a unique required name.`)
  }
  for (const name of required) {
    if (!actual.includes(name)) {
      throw new Error(`${label}: required record inventory mismatch at path records; missing required record "${name}"; repair: restore the "${name}" record or update the manifest required names.`)
    }
  }
  for (const name of actual) {
    if (!required.includes(name)) {
      throw new Error(`${label}: required record inventory mismatch at path records; unknown record "${name}"; repair: remove the "${name}" record or register it in the manifest required names.`)
    }
  }
}

/**
 * Materialize one inventory row as the exact call a consumer would write.
 * @param {Record<string, unknown>} row one call-shape inventory row
 * @param {(page: object) => Promise<unknown>} scanAxe the vendored helper under test
 * @returns {Promise<unknown>} the helper's promise for that call
 */
function callShape(row, scanAxe) {
  const page = {}
  switch (row.shape) {
    case 'no_options':
      return scanAxe(page)
    case 'empty_options':
      return scanAxe(page, {})
    case 'object_tags':
      return scanAxe(page, { tags: row.expected_tags })
    case 'object_root':
      return scanAxe(page, { root: row.expected_root })
    case 'array_tags':
      return scanAxe(page, row.expected_tags)
    case 'positional_root':
      return scanAxe(page, row.expected_root)
    case 'null_options':
      return scanAxe(page, null)
    default:
      throw new Error(`${SHAPE_CORPUS_REL}: row "${row.name}" names an unknown shape ${JSON.stringify(row.shape)} at path shapes[].shape; repair: use one of no_options, empty_options, object_tags, object_root, array_tags, positional_root, null_options for "shape".`)
  }
}

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

  it('takes one accepted scanAxe call shape and refuses a stale one before any scan', async () => {
    const manifest = loadSingleDocument(readFileSync(join(HERE, 'journey-compat.testdata.manifest.yaml'), 'utf8'), SHAPE_MANIFEST_REL)
    const corpus = loadSingleDocument(readFileSync(join(HERE, 'journey-compat.testdata.yaml'), 'utf8'), SHAPE_CORPUS_REL)
    checkKeys(manifest, ['expectedShapeCount', 'requiredShapeNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'manifest record', SHAPE_MANIFEST_REL, 'manifest record')
    checkKeys(corpus, ['expectedShapeCount', 'shapes'], 'corpus record', SHAPE_CORPUS_REL, 'corpus record')
    const shapes = corpus.shapes
    assert.ok(Array.isArray(shapes) && shapes.length > 0, `${SHAPE_CORPUS_REL}: inventory holds no rows at path shapes; repair: restore the call-shape rows.`)
    assert.equal(shapes.length, manifest.expectedShapeCount, `${SHAPE_CORPUS_REL}: shape count must match the manifest at path expectedShapeCount; repair: align the shapes list with the manifest.`)
    assert.equal(corpus.expectedShapeCount, shapes.length, `${SHAPE_CORPUS_REL}: shape count must equal the row inventory at path expectedShapeCount; repair: align expectedShapeCount with the shapes list.`)
    checkRequiredNames(shapes.map((row) => row.name), manifest.requiredShapeNames, SHAPE_CORPUS_REL)
    for (const row of shapes) {
      checkKeys(row, SHAPE_FIELDS, 'shape row', SHAPE_CORPUS_REL, `shapes.${row.name}`)
      assert.equal(typeof row.accepted, 'boolean', `${SHAPE_CORPUS_REL}: row "${row.name}" must state a boolean at path shapes.${row.name}.accepted; repair: set accepted to true or false.`)
      assert.ok(Array.isArray(row.expected_tags) && row.expected_tags.length > 0, `${SHAPE_CORPUS_REL}: row "${row.name}" must name the axe tags at path shapes.${row.name}.expected_tags; repair: list the tags the call is expected to run.`)
      assert.ok(row.expected_root === null || typeof row.expected_root === 'string', `${SHAPE_CORPUS_REL}: row "${row.name}" must state a selector or null at path shapes.${row.name}.expected_root; repair: use a selector string or null.`)
      if (row.accepted) {
        assert.equal(row.expected_shape_phrase, null, `${SHAPE_CORPUS_REL}: accepted row "${row.name}" must not name a refusal at path shapes.${row.name}.expected_shape_phrase; repair: set the phrase to null for an accepted shape.`)
      } else {
        assert.ok(typeof row.expected_shape_phrase === 'string' && row.expected_shape_phrase.length > 0, `${SHAPE_CORPUS_REL}: refused row "${row.name}" must name the shape its diagnostic reports at path shapes.${row.name}.expected_shape_phrase; repair: state the phrase the refusal must contain.`)
      }
    }
    // The live body, not only a copy: a consumer that has not re-vendored its
    // call sites still reaches this module, so the refusal is asserted here too.
    for (const row of shapes) {
      if (row.accepted) continue
      await assert.rejects(
        () => callShape(row, assertions.scanAxe),
        new RegExp(`${row.expected_shape_phrase}[\\s\\S]*field "options"[\\s\\S]*at path assertions\\.scanAxe\\.options[\\s\\S]*repair:`),
        `row "${row.name}": the live helper must refuse a stale call shape with an actionable diagnostic`,
      )
    }
    // The copied body, through a real axe run: the refusal must land before any
    // builder exists, so a stale call site can never report a page-wide scan.
    const { scratch, loaded, axe } = await loadVendoredCopy()
    try {
      for (const row of shapes) {
        const buildersBefore = axe.builders.length
        if (row.accepted) {
          const scan = await callShape(row, loaded.scanAxe)
          assert.deepEqual(Object.keys(scan), [...loaded.AXE_RESULT_FIELDS], `row "${row.name}": an accepted shape must still return the declared axe result shape`)
          const builder = axe.builders.at(-1)
          assert.deepEqual(builder.tags, row.expected_tags, `row "${row.name}": the accepted shape must run its own tags`)
          assert.equal(builder.root ?? null, row.expected_root, `row "${row.name}": the accepted shape must scope the run to its own root`)
          assert.equal(axe.builders.length, buildersBefore + 1, `row "${row.name}": an accepted shape must construct exactly one axe run`)
          continue
        }
        await assert.rejects(
          () => callShape(row, loaded.scanAxe),
          (error) => {
            assert.ok(error instanceof TypeError, `row "${row.name}": a refused shape must raise a type error; got ${error}`)
            assert.ok(error.message.includes(row.expected_shape_phrase), `row "${row.name}": diagnostic does not name the shape the caller passed; got ${error.message}`)
            assert.ok(error.message.includes('at path assertions.scanAxe.options'), `row "${row.name}": diagnostic is missing path context; got ${error.message}`)
            assert.ok(error.message.includes('repair:'), `row "${row.name}": diagnostic is missing repair guidance; got ${error.message}`)
            assert.ok(error.message.includes('scanAxe(page, { root:'), `row "${row.name}": diagnostic must name the options shape that replaced the positional argument; got ${error.message}`)
            return true
          },
          `row "${row.name}": a stale call shape must fail loudly instead of scanning the whole page`,
        )
        assert.equal(axe.builders.length, buildersBefore, `row "${row.name}": a refused shape must fail before any axe run starts`)
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it('fails every call-shape mutation for its intended record', async () => {
    const manifest = loadSingleDocument(readFileSync(join(HERE, 'journey-compat.testdata.manifest.yaml'), 'utf8'), SHAPE_MANIFEST_REL)
    const corpus = loadSingleDocument(readFileSync(join(HERE, 'journey-compat.testdata.yaml'), 'utf8'), SHAPE_CORPUS_REL)
    const { scratch, loaded, axe } = await loadVendoredCopy()
    try {
      const mutations = manifest.mutations
      assert.ok(Array.isArray(mutations) && mutations.length > 0, `${SHAPE_MANIFEST_REL}: manifest holds no mutations at path mutations; repair: restore the executable mutations.`)
      assert.equal(mutations.length, manifest.expectedMutationCount, `${SHAPE_MANIFEST_REL}: mutation count must match the mutation inventory at path expectedMutationCount; repair: align expectedMutationCount with mutations.`)
      checkRequiredNames(mutations.map((entry) => entry.name), manifest.requiredMutationNames, SHAPE_MANIFEST_REL)
      for (const mutation of mutations) {
        checkKeys(mutation, mutation.kind === 'bad-value' ? ['name', 'kind', 'target', 'field', 'value', 'expectedDiagnostic'] : ['name', 'kind', 'target', 'expectedDiagnostic'], 'mutation record', SHAPE_MANIFEST_REL, `manifest.mutations.${mutation.name}`)
        const rows = structuredClone(corpus.shapes)
        let message = null
        try {
          if (mutation.kind === 'delete-record') {
            const index = rows.findIndex((row) => row.name === mutation.target)
            assert.notEqual(index, -1, `mutation "${mutation.name}" targets an unknown row`)
            rows.splice(index, 1)
          } else {
            const target = rows.find((row) => row.name === mutation.target)
            assert.ok(target, `mutation "${mutation.name}" targets an unknown row`)
            target[mutation.field] = structuredClone(mutation.value)
          }
          checkRequiredNames(rows.map((row) => row.name), manifest.requiredShapeNames, SHAPE_CORPUS_REL)
          for (const row of rows) {
            const buildersBefore = axe.builders.length
            let refusal = null
            try {
              await callShape(row, loaded.scanAxe)
            } catch (error) {
              refusal = error
            }
            if (row.accepted) {
              // A refused row that now claims acceptance has to fail the run:
              // the mutation is only caught if the refusal is really the guard.
              assert.equal(refusal, null, `mutation "${mutation.name}": row "${row.name}" is marked accepted but the helper refused it; got ${refusal}`)
              continue
            }
            assert.ok(refusal instanceof TypeError, `mutation "${mutation.name}": row "${row.name}" must be refused with a type error; got ${refusal}`)
            assert.equal(axe.builders.length, buildersBefore, `mutation "${mutation.name}": row "${row.name}" must not start an axe run`)
          }
        } catch (error) {
          message = error instanceof Error ? error.message : String(error)
        }
        assert.ok(message, `mutation "${mutation.name}": the mutated inventory passed instead of failing`)
        assert.ok(message.includes(mutation.expectedDiagnostic), `mutation "${mutation.name}": diagnostic names the wrong record; got ${message}`)
      }
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
