import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { preview } from 'vite'
import puppeteer from 'puppeteer-core'
import YAML from 'yaml'
import { installHarnessGuard } from './harness-guard.mjs'

const output = process.env.HELPER_CAPTURE_DIR || '/tmp/opencode/helper-worker/captures'
const chrome = process.env.CHROME_PATH || '/home/minttea/.nix-profile/bin/google-chrome'
const port = Number(process.env.HELPER_DEMO_PORT || 5289)
const fixtures = YAML.parse(readFileSync('scripts/testdata/helper_group_listing.yaml', 'utf8'))
const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.js'))
assert.ok(assets.some((name) => readFileSync(`dist/assets/${name}`, 'utf8').includes('data-helper-demo')), 'built artifact must contain the helper demo marker; rebuild this checkout')
mkdirSync(output, { recursive: true })
installHarnessGuard({ label: 'helper groups mounted probe' })
const served = await preview({ configFile: false, preview: { port, strictPort: true, host: '127.0.0.1' } })
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, defaultViewport: { width: 1440, height: 1000 } })
const evidence = { source: process.cwd(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), assets, probes: [] }
const luminance = (css) => {
  const channels = css.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255)
    .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}
const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05)
try {
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    for (const fixture of fixtures.cases) {
      await page.goto(`http://127.0.0.1:${port}/?app=commons&helpers=${fixture.name}&theme=${theme}#inuse`, { waitUntil: 'networkidle2' })
      await page.waitForSelector(`[data-helper-demo="${fixture.name}"] .helper-group-trigger`)
      await page.$eval('#inuse', (element) => element.scrollIntoView({ behavior: 'instant' }))
      await page.evaluate(() => document.fonts.ready)
      assert.ok(await page.$eval('.iu-subnav', (el) => el.textContent.includes('explore')), 'mounted shell and navigation')
      assert.equal(await page.$eval('.helper-group-trigger', (el) => el.getAttribute('aria-expanded')), 'false')
      if (fixture.name === 'three-independent-counts') await page.screenshot({ path: resolve(output, `${theme}-collapsed.png`) })
      for (const trigger of await page.$$('.helper-group-trigger')) {
        await trigger.focus()
        await page.keyboard.press('Enter')
        assert.equal(await trigger.evaluate((el) => el.getAttribute('aria-expanded')), 'true')
        assert.ok(await trigger.evaluate((el) => document.activeElement === el), 'keyboard expansion retains focus')
      }
      assert.deepEqual(await page.$$eval('.helper-group-members [data-thread-id]', (rows) => rows.map((el) => el.dataset.threadId)), fixture.expectedRows)
      assert.deepEqual(await page.$$eval('.helper-group-members [data-thread-id]', (rows) => rows.map((el) => !!el.querySelector('.helper-thread-marker'))),
        fixture.expectedRows.map(() => true), 'subagent-inset marker on every member row')
      const renderedText = await page.$eval('.helper-demo', (el) => el.textContent)
      for (const text of fixture.expectedText) assert.ok(renderedText.includes(text), `${fixture.name}: ${text}`)
      if (fixture.select) {
        await page.focus(`.helper-group-members [data-thread-id="${fixture.select}"] input`)
        await page.keyboard.press('Space')
        assert.ok(await page.$eval('.helper-demo', (el) => el.textContent.includes('selected transcripts: G2')))
        await page.focus(`.helper-group-members [data-thread-id="${fixture.select}"] a`)
        await page.keyboard.press('Enter')
        assert.equal(await page.$eval('.helper-demo > div:not([hidden]) [data-thread-id]', (el) => el.dataset.threadId), fixture.select, 'actual individual open callback')
        await page.click('.helper-demo > div:not([hidden]) > button')
        assert.equal(await page.$eval('.helper-group-trigger', (el) => el.getAttribute('aria-expanded')), 'true', 'return retains disclosure')
        assert.ok(await page.$eval('.helper-demo', (el) => el.textContent.includes('selected transcripts: G2')), 'return retains selection')
      }
      if (fixture.scopeExpired) {
        assert.ok(await page.$('.helper-group-members') === null, 'expired scope hides stale member actions')
        await page.screenshot({ path: resolve(output, `${theme}-${fixture.name}.png`) })
        await page.click('.helper-group-action')
        assert.equal(await page.$eval('.helper-group-trigger', (el) => el.getAttribute('aria-expanded')), 'false', 'refreshed scope resets disclosure')
        await page.click('.helper-group-trigger')
        assert.deepEqual(await page.$$eval('.helper-group-members [data-thread-id]', (rows) => rows.map((el) => el.dataset.threadId)), ['G2'], 'refresh retains exact helper-only scope')
      }
      const styles = await page.evaluate(() => {
        const read = (selector) => {
          const el = document.querySelector(selector)
          if (!el) return null
          const s = getComputedStyle(el)
          return { font: s.fontFamily, size: s.fontSize, radius: s.borderRadius, transform: s.textTransform,
            numeric: s.fontVariantNumeric, color: s.color, background: s.backgroundColor,
            borderLeftWidth: s.borderLeftWidth,
            animation: s.animationDuration, animationName: s.animationName, transition: s.transitionDuration }
        }
        return { trigger: read('.helper-group-trigger'), group: read('.helper-group'),
          title: read('.helper-thread-open'), meta: read('.helper-thread-meta'),
          marker: read('.helper-thread-marker'), members: read('.helper-group-members'),
          fonts: document.fonts.check('16px "Atkinson Hyperlegible"') && document.fonts.check('14px "Atkinson Hyperlegible Mono"'),
          overflow: document.documentElement.scrollWidth > window.innerWidth }
      })
      assert.ok(styles.trigger.font.includes('Atkinson Hyperlegible Mono'))
      assert.equal(styles.trigger.size, '14px')
      assert.equal(styles.trigger.radius, '0px')
      assert.equal(styles.trigger.animationName, 'none', 'no animation is attached to helper controls')
      assert.ok(ratio(styles.trigger.color, styles.group.background) >= 4.5, 'actual chrome contrast AA')
      if (styles.title) {
        assert.ok(styles.title.font.includes('Atkinson Hyperlegible'))
        assert.equal(styles.title.size, '16px')
        assert.equal(styles.title.transform, 'none')
        assert.ok(styles.meta.numeric.includes('tabular-nums'))
        assert.ok(ratio(styles.meta.color, styles.group.background) >= 4.5, 'actual secondary contrast AA')
        assert.ok(styles.marker, 'inset marker renders beside every member row')
        assert.equal(styles.members.borderLeftWidth, '2px', 'member list carries the inset rule')
      }
      assert.ok(styles.fonts, 'Atkinson fonts loaded')
      assert.equal(styles.overflow, false)
      evidence.probes.push({ theme, case: fixture.name, styles })
      if (!fixture.scopeExpired) await page.screenshot({ path: resolve(output, `${theme}-${fixture.name}.png`) })
    }
    assert.deepEqual(errors, [], 'mounted demo runtime errors')
    await page.close()
  }
  writeFileSync(resolve(output, 'provenance.json'), JSON.stringify(evidence, null, 2))
  console.log(`PASS built helper demo keyboard/callbacks/styles in both themes: ${output}`)
} finally { await browser.close(); await new Promise((done) => served.httpServer.close(done)) }
