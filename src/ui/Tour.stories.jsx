import { useRef, useState } from 'react'
import { expect, userEvent, within, waitFor, screen } from 'storybook/test'
import Tour from './Tour.jsx'

/* ───────────────────────────────────────────────────────────────────────────
   Tour — "in use" guided-tour / spotlight coachmark, modeled on peasant's
   TourProvider / TourOverlay.

   each story renders real placeholder target boxes on a scene, gives them ids,
   and points the tour's steps at those ids. opening the tour dims the scene
   except for a square cut-out around the current target, with a coachmark beside
   it; back / next / done + progress dots drive the step. the play() opens the
   tour, asserts the first step, advances with "next", and asserts the step
   actually changed (new title + the "step 2 of 3" eyebrow). tokens + classes come
   from Tour.css. ───────────────────────────────────────────────────────────── */
const meta = {
  title: 'in use/Tour',
  component: Tour,
  parameters: { layout: 'fullscreen' },
}
export default meta

/* the three placeholder targets the tour spotlights. plain bordered boxes laid
   out across the scene so each step's cut-out lands somewhere different. */
const TARGETS = [
  { id: 'tour-target-search', label: 'search', hint: 'find anything across the commons' },
  { id: 'tour-target-compose', label: 'compose', hint: 'start a new contribution' },
  { id: 'tour-target-account', label: 'account', hint: 'your identity & consents' },
]

const STEPS = [
  {
    anchorId: 'tour-target-search',
    title: 'search the commons',
    body: (
      <>
        start here. <span className="tour-mono">search</span> spans every collective you can
        see (transcripts, decisions, contributions) without revealing who&apos;s asking.
      </>
    ),
  },
  {
    anchorId: 'tour-target-compose',
    title: 'compose a contribution',
    body: (
      <>
        when you&apos;re ready to give something back, <span className="tour-mono">compose</span>{' '}
        opens a draft. nothing crosses a boundary until you explicitly consent.
      </>
    ),
  },
  {
    anchorId: 'tour-target-account',
    title: 'your account',
    body: (
      <>
        <span className="tour-mono">account</span> is where your identity and every consent you&apos;ve
        granted live: review, revoke, or stay anon at any time.
      </>
    ),
  },
]

/* the scene: a toolbar of placeholder targets + a "take the tour" trigger, with a
   stateful wrapper so the tour can open / close and report which step ended it. */
function Scene({ steps = STEPS, autoLabel = 'take the tour' }) {
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const triggerRef = useRef(null)

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: 'var(--canvas)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          paddingBottom: 32,
        }}
      >
        {TARGETS.map((t) => (
          <div
            key={t.id}
            id={t.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 180,
              padding: '14px 16px',
              border: 'var(--bd)',
              background: 'var(--surface-2)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-label)',
                textTransform: 'lowercase',
                color: 'var(--ink)',
              }}
            >
              {t.label}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-sm)',
                color: 'var(--ink-3)',
              }}
            >
              {t.hint}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        ref={triggerRef}
        className="btn btn-primary"
        onClick={() => { setOutcome(null); setOpen(true) }}
      >
        {autoLabel}
      </button>

      {outcome && (
        <p style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--ink-3)' }}>
          {outcome}
        </p>
      )}

      <Tour
        steps={steps}
        open={open}
        onClose={() => { setOpen(false); setOutcome('tour skipped'); triggerRef.current?.focus() }}
        onFinish={() => { setOpen(false); setOutcome('tour finished'); triggerRef.current?.focus() }}
      />
    </div>
  )
}

/* ── 1. default: three steps, working back / next / done + progress dots ─────── */
export const Default = {
  name: 'default (3-step spotlight)',
  render: () => <Scene />,
  play: async ({ canvasElement, step }) => {
    const canvas = screen // Tour portals to document.body, so query the whole document
    const trigger = canvas.getByRole('button', { name: /take the tour/i })

    await step('open the tour onto the first anchor', async () => {
      await userEvent.click(trigger)
      const dialog = await canvas.findByRole('dialog')
      await expect(dialog).toHaveAttribute('aria-modal', 'true')
      // first step: title + eyebrow.
      await expect(canvas.getByText(/search the commons/i)).toBeInTheDocument()
      await expect(canvas.getByText(/step 1 of 3/i)).toBeInTheDocument()
      // focus is inside the coachmark (the primary action).
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    })

    await step('next advances to step 2: the step actually changed', async () => {
      await expect(canvas.queryByText(/compose a contribution/i)).not.toBeInTheDocument()
      await userEvent.click(canvas.getByRole('button', { name: /^next$/i }))
      await waitFor(() => expect(canvas.getByText(/step 2 of 3/i)).toBeInTheDocument())
      await expect(canvas.getByText(/compose a contribution/i)).toBeInTheDocument()
      await expect(canvas.queryByText(/search the commons/i)).not.toBeInTheDocument()
    })

    await step('back returns to step 1', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /^back$/i }))
      await waitFor(() => expect(canvas.getByText(/step 1 of 3/i)).toBeInTheDocument())
      await expect(canvas.getByRole('button', { name: /^back$/i })).toBeDisabled()
    })
  },
}

/* ── 2. last step shows "done" and finishes the tour ─────────────────────────── */
export const ReachesDone = {
  name: 'reaches done (finish)',
  render: () => <Scene />,
  play: async ({ canvasElement, step }) => {
    const canvas = screen // Tour portals to document.body, so query the whole document
    await userEvent.click(canvas.getByRole('button', { name: /take the tour/i }))
    await canvas.findByRole('dialog')

    await step('advance through to the last step', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /^next$/i }))
      await waitFor(() => expect(canvas.getByText(/step 2 of 3/i)).toBeInTheDocument())
      await userEvent.click(canvas.getByRole('button', { name: /^next$/i }))
      await waitFor(() => expect(canvas.getByText(/step 3 of 3/i)).toBeInTheDocument())
    })

    await step('done finishes and closes the tour', async () => {
      const done = canvas.getByRole('button', { name: /^done$/i })
      await expect(done).toBeInTheDocument()
      await userEvent.click(done)
      await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
      await expect(canvas.getByText(/tour finished/i)).toBeInTheDocument()
    })
  },
}

/* ── 3. esc / skip dismisses and returns focus to the trigger ────────────────── */
export const SkipWithEsc = {
  name: 'skip (esc closes)',
  render: () => <Scene />,
  play: async ({ canvasElement, step }) => {
    const canvas = screen // Tour portals to document.body, so query the whole document
    const trigger = canvas.getByRole('button', { name: /take the tour/i })

    await step('esc dismisses the tour and restores focus', async () => {
      await userEvent.click(trigger)
      await canvas.findByRole('dialog')
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
      await expect(canvas.getByText(/tour skipped/i)).toBeInTheDocument()
      await waitFor(() => expect(trigger).toHaveFocus())
    })
  },
}
