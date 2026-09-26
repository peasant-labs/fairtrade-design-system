/* Fairtest mounted product journey: one suite with exactly two row-scoped rows.
 *
 * Each row drives the real built app from dist/ through the Fairtrade adapter
 * lifecycle on the fixed loopback port, observes the complete product tuple
 * (chrome, body, exact route, initial analytics section, mounted view,
 * normalized theme), performs the one named map-section interaction with a
 * trusted click, and writes the six durable artifact classes into the
 * immutable run root. A row fails, never skips, when the app is not built
 * or any part of the tuple cannot be observed. The written artifacts are then
 * read back and asserted: six classes present, an accessibility record the
 * verifier-facing reader resolves to a pass from its gate receipts alone, a
 * proof carrying real observation times in observation order, and a body and
 * view block whose unqualified numbers are the rendered active-view
 * measurement the floors were applied to rather than a container total.
 *
 * Theme comes from the row key only. There is exactly one project in the
 * Fairtest config, so no project name is read here.
 */
import { test, expect } from '@playwright/test'
import { createFairtradeAdapter } from './fairtrade-adapter.mjs'
import { FAIRTEST_APP_HOST, FAIRTEST_APP_PORT } from './fairtest-runtime.mjs'
import { PRODUCT_A11Y_GATE_POINT_SLOTS, PRODUCT_A11Y_POINT_LABELS, PRODUCT_TARGET_ID } from './fairtrade-targets.mjs'
import {
  PRODUCT_ARTIFACT_CLASSES,
  PRODUCT_PRE_ACTION_PARTS,
  captureProductRow,
  createProductStaticDriver,
  productRowDir,
  readProductAccessibilityVerdict,
  resolveProductRunRoot,
} from './product-producer.mjs'

const ROW_THEMES = ['dark', 'light']
const GATE_POINT_SLOTS = PRODUCT_A11Y_GATE_POINT_SLOTS
const POINT_LABELS = PRODUCT_A11Y_POINT_LABELS

function sanitizeRunId(value) {
  const base = String(value || '').split('/').filter(Boolean).pop() || 'fairtest-product-run'
  const cleaned = base.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned.slice(0, 64) || 'fairtest-product-run'
}

test.describe('fairtest mounted product', () => {
  let runRoot = null
  let baseUrl = null
  let adapter = null
  let driver = null

  test.beforeAll(async () => {
    runRoot = resolveProductRunRoot()
    driver = createProductStaticDriver({ port: FAIRTEST_APP_PORT, host: FAIRTEST_APP_HOST })
    adapter = await createFairtradeAdapter({
      runId: sanitizeRunId(runRoot),
      driver,
      targetId: PRODUCT_TARGET_ID,
      createdAtMs: Date.now(),
    })
    await adapter.start()
    await adapter.readiness()
    baseUrl = driver.baseUrl
  })

  test.afterAll(async () => {
    if (adapter) {
      await adapter.teardown()
      adapter = null
    }
  })

  for (const theme of ROW_THEMES) {
    test(`product row ${theme} proves shell, theme, interaction, and artifacts`, async ({ page }, testInfo) => {
      if (!adapter || !baseUrl || !runRoot) {
        throw new Error(
          'product journey: adapter service is not running for field "adapter" at path journey.lifecycle; ' +
          'repair: keep beforeAll start and readiness intact so every row drives the running loopback service.',
        )
      }
      const summary = await captureProductRow(page, theme, { runRoot, baseUrl })
      expect(summary.proof.kind).toBe('product')
      expect(summary.proof.theme.expected).toBe(theme)
      expect(summary.proof.theme.observed).toBe(theme)
      expect(summary.proof.action.name).toBe('select-map-section')
      expect(summary.proof.action.completed).toBe(true)
      const { readFileSync, existsSync } = await import('node:fs')
      const { join } = await import('node:path')
      // Real observation, not a source read: the row reports the rendered-view
      // guard call sequence it actually made, and the two declared points must
      // both appear in that order. Deleting either call site in the row
      // shortens this sequence and fails the row here.
      expect(summary.activeViewGuards, `row ${theme} must invoke the rendered-view guard at both declared points`).toEqual(['body@proof.body', 'view@proof.view'])
      for (const name of PRODUCT_ARTIFACT_CLASSES) {
        const path = join(productRowDir(runRoot, theme), name)
        expect(existsSync(path), `row artifact ${name} must exist at ${path}`).toBe(true)
        await testInfo.attach(`${theme}-${name}`, { path })
        expect(readFileSync(path).length > 0, `row artifact ${name} must be non-empty`).toBe(true)
      }

      // The written record must be readable by the one supported reader: the
      // verdict comes from the gate receipts over the gated scope, and the
      // page-wide census stays nested and informational, so a verifier keying
      // off a bare `blocking` count finds nothing.
      const rowDir = productRowDir(runRoot, theme)
      const record = JSON.parse(readFileSync(join(rowDir, 'record.json'), 'utf8'))
      const verdict = readProductAccessibilityVerdict(record.accessibility)
      expect(verdict.result, `row ${theme} gate verdict must pass`).toBe('pass')
      expect(verdict.gatedScope, `row ${theme} verdict must stay attributed to the gated scope`).toBe('product-view')
      expect(record.accessibility.pageWide.informational, `row ${theme} page-wide census must be informational`).toBe(true)
      expect(record.accessibility.blocking, `row ${theme} must carry no unqualified blocking count`).toBeUndefined()
      expect(record.accessibility.violations, `row ${theme} must carry no unqualified violations count`).toBeUndefined()

      // Record truthfulness on disk: the unqualified body and view numbers a
      // verifier reads must be the RENDERED active-view measurement the floors
      // were applied to, never a container total. The row summary carries the
      // accepted rendered triples, so this compares the written record against
      // the measurement the guard decided on, and proves each is strictly
      // below the container total it must never be confused with.
      const recordedBlocks = [
        {
          part: 'body',
          block: record.body,
          accepted: summary.body,
          fields: {
            renderedRoots: 'renderedRoots',
            descendants: 'descendants',
            textLength: 'textLength',
            containerDescendants: 'containerDescendants',
            containerTextLength: 'containerTextLength',
          },
        },
        {
          part: 'view',
          block: record.view,
          accepted: summary.view,
          fields: {
            renderedRoots: 'renderedRootsAfter',
            descendants: 'viewDescendantsAfter',
            textLength: 'viewTextLengthAfter',
            containerDescendants: 'containerDescendantsAfter',
            containerTextLength: 'containerTextLengthAfter',
          },
        },
      ]
      for (const { part, block, accepted, fields } of recordedBlocks) {
        for (const [role, field] of Object.entries(fields)) {
          expect(typeof block[field], `row ${theme} ${part} must record its ${role} as a number under ${field}`).toBe('number')
        }
        expect(block[fields.renderedRoots], `row ${theme} ${part} must record how many active roots rendered`).toBeGreaterThanOrEqual(1)
        expect(block[fields.renderedRoots], `row ${theme} ${part} rendered roots must be the measurement the guard accepted`).toBe(accepted.rendered)
        expect(block[fields.descendants], `row ${theme} ${part} descendants must be the rendered active-view count`).toBe(accepted.descendants)
        expect(block[fields.textLength], `row ${theme} ${part} text length must be the rendered active-view count`).toBe(accepted.textLength)
        expect(block[fields.descendants], `row ${theme} ${part} rendered descendants must stay below the container total`).toBeLessThan(block[fields.containerDescendants])
        expect(block[fields.textLength], `row ${theme} ${part} rendered text must stay below the container total`).toBeLessThan(block[fields.containerTextLength])
      }

      // The written proof must carry the real readings the row took: one
      // shared pre-action reading after the row started, then the theme
      // reading, then the action reading.
      const proof = JSON.parse(readFileSync(join(rowDir, 'resolution.json'), 'utf8'))
      const times = summary.observationTimes
      expect(times.parts, `row ${theme} pre-action parts must be read after the row starts`).toBeGreaterThan(times.rowStartedAtMs)
      for (const part of PRODUCT_PRE_ACTION_PARTS) {
        expect(proof[part].observedAtMs, `row ${theme} ${part} must carry the shared pre-action reading`).toBe(times.parts)
      }
      expect(proof.theme.observedAtMs, `row ${theme} theme must be read at or after the parts`).toBeGreaterThanOrEqual(times.parts)
      expect(proof.action.observedAtMs, `row ${theme} action must be read at or after the theme`).toBeGreaterThanOrEqual(proof.theme.observedAtMs)

      // The two gate receipts must each name the section the page actually
      // showed when their scan was taken. The reader compares that observed text
      // against the app-owned label for the slot, so a swapped scan fails closed
      // instead of producing two receipts that agree with each other and not
      // with the row.
      const axe = JSON.parse(readFileSync(join(rowDir, 'axe.json'), 'utf8'))
      for (const point of ['before', 'after']) {
        const slot = GATE_POINT_SLOTS[point]
        expect(axe.scoped[point].observedSection, `row ${theme} ${slot} scan must be gated with the ${axe.scoped[point].declaredSection} section active`).toBe(POINT_LABELS[slot])
        expect(record.accessibility.gate[point].observedSection, `row ${theme} gate.${point} must carry the section the page showed`).toBe(axe.scoped[point].observedSection)
        expect(record.accessibility.gate[point].point, `row ${theme} gate.${point} must name its declared observation point`).toBe(slot)
      }
      expect(axe.scoped.before.observedSection, `row ${theme} the two scans must be gated against different sections`).not.toBe(axe.scoped.after.observedSection)

      // The written provenance is a measured correspondence, not a bare hash
      // list: it names the tree its digests were compared against, and it says
      // out loud which comparison is not the producer's to make.
      const provenance = JSON.parse(readFileSync(join(rowDir, 'provenance.json'), 'utf8'))
      expect(provenance.servedFrom, `row ${theme} provenance must name the tree its digests were compared against`).toBe('run-root-dist')
      expect(provenance.commitCorrespondence, `row ${theme} provenance must name who owns the commit correspondence`).toBe('verifier-owned')
      expect(provenance.viewport, `row ${theme} provenance must record the shared render viewport`).toEqual(summary.provenance.viewport)
    })
  }
})
