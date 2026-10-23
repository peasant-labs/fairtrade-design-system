import { expect, userEvent, within, waitFor } from 'storybook/test'
import { CliSteps, CommandBlock, GettingStarted } from './CliOnboard.jsx'
import { frame } from './story-frame.jsx'

/* CliOnboard stories. CSF3 under 'in use/' — a CLI-onboarding step list + a dismissible getting-
   started card, modeled on the peasant/village publish onboarding (numbered square markers + copy-
   able `$ command` blocks). The step number marker carries the scarce amber accent; the copy button
   flips to an olive check + the word "copied" (never colour-only). Commands are LITERAL — their case
   is preserved; only the chrome is lowercase. classes + tokens come from CliOnboard.css (imported by
   the component) and src/index.css via .storybook/preview.jsx; the theme toolbar flips data-theme.
   The CommandBlock play() copies the command and asserts the "copied" state appears. */

/* The real peasant getting-started flow: install, ingest, open the dashboard, contribute upstream. */
const PEASANT_STEPS = [
  {
    title: 'install',
    body: 'Install the peasant CLI with Homebrew. It runs entirely on this machine. Nothing is uploaded until you choose to.',
    command: 'brew install peasant-labs/tap/peasant',
  },
  {
    title: 'ingest your transcripts',
    body: 'Scan this computer for your AI coding conversations (Claude Code, Codex, and others) and record them locally.',
    command: 'peasant ingest',
  },
  {
    title: 'open the dashboard',
    body: 'Launch the terminal dashboard to browse what was found, review each session, and set its redaction level.',
    command: 'peasant tui',
  },
  {
    title: 'contribute to the commons',
    body: 'Push the transcripts you have approved to the village, with redaction applied. You stay in control of what leaves.',
    command: 'peasant village push',
  },
]

const meta = {
  title: 'in use/CliOnboard',
  component: CliSteps,
  decorators: frame('panel'),
  parameters: { layout: 'centered' },
}

export default meta

/* The numbered step list on its own — the four-step peasant flow. */
export const Steps = {
  render: () => <CliSteps steps={PEASANT_STEPS} />,
}

/* A single `$ command` block. The play() clicks copy and asserts the "copied" state appears. */
export const Command = {
  render: () => <CommandBlock command="peasant village push" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // headless chrome has no clipboard permission, so the real writeText rejects and the success path
    // (the "copied" flip) never runs. stub a resolving clipboard so the interaction is testable; the
    // component itself already no-throws when the api is absent.
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      })
    } catch {
      /* some envs lock navigator.clipboard; the component's no-throw fallback still keeps the page alive */
    }
    // The clipboard write may resolve async; the button name + word flip to "copied" on success.
    const copy = canvas.getByRole('button', { name: /copy peasant village push/i })
    await userEvent.click(copy)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: /copied peasant village push/i })).toBeInTheDocument(),
    )
    // The visible word, not just the colour, carries the state.
    await waitFor(() => expect(canvas.getByText('copied')).toBeInTheDocument())
  },
}

/* A long command on a phone: `wrap` breaks at spaces and inside the URL instead of scrolling, and
   `compact` draws the copy button as its icon alone. The default (no wrap) scrolls sideways in a
   focusable, named region. */
const LONG = 'powershell -ExecutionPolicy Bypass -c "irm https://peasantlabs.org/install.ps1 | iex"'
export const WrappedCompact = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--sp-4)', width: 'min(100%, 358px)' }}>
      <CommandBlock command={LONG} wrap compact label="the windows install command" />
      <CommandBlock command="peasant village push --since 2026-01-01 --collective peasant-labs --event pull-request" wrap compact label="the push command" />
      <CommandBlock command={LONG} compact label="the windows install command" />
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'phone390',
      options: { phone390: { name: 'phone, 390', styles: { width: '390px', height: '780px' } } },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const regions = canvas.getAllByRole('region', { name: 'command: the windows install command' })
    await expect(regions).toHaveLength(1)
    await expect(regions[0]).toHaveAttribute('tabindex', '0')
    await expect(canvas.getAllByRole('button', { name: 'copy the windows install command' })).toHaveLength(2)
    // wrapped, a token is never split after a hyphen: each flag and date stays on one line
    for (const token of canvasElement.querySelectorAll('.cli-tok')) {
      const line = parseFloat(getComputedStyle(token).lineHeight)
      if (token.textContent.length < 24) await expect(token.getBoundingClientRect().height).toBeLessThan(line * 1.5)
    }
  },
}

/* The dismissible getting-started card wrapping the step list. */
export const GettingStartedCard = {
  render: () => (
    <GettingStarted
      title="getting started"
      steps={PEASANT_STEPS}
      storageKey="cli-onboard:story:getting-started-dismissed"
    />
  ),
}
