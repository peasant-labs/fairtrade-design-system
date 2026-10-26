import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import { useId, useLayoutEffect, useState } from 'react'
import Markdown from './Markdown.jsx'
import { plainTextPreview } from './plain-text.js'
import { formatRelative, isKnownTime } from './time.js'

/* TranscriptSystemRow — a system turn as one compact row in the ledger presentation. The row
   reads its own cooked `TurnVM` (label, one-line preview, time) and reveals the full recorded
   text on demand, so a system notice never takes a full card between the reader's turns. DUMB:
   it never parses wire. `actions` is the turn's trailing cluster (the copy anchor, plus any host
   per-turn actions the card passes through), supplied by the card so the row keeps the same
   controls every other turn has.

   The disclosure is controllable: pass `open` (with `onToggle`) to own the state, or omit both
   and the row keeps it internally, mirroring TranscriptWorkGroup's controllable `openTools`.
   `revealRequest` is the explicit search-navigation sequence: a new value opens the row, so a
   search hit inside a system turn is visible when the viewer lands on it. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/**
 * @param {object} props
 * @param {TurnVM} [props.turn]
 * @param {import('react').ReactNode} [props.actions]  the turn's trailing controls (copy anchor + host actions)
 * @param {boolean} [props.open]        controlled disclosure state; omit to let the row own it
 * @param {(open: boolean) => void} [props.onToggle]  called with the next state whenever the disclosure changes
 * @param {number} [props.revealRequest] explicit search navigation sequence; a new value opens the row
 */
export default function TranscriptSystemRow({ turn, actions, open: openProp, onToggle, revealRequest = 0 }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? !!openProp : uncontrolledOpen
  const setOpen = (next) => {
    if (!controlled) setUncontrolledOpen(next)
    if (onToggle) onToggle(next)
  }
  useLayoutEffect(() => {
    if (revealRequest) setOpen(true)
    // the reveal sequence is the only trigger; the setter closes over the current mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealRequest])
  const bodyId = useId()
  if (!turn) return null
  /* the turn's rendered text is the same body every other card shows: `displayContent` wins when
     the adapter supplied a display form (e.g. a stripped prompt wrapper), else the recorded text.
     The preview unwraps the Markdown so the row reads the words the body renders, never its
     source punctuation. */
  const content = turn.displayContent ?? turn.content
  const preview = plainTextPreview(content)
  /* a curated `time` wins; a known recorded timestamp reads relative; an unknown one (zero, epoch,
     Go zero-time) renders nothing rather than a huge relative date */
  const time = turn.time || (isKnownTime(turn.timestamp) ? formatRelative(turn.timestamp) : '')
  return (
    <div className="txn-systemrow">
      {/* the disclosure is the button; the turn anchor sits beside it so neither control nests
          inside the other (a button inside a button is not a reachable control). */}
      <div className="txn-systemrow-head-row">
        <button
          type="button"
          className="txn-systemrow-head"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          <Wrench size={14} aria-hidden="true" />
          <span className="txn-systemrow-label">system</span>
          <span className="txn-systemrow-preview">{preview}</span>
          {time && <span className="txn-systemrow-time tnum">{time}</span>}
        </button>
        {actions}
      </div>
      <div id={bodyId} hidden={!open} className="txn-systemrow-body">
        <Markdown text={content} />
      </div>
    </div>
  )
}
