/* Journey: SessionGroupDisclosure element.
 *
 * Drives the shared disclosure story through the real Storybook iframe in both
 * themes: asserts the collapsed control states its count, one press reveals
 * the rows and flips the aria wiring, the design-token contract holds, and
 * axe reports no blocking violations. Records the ARIA tree and axe report
 * for agent review.
 *
 * The story id, the selector bundle, the collapsed label, and the revealed row
 * texts are app-owned and declared once in the Fairtest component target; this
 * journey is a compatibility consumer of that declaration, so the story under
 * test can never drift between the broad catalog and the mounted component
 * proof.
 */
import { writeFileSync } from 'node:fs'
import { test, expect, storyUrl } from './lib/fixtures.mjs'
import {
  scanAxe,
  seriousViolations,
  expectComputedTokens,
} from './lib/assertions.mjs'
import {
  COMPONENT_COLLAPSED_LABEL,
  COMPONENT_ROW_TEXTS,
  COMPONENT_SELECTORS,
  COMPONENT_STORY_ID,
} from '../fairtest/fairtrade-component-target.mjs'

test.describe('session group disclosure', () => {
  test('expands, states its count, and passes axe', async ({ page, theme }, testInfo) => {
    await page.goto(storyUrl(COMPONENT_STORY_ID, theme))

    const toggle = page.locator(COMPONENT_SELECTORS.toggle)
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator(COMPONENT_SELECTORS.label)).toHaveText(COMPONENT_COLLAPSED_LABEL)

    // Design-system contract on computed values, not class strings.
    await expectComputedTokens(page, COMPONENT_SELECTORS.trigger, {
      fontFamilyIncludes: 'mono',
      minFontSize: 14,
    })

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const rows = page.locator(COMPONENT_SELECTORS.rows)
    await expect(rows).toBeVisible()
    await expect(rows.getByText(COMPONENT_ROW_TEXTS[0])).toBeVisible()

    const aria = await page.locator(COMPONENT_SELECTORS.root).ariaSnapshot()
    writeFileSync(testInfo.outputPath('sgd-aria.yml'), aria)
    await testInfo.attach('sgd-aria.yml', {
      path: testInfo.outputPath('sgd-aria.yml'),
      contentType: 'text/yaml',
    })

    const axe = await scanAxe(page)
    writeFileSync(testInfo.outputPath('axe.json'), JSON.stringify(axe, null, 2))
    await testInfo.attach('axe.json', {
      path: testInfo.outputPath('axe.json'),
      contentType: 'application/json',
    })
    const blocking = seriousViolations(axe)
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
  })
})
