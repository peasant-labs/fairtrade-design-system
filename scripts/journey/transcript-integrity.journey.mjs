import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { loadFixturePair, loadStrictYaml, ROOT } from '../mounted-parts.mjs'
import { integrityFlagged } from '../../src/mockups/inuse/integrity-fixture.js'
import { INTEGRITY_COPY } from '../../src/ui/transcript/integrity.js'

/* The integrity badge and the flagged-turn marks on the built in-use demo, on a desktop and a
   390px touch screen, in both themes (the Playwright project name is the theme).
   The badge sits on the title's line one --sp-4 after its text (desktop) or one --sp-4 under the
   title (phone), never in the header's actions row: the host's actions hold the x they have on
   the same session with no flag. Named page mutations prove the placement gate fails for the
   intended reason.
   Cases: scripts/testdata/transcript-integrity-journey.yaml (+ .manifest.yaml).
   INTEGRITY_CAPTURE_DIR, when set, also writes <dir>/<name>-<theme>.png of the mounted #inuse
   region (panel open in the header cases). Every string is read from INTEGRITY_COPY. Leave it unset in CI. */
const FIXTURE = 'scripts/testdata/transcript-integrity-journey.yaml'
const MANIFEST = 'scripts/testdata/transcript-integrity-journey.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames', pageMutations: 'requiredPageMutationNames' })
const KINDS = ['header-desktop', 'classic-turns', 'header-phone', 'folded-mark', 'axe-panel']
const requiredKinds = loadStrictYaml(MANIFEST).requiredCaseKinds ?? {}
for (const row of fixture.cases) {
  if (requiredKinds[row.name] !== row.kind) throw new Error(`${row.name}: must run kind ${JSON.stringify(requiredKinds[row.name])}, received ${JSON.stringify(row.kind)}`)
  if (!KINDS.includes(row.kind)) throw new Error(`${row.name}: unknown kind ${JSON.stringify(row.kind)}`)
}
const HEADER_KINDS = ['header-desktop', 'header-phone']
for (const mutation of fixture.pageMutations) {
  const target = fixture.cases.find((row) => row.name === mutation.case)
  if (!target || !HEADER_KINDS.includes(target.kind)) throw new Error(`${FIXTURE}: page mutation ${JSON.stringify(mutation.name)} must name a header case`)
  for (const key of ['move', 'into', 'expect']) if (typeof mutation[key] !== 'string' || mutation[key] === '') throw new Error(`${FIXTURE}: page mutation ${JSON.stringify(mutation.name)} needs ${key}`)
}
const FLAGGED_COUNT = integrityFlagged.flagged_turns.length

/* the newest source the build reads: a dist older than this is not this branch's build */
const newestSource = (() => {
  let newest = statSync(`${ROOT}/src/index.css`).mtimeMs
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(`${dir}/${entry.name}`)
      else if (/\.(jsx?|css)$/.test(entry.name) && !/\.stories\./.test(entry.name)) newest = Math.max(newest, statSync(`${dir}/${entry.name}`).mtimeMs)
    }
  }
  walk(`${ROOT}/src/ui/transcript`)
  walk(`${ROOT}/src/mockups/inuse`)
  return newest
})()
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`
const captureDir = process.env.INTEGRITY_CAPTURE_DIR
const GUTTER = 16
const TOLERANCE = 0.5

const newPage = async (browser, row, theme, query) => {
  const ctx = await browser.newContext({
    viewport: row.viewport,
    colorScheme: theme,
    reducedMotion: 'reduce',
    ...(row.touch ? { hasTouch: true, isMobile: true } : {}),
  })
  const page = await ctx.newPage()
  const servedScripts = []
  page.on('response', (response) => { if (/\.js(\?|$)/.test(response.url()) && response.url().startsWith(origin)) servedScripts.push(response) })
  await page.goto(`${origin}/?fb=off&transcript=${query}&theme=${theme}#inuse`)
  await page.locator('#inuse').scrollIntoViewIfNeeded()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('#inuse .txn-title')).toBeVisible()
  return { ctx, page, servedScripts }
}

/* Where the title, the badge and the host's actions sit. The host's "not published" status and its
   "publish" button are found by their words, so the measure holds for any host markup. */
function measurePlacement() {
  const plain = (r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height })
  const box = (el) => (el ? plain(el.getBoundingClientRect()) : null)
  const root = getComputedStyle(document.documentElement)
  const sp4 = parseFloat(root.getPropertyValue('--sp-4')) * (root.getPropertyValue('--sp-4').trim().endsWith('rem') ? parseFloat(root.fontSize) : 1)
  const title = document.querySelector('#inuse .txn-title')
  const range = document.createRange()
  range.selectNodeContents(title)
  const lines = [...range.getClientRects()].filter((r) => r.width > 0)
  const badge = document.querySelector('#inuse .txn-integrity > button.txn-integrity-badge')
  const actions = document.querySelector('#inuse .txn-header-top .txn-actions')
  const leaf = (words) => [...actions.querySelectorAll('*')].find((el) => el.textContent.trim() === words && ![...el.children].some((child) => child.textContent.trim() === words))
  return {
    sp4,
    title: box(title),
    lines: lines.map(plain),
    badge: box(badge),
    badgeInActions: !!badge?.closest('.txn-actions'),
    status: box(leaf('not published')),
    publish: box([...actions.querySelectorAll('button')].find((el) => el.textContent.trim() === 'publish')),
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth,
  }
}

/* The placement rule: every failure is one line, so a page mutation can name the one it expects. */
function placementFailures(context, row, m, baseline) {
  const failures = []
  const near = (a, b) => Math.abs(a - b) <= TOLERANCE
  if (!m.badge) return [`${context}: the badge must render`]
  if (m.badgeInActions) failures.push(`${context}: the badge must not sit in the header's actions row`)
  const last = m.lines.at(-1)
  if (row.kind === 'header-desktop') {
    if (m.lines.length !== 1) failures.push(`${context}: the fixture title must fit one line, received ${m.lines.length}`)
    const mid = (m.badge.top + m.badge.bottom) / 2
    if (!last || mid < last.top || mid > last.bottom) failures.push(`${context}: the badge must sit on the title's line ${JSON.stringify({ badge: m.badge, line: last })}`)
    if (!last || !near(m.badge.left - last.right, m.sp4)) failures.push(`${context}: the badge must start one --sp-4 (${m.sp4}px) after the title's text, received ${last ? m.badge.left - last.right : 'no line'}`)
  } else {
    if (!near(m.badge.left, m.title.left)) failures.push(`${context}: the badge must start at the title's left edge, received ${m.badge.left} against ${m.title.left}`)
    if (!near(m.badge.top - m.title.bottom, m.sp4)) failures.push(`${context}: the badge must sit one --sp-4 (${m.sp4}px) under the title, received ${m.badge.top - m.title.bottom}`)
  }
  for (const [label, key] of [['not published', 'status'], ['publish', 'publish']]) {
    if (!m[key] || !baseline[key]) failures.push(`${context}: "${label}" must render with and without the flag`)
    else if (!near(m[key].left, baseline[key].left)) failures.push(`${context}: "${label}" must keep its x with a flag, received ${m[key].left} against ${baseline[key].left} with no flag`)
  }
  if (m.scrollWidth > m.innerWidth) failures.push(`${context}: the page must not scroll sideways, scrollWidth ${m.scrollWidth} over ${m.innerWidth}`)
  return failures
}

/* the host's actions on the same session with no flag: the x the flagged header must keep */
const baselineFor = async (browser, row, theme) => {
  const { ctx, page } = await newPage(browser, row, theme, row.baseline)
  await expect(page.locator('#inuse .txn-integrity')).toHaveCount(0)
  const m = await page.evaluate(measurePlacement)
  await ctx.close()
  return m
}

/* the open panel: inside the 16px gutters and the viewport, nothing clipped, no sideways scroll */
const panelFailures = async (page, context) => {
  const open = await page.evaluate(() => {
    const p = document.querySelector('#inuse .txn-integrity-panel')
    const r = p.getBoundingClientRect()
    const clipped = [...p.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > r.right + 0.5 || el.getBoundingClientRect().left < r.left - 0.5).length
    return {
      left: r.left, right: r.right, top: r.top, bottom: r.bottom, innerWidth, innerHeight,
      scrollWidth: document.documentElement.scrollWidth, panelScroll: p.scrollWidth - p.clientWidth, clipped,
      text: p.textContent, links: p.querySelectorAll('a').length,
    }
  })
  const failures = []
  if (open.left < GUTTER - TOLERANCE) failures.push(`${context}: the panel must keep the left gutter ${JSON.stringify(open)}`)
  if (open.right > open.innerWidth - GUTTER + TOLERANCE) failures.push(`${context}: the panel must keep the right gutter ${JSON.stringify(open)}`)
  if (open.top < -TOLERANCE || open.bottom > open.innerHeight + TOLERANCE) failures.push(`${context}: the panel must be fully inside the viewport ${JSON.stringify(open)}`)
  if (open.scrollWidth > open.innerWidth) failures.push(`${context}: the open panel must add no horizontal scroll`)
  if (open.panelScroll > 0) failures.push(`${context}: the panel's text must not scroll sideways`)
  if (open.clipped !== 0) failures.push(`${context}: nothing inside the panel may overflow its box`)
  if (!open.text.includes(INTEGRITY_COPY.panelBody)) failures.push(`${context}: the panel must carry its explanation`)
  if (!open.text.includes(INTEGRITY_COPY.panelOtherTools)) failures.push(`${context}: the panel must carry the other-tools line`)
  if (open.links !== 0) failures.push(`${context}: the panel must carry no link`)
  return failures
}

for (const row of fixture.cases) {
  test(`transcript integrity ${row.name}`, async ({ browser }, info) => {
    const theme = info.project.name
    const context = `${row.name} (${theme})`
    const baseline = HEADER_KINDS.includes(row.kind) ? await baselineFor(browser, row, theme) : null
    const { ctx, page, servedScripts } = await newPage(browser, row, theme, row.query)

    /* provenance: the served stylesheet is the build that carries the badge, not a stale dist */
    const served = await page.evaluate(async () => {
      const hrefs = [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href)
      const texts = await Promise.all(hrefs.map((href) => fetch(href).then((response) => response.text())))
      return texts.some((text) => text.includes('txn-integrity-badge') && text.includes('txn-title-row'))
    })
    expect(served, `${context}: the served stylesheet must carry the integrity badge and title row rules`).toBe(true)

    /* provenance of the scripts: every served bundle is byte-identical to this worktree's dist, and
       that dist is not older than the sources it was built from */
    expect(servedScripts.length, `${context}: the page loaded no script`).toBeGreaterThan(0)
    for (const response of servedScripts) {
      const file = `${ROOT}/dist${new URL(response.url()).pathname}`
      const body = await response.body()
      expect(body.equals(readFileSync(file)), `${context}: ${response.url()} is not this worktree's dist build`).toBe(true)
    }
    const distNewest = Math.max(...readdirSync(`${ROOT}/dist/assets`).map((name) => statSync(`${ROOT}/dist/assets/${name}`).mtimeMs))
    expect(distNewest, `${context}: dist is older than the sources, so rebuild before the journey`).toBeGreaterThanOrEqual(newestSource)

    /* the badge is the one control: a button named by the help question that opens the panel */
    const badge = page.locator('#inuse .txn-integrity > button.txn-integrity-badge')
    const panel = page.locator('#inuse .txn-integrity-panel')
    const press = () => (row.touch ? badge.tap() : badge.click())
    const capture = async (suffix = '') => {
      if (!captureDir) return
      mkdirSync(captureDir, { recursive: true })
      await page.locator('#inuse').screenshot({ path: `${captureDir}/${row.name}${suffix}-${theme}.png` })
    }
    const horizontalFit = () => page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }))

    if (HEADER_KINDS.includes(row.kind)) {
      await expect(badge).toBeVisible()
      await expect(page.getByRole('button', { name: INTEGRITY_COPY.helpName })).toHaveCount(1)
      const placement = placementFailures(context, row, await page.evaluate(measurePlacement), baseline)
      expect(placement, placement.join('\n')).toEqual([])

      const m = await page.evaluate(() => {
        const b = document.querySelector('#inuse .txn-integrity > button.txn-integrity-badge')
        const probe = document.createElement('i')
        probe.style.color = 'var(--warning)'
        document.body.append(probe)
        const warning = getComputedStyle(probe).color
        probe.remove()
        const l = b.querySelector('.txn-integrity-label')
        const r = b.getBoundingClientRect()
        return {
          border: getComputedStyle(b).borderTopColor,
          warning,
          icons: b.querySelectorAll('svg').length,
          text: b.textContent.trim(),
          name: b.getAttribute('aria-label'),
          buttons: b.closest('.txn-integrity').querySelectorAll('button').length,
          label: l ? { visible: l.getBoundingClientRect().width > 0, clipped: l.scrollWidth - l.clientWidth } : null,
          inHeader: !!b.closest('.txn-header'),
          size: { w: r.width, h: r.height },
          coarse: matchMedia('(pointer: coarse)').matches,
        }
      })
      expect(m.inHeader, `${context}: the badge belongs in the header`).toBe(true)
      expect(m.border, `${context}: the badge border is the warning color ${JSON.stringify(m)}`).toBe(m.warning)
      expect(m.icons, `${context}: the badge carries the warning glyph and the help glyph`).toBe(2)
      expect(m.text, `${context}: the badge names the flag`).toBe(INTEGRITY_COPY.badgeLabel)
      expect(m.name, `${context}: the badge is named by the help question`).toBe(INTEGRITY_COPY.helpName)
      expect(m.buttons, `${context}: the badge is the one control`).toBe(1)
      /* the badge keeps its words at every width */
      expect(m.label?.visible && m.label.clipped <= 0, `${context}: the badge shows its whole label ${JSON.stringify(m.label)}`).toBe(true)
      expect(m.coarse, `${context}: the context's pointer matches the case`).toBe(!!row.touch)
      if (row.touch) {
        expect(m.size.w, `${context}: the badge is at least 44px wide on a coarse pointer`).toBeGreaterThanOrEqual(44)
        expect(m.size.h, `${context}: the badge is at least 44px tall on a coarse pointer`).toBeGreaterThanOrEqual(44)
      }

      if (row.kind === 'header-desktop') {
        /* ledger: the flagged turns (the prose turn and the folded tool-only turn) each draw one outline */
        const outlines = await page.evaluate(() => {
          const dashed = [...document.querySelectorAll('#inuse *')].filter((el) => getComputedStyle(el).outlineStyle === 'dashed')
          return { count: dashed.length, outlined: dashed.map((el) => el.className) }
        })
        expect(outlines.count, `${context}: one dashed outline per flagged turn: the prose turn's card and the folded tool-only turn's row ${JSON.stringify(outlines)}`).toBe(FLAGGED_COUNT)
      }

      await expect(panel).toBeHidden()
      await press()
      await expect(panel).toBeVisible()
      await expect(badge).toHaveAttribute('aria-expanded', 'true')
      const opened = await panelFailures(page, context)
      expect(opened, opened.join('\n')).toEqual([])
      await capture()
      await press()
      await expect(panel).toBeHidden()
      await expect(badge).toHaveAttribute('aria-expanded', 'false')
    }

    if (row.kind === 'classic-turns') {
      const marks = page.locator('#inuse .txn-integrity-mark')
      await expect(marks).toHaveCount(FLAGGED_COUNT)
      for (const mark of await marks.all()) await expect(mark).toBeVisible()
      const cards = await page.evaluate(() =>
        [...document.querySelectorAll('#inuse .txn-turnwrap.is-flagged')].map((wrap) => {
          const card = wrap.querySelector(':scope > .txn-turn')
          return { style: getComputedStyle(card).outlineStyle, width: getComputedStyle(card).outlineWidth }
        }))
      expect(cards.length, `${context}: one flagged card per flagged turn`).toBe(FLAGGED_COUNT)
      for (const card of cards) expect(card.style, `${context}: a flagged card outlines dashed ${JSON.stringify(cards)}`).toBe('dashed')
      /* one outline per flagged turn: no element on the mounted page other than the two cards draws one */
      const dashed = await page.evaluate(() => [...document.querySelectorAll('#inuse *')].filter((el) => getComputedStyle(el).outlineStyle === 'dashed').length)
      expect(dashed, `${context}: exactly one dashed outline per flagged turn`).toBe(FLAGGED_COUNT)
      await capture()
    }

    if (row.kind === 'folded-mark') {
      const head = page.locator('#inuse .txn-modelactions-head').filter({ has: page.locator('.txn-integrity-mark') }).first()
      await expect(head).toBeVisible()
      /* the group opens by default; the mark must also show once the reader folds it */
      if ((await head.getAttribute('aria-expanded')) === 'true') await head.tap()
      await expect(head).toHaveAttribute('aria-expanded', 'false')
      const mark = head.locator('.txn-integrity-mark')
      await expect(mark).toBeVisible()
      await expect(mark).toHaveText(INTEGRITY_COPY.groupMark)
      const fit = await horizontalFit()
      expect(fit.scrollWidth, `${context}: the folded mark adds no horizontal scroll`).toBeLessThanOrEqual(fit.innerWidth)
      await capture()
    }

    if (row.kind === 'axe-panel') {
      await badge.tap()
      await expect(panel).toBeVisible()
      const results = await new AxeBuilder({ page }).include('#inuse .txn-header').analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), `${context}: axe on the open panel`).toEqual([])
      await capture()
    }

    await ctx.close()
  })
}

/* each page mutation moves the badge in the built page and must make the placement gate report its line */
for (const mutation of fixture.pageMutations) {
  test(`transcript integrity mutation: ${mutation.name}`, async ({ browser }, info) => {
    const theme = info.project.name
    const row = fixture.cases.find((candidate) => candidate.name === mutation.case)
    const context = `${row.name} (${theme})`
    const baseline = await baselineFor(browser, row, theme)
    const { ctx, page } = await newPage(browser, row, theme, row.query)
    await expect(page.locator('#inuse .txn-integrity-badge')).toBeVisible()
    const moved = await page.evaluate(({ move, into }) => {
      const node = document.querySelector(move)
      const host = document.querySelector(into)
      if (!node || !host) return false
      host.append(node)
      return true
    }, mutation)
    expect(moved, `${mutation.name}: the mutation must find ${mutation.move} and ${mutation.into}`).toBe(true)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const failures = placementFailures(context, row, await page.evaluate(measurePlacement), baseline)
    expect(failures.some((line) => line.includes(mutation.expect)), `${mutation.name}: the gate must report "${mutation.expect}", received:\n${failures.join('\n')}`).toBe(true)
    await ctx.close()
  })
}
