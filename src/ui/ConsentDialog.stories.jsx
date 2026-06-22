import { useRef, useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import { Eye, Users, Globe, Share2, FileText, Archive, UserCheck, LogOut } from 'lucide-react'
import ConsentDialog, { ConsentSummary } from './ConsentDialog.jsx'

/* ───────────────────────────────────────────────────────────────────────────
   ConsentDialog — "in use" governance dialogs, modeled on village's
   JoinConsentDialog / ConfirmContributeDialog / LeaveCollectiveDialog.

   each story states what crosses the boundary, to whom, before an irreversible-
   ish confirm. every story uses a small stateful wrapper with a real trigger
   <button> so the play() can open the dialog, exercise the consent gate (the
   amber primary stays disabled until "i understand and consent" is ticked), then
   confirm or escape. the _static variants render the dialog already open for the
   visual suite. classes + tokens come from ConsentDialog.css. ───────────────── */
const meta = {
  title: 'in use/ConsentDialog',
  component: ConsentDialog,
  parameters: { layout: 'fullscreen' },
}
export default meta

/* a trigger + dialog wrapper. focus returns to the trigger on close. */
function Demo({ triggerLabel, triggerClass = 'btn btn-secondary', ...dialogProps }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(null)
  const triggerRef = useRef(null)
  return (
    <div style={{ padding: 24 }}>
      <button type="button" ref={triggerRef} className={triggerClass} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
      {done && (
        <p style={{ marginTop: 12 }} className="cns-list-more">{done}</p>
      )}
      <ConsentDialog
        {...dialogProps}
        open={open}
        returnFocusRef={triggerRef}
        onCancel={() => setOpen(false)}
        onConfirm={() => { setOpen(false); setDone(dialogProps.doneNote ?? 'confirmed') }}
      />
    </div>
  )
}

/* ── 1. join: identity-reveal, owners-only scope ─────────────────────────────
   joining reveals your profile to OWNERS ONLY so they can review membership;
   other members still see you as anon. */
const JOIN_AXES = [
  {
    icon: Eye,
    tone: 'reveal',
    key: 'identity',
    value: (
      <>your profile — <span className="cns-mono">handle</span>, name &amp; avatar — becomes visible</>
    ),
    scope: 'to owners only, to review membership',
  },
  {
    icon: Users,
    key: 'to other members',
    value: <>you still appear as <span className="cns-mono">anon</span></>,
    scope: 'no handle, name, or avatar shown',
  },
]

export const Join = {
  name: 'join (identity reveal)',
  render: () => (
    <Demo
      triggerLabel="join collective"
      triggerClass="btn btn-primary"
      labelId="cns-join-title"
      title={<>join <span className="cns-name">soil-and-syntax</span>?</>}
      intro={
        <>
          <p>
            you&apos;re currently <span className="cns-em">not discoverable</span>, so your handle is
            hidden across the commons.
          </p>
          <p>
            joining reveals your profile to the collective&apos;s <span className="cns-em">owners</span> —
            they need it to review your membership and contributions. other members still see you as anon.
          </p>
        </>
      }
      axes={JOIN_AXES}
      summaryCaption="what crosses the boundary"
      consentLabel="i understand and consent to revealing my profile to owners"
      confirmLabel="reveal profile & join"
      confirmIcon={UserCheck}
      doneNote="joined — profile revealed to owners"
    />
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /join collective/i })

    await step('open the dialog; focus lands inside', async () => {
      await userEvent.click(trigger)
      const dialog = await canvas.findByRole('dialog')
      await expect(dialog).toHaveAttribute('aria-modal', 'true')
      await expect(dialog).toHaveAttribute('aria-labelledby', 'cns-join-title')
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    })

    await step('primary is gated until consent is given', async () => {
      const confirm = canvas.getByRole('button', { name: /reveal profile & join/i })
      await expect(confirm).toBeDisabled()
      const consent = canvas.getByRole('checkbox')
      await userEvent.click(consent)
      await expect(confirm).toBeEnabled()
    })

    await step('escape closes and restores focus to the trigger', async () => {
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
      await waitFor(() => expect(trigger).toHaveFocus())
    })
  },
}

/* ── 2. contribute: private → shared, N transcripts → collective ─────────────
   transcripts are private by default; contributing flips private → shared and
   makes them browsable per the collective's data-access policy. */
const CONTRIBUTE_TRANSCRIPTS = [
  'refactor: extract the retry policy',
  'debugging the streaming tool-call parser',
  'why does the migration drop the index?',
  'pairing on the consent dialog focus trap',
  'designing the retention policy schema',
  'reviewing the commons license draft',
]

export const Contribute = {
  name: 'contribute (private → shared)',
  render: () => {
    const listed = CONTRIBUTE_TRANSCRIPTS.slice(0, 5)
    const remaining = CONTRIBUTE_TRANSCRIPTS.length - listed.length
    return (
      <Demo
        triggerLabel="contribute transcripts"
        triggerClass="btn btn-primary"
        labelId="cns-contribute-title"
        title={<>make {CONTRIBUTE_TRANSCRIPTS.length} transcripts visible?</>}
        intro={
          <p>
            {CONTRIBUTE_TRANSCRIPTS.length} private transcripts will become visible to members of{' '}
            <span className="cns-name">soil-and-syntax</span>. their visibility changes from{' '}
            <span className="cns-mono">private</span> to <span className="cns-mono">shared</span>.
          </p>
        }
        axes={[
          {
            icon: Share2,
            tone: 'reveal',
            key: 'contribution',
            value: <>flips <span className="cns-mono">private</span> → <span className="cns-mono">shared</span></>,
            scope: 'the full turn-by-turn record is shared',
          },
          {
            icon: Globe,
            tone: 'open',
            key: 'data access',
            value: 'contributors — anyone who contributes can browse',
            scope: 'this collective’s policy',
          },
        ]}
        summaryCaption="what crosses the boundary"
        consentLabel="i understand and consent to sharing these transcripts"
        confirmLabel="contribute & make visible"
        confirmIcon={Share2}
        doneNote="contributed — visibility flipped to shared"
      >
        <div className="cns-list">
          <p className="cns-list-cap">transcripts ({CONTRIBUTE_TRANSCRIPTS.length})</p>
          <ul>
            {listed.map((t) => (
              <li key={t}>
                <span className="cns-list-name">{t}</span>
                <FileText size={14} aria-hidden="true" style={{ flex: 'none', color: 'var(--ink-3)' }} />
              </li>
            ))}
            {remaining > 0 && (
              <li><span className="cns-list-more">…and {remaining} more</span></li>
            )}
          </ul>
        </div>
      </Demo>
    )
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /contribute transcripts/i })

    await step('open and confirm the flow end to end', async () => {
      await userEvent.click(trigger)
      await canvas.findByRole('dialog')
      const confirm = canvas.getByRole('button', { name: /contribute & make visible/i })
      await expect(confirm).toBeDisabled()
      await userEvent.click(canvas.getByRole('checkbox'))
      await expect(confirm).toBeEnabled()
      await userEvent.click(confirm)
      await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
    })
  },
}

/* ── 3. leave: retention policy choice ───────────────────────────────────────
   leaving loses member access; retention on leave is either each leaving member
   decides (user_choice, a real checkbox) or auto-retracted (mandatory, stated as
   fixed). this story shows the user_choice path with its retract checkbox. */
function LeaveDemo() {
  const [open, setOpen] = useState(false)
  const [retract, setRetract] = useState(false)
  const [done, setDone] = useState(null)
  const triggerRef = useRef(null)
  const shareCount = 12
  return (
    <div style={{ padding: 24 }}>
      <button type="button" ref={triggerRef} className="btn btn-danger" onClick={() => { setRetract(false); setOpen(true) }}>
        leave collective
      </button>
      {done && <p style={{ marginTop: 12 }} className="cns-list-more">{done}</p>}
      <ConsentDialog
        open={open}
        returnFocusRef={triggerRef}
        labelId="cns-leave-title"
        tone="danger"
        title={<>leave <span className="cns-name">soil-and-syntax</span>?</>}
        intro={
          <p>
            you&apos;ll lose member access to <span className="cns-name">soil-and-syntax</span>. you can
            rejoin later if the collective is open.
          </p>
        }
        axes={[
          {
            icon: LogOut,
            tone: 'restricted',
            key: 'access',
            value: 'member access is removed',
            scope: 'rejoin later if the collective stays open',
          },
          {
            icon: Archive,
            key: 'retention',
            value: 'each leaving member decides',
            scope: 'user_choice — your call below',
          },
        ]}
        summaryCaption="what crosses the boundary"
        consentLabel="i understand i will lose member access"
        confirmLabel={retract ? 'leave & retract' : 'leave collective'}
        confirmIcon={LogOut}
        onCancel={() => setOpen(false)}
        onConfirm={() => { setOpen(false); setDone(retract ? `left — ${shareCount} transcripts retracted` : 'left — contributions kept in the collective') }}
      >
        <div className="cns-list">
          <p className="cns-list-cap">your contributions</p>
          <ul>
            <li>
              <span className="cns-list-name">
                you&apos;ve contributed <span className="cns-mono" style={{ color: 'var(--ink)' }}>{shareCount}</span> transcripts to this collective
              </span>
            </li>
          </ul>
        </div>
        <label className="cns-consent">
          <input
            type="checkbox"
            className="cns-consent-box"
            checked={retract}
            onChange={(e) => setRetract(e.target.checked)}
          />
          <span className="cns-consent-label">
            also retract my transcripts — they stay in your library, just unshared from soil-and-syntax
          </span>
        </label>
      </ConsentDialog>
    </div>
  )
}

export const Leave = {
  name: 'leave (retention choice)',
  render: () => <LeaveDemo />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /leave collective/i })

    await step('open; the retract choice toggles the confirm copy', async () => {
      await userEvent.click(trigger)
      // scope to the dialog: the page trigger is ALSO named "leave collective", so query inside.
      const dialog = within(await canvas.findByRole('dialog'))
      // two checkboxes: [0] the retract policy choice, [1] the consent gate.
      const boxes = dialog.getAllByRole('checkbox')
      await expect(boxes).toHaveLength(2)
      await expect(dialog.getByRole('button', { name: /^leave collective$/i })).toBeDisabled()
      await userEvent.click(boxes[0])
      await expect(canvas.getByRole('button', { name: /leave & retract/i })).toBeInTheDocument()
    })

    await step('consent gate enables the danger primary', async () => {
      const boxes = canvas.getAllByRole('checkbox')
      await userEvent.click(boxes[1])
      await expect(canvas.getByRole('button', { name: /leave & retract/i })).toBeEnabled()
    })

    await step('escape closes', async () => {
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
    })
  },
}

/* ── the bare ConsentSummary specimen ────────────────────────────────────────
   the reusable axes block on its own, showing all four governance axes at once
   so the aligned-columns layout reads without the surrounding dialog. */
export const Summary = {
  name: 'summary (axes block)',
  render: () => (
    <div style={{ padding: 24, maxWidth: 460 }}>
      <ConsentSummary
        caption="governance axes"
        axes={[
          {
            icon: Eye,
            tone: 'reveal',
            key: 'identity',
            value: <>profile revealed to <span className="cns-mono">owners</span></>,
            scope: 'others still see you as anon',
          },
          {
            icon: Globe,
            tone: 'open',
            key: 'data access',
            value: 'public — anyone can browse the dataset',
            scope: 'no membership required',
          },
          {
            icon: Share2,
            tone: 'reveal',
            key: 'contribution',
            value: <><span className="cns-mono">private</span> → <span className="cns-mono">shared</span></>,
            scope: 'the full record is shared',
          },
          {
            icon: Archive,
            tone: 'restricted',
            key: 'retention',
            value: 'mandatory — auto-retracted on leave',
            scope: 'set by the collective',
          },
        ]}
      />
    </div>
  ),
}

/* ── static (already-open) variants for the visual suite ─────────────────────
   render the dialog open with no trigger so the snapshot captures the real
   chrome (head / body / foot, scrim, summary, gate, footer). */
export const JoinStatic = {
  name: 'join (static)',
  render: () => (
    <ConsentDialog
      open
      onCancel={() => {}}
      onConfirm={() => {}}
      labelId="cns-join-static"
      title={<>join <span className="cns-name">soil-and-syntax</span>?</>}
      intro={
        <p>
          joining reveals your profile to the collective&apos;s <span className="cns-em">owners</span> only.
          other members still see you as anon.
        </p>
      }
      axes={JOIN_AXES}
      summaryCaption="what crosses the boundary"
      consentLabel="i understand and consent to revealing my profile to owners"
      confirmLabel="reveal profile & join"
      confirmIcon={UserCheck}
    />
  ),
}

export const LeaveStatic = {
  name: 'leave (static)',
  render: () => <LeaveDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /leave collective/i }))
    await canvas.findByRole('dialog')
  },
}
