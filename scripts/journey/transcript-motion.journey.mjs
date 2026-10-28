/* Real layout interpolation cannot be observed in jsdom. These bounded product journeys pause
   the actual browser animation to measure its midpoint, then let it finish. They use the existing
   built-app server and runner; no copied component, process, temporary service or screenshot scan.
   Both directions and reduced motion protect the reading surface's disclosure behavior. */
import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'

const spec = loadStrictYaml('scripts/testdata/transcript-motion.yaml')
const manifest = loadStrictYaml('scripts/testdata/transcript-motion.manifest.yaml')
assertExactNames(spec.cases.map(row => row.name), manifest.requiredNames, 'transcript motion cases')
assertExactNames(spec.motion, manifest.requiredMotion, 'transcript motion preferences')
assertExactNames(spec.shellCases.map(row => row.name), manifest.requiredShellNames, 'transcript shell motion cases')
assertExactNames(spec.railCases.map(row => row.name), manifest.requiredRailNames, 'transcript sidebar motion cases')
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`

test('transcript demo follows the page theme without resetting the reader', async ({ page }, info) => {
  await page.goto(`${origin}/?app=transcript&transcript=ledger-actions&fb=off&theme=${info.project.name}#inuse`)
  const viewer = page.locator('.txn-app')
  await expect(viewer).toHaveAttribute('data-theme', info.project.name)
  await page.locator('.txn-thinking-toggle').first().click()
  await expect(page.locator('.txn-thinking-toggle').first()).toHaveAttribute('aria-expanded', 'true')
  const position = await page.locator('.txn-stream').evaluate(el => el.scrollTop)
  // Invoke the real page control, whose delegated click updates the root theme.
  await page.locator('.theme-btn').evaluate(button => button.click())
  const next = info.project.name === 'light' ? 'dark' : 'light'
  await expect(page.locator('html')).toHaveAttribute('data-theme', next)
  await expect(viewer).toHaveAttribute('data-theme', next)
  await expect(page.locator('.txn-thinking-toggle').first()).toHaveAttribute('aria-expanded', 'true')
  expect(await page.locator('.txn-stream').evaluate(el => el.scrollTop)).toBe(position)
})

/* CSS owns sidebar geometry; the shared disclosure owns painted presence. Check the first
   frame before seeking, then interrupt halfway to verify a reversal keeps painted width. */
for (const motion of spec.motion) for (const row of spec.railCases) {
  test(`transcript sidebar motion ${row.name} ${motion}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ reducedMotion: motion })
    await page.goto(`${origin}/?app=transcript&transcript=ledger-actions&fb=off&theme=${info.project.name}#inuse`)
    await expect(page.locator('.txn-app')).toHaveAttribute('data-theme', info.project.name)
    // Exit content must survive even without browser support for discrete display transitions.
    await page.addStyleTag({ content: '.txn-rail, .txn-rail-strip { transition-behavior: normal !important; }' })
    await page.evaluate(async () => {
      await document.fonts.ready
      document.getElementById('inuse').scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    const rail = page.locator(`.txn-rail-${row.side}`)
    const strip = page.locator(`.txn-rail-strip-${row.side}`)
    const grid = page.locator('.txn-body-grid')
    const width = () => grid.evaluate((el, side) => Number.parseFloat(getComputedStyle(el).gridTemplateColumns.split(' ')[side === 'left' ? 0 : 2]), row.side)
    const expanded = await width()
    for (const open of [false, true]) {
      const trigger = page.getByRole('button', { name: `${open ? 'expand' : 'collapse'} ${row.label}`, exact: true })
      await trigger.focus()
      const sample = await grid.evaluate(async (el, { side, open }) => {
        const pane = el.querySelector(`.txn-rail-${side}`)
        const collapsed = el.querySelector(`.txn-rail-strip-${side}`)
        const read = () => Number.parseFloat(getComputedStyle(el).gridTemplateColumns.split(' ')[side === 'left' ? 0 : 2])
        const before = read()
        const button = (open ? collapsed : pane).querySelector('button')
        button.click()
        await new Promise(requestAnimationFrame)
        const firstFrame = { hidden: pane.hidden, painted: getComputedStyle(pane).display !== 'none', opacity: Number(getComputedStyle(pane).opacity), bodyHeight: pane.querySelector('.txn-rail-body').getBoundingClientRect().height }
        const animation = el.getAnimations().find(a => a.transitionProperty === 'grid-template-columns')
        if (!animation) return { before, firstFrame, animations: 0 }
        const animations = el.getAnimations({ subtree: true })
        for (const a of animations) a.pause()
        const duration = animation.effect.getTiming().duration
        for (const a of animations) a.currentTime = 0
        const start = read()
        for (const a of animations) a.currentTime = duration / 2
        const middle = read()
        const opacity = Number(getComputedStyle(pane).opacity)
        const painted = getComputedStyle(pane).display !== 'none'
        const body = pane.querySelector('.txn-rail-body')
        const bodyWidth = body.getBoundingClientRect().width
        const clipWidth = pane.getBoundingClientRect().width
        for (const a of animations) a.currentTime = duration * .99
        const end = read()
        const easing = animation.effect.getTiming().easing
        const expectedEasing = getComputedStyle(el).getPropertyValue('--ease-in-out').trim()
        for (const a of animations) a.play()
        return { before, firstFrame, start, middle, end, opacity, painted, bodyWidth, clipWidth, easing, expectedEasing, animations: animations.length }
      }, { side: row.side, open })
      await info.attach(`${open ? 'expanding' : 'collapsing'}-sidebar`, { body: JSON.stringify(sample), contentType: 'application/json' })
      if (motion === 'no-preference') {
        if (!open) {
          expect(sample.firstFrame.hidden, 'closing contents must not be hidden in the first frame').toBe(false)
          expect(sample.firstFrame.painted, 'closing contents must stay painted in the first frame').toBe(true)
          expect(sample.firstFrame.opacity).toBeGreaterThan(0)
          expect(sample.firstFrame.bodyHeight).toBeGreaterThan(0)
        }
        expect(sample.animations, 'the sidebar must ease its occupied width').toBeGreaterThan(0)
        expect(Math.abs(sample.start - sample.before)).toBeLessThanOrEqual(1)
        expect(sample.middle).toBeGreaterThan(Math.min(sample.start, sample.end))
        expect(sample.middle).toBeLessThan(Math.max(sample.start, sample.end))
        expect(sample.opacity, 'rail content must not fade during furl or unfurl').toBe(1)
        expect(sample.bodyWidth, 'content keeps its expanded width while clipped').toBeGreaterThan(sample.clipWidth)
        expect(sample.painted, 'closing contents must remain painted for their exit').toBe(true)
        const curve = value => value.match(/-?\d*\.?\d+/g).map(Number)
        expect(curve(sample.easing)).toEqual(curve(sample.expectedEasing))
      } else {
        expect(sample.animations).toBe(0)
      }
      await expect(rail).toHaveAttribute('aria-hidden', String(!open))
      await expect(strip).toHaveAttribute('aria-hidden', String(open))
      await expect(open ? strip : rail).toHaveAttribute('inert', '')
      await expect(open ? strip : rail).toBeHidden()
      await expect(open ? rail : strip).toBeVisible()
      await expect(page.getByRole('button', { name: `${open ? 'collapse' : 'expand'} ${row.label}`, exact: true })).toBeFocused()
      await expect.poll(width).toBe(open ? expanded : row.collapsedWidth)
    }
    if (motion === 'no-preference') {
      const reversal = await grid.evaluate(async (el, side) => {
        const pane = el.querySelector(`.txn-rail-${side}`)
        const strip = el.querySelector(`.txn-rail-strip-${side}`)
        const read = () => Number.parseFloat(getComputedStyle(el).gridTemplateColumns.split(' ')[side === 'left' ? 0 : 2])
        pane.querySelector('button').click()
        await new Promise(requestAnimationFrame)
        const animation = el.getAnimations().find(a => a.transitionProperty === 'grid-template-columns')
        if (!animation) return null
        for (const a of el.getAnimations({ subtree: true })) { a.pause(); a.currentTime = animation.effect.getTiming().duration / 2 }
        const before = read()
        strip.querySelector('button').click()
        await new Promise(requestAnimationFrame)
        // Seek the new transition's start, not a frame that has already advanced.
        for (const a of el.getAnimations({ subtree: true })) { a.pause(); a.currentTime = 0 }
        const after = read()
        for (const a of el.getAnimations({ subtree: true })) a.play()
        return { before, after }
      }, row.side)
      expect(reversal, 'a rapid reopen must interrupt the closing transition').not.toBeNull()
      expect(Math.abs(reversal.after - reversal.before), 'reversal must start at the painted width').toBeLessThanOrEqual(1)
      await expect.poll(width).toBe(expanded)
    }
    // Zen must restore the exact mixed layout, not expand whichever rail was closed.
    await page.getByRole('button', { name: `collapse ${row.label}`, exact: true }).click()
    await expect.poll(width).toBe(row.collapsedWidth)
    await page.getByRole('button', { name: 'zen mode', exact: true }).click()
    await expect.poll(width).toBe(0)
    await expect(page.getByRole('button', { name: `expand ${row.label}`, exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'zen mode', exact: true }).click()
    await expect.poll(width).toBe(row.collapsedWidth)
    await expect(strip).toBeVisible()
    await expect(rail).toBeHidden()
    await expect(page.locator(`.txn-rail-${row.side === 'left' ? 'right' : 'left'}`)).toBeVisible()
    await page.locator('#inuse').screenshot({ path: info.outputPath(`sidebar-${row.side}-${info.project.name}.png`) })
  })
}

for (const motion of spec.motion) for (const row of spec.cases) {
  test(`transcript motion ${row.name} ${motion}`, async ({ page }, info) => {
    await page.setViewportSize({ width: row.width ?? 1440, height: row.height ?? 1000 })
    await page.emulateMedia({ reducedMotion: motion })
    // Pause newly created production animations immediately so worker contention cannot
    // let a short animation finish before the test samples it. The test resumes it below.
    await page.addInitScript(() => {
      const animate = Element.prototype.animate
      Element.prototype.animate = function (...args) {
        const animation = animate.apply(this, args)
        if (this.classList.contains('txn-disclosure')) animation.pause()
        return animation
      }
    })
    await page.goto(`${origin}/?app=transcript&transcript=ledger-actions&fb=off&theme=${info.project.name}#inuse`)
    await page.evaluate(async () => {
      await document.fonts.ready
      document.getElementById('inuse').scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    let trigger
    let body
    if (row.kind === 'header') {
      body = page.locator('.txn-header-details')
    } else {
      trigger = row.kind === 'list'
        ? page.locator('.txn-modelactions-head').first()
        : page.locator('.txn-modelactions .txn-tc-head').filter({ has: page.getByText(row.label, { exact: true }) }).first()
      body = trigger.locator('xpath=following-sibling::*[1]')
    }
    const change = async open => {
      if (row.kind === 'header') {
        await page.locator('.txn-stream').evaluate((el, open) => {
          el.scrollTop = open ? 0 : 120
          el.dispatchEvent(new Event('scroll'))
        }, open)
      } else {
        await trigger.evaluate(el => el.click())
      }
    }
    // Interrupt the actual shared height animation, not merely the rail's CSS width.
    await change(!row.initiallyOpen)
    if (motion === 'no-preference') {
      const midpoint = await body.evaluate(el => {
        const animation = el.getAnimations().find(a => a.effect.getKeyframes().some(frame => 'height' in frame))
        if (!animation) return null
        animation.pause()
        animation.currentTime = animation.effect.getTiming().duration / 2
        return { height: el.getBoundingClientRect().height, opacity: Number(getComputedStyle(el).opacity) }
      })
      expect(midpoint, 'the interrupted disclosure must have a live height animation').not.toBeNull()
      await change(row.initiallyOpen)
      const reversed = await body.evaluate(el => {
        const animation = el.getAnimations().find(a => a.effect.getKeyframes().some(frame => 'height' in frame))
        if (!animation) return null
        animation.pause(); animation.currentTime = 0
        const start = { height: el.getBoundingClientRect().height, opacity: Number(getComputedStyle(el).opacity) }
        animation.play()
        return start
      })
      expect(reversed).not.toBeNull()
      expect(Math.abs(reversed.height - midpoint.height), 'reversal starts at painted height').toBeLessThanOrEqual(1)
      expect(Math.abs(reversed.opacity - midpoint.opacity), 'reversal starts at painted opacity').toBeLessThanOrEqual(.01)
      await info.attach('interrupted-height', { body: JSON.stringify({ midpoint, reversed }), contentType: 'application/json' })
    } else await change(row.initiallyOpen)
    await expect(body).not.toHaveAttribute('data-animating', 'true')
    for (const open of [!row.initiallyOpen, row.initiallyOpen]) {
      await change(open)
      if (motion === 'no-preference') {
        const sample = await body.evaluate(async (el, closing) => {
          await new Promise(requestAnimationFrame)
          const animation = el.getAnimations().find(a => a.effect.getKeyframes().some(frame => 'height' in frame))
          if (!animation) return null
          animation.pause()
          const presence = () => {
            const focusables = [...el.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
            for (const node of focusables) node.focus({ preventScroll: true })
            return { hidden: el.hidden, ariaHidden: el.getAttribute('aria-hidden'), inert: el.inert, painted: getComputedStyle(el).display !== 'none', focusInside: el.contains(document.activeElement), focusables: focusables.length }
          }
          const firstFrame = closing ? presence() : null
          const duration = animation.effect.getTiming().duration
          animation.currentTime = 0
          const start = el.getBoundingClientRect().height
          animation.currentTime = duration / 2
          const middle = el.getBoundingClientRect().height
          const middleFrame = closing ? presence() : null
          animation.currentTime = duration * .99
          const end = el.getBoundingClientRect().height
          const easing = animation.effect.getTiming().easing
          const expectedEasing = getComputedStyle(el).getPropertyValue('--ease-in-out').trim()
          animation.play()
          // Observe the animation-to-React handoff frame by frame. Dropping the final
          // keyframe before the hidden commit flashes the body's natural height here.
          const finishHeights = []
          for (let frame = 0; frame < 8; frame++) {
            await new Promise(requestAnimationFrame)
            finishHeights.push(el.getBoundingClientRect().height)
          }
          return { start, middle, end, easing, expectedEasing, finishHeights, firstFrame, middleFrame }
        }, !open)
        expect(sample, `${row.name} must animate its height while ${open ? 'opening' : 'closing'}`).not.toBeNull()
        await info.attach(`${open ? 'opening' : 'closing'}-heights`, { body: JSON.stringify(sample), contentType: 'application/json' })
        expect(sample.middle).toBeGreaterThan(Math.min(sample.start, sample.end))
        expect(sample.middle).toBeLessThan(Math.max(sample.start, sample.end))
        const curve = value => value.match(/-?\d*\.?\d+/g).map(Number)
        expect(curve(sample.easing)).toEqual(curve(sample.expectedEasing))
        if (!open) for (const frame of [sample.firstFrame, sample.middleFrame]) {
          expect(frame.hidden).toBe(false)
          expect(frame.painted).toBe(true)
          expect(frame.ariaHidden).toBe('true')
          expect(frame.inert).toBe(true)
          expect(frame.focusInside, 'painted exit descendants cannot receive focus').toBe(false)
        }
        if (open) expect(Math.min(...sample.finishHeights)).toBeGreaterThanOrEqual(sample.end - 1)
        else expect(Math.max(...sample.finishHeights)).toBeLessThanOrEqual(sample.end + 1)
      } else {
        expect(await body.evaluate(el => el.getAnimations().length)).toBe(0)
      }
      await expect(body).toHaveAttribute('aria-hidden', String(!open))
      if (open) {
        await expect(body).not.toHaveAttribute('data-animating', 'true')
        await expect(body).not.toHaveAttribute('hidden', '')
      } else {
        await expect(body).toHaveAttribute('hidden', '')
        await expect(body).toHaveAttribute('inert', '')
      }
    }
  })
}

/* The title alone can shrink correctly while a separate timeline spacer moves the stream
   down first. Observe the unpaused production shell, including the first insertion frame and
   several frames after all animations finish. No new server or synthetic layout is needed. */
for (const motion of spec.motion) for (const row of spec.shellCases) {
  test(`transcript shell motion ${row.name} ${motion}`, async ({ page }, info) => {
    await page.setViewportSize({ width: row.width, height: row.height })
    await page.emulateMedia({ reducedMotion: motion })
    await page.goto(`${origin}/?app=transcript&transcript=ledger-actions&fb=off&theme=${info.project.name}#inuse`)
    await page.evaluate(async () => {
      await document.fonts.ready
      document.getElementById('inuse').scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    for (const closing of [true, false]) {
      const samples = await page.locator('.txn-app').evaluate(async (app, closing) => {
        const stream = app.querySelector('.txn-stream')
        const header = app.querySelector('.txn-header')
        const bar = app.querySelector('.txn-trace-head')
        const timeline = app.querySelector('.txn-sticky-disclosure')
        const measure = () => {
          const top = app.getBoundingClientRect().top
          return {
            header: header.getBoundingClientRect().height,
            bar: bar.getBoundingClientRect().top - top,
            stream: stream.getBoundingClientRect().top - top,
            timeline: timeline.getBoundingClientRect().height,
            scroll: stream.scrollTop,
            condensed: app.classList.contains('txn-app-condensed'),
            pinned: !!app.querySelector('.txn-trace-pinned'),
          }
        }
        const values = [measure()]
        stream.scrollTop = closing ? 120 : 0
        stream.dispatchEvent(new Event('scroll'))
        const start = performance.now()
        let settled = 0
        do {
          await new Promise(requestAnimationFrame)
          const value = measure()
          values.push(value)
          const moving = app.getAnimations({ subtree: true }).some(a => a.playState === 'running')
          settled = value.condensed === closing && value.pinned === closing && !moving ? settled + 1 : 0
        } while (settled < 5 && performance.now() - start < 1500)
        return { values, settled }
      }, closing)
      await info.attach(`${closing ? 'condensing' : 'restoring'}-shell-geometry`, {
        body: JSON.stringify(samples), contentType: 'application/json',
      })
      expect(samples.settled, 'the whole header transition must settle').toBe(5)
      const first = samples.values[0]
      const last = samples.values.at(-1)
      expect(last.condensed).toBe(closing)
      expect(last.pinned).toBe(closing)
      expect(last.scroll).toBe(closing ? 120 : 0)
      expect(closing ? first.stream - last.stream : last.stream - first.stream).toBeGreaterThan(1)
      for (const key of ['header', 'bar', 'stream', 'timeline']) {
        const direction = Math.sign(last[key] - first[key])
        for (let i = 1; i < samples.values.length; i++) {
          const value = samples.values[i][key]
          expect(value, `${key} must not overshoot its start/end geometry`).toBeGreaterThanOrEqual(Math.min(first[key], last[key]) - 1)
          expect(value, `${key} must not overshoot its start/end geometry`).toBeLessThanOrEqual(Math.max(first[key], last[key]) + 1)
          expect((value - samples.values[i - 1][key]) * direction, `${key} must not reverse direction`).toBeGreaterThanOrEqual(-1)
        }
      }
    }
    await page.locator('.txn-stream').evaluate(el => { el.scrollTop = 120; el.dispatchEvent(new Event('scroll')) })
    await expect(page.locator('.txn-sticky-disclosure')).not.toHaveAttribute('data-animating', 'true')
    await expect(page.locator('.txn-header-details')).toHaveAttribute('hidden', '')
    await expect(page.locator('.txn-sticky .txn-minimap')).toBeVisible()
    await page.locator('.txn-app').screenshot({ path: info.outputPath(`transcript-shell-${info.project.name}.png`) })
  })
}
