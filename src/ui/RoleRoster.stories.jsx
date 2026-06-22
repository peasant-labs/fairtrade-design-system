import { useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import { Trash2 } from 'lucide-react'
import RoleRoster, { ConfirmInline, DangerZone } from './RoleRoster.jsx'
import { frame } from './story-frame.jsx'

/* CSF3 stories for the role roster family. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. Roster drives a real collective
   member list (1 owner-locked + 4 members with mixed roles + orgs); ConfirmRemove shows the inline
   destructive-confirm alone and the play test exercises its click → yes / cancel swap; DangerZone
   wraps a "delete collective" confirm. */

const MEMBERS = [
  { handle: '@harvest-moon', name: 'Mara Olsson', role: 'owner', owner: true, org: 'peasant-labs' },
  { handle: '@tildeswim', name: 'Jun Park', role: 'member', org: 'peasant-labs' },
  { handle: '@root-and-branch', name: 'Avery Cole', role: 'member', org: 'commons-wg' },
  { handle: '@field-notes', name: 'Sam Devi', role: 'contributor', org: 'commons-wg' },
  { handle: '@late-frost', name: 'Robin Ek', role: 'guest' },
]

const meta = {
  title: 'in use/RoleRoster',
  component: RoleRoster,
  tags: ['autodocs'],
  decorators: frame('panel'),
}
export default meta

/* the full roster: an owner row (locked — role reads "owner" + lock glyph, no remove) above four
   members in mixed roles, two carrying an org chip. role changes + removes are wired to local
   state so the controls are live in the story. */
export const Roster = {
  render: () => {
    const [members, setMembers] = useState(MEMBERS)
    return (
      <RoleRoster
        members={members}
        onRole={(m, role) =>
          setMembers((list) =>
            list.map((x) => (x.handle === m.handle ? { ...x, role } : x)),
          )
        }
        onRemove={(m) =>
          setMembers((list) => list.filter((x) => x.handle !== m.handle))
        }
      />
    )
  },
}

/* the inline destructive-confirm alone — the pattern village reuses everywhere it removes a thing.
   the play test clicks the trigger, asserts the "remove?" prompt + yes/cancel appear, cancels back
   to the trigger, then reopens and confirms (firing onConfirm). */
export const ConfirmRemove = {
  render: () => {
    const [removed, setRemoved] = useState(false)
    return removed ? (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-label)', color: 'var(--ink-3)' }}>
        removed.
      </span>
    ) : (
      <ConfirmInline
        label="remove"
        confirmLabel="remove"
        icon={<Trash2 />}
        onConfirm={() => setRemoved(true)}
      />
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // resting state: just the trigger, no prompt.
    const trigger = canvas.getByRole('button', { name: 'remove' })
    await expect(canvas.queryByText('remove?')).toBeNull()

    // click → the prompt + yes/cancel swap in place.
    await userEvent.click(trigger)
    await waitFor(() => expect(canvas.getByText('remove?')).toBeInTheDocument())
    const cancel = canvas.getByRole('button', { name: 'cancel' })
    await expect(canvas.getByRole('button', { name: 'yes' })).toBeInTheDocument()

    // cancel reverts to the trigger.
    await userEvent.click(cancel)
    await waitFor(() => expect(canvas.getByRole('button', { name: 'remove' })).toBeInTheDocument())

    // reopen + confirm → onConfirm fires (the demo swaps to "removed.").
    await userEvent.click(canvas.getByRole('button', { name: 'remove' }))
    await userEvent.click(canvas.getByRole('button', { name: 'yes' }))
    await waitFor(() => expect(canvas.getByText('removed.')).toBeInTheDocument())
  },
}

/* the danger zone: a clay-bordered section fronted by a warning glyph + word, wrapping a
   "delete collective" inline confirm (confirmLabel="delete"). */
export const Danger = {
  name: 'DangerZone',
  render: () => {
    const [deleted, setDeleted] = useState(false)
    return (
      <DangerZone title="danger zone">
        <p>
          Deleting this collective permanently removes it and all of its membership. Shared
          transcripts remain owned by their authors. This cannot be undone.
        </p>
        {deleted ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-label)', color: 'var(--clay)' }}>
            deleted.
          </span>
        ) : (
          <ConfirmInline
            label="delete collective"
            confirmLabel="delete"
            icon={<Trash2 />}
            onConfirm={() => setDeleted(true)}
          />
        )}
      </DangerZone>
    )
  },
}
