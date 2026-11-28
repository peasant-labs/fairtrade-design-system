import { ChevronDown, ChevronRight, Minimize2 } from 'lucide-react'
import { useId, useLayoutEffect, useState } from 'react'
import { MemoMarkdown as Markdown } from './Markdown.jsx'
import { formatCount, formatInteger } from '../format.js'
import { formatDurationMs, formatRelative, isKnownTime } from './time.js'

/* TranscriptCompactionBoundary - a producer context-compaction boundary as its own row.

   A compaction boundary is an action in the conversation, not harness bookkeeping and not
   a control record: it marks where the producer replaced earlier context. The adapter
   cooks the descriptor once from the recorded notice; this row only renders it.

   Chrome is lowercase, and a recorded trigger keeps its case. Counts and the duration use
   tabular figures and the shared formatters. The full recorded text stays behind the same
   disclosure pattern the system and control rows use: a real button, so the boundary is
   keyboard reachable and announces its expanded state. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/**
 * @param {object} props
 * @param {TurnVM} [props.turn]
 * @param {import('react').ReactNode} [props.actions] the turn's trailing controls (copy anchor + host actions)
 * @param {boolean} [props.open]        controlled disclosure state; omit to let the row own it
 * @param {(open: boolean) => void} [props.onToggle]  called with the next state whenever the disclosure changes
 * @param {number} [props.revealRequest] explicit search navigation sequence; a new value opens the row
 */
export default function TranscriptCompactionBoundary({ turn, actions, open: openProp, onToggle, revealRequest = 0 }) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- adding setOpen, recreated each render, would reopen a disclosure the reader just closed
  }, [revealRequest])
  const bodyId = useId()
  if (!turn?.compaction) return null
  const notice = turn.compaction
  const time = turn.time || (isKnownTime(turn.timestamp) ? formatRelative(turn.timestamp) : '')
  const hasDelta = notice.preTokens !== undefined || notice.postTokens !== undefined
  const duration = formatDurationMs(notice.durationMs)

  /* the visible delta is compact chrome; the accessible name states the exact recorded sides. */
  let delta = null
  if (notice.preTokens !== undefined && notice.postTokens !== undefined) {
    delta = (
      <>
        <span className="txn-compaction-count tnum">{formatCount(notice.preTokens)}</span>
        <span className="txn-compaction-arrow" aria-hidden="true">→</span>
        <span className="txn-sr"> to </span>
        <span className="txn-compaction-count tnum">{formatCount(notice.postTokens)}</span>
        <span className="txn-compaction-unit">tokens</span>
      </>
    )
  } else if (notice.preTokens !== undefined) {
    delta = (
      <>
        <span className="txn-compaction-count tnum">{formatCount(notice.preTokens)}</span>
        <span className="txn-compaction-unit">tokens before</span>
      </>
    )
  } else if (notice.postTokens !== undefined) {
    delta = (
      <>
        <span className="txn-compaction-count tnum">{formatCount(notice.postTokens)}</span>
        <span className="txn-compaction-unit">tokens after</span>
      </>
    )
  }

  const nameParts = [notice.label]
  if (notice.trigger !== undefined) nameParts.push(notice.trigger)
  if (notice.preTokens !== undefined && notice.postTokens !== undefined) {
    nameParts.push(`${formatInteger(notice.preTokens)} tokens before`, `${formatInteger(notice.postTokens)} tokens after`)
  } else if (notice.preTokens !== undefined) {
    nameParts.push(`${formatInteger(notice.preTokens)} tokens before`)
  } else if (notice.postTokens !== undefined) {
    nameParts.push(`${formatInteger(notice.postTokens)} tokens after`)
  }
  if (duration) nameParts.push(duration)
  if (time) nameParts.push(time)

  return (
    <div className="txn-compaction" data-compaction>
      <div className="txn-compaction-head-row">
        <button
          type="button"
          className="txn-compaction-head"
          aria-label={nameParts.join(', ')}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          <Minimize2 size={14} aria-hidden="true" />
          <span className="txn-compaction-label">{notice.label}</span>
          {notice.trigger !== undefined && <span className="txn-compaction-trigger">({notice.trigger})</span>}
          {hasDelta && <span className="txn-compaction-delta tnum">{delta}</span>}
          {duration && <span className="txn-compaction-duration tnum">{duration}</span>}
          {time && <span className="txn-compaction-time tnum">{time}</span>}
        </button>
        {actions}
      </div>
      <div id={bodyId} hidden={!open} className="txn-compaction-body">
        <Markdown text={turn.displayContent ?? turn.content} />
      </div>
    </div>
  )
}
