import { useEffect, useRef } from 'react'

/* Scrubber — the condensed position track in the pinned trace header, lifted verbatim from the
   canonical mockup (src/mockups/inuse/TranscriptApp.jsx:1619). DUMB: it renders one tick per
   cooked `TurnVM` in turn-index space (every tick at i/(N-1) of the track), highlights the
   `active` turn, and reports a click/drag through `onSeek(clientX, trackEl)` so the host maps
   the cursor to the nearest turn. `draggingRef` is shared with the host (so a drag begun on the
   track keeps seeking as the mouse moves); if omitted, an internal ref is used. Exported as
   `TranscriptScrubber`. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/**
 * @param {object} props
 * @param {TurnVM[]} [props.turns]
 * @param {number} [props.active]                          the active TURN INDEX (TurnVM.index)
 * @param {(clientX: number, track: HTMLElement) => void} [props.onSeek]
 * @param {{ current: boolean }} [props.draggingRef]       shared drag latch; defaults to an internal ref
 */
export default function Scrubber({ turns = [], active = 0, onSeek = () => {}, draggingRef }) {
  const trackRef = useRef(null)
  const internalDragging = useRef(false)
  const dragging = draggingRef ?? internalDragging
  const last = turns.length - 1
  const activeIdx = Math.max(0, turns.findIndex((t) => t.index === active))
  /* the bracket follows the active turn, exactly co-located with its tick. */
  const bracketPct = last > 0 ? (activeIdx / last) * 100 : 0

  function down(e) {
    dragging.current = true
    if (trackRef.current) onSeek(e.clientX, trackRef.current)
  }
  useEffect(() => {
    function move(e) {
      if (dragging.current && trackRef.current) onSeek(e.clientX, trackRef.current)
    }
    function up() { dragging.current = false }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [onSeek, dragging])

  return (
    <div
      className="txn-scrub"
      ref={trackRef}
      role="slider"
      aria-label="position in transcript"
      aria-valuemin={1}
      aria-valuemax={turns.length}
      aria-valuenow={activeIdx + 1}
      aria-valuetext={'turn ' + (activeIdx + 1) + ' of ' + turns.length}
      tabIndex={0}
      onMouseDown={down}
    >
      {turns.map((t, i) => (
        <span
          key={t.index}
          className={'txn-scrub-tick' + (t.role === 'user' ? ' txn-tick-user' : '') + (t.isError ? ' txn-tick-err' : '') + (active === t.index ? ' txn-tick-on' : '')}
          style={{ left: (last > 0 ? (i / last) * 100 : 0) + '%' }}
        />
      ))}
      <span className="txn-scrub-bracket" style={{ left: bracketPct + '%' }} aria-hidden="true" />
    </div>
  )
}
