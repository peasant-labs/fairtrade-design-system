/* Fairtest mounted product journey: one suite with exactly two row-scoped rows.
 *
 * Each row drives the real built app from dist/ through the Fairtrade adapter
 * lifecycle on the fixed loopback port, observes the complete product tuple
 * (chrome, body, exact route, initial analytics section, mounted view,
 * normalized theme), performs the one named map-section interaction with a
 * trusted click, and writes the six durable artifact classes into the
 * immutable run root. A row fails, never skips, when the app is not built
 * or any part of the tuple cannot be observed.
 *
 * Theme comes from the row key only. There is exactly one project in the
 * Fairtest config, so no project name is read here.
 */
import { test, expect } from '@playwright/test'
import { createFairtradeAdapter } from './fairtrade-adapter.mjs'
import { PRODUCT_TARGET_ID } from './fairtrade-targets.mjs'
import {
  FAIRTEST_PRODUCT_HOST,
  FAIRTEST_PRODUCT_PORT,
  PRODUCT_ARTIFACT_CLASSES,
  captureProductRow,
  createProductStaticDriver,
  productRowDir,
  resolveProductRunRoot,
} from './product-producer.mjs'

const ROW_THEMES = ['dark', 'light']

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
    driver = createProductStaticDriver({ port: FAIRTEST_PRODUCT_PORT, host: FAIRTEST_PRODUCT_HOST })
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
      for (const name of PRODUCT_ARTIFACT_CLASSES) {
        const { readFileSync, existsSync } = await import('node:fs')
        const { join } = await import('node:path')
        const path = join(productRowDir(runRoot, theme), name)
        expect(existsSync(path), `row artifact ${name} must exist at ${path}`).toBe(true)
        await testInfo.attach(`${theme}-${name}`, { path })
        expect(readFileSync(path).length > 0, `row artifact ${name} must be non-empty`).toBe(true)
      }
    })
  }
})
