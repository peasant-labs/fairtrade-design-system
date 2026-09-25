// Executable suite for the eight named negative product mutations.
//
// Each named mutation must fail at its owning product boundary with an
// actionable diagnostic. This module drives the real producer path through
// scripts/fairtest/product-mutations.mjs: observation-input removal through
// the real proof builder, contradiction through the real theme observer,
// registry rejection through the real adapter and target registry,
// cross-kind rejection through the shared contract, and stale-asset
// comparison over real served bytes from a throwaway dist/ copy.
//
// Precondition: run pnpm build first so dist/ holds the exact built app.
// The stale-asset mutation and the DOM-absence proof serve throwaway roots
// or remove live elements only; the real dist/ tree is never modified and
// every service, browser, and scratch directory is released in finally
// blocks. Runs with node --test and starts no Storybook or Puppeteer path.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  PRODUCT_MUTATION_BOUNDARIES,
  PRODUCT_MUTATION_NAMES,
  proveDomAbsenceRealPath,
  runProductMutation,
  servedProvenanceDigestMatch,
} from './product-mutations.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const DIST_ROOT = join(ROOT, 'dist')
const CHILD_MARKER = ['packages', 'fairtest'].join('/')

const EXPECTED_DIAGNOSTICS = {
  'missing-chrome': ['chrome', 'at path', 'repair:'],
  'missing-body': ['body', 'at path', 'repair:'],
  'missing-section': ['activeSection', 'at path', 'repair:'],
  'missing-view': ['view', 'at path', 'repair:'],
  'wrong-theme': ['"light"', '"dark"', 'at path', 'repair:'],
  'unregistered-action': ['select-changes-section', 'at path', 'repair:'],
  'cross-kind-proof': ['identity', 'at path', 'repair:'],
  'stale-served-asset': ['assetDigests', 'at path', 'repair:'],
}

/** @param {string[]} fragments @param {string} message @param {string} name */
function expectDiagnostic(fragments, message, name) {
  for (const fragment of fragments) {
    assert.ok(message.includes(fragment), `${name}: diagnostic is missing ${JSON.stringify(fragment)}; got ${message}`)
  }
}

describe('named negative product mutations', () => {
  it('names exactly the eight required mutations with owning boundaries', () => {
    assert.deepEqual([...PRODUCT_MUTATION_NAMES], [
      'missing-chrome',
      'missing-body',
      'missing-section',
      'missing-view',
      'wrong-theme',
      'unregistered-action',
      'cross-kind-proof',
      'stale-served-asset',
    ])
    assert.deepEqual(Object.keys(PRODUCT_MUTATION_BOUNDARIES).sort(), [...PRODUCT_MUTATION_NAMES].sort())
    for (const name of PRODUCT_MUTATION_NAMES) {
      assert.match(PRODUCT_MUTATION_BOUNDARIES[name], /at path|at \w+\./, `${name}: boundary must name the owning field`)
    }
  })

  it('fails every named mutation at its owning boundary with an actionable diagnostic', async () => {
    assert.ok(existsSync(join(DIST_ROOT, 'index.html')), 'stale-asset mutation needs the built app; repair: run pnpm build before node --test scripts/fairtest/product-mutations.test.mjs.')
    for (const name of PRODUCT_MUTATION_NAMES) {
      let message = null
      try {
        await runProductMutation(name)
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${name}: mutated path passed instead of failing at ${PRODUCT_MUTATION_BOUNDARIES[name]}`)
      expectDiagnostic(EXPECTED_DIAGNOSTICS[name], message, name)
      console.log(`MUTATION ${name} :: ${message.split('\n')[0]}`)
    }
  })

  it('rejects an unknown mutation name instead of running anything', async () => {
    await assert.rejects(
      () => runProductMutation('missing-everything'),
      /"missing-everything".*field "mutation".*at path mutation\.name.*repair:/s,
    )
  })

  it('fails the body mutation by naming the body part, never by a blanket mounted flag', async () => {
    let message = null
    try {
      await runProductMutation('missing-body')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, 'missing-body must fail')
    assert.ok(message.includes('"body"') || message.includes('body'), `missing-body must name the body part; got ${message}`)
    assert.ok(!message.includes('proof.mounted'), `missing-body must not hide behind a blanket mounted flag; got ${message}`)
  })

  it('leaves the real dist/ untouched and no scratch residue behind', async () => {
    const before = createHash('sha256').update(readFileSync(join(DIST_ROOT, 'index.html'))).digest('hex')
    let message = null
    try {
      await runProductMutation('stale-served-asset')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, 'stale-asset mutation must fail')
    const after = createHash('sha256').update(readFileSync(join(DIST_ROOT, 'index.html'))).digest('hex')
    assert.equal(after, before, 'stale-asset mutation must never modify the real dist/')
    assert.ok(!readFileSync(join(DIST_ROOT, 'index.html'), 'utf8').includes('fairtest stale-asset mutation probe'), 'mutation marker must never land in the real dist/')
  })

  it('passes matching digests and fails mismatched digests at the provenance comparison', () => {
    const receipt = servedProvenanceDigestMatch({ recordedDigest: 'abc', servedDigest: 'abc', servedUrl: 'http://127.0.0.1:1' })
    assert.equal(receipt.result, 'pass')
    assert.throws(
      () => servedProvenanceDigestMatch({ recordedDigest: 'abc', servedDigest: 'def', servedUrl: 'http://127.0.0.1:1' }),
      /stale served asset.*field "assetDigests".*at path provenance\.assetDigests.*repair:/s,
    )
  })

  it('proves the real DOM path fails when each part element is genuinely absent', { timeout: 180000 }, async () => {
    const evidence = await proveDomAbsenceRealPath({ port: 5196 })
    assert.equal(evidence.length, 4, 'absence proof must cover chrome, section, view, and body')
    for (const entry of evidence) {
      assert.equal(entry.attachedBefore, true, `${entry.part}: selector must attach on the real served app first`)
      assert.equal(entry.attachedAfter, false, `${entry.part}: removed element must stay absent`)
      assert.ok(entry.waitDiagnostic.length > 0, `${entry.part}: producer wait must report the absence`)
      console.log(`DOM-ABSENCE ${entry.part} ${entry.selector} :: ${entry.waitDiagnostic.split('\n')[0].slice(0, 160)}`)
    }
  })

  it('loads child values only through the sole source route', async () => {
    const text = readFileSync(join(HERE, 'product-mutations.mjs'), 'utf8')
    assert.ok(!text.includes(CHILD_MARKER), 'product-mutations.mjs: names a second route into the private child at path import; repair: load child values only through ../fairtest-source.mjs.')
    const dynamic = [...text.matchAll(/importFairtestSource\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1])
    assert.ok(dynamic.length > 0, 'product-mutations.mjs: holds no child imports')
    for (const spec of dynamic) {
      assert.ok(spec.startsWith('src/'), `product-mutations.mjs: source spec ${JSON.stringify(spec)} escapes the child tree at path import; repair: use a child-relative src/ path.`)
    }
    const forbidden = ['puppeteer', 'jsdom', 'storybook', 'agent-browser']
    for (const token of forbidden) {
      assert.ok(!text.includes(token), `product-mutations.mjs: names forbidden material ${JSON.stringify(token)}; repair: keep catalog and DOM material in the producer and the live page.`)
    }
  })
})
