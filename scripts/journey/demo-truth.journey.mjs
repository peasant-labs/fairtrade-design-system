import { test, expect } from '@playwright/test'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { ROOT } from '../css-source.mjs'
import { loadDemoTruthMountedFixtures } from '../demo-truth-mounted-fixtures.mjs'

const spec = loadDemoTruthMountedFixtures()
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || '5180'}`

for (const row of spec.cases) for (const theme of spec.themes) {
  test(`demo truth ${row.name} ${theme}`, async ({ page }, info) => {
    test.skip(info.project.name !== theme)
    await page.setViewportSize({ width: row.width, height: 1000 })
    await page.goto(`${origin}/?fb=off&${row.query}&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await expect(page.locator('.iu-bar')).toBeVisible()
    const root = page.locator(row.root).first()
    await expect(root).toBeVisible()
    for (const text of row.text) await expect(root).toContainText(text)
    for (const text of row.absent ?? []) await expect(root).not.toContainText(text)
    for (const selector of row.marks ?? []) {
      const mark = page.locator(selector)
      await expect(mark).toBeVisible()
      await expect(mark.locator('path')).toHaveAttribute('d', /.+/)
    }
    if (row.disabled) {
      const controls = page.locator(row.disabled)
      expect(await controls.count()).toBeGreaterThan(0)
      for (const control of await controls.all()) await expect(control).toBeDisabled()
    }
    if (row.tabular) await expect(page.locator(row.tabular).first()).toHaveCSS('font-variant-numeric', /tabular-nums/)
    if (row.action) {
      const action = page.locator(row.action).first()
      await action.click()
      await expect(action.locator('..')).toHaveAttribute('open', '')
    }
    await page.evaluate(() => document.fonts.ready)
    const assets = await page.locator('link[rel="stylesheet"][href^="/assets/"], script[type="module"][src^="/assets/"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href') || node.getAttribute('src')))
    expect(assets.length).toBeGreaterThan(0)
    const provenance = []
    for (const asset of assets) {
      const bytes = await (await page.request.get(new URL(asset, origin).href)).body()
      expect(bytes, `${asset}: served build must match this checkout`).toEqual(readFileSync(join(ROOT, 'dist', asset.slice(1))))
      if (asset.endsWith('.js')) expect(bytes.toString()).toContain('last loaded')
      provenance.push({ asset, sha256: createHash('sha256').update(bytes).digest('hex') })
    }
    const evidence = { surface: row.name, width: row.width, theme, url: page.url(), head: process.env.CAPTURE_HEAD, provenance }
    await info.attach('demo-truth-provenance', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' })
    if (process.env.DEMO_TRUTH_CAPTURE_DIR) {
      mkdirSync(process.env.DEMO_TRUTH_CAPTURE_DIR, { recursive: true })
      const stem = `${row.name.replaceAll(' ', '-')}-${theme}`
      await page.screenshot({ path: join(process.env.DEMO_TRUTH_CAPTURE_DIR, `${stem}.png`) })
      writeFileSync(join(process.env.DEMO_TRUTH_CAPTURE_DIR, `${stem}.json`), JSON.stringify(evidence, null, 2))
    }
  })
}
