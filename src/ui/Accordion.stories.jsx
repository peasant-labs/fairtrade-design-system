import { expect, userEvent, within, waitFor } from 'storybook/test'
import Accordion from './Accordion.jsx'
import BrandMark from './BrandMark.jsx'
import { frame } from './story-frame.jsx'
import { ScrollText, Users, ShieldOff, Boxes } from 'lucide-react'

/* accordion story. CSF3: a Playground driven by argTypes plus one named story per
   meaningful state (single-open, multiple-open, default-open, empty). classes + tokens
   come from src/index.css via .storybook/preview.jsx; the theme toolbar flips data-theme.
   the SingleOpen story carries a play() interaction test (open a closed header, assert its
   region shows + the previously-open one collapses). */

const items = [
  {
    id: 'transcript',
    title: 'transcript',
    icon: ScrollText,
    content: 'a full session with claude-code, redacted and published to the commons. 1,204 turns, 3 attached files.',
  },
  {
    id: 'collective',
    title: 'collective',
    icon: Users,
    content: 'shared by the harvest-moon collective. members vote before a transcript leaves the queue.',
  },
  {
    id: 'redaction',
    title: 'redaction',
    icon: ShieldOff,
    content: 'api keys, emails and tokens are masked before publish. nothing leaves the namespace unscrubbed.',
  },
  {
    id: 'providers',
    title: 'providers',
    // a category icon (not a single company) keeps every header on the same icon -> title ->
    // chevron grid; the real brand marks for the named providers live in the body content below.
    icon: Boxes,
    content: (
      <span>
        sourced from <BrandMark name="claude" /> claude-code and <BrandMark name="gemini" /> gemini-cli.
        provider attribution stays attached to every turn.
      </span>
    ),
  },
]

const meta = {
  title: 'components/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  decorators: frame('panel'),
  argTypes: {
    allowMultiple: { control: 'boolean' },
    defaultOpen: { control: 'text' },
    'aria-label': { control: 'text' },
    items: { control: false },
  },
  args: {
    items,
    allowMultiple: false,
    'aria-label': 'transcript details',
  },
}
export default meta

export const Playground = {}

export const SingleOpen = {
  args: { defaultOpen: 'transcript', allowMultiple: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // seeded-open item: header expanded, its region visible.
    const openTrigger = canvas.getByRole('button', { name: /transcript/i })
    expect(openTrigger).toHaveAttribute('aria-expanded', 'true')
    expect(canvas.getByRole('region', { name: /transcript/i })).toBeVisible()

    // a closed header: collapsed, region hidden (not in the a11y tree).
    const closedTrigger = canvas.getByRole('button', { name: /redaction/i })
    expect(closedTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(canvas.queryByRole('region', { name: /redaction/i })).toBeNull()

    // open the closed header.
    await userEvent.click(closedTrigger)

    // its region becomes visible + expanded.
    await waitFor(() => {
      expect(closedTrigger).toHaveAttribute('aria-expanded', 'true')
    })
    expect(canvas.getByRole('region', { name: /redaction/i })).toBeVisible()

    // single-open mode: the previously-open item collapsed.
    expect(openTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(canvas.queryByRole('region', { name: /transcript/i })).toBeNull()
  },
}

export const Multiple = {
  args: { allowMultiple: true, defaultOpen: ['transcript', 'redaction'] },
}

export const AllClosed = {
  args: { defaultOpen: undefined },
}

export const Empty = {
  args: { items: [], 'aria-label': 'no details' },
}

// headingLevel sets the real heading element each item header renders as, so the
// accordion slots into the surrounding document outline (here h2 under a page h1).
export const HeadingLevelTwo = {
  args: { headingLevel: 2, defaultOpen: 'transcript' },
}

// interactive content inside an open panel: arrow keys must move the caret / act on
// the link, NOT roam the headers (the group handler bails when focus is not on a header).
const interactiveItems = [
  {
    id: 'transcript',
    title: 'transcript',
    icon: ScrollText,
    content: (
      <span>
        <a href="#open">open transcript</a>. 1,204 turns, redacted and published to the commons.
      </span>
    ),
  },
  {
    id: 'collective',
    title: 'collective',
    icon: Users,
    content: 'shared by the harvest-moon collective. members vote before a transcript leaves the queue.',
  },
]

export const InteractiveContent = {
  args: { items: interactiveItems, defaultOpen: 'transcript', 'aria-label': 'transcript details' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // focus the link inside the open panel, then press ArrowDown.
    const link = canvas.getByRole('link', { name: /open transcript/i })
    link.focus()
    expect(link).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')

    // header roaming did NOT fire: focus stays on the link, headers keep their state.
    expect(link).toHaveFocus()
    const firstHeader = canvas.getByRole('button', { name: /transcript/i })
    expect(firstHeader).toHaveAttribute('aria-expanded', 'true')
  },
}
