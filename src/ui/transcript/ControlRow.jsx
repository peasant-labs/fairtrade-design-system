import { ChevronDown, ChevronRight } from 'lucide-react'
import { useId, useLayoutEffect, useState } from 'react'
import { MemoMarkdown as Markdown } from './Markdown.jsx'
import { formatRelative, isKnownTime } from './time.js'

/* TranscriptControlRow — one producer-classified control record as a compact row.

   A control record is harness state (mode, permission mode, attachment, agent name,
   custom title), not conversation: the server says which turns are records with
   `controlKind`, and this row renders that judgement. DUMB: it never infers a kind from
   the role, the text, or the harness.

   The kind and the recorded value are emitted VERBATIM. The lowercase chrome rule
   applies to chrome; a recorded value is evidence and keeps its case.

   A value that reads as one line (no line break, at most 160 characters) renders as a
   plain row with NO disclosure: there is nothing folded away. A longer or multi-line
   value gets the same disclosure pattern the system row uses, so the row itself never
   takes a card and the body stays one indent under it. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/** The longest value that still reads as a single line; past it the row discloses. */
const CONTROL_ROW_SINGLE_LINE_MAX = 160

/**
 * @param {object} props
 * @param {TurnVM} [props.turn]
 * @param {import('react').ReactNode} [props.actions] the turn's trailing controls (copy anchor + host actions)
 * @param {number} [props.revealRequest] explicit search navigation sequence; a new value opens the row
 */
export default function TranscriptControlRow({ turn, actions, revealRequest = 0 }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  useLayoutEffect(() => {
    if (revealRequest) setOpen(true)
    // the reveal sequence is the only trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealRequest])
  if (!turn) return null
  const value = turn.displayContent ?? turn.content ?? ''
  const singleLine = !value.includes('\n') && value.length <= CONTROL_ROW_SINGLE_LINE_MAX
  const time = turn.time || (isKnownTime(turn.timestamp) ? formatRelative(turn.timestamp) : '')
  const kind = turn.controlKind

  const head = (
    <>
      <span className="txn-control-kind">{kind}</span>
      <span className="txn-control-value" title={singleLine ? undefined : value}>{value}</span>
      {time && <span className="txn-control-time tnum">{time}</span>}
    </>
  )

  return (
    <div className="txn-control-row">
      {singleLine ? (
        <div className="txn-control-head-row">{head}{actions}</div>
      ) : (
        <>
          <div className="txn-control-head-row">
            <button
              type="button"
              className="txn-control-head"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
              {head}
            </button>
            {actions}
          </div>
          <div id={bodyId} hidden={!open} className="txn-control-body">
            <Markdown text={value} />
          </div>
        </>
      )}
    </div>
  )
}
