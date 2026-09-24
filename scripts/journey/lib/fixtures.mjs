/* Journey fixtures: the deterministic, theme-pinned page every journey starts
 * from. Overrides Playwright's context fixture so determinism is installed
 * BEFORE the first navigation, never inside a test body.
 *
 * The theme fixture reads the Playwright project name ("dark" | "light").
 * Storybook stories read the theme from the `theme` global
 * (withThemeByDataAttribute in .storybook/preview.jsx), so journeys pass it
 * as a URL global rather than touching localStorage.
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

/** Story iframe URL for a story id under the active theme. */
export function storyUrl(id, theme) {
  const globals = theme === 'light' ? '&globals=theme:light' : ''
  return `/iframe.html?id=${id}&viewMode=story${globals}`
}
