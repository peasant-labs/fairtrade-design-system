import { expect, userEvent, within, waitFor } from 'storybook/test'
import Tabs from './Tabs.jsx'

/* CSF3 story for the ARIA tablist. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. */

const transcriptTabs = [
  {
    id: 'transcripts',
    label: 'transcripts',
    count: 42,
    content: (
      <p>
        shared transcripts from the commons — debugging sessions with claude-code,
        scaffolding runs through gemini-cli, and pair-programming logs.
      </p>
    ),
  },
  {
    id: 'collectives',
    label: 'collectives',
    count: 7,
    content: (
      <p>
        worker-owned collectives curating and redacting transcripts before they
        enter the fairtrade pool.
      </p>
    ),
  },
  {
    id: 'providers',
    label: 'providers',
    count: 3,
    content: (
      <p>
        upstream providers: claude-code, gemini-cli, and codex — each with its own
        consent and revenue-share terms.
      </p>
    ),
  },
]

const meta = {
  title: 'components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  argTypes: {
    defaultTab: {
      control: 'inline-radio',
      options: ['transcripts', 'collectives', 'providers'],
    },
    'aria-label': { control: 'text' },
    tabs: { control: false },
  },
  args: {
    tabs: transcriptTabs,
    'aria-label': 'commons sections',
  },
}
export default meta

export const Playground = {}

export const SecondSelected = {
  args: { defaultTab: 'collectives' },
}

export const NoCounts = {
  args: {
    tabs: [
      { id: 'overview', label: 'overview', content: <p>what the commons is, in one paragraph.</p> },
      { id: 'consent', label: 'consent', content: <p>how contributors grant and revoke consent.</p> },
      { id: 'redaction', label: 'redaction', content: <p>how pii is stripped before publishing.</p> },
    ],
  },
}

export const TwoTabs = {
  args: {
    tabs: [
      { id: 'raw', label: 'raw', count: 128, content: <p>unredacted transcripts awaiting review.</p> },
      { id: 'published', label: 'published', count: 90, content: <p>redacted transcripts live in the pool.</p> },
    ],
    'aria-label': 'review queue',
  },
}

export const Interaction = {
  args: { defaultTab: 'transcripts' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const transcriptsTab = canvas.getByRole('tab', { name: /transcripts/i })
    const collectivesTab = canvas.getByRole('tab', { name: /collectives/i })
    const providersTab = canvas.getByRole('tab', { name: /providers/i })

    // initial state: first tab selected, its panel shown. assert the component's actual
    // show/hide mechanism (the `hidden` attribute) + correct content, NOT animated
    // visibility: the shown panel runs the tabIn entrance (opacity 0 -> 1) so an instant
    // toBeVisible would race the animation. role=tabpanel matches only the non-hidden panel.
    await expect(transcriptsTab).toHaveAttribute('aria-selected', 'true')
    await expect(collectivesTab).toHaveAttribute('aria-selected', 'false')
    const initialPanel = canvas.getByRole('tabpanel')
    await expect(initialPanel).not.toHaveAttribute('hidden')
    await expect(initialPanel).toHaveAttribute('aria-labelledby', transcriptsTab.id)
    await expect(within(initialPanel).getByText(/shared transcripts from the commons/i)).toBeInTheDocument()

    // click the 2nd tab
    await userEvent.click(collectivesTab)

    // selection moved to the 2nd tab
    await waitFor(() => expect(collectivesTab).toHaveAttribute('aria-selected', 'true'))
    await expect(transcriptsTab).toHaveAttribute('aria-selected', 'false')
    await expect(providersTab).toHaveAttribute('aria-selected', 'false')

    // the now-shown panel is the collectives one (the only non-hidden tabpanel)
    const collectivesPanel = canvas.getByRole('tabpanel')
    await expect(collectivesPanel).not.toHaveAttribute('hidden')
    await expect(collectivesPanel).toHaveAttribute('aria-labelledby', collectivesTab.id)
    await expect(within(collectivesPanel).getByText(/worker-owned collectives/i)).toBeInTheDocument()

    // the other two panels exist in the DOM but are hidden
    const allPanels = canvasElement.querySelectorAll('.tabpanel')
    await expect(allPanels).toHaveLength(3)
    const hiddenPanels = canvasElement.querySelectorAll('.tabpanel[hidden]')
    await expect(hiddenPanels).toHaveLength(2)
  },
}
