import { useState } from 'react'
import { fn, expect, userEvent, within, waitFor } from 'storybook/test'
import CommandPalette from './CommandPalette.jsx'

/* the command palette is controlled by an `open` prop, so every story wraps it in a small
   stateful harness with a real trigger button. that lets the play test open it, drive the
   keyboard, and assert the resulting dialog/listbox aria state. the .cp-* / .cmdk styling
   comes from src/index.css via .storybook/preview.jsx. */
const SECTIONS = [
  { id: 'color', label: 'color tokens' },
  { id: 'states', label: 'interaction states' },
  { id: 'overlays', label: 'overlays' },
  { id: 'transcripts', label: 'transcript cards' },
  { id: 'providers', label: 'providers (claude-code, gemini-cli)' },
  { id: 'collectives', label: 'collectives' },
  { id: 'redaction', label: 'redaction rules' },
]

/* the palette renders into a fixed overlay; a real trigger gives the play test something to
   click, and keeping `open` in state means Enter/Esc can actually toggle it back closed. */
function Harness({ sections = SECTIONS, onClose, onTheme, startOpen = false }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        search ⌘k
      </button>
      <CommandPalette
        open={open}
        onClose={() => {
          setOpen(false)
          onClose?.()
        }}
        onTheme={onTheme}
        sections={sections}
      />
    </div>
  )
}

const meta = {
  title: 'overlays/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
  argTypes: {
    open: { control: 'boolean' },
    sections: { control: 'object' },
    onClose: { action: 'closed' },
    onTheme: { action: 'theme toggled' },
  },
  args: {
    sections: SECTIONS,
    onClose: fn(),
    onTheme: fn(),
  },
}
export default meta

/* the canonical, controllable view: flip `open` in the controls or via the trigger button. */
export const Playground = {
  render: (args) => (
    <Harness sections={args.sections} onClose={args.onClose} onTheme={args.onTheme} startOpen={args.open} />
  ),
}

/* opens via the trigger, then drives the keyboard end-to-end. tolerant assertions: the palette
   may surface as a [role=dialog] and/or a search input. */
export const Default = {
  render: (args) => (
    <Harness sections={args.sections} onClose={args.onClose} onTheme={args.onTheme} />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    // open the palette from a real trigger
    await userEvent.click(canvas.getByRole('button', { name: /search/i }))

    // the dialog (or at least its search input) becomes visible
    const dialog = await waitFor(() => canvas.getByRole('dialog'))
    await expect(dialog).toBeInTheDocument()
    // the component auto-focuses the search input via a setTimeout effect on open,
    // so wait for that focus to land before asserting it.
    const input = canvas.getByRole('combobox')
    await waitFor(() => expect(input).toHaveFocus())

    // results listbox renders the built-in actions plus the sections
    const list = canvas.getByRole('listbox')
    await expect(within(list).getAllByRole('option').length).toBeGreaterThan(0)

    // arrow down to move the highlight, then enter to run -> closes the palette.
    // keyboard events are handled on the focused input, so drive it directly.
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(args.onClose).toHaveBeenCalled())
    await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
  },
}

/* typing narrows the listbox to a single matching section. */
export const Filtered = {
  render: (args) => (
    <Harness sections={args.sections} onClose={args.onClose} onTheme={args.onTheme} startOpen />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = await waitFor(() => canvas.getByRole('combobox'))
    await userEvent.type(input, 'redaction')
    const list = canvas.getByRole('listbox')
    await waitFor(() => expect(within(list).getAllByRole('option')).toHaveLength(1))
    await expect(within(list).getByText('redaction rules')).toBeInTheDocument()
  },
}

/* a query that matches nothing shows the empty state instead of options. */
export const Empty = {
  render: (args) => (
    <Harness sections={args.sections} onClose={args.onClose} onTheme={args.onTheme} startOpen />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = await waitFor(() => canvas.getByRole('combobox'))
    await userEvent.type(input, 'no-such-thing-zzz')
    await waitFor(() => expect(canvas.queryAllByRole('option')).toHaveLength(0))
    await expect(canvas.getByText(/no matches for/i)).toBeInTheDocument()
  },
}

/* esc closes the open palette and fires onClose. */
export const EscapeCloses = {
  render: (args) => (
    <Harness sections={args.sections} onClose={args.onClose} onTheme={args.onTheme} startOpen />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const input = await waitFor(() => canvas.getByRole('combobox'))
    // Escape is handled on the input's onKeyDown, so wait for the open effect to
    // auto-focus the input before dispatching the key — otherwise it lands on the
    // body and never reaches the handler.
    await waitFor(() => expect(input).toHaveFocus())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(args.onClose).toHaveBeenCalled())
    await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
  },
}
