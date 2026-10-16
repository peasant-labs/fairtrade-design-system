/* Journey: Storybook smoke.
 *
 * Ports scripts/sbsmoke.mjs onto Playwright: loads every non-docs story
 * iframe (play() auto-runs inside the iframe) and fails on real JS errors or
 * an empty root. Clicks are trusted input events, so this also absorbs what
 * scripts/check-map-pointer.mjs proves separately with a raw CDP mouse.
 *
 * One test per theme; stories run serially in a single page. A story that
 * fails is retried once in isolation is unnecessary here — serial execution
 * has no tab-pool contention to absorb.
 */
import { readFile } from 'node:fs/promises'
import { test as base, expect } from '@playwright/test'
import { storyUrl } from './lib/fixtures.mjs'
import { assertWebServerServing } from './server-liveness.mjs'

const RESOURCE_NOISE = /Failed to load resource|ERR_NAME_NOT_RESOLVED|net::ERR|favicon|Download the React DevTools|preload/i

// No determinism shim here: stories' own play() functions assume a live
// clock (e.g. the daterange keyboard-nav story asserts the current year),
// and sbsmoke.mjs runs them unshimmed too. Theme still comes from the
// Playwright project name.
const test = base.extend({
  theme: async ({}, use, testInfo) => {
    await use(testInfo.project.name)
  },
})

test.describe('storybook smoke', () => {
  // The full catalog is hundreds of stories through one serial page; the
  // shared 60s timeout cannot hold it.
  test.setTimeout(600_000)
  // The served Storybook is started once for the whole run. Check it is still
  // there before the catalog walk (a failed beforeAll stops the remaining
  // tests in this file instead of letting each one fail on a dead port) and
  // again before the retry, so a mid-run death is reported as a missing server.
  test.beforeAll(async () => {
    await assertWebServerServing()
  })
  test.beforeEach(async () => {
    await assertWebServerServing()
  })
  test('every story renders without JS errors', async ({ page, theme }) => {
    const idx = JSON.parse(await readFile('storybook-static/index.json', 'utf8'))
    const ids = Object.values(idx.entries || idx.stories || {})
      .filter((e) => e.type !== 'docs')
      .map((e) => e.id)
    expect(ids.length).toBeGreaterThan(0)

    const failures = []
    for (const id of ids) {
      const errs = []
      const onConsole = (m) => {
        if (m.type() === 'error' && !RESOURCE_NOISE.test(m.text())) errs.push(m.text())
      }
      const onPageError = (e) => errs.push('pageerror: ' + e.message)
      page.on('console', onConsole)
      page.on('pageerror', onPageError)
      try {
        await page.goto(storyUrl(id, theme), { waitUntil: 'domcontentloaded', timeout: 20000 })
        // The story signals readiness through its root mounting; play()
        // runs inside the iframe on load. One macrotask of grace lets
        // settle-time console errors flush through.
        await page.waitForFunction(
          () => {
            const r = document.querySelector('#storybook-root,#root')
            return r && r.childElementCount > 0
          },
          null,
          { timeout: 15000 },
        )
        await page.waitForTimeout(50)
        const empty = await page.evaluate(() => {
          const r = document.querySelector('#storybook-root,#root')
          return !r || r.childElementCount === 0
        })
        if (empty) errs.push('smoke: empty root')
        if (errs.length) failures.push({ id, errs: errs.slice(0, 2) })
      } catch (e) {
        // A dead static server surfaces here as a navigation failure on the
        // story being loaded. Re-check liveness first: when the server is gone,
        // one actionable failure naming it beats a list of connection refusals
        // against the story ids that happened to be next.
        await assertWebServerServing()
        failures.push({ id, errs: ['goto: ' + e.message] })
      } finally {
        page.off('console', onConsole)
        page.off('pageerror', onPageError)
      }
    }
    expect(failures, JSON.stringify(failures.slice(0, 5), null, 2)).toEqual([])
  })
})
