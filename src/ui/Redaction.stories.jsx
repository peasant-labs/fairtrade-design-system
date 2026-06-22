import { useState } from 'react'
import { expect, within, userEvent, waitFor } from 'storybook/test'
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
  decorators: frame('wide'),
  argTypes: {
    level: { control: 'inline-radio', options: ['minimal', 'standard', 'maximum'] },
    total: { control: 'number' },
    scanned: { control: 'number' },
    matches: { control: false },
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
    expect(canvas.getByText(/will be sent/i)).toBeInTheDocument()
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
  args: {
    level: 'standard',
    scanned: 6,
    total: 6,
    matches: [],
  },
}

// ── Transparency: the WhereDoesThisGo panel ──────────────────────────────────
export const Transparency = {
  render: (args) => <WhereDoesThisGo {...args} />,
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
  args: {
    level: 'standard',
    scanned: 12,
    total: 12,
  },
  globals: { theme: 'light', backgrounds: { value: 'light' } },
}
