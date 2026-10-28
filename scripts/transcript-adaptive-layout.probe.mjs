/* Mounted product path, with the same fixture and themes used by the in-use demo. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { loadStrictYaml, assertExactNames } from './css-source.mjs'

const fixture = loadStrictYaml('scripts/testdata/transcript-adaptive-layout.yaml')
const manifest = loadStrictYaml('scripts/testdata/transcript-adaptive-layout.manifest.yaml')
assertExactNames(fixture.cases.map(row => row.name), manifest.requiredCases, 'adaptive cases')
assertExactNames(fixture.themes, manifest.requiredThemes, 'adaptive themes')
assertExactNames(fixture.motion, manifest.requiredMotion, 'adaptive motion')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined })
const base = process.env.TRANSCRIPT_PROBE_URL || 'http://localhost:5180'
try {
  for (const row of fixture.cases) for (const theme of fixture.themes) for (const motion of fixture.motion) {
    const page = await browser.newPage({ viewport: { width: row.width, height: 1000 }, reducedMotion: motion })
    await page.goto(`${base}/?app=transcript&transcript=ledger-actions&fb=off&theme=${theme}#inuse`)
    await page.locator('.txn-turnwrap-ledger').first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    if (row.behavior === 'drawer') {
      await page.getByRole('button', { name: 'transcript tools', exact: true }).click()
      await page.getByRole('button', { name: 'user turns', exact: true }).click()
      assert.equal(await page.getByRole('dialog', { name: 'user turns' }).isVisible(), true)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'transcript tools', exact: true }).click()
      await page.locator('.txn-app').getByRole('button', { name: 'filters', exact: true }).click()
      assert.equal(await page.getByRole('dialog', { name: 'filters' }).isVisible(), true)
      console.log(`${row.name} ${theme} ${motion}: passed`)
      await page.close()
      continue
    }
    const grid = page.locator('.txn-body-grid')
    const reader = page.locator('.txn-turnwrap-ledger').first()
    const rect = async () => { const r = await reader.boundingBox(); return { x: r.x, width: r.width } }
    const toggle = async name => {
      await page.getByRole('button', { name, exact: true }).click()
      await page.waitForTimeout(motion === 'reduce' ? 30 : 350)
    }
    const both = await rect()
    await toggle('collapse user turns outline')
    assert.equal(await page.getByRole('button', { name: 'expand user turns outline', exact: true }).evaluate(el => el === document.activeElement), true)
    const right = await rect()
    await toggle('collapse filters')
    const neither = await rect()
    await toggle('expand user turns outline')
    const left = await rect()
    if (row.behavior === 'stable') {
      assert.equal(await grid.getAttribute('data-reader-room'), 'true')
      for (const current of [right, neither, left]) {
        assert.ok(Math.abs(current.x - both.x) < 1, `${row.name}: x changed`)
        assert.ok(Math.abs(current.width - both.width) < 1, `${row.name}: width changed`)
      }
    } else if (row.behavior === 'intermediate') {
      for (const current of [right, neither, left]) assert.ok(Math.abs(current.width - neither.width) < 1, `${row.name}: one rail shrank reader`)
      assert.ok(both.width < neither.width, `${row.name}: two rails should constrain reader`)
    } else assert.ok(both.width < right.width && right.width < neither.width, `${row.name}: constrained reader did not reclaim space`)
    await page.keyboard.press('Control+f')
    await page.getByRole('textbox', { name: 'search transcript' }).fill('transcript')
    assert.ok(await page.getByRole('textbox', { name: 'search transcript' }).isVisible())
    await page.waitForFunction(() => !document.querySelector('.txn-search-count')?.textContent.includes('0 matches'))
    await page.keyboard.press('Escape')
    const handle = page.getByRole('separator', { name: 'reading width' })
    await handle.focus()
    await page.keyboard.press('End')
    assert.equal(await handle.getAttribute('aria-valuetext'), 'full width')
    await page.waitForFunction(() => !document.querySelector('.txn-body-grid').hasAttribute('data-reader-room'))
    await grid.evaluate(async el => { await Promise.allSettled(el.getAnimations().map(animation => animation.finished)) })
    await page.waitForFunction(() => {
      const stream = document.querySelector('.txn-stream')
      const style = getComputedStyle(stream)
      const full = stream.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      return Math.abs(document.querySelector('.txn-turnwrap-ledger').getBoundingClientRect().width - full) < 2
    })
    const fullBefore = await rect()
    await toggle('expand filters')
    assert.equal(await handle.getAttribute('aria-valuetext'), 'full width')
    await page.waitForFunction(width => document.querySelector('.txn-turnwrap-ledger').getBoundingClientRect().width < width - 1, fullBefore.width)
    const fullAfter = await rect()
    assert.ok(fullAfter.width < fullBefore.width, `${row.name}: full width did not follow the open rail`)
    await toggle('collapse user turns outline')
    await toggle('collapse filters')
    await handle.focus()
    await page.keyboard.press('Home')
    await page.waitForFunction(() => Number(document.querySelector('.txn-reader-handle').getAttribute('aria-valuenow')) === 600)
    await page.waitForTimeout(100)
    const beforeDrag = Number(await handle.getAttribute('aria-valuenow'))
    const box = await handle.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 })
    await page.mouse.up()
    assert.ok(Number(await handle.getAttribute('aria-valuenow')) > beforeDrag, `${row.name}: drag did not resize`)
    console.log(`${row.name} ${theme} ${motion}: passed`)
    await page.close()
  }
} finally { await browser.close() }
