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
    const marks = []
    for (const selector of row.marks ?? []) {
      const mark = root.locator(selector)
      await expect(mark).toHaveCount(1)
      await expect(mark).toBeVisible()
      await expect(mark.locator('path')).toHaveAttribute('d', /.+/)
      const order = await mark.evaluate(node => ({ brand: node.dataset.brand, nextText: node.nextSibling?.nodeType === Node.TEXT_NODE ? node.nextSibling.textContent.trimStart() : node.closest('.txn-roleico')?.nextElementSibling?.textContent.trimStart(), decorative: node.getAttribute('aria-hidden') }))
      if (selector.includes('.txn-roleico')) {
        expect(order.nextText).toBe('assistant')
        await expect(mark).toHaveAttribute('aria-label', new RegExp(`^${order.brand}\\b`, 'i'))
        await expect(mark).not.toHaveAttribute('aria-hidden', 'true')
      } else {
        expect(order.nextText, `${row.name}: ${selector} must immediately precede its provider name`).toMatch(new RegExp(`^${order.brand}\\b`))
        expect(order.decorative).toBe('true')
      }
      marks.push({ selector, count: await mark.count(), ...order })
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
      if (row.actionStatus) await expect(root.getByRole('status')).toContainText(row.actionStatus)
      else await expect(action.locator('..')).toHaveAttribute('open', '')
    }
    await page.evaluate(() => document.fonts.ready)
    // Hash navigation can happen before React mounts the target. Explicitly move
    // the mounted demo into the viewport; visibility alone permits offscreen DOM.
    await page.locator('#inuse').evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }))
    await expect(page.locator('.iu-bar')).toBeInViewport()
    await expect(root).toBeInViewport()
    const assets = await page.locator('link[rel="stylesheet"][href^="/assets/"], script[type="module"][src^="/assets/"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href') || node.getAttribute('src')))
    expect(assets.length).toBeGreaterThan(0)
    const provenance = []
    for (const asset of assets) {
      const bytes = await (await page.request.get(new URL(asset, origin).href)).body()
      expect(bytes, `${asset}: served build must match this checkout`).toEqual(readFileSync(join(ROOT, 'dist', asset.slice(1))))
      if (asset.endsWith('.js')) expect(bytes.toString()).toContain('last loaded')
      provenance.push({ asset, sha256: createHash('sha256').update(bytes).digest('hex') })
    }
    const observations = { root: row.root, text: await root.innerText(), marks, bounds: await root.boundingBox(), shellBounds: await page.locator('.iu-bar').boundingBox(), scrollY: await page.evaluate(() => window.scrollY) }
    const evidence = { surface: row.name, width: row.width, theme, url: page.url(), head: process.env.CAPTURE_HEAD, harnessHead: process.env.CAPTURE_HARNESS_HEAD, observations, provenance }
    await info.attach('demo-truth-provenance', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' })
    if (process.env.DEMO_TRUTH_CAPTURE_DIR) {
      mkdirSync(process.env.DEMO_TRUTH_CAPTURE_DIR, { recursive: true })
      const stem = `${row.name.replaceAll(' ', '-')}-${theme}`
      await page.screenshot({ path: join(process.env.DEMO_TRUTH_CAPTURE_DIR, `${stem}.png`) })
      if (row.focus) {
        const detail = root.locator(row.focus).first()
        await detail.scrollIntoViewIfNeeded()
        await expect(detail).toBeInViewport()
        await page.screenshot({ path: join(process.env.DEMO_TRUTH_CAPTURE_DIR, `${stem}-detail.png`) })
        evidence.detail = { selector: row.focus, text: await detail.innerText(), bounds: await detail.boundingBox(), scrollY: await page.evaluate(() => window.scrollY) }
      }
      writeFileSync(join(process.env.DEMO_TRUTH_CAPTURE_DIR, `${stem}.json`), JSON.stringify(evidence, null, 2))
    }
  })
}
