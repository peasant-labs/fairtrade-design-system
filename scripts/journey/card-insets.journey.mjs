/* Journey: card insets on the built demo, both themes, desktop and phone.
 *
 * Reads scripts/testdata/card-insets.yaml (+ .manifest.yaml). For every card row on each settings
 * screen (a setting row, a group's summary), the row's visible content sits inside its padding:
 *   - the left inset (the row's left edge to its leftmost visible child) equals the right inset
 *     (its rightmost visible child to its right edge) within a pixel, so a control never floats
 *     short of the right edge while the text hugs the left one;
 *   - both insets are at least the viewport's padding floor, so nothing touches a border;
 *   - no visible element inside the row crosses the row's content box.
 * Content is what a reader sees: controls, icons and images, and every element with text of its
 * own; an empty reserved slot is not content. The equal-inset check holds where a control sits
 * beside its label (and on a group's summary); a stacked control (a phone row) and a lone help line
 * are held to the floor and the content box only. Visually hidden elements (1px live regions) are skipped.
 */
import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'

const FIXTURE = 'scripts/testdata/card-insets.yaml'
const MANIFEST = 'scripts/testdata/card-insets.manifest.yaml'
const spec = loadStrictYaml(FIXTURE)
const manifest = loadStrictYaml(MANIFEST)
assertExactNames(spec.screens.map((s) => s.name), manifest.requiredScreenNames, `${FIXTURE} screens`)
assertExactNames(spec.viewports.map((v) => v.name), manifest.requiredViewportNames, `${FIXTURE} viewports`)
assertExactNames(spec.mutations.map((m) => m.name), manifest.requiredMutationNames, `${FIXTURE} mutations`)

const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`

/** In the page: each visible card row's insets and any element that crosses its content box. */
const measureRows = (selector) => {
  const visible = (el) => {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (style.clipPath === 'inset(50%)' || style.position === 'absolute') return false
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1
  }
  return [...document.querySelectorAll(selector)].filter(visible).map((row, index) => {
    const box = row.getBoundingClientRect()
    const style = getComputedStyle(row)
    const border = { left: parseFloat(style.borderLeftWidth), right: parseFloat(style.borderRightWidth) }
    const inner = { left: box.left + border.left, right: box.right - border.right }
    const pad = { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) }
    // what a reader sees: controls, icons and images, and every leaf that carries text. an empty
    // reserved slot (an idle save status) is not content, so a control pushed short of the edge by
    // one still measures short.
    const ownText = (el) => [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())
    const boxed = (el) => ['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA', 'IMG', 'svg'].includes(el.tagName)
    const content = [...row.querySelectorAll('*')].filter(visible).filter((el) => boxed(el) || ownText(el))
    // text is measured where its glyphs are (a range over the element's own text), so a word left
    // short of a reserved width still measures short; controls and icons by their box
    const extent = (el) => {
      if (boxed(el) || !ownText(el)) return el.getBoundingClientRect()
      const boxes = [...el.childNodes].filter((node) => node.nodeType === 3 && node.textContent.trim()).map((node) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        return range.getBoundingClientRect()
      })
      return { left: Math.min(...boxes.map((b) => b.left)), right: Math.max(...boxes.map((b) => b.right)) }
    }
    const lefts = content.map((el) => extent(el).left)
    const rights = content.map((el) => extent(el).right)
    const control = row.querySelector('button, select, input, textarea, [role="switch"]')
    const first = content.find((el) => ownText(el))
    // stacked, a control starts at the left padding; beside its label it is pushed to the right
    const beside = !!control && !!first && control.getBoundingClientRect().left > first.getBoundingClientRect().left + 1
    const label = (row.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48)
    const crossing = [...row.querySelectorAll('*')].filter(visible).filter((el) => {
      const r = el.getBoundingClientRect()
      return r.left < inner.left + pad.left - 0.5 || r.right > inner.right - pad.right + 0.5
    }).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`)
    return {
      index,
      label,
      left: Math.round((Math.min(...lefts) - inner.left) * 10) / 10,
      right: Math.round((inner.right - Math.max(...rights)) * 10) / 10,
      // a control beside its label ends at the right padding, and a group's summary ends with its
      // count; a summary without a count and a lone help line end where their text ends
      spans: (row.matches('summary, .srow-summary') && !!row.querySelector('.srow-summary-count')) || beside,
      crossing,
    }
  })
}

/** The breaches in one screen's measurements. */
const failuresFor = (measured, screen, viewport) => {
  const failures = []
  for (const row of measured) {
    const where = `${screen.name} ${viewport.name} row ${row.index} (${row.label})`
    if (row.left < viewport.padFloor - 0.5) failures.push(`${where}: left inset ${row.left}px is under the ${viewport.padFloor}px floor`)
    if (row.right < viewport.padFloor - 0.5) failures.push(`${where}: right inset ${row.right}px is under the ${viewport.padFloor}px floor`)
    if (row.spans && Math.abs(row.left - row.right) > 1) failures.push(`${where}: left inset ${row.left}px differs from right inset ${row.right}px`)
    if (row.crossing.length) failures.push(`${where}: crosses the content box: ${row.crossing.join(', ')}`)
  }
  return failures
}

/** In the page: two frames, so a style change has been laid out before the next measure. */
const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

const open = async (page, screen, viewport, theme) => {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.goto(`${origin}/${screen.path}&fb=off&theme=${theme}#inuse`)
  await expect(page.locator(spec.rows).first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(settle)
}

for (const viewport of spec.viewports) {
  for (const screen of spec.screens) {
    test(`card insets ${screen.name} ${viewport.name}`, async ({ page }, info) => {
      await open(page, screen, viewport, info.project.name)
      const measured = await page.evaluate(measureRows, spec.rows)
      await info.attach(`${screen.name}-${viewport.name}-insets`, { body: JSON.stringify(measured, null, 2), contentType: 'application/json' })
      expect(measured.length, `${screen.name}: card rows must be measured`).toBeGreaterThan(0)
      const failures = failuresFor(measured, screen, viewport)
      expect(failures, failures.join('\n')).toEqual([])
    })
  }
}

/* Each named mutation breaks the card CSS in the page and must make the probe report the breach
   it names, so the gate is proven to fail for the intended reason. */
test('card insets mutations', async ({ page }, info) => {
  const screen = spec.screens.find((row) => row.name === spec.mutationScreen)
  const viewport = spec.viewports.find((row) => row.name === spec.mutationViewport)
  await open(page, screen, viewport, info.project.name)
  for (const mutation of spec.mutations) {
    const style = await page.addStyleTag({ content: mutation.css })
    await page.evaluate(settle)
    const measured = await page.evaluate(measureRows, spec.rows)
    const failures = failuresFor(measured, screen, viewport)
    await style.evaluate((node) => node.remove())
    await page.evaluate(settle)
    expect(measured.length, `${mutation.name}: card rows must be measured`).toBeGreaterThan(0)
    expect(failures.some((line) => line.includes(mutation.expect)), `${mutation.name}: the probe must report "${mutation.expect}", received:\n${failures.slice(0, 5).join('\n')}`).toBe(true)
  }
})
