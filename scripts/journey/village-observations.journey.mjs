import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { loadFixturePair } from '../mounted-parts.mjs'

const { fixture } = loadFixturePair('scripts/testdata/village-observations.yaml', 'scripts/testdata/village-observations.manifest.yaml')
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('local village mounted catalog, history and independent pages', async ({ page, request }, info) => {
  const theme = info.project.name
  await page.setViewportSize({ width: 1280, height: 1100 })
  const url = `${origin}/?fb=off&app=graph&section=village&theme=${theme}#inuse`
  // Exact served artifact, not merely a DOM marker or an existing server that happens to mount.
  const html = await readFile('dist/index.html', 'utf8')
  expect(await (await request.get(url)).text()).toBe(html)
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+\.(?:js|css))"/g)].map((match) => match[1])
  expect(assets.length).toBeGreaterThan(0)
  for (const asset of assets) expect(digest(await (await request.get(origin + asset)).body())).toBe(digest(await readFile(`dist${asset}`)))
  await info.attach('served-build-provenance', { body: JSON.stringify({ theme, htmlSha256: digest(html), assets }), contentType: 'application/json' })
  await page.goto(url)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  const shell = page.locator('#inuse')
  const body = shell.locator('.vobs')
  await expect(shell.getByRole('button', { name: 'village', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(body.locator('strong').filter({ hasText: 'Acme Platform' })).toBeVisible()
  await body.getByRole('button', { name: 'fetch metadata' }).click()
  await expect(body.getByRole('status')).toContainText('partial fetch')
  await expect(body.locator('strong').filter({ hasText: 'Acme Platform Tools' })).toBeVisible()
  await expect(body.locator('[data-domain=history]')).toContainText('2026-10-15T09:00:00Z')
  await body.getByRole('tab', { name: 'history', exact: true }).focus()
  await page.keyboard.press('Enter')
  await body.getByRole('navigation', { name: 'remote attempts pages' }).getByRole('button', { name: 'next page' }).click()
  await expect(body.getByText('remote attempts saved item 2', { exact: true })).toBeVisible()
  await body.getByRole('tab', { name: 'confirmed receipts' }).click()
  await body.getByRole('navigation', { name: 'confirmed receipts pages' }).getByRole('button', { name: 'next page' }).click()
  await body.getByRole('tab', { name: 'operation diagnostics' }).click()
  await body.getByRole('navigation', { name: 'operation diagnostics pages' }).getByRole('button', { name: 'next page' }).click()
  await body.getByRole('button', { name: 'fetch metadata' }).click()
  await body.getByRole('tab', { name: 'remote attempts', exact: true }).click()
  await expect(body.getByRole('navigation', { name: 'remote attempts pages' }).getByRole('button', { name: 'page 2', exact: true })).toHaveAttribute('aria-current', 'page')
  await body.getByRole('tab', { name: 'confirmed receipts' }).click()
  await expect(body.getByText('confirmed receipts saved item 2', { exact: true })).toBeVisible()
  await body.getByRole('tab', { name: 'catalog', exact: true }).click()
  await body.getByRole('button', { name: 'untrack Acme Platform Tools' }).click()
  await expect(body.getByRole('status')).toContainText('tracking removed')
  await expect(shell.getByRole('navigation', { name: 'peasant sections' })).toBeInViewport()
  await expect(body.locator('.vobs-catalog p').first()).toHaveCSS('font-size', '16px')
  expect(await body.locator('.vobs-catalog p').first().evaluate((node) => getComputedStyle(node).fontFamily)).toContain('Atkinson Hyperlegible"')
  expect(await body.locator('p').first().evaluate((node) => getComputedStyle(node).fontFamily)).toContain('Atkinson')
  const axe = await new AxeBuilder({ page }).include('#inuse').analyze()
  expect(axe.violations).toEqual([])
  await shell.locator('.iu-stage').evaluate((node) => { node.scrollTop = 0 })
  await shell.screenshot({ path: info.outputPath(`village-${theme}-desktop.png`) })
  await page.setViewportSize({ width: 390, height: 844 })
  await shell.locator('.iu-stage').evaluate((node) => { node.scrollTop = 0 })
  await shell.screenshot({ path: info.outputPath(`village-${theme}-mobile.png`) })
  expect(await body.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)

  // The same named states used by SSR/DOM gates and stories, mounted on the real demo route.
  for (const row of fixture.cases) {
    await page.goto(`${origin}/?fb=off&app=graph&section=village&observations=${row.name}&theme=${theme}#inuse`)
    for (const text of row.text) await expect(body.getByText(text, { exact: false }).first()).toBeVisible()
    for (const text of row.absent ?? []) await expect(body.getByText(text, { exact: false })).toHaveCount(0)
    expect(await body.evaluate((node) => node.scrollWidth <= node.clientWidth), row.name).toBe(true)
    if (row.name === 'selected-page-conflict') {
      await body.getByRole('button', { name: 'restart this category' }).click()
      await expect(body.getByText('Historical Collective', { exact: true })).toBeVisible()
      await expect(body.getByRole('navigation', { name: 'remote attempts pages' }).getByRole('button', { name: 'page 1', exact: true })).toHaveAttribute('aria-current', 'page')
    }
    if (row.name === 'village-unavailable') await expect(shell.locator('.cx-offline-icon')).toHaveCount(0)
  }
  await page.goto(`${url.replace('#inuse', '')}&local=offline#inuse`)
  await expect(shell.locator('.vobs')).toBeVisible()
  await expect(shell.getByText('on this computer', { exact: false }).first()).toBeVisible()
  await shell.getByRole('button', { name: 'settings', exact: true }).click()
  await expect(shell.getByText('changes save right away', { exact: false })).toBeVisible()
  await shell.getByRole('button', { name: 'village', exact: true }).click()
  await expect(body).toBeVisible()
})
