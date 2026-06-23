import { useState } from 'react'
import { expect, within, userEvent, waitFor } from 'storybook/test'
import {
  VisibilityEye,
  VisibilitySegmented,
  ScopeChip,
  FocusedModeToggle,
} from './VisibilityControl.jsx'
import { frame } from './story-frame.jsx'

/* VisibilityControl stories. CSF3, title 'in use/VisibilityControl'. the visibility + scope control
   family, modeled on village's VisibilityEye + TranscriptEditDialog segmented and peasant's
   session-detail/v2 scope chip / focused-mode:

   - Eyes:       the three modes (public / private / shared) side by side, each glyph naming its mode
                 on hover/focus; shared names the exact group ("shared with: AI Research Team").
   - Segmented:  the private | public control with a one-line description under each.
   - SharedNote: the same control in the server-managed 'shared' state — the override note shows.
   - Scope:      the task / file / change chip set.
   - FocusedMode: the "focused" toggle (prompts & replies only).

   the segmented + scope + focus play()s flip the selection and assert aria-pressed moved, so the
   neuroinclusive contract (state never color-only) is exercised, not just declared. the theme
   toolbar flips data-theme; LightTheme pins light. vc-* rules + tokens live in
   VisibilityControl.css (imported by the component). */

const meta = {
  title: 'in use/VisibilityControl',
  component: VisibilitySegmented,
  tags: ['autodocs'],
  decorators: frame('panel'),
  argTypes: {
    value: { control: 'inline-radio', options: ['private', 'public', 'shared'] },
    onChange: { control: false },
    sharedNote: { control: 'text' },
    label: { control: 'text' },
  },
}
export default meta

// a small stateful wrapper so the segmented control is live in the story (the component is fully
// controlled — the parent owns the value). a 'shared' initial value can't be re-selected by the
// two options, matching the server-managed contract.
function SegmentedHarness({ value: initial = 'private', ...rest }) {
  const [value, setValue] = useState(initial)
  return <VisibilitySegmented value={value} onChange={setValue} {...rest} />
}

// ── VisibilityEye: the three modes ───────────────────────────────────────────
export const Eyes = {
  render: () => (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
      <VisibilityEye visibility="public" />
      <VisibilityEye visibility="private" />
      <VisibilityEye visibility="shared" sharedWith="AI Research Team" />
    </div>
  ),
  parameters: { controls: { disable: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // each glyph carries its mode as an accessible word (never glyph/color alone).
    expect(canvas.getByText('visibility: public')).toBeInTheDocument()
    expect(canvas.getByText('visibility: private')).toBeInTheDocument()
    expect(canvas.getByText('visibility: shared')).toBeInTheDocument()

    // hovering the shared eye reveals a tooltip naming the EXACT group, verbatim (user content,
    // not lowercased).
    const sharedAnchor = canvas.getByText('visibility: shared').parentElement
    await userEvent.hover(sharedAnchor)
    await waitFor(() => {
      const tip = canvas.getByRole('tooltip')
      expect(tip).toHaveTextContent('shared with: AI Research Team')
    })
  },
}

// ── VisibilitySegmented: private | public ────────────────────────────────────
export const Segmented = {
  render: (args) => <SegmentedHarness {...args} />,
  args: { value: 'private', label: 'visibility' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const priv = canvas.getByRole('button', { name: /private/i })
    const pub = canvas.getByRole('button', { name: /public/i })

    // each option shows its one-line description.
    expect(canvas.getByText('Only you can view this.')).toBeInTheDocument()
    expect(canvas.getByText('Anyone with the link can view.')).toBeInTheDocument()

    // private starts pressed; public is not. the choice is not color-only (aria-pressed).
    expect(priv).toHaveAttribute('aria-pressed', 'true')
    expect(pub).toHaveAttribute('aria-pressed', 'false')

    // flip to public — aria-pressed moves across the control.
    await userEvent.click(pub)
    await waitFor(() => {
      expect(pub).toHaveAttribute('aria-pressed', 'true')
      expect(priv).toHaveAttribute('aria-pressed', 'false')
    })
  },
}

// the server-managed 'shared' state — neither option is pressed and the override note shows.
export const SharedNote = {
  render: (args) => <SegmentedHarness {...args} />,
  args: {
    value: 'shared',
    sharedNote: 'shared with the AI Research Team: choose private or public to override.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // in the shared state neither private nor public is pressed.
    expect(canvas.getByRole('button', { name: /private/i })).toHaveAttribute('aria-pressed', 'false')
    expect(canvas.getByRole('button', { name: /public/i })).toHaveAttribute('aria-pressed', 'false')

    // the override note explains the server-managed state + the way out.
    expect(canvas.getByText(/choose private or public to override/i)).toBeInTheDocument()
  },
}

// ── ScopeChip: task / file / change ──────────────────────────────────────────
function ScopeHarness({ scope: initial = 'task' }) {
  const [scope, setScope] = useState(initial)
  return <ScopeChip scope={scope} onChange={setScope} />
}

export const Scope = {
  render: () => <ScopeHarness scope="task" />,
  parameters: { controls: { disable: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const task = canvas.getByRole('button', { name: 'task' })
    const file = canvas.getByRole('button', { name: 'file' })
    const change = canvas.getByRole('button', { name: 'change' })

    // task starts pressed; the others are not.
    expect(task).toHaveAttribute('aria-pressed', 'true')
    expect(file).toHaveAttribute('aria-pressed', 'false')
    expect(change).toHaveAttribute('aria-pressed', 'false')

    // pick 'file' — the pressed state moves to it, exclusively.
    await userEvent.click(file)
    await waitFor(() => {
      expect(file).toHaveAttribute('aria-pressed', 'true')
      expect(task).toHaveAttribute('aria-pressed', 'false')
    })
  },
}

// ── FocusedModeToggle ────────────────────────────────────────────────────────
function FocusedHarness({ on: initial = false }) {
  const [on, setOn] = useState(initial)
  return <FocusedModeToggle on={on} onToggle={setOn} />
}

export const FocusedMode = {
  render: () => <FocusedHarness on={false} />,
  parameters: { controls: { disable: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const toggle = canvas.getByRole('button', { name: /focused/i })

    // starts off, and reads as one phrase: "focused — prompts & replies only".
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(canvas.getByText(/prompts & replies only/i)).toBeInTheDocument()

    // toggle on — aria-pressed flips (state is not color-only).
    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'))
  },
}

// the whole family on one canvas, in the on / pressed states, for a quick visual read.
export const AllControls = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <VisibilityEye visibility="public" />
        <VisibilityEye visibility="private" />
        <VisibilityEye visibility="shared" sharedWith="AI Research Team" />
      </div>
      <SegmentedHarness value="public" />
      <ScopeHarness scope="file" />
      <FocusedHarness on />
    </div>
  ),
  parameters: { controls: { disable: true } },
}

export const LightTheme = {
  render: (args) => <SegmentedHarness {...args} />,
  args: { value: 'public' },
  globals: { theme: 'light', backgrounds: { value: 'light' } },
}
