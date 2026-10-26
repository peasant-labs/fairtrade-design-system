import { useRef } from 'react'

/* TranscriptMinimap — the visible-turns position control in the pinned trace header of the
   ledger presentation. DUMB: it reads the cooked `TurnVM` list the reader can currently see
   (the viewer passes its already-filtered `visibleTurns`), reports a chosen turn as a turn
   index through `onJump`, and holds no view state.

   It is ONE focusable slider control (role=slider), not one control per turn: the tab-stop
   count and the hit target stay constant however long the trace grows. The ticks are decorative
   and form one filled bar: a kind is encoded by colour AND by a three-step shape ladder (a user
   turn fills the 6px bar, an agent turn is a shorter centred band, and a tool turn is the
   shortest centred band), never by hue alone. An ink-strong cursor marks the active position at
   any turn count, independent of a tick's width. Arrow keys step one turn,
   Home/End jump to the ends, PageUp/PageDown step ten, and a pointer press or drag maps the
   cursor position to the nearest visible turn, so the strip keeps the continuous seek the
   classic scrubber has.
   Exported as `TranscriptMinimap`. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/** the tick kind of a cooked turn: user prompt, tool work, or agent prose. */
function segmentKind(turn) {
  if (turn.role === 'user') return 'user'
  if (turn.role === 'system' || (turn.toolCalls?.length ?? 0) > 0) return 'tool'
  return 'agent'
}

/* the keyboard step for each handled key; Home/End are handled beside this map. */
const KEY_STEP = { ArrowLeft: -1, ArrowRight: 1, PageUp: -10, PageDown: 10 }

/**
 * @param {object} props
 * @param {TurnVM[]} [props.turns]        the turns the reader can currently see, in turn order
 * @param {number} [props.activeTurn]     the active TURN INDEX (TurnVM.index)
 * @param {(turnIndex: number) => void} [props.onJump]
 * @param {string} [props.label]          accessible name for the slider
 */
export default function TranscriptMinimap({
  turns = [],
  activeTurn,
  onJump = () => {},
  label = 'transcript timeline',
}) {
  const controlRef = useRef(null)
  const dragging = useRef(false)
  const last = turns.length - 1
  const index = Math.max(0, turns.findIndex((turn) => turn.index === activeTurn))
  const turn = turns[index]
  const cursorPct = last > 0 ? (index / last) * 100 : 0

  /* map a pointer x on the control to the nearest visible turn and report it. */
  function seek(clientX) {
    const control = controlRef.current
    if (!control) return
    const rect = control.getBoundingClientRect()
    if (!rect.width) return
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const next = turns[last > 0 ? Math.round(fraction * last) : 0]
    if (next) onJump(next.index)
  }

  function endDrag(event) {
    dragging.current = false
    if (typeof event.currentTarget.releasePointerCapture !== 'function') return
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function onPointerDown(event) {
    seek(event.clientX)
    dragging.current = true
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* synthetic pointer ids cannot be captured */ }
    }
  }

  function onPointerMove(event) {
    if (dragging.current) seek(event.clientX)
  }

  function onKeyDown(event) {
    const step = KEY_STEP[event.key]
    let target
    if (step != null) target = index + step
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = last
    else return
    event.preventDefault()
    const next = turns[Math.max(0, Math.min(last, target))]
    if (next) onJump(next.index)
  }

  return (
    <div
      ref={controlRef}
      className="txn-minimap"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, last)}
      aria-valuenow={index}
      aria-valuetext={'turn ' + (turn?.label ?? index + 1) + ' of ' + turns.length}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <span className="txn-minimap-track" aria-hidden="true">
        {turns.map((t) => (
          <span key={t.identity ?? t.index} className={'txn-minimap-seg txn-minimap-' + segmentKind(t)} />
        ))}
      </span>
      <span className="txn-minimap-cursor" aria-hidden="true" style={{ left: cursorPct + '%' }} />
    </div>
  )
}
