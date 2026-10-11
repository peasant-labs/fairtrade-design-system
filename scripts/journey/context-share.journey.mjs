import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const spec = loadStrictYaml('scripts/testdata/context-share.yaml')
const manifest = loadStrictYaml('scripts/testdata/context-share.manifest.yaml')
assertExactNames(spec.cases.map((row) => row.name), manifest.requiredCaseNames, 'context share rows')
const appURL = `http://localhost:${process.env.JOURNEY_APP_PORT || '5180'}`
const asset = readdirSync('dist/assets').find((file) => file.endsWith('.js') && readFileSync(join('dist/assets', file), 'utf8').includes('context-retention-demo'))
if (!asset) throw new Error('context share journey: dist/assets lacks the context demo; rebuild this checkout before testing the mounted exit')

for (const row of spec.cases) {
  test(row.name, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const response = await page.request.get(`${appURL}/assets/${asset}`)
    expect(await response.text()).toBe(readFileSync(join('dist/assets', asset), 'utf8'))
    await page.goto(`${appURL}/?fb=off&app=transcript&transcript=context&theme=${row.theme}#inuse`)
    await expect.poll(() => page.locator('html').evaluate((el) => el.dataset.theme || 'dark')).toBe(row.theme)
    const viewer = page.locator('#inuse .txn-app')
    await viewer.getByRole('button', { name: 'share', exact: true }).click()
    await viewer.getByRole('menuitem', { name: 'copy link', exact: true }).click()
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(page.url())
  })
}
