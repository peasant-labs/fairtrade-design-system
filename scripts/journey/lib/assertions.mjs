/* Journey assertion helpers: the design-system and accessibility contract a
 * mounted surface must satisfy.
 *
 * App-agnostic: this is the canonical copy consumers vendor into their own
 * journey harness. See scripts/journey/README.md.
 *
 * The theme rule lives in the app-owned product target contract
 * (scripts/fairtest/fairtrade-targets.mjs) and the shared host contract;
 * this module only adapts those rules to the live tree. Do not add a
 * second copy of the theme table here. */
import { expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { normalizeRenderedTheme, observeProductTheme } from '../../fairtest/fairtrade-targets.mjs'

export const DEFAULT_AXE_TAGS = ['wcag2a', 'wcag2aa']

/** Run axe-core over the current page and return a compact, JSON-serializable report. */
export async function scanAxe(page, tags = DEFAULT_AXE_TAGS) {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze()
  return {
    tags,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
    incomplete: results.incomplete.map((v) => v.id),
    passes: results.passes.length,
  }
}

/** Violations that block a merge: critical and serious impact. */
export function seriousViolations(scan) {
  return scan.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
}

/**
 * The mounted tree must carry the requested theme. The comparison is
 * normalized through the app-owned target contract, so an absent or empty
 * attribute counts as dark and the light value counts as light; a wrong
 * or contradictory value fails through that contract before the final
 * assertion. Reads poll until the normalized value settles on the
 * requested theme, so a caller may assert immediately after a theme
 * toggle, navigation, or client-side state change that writes
 * data-theme.
 * @param {import('@playwright/test').Page} page
 * @param {string} theme dark or light row theme
 * @param {{ timeoutMs?: number, pollMs?: number }} [options] bounded retry budget
 */
export async function expectTheme(page, theme, options = {}) {
  const timeoutMs = options.timeoutMs ?? 1000
  const pollMs = options.pollMs ?? 20
  const deadlineMs = Date.now() + timeoutMs
  let raw = await page.locator('html').getAttribute('data-theme')
  let observed = null
  for (;;) {
    try {
      observed = normalizeRenderedTheme(raw)
    } catch {
      observed = null
    }
    if (observed === theme) {
      break
    }
    if (Date.now() >= deadlineMs) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
    raw = await page.locator('html').getAttribute('data-theme')
  }
  const settledRaw = raw
  const settledObserved = observed
  await observeProductTheme({
    expected: theme,
    renderedAttribute: settledRaw,
    source: 'journey-assertions-expectTheme',
    observedAtMs: Date.now(),
  })
  expect(
    settledObserved,
    `rendered theme ${JSON.stringify(settledObserved)} (raw data-theme ${JSON.stringify(settledRaw)}) must equal the expected row theme ${JSON.stringify(theme)}; repair: serve the row route for the expected theme and read the rendered value after it settles.`,
  ).toBe(theme)
}

/**
 * Assert computed design tokens on a surface. Values, not class names: a class that
 * stopped resolving to a token would still be present in the markup.
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {{ fontFamilyIncludes?: string, borderRadius?: string, minFontSize?: number }} expected
 */
export async function expectComputedTokens(page, selector, expected) {
  const actual = await page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el)
    return {
      fontFamily: cs.fontFamily,
      borderRadius: cs.borderRadius,
      fontSize: parseFloat(cs.fontSize),
    }
  })
  if (expected.fontFamilyIncludes) {
    expect(actual.fontFamily.toLowerCase()).toContain(expected.fontFamilyIncludes.toLowerCase())
  }
  if (expected.borderRadius !== undefined) {
    expect(actual.borderRadius).toBe(expected.borderRadius)
  }
  if (expected.minFontSize !== undefined) {
    expect(actual.fontSize).toBeGreaterThanOrEqual(expected.minFontSize)
  }
  return actual
}