import { useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import GroupedMultiSelect from './GroupedMultiSelect.jsx'
import { frame } from './story-frame.jsx'

/* CSF3 stories for the grouped tri-state multi-select tree. tokens + classes come from src/index.css
   via .storybook/preview.jsx; the theme toolbar flips data-theme. story data is three realistic
   projects with session-shaped items — verbatim titles (user content, never lowercased) and token
   counts — so the tri-state cascade and the running tally read against believable numbers. */
const meta = {
  title: 'in use/GroupedMultiSelect',
  component: GroupedMultiSelect,
  tags: ['autodocs'],
  decorators: frame('panel'),
  argTypes: {
    tokenLabel: { control: 'text' },
    onChange: { action: 'changed' },
  },
}
export default meta

/* ── three projects, each with realistic session titles + token counts ──────── */

const GROUPS = [
  {
    id: 'ingest-pipeline',
    label: 'ingest-pipeline',
    items: [
      { id: 'ip-1', label: 'Parse raw event stream into typed records', meta: '42 turns · jun 3', tokens: 2040 },
      { id: 'ip-2', label: 'Backfill historical partitions from S3', meta: '18 turns · jun 5', tokens: 1180 },
      { id: 'ip-3', label: 'Dedupe on idempotency key before write', meta: '27 turns · jun 9', tokens: 1620 },
      { id: 'ip-4', label: 'Add dead-letter queue for poison messages', meta: '31 turns · jun 12', tokens: 3290 },
    ],
  },
  {
    id: 'auth-service',
    label: 'auth-service',
    items: [
      { id: 'as-1', label: 'Rotate signing keys without downtime', meta: '22 turns · jun 4', tokens: 1530 },
      { id: 'as-2', label: 'Rate-limit the token endpoint per client', meta: '15 turns · jun 8', tokens: 980 },
      { id: 'as-3', label: 'Migrate sessions to httpOnly cookies', meta: '38 turns · jun 14', tokens: 2710 },
    ],
  },
  {
    id: 'docs-site',
    label: 'docs-site',
    items: [
      { id: 'ds-1', label: 'Rewrite the quickstart for the new CLI', meta: '12 turns · jun 6', tokens: 760 },
      { id: 'ds-2', label: 'Add dark-mode tokens to the theme', meta: '9 turns · jun 11', tokens: 540 },
    ],
  },
]

/* one project fully selected (ingest-pipeline → all four), one partial (auth-service → one). */
const SEEDED = new Set(['ip-1', 'ip-2', 'ip-3', 'ip-4', 'as-1'])

/* ── stories ────────────────────────────────────────────────────────────────── */

/* default — all groups expanded; ingest-pipeline is fully selected, auth-service partial. */
export const Default = {
  args: {
    groups: GROUPS,
    defaultValue: SEEDED,
    defaultOpen: ['ingest-pipeline', 'auth-service', 'docs-site'],
    tokenLabel: 'tokens',
  },
}

/* collapsed — same data, every group closed so only the header rows + tallies show. the tri-state
   boxes still read the selection (ingest full = check, auth partial = dash) without opening. */
export const Collapsed = {
  args: {
    groups: GROUPS,
    defaultValue: SEEDED,
    defaultOpen: [],
    tokenLabel: 'tokens',
  },
}

/* controlled wrapper so the play test can toggle a group and assert (a) the cascade flips every
   item in that group and (b) the toolbar tally (count + tokens) updates to match. */
export const TogglesCascade = {
  args: {
    groups: GROUPS,
    tokenLabel: 'tokens',
  },
  render: (args) => {
    const [value, setValue] = useState(() => new Set())
    return <GroupedMultiSelect {...args} value={value} onChange={setValue} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // starts empty: zero selected, zero tokens.
    const tally = canvasElement.querySelector('.gms-tally-count')
    const tokens = canvasElement.querySelector('.gms-tally-tokens')
    await expect(tally).toHaveTextContent('0')
    await expect(tokens).toHaveTextContent('0')

    // toggle the whole ingest-pipeline group via its cascade checkbox.
    const groupToggle = canvas.getByRole('button', { name: /select group, 0 of 4 selected/i })
    await userEvent.click(groupToggle)

    // cascade: all four items now selected → count 4, tokens 2040+1180+1620+3290 = 8130 → "8.1k".
    await waitFor(() => expect(tally).toHaveTextContent('4'))
    await expect(tokens).toHaveTextContent('8.1k')

    // the group's tri-box now reads "all" (its aria-label flips to 4 of 4 selected).
    await expect(
      canvas.getByRole('button', { name: /select group, 4 of 4 selected/i }),
    ).toHaveAttribute('aria-pressed', 'true')

    // open the group and confirm an individual item carries the cascaded selection.
    await userEvent.click(canvas.getByRole('button', { name: /ingest-pipeline/i }))
    const firstItem = await canvas.findByRole('button', {
      name: /Parse raw event stream into typed records/i,
    })
    await expect(firstItem).toHaveAttribute('aria-pressed', 'true')

    // toggle the group off again → tally returns to zero (cascade clears).
    await userEvent.click(
      canvas.getByRole('button', { name: /select group, 4 of 4 selected/i }),
    )
    await waitFor(() => expect(tally).toHaveTextContent('0'))
    await expect(tokens).toHaveTextContent('0')
  },
}
