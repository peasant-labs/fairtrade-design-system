/* Journey: global token measurement probes on the built app, both themes.
 *
 * Reads scripts/testdata/token-measure.yaml (+ .manifest.yaml) and measures what the tokens
 * actually render in the served build:
 *   - real characters per line at --measure-prose and --measure-read, in the body face with
 *     the paragraph tracking and word spacing (the faces must have loaded first);
 *   - every length token as a computed px value (strokes, icons, targets, focus ring);
 *   - every mounted Lucide icon renders at least the --ic-sm floor, and an icon drawn inside a
 *     marker (the commit session star) renders at its exact size, wholly inside the marker;
 *   - the overlay shadow per theme (dark lifted, light flat).
 * Each named mutation overrides one token on the probe and must make the measure check report
 * its breach, so the probe is proven to fail for the intended reason.
 */
import { test as base, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const FIXTURE = 'scripts/testdata/token-measure.yaml'
const MANIFEST = 'scripts/testdata/token-measure.manifest.yaml'
const spec = loadStrictYaml(FIXTURE)
const manifest = loadStrictYaml(MANIFEST)
assertExactNames(spec.measures.map((m) => m.name), manifest.requiredMeasureNames, `${FIXTURE} measures`)
assertExactNames(spec.lengths.map((l) => l.name), manifest.requiredLengthNames, `${FIXTURE} lengths`)
assertExactNames(spec.mutations.map((m) => m.name), manifest.requiredMutationNames, `${FIXTURE} mutations`)
assertExactNames(spec.fittedIcons.map((e) => e.name), manifest.requiredFittedIconNames, `${FIXTURE} fittedIcons`)
assertExactNames(spec.fitMutations.map((m) => m.name), manifest.requiredFitMutationNames, `${FIXTURE} fitMutations`)
/** @type {{name: string, anchor: string, selector: string, scale: number, mutation: string}[]} */
const motionRows = spec.motionRows
assertExactNames(motionRows.map(row => row.name), manifest.requiredMotionNames, `${FIXTURE} motion rows`)
assertExactNames(spec.motionModes.map(row => row.name), manifest.requiredMotionModeNames, `${FIXTURE} motion modes`)
assertExactNames([...motionRows.map(row => row.mutation), spec.switchProbe.mutation], manifest.requiredMotionMutationNames, `${FIXTURE} motion mutations`)
// every fit mutation must target a fitted-icon row; otherwise the per-page loop below would skip it
for (const m of spec.fitMutations) {
  if (!spec.fittedIcons.some((r) => r.name === m.icon)) {
    throw new Error(`${FIXTURE} fitMutations: ${m.name} names no fitted icon row (${m.icon}); every fit mutation must target a fittedIcons entry, so rename its icon to an existing row or remove the mutation (and its manifest name)`)
  }
}

const test = base.extend({
  theme: async ({}, use, testInfo) => {
    await use(testInfo.project.name)
  },
})

const URL = `http://localhost:${process.env.JOURNEY_APP_PORT || '5180'}/?fb=off`

/** In the page: the widest line, in characters, of each sample text at a measure token. */
const measureInPage = ({ token, texts, override }) => {
  let widest = 0
  for (const text of texts) {
    const p = document.createElement('p')
    p.style.cssText = `font-family: var(--font-body); font-size: var(--fs-body); line-height: var(--lh-body); max-inline-size: var(${token}); margin: 0`
    if (override) p.style.setProperty(override.token, override.value)
    p.textContent = text
    document.body.appendChild(p)
    const node = p.firstChild
    const range = document.createRange()
    const perLine = new Map()
    for (let i = 0; i < node.length; i++) {
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const rect = range.getClientRects()[0]
      if (!rect) continue
      const top = Math.round(rect.top)
      perLine.set(top, (perLine.get(top) ?? 0) + 1)
    }
    p.remove()
    widest = Math.max(widest, ...perLine.values())
  }
  return widest
}

/** In the page: each fitted icon's mounted size and its margin inside its marker.
 *  markerSizePx (mutations only) resizes the markers inline first and restores them after. */
const fitInPage = ({ rows, markerSizePx }) =>
  rows.map(({ name, icon, marker, px }) => {
    const icons = [...document.querySelectorAll(icon)].filter((el) => el.getClientRects().length)
    const problems = icons.length ? [] : [`${name}: none mounted`]
    const sizes = new Set()
    let worstMarginPx = Infinity
    for (const el of icons) {
      // the graph paints the star over the marker as its next sibling; the legend nests it inside
      const box = el.previousElementSibling?.matches(marker) ? el.previousElementSibling : el.parentElement?.closest(marker)
      if (!box) { problems.push(`${name}: no ${marker} right before or around the icon`); continue }
      const saved = box.style.cssText
      // transition off first: the reduced-motion backstop gives every property a .01ms transition,
      // so a resize read in the same task would still report the old size
      if (markerSizePx) box.style.cssText += `; transition: none !important; width: ${markerSizePx}px; height: ${markerSizePx}px`
      const cs = getComputedStyle(el)
      sizes.add(`${parseFloat(cs.width)}x${parseFloat(cs.height)}`)
      if (parseFloat(cs.width) !== px || parseFloat(cs.height) !== px) problems.push(`${name}: renders ${cs.width} x ${cs.height}, not ${px}px`)
      const i = el.getBoundingClientRect()
      const m = box.getBoundingClientRect()
      const margin = Math.min(i.left - m.left, m.right - i.right, i.top - m.top, m.bottom - i.bottom)
      worstMarginPx = Math.min(worstMarginPx, Math.round(margin * 100) / 100)
      if (margin < 0) problems.push(`${name} overflows its marker by ${-margin}px`)
      box.style.cssText = saved
    }
    return { name, mounted: icons.length, sizes: [...sizes], worstMarginPx, problems }
  })

/** The measure rows that break their limits, as diagnostics (empty when every limit holds). */
const measureBreaches = (results) =>
  results.flatMap(({ name, token, minChars, maxChars, chars }) => {
    const ok = chars <= maxChars && (minChars === undefined || chars >= minChars)
    return ok ? [] : [`${name} holds ${chars} characters a line at ${token}; the rule is ${minChars ?? 0} to ${maxChars}`]
  })

test.describe('global tokens', () => {
  for (const mode of spec.motionModes) for (const width of spec.motionWidths) {
    test(`layout-free motion ${mode.name} ${width}`, async ({ page, theme }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: mode.value })
      await page.goto(`${URL}&theme=${theme}#ds-governance`, { waitUntil: 'networkidle' })
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      // Bind proof to this checkout's actual served bytes, never a stale preview.
      const assets = await page.locator('script[src], link[rel="stylesheet"]').evaluateAll(elements =>
        elements.map(el => el.getAttribute('src') || el.getAttribute('href')).filter(path => path?.startsWith('/assets/')))
      expect(assets.length).toBeGreaterThan(0)
      const provenance = []
      for (const path of assets) {
        const expected = readFileSync(`dist${path}`)
        const response = await page.request.get(new URL(path, URL).href)
        expect(await response.body(), `served ${path}`).toEqual(expected)
        provenance.push({ path, sha256: createHash('sha256').update(expected).digest('hex') })
      }
      const observations = []
      for (const row of motionRows) {
        await page.locator(`#${row.anchor}`).scrollIntoViewIfNeeded()
        const fill = page.locator(row.selector).first()
        await fill.scrollIntoViewIfNeeded()
        await expect(fill).toBeVisible()
        await expect(page.locator(`#${row.anchor}`)).toHaveCSS('opacity', '1')
        const read = () => fill.evaluate(el => {
          const cs = getComputedStyle(el)
          return { property: cs.transitionProperty, durations: cs.transitionDuration.split(',').map(value => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000)), layoutWidth: el.clientWidth, trackWidth: el.parentElement.clientWidth, scale: new DOMMatrixReadOnly(cs.transform).a }
        })
        const observed = await read()
        expect(observed.layoutWidth).toBe(observed.trackWidth)
        expect(observed.scale).toBeCloseTo(row.scale, 2)
        const hasLayoutMotion = value => value.durations.some(duration => duration > 1) && value.property.split(',').some(property => property.trim() !== 'transform')
        expect(hasLayoutMotion(observed), row.name).toBe(false)
        if (mode.value === 'reduce') expect(Math.max(...observed.durations)).toBeLessThanOrEqual(1)
        else expect(observed.property).toBe('transform')
        // A planted width transition must fail the same computed-property check.
        await fill.evaluate(el => { el.style.transition = 'width 200ms linear'; el.style.setProperty('transition-duration', '200ms', 'important') })
        expect(hasLayoutMotion(await read()), row.mutation).toBe(true)
        await fill.evaluate(el => { el.style.removeProperty('transition'); el.style.removeProperty('transition-duration') })
        observations.push({ name: row.name, ...observed })
        await page.screenshot({ path: testInfo.outputPath(`${row.anchor}-${theme}-${mode.value}-${width}.png`) })
      }
      await page.locator('#states').scrollIntoViewIfNeeded()
      const toggle = page.locator(spec.switchProbe.selector).first()
      await toggle.scrollIntoViewIfNeeded()
      await expect(toggle).toBeVisible()
      await expect(page.locator('#states')).toHaveCSS('opacity', '1')
      const thumb = () => toggle.evaluate(el => ({ willChange: getComputedStyle(el, '::before').willChange, duration: getComputedStyle(el, '::before').transitionDuration }))
      expect((await thumb()).willChange).toBe('auto')
      // Scoped mutation of the actual mounted pseudo-element, removed before capture.
      const mutationStyle = await page.addStyleTag({ content: `${spec.switchProbe.selector}::before { will-change: transform !important }` })
      expect((await thumb()).willChange, spec.switchProbe.mutation).toBe('transform')
      await mutationStyle.evaluate(el => el.remove())
      const before = await toggle.getAttribute('aria-checked')
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true')
      if (mode.value === 'reduce') expect(parseFloat((await thumb()).duration)).toBeLessThanOrEqual(0.001)
      await page.screenshot({ path: testInfo.outputPath(`switch-${theme}-${mode.value}-${width}.png`) })
      await testInfo.attach('motion-provenance.json', { body: JSON.stringify({ theme, width, motion: mode.value, provenance, observations }), contentType: 'application/json' })
    })
  }

  test('measure what the tokens render', async ({ page, theme }) => {
    test.setTimeout(60_000)
    await page.goto(URL + (theme === 'light' ? '&theme=light' : ''), { waitUntil: 'networkidle' })
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready
      await document.fonts.load('16px "Atkinson Hyperlegible"')
      return { body: document.fonts.check('16px "Atkinson Hyperlegible"'), theme: document.documentElement.getAttribute('data-theme') || 'dark' }
    })
    expect(loaded.body, 'the body face must load before a measure is counted (a fallback face measures a different line)').toBe(true)
    expect(loaded.theme).toBe(theme)

    // measures: real characters per line
    const results = []
    for (const m of spec.measures) {
      const chars = await page.evaluate(measureInPage, { token: m.token, texts: spec.sampleTexts })
      results.push({ ...m, chars })
    }
    console.log(`measures [${theme}]: ${JSON.stringify(results.map(({ name, chars }) => ({ name, chars })))}`)
    expect(measureBreaches(results)).toEqual([])

    // mutations: one token widened on the probe; the measure check must report the breach
    for (const mut of spec.mutations) {
      const mutated = []
      for (const m of spec.measures) {
        const chars = await page.evaluate(measureInPage, { token: m.token, texts: spec.sampleTexts, override: { token: mut.token, value: mut.value } })
        mutated.push({ ...m, chars })
      }
      const breaches = measureBreaches(mutated)
      expect(breaches.some((b) => b.includes(mut.expectedDiagnostic)), `${mut.name}: ${JSON.stringify(breaches)}`).toBe(true)
    }

    // lengths: each token as a computed px value
    const lengths = await page.evaluate((rows) =>
      rows.map(({ name, token }) => {
        // a fresh probe per token: a length token read back through a margin (negative allowed)
        const probe = document.createElement('div')
        probe.style.cssText = `position: absolute; margin-left: var(${token})`
        document.body.appendChild(probe)
        const px = parseFloat(getComputedStyle(probe).marginLeft)
        probe.remove()
        return { name, px }
      }), spec.lengths)
    expect(lengths).toEqual(spec.lengths.map(({ name, px }) => ({ name, px })))

    // icons: every mounted Lucide icon renders at least the floor
    // the computed CSS size, not the client rect: a zoomed map canvas scales its icons with
    // the view, which is not the size the stylesheet gives them
    const small = await page.evaluate((floor) =>
      [...document.querySelectorAll('svg.lucide')]
        .filter((svg) => svg.getClientRects().length)
        .map((svg) => {
          const cs = getComputedStyle(svg)
          return { cls: svg.getAttribute('class'), parent: svg.parentElement?.className?.toString() ?? '', width: parseFloat(cs.width), height: parseFloat(cs.height) }
        })
        .filter((r) => r.width < floor || r.height < floor)
        .map((r) => `${r.parent} > ${r.cls} ${r.width}x${r.height}`), spec.iconFloorPx)
    expect(small, `icons below ${spec.iconFloorPx}px`).toEqual([])

    // overlay shadow: dark lifts overlays, light stays flat
    const shadow = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.boxShadow = 'var(--overlay-shadow)'
      document.body.appendChild(probe)
      const value = getComputedStyle(probe).boxShadow
      probe.remove()
      return value
    })
    if (spec.overlayShadow[theme] === 'none') expect(shadow).toBe('none')
    else expect(shadow).not.toBe('none')

    // fitted icons, last: exact size, wholly inside the marker. Rows are grouped by the page
    // they name (query); rows without one measure the page already open. A row whose icon does
    // not mount fails ("none mounted"), so a page that stops rendering it cannot pass.
    const groups = Map.groupBy(spec.fittedIcons, (r) => r.query ?? '')
    for (const [query, rows] of groups) {
      if (query) {
        await page.goto(`http://localhost:${process.env.JOURNEY_APP_PORT || '5180'}/?${query}${theme === 'light' ? '&theme=light' : ''}`, { waitUntil: 'networkidle' })
      }
      const fitted = await page.evaluate(fitInPage, { rows })
      console.log(`fitted icons [${theme}]: ${JSON.stringify(fitted.map(({ name, mounted, sizes, worstMarginPx }) => ({ name, mounted, sizes, worstMarginPx })))}`)
      expect(fitted.flatMap((r) => r.problems)).toEqual([])
      for (const mut of spec.fitMutations.filter((m) => rows.some((r) => r.name === m.icon))) {
        const row = rows.find((r) => r.name === mut.icon)
        const broken = await page.evaluate(fitInPage, { rows: [row], markerSizePx: mut.markerSizePx })
        const problems = broken.flatMap((r) => r.problems)
        expect(problems.some((p) => p.includes(mut.expectedDiagnostic)), `${mut.name}: ${JSON.stringify(problems)}`).toBe(true)
      }
    }
  })
})
