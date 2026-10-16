import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import SessionGroupDisclosure from './SessionGroupDisclosure.jsx'
import { frame } from './story-frame.jsx'

/* session group disclosure story. CSF3: a Playground whose expansion state is
   driven by the story, plus one play() interaction test that expands the control
   and asserts the revealed rows appear and the aria wiring flips. classes + tokens
   come from src/index.css via .storybook/preview.jsx; the theme toolbar flips
   data-theme. */

const meta = {
  title: 'components/SessionGroupDisclosure',
  component: SessionGroupDisclosure,
  tags: ['autodocs'],
  decorators: frame('panel'),
  argTypes: {
    expanded: { control: 'boolean' },
    bare: { control: 'boolean' },
    indent: { control: 'boolean' },
    showActionHint: { control: 'boolean' },
    label: { control: 'text' },
    collapsedLabel: { control: 'text' },
    rowsID: { control: false },
    onToggle: { control: false },
    children: { control: false },
  },
  args: {
    label: 'orphan sessions 2',
    collapsedLabel: 'orphan sessions 2',
    expanded: false,
    bare: false,
    indent: false,
  },
}
export default meta

const rows = (
  <ul className="sgd-story-rows">
    <li>Recover the unreadable parent chain</li>
    <li>Audit the orphan ancestry</li>
  </ul>
)

function Controlled(args) {
  const [expanded, setExpanded] = useState(args.expanded)
  return (
    <SessionGroupDisclosure
      {...args}
      expanded={expanded}
      onToggle={() => setExpanded((open) => !open)}
      rowsID="sgd-story-rows"
    >
      <div id="sgd-story-rows">{rows}</div>
    </SessionGroupDisclosure>
  )
}

export const Playground = {
  render: Controlled,
}

// The closed control states its count; one press reveals the rows and flips the
// aria wiring. The rows render only while open, so a folded row is never in the
// accessibility tree.
export const ExpandsAndCollapses = {
  render: Controlled,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByTestId('session-group-disclosure-toggle')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(canvasElement.querySelector('#sgd-story-rows')).toBeNull()

    await userEvent.click(toggle)

    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(canvas.getByTestId('session-group-disclosure-label').textContent).toBe('orphan sessions 2')
    expect(canvasElement.querySelector('#sgd-story-rows')).not.toBeNull()
  },
}

// A group nested inside a list takes the indent step.
export const Indented = {
  render: Controlled,
  args: { indent: true },
}

// Hints remain visible by default; a nested group can opt out without changing
// its count, chevron, accessible button, or caller-owned expansion state.
export const WithoutActionHint = {
  render: Controlled,
  args: { showActionHint: false, bare: true, indent: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByTestId('session-group-disclosure-toggle')
    await expect(toggle).toHaveAccessibleName('orphan sessions 2')
    expect(canvasElement.querySelector('.sgd-show')).toBeNull()
    expect(canvasElement.querySelector('#sgd-story-rows')).toBeNull()
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(canvasElement.querySelector('.sgd-show')).toBeNull()
    expect(canvasElement.querySelector('#sgd-story-rows')).not.toBeNull()
    await userEvent.keyboard('{Enter}')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(canvasElement.querySelector('#sgd-story-rows')).toBeNull()
  },
}
