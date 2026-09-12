import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { preview } from 'vite'
import puppeteer from 'puppeteer-core'
import YAML from 'yaml'
import { installHarnessGuard } from './harness-guard.mjs'

const output = process.env.HELPER_CAPTURE_DIR || '/tmp/opencode/helper-row-captures'
const chrome = process.env.CHROME_PATH || '/home/minttea/.nix-profile/bin/google-chrome'
const port = Number(process.env.HELPER_DEMO_PORT || 5289)
const fixtures = YAML.parse(readFileSync('scripts/testdata/helper_group_listing.yaml', 'utf8'))
const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.js'))
// Build provenance: the served bundle must carry both the demo marker and the
// row-anatomy class only the rewritten component emits.
const bundle = assets.map((name) => readFileSync(`dist/assets/${name}`, 'utf8')).join('\n')
assert.ok(bundle.includes('data-helper-demo'), 'built artifact must contain the helper demo marker; rebuild this checkout')
assert.ok(bundle.includes('helper-thread-facts'), 'built artifact must contain the ordinary-row fact line; rebuild this checkout')
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
      const triggers = await page.$$('.helper-group-trigger')
      assert.equal(triggers.length, fixture.groups.length, `${fixture.name}: one control per group`)
      // The closed control states its count, and the members it holds do not exist.
      assert.deepEqual(await page.$$eval('.helper-group-count', (els) => els.map((el) => el.textContent)),
        fixture.expectedLabels, `${fixture.name}: closed control label`)
      assert.equal(await page.$('.helper-group-members'), null, 'members exist only while expanded')
      assert.equal(await page.$('.helper-thread-marker'), null, 'no subagent-inset marker anywhere')
      assert.equal(await page.$$eval('.helper-group-trigger', (els) => els.every((el) => el.firstElementChild?.tagName.toLowerCase() === 'svg')), true, 'chevron leads every control')
      assert.deepEqual(await page.$$eval('.helper-group-trigger', (els) => els.map((el) => el.querySelector('.helper-group-show').textContent)),
        fixture.groups.map(() => 'show'), 'closed control offers show')
      if (fixture.name === 'three-independent-counts') await page.screenshot({ path: resolve(output, `${theme}-collapsed.png`) })
      for (const trigger of triggers) {
        await trigger.focus()
        await page.keyboard.press('Enter')
        assert.equal(await trigger.evaluate((el) => el.getAttribute('aria-expanded')), 'true')
        assert.ok(await trigger.evaluate((el) => document.activeElement === el), 'keyboard expansion retains focus')
        assert.equal(await trigger.evaluate((el) => el.querySelector('.helper-group-show').textContent), 'hide', 'open control offers hide')
      }
      assert.deepEqual(await page.$$eval('.helper-group-members [data-thread-id]', (rows) => rows.map((el) => el.dataset.threadId)), fixture.expectedRows)
      assert.equal(await page.$$eval('.helper-thread-marker', (els) => els.length), 0, 'revealed rows carry no inset marker')
      assert.equal(await page.$$eval('.helper-group-members [data-thread-id]', (rows) => rows.every((el) =>
        el.querySelector('.helper-thread-facts') && el.querySelector('.helper-thread-sep') && el.querySelector('.helper-thread-open'))), true,
        'every member row reads as title + middot facts + authorized link')
      const renderedText = await page.$eval('.helper-demo', (el) => el.textContent)
      for (const text of fixture.expectedText) assert.ok(renderedText.includes(text), `${fixture.name}: ${text}`)
      // Singular at one, never "1 helper threads" / "1 input submissions" / "1 turns".
      assert.equal((await page.$$eval('.helper-group-count', (els) => els.map((el) => el.textContent).join(' '))).includes('1 helper threads'), false)
      assert.equal(await page.$$eval('.helper-thread-facts', (els) => /\b1 (?:input submission|turn)s\b/.test(els.map((el) => el.textContent).join(' '))), false)
      if (fixture.select) {
        const groupIndex = fixture.groups.findIndex((group) => group.members.includes(fixture.select))
        const member = `.helper-group-members [data-thread-id="${fixture.select}"]`
        await page.focus(`${member} input`)
        await page.keyboard.press('Space')
        assert.ok(await page.$eval('.helper-demo', (el, wanted) => el.textContent.includes(`selected transcripts: ${wanted}`), fixture.select))
        // A selection inside the fold is stated on the CLOSED control, never silent.
        await triggers[groupIndex].click()
        assert.equal(await triggers[groupIndex].evaluate((el) => el.getAttribute('aria-expanded')), 'false', 'selection collapse')
        assert.equal(await page.$eval('.helper-group-count', (el) => el.textContent), fixture.expectedSelectedLabel, 'closed control states the hidden selection')
        assert.equal(await page.$('.helper-group-members'), null, 'collapsed members are gone')
        await triggers[groupIndex].click()
        assert.ok(await page.$eval(`${member} input`, (el) => el.checked), 'reopening retains the selection')
        await page.focus(`${member} a`)
        await page.keyboard.press('Enter')
        assert.equal(await page.$eval('.helper-demo > div:not([hidden]) [data-thread-id]', (el) => el.dataset.threadId), fixture.select, 'actual individual open callback')
        await page.click('.helper-demo > div:not([hidden]) > button')
        assert.equal(await page.$eval('.helper-group-trigger', (el) => el.getAttribute('aria-expanded')), 'true', 'return retains disclosure')
        assert.ok(await page.$eval('.helper-demo', (el, wanted) => el.textContent.includes(`selected transcripts: ${wanted}`), fixture.select), 'return retains selection')
      }
      if (fixture.scopeExpired) {
        assert.ok(await page.$('.helper-group-members') === null, 'expired scope hides stale member actions')
        await page.screenshot({ path: resolve(output, `${theme}-${fixture.name}.png`) })
        await page.click('.helper-group-action')
        assert.equal(await page.$eval('.helper-group-trigger', (el) => el.getAttribute('aria-expanded')), 'false', 'refreshed scope resets disclosure')
        assert.equal(await page.$eval('.helper-group-count', (el) => el.textContent), fixture.expectedLabels[0], 'refreshed control states the restored count')
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
            minHeight: s.minHeight, paddingLeft: s.paddingLeft,
            borderLeftWidth: s.borderLeftWidth, borderTopWidth: s.borderTopWidth,
            animation: s.animationDuration, animationName: s.animationName, transition: s.transitionDuration }
        }
        const rect = (selector) => {
          const el = document.querySelector(selector)
          return el ? el.getBoundingClientRect().left : null
        }
        const memberSeparators = [...document.querySelectorAll('.helper-group-members')].flatMap((list) =>
          [...list.children].slice(1).map((li) => getComputedStyle(li).borderTopWidth))
        return { trigger: read('.helper-group-trigger'), group: read('.helper-group'),
          count: read('.helper-group-count'), show: read('.helper-group-show'),
          body: read('.helper-group-body'), title: read('.helper-thread-open'), facts: read('.helper-thread-facts'),
          members: read('.helper-group-members'), memberSeparators,
          indent: { control: rect('.helper-group-trigger'), item: rect('.helper-group-item'), member: rect('.helper-group-members .helper-thread-row') },
          fonts: document.fonts.check('16px "Atkinson Hyperlegible"') && document.fonts.check('14px "Atkinson Hyperlegible Mono"'),
          overflow: document.documentElement.scrollWidth > window.innerWidth }
      })
      assert.ok(styles.trigger.font.includes('Atkinson Hyperlegible Mono'))
      assert.equal(styles.trigger.size, '14px')
      assert.equal(styles.trigger.radius, '0px')
      assert.equal(styles.trigger.minHeight, '44px', 'control keeps a comfortable target')
      assert.equal(styles.trigger.paddingLeft, '16px', 'control aligns with its revealed rows')
      assert.equal(styles.trigger.transform, 'lowercase', 'control chrome stays lowercase')
      assert.equal(styles.trigger.animationName, 'none', 'no animation is attached to helper controls')
      assert.ok(styles.count.numeric.includes('tabular-nums'), 'count is tabular')
      assert.ok(ratio(styles.trigger.color, styles.group.background) >= 4.5, 'actual chrome contrast AA')
      if (styles.show) assert.ok(ratio(styles.show.color, styles.group.background) >= 4.5, 'show/hide contrast AA')
      if (styles.title) {
        assert.ok(styles.title.font.includes('Atkinson Hyperlegible'))
        assert.equal(styles.title.size, '16px')
        assert.equal(styles.title.transform, 'none')
        assert.ok(styles.facts.numeric.includes('tabular-nums'))
        assert.ok(ratio(styles.facts.color, styles.group.background) >= 4.5, 'actual secondary contrast AA')
        assert.equal(styles.members.borderLeftWidth, '0px', 'revealed members carry no inset rule')
        assert.equal(styles.body.borderTopWidth, '1px', 'the control separates from its rows by a top rule')
        assert.ok(styles.memberSeparators.every((width) => width === '1px'), 'revealed rows separate from each other')
      }
      assert.ok(styles.indent.control > styles.indent.item, 'control is indented under its owner row')
      assert.ok(Math.abs(styles.indent.member - styles.indent.control) < 0.5, 'revealed rows align with the control')
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
