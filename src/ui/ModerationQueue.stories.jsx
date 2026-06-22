import { ModerationQueue, ApprovalBar } from './ModerationQueue.jsx'
import { frame } from './story-frame.jsx'
import { expect, userEvent, within, waitFor } from 'storybook/test'

/* ModerationQueue stories. CSF3 under 'in use/' — owner-facing approval queues modeled on village's
   PendingApprovalBar + the collective-hub pending-shares / pending-member-requests panels. Two
   exports share the file: ApprovalBar (a sticky one-item bar) and ModerationQueue (a panel of rows).
   classes + tokens come from ModerationQueue.css (imported by the component) and src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme.

   Handles, orgs and transcript titles are USER CONTENT — their case is preserved; only the chrome
   (labels, "approve"/"reject", relative time) is lowercase. MemberRequests carries a play() that
   clicks approve on a row and asserts it resolves to the "approved" pill in place (the row is not
   removed). */

// three people requesting to join a collective — handles + the org they're requesting from.
const MEMBER_REQUESTS = [
  { id: 'm1', kind: 'member', who: '@dinah-okafor', detail: 'Sequoia Robotics', when: '8m ago' },
  { id: 'm2', kind: 'member', who: '@yuki.tanaka', detail: 'Lattice AI', when: '1h ago' },
  { id: 'm3', kind: 'member', who: '@PriyaN', detail: 'Foundry Collective', when: '3h ago' },
]

// three transcripts awaiting curation into a collective — titles + who shared them.
const PENDING_SHARES = [
  {
    id: 's1',
    kind: 'share',
    who: 'Refactor the ingest loader',
    detail: 'shared by @marco-bellini',
    when: '12m ago',
  },
  {
    id: 's2',
    kind: 'share',
    who: 'Debug the SQLite pending store',
    detail: 'shared by @anaïs',
    when: '40m ago',
  },
  {
    id: 's3',
    kind: 'share',
    who: 'Wire the worker queue retry path',
    detail: 'shared by @t.okonkwo',
    when: 'yesterday',
  },
]

const meta = {
  title: 'in use/ModerationQueue',
  component: ModerationQueue,
  decorators: frame('panel'),
  parameters: { layout: 'centered' },
}

export default meta

// ── ModerationQueue — member requests ───────────────────────────────────────────────────────
export const MemberRequests = {
  render: () => (
    <ModerationQueue
      title="pending requests"
      items={MEMBER_REQUESTS}
      onApprove={() => {}}
      onReject={() => {}}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // first row starts actionable: an approve button is present.
    const approve = canvas.getAllByRole('button', { name: /approve/i })[0]
    expect(approve).toBeInTheDocument()

    // approve it.
    await userEvent.click(approve)

    // the row resolves OPTIMISTICALLY in place — an "approved" status pill appears (icon + word),
    // and the approve button is gone for that row.
    await waitFor(() => {
      expect(canvas.getByText('approved')).toBeVisible()
    })

    // the actor is NOT removed — the row stays as an audit trail.
    expect(canvas.getByText('@dinah-okafor')).toBeInTheDocument()

    // the pending count dropped from 3 to 2.
    expect(canvas.getByLabelText('2 pending')).toBeInTheDocument()
  },
}

// ── ModerationQueue — pending shares ─────────────────────────────────────────────────────────
export const PendingShares = {
  render: () => (
    <ModerationQueue
      title="pending review"
      items={PENDING_SHARES}
      onApprove={() => {}}
      onReject={() => {}}
    />
  ),
}

// ── ApprovalBar — sticky single-item bar ─────────────────────────────────────────────────────
export const ApprovalBarSticky = {
  decorators: frame('wide'),
  render: () => (
    <div>
      <ApprovalBar
        subject={
          <>
            pending share to <strong>Harvest Moon</strong>
          </>
        }
        onApprove={() => {}}
        onReject={() => {}}
      />
      <p
        style={{
          margin: 0,
          padding: 'var(--sp-5)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body)',
          color: 'var(--ink-2)',
          lineHeight: 1.6,
        }}
      >
        The bar sits sticky at the top of the transcript while you scroll. Approve folds it to an
        olive acknowledgement; reject folds it to a clay one — the action and the word stay together
        so the outcome never rides on colour alone.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const reject = canvas.getByRole('button', { name: /reject/i })
    await userEvent.click(reject)

    // bar collapses to a "rejected" acknowledgement; the buttons are gone.
    await waitFor(() => {
      expect(canvas.getByText('rejected')).toBeVisible()
    })
    expect(canvas.queryByRole('button', { name: /reject/i })).toBeNull()
  },
}

// ── ModerationQueue — empty ──────────────────────────────────────────────────────────────────
export const Empty = {
  render: () => (
    <ModerationQueue title="pending review" items={[]} emptyLabel="nothing waiting on you" />
  ),
}
