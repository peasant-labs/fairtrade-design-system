/* Fairtest mounted component journey: one suite with exactly two row-scoped rows.
 *
 * Each row drives the built storybook-static/ direct iframe through the one
 * Fairtrade adapter lifecycle on the fixed loopback Storybook port, proves a
 * real mounted component (root children, ready-state body classes, hidden
 * error display, empty error stack), observes the normalized theme, expands
 * the disclosure with a trusted click, verifies the count/rows/ARIA and the
 * computed tokens, runs a plain serious-violations axe gate, and writes the
 * SAME six durable artifact classes the product row writes into the immutable
 * run root. A row fails, never skips, when the Storybook artifact is not built
 * or any part of the component tuple cannot be observed. The written artifacts
 * are then read back and asserted: six classes present, an accessibility
 * record the reader resolves to a pass from its gate receipt alone, a proof
 * carrying real observation times in observation order, and a component-only
 * record that carries no product shell field.
 *
 * Theme comes from the row key only. There is exactly one project in the
 * Fairtest config, so no project name is read here.
 */
import { test, expect } from '@playwright/test'
import { createFairtradeAdapter } from './fairtrade-adapter.mjs'
import { FAIRTEST_APP_HOST, FAIRTEST_STORYBOOK_PORT } from './fairtest-runtime.mjs'
import { COMPONENT_STORY_ID, COMPONENT_TARGET_ID, COMPONENT_PROVENANCE_SOURCE } from './fairtrade-component-target.mjs'
import {
  COMPONENT_ARTIFACT_CLASSES,
  captureComponentRow,
  componentRowDir,
  createComponentStaticDriver,
  readComponentAccessibilityVerdict,
  resolveComponentRunRoot,
} from './component-producer.mjs'
import { PRODUCT_ONLY_FIELDS } from './fairtest-artifacts.mjs'

const ROW_THEMES = ['dark', 'light']

function sanitizeRunId(value) {
  const base = String(value || '').split('/').filter(Boolean).pop() || 'fairtest-component-run'
  const cleaned = base.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned.slice(0, 64) || 'fairtest-component-run'
}

test.describe('fairtest mounted component', () => {
  let runRoot = null
  let baseUrl = null
  let adapter = null
  let driver = null

  test.beforeAll(async () => {
    runRoot = resolveComponentRunRoot()
    driver = createComponentStaticDriver({ port: FAIRTEST_STORYBOOK_PORT, host: FAIRTEST_APP_HOST })
    adapter = await createFairtradeAdapter({
      runId: sanitizeRunId(runRoot),
      driver,
      kind: 'component',
      targetId: COMPONENT_TARGET_ID,
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
    test(`component row ${theme} proves mount, interaction, and artifacts`, async ({ page }, testInfo) => {
      if (!adapter || !baseUrl || !runRoot) {
        throw new Error(
          'component journey: adapter service is not running for field "adapter" at path journey.lifecycle; ' +
          'repair: keep beforeAll start and readiness intact so every row drives the running loopback service.',
        )
      }
      const summary = await captureComponentRow(page, theme, { runRoot, baseUrl })
      expect(adapter.targetId, 'the running adapter must select the component target').toBe(COMPONENT_TARGET_ID)
      expect(summary.proof.kind).toBe('component')
      expect(summary.proof.theme.expected).toBe(theme)
      expect(summary.proof.theme.observed).toBe(theme)
      expect(summary.proof.root.mounted).toBe(true)
      expect(summary.proof.interaction.name).toBe('expand-disclosure')
      expect(summary.proof.interaction.completed).toBe(true)

      const { readFileSync, existsSync } = await import('node:fs')
      const { join } = await import('node:path')
      for (const name of COMPONENT_ARTIFACT_CLASSES) {
        const path = join(componentRowDir(runRoot, theme), name)
        expect(existsSync(path), `row artifact ${name} must exist at ${path}`).toBe(true)
        await testInfo.attach(`${theme}-${name}`, { path })
        expect(readFileSync(path).length > 0, `row artifact ${name} must be non-empty`).toBe(true)
      }

      // The written record must be readable by the one supported reader: the
      // verdict comes from the gate receipt over the gated component scope, and
      // the page-wide census stays nested and informational.
      const rowDir = componentRowDir(runRoot, theme)
      const record = JSON.parse(readFileSync(join(rowDir, 'record.json'), 'utf8'))
      expect(record.kind).toBe('component')
      expect(record.storyId).toBe(COMPONENT_STORY_ID)
      for (const productOnly of PRODUCT_ONLY_FIELDS) {
        expect(record[productOnly], `row ${theme} component record must not claim the product-only field ${productOnly}`).toBeUndefined()
      }
      const verdict = readComponentAccessibilityVerdict(record.accessibility)
      expect(verdict.result, `row ${theme} gate verdict must pass`).toBe('pass')
      expect(verdict.gatedScope, `row ${theme} verdict must stay attributed to the gated component scope`).toBe('component-root')
      expect(record.accessibility.pageWide.informational, `row ${theme} page-wide census must be informational`).toBe(true)
      expect(record.accessibility.blocking, `row ${theme} must carry no unqualified blocking count`).toBeUndefined()
      expect(record.accessibility.violations, `row ${theme} must carry no unqualified violations count`).toBeUndefined()

      // The written proof must carry the real readings the row took, in order.
      const proof = JSON.parse(readFileSync(join(rowDir, 'resolution.json'), 'utf8'))
      const times = summary.observationTimes
      expect(times.mount, `row ${theme} mount must be observed after the row starts`).toBeGreaterThan(times.rowStartedAtMs)
      expect(proof.root.observedAtMs, `row ${theme} root must carry the mount reading`).toBe(times.mount)
      expect(proof.theme.observedAtMs, `row ${theme} theme must be read at or after the mount`).toBeGreaterThanOrEqual(times.mount)
      expect(proof.interaction.observedAtMs, `row ${theme} interaction must be read at or after the theme`).toBeGreaterThanOrEqual(times.theme)

      // The written axe artifact carries the plain gate receipt and the
      // scoped measurement it was computed from.
      const axe = JSON.parse(readFileSync(join(rowDir, 'axe.json'), 'utf8'))
      expect(axe.gate.result, `row ${theme} written gate receipt must pass`).toBe('pass')
      expect(axe.gate.observedTheme, `row ${theme} gate receipt must name the rendered theme`).toBe(theme)
      expect(axe.pageWide.informational, `row ${theme} written page-wide census must be informational`).toBe(true)

      // The written provenance is a measured correspondence over the built
      // Storybook tree.
      const provenance = JSON.parse(readFileSync(join(rowDir, 'provenance.json'), 'utf8'))
      expect(provenance.servedFrom, `row ${theme} provenance must name the tree its digests were compared against`).toBe(COMPONENT_PROVENANCE_SOURCE.root)
      expect(provenance.servedFrom, `row ${theme} provenance must name the storybook-static tree, not the product run root`).toBe('storybook-static')
      expect(provenance.commitCorrespondence, `row ${theme} provenance must name who owns the commit correspondence`).toBe('verifier-owned')
      expect(provenance.storyId, `row ${theme} provenance must name the story id`).toBe(COMPONENT_STORY_ID)
      expect(provenance.viewport, `row ${theme} provenance must record the shared render viewport`).toEqual(summary.provenance.viewport)
    })
  }
})
