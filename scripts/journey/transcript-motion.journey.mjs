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
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`

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
    for (const open of [!row.initiallyOpen, row.initiallyOpen]) {
      if (row.kind === 'header') {
        await page.locator('.txn-stream').evaluate((el, open) => {
          el.scrollTop = open ? 0 : 120
          el.dispatchEvent(new Event('scroll'))
        }, open)
      } else {
        await trigger.evaluate(el => el.click())
      }
      if (motion === 'no-preference') {
        const sample = await body.evaluate(async el => {
          await new Promise(requestAnimationFrame)
          const animation = el.getAnimations().find(a => a.effect.getKeyframes().some(frame => 'height' in frame))
          if (!animation) return null
          animation.pause()
          const duration = animation.effect.getTiming().duration
          animation.currentTime = 0
          const start = el.getBoundingClientRect().height
          animation.currentTime = duration / 2
          const middle = el.getBoundingClientRect().height
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
          return { start, middle, end, easing, expectedEasing, finishHeights }
        })
        expect(sample, `${row.name} must animate its height while ${open ? 'opening' : 'closing'}`).not.toBeNull()
        await info.attach(`${open ? 'opening' : 'closing'}-heights`, { body: JSON.stringify(sample), contentType: 'application/json' })
        expect(sample.middle).toBeGreaterThan(Math.min(sample.start, sample.end))
        expect(sample.middle).toBeLessThan(Math.max(sample.start, sample.end))
        const curve = value => value.match(/-?\d*\.?\d+/g).map(Number)
        expect(curve(sample.easing)).toEqual(curve(sample.expectedEasing))
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
