import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import { useId, useState } from 'react'
import Markdown from './Markdown.jsx'
import { formatRelative, isKnownTime } from './time.js'

/* TranscriptSystemRow — a system turn as one compact row in the ledger presentation. The row
   reads its own cooked `TurnVM` (label, one-line preview, time) and reveals the full recorded
   text on demand, so a system notice never takes a full card between the reader's turns. DUMB:
   it never parses wire. `actions` is the turn's copy-anchor, supplied by the card so the row
   keeps the same anchor every other turn has. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/** the recorded text as one line: every run of whitespace collapses to a single space. */
const oneLine = (content) => String(content ?? '').replace(/\s+/g, ' ').trim()

/**
 * @param {object} props
 * @param {TurnVM} [props.turn]
 * @param {import('react').ReactNode} [props.actions]  the turn's copy-anchor control
 */
export default function TranscriptSystemRow({ turn, actions }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  if (!turn) return null
  /* the turn's rendered text is the same body every other card shows: `displayContent` wins when
     the adapter supplied a display form (e.g. a stripped prompt wrapper), else the recorded text */
  const content = turn.displayContent ?? turn.content
  const preview = oneLine(content)
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
          onClick={() => setOpen((value) => !value)}
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
