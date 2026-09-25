// Executable suite for the ten named negative product mutations.
//
// Each named mutation must fail at its owning product boundary with an
// actionable diagnostic. This module drives the real producer path through
// scripts/fairtest/product-mutations.mjs: observation-input removal through
// the real proof builder, the active-view floor guard over the real served
// DOM, the rendered-root predicate over the declared unrendered modes on that
// same served DOM, contradiction through the real theme observer, registry
// rejection through the real adapter and target registry, cross-kind
// rejection through the shared contract, and stale-asset comparison over real
// served bytes from a throwaway dist/ copy.
//
// Precondition: run pnpm build first so dist/ holds the exact built app.
// The stale-asset mutation and the DOM proofs serve throwaway roots or remove
// or empty live elements only; the real dist/ tree is never modified and
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
  PRODUCT_UNRENDERED_RULES,
  proveDomAbsenceRealPath,
  runProductMutation,
  servedProvenanceDigestMatch,
} from './product-mutations.mjs'
import {
  PRODUCT_MIN_BODY_DESCENDANTS,
  PRODUCT_MIN_BODY_TEXT_LENGTH,
  PRODUCT_VIEW_SELECTORS,
  assertProductActiveViewMounted,
} from './product-producer.mjs'
import { PRODUCT_UNRENDERED_MODES, PRODUCT_UNRENDERED_REFUSAL_FIELDS } from './fairtrade-targets.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const DIST_ROOT = join(ROOT, 'dist')
const CHILD_MARKER = ['packages', 'fairtest'].join('/')

const EXPECTED_DIAGNOSTICS = {
  'missing-chrome': ['chrome', 'at path', 'repair:'],
  'missing-body': ['body', 'at path', 'repair:'],
  'missing-section': ['activeSection', 'at path', 'repair:'],
  'missing-view': ['view', 'at path', 'repair:'],
  'blank-active-view': ['blank representative body', 'proof.body', 'active view', 'hidden changes view', 'repair:'],
  'unrendered-active-view': ['unrendered active view refused', 'field "mode"', 'at path producer.activeView.body.refusals', 'display-none', 'visibility-hidden', 'opacity-zero', 'zero-size', 'clipped', 'repair:'],
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
  it('names exactly the ten required mutations with owning boundaries', () => {
    assert.deepEqual([...PRODUCT_MUTATION_NAMES], [
      'missing-chrome',
      'missing-body',
      'missing-section',
      'missing-view',
      'blank-active-view',
      'unrendered-active-view',
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

  it('reads the floors off the rendered active view, not the container the hidden view sits in', () => {
    const context = {
      label: 'blank representative body',
      part: 'body',
      path: 'proof.body',
      repair: 'keep the analytics dashboard mounted and rendered with non-trivial content instead of a blank section',
    }
    // The healthy active view clears the declared floors and returns the
    // accepted rendered measurement the record is then built from.
    const healthy = assertProductActiveViewMounted({
      activeView: { roots: 1, rendered: 1, descendants: PRODUCT_MIN_BODY_DESCENDANTS, textLength: PRODUCT_MIN_BODY_TEXT_LENGTH, refusals: [] },
      container: { descendants: 834, textLength: 2027 },
    }, context)
    assert.deepEqual(healthy, { roots: 1, rendered: 1, descendants: PRODUCT_MIN_BODY_DESCENDANTS, textLength: PRODUCT_MIN_BODY_TEXT_LENGTH })
    // The emptied active view beside the permanently mounted hidden changes
    // view fails closed: the container totals (188 / 804 on the real built
    // surface) are both above the declared floors and are still refused.
    assert.throws(
      () => assertProductActiveViewMounted({
        activeView: { roots: 1, rendered: 1, descendants: 0, textLength: 0, refusals: [] },
        container: { descendants: 188, textLength: 804 },
      }, context),
      /blank representative body.*at path proof\.body.*active view.*hidden changes view.*repair:/s,
    )
    assert.throws(
      () => assertProductActiveViewMounted({
        activeView: { roots: 1, rendered: 0, descendants: 0, textLength: 0, refusals: [] },
        container: { descendants: 188, textLength: 804 },
      }, context),
      /blank representative body.*1 roots of which 0 render.*repair:/s,
    )
    // A root counted as rendered while it renders nothing must still fail, and
    // a refusal must name one of the declared modes.
    assert.throws(
      () => assertProductActiveViewMounted({
        activeView: {
          roots: 1,
          rendered: 1,
          descendants: 646,
          textLength: 1223,
          refusals: [{ mode: 'invented-mode', display: 'none', visibility: 'visible', opacity: 1, width: 0, height: 0, intersectsStage: false }],
        },
        container: { descendants: 834, textLength: 2027 },
      }, context),
      /unknown unrendered mode "invented-mode".*at path producer\.activeView\.body\.refusals\.mode.*repair:/s,
    )
    assert.match(PRODUCT_VIEW_SELECTORS.activeView, /:not\(\[hidden\]\)/, 'the active-view selector must exclude the permanently mounted hidden view')
    assert.equal(PRODUCT_VIEW_SELECTORS.stage, '#inuse-stage[role="tabpanel"]', 'the rendered predicate must measure against the mounted stage')
  })

  it('refuses every declared unrendered mode on a present but unrendered active view', () => {
    // Node and text counts are untouched in every mode, so only the rendered
    // predicate can refuse them. The real served-DOM proof for the same five
    // modes lives in the unrendered-active-view mutation above.
    assert.deepEqual([...PRODUCT_UNRENDERED_MODES], ['display-none', 'visibility-hidden', 'opacity-zero', 'zero-size', 'clipped'])
    assert.deepEqual(Object.keys(PRODUCT_UNRENDERED_RULES).sort(), [...PRODUCT_UNRENDERED_MODES].sort(), 'every declared unrendered mode needs a real-served-surface rule')
    const context = {
      label: 'unrendered representative body',
      part: 'body',
      path: 'proof.body',
      repair: 'keep the analytics dashboard laid out and rendered instead of present but invisible',
    }
    const refusals = {
      'display-none': { display: 'none', visibility: 'visible', opacity: 1, width: 0, height: 0, intersectsStage: false },
      'visibility-hidden': { display: 'flex', visibility: 'hidden', opacity: 1, width: 1184, height: 1621, intersectsStage: true },
      'opacity-zero': { display: 'flex', visibility: 'visible', opacity: 0, width: 1184, height: 1621, intersectsStage: true },
      'zero-size': { display: 'flex', visibility: 'visible', opacity: 1, width: 0, height: 0, intersectsStage: true },
      clipped: { display: 'flex', visibility: 'visible', opacity: 1, width: 1184, height: 1621, intersectsStage: false },
    }
    for (const mode of PRODUCT_UNRENDERED_MODES) {
      assert.deepEqual(
        Object.keys(/** @type {Record<string, unknown>} */ (refusals[mode])).sort(),
        [...PRODUCT_UNRENDERED_REFUSAL_FIELDS].filter((field) => field !== 'mode').sort(),
        `${mode}: the refusal must carry the declared measured field set`,
      )
      assert.throws(
        () => assertProductActiveViewMounted({
          activeView: { roots: 1, rendered: 0, descendants: 0, textLength: 0, refusals: [{ mode, ...refusals[mode] }] },
          container: { descendants: 834, textLength: 2027 },
        }, context),
        new RegExp(`unrendered representative body.*at path proof\\.body.*1 roots of which 0 render.*${mode}.*repair:`, 's'),
        `${mode}: a present but unrendered active view must fail closed naming the mode`,
      )
    }
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
