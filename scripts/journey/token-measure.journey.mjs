/* Journey: global token measurement probes on the built app, both themes.
 *
 * Reads scripts/testdata/token-measure.yaml (+ .manifest.yaml) and measures what the tokens
 * actually render in the served build:
 *   - real characters per line at --measure-prose and --measure-read, in the body face with
 *     the paragraph tracking and word spacing (the faces must have loaded first);
 *   - every length token as a computed px value (strokes, icons, targets, focus ring);
 *   - every mounted Lucide icon renders at least the --ic-sm floor;
 *   - the overlay shadow per theme (dark lifted, light flat).
 * Each named mutation overrides one token on the probe and must make the measure check report
 * its breach, so the probe is proven to fail for the intended reason.
 */
import { test as base, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'

const FIXTURE = 'scripts/testdata/token-measure.yaml'
const MANIFEST = 'scripts/testdata/token-measure.manifest.yaml'
const spec = loadStrictYaml(FIXTURE)
const manifest = loadStrictYaml(MANIFEST)
assertExactNames(spec.measures.map((m) => m.name), manifest.requiredMeasureNames, `${FIXTURE} measures`)
assertExactNames(spec.lengths.map((l) => l.name), manifest.requiredLengthNames, `${FIXTURE} lengths`)
assertExactNames(spec.mutations.map((m) => m.name), manifest.requiredMutationNames, `${FIXTURE} mutations`)
assertExactNames(spec.iconFloorExempt.map((e) => e.name), manifest.requiredIconFloorExemptNames, `${FIXTURE} iconFloorExempt`)

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

/** The measure rows that break their limits, as diagnostics (empty when every limit holds). */
const measureBreaches = (results) =>
  results.flatMap(({ name, token, minChars, maxChars, chars }) => {
    const ok = chars <= maxChars && (minChars === undefined || chars >= minChars)
    return ok ? [] : [`${name} holds ${chars} characters a line at ${token}; the rule is ${minChars ?? 0} to ${maxChars}`]
  })

test.describe('global tokens', () => {
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
    const small = await page.evaluate(({ floor, exempt }) =>
      [...document.querySelectorAll('svg.lucide')]
        .filter((svg) => svg.getClientRects().length && !exempt.some((c) => svg.classList.contains(c)))
        .map((svg) => {
          const cs = getComputedStyle(svg)
          return { cls: svg.getAttribute('class'), parent: svg.parentElement?.className?.toString() ?? '', width: parseFloat(cs.width), height: parseFloat(cs.height) }
        })
        .filter((r) => r.width < floor || r.height < floor)
        .map((r) => `${r.parent} > ${r.cls} ${r.width}x${r.height}`), { floor: spec.iconFloorPx, exempt: spec.iconFloorExempt.map((e) => e.iconClass) })
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
  })
})
