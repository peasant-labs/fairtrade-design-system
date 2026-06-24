import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import { EvidenceCaption, EvidenceTarget } from './EvidenceCaption.jsx'
import { frame } from './story-frame.jsx'

/* EvidenceCaption story. CSF3, title 'in use/EvidenceCaption'. the deterministic click-to-evidence
   recap, modeled on peasant's change-detail caption:

   - Default: a change recap built from fragments — the bracketed parts ([eager loader],
     [channel-backed stream], [one retry loop], [8 files]) are dotted-underline buttons that
     scroll-jump to the <EvidenceTarget> proof blocks rendered below, flashing the one they land on.
   - the play() clicks a fragment and asserts onJump fired with the right anchor (and that the
     destination is named to AT via the sr-only "jump to …" description).

   the recap is reading prose (var(--font-body), sentence case); the anchor eyebrows are chrome
   (mono, lowercased). ec-* rules + tokens live in EvidenceCaption.css (imported by the component). */

// the recap, as ordered fragments. plain fragments are prose; fragments with an anchorId are the
// clickable evidence links. `label` names the destination for AT (the sr-only "jump to <label>").
// three fragments point at #files (the files table) so one anchor can back several mentions.
const FRAGMENTS = [
  { text: 'Claude converted the' },
  { text: 'eager loader', anchorId: 'ec-files', label: 'the changed files' },
  { text: 'to a' },
  { text: 'channel-backed stream', anchorId: 'ec-diff', label: 'the diff' },
  { text: 'after' },
  { text: 'one retry loop', anchorId: 'ec-signals', label: 'the work signals' },
  { text: ', touching' },
  { text: '8 files', anchorId: 'ec-files', label: 'the changed files' },
  { text: '.' },
]

const meta = {
  title: 'in use/EvidenceCaption',
  component: EvidenceCaption,
  tags: ['autodocs'],
  decorators: frame('wide'),
  argTypes: {
    fragments: { control: false },
    onJump: { control: false },
  },
}
export default meta

// the recap + the three proof blocks it jumps to. each target owns the id a fragment points at and
// a mono eyebrow naming the evidence; clicking a fragment scrolls its target into view and flashes
// it. the spacer pushes the targets below the fold so the scroll-jump is observable in the canvas.
function CaptionDemo({ onJump, ...args }) {
  return (
    <div>
      <EvidenceCaption fragments={FRAGMENTS} onJump={onJump} {...args} />

      {/* a tall spacer so the evidence sits off-screen and the jump actually scrolls. */}
      <div style={{ height: '60vh' }} aria-hidden="true" />

      <EvidenceTarget id="ec-files" eyebrow="files">
        8 files changed across the loader and its callers. The table below lists each path with its
        added and removed line counts.
      </EvidenceTarget>

      <EvidenceTarget id="ec-diff" eyebrow="diff">
        The loader's synchronous fetch was replaced with a channel-backed stream: a producer goroutine
        feeds a buffered channel that the consumer ranges over, so back-pressure is bounded.
      </EvidenceTarget>

      <EvidenceTarget id="ec-signals" eyebrow="signals">
        One request took several attempts. The first stream returned a partial read, the retry loop
        re-opened the channel and completed cleanly. No other tasks needed a retry.
      </EvidenceTarget>
    </div>
  )
}

export const Default = {
  render: (args) => <CaptionDemo {...args} />,
  args: {
    onJump: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    // the recap reads as one sentence; the evidence parts are real buttons.
    expect(canvas.getByText(/Claude converted the/)).toBeInTheDocument()
    const eager = canvas.getByRole('button', { name: /eager loader/i })
    const stream = canvas.getByRole('button', { name: /channel-backed stream/i })

    // the destination is named to AT — the button's accessible name carries the "jump to …" text.
    expect(eager).toHaveAccessibleName(/jump to the changed files/i)
    expect(stream).toHaveAccessibleName(/jump to the diff/i)

    // clicking a fragment fires onJump with that fragment's anchor.
    await userEvent.click(stream)
    await waitFor(() => {
      expect(args.onJump).toHaveBeenCalledWith('ec-diff')
    })

    // the target it points at flashes — the data-ec-flash switch is set on arrival.
    const diff = canvasElement.querySelector('#ec-diff')
    await waitFor(() => {
      expect(diff).toHaveAttribute('data-ec-flash')
    })

    // a second fragment pointing at a different anchor jumps there too.
    await userEvent.click(canvas.getByRole('button', { name: /one retry loop/i }))
    await waitFor(() => {
      expect(args.onJump).toHaveBeenCalledWith('ec-signals')
    })
  },
}

export const LightTheme = {
  render: (args) => <CaptionDemo {...args} />,
  args: {
    onJump: fn(),
  },
  globals: { theme: 'light', backgrounds: { value: 'light' } },
}
