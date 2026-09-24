/* Journey: SessionGroupDisclosure element.
 *
 * Drives the/disclosure story through the real Storybook iframe in both
 * themes: asserts the collapsed control states its count, one press reveals
 * the rows and flips the aria wiring, the design-token contract holds, and
 * axe reports no blocking violations. Records the ARIA tree and axe report
 * for agent review.
 */
import { writeFileSync } from 'node:fs'
import { test, expect, storyUrl } from './lib/fixtures.mjs'
import {
  scanAxe,
  seriousViolations,
  expectComputedTokens,
} from './lib/assertions.mjs'

const STORY = 'components-sessiongroupdisclosure--playground'

test.describe('session group disclosure', () => {
  test('expands, states its count, and passes axe', async ({ page, theme }, testInfo) => {
    await page.goto(storyUrl(STORY, theme))

    const toggle = page.getByTestId('session-group-disclosure-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('session-group-disclosure-label')).toHaveText(
      'orphan sessions 2',
    )

    // Design-system contract on computed values, not class strings.
    await expectComputedTokens(page, '.sgd-trigger', {
      fontFamilyIncludes: 'mono',
      minFontSize: 14,
    })

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const rows = page.locator('#sgd-story-rows')
    await expect(rows).toBeVisible()
    await expect(rows.getByText('Recover the unreadable parent chain')).toBeVisible()

    const aria = await page.locator('#storybook-root').ariaSnapshot()
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
