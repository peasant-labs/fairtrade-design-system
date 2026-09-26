// Fairtest source-isolation guard. This is the authoritative child-level
// check that the core and host contract stay inside one root: it asserts
// realpath containment, rejects root-relative and symlink escapes, proves
// browser packages are unavailable without installing or launching a
// browser, and scans every child source module for browser, live-handle,
// endpoint, and undeclared-dependency leakage. Browser-free: node builtins
// plus the declared yaml dependency only. No service, runner, or network.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, join, sep } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveFairtestSource } from '../../../scripts/fairtest-source.mjs'
import { assertExactFields, assertWithinRoot, checkRequiredNames, isAllowedImport, loadSingleDocument } from '../src/core/index.mjs'

const CHILD_ROOT_URL = new URL('..', import.meta.url)
const CORE_DIR_URL = new URL('../src/core/', import.meta.url)
const CONTRACT_DIR_URL = new URL('../src/host-contract/', import.meta.url)
const EVIDENCE_DIR_URL = new URL('../src/evidence/', import.meta.url)
const BOUNDARY_URL = new URL('../../../scripts/testdata/fairtest-boundary.yaml', import.meta.url)
const CHILD_MANIFEST = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const DECLARED_DEPS = new Set(Object.keys(CHILD_MANIFEST.dependencies ?? {}))
const BROWSER_ABSENT = ['playwright', 'puppeteer-core', 'jsdom', '@playwright/test', 'agent-browser']

/** @returns {Record<string, unknown>} */
function readBoundary() {
  return /** @type {Record<string, unknown>} */ (loadSingleDocument(readFileSync(BOUNDARY_URL, 'utf8'), 'fairtest-boundary.yaml'))
}

/** @returns {{ file: string, text: string }[]} */
function childSources() {
  const entries = []
  for (const [dir, url] of [['core', CORE_DIR_URL], ['host-contract', CONTRACT_DIR_URL], ['evidence', EVIDENCE_DIR_URL]]) {
    for (const name of readdirSync(url).filter((entry) => entry.endsWith('.mjs')).sort()) {
      entries.push({ file: `src/${dir}/${name}`, text: readFileSync(new URL(name, url), 'utf8') })
    }
  }
  return entries
}

/**
 * Sibling child module directories a source module may import from. A module
 * may reach any of the declared child source trees but nothing outside them.
 * @type {string[]}
 */
const ALLOWED_SIBLING_PREFIXES = ['../core/', '../host-contract/', '../evidence/']

/** @param {string} file @param {string} text */
function staticImports(file, text) {
  const found = []
  for (const match of text.matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)) {
    found.push({ file, specifier: match[1] })
  }
  return found
}

/** @param {string} text */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/** @param {string} file @param {string} text */
function dynamicImports(file, text) {
  const code = stripComments(text)
  const found = []
  if (/import\s*\(/.test(code)) found.push({ file, specifier: 'import()' })
  for (const match of code.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)) {
    found.push({ file, specifier: match[1] })
  }
  return found
}

describe('fairtest isolation package boundary', () => {
  it('keeps the child private with exactly the four contract commands', () => {
    const boundary = readBoundary()
    assert.equal(CHILD_MANIFEST.name, '@peasant-labs/fairtest', 'child package name must stay exact')
    assert.equal(CHILD_MANIFEST.private, true, 'child package must stay private')
    for (const key of ['publishConfig', 'files', 'exports']) {
      assert.ok(!(key in CHILD_MANIFEST), `child package must not gain ${key}; it is source-only and never published`)
    }
    assert.equal(CHILD_MANIFEST.type, 'module', 'child package must stay ESM')
    const required = /** @type {string[]} */ (boundary.requiredChildScripts)
    assert.ok(Array.isArray(required) && required.length === 4, 'boundary fixture must require exactly four child contract commands')
    checkRequiredNames(Object.keys(CHILD_MANIFEST.scripts ?? {}), required, 'packages/fairtest/package.json scripts')
    assert.ok(String(CHILD_MANIFEST.scripts['test:evidence']).includes('test/evidence.test.mjs'), 'test:evidence must run the evidence contract test file')
    assert.ok(String(CHILD_MANIFEST.scripts['test:bridge-contract']).includes('test/bridge-contract.test.mjs'), 'test:bridge-contract must run the bridge contract test file')
  })

  it('pins the core command to the core plus isolation test files', () => {
    assert.ok(
      String(CHILD_MANIFEST.scripts?.['test:core'] ?? '').includes('test/core.test.mjs'),
      'test:core must run the core test file',
    )
    assert.ok(
      String(CHILD_MANIFEST.scripts?.['test:core'] ?? '').includes('test/isolation.test.mjs'),
      'test:core must run this authoritative isolation guard',
    )
  })

  it('keeps the published root free of Fairtest coupling', () => {
    const rootManifest = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))
    assert.equal(rootManifest.name, '@peasant-labs/fairtrade', 'root package name must stay exact')
    assert.equal(rootManifest.version, '0.0.21', 'root package version must stay exact')
    const serialized = JSON.stringify({ exports: rootManifest.exports, files: rootManifest.files })
    assert.ok(!/fairtest/i.test(serialized), 'root exports and files must not reference Fairtest')
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      assert.ok(!Object.keys(rootManifest[field] ?? {}).some((name) => /fairtest/i.test(name)), `root ${field} must not depend on Fairtest`)
    }
  })
})

describe('fairtest isolation static imports', () => {
  it('declares every static import inside the child manifest', () => {
    for (const { file, text } of childSources()) {
      const code = stripComments(text)
      assert.ok(!code.includes('require('), `${file}: require() calls are not allowed in the child source`)
      assert.deepEqual(dynamicImports(file, text), [], `${file}: dynamic import() and side-effect imports are not allowed in the child source`)
      for (const { specifier } of staticImports(file, text)) {
        if (specifier.startsWith('node:')) continue
        if (specifier.startsWith('./') || specifier.startsWith('../')) {
          assert.ok(!specifier.includes('..') || ALLOWED_SIBLING_PREFIXES.some((prefix) => specifier.startsWith(prefix)), `${file}: import ${JSON.stringify(specifier)} escapes its module directory`)
          continue
        }
        const root = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
        assert.ok(DECLARED_DEPS.has(root), `${file}: undeclared import ${JSON.stringify(specifier)} resolves outside the child manifest`)
      }
    }
  })

  it('rejects undeclared bare dependencies without resolving them', () => {
    for (const missing of BROWSER_ABSENT) {
      assert.equal(isAllowedImport(missing, [...DECLARED_DEPS]), false, `${missing} must stay undeclared in the child manifest`)
    }
    assert.equal(isAllowedImport('yaml', [...DECLARED_DEPS]), true, 'the declared yaml dependency must stay allowed')
    assert.equal(isAllowedImport('node:fs', [...DECLARED_DEPS]), true, 'node builtins must stay allowed')
    assert.equal(isAllowedImport('../package.json', [...DECLARED_DEPS]), true, 'relative specifiers stay structurally allowed; containment is enforced separately')
  })

  it('fails root-relative escapes at the containment check', () => {
    const root = '/scope/packages/fairtest'
    assertWithinRoot('/scope/packages/fairtest/src/core/values.mjs', root)
    for (const escaped of ['/scope/packages/other.mjs', '/scope/package.json', '/etc/hostname']) {
      assert.throws(() => assertWithinRoot(escaped, root), /escapes its root.*repair:/s, `${escaped} must fail containment`)
    }
  })

  it('rejects a real symlink escape through the production source route', () => {
    const childRoot = realpathSync(fileURLToPath(CHILD_ROOT_URL))
    const outsideDir = mkdtempSync(join(tmpdir(), 'fairtest-symlink-outside-'))
    const linkName = `symlink-escape-probe-${process.pid}.mjs`
    const linkAbs = join(childRoot, 'src', 'core', linkName)
    try {
      const targetAbs = join(outsideDir, 'escape-target.mjs')
      writeFileSync(targetAbs, 'export const escape = true\n')
      symlinkSync(targetAbs, linkAbs)
      assert.equal(realpathSync(linkAbs), realpathSync(targetAbs), 'control: the planted link must resolve outside the child root')
      assert.ok(linkAbs === childRoot || linkAbs.startsWith(childRoot + sep), 'control: the link path is lexically inside the root, so a string-prefix check without realpath would pass')
      assert.throws(
        () => resolveFairtestSource(`src/core/${linkName}`),
        /escapes.*at path.*repair:/s,
        'symlink escape through the production route must fail containment',
      )
    } finally {
      rmSync(linkAbs, { force: true })
      rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('fails symlink escapes at the realpath check', () => {
    const scope = mkdtempSync(join(tmpdir(), 'fairtest-symlink-scope-'))
    try {
      const inner = join(scope, 'inner')
      mkdirSync(inner, { recursive: true })
      const outside = mkdtempSync(join(tmpdir(), 'fairtest-symlink-outside-'))
      try {
        const link = join(inner, 'escape.mjs')
        symlinkSync(join(outside, 'values.mjs'), link)
        const resolved = realpathSync(join(scope, 'inner'))
        assert.ok(resolved.startsWith(realpathSync(scope) + sep) || resolved === realpathSync(scope), 'control: real inner directory must stay contained')
        assert.throws(
          () => assertWithinRoot(realpathSync(outside), realpathSync(scope)),
          /escapes its root.*repair:/s,
          'symlink target outside the root must fail containment',
        )
      } finally {
        rmSync(outside, { recursive: true, force: true })
      }
    } finally {
      rmSync(scope, { recursive: true, force: true })
    }
  })
})

describe('fairtest isolation leakage probes', () => {
  it('carries no forbidden source pattern in any child module', () => {
    const boundary = readBoundary()
    const patterns = /** @type {Record<string, unknown>[]} */ (boundary.forbiddenSourcePatterns)
    assert.ok(Array.isArray(patterns) && patterns.length > 0, 'boundary fixture must declare forbidden source patterns')
    for (const { file, text } of childSources()) {
      for (const entry of patterns) {
        const pattern = new RegExp(/** @type {string} */ (entry.pattern))
        assert.ok(!pattern.test(text), `${file}: source matches forbidden pattern ${(/** @type {string} */ (entry.name))}`)
      }
    }
  })

  it('fails injected leakage material as an unknown field', () => {
    const boundary = readBoundary()
    for (const probe of /** @type {Record<string, unknown>[]} */ (boundary.isolationProbes)) {
      const snippet = /** @type {string} */ (probe.snippet)
      const sources = childSources().map((entry) => entry.text).join('\n')
      assert.ok(!sources.includes(snippet), `child source must not contain probe ${(/** @type {string} */ (probe.name))}`)
      let message = null
      try {
        assertExactFields({ alpha: 'x', beta: 'y', [snippet]: 'injected' }, ['alpha', 'beta'], 'probe', 'case.value')
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `probe "${probe.name}" passed validation instead of failing`)
      assert.ok(message.includes(snippet), `probe "${probe.name}" diagnostic must name the injected material`)
      assert.ok(message.includes('at path') && message.includes('repair:'), `probe "${probe.name}" diagnostic must stay actionable`)
    }
  })

  it('rejects every forbidden packed path from the boundary manifest', () => {
    const boundary = readBoundary()
    const fragments = /** @type {string[]} */ (boundary.forbiddenPackFragments)
    assert.ok(Array.isArray(fragments) && fragments.length > 0, 'boundary fixture must declare forbidden packed-path fragments')
    const forbidden = (path) => fragments.some((fragment) => path.includes(fragment))
    assert.equal(forbidden('dist/lib/ui.js'), false, 'a packed surface entry must stay allowed')
    for (const path of ['packages/fairtest/src/core/values.mjs', 'packages/fairtest/test/core.test.mjs', 'packages/fairtest/package.json']) {
      assert.equal(forbidden(path), true, `${path} must be rejected by the forbidden manifest`)
    }
  })
})

describe('fairtest isolation external root', () => {
  it('runs core and contract from a temporary root with browser packages unavailable', () => {
    const external = mkdtempSync(join(tmpdir(), 'fairtest-isolation-external-'))
    try {
      mkdirSync(join(external, 'core'), { recursive: true })
      mkdirSync(join(external, 'host-contract'), { recursive: true })
      for (const name of readdirSync(CORE_DIR_URL).filter((entry) => entry.endsWith('.mjs')).sort()) {
        copyFileSync(new URL(name, CORE_DIR_URL), join(external, 'core', basename(name)))
      }
      for (const name of readdirSync(CONTRACT_DIR_URL).filter((entry) => entry.endsWith('.mjs')).sort()) {
        copyFileSync(new URL(name, CONTRACT_DIR_URL), join(external, 'host-contract', basename(name)))
      }
      mkdirSync(join(external, 'node_modules'), { recursive: true })
      const realYaml = new URL('../../node_modules/yaml/', CHILD_ROOT_URL)
      try {
        realpathSync(new URL('package.json', realYaml))
      } catch {
        throw new Error('external-root check needs the installed yaml dependency; run pnpm install first.')
      }
      symlinkSync(realpathSync(new URL('.', realYaml)), join(external, 'node_modules', 'yaml'), 'dir')
      const scoped = createRequire(join(external, 'probe.mjs'))
      for (const missing of BROWSER_ABSENT) {
        assert.throws(() => scoped.resolve(missing), /Cannot find module/, `${missing} must not resolve from the external root`)
      }
      const smokeLines = [
        "import { mkdtempSync, realpathSync, rmSync } from 'node:fs'",
        "import { tmpdir } from 'node:os'",
        "import { join, sep } from 'node:path'",
        "import * as core from './core/index.mjs'",
        "import * as contract from './host-contract/index.mjs'",
        "const policy = core.createMeasurementPolicy({ version: 1, minBytes: 2, minDistinct: 1, minFraction: 0 })",
        "if (!core.evaluateMeasurement({ bytes: 2, distinct: 1, fraction: 0 }, policy).pass) throw new Error('external smoke policy failed')",
        "const target = contract.validateTargetDeclaration({ kind: 'product',",
        "  identity: { kind: 'product', id: 'product-target-a', createdAtMs: 1000 },",
        "  capabilities: [...contract.PRODUCT_REQUIRED_CAPABILITIES],",
        "  fixtures: ['synthetic-fixture-a'], actions: [] }, 'smoke')",
        "if (target.kind !== 'product' || !Object.isFrozen(target)) throw new Error('external smoke target failed')",
        "const bridge = contract.validateBridgeDeclaration({ kind: 'local',",
        "  identity: { kind: 'local', id: 'bridge-local-a', createdAtMs: 1000 },",
        "  capabilities: [...contract.BRIDGE_REQUIRED_CAPABILITIES] }, 'smoke')",
        "if (bridge.kind !== 'local' || !Object.isFrozen(bridge)) throw new Error('external smoke bridge failed')",
        "let escapeFailed = false",
        "try { core.assertWithinRoot('/scope/packages/other.mjs', '/scope/packages/fairtest') } catch { escapeFailed = true }",
        "if (!escapeFailed) throw new Error('external smoke escape passed instead of failing')",
        "const linkScope = mkdtempSync(join(tmpdir(), 'fairtest-smoke-scope-'))",
        "try {",
        "  const outside = realpathSync(tmpdir())",
        "  core.assertWithinRoot(realpathSync(linkScope), realpathSync(linkScope))",
        "  let symlinkFailed = false",
        "  try { core.assertWithinRoot(outside === realpathSync(linkScope) ? outside + '-other' : outside, realpathSync(linkScope)) } catch { symlinkFailed = true }",
        "  if (!symlinkFailed) throw new Error('external smoke symlink passed instead of failing')",
        "} finally { rmSync(linkScope, { recursive: true, force: true }) }",
        "const here = realpathSync(new URL('./core/index.mjs', import.meta.url))",
        "const root = realpathSync(new URL('.', import.meta.url))",
        "if (here !== root && !here.startsWith(root + sep)) throw new Error('external module resolved outside ' + root)",
        "console.log(JSON.stringify({ ok: true, here }))",
        '',
      ]
      const smokePath = join(external, 'smoke.mjs')
      writeFileSync(smokePath, smokeLines.join('\n'))
      const stdout = execFileSync('node', [smokePath], { cwd: external, encoding: 'utf8' })
      const receipt = JSON.parse(stdout.trim().split('\n').at(-1))
      assert.equal(receipt.ok, true, 'external smoke must pass from the temporary root')
      assert.ok(receipt.here.startsWith(realpathSync(external) + sep), `external module resolved to ${receipt.here}, outside ${external}`)
    } finally {
      rmSync(external, { recursive: true, force: true })
    }
  })
})
