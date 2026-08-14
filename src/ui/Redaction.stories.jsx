import { useState } from 'react'
import { expect, fn, within, userEvent, waitFor } from 'storybook/test'
import { RedactionReview, WhereDoesThisGo } from './Redaction.jsx'
import { frame } from './story-frame.jsx'

/* Redaction story. CSF3, title 'in use/Redaction'. the safe-by-default review surface +
   the transparency panel, modeled on peasant's RedactionStep + PushStep:

   - Default: RedactionReview with three matches (api-key 0.98, email 0.91, bearer-token 0.87),
     one toggled "kept" (un-redacted → flagged), level=standard, scan 12/12. controlled toggles
     so the kept state is owned by the story.
   - Transparency: the WhereDoesThisGo panel — destination + a "what gets sent / what stays
     private" split, before an outbound action.

   the theme toolbar flips data-theme; LightTheme pins light. the secret + redacted forms are
   code (mono, never lowercased); chrome is lowercased. rdx-* rules + tokens live in
   Redaction.css (imported by the component). */

// three flagged matches → placeholders. an api key + an email are high-confidence; the bearer
// token sits a touch lower. the email is pre-toggled "kept" so the warning treatment is visible.
const MATCHES = [
  {
    id: 'r1',
    category: 'api-key',
    confidence: 0.98,
    before: 'const STRIPE_KEY = "sk_live_4eC39HqLyjWDarjtT1zdp7dc"',
    after: 'const STRIPE_KEY = "sk_live_••••••••••••••••••••dc"',
    kept: false,
  },
  {
    id: 'r2',
    category: 'email',
    confidence: 0.91,
    before: '// reported by alex.rivera@example.com on the 0.4 rollout',
    after: '// reported by ‹redacted-email› on the 0.4 rollout',
    kept: true,
  },
  {
    id: 'r3',
    category: 'bearer-token',
    confidence: 0.87,
    before: 'Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc"',
    after: 'Authorization: "Bearer ‹redacted-token›"',
    kept: false,
  },
]

const meta = {
  title: 'in use/Redaction',
  component: RedactionReview,
  tags: ['autodocs'],
  argTypes: {
    level: { control: 'inline-radio', options: ['minimal', 'standard', 'maximum'] },
    total: { control: 'number' },
    scanned: { control: 'number' },
    matches: { control: false },
    availableLevels: { control: false },
    onToggle: { control: false },
    onLevel: { control: false },
  },
}
export default meta

// a small stateful wrapper so the level selector + per-match keep/revert toggles are live in the
// story (the component is fully controlled — the parent owns level + each match's kept state).
function ReviewHarness({ level: initialLevel = 'standard', matches: initialMatches = MATCHES, ...rest }) {
  const [level, setLevel] = useState(initialLevel)
  const [matches, setMatches] = useState(initialMatches)
  const onToggle = (id, kept) =>
    setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, kept } : m)))
  return (
    <RedactionReview
      level={level}
      onLevel={setLevel}
      matches={matches}
      onToggle={onToggle}
      {...rest}
    />
  )
}

export const Default = {
  render: (args) => <ReviewHarness {...args} />,
  decorators: frame('wide'),
  args: {
    level: 'standard',
    scanned: 12,
    total: 12,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // the scan progress reports 12 / 12 as a real progressbar.
    const bar = canvas.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '12')
    expect(bar).toHaveAttribute('aria-valuemax', '12')

    // the level selector — standard is pressed; the choice is not color-only (aria-pressed).
    const standard = canvas.getByRole('button', { name: /standard/i })
    expect(standard).toHaveAttribute('aria-pressed', 'true')

    // each match shows its category · confidence badge.
    expect(canvas.getByText('api-key')).toBeInTheDocument()
    expect(canvas.getByText('0.98')).toBeInTheDocument()
    expect(canvas.getByText('bearer-token')).toBeInTheDocument()

    // the email starts kept (un-redacted) → flagged "will be sent" + counted in the summary.
    expect(canvas.getAllByText(/will be sent/i).length).toBeGreaterThan(0)
    expect(canvas.getByText(/kept un-redacted/i)).toBeInTheDocument()

    // keep/revert: reverting the email re-redacts it; the "will be sent" flag clears.
    const reverts = canvas.getAllByRole('button', { name: /revert/i })
    expect(reverts[0]).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(reverts[0])
    await waitFor(() => {
      expect(canvas.queryByText(/will be sent/i)).not.toBeInTheDocument()
      expect(canvas.getByText(/all redacted/i)).toBeInTheDocument()
    })
  },
}

// a scan that couldn't finish every file — the honest-failure banner must show so an empty
// result is not mistaken for "all clear".
export const WithScanFailure = {
  render: (args) => <ReviewHarness {...args} />,
  decorators: frame('wide'),
  args: {
    level: 'maximum',
    scanned: 10,
    total: 12,
    failure: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('alert')).toHaveTextContent(/could not be fully scanned/i)
  },
}

export const Empty = {
  render: (args) => <ReviewHarness {...args} />,
  decorators: frame('wide'),
  args: {
    level: 'standard',
    scanned: 6,
    total: 6,
    matches: [],
  },
}

export const SingleLevel = {
  render: (args) => <ReviewHarness {...args} />,
  decorators: frame('wide'),
  args: {
    level: 'standard',
    availableLevels: ['standard'],
    scanned: 12,
    total: 12,
  },
  play: async ({ canvasElement }) => {
    const review = canvasElement.querySelector('.rdx-review')
    expect(review).not.toHaveTextContent(/\bminimal\b/i)
    expect(review).not.toHaveTextContent(/\bmaximum\b/i)
    expect(review.querySelector('.rdx-level')).toBeNull()
  },
}

const availableLevelSelection = fn()

export const AvailableLevelSubset = {
  render: (args) => <RedactionReview {...args} />,
  decorators: frame('wide'),
  args: {
    level: 'standard',
    availableLevels: ['maximum', 'standard'],
    onLevel: availableLevelSelection,
    scanned: 0,
    total: 0,
    matches: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const choices = canvas.getAllByRole('button').map((button) => button.textContent.trim())
    expect(choices).toEqual(['standard', 'maximum'])
    await userEvent.click(canvas.getByRole('button', { name: /maximum/i }))
    expect(availableLevelSelection).toHaveBeenLastCalledWith('maximum')

    expect(() => RedactionReview({ availableLevels: [], level: 'standard' })).toThrow(/RedactionReview availableLevels is invalid/)
    expect(() => RedactionReview({ availableLevels: ['unknown'], level: 'standard' })).toThrow(/RedactionReview availableLevels is invalid/)
    expect(() => RedactionReview({ availableLevels: ['standard'], level: 'maximum' })).toThrow(/does not include the controlled level/)
  },
}

async function assertKeptStyles({ canvasElement }) {
  const original = canvasElement.querySelector('.rdx-row-del.rdx-row-muted')
  const replacement = canvasElement.querySelector('.rdx-row-add.rdx-row-muted')
  const originalCode = original.querySelector('.rdx-code')
  const originalText = original.querySelector('.rdx-strike')
  const neutralSurface = canvasElement.querySelector('.rdx-bar')

  expect(getComputedStyle(original).backgroundColor).toBe(getComputedStyle(neutralSurface).backgroundColor)
  expect(getComputedStyle(originalCode).color).toBe(getComputedStyle(canvasElement.querySelector('.rdx-review')).color)
  expect(getComputedStyle(originalText).textDecorationLine).toBe('none')
  expect(getComputedStyle(replacement).opacity).toBe('0.45')
  expect(original.querySelector('.rdx-glyph svg')).toHaveClass('lucide-eye')
}

export const KeptOriginal = {
  render: (args) => <ReviewHarness {...args} />,
  decorators: frame('wide'),
  args: {
    level: 'standard',
    matches: [MATCHES[1]],
    scanned: 1,
    total: 1,
  },
  play: async (context) => {
    const { canvasElement } = context
    const canvas = within(canvasElement)
    expect(canvas.getByText(/original secret \(kept, will be sent\)/i)).toBeInTheDocument()
    expect(canvas.getByText(/redacted form \(not used\)/i)).toBeInTheDocument()
    await assertKeptStyles(context)
  },
}

export const KeptOriginalLight = {
  ...KeptOriginal,
  globals: { theme: 'light', backgrounds: { value: 'light' } },
}

export const NarrowReview = {
  render: (args) => <ReviewHarness {...args} />,
  decorators: frame(320),
  parameters: {
    viewport: {
      defaultViewport: 'review320',
      options: { review320: { name: 'review · 320', styles: { width: '320px', height: '780px' } } },
    },
  },
  args: {
    level: 'standard',
    scanned: 12,
    total: 12,
  },
  play: async ({ canvasElement }) => {
    const review = canvasElement.querySelector('.rdx-review')
    const selector = review.querySelector('.rdx-seg')
    const choices = [...selector.querySelectorAll('.rdx-seg-opt')]
    const cards = [...review.querySelectorAll('.rdx-card')]

    expect(review.scrollWidth).toBeLessThanOrEqual(review.clientWidth)
    expect(selector.scrollWidth).toBeLessThanOrEqual(selector.clientWidth)
    expect(choices[1].offsetTop).toBeGreaterThan(choices[0].offsetTop)
    expect(cards.every((card) => card.getBoundingClientRect().right <= review.getBoundingClientRect().right)).toBe(true)
  },
}

// ── Transparency: the WhereDoesThisGo panel ──────────────────────────────────
export const Transparency = {
  render: (args) => <WhereDoesThisGo {...args} />,
  decorators: frame('wide'),
  parameters: { controls: { include: ['destination', 'sent', 'private'] } },
  args: {
    destination: 'https://commons.fairtrade.dev/share',
    sent: ['session title', 'redacted transcript', 'your handle'],
    private: ['raw transcript', 'file contents', 'api keys'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // the panel names its destination (code, not lowercased) + both columns.
    expect(canvas.getByText('https://commons.fairtrade.dev/share')).toBeInTheDocument()
    expect(canvas.getByText('what gets sent')).toBeInTheDocument()
    expect(canvas.getByText('what stays private')).toBeInTheDocument()

    // the sent / private rows render verbatim.
    expect(canvas.getByText('redacted transcript')).toBeInTheDocument()
    expect(canvas.getByText('api keys')).toBeInTheDocument()
  },
}

export const LightTheme = {
  render: (args) => <ReviewHarness {...args} />,
  decorators: frame('wide'),
  args: {
    level: 'standard',
    scanned: 12,
    total: 12,
  },
  globals: { theme: 'light', backgrounds: { value: 'light' } },
}
