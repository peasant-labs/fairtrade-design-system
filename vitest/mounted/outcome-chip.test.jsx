// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import YAML from 'yaml'
import TranscriptOutcomeChip from '../../src/ui/transcript/OutcomeChip.jsx'

/* Mounted pilot: the same production component the existing
 * scripts/transcript-outcome-chip.test.mjs renders through renderToStaticMarkup,
 * mounted here as a real React root in Vitest's jsdom environment. The named
 * cases come from the shared fixture, so this test and the subprocess gate
 * cannot drift into two color/label tables. */

// Vitest exposes a transformed import.meta.url, not always a file: URL, so the
// repository-root fixture path is resolved from the command's working directory.
const fixture = YAML.parse(readFileSync(resolve(process.cwd(), 'scripts/testdata/transcript-outcome-chip.yaml'), 'utf8'))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLDivElement | null} */
let container = null
/** @type {import('react-dom/client').Root | null} */
let root = null

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount())
    root = null
  }
  if (container) {
    container.remove()
    container = null
  }
})

/**
 * Mount the chip with one outcome.
 * @param {string | undefined} outcome outcome value
 * @returns {Promise<HTMLDivElement>} the container
 */
async function mount(outcome) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<TranscriptOutcomeChip outcome={outcome} />)
  })
  return container
}

describe('TranscriptOutcomeChip mounted under Vitest', () => {
  for (const testCase of fixture.cases) {
    it(testCase.name, async () => {
      const mounted = await mount(testCase.outcome)
      const chip = mounted.querySelector('.chip')
      expect(chip).not.toBeNull()
      expect(chip?.className).toBe(testCase.expectedClass)
      expect(chip?.getAttribute('title')).toBe(testCase.expectedTitle)
      expect(chip?.textContent?.trim()).toBe(testCase.expectedLabel)
      expect(chip?.querySelector(`svg.${testCase.expectedIconClass}`)).not.toBeNull()
    })
  }

  for (const testCase of fixture.renderNothingCases) {
    it(testCase.name, async () => {
      const mounted = await mount(testCase.outcome ?? undefined)
      expect(mounted.childElementCount).toBe(0)
    })
  }
})
