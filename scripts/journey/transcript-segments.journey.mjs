import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

/* The segmented transcript journey. It drives the built app (vite preview on dist)
   in both themes and proves the reader-visible contract:
     • one faded dotted boundary per unloaded edge, each with exactly one load-more;
     • a jump into an unloaded middle segment renders only after its covering run is
       in hand, with a boundary before and after;
     • the mounted turn cards never exceed the loaded segments' turns;
     • the scrubber mounts the bounded segment sample, never one node per turn;
     • the served build is this worktree's dist, not a stale artifact.

   Run: pnpm build && pnpm journey:ci (or target this file directly).
   JOURNEY_SCREENSHOT=on and SEGMENT_CAPTURE_DIR give the both-theme captures. */
const ROOT = new URL('../..', import.meta.url).pathname
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || '5180'}`
const captureDir = process.env.SEGMENT_CAPTURE_DIR || join(ROOT, 'scripts/journey/.artifacts/transcript-segments')

async function provenance(page, theme, label) {
  const assets = await page
    .locator('link[rel="stylesheet"][href^="/assets/"], script[type="module"][src^="/assets/"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') || node.getAttribute('src')))
  expect(assets.length).toBeGreaterThan(0)
  const recorded = []
  for (const asset of assets) {
    const response = await page.request.get(new URL(asset, origin).href)
    const bytes = await response.body()
    expect(bytes, `${label} ${theme}: ${asset} is not this worktree's dist build`).toEqual(readFileSync(join(ROOT, 'dist', asset.replace(/^\//, ''))))
    recorded.push({ asset, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  const distNewest = Math.max(...['assets'].flatMap(() => []))
  void distNewest
  const styleSources = await page.evaluate(async () => {
    const hrefs = [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href)
    const texts = await Promise.all(hrefs.map((href) => fetch(href).then((response) => response.text())))
    return texts.join('\n')
  })
  expect(styleSources, `${label} ${theme}: the served stylesheet must carry the segment boundary rules`).toContain('txn-segboundary')
  return { theme, assets: recorded, head: process.env.CAPTURE_HEAD ?? null }
}

async function captureCopy(page, theme, name) {
  const root = page.locator('#inuse')
  const visibleText = async (selector) => {
    const nodes = root.locator(selector)
    const result = []
    for (let i = 0; i < await nodes.count(); i += 1) {
      const node = nodes.nth(i)
      if (await node.isVisible() && await node.evaluate((element) => {
        const box = element.getBoundingClientRect()
        const clip = element.closest('.txn-stream')?.getBoundingClientRect()
        return box.bottom > Math.max(0, clip?.top ?? 0) && box.top < Math.min(innerHeight, clip?.bottom ?? innerHeight) && box.right > 0 && box.left < innerWidth
      })) result.push((await node.innerText()).trim())
    }
    return result
  }
  mkdirSync(captureDir, { recursive: true })
  await root.screenshot({ path: join(captureDir, `${name}-${theme}.png`) })
  console.log(JSON.stringify({ capture: name, theme, header: await visibleText('.txn-trace-count'), boundary: await visibleText('.txn-segboundary-caption'), phase: await visibleText('.txn-phase .rng'), held: await visibleText('.txn-held-window') }))
}

for (const anchor of [60]) {
  test(`segments jump window ${anchor}`, async ({ page }, info) => {
    const theme = info.project.name
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${origin}/?app=transcript&transcript=segments&turn=${anchor}&fb=off&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    expect(await page.locator('html').getAttribute('data-theme') || 'dark').toBe(theme)

    const evidence = await provenance(page, theme, `segments jump ${anchor}`)
    const stream = page.locator('#inuse .txn-stream')
    await expect(stream).toHaveAttribute('data-segment-mode', 'true')

    /* the window's covering run renders, and nothing else does */
    const cards = page.locator('#inuse .txn-turn')
    await expect(cards.first()).toBeVisible()
    const mounted = await cards.count()
    const bound = Number(await stream.getAttribute('data-mounted-turn-bound'))
    expect(bound).toBeGreaterThan(0)
    expect(mounted, 'mounted cards stay within the loaded segments').toBeLessThanOrEqual(bound)

    /* a boundary before and after the window, one control each */
    const boundaries = page.locator('#inuse [data-segment-boundary]')
    await expect(boundaries).toHaveCount(2)
    for (const side of ['older', 'newer']) {
      const boundary = page.locator(`#inuse [data-segment-boundary="${side}"]`)
      await expect(boundary).toHaveCount(1)
      await expect(boundary.locator('button.txn-segboundary-load')).toHaveCount(1)
      await expect(boundary.locator('.txn-segboundary-caption')).not.toBeEmpty()
      const dot = await boundary.locator('.txn-segboundary-rule').evaluate((node) => {
        const style = getComputedStyle(node)
        return { style: style.borderLeftStyle, width: style.borderLeftWidth, color: style.borderLeftColor }
      })
      expect(dot.style).toBe('dotted')
      expect(parseFloat(dot.width)).toBeGreaterThan(0)
      expect(dot.color).not.toBe('rgba(0, 0, 0, 0)')
    }

    /* the scrubber samples segments; the transcript only has thirteen */
    await stream.evaluate((node) => { node.scrollTop = node.scrollHeight })
    await expect(page.locator('#inuse .txn-scrub-segment-tick')).toHaveCount(13)
    expect(await page.locator('#inuse .txn-scrub').getAttribute('aria-valuemax')).toBe('13')

    mkdirSync(captureDir, { recursive: true })
    await captureCopy(page, theme, 'jump')
    await info.attach('transcript-segments-provenance', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' })

    /* loading the older edge walks the region up to the start; each load never grows
       the boundary count, and the older edge disappears once segment 0 is in hand */
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const older = page.locator('#inuse [data-segment-boundary="older"] .txn-segboundary-load')
      if ((await older.count()) === 0) break
      await older.first().click()
      await page.waitForTimeout(120)
    }
    await expect(page.locator('#inuse [data-segment-boundary="older"]')).toHaveCount(0)
    await expect(page.locator('#inuse [data-segment-boundary]')).toHaveCount(1)
    await page.locator('#inuse').screenshot({ path: join(captureDir, `jump-${anchor}-${theme}-loaded.png`) })
  })
}

test('large run shows both load-more boundaries', async ({ page }, info) => {
    const theme = info.project.name
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${origin}/?app=transcript&transcript=segments&large=1&fb=off&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.locator('#inuse').scrollIntoViewIfNeeded()
    const evidence = await provenance(page, theme, 'large run paging')
    const stream = page.locator('#inuse .txn-stream')
    await expect(stream).toHaveAttribute('data-segment-mode', 'true')
    const older = page.locator('#inuse [data-segment-boundary="older"]')
    const newer = page.locator('#inuse [data-segment-boundary="newer"]')
    await expect(older).toHaveCount(1)
    await expect(newer).toHaveCount(1)
    await expect(older.locator('button.txn-segboundary-load')).toBeInViewport()
    await expect(newer.locator('button.txn-segboundary-load')).toBeInViewport()
    expect(Number(await stream.getAttribute('data-mounted-turn-bound'))).toBeGreaterThan(0)
    /* the middle segment opens first: a short run of large tool calls */
    const cards = await page.locator('#inuse .txn-turn').count()
    expect(cards).toBeLessThanOrEqual(Number(await stream.getAttribute('data-mounted-turn-bound')))
    mkdirSync(captureDir, { recursive: true })
    await page.locator('#inuse').screenshot({ path: join(captureDir, `large-run-both-sides-${theme}.png`) })
    await info.attach('large-run-both-sides-provenance', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' })

    await older.locator('button.txn-segboundary-load').click()
    await expect(page.locator('#inuse [data-segment-boundary="older"]')).toHaveCount(0)
    await expect(page.locator('#inuse [data-segment-boundary="newer"]')).toHaveCount(1)
    await page.locator('#inuse [data-segment-boundary="newer"] button.txn-segboundary-load').click()
    await expect(page.locator('#inuse [data-segment-boundary="newer"]')).toHaveCount(0)
})

test('large run jumps to the post-run user turn', async ({ page }, info) => {
  const theme = info.project.name
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${origin}/?app=transcript&transcript=segments&large=1&turn=16&fb=off&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.locator('#inuse').scrollIntoViewIfNeeded()
  const evidence = await provenance(page, theme, 'large run jump')
  await expect(page.locator('#inuse #turn-16')).toBeVisible()
  await expect(page.locator('#inuse [data-segment-boundary="older"]')).toHaveCount(1)
  await expect(page.locator('#inuse [data-segment-boundary="newer"]')).toHaveCount(1)
  await expect(page.locator('#inuse [data-segment-boundary="older"] button.txn-segboundary-load')).toHaveCount(1)
  await expect(page.locator('#inuse [data-segment-boundary="newer"] button.txn-segboundary-load')).toHaveCount(1)
  /* bring the newer edge into the same frame as the post-run user turn */
  await page.locator('#inuse .txn-stream').evaluate((node) => { node.scrollTop += 180 })
  await page.waitForTimeout(120)
  mkdirSync(captureDir, { recursive: true })
  await page.locator('#inuse').screenshot({ path: join(captureDir, `large-run-after-jump-${theme}.png`) })
  await info.attach('large-run-after-jump-provenance', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' })
})

test('incomplete window names its held range and continuation', async ({ page }, info) => {
  const theme = info.project.name
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${origin}/?app=transcript&transcript=segments&large=1&turn=16&held=1&fb=off&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.locator('#inuse').scrollIntoViewIfNeeded()
  expect(await page.locator('html').getAttribute('data-theme') || 'dark').toBe(theme)
  await provenance(page, theme, 'held window')
  await expect(page.locator('#inuse .txn-held-window')).toHaveText('these turns are hidden because surrounding turns are not loaded')
  await captureCopy(page, theme, 'held')
  await expect(page.locator('#inuse [data-segment-boundary]')).toHaveCount(2)
  await expect(page.locator('#inuse .txn-action-continuation')).toHaveCount(1)
  await expect(page.locator('#inuse .txn-action-continuation')).toContainText('actions continue from the unloaded turns between')
})

test('phase captions name counts, not indexes', async ({ page }, info) => {
  const theme = info.project.name
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${origin}/?app=transcript&transcript=segments&turn=60&fb=off&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await provenance(page, theme, 'phase count')
  const phase = page.locator('#inuse .txn-phase .rng').first()
  await expect(phase).toHaveText(/^\d[\d,]* turns?(?:, \d[\d,]* error)?$/)
  await phase.scrollIntoViewIfNeeded()
  await captureCopy(page, theme, 'phase')
})

test('segments open at the first segment', async ({ page }, info) => {
  const theme = info.project.name
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${origin}/?app=transcript&transcript=segments&fb=off&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const stream = page.locator('#inuse .txn-stream')
  await expect(stream).toHaveAttribute('data-segment-mode', 'true')
  await expect(page.locator('#inuse [data-segment-boundary="older"]')).toHaveCount(0)
  await expect(page.locator('#inuse [data-segment-boundary="newer"]')).toHaveCount(1)
  const mounted = await page.locator('#inuse .txn-turn').count()
  expect(mounted).toBeLessThanOrEqual(Number(await stream.getAttribute('data-mounted-turn-bound')))
  mkdirSync(captureDir, { recursive: true })
  await page.locator('#inuse').screenshot({ path: join(captureDir, `open-${theme}.png`) })
})
