import { test, expect } from '@playwright/test'
import { loadFixturePair } from '../mounted-parts.mjs'

/* A wrapped CommandBlock on a phone: the word after a long address (a pipe and its command) ends the
   address's last line rather than starting a line of its own, and no short run breaks inside itself.
   Cases: scripts/testdata/command-block-layout.yaml (+ .manifest.yaml). */
const { fixture } = loadFixturePair('scripts/testdata/command-block-layout.yaml', 'scripts/testdata/command-block-layout.manifest.yaml', { cases: 'requiredCaseNames' })

for (const row of fixture.cases) {
  test(`command block ${row.name}`, async ({ page }, info) => {
    const context = `${row.name} (${info.project.name})`
    await page.setViewportSize(fixture.viewport)
    await page.goto(`/iframe.html?id=${fixture.story}&viewMode=story&globals=theme:${info.project.name}`)
    await expect(page.locator('.cli-cmd-wrap').first()).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const layout = await page.evaluate(({ command, lastRun, follower }) => {
      const code = [...document.querySelectorAll('.cli-cmd-wrap code')].find((node) => node.textContent === `$ ${command}`)
      if (!code) return null
      const runs = [...code.querySelectorAll('.cli-run')]
      const top = (text) => Math.round(runs.find((run) => run.textContent === text)?.getBoundingClientRect().top ?? -1)
      const line = parseFloat(getComputedStyle(code).lineHeight)
      const broken = runs.filter((run) => run.textContent.length < 24 && run.getBoundingClientRect().height >= line * 1.5).map((run) => run.textContent)
      const lines = new Set(runs.map((run) => Math.round(run.getBoundingClientRect().top))).size
      // the text each drawn line ends on, across every wrapped command in the story
      const ends = []
      for (const block of document.querySelectorAll('.cli-cmd-wrap code')) {
        const byLine = new Map()
        for (const run of block.querySelectorAll('.cli-run')) {
          for (const rect of run.getClientRects()) byLine.set(Math.round(rect.top), run.textContent)
        }
        ends.push(...byLine.values())
      }
      return { lastRunTop: top(lastRun), followerTop: top(follower), broken, lines, hyphenEnds: ends.filter((text) => text.endsWith('-')) }
    }, row)
    expect(layout, `${context}: the command must render`).not.toBeNull()
    expect(layout.lines, `${context}: the command must wrap at this width`).toBeGreaterThan(1)
    expect(layout.followerTop, `${context}: ${JSON.stringify(row.follower)} must end the line ${JSON.stringify(row.lastRun)} ends on ${JSON.stringify(layout)}`).toBe(layout.lastRunTop)
    expect(layout.broken, `${context}: no short run may break inside itself`).toEqual([])
    expect(layout.hyphenEnds, `${context}: no drawn line may end on a hyphen`).toEqual([])
  })
}
