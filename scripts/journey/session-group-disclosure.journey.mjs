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
import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'yaml'
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

const { cases } = parse(readFileSync(new URL('../testdata/session-group-disclosure.yaml', import.meta.url), 'utf8'))
const REQUIRED_NAMES = ['omitted-default', 'explicit-true', 'explicit-false']
expect(cases.map(({ name }) => name).sort()).toEqual([...REQUIRED_NAMES].sort())
expect(cases.find(({ name }) => name === 'omitted-default').story).toBe(COMPONENT_STORY_ID)

test.describe('session group disclosure', () => {
  for (const fixture of cases) {
  test(`${fixture.name}: expands, collapses, states its count, and passes axe`, async ({ page, theme }, testInfo) => {
    await page.goto(storyUrl(fixture.story, theme) + (fixture.args ? `&args=${fixture.args}` : ''))

    const toggle = page.locator(COMPONENT_SELECTORS.toggle)
    const root = page.locator(COMPONENT_SELECTORS.root)
    const rows = page.locator(COMPONENT_SELECTORS.rows)
    const hint = root.locator('.sgd-show')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toHaveAttribute('aria-controls', 'sgd-story-rows')
    await expect(page.locator(COMPONENT_SELECTORS.label)).toHaveText(COMPONENT_COLLAPSED_LABEL)
    await expect(toggle).toHaveAccessibleName(COMPONENT_COLLAPSED_LABEL + (fixture.hint ? ' show' : ''))
    await expect(hint).toHaveCount(fixture.hint ? 1 : 0)
    if (fixture.hint) await expect(hint).toHaveText('show')
    await expect(toggle.locator('.lucide-chevron-right')).toHaveCount(1)
    await expect(root.locator('.sgd-spacer')).toHaveCount(1)
    await expect(rows).toHaveCount(0)
    // Storybook's default dark theme uses an empty attribute; normalize it here,
    // at the app-owned boundary, without changing the shared theme assertion.
    await expect.poll(() => page.locator('html').evaluate((el) => el.getAttribute('data-theme') || 'dark')).toBe(theme)

    // Design-system contract on computed values, not class strings.
    await expectComputedTokens(page, COMPONENT_SELECTORS.trigger, {
      fontFamilyIncludes: 'mono',
      minFontSize: 14,
      borderRadius: '0px',
    })
    const geometry = await root.locator('.sgd').evaluate((el) => ({
      indent: getComputedStyle(el).paddingLeft,
      indentToken: getComputedStyle(el).getPropertyValue('--sp-5').trim(),
      border: getComputedStyle(el).borderTopWidth,
      target: getComputedStyle(el.querySelector('button')).minHeight,
      targetToken: getComputedStyle(el).getPropertyValue('--target-comfortable').trim(),
    }))
    expect(geometry.target).toBe(geometry.targetToken)
    if (!fixture.hint) {
      expect(geometry.indent).toBe(geometry.indentToken)
      expect(geometry.border).toBe('0px')
    }
    await root.screenshot({ path: testInfo.outputPath('collapsed.png') })

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle).toBeFocused()
    await expect(toggle).toHaveAccessibleName(COMPONENT_COLLAPSED_LABEL + (fixture.hint ? ' hide' : ''))
    await expect(hint).toHaveCount(fixture.hint ? 1 : 0)
    if (fixture.hint) await expect(hint).toHaveText('hide')
    await expect(toggle.locator('.lucide-chevron-down')).toHaveCount(1)
    await expect(rows).toBeVisible()
    await expect(rows.getByText(COMPONENT_ROW_TEXTS[0])).toBeVisible()
    await expect(rows.getByText(COMPONENT_ROW_TEXTS[1])).toBeVisible()
    await root.screenshot({ path: testInfo.outputPath('expanded.png') })

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

    await toggle.press('Space')
    await expect(toggle).toBeFocused()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(rows).toHaveCount(0)
    await expect(hint).toHaveCount(fixture.hint ? 1 : 0)
    if (fixture.hint) await expect(hint).toHaveText('show')
    await expect(toggle.locator('.lucide-chevron-right')).toHaveCount(1)
    await toggle.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(rows).toBeVisible()
    await expect(toggle).toBeFocused()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(rows).toHaveCount(0)
  })
  }
})
