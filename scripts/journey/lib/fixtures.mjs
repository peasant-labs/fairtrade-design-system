/* Journey fixtures: the deterministic, theme-pinned page every journey starts
 * from. Overrides Playwright's context fixture so determinism is installed
 * BEFORE the first navigation, never inside a test body.
 *
 * Two theme paths coexist here and must not be confused:
 *
 * - `theme` (legacy broad-catalog path): reads the Playwright project name
 *   ("dark" | "light"). The broad journey catalog runs two theme projects
 *   (see playwright.journey.config.mjs) and Storybook stories read the theme
 *   from the `theme` global (withThemeByDataAttribute in
 *   .storybook/preview.jsx), so journeys pass it as a URL global rather than
 *   touching localStorage. Existing journeys depend on this fixture; it is
 *   never removed or repointed.
 *
 * - `resolveRowTheme` (Fairtest row-scoped path): binds the theme from an
 *   explicit row key ("dark" | "light") supplied by the caller. The
 *   one-project Fairtest config (playwright.fairtest.config.mjs) has a
 *   single project, so deriving a row theme from a project name is exactly
 *   the inference the Fairtest contract forbids (see
 *   productThemeFromProjectName in scripts/fairtest/fairtrade-targets.mjs,
 *   which always throws). Fairtest rows use this helper; neither path
 *   silently replaces the other.
 */
import { test as base, expect } from '@playwright/test'
import { installDeterminism } from './determinism.mjs'

export const test = base.extend({
  theme: async ({}, use, testInfo) => {
    await use(testInfo.project.name)
  },
  context: async ({ context }, use) => {
    await installDeterminism(context)
    await use(context)
  },
})

export { expect }

/**
 * Bind a Fairtest row theme from its explicit row key, fail-closed. The key
 * is the row identity the caller iterates (dark, light); anything else is a
 * caller bug, never a guess.
 * @param {unknown} rowKey explicit row key supplied by the caller
 * @returns {string} the validated row theme
 */
export function resolveRowTheme(rowKey) {
  if (rowKey !== 'dark' && rowKey !== 'light') {
    throw new Error(
      `journey fixtures: unknown row theme ${JSON.stringify(rowKey)} for field "rowKey" at path fixtures.rowTheme; ` +
      'repair: bind the Fairtest row theme from the explicit row key using dark or light for "rowKey".',
    )
  }
  return rowKey
}

/** Story iframe URL for a story id under the active theme. */
export function storyUrl(id, theme) {
  const globals = theme === 'light' ? '&globals=theme:light' : ''
  return `/iframe.html?id=${id}&viewMode=story${globals}`
}
