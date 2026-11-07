import { ChevronDown, ChevronRight } from 'lucide-react'
import { useId, useLayoutEffect, useState } from 'react'
import Collapsible from './Collapsible.jsx'
import { systemGroupSummary } from './system-summary.js'

/* TranscriptSystemGroup — a run of consecutive system entries as one fold.

   The owner (the run's first member) renders IN PLACE, outside the collapsible, with
   this header immediately above it, so a closed group still has one laid-out row for
   the reading line, the keyboard step, the minimap and a copied anchor. Members 2..N
   render inside a disclosure that is mounted but inert while closed: their `#turn-N`
   anchors exist, so a search hit or an initial position can land on one by opening the
   group first. The owner and the folded members sit in the same inset column (one
   declared padding), so a group reads as one aligned run rather than one row at the
   group's edge and the rest indented under it.

   DUMB: it renders cooked turns and owns only the disclosure. The viewer owns which
   groups are open, because opening one changes the navigation list. */

/** @typedef {import('./system-groups.js').SystemGroupVM} SystemGroupVM */

/**
 * @param {object} props
 * @param {SystemGroupVM} props.group
 * @param {boolean} [props.open]
 * @param {(open: boolean) => void} [props.onToggle]
 * @param {import('react').ReactNode} [props.owner]  the owner's own row, rendered in place
 * @param {import('react').ReactNode} [props.children] members 2..N, rendered inside the fold
 * @param {number} [props.revealRequest] explicit navigation sequence; a new value opens the group
 */
export default function TranscriptSystemGroup({ group, open: openProp, onToggle, owner, children, revealRequest = 0 }) {
  const bodyId = useId()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  // The viewer always controls this state; the uncontrolled path keeps the component
  // usable standalone (stories, host compositions) without lying about the API.
  const controlled = openProp !== undefined
  const shown = controlled ? !!openProp : uncontrolledOpen
  const setOpen = (next) => {
    if (!controlled) setUncontrolledOpen(next)
    if (onToggle) onToggle(next)
  }
  useLayoutEffect(() => {
    if (revealRequest) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealRequest])
  if (!group) return null
  return (
    <div className="txn-systemgroup">
      <button
        type="button"
        className="txn-systemgroup-head"
        aria-expanded={shown}
        aria-controls={bodyId}
        onClick={() => setOpen(!shown)}
      >
        {shown ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        <span className="txn-systemgroup-label">system entries</span>
        <span className="txn-systemgroup-summary tnum">{systemGroupSummary(group.members)}</span>
      </button>
      {owner && <div className="txn-systemgroup-owner">{owner}</div>}
      <Collapsible id={bodyId} open={shown} keepMounted animateSize={false}>
        <div className="txn-systemgroup-rows">{children}</div>
      </Collapsible>
    </div>
  )
}
