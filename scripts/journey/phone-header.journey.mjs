import { test, expect } from '@playwright/test'
import { loadFixturePair } from '../mounted-parts.mjs'

/* Phone headers on the built in-use demo, on a 390px touch screen in both themes.
   Cases: scripts/testdata/phone-header.yaml (+ .manifest.yaml). */
const { fixture } = loadFixturePair('scripts/testdata/phone-header.yaml', 'scripts/testdata/phone-header.manifest.yaml', { cases: 'requiredCaseNames' })
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`

for (const row of fixture.cases) {
  test(`phone header ${row.name}`, async ({ browser }, info) => {
    const context = `${row.name} (${info.project.name})`
    const phone = await browser.newContext({ viewport: fixture.viewport, hasTouch: true, isMobile: true, colorScheme: info.project.name })
    const page = await phone.newPage()
    await page.goto(`${origin}/?fb=off&${row.query}&theme=${info.project.name}#inuse`)
    await page.locator('#inuse').scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready)
    const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } }
    if (row.kind === 'tab-bar') {
      await expect(page.locator('#inuse .txn-search-trigger')).toBeVisible()
      const bar = await page.evaluate((boxSrc) => {
        const box = new Function(`return ${boxSrc}`)()
        const tabs = document.querySelector('#inuse .txn-tabs')
        const trigger = document.querySelector('#inuse .txn-search-trigger')
        const key = trigger.querySelector('.txn-search-key')
        tabs.scrollLeft = tabs.scrollWidth
        const last = [...tabs.querySelectorAll('.txn-tab')].at(-1)
        return { tabs: box(tabs), trigger: box(trigger), keyShown: !!key && getComputedStyle(key).display !== 'none', scrolls: tabs.scrollWidth > tabs.clientWidth, last: box(last), control: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--control-h')) }
      }, box.toString())
      expect(bar.tabs.right, `${context}: the tab strip must end before the trigger ${JSON.stringify(bar)}`).toBeLessThanOrEqual(bar.trigger.left)
      expect(bar.keyShown, `${context}: a touch screen's trigger must not show ⌘F`).toBe(false)
      expect(Math.round(bar.trigger.width), `${context}: the trigger must be one square control`).toBe(Math.round(bar.control))
      expect(bar.trigger.height, `${context}: the trigger keeps the 44px reach`).toBeGreaterThanOrEqual(44)
      expect(bar.scrolls, `${context}: the tab strip scrolls in its own row`).toBe(true)
      expect(bar.last.right, `${context}: the strip scrolls to its last tab`).toBeLessThanOrEqual(bar.tabs.right + 1)
    }
    await phone.close()
  })
}
