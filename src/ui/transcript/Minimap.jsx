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

/** the tick kind of a cooked turn: the role decides it. A user prompt fills the bar, an agent
   turn is the amber band, and a system notice is the short neutral mark. Tool calls ride on the
   agent turn that made them, so they never turn a run of agent turns into neutral marks. */
function segmentKind(turn) {
  if (turn.role === 'user') return 'user'
  if (turn.role === 'system') return 'tool'
  return 'agent'
}

/** Accessible copy owned by TranscriptMinimap. */
export const TranscriptMinimapLabels = Object.freeze({
  Timeline: 'transcript timeline',
})

/* the keyboard step for each handled key; Home/End are handled beside this map. */
const KEY_STEP = { ArrowLeft: -1, ArrowRight: 1, PageUp: -10, PageDown: 10 }

/** Fail-closed validation of optional preview source-byte progress. */
function validSourceBytes(sourceBytes) {
  if (sourceBytes == null || typeof sourceBytes !== 'object') return null
  const { loaded, total } = sourceBytes
  if (!Number.isSafeInteger(loaded) || !Number.isSafeInteger(total)) return null
  if (loaded < 0 || total < 0 || loaded > total) return null
  return { loaded, total }
}

/**
 * @param {object} props
 * @param {TurnVM[]} [props.turns]        the turns the reader can currently see, in turn order
 * @param {number} [props.activeTurn]     the active TURN INDEX (TurnVM.index)
 * @param {import('./segments.js').PreviewSourceBytes | null} [props.sourceBytes]  optional preview byte progress; when loaded < total, draws the remaining share as a hollow tail
 * @param {(turnIndex: number) => void} [props.onJump]
 * @param {string} [props.label]          accessible name for the slider
 */
export default function TranscriptMinimap({
  turns = [],
  activeTurn,
  sourceBytes = null,
  onJump = () => {},
  label = TranscriptMinimapLabels.Timeline,
}) {
  const controlRef = useRef(null)
  const dragging = useRef(false)
  const last = turns.length - 1
  const index = Math.max(0, turns.findIndex((turn) => turn.index === activeTurn))
  const turn = turns[index]
  const validBytes = validSourceBytes(sourceBytes)
  const hasTail = validBytes != null && validBytes.total > 0 && validBytes.loaded < validBytes.total
  const loadedShare = hasTail ? validBytes.loaded / validBytes.total : 1
  const loadedPct = loadedShare * 100
  const loadedPercent = hasTail
    ? (validBytes.loaded === 0 ? 0 : Math.min(99, Math.max(1, Math.round(loadedShare * 100))))
    : 100
  const cursorPct = (last > 0 ? (index / last) * loadedShare : 0) * 100
  const valueText = hasTail
    ? (turns.length === 0
      ? `${loadedPercent}% of source loaded`
      : `turn ${turn?.label ?? index + 1} of ${turns.length}, ${loadedPercent}% of source loaded`)
    : ('turn ' + (turn?.label ?? index + 1) + ' of ' + turns.length)

  /* map a pointer x on the control to the nearest visible turn inside the loaded share, never targeting the hollow tail. */
  function seek(clientX) {
    const control = controlRef.current
    if (!control || turns.length === 0) return
    const rect = control.getBoundingClientRect()
    if (!rect.width) return
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const loadedFraction = hasTail
      ? (loadedShare > 0 ? Math.min(1, fraction / loadedShare) : 0)
      : fraction
    const next = turns[last > 0 ? Math.round(loadedFraction * last) : 0]
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
      aria-valuetext={valueText}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <span className="txn-minimap-track" aria-hidden="true">
        {hasTail ? (
          <>
            {turns.length > 0 && (
              <span className="txn-minimap-loaded" style={{ width: loadedPct + '%' }}>
                {turns.map((t) => (
                  <span key={t.identity ?? t.index} className={'txn-minimap-seg txn-minimap-' + segmentKind(t)} />
                ))}
              </span>
            )}
            <span className="txn-minimap-tail" />
          </>
        ) : (
          turns.map((t) => (
            <span key={t.identity ?? t.index} className={'txn-minimap-seg txn-minimap-' + segmentKind(t)} />
          ))
        )}
      </span>
      <span className="txn-minimap-cursor" aria-hidden="true" style={{ left: cursorPct + '%' }} />
    </div>
  )
}
