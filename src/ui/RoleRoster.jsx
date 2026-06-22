import { useId, useState } from 'react'
import { Lock, AlertTriangle } from 'lucide-react'
import './RoleRoster.css'

/* RoleRoster — a member role roster + the inline destructive-confirm micro-pattern + a danger
   zone, modeled on village's collective settings (groups/[id]/settings) and the members roster
   on groups/[id]. three exports, one self-contained family:

     ConfirmInline  the reusable "remove? [yes] [cancel]" swap-in-place (NOT a modal). village uses
                    this everywhere it removes a thing — a member, a pending request, a share.
     RoleRoster     a roster table: avatar/handle + name + org chip + a role <select>. owner rows
                    are locked (disabled select + lock glyph, no remove); other rows carry a
                    <ConfirmInline> remove.
     DangerZone     a clay-bordered section wrapping destructive actions, fronted by a warning
                    icon + the word "warning" so danger never rides on color alone.

   tokens only (no hardcoded hex/px). square (radius 0), hairline, amber-scarce. chrome is
   var(--font-mono) and lowercased; user content (handles, names, org logins) is var(--font-body)
   and NEVER lowercased. danger reads as the clay/--danger accent, always paired with a word or
   glyph. classes are namespaced rr-. */

const ROLE_OPTIONS = ['owner', 'member', 'contributor', 'guest']

/* ── ConfirmInline ───────────────────────────────────────────────────────────── */

/**
 * The inline destructive-confirm: a trigger button that, on click, swaps in place to
 * "{label}? [yes] [cancel]" — never a modal, so the row never reflows out from under the cursor.
 * yes fires onConfirm and (if it doesn't throw) reverts to the trigger; cancel reverts immediately.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.label='remove']       the trigger's lowercase chrome label
 * @param {string} [props.confirmLabel]                  the verb echoed in the prompt + on yes (defaults to label, lowercased)
 * @param {React.ReactNode} [props.icon]                 optional leading glyph for the trigger (e.g. <Trash2 />)
 * @param {() => (void | Promise<void>)} props.onConfirm fired when yes is activated
 * @param {boolean} [props.busy=false]                   external pending flag — disables yes + shows "{verb}…"
 * @param {boolean} [props.disabled=false]               disables the trigger entirely
 * @param {string} [props['aria-label']]                 accessible name for the trigger (defaults from label/confirmLabel)
 * @param {string} [props.className]                     extra class on the wrapper
 */
export function ConfirmInline({
  label = 'remove',
  confirmLabel,
  icon,
  onConfirm,
  busy = false,
  disabled = false,
  'aria-label': ariaLabel,
  className,
}) {
  const [confirming, setConfirming] = useState(false)
  const verb = (confirmLabel ?? (typeof label === 'string' ? label : 'remove')).toLowerCase()
  const cls = `rr-confirm${className ? ` ${className}` : ''}`

  if (!confirming) {
    return (
      <span className={cls}>
        <button
          type="button"
          className="rr-btn rr-btn--danger-ghost"
          onClick={() => setConfirming(true)}
          disabled={disabled}
          aria-label={ariaLabel ?? verb}
        >
          {icon != null && <span className="rr-btn-ico" aria-hidden="true">{icon}</span>}
          {label}
        </button>
      </span>
    )
  }

  return (
    /* role=group so the prompt + its two actions announce as one unit; the prompt word labels it. */
    <span className={`${cls} rr-confirm--open`} role="group" aria-label={`${verb}?`}>
      <span className="rr-confirm-q">{verb}?</span>
      <button
        type="button"
        className="rr-btn rr-btn--danger"
        onClick={async () => {
          await onConfirm?.()
          setConfirming(false)
        }}
        disabled={busy}
      >
        {busy ? `${verb}…` : 'yes'}
      </button>
      <button
        type="button"
        className="rr-btn rr-btn--quiet"
        onClick={() => setConfirming(false)}
        disabled={busy}
      >
        cancel
      </button>
    </span>
  )
}

/* ── RoleRoster ──────────────────────────────────────────────────────────────── */

/**
 * @typedef {Object} RosterMember
 * @property {string} handle           the member's handle (user content — never lowercased)
 * @property {string} [name]           display name (user content)
 * @property {'owner'|'member'|'contributor'|'guest'} role  the member's role
 * @property {boolean} [owner]         locks the row: role select disabled, "owner" shown as text + lock glyph, no remove
 * @property {string} [org]            an org affiliation chip (user content, e.g. a github org login)
 * @property {string} [avatar]         avatar image url; falls back to the handle's initial
 * @property {string} [id]             stable key (defaults to handle)
 */

/**
 * A member role roster: one row per member with avatar/handle + name, an org chip, a role select,
 * and (for non-owner rows) an inline remove. Owner rows are locked — the role reads as plain
 * "owner" text beside a lock glyph and there's no remove, mirroring village where the owner can't
 * be reassigned or removed here.
 *
 * @param {Object} props
 * @param {RosterMember[]} props.members           the members to list
 * @param {(member: RosterMember, role: string) => void} [props.onRole]   fired when a row's role select changes
 * @param {(member: RosterMember) => (void | Promise<void>)} [props.onRemove]  fired when a row's remove is confirmed
 * @param {string} [props.title='members']         section header label (lowercase chrome)
 * @param {string[]} [props.roles]                 selectable roles (default member/contributor/guest; owner is never offered)
 */
export default function RoleRoster({
  members = [],
  onRole,
  onRemove,
  title = 'members',
  roles = ['member', 'contributor', 'guest'],
}) {
  const baseId = useId()

  return (
    <section className="rr" aria-label={typeof title === 'string' ? title : 'members'}>
      <header className="rr-head">
        <span className="rr-head-label">{title}</span>
        <span className="rr-count" aria-hidden="true">{members.length}</span>
      </header>

      <ul className="rr-list">
        {members.map((m, i) => {
          const key = m.id ?? m.handle ?? i
          const isOwner = m.owner || m.role === 'owner'
          const selectId = `${baseId}-role-${i}`
          const initial = (m.handle?.[0] ?? '?').toUpperCase()

          return (
            <li key={key} className="rr-row">
              {/* identity: avatar + handle + name. user content, never lowercased. */}
              <div className="rr-who">
                {m.avatar ? (
                  <img className="rr-avatar" src={m.avatar} alt="" />
                ) : (
                  <span className="rr-avatar rr-avatar--fallback" aria-hidden="true">{initial}</span>
                )}
                <span className="rr-id">
                  <span className="rr-handle">{m.handle}</span>
                  {m.name && <span className="rr-name">{m.name}</span>}
                </span>
              </div>

              {/* org affiliation chip — user content. */}
              {m.org ? (
                <span className="rr-org" title={m.org}>{m.org}</span>
              ) : (
                <span className="rr-org rr-org--none" aria-hidden="true" />
              )}

              {/* role control: locked text + lock glyph for owners, a labelled select otherwise. */}
              <div className="rr-role">
                <label className="rr-sr-only" htmlFor={selectId}>
                  role for {m.handle}
                </label>
                {isOwner ? (
                  <span className="rr-role-locked">
                    <Lock className="rr-lock" aria-hidden="true" />
                    owner
                  </span>
                ) : (
                  <select
                    id={selectId}
                    className="rr-select"
                    value={m.role}
                    onChange={(e) => onRole?.(m, e.target.value)}
                    aria-label={`role for ${m.handle}`}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* remove: locked for owners (a fixed-width spacer keeps the columns aligned). */}
              <div className="rr-act">
                {isOwner ? (
                  <span className="rr-act-locked" aria-hidden="true" />
                ) : (
                  <ConfirmInline
                    label="remove"
                    confirmLabel="remove"
                    aria-label={`remove ${m.handle}`}
                    onConfirm={() => onRemove?.(m)}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ── DangerZone ──────────────────────────────────────────────────────────────── */

/**
 * A clay-bordered section wrapping destructive actions (e.g. "delete collective"). Fronted by a
 * warning glyph + the literal word "warning" so the danger framing is never carried by the clay
 * border alone. children is the body — typically a sentence of consequence + a
 * <ConfirmInline confirmLabel="delete" />.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.title='danger zone']  the section header label (lowercase chrome)
 * @param {React.ReactNode} props.children               the destructive actions / explanation
 */
export function DangerZone({ title = 'danger zone', children }) {
  return (
    <section className="rr-danger" aria-label={typeof title === 'string' ? title : 'danger zone'}>
      <header className="rr-danger-head">
        <AlertTriangle className="rr-danger-ico" aria-hidden="true" />
        <span className="rr-danger-word">warning</span>
        <span className="rr-danger-title">{title}</span>
      </header>
      <div className="rr-danger-body">{children}</div>
    </section>
  )
}
