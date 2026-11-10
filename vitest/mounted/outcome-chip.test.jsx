// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import TranscriptOutcomeChip from '../../src/ui/transcript/OutcomeChip.jsx'

/* Mounted pilot: this is the same production component the existing
 * scripts/transcript-outcome-chip.test.mjs renders through renderToStaticMarkup,
 * but it mounts a real React root in the Vitest jsdom environment. The point is
 * to prove the migration path: Vitest's Vite transform imports the .jsx source
 * directly, and jsdom provides the DOM without a bespoke per-file Vite server. */

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
  it('renders the ok tone for a canonical resolved outcome', async () => {
    const mounted = await mount('resolved')
    const chip = mounted.querySelector('.chip')
    expect(chip).not.toBeNull()
    expect(chip?.className).toBe('chip chip-ok')
    expect(chip?.getAttribute('title')).toBe('outcome, resolved')
    expect(chip?.textContent?.trim()).toBe('resolved')
    expect(chip?.querySelector('svg')).not.toBeNull()
  })

  it('renders the err tone for the annotation not_resolved value', async () => {
    const mounted = await mount('not_resolved')
    const chip = mounted.querySelector('.chip')
    expect(chip?.className).toBe('chip chip-err')
    expect(chip?.getAttribute('title')).toBe('outcome, not resolved')
    expect(chip?.textContent?.trim()).toBe('not resolved')
  })

  it('renders nothing for an unknown outcome', async () => {
    const mounted = await mount('unknown-value')
    expect(mounted.childElementCount).toBe(0)
  })
})
