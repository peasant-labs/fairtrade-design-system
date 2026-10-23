import { test, expect } from '@playwright/test'
import { loadFixturePair } from '../mounted-parts.mjs'

/* One page frame: every app page's title sits at the AppPage inset from the column beside the
   sidebar (32px from 768px up, 16px below), in Storybook's AppPage and in the built in-use demo.
   Cases: scripts/testdata/page-frame.yaml (+ .manifest.yaml). */
const { fixture } = loadFixturePair('scripts/testdata/page-frame.yaml', 'scripts/testdata/page-frame.manifest.yaml', { widths: 'requiredWidthNames', pages: 'requiredPageNames' })
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`

for (const width of fixture.widths) for (const row of fixture.pages) {
  test(`page frame ${row.name} ${width.name}`, async ({ page }, info) => {
    const context = `${row.name} at ${width.width} (${info.project.name})`
    await page.setViewportSize({ width: width.width, height: width.height })
    if (row.where === 'storybook') await page.goto(`/iframe.html?id=${row.story}&viewMode=story&globals=theme:${info.project.name}`)
    else await page.goto(`${origin}/?fb=off&${row.query}&theme=${info.project.name}#inuse`)
    const title = page.locator(row.title).first()
    await expect(title, `${context}: the page title must render`).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const inset = await page.evaluate(({ host, title }) => {
      const heading = document.querySelector(title)
      const column = heading?.closest(host.replace(/^#inuse /, '')) ?? document.querySelector(host)
      return Math.round(heading.getBoundingClientRect().left - column.getBoundingClientRect().left)
    }, { host: row.host, title: row.title })
    expect(inset, `${context}: the title must sit ${width.inset}px in from the column`).toBe(width.inset)
  })
}
