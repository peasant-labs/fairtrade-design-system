import { expect, userEvent, within, waitFor } from 'storybook/test'
import ToastProvider, { useToast } from './ToastHost.jsx'

/* toast host story. CSF3: a Playground driven by argTypes plus one named story per
   meaningful state (success, error, stacked, max cap, sticky, placements, reduced-motion,
   pause-on-hover). because the api is imperative, each story renders a tiny <Demo/> that
   wraps <ToastProvider> around a button bar bound to useToast(). classes + tokens come
   from src/index.css via .storybook/preview.jsx; the theme toolbar flips data-theme.
   the host is pinned in-frame (inline variant, position:absolute) so toasts land inside
   the decorator card rather than the page corner, giving axe + the play() tests a target.
   play() asserts on text presence / the [data-state] attribute, never an instant
   toBeVisible() (the enter animation starts at opacity 0); auto-dismiss is checked with a
   generous real-time waitFor, not a wall-clock 5s. */

/** a button bar bound to useToast(); reused by every story. */
function Bar({ duration }) {
  const toast = useToast()
  return (
    <div className="btn-row">
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => toast.ok('shared to the claude-code collective.', { title: 'transcript published' })}
      >
        publish
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => toast.err('2 names still exposed in the gemini-cli session.', { title: 'redaction failed' })}
      >
        retry
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          toast.ok('first transcript queued.', { title: 'queued' })
          toast.ok('second transcript queued.', { title: 'queued' })
          toast.ok('third transcript queued.', { title: 'queued' })
        }}
      >
        stack 3
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => toast.dismissAll()}>
        dismiss all
      </button>
    </div>
  )
}

function Demo({ placement = 'bottom-right', max = 4, duration = 5000 }) {
  return (
    <ToastProvider placement={placement} max={max} duration={duration} inline>
      <Bar duration={duration} />
    </ToastProvider>
  )
}

const meta = {
  title: 'feedback/ToastHost',
  component: ToastProvider,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ minHeight: 320, position: 'relative' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    placement: {
      control: 'select',
      options: ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'bottom-center', 'top-center'],
    },
    max: { control: { type: 'number', min: 1, max: 8 } },
    duration: { control: { type: 'number', min: 0, max: 20000, step: 500 } },
  },
  args: { placement: 'bottom-right', max: 4, duration: 5000 },
  render: (args) => <Demo {...args} />,
}
export default meta

export const Playground = {}

export const Success = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'publish' }))
    // assert on text presence + the live item node, not an instant toBeVisible().
    await waitFor(() => expect(canvas.getByText(/shared to the claude-code collective/i)).toBeInTheDocument())
    const item = canvasElement.querySelector('.tsx-item')
    expect(item).toHaveAttribute('data-state', 'enter')
    // an ok toast rides the polite region as role=status (from the inner .fb-toast).
    expect(canvas.getByRole('status')).toBeInTheDocument()
  },
}

export const Error = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(canvas.getByText(/2 names still exposed/i)).toBeInTheDocument())
    // an err item adds role=alert on its own node so it is announced assertively.
    await waitFor(() => expect(canvas.getAllByRole('alert').length).toBeGreaterThan(0))
  },
}

export const Stacked = {
  args: { duration: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const fire = canvas.getByRole('button', { name: 'stack 3' })
    await userEvent.click(fire)
    // three sticky toasts coexist in the gap stack.
    await waitFor(() => expect(canvasElement.querySelectorAll('.tsx-item').length).toBe(3))
  },
}

export const MaxCap = {
  args: { max: 2, duration: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const publish = canvas.getByRole('button', { name: 'publish' })
    await userEvent.click(publish)
    await userEvent.click(publish)
    await userEvent.click(publish)
    await userEvent.click(publish)
    // max=2: the front drops as new ones arrive; the live (non-leaving) count stays <= 2.
    await waitFor(() => {
      const live = canvasElement.querySelectorAll('.tsx-item:not([data-state="leave"])')
      expect(live.length).toBeLessThanOrEqual(2)
    })
  },
}

export const Sticky = {
  args: { duration: Infinity },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'publish' }))
    await waitFor(() => expect(canvasElement.querySelector('.tsx-item')).toBeInTheDocument())
    // a sticky toast has no auto-dismiss; only the X removes it.
    const close = await waitFor(() => canvas.getByRole('button', { name: 'dismiss notification' }))
    await userEvent.click(close)
    await waitFor(() => expect(canvasElement.querySelector('.tsx-item')).toBeNull())
  },
}

export const Placements = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((p) => (
        <div key={p} style={{ position: 'relative', minHeight: 180, border: '1px solid var(--rule)' }}>
          <ToastProvider placement={p} duration={0} inline>
            <div style={{ padding: 16 }}>
              <span className="specimen-cap">{p}</span>
            </div>
            <Corner placement={p} />
          </ToastProvider>
        </div>
      ))}
    </div>
  ),
}

function Corner({ placement }) {
  const toast = useToast()
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      style={{ margin: 16 }}
      onClick={() => toast.ok(`pinned to ${placement}.`, { title: 'placement' })}
    >
      fire
    </button>
  )
}

export const ReducedMotion = {
  parameters: {
    docs: {
      description: {
        story:
          'enter and exit motion lives only inside @media (prefers-reduced-motion: no-preference); under reduce, toasts appear and disappear instantly with no transform.',
      },
    },
  },
}

export const PausesOnHover = {
  args: { duration: 800 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'publish' }))
    const item = await waitFor(() => canvasElement.querySelector('.tsx-item'))
    expect(item).toBeInTheDocument()
    // hover the host: the auto-dismiss timer pauses, so past the 800ms duration the
    // toast is still present (a slow reader is never timed out mid-read).
    await userEvent.hover(item)
    await new Promise((r) => setTimeout(r, 1100))
    expect(canvasElement.querySelector('.tsx-item')).toBeInTheDocument()
    // leaving resumes the timer; the toast then dismisses.
    await userEvent.unhover(item)
    await waitFor(() => expect(canvasElement.querySelector('.tsx-item')).toBeNull(), { timeout: 3000 })
  },
}
