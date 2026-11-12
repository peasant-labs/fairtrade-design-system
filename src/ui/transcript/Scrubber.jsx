import { useEffect, useRef } from 'react'

/* Scrubber — the condensed position track in the pinned trace header, lifted verbatim from the
   canonical mockup (src/mockups/inuse/TranscriptApp.jsx:1619).

   Turn mode (legacy, no `ticks`): DUMB, one tick per cooked `TurnVM` in turn-index space and a
   click/drag reports through `onSeek(clientX, trackEl)` so the host maps the cursor to the
   nearest turn.

   Segment mode (`ticks` supplied): the transcript has no page and never mounts a node per turn.
   The host passes a fixed `min(200, totalSegments)` sample from `segments.js`; each tick is keyed
   by segment index and titled with its conversation turns (or its segment ordinal when the
   directory sent no positions), and activating one takes the same path as a boundary's load-more. `onSeekTick(tick)` receives the chosen sample entry.

   Exported as `TranscriptScrubber`. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */
/** @typedef {import('./segments.js').ScrubberTick} ScrubberTick */

/**
 * @param {object} props
 * @param {TurnVM[]} [props.turns]                         legacy turn mode
 * @param {ScrubberTick[]} [props.ticks]                   segment sample; takes precedence over `turns`
 * @param {number} [props.active]                          the active TURN INDEX (TurnVM.index)
 * @param {number} [props.activeTick]                      the active SEGMENT INDEX when `ticks` is supplied
 * @param {(clientX: number, track: HTMLElement) => void} [props.onSeek]
 * @param {(tick: ScrubberTick) => void} [props.onSeekTick]
 * @param {{ current: boolean }} [props.draggingRef]       shared drag latch; defaults to an internal ref
 */
export default function Scrubber({ turns = [], ticks, active = 0, activeTick = 0, onSeek = () => {}, onSeekTick, draggingRef }) {
  const trackRef = useRef(null)
  const internalDragging = useRef(false)
  const dragging = draggingRef ?? internalDragging
  const segmentMode = Array.isArray(ticks)
  const count = segmentMode ? ticks.length : turns.length
  const last = count - 1
  const activeIdx = segmentMode
    ? Math.max(0, ticks.findIndex((tick) => tick.index === activeTick))
    : Math.max(0, turns.findIndex((turn) => turn.index === active))
  const bracketPct = last > 0 ? (activeIdx / last) * 100 : 0
  const activeTickEntry = segmentMode ? ticks[activeIdx] : null

  function seekTick(clientX, track) {
    if (!segmentMode || ticks.length === 0 || typeof onSeekTick !== 'function') return
    const rect = track.getBoundingClientRect()
    const frac = rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0
    let nearest = ticks[0]
    let distance = Infinity
    for (const tick of ticks) {
      const next = Math.abs(tick.leftPct / 100 - frac)
      if (next < distance) { distance = next; nearest = tick }
    }
    onSeekTick(nearest)
  }

  function down(e) {
    if (e.button !== undefined && e.button !== 0) return
    dragging.current = true
    if (!trackRef.current) return
    if (segmentMode) seekTick(e.clientX, trackRef.current)
    else onSeek(e.clientX, trackRef.current)
  }
  useEffect(() => {
    function move(e) {
      if (!dragging.current || !trackRef.current) return
      if (segmentMode) seekTick(e.clientX, trackRef.current)
      else onSeek(e.clientX, trackRef.current)
    }
    function up() { dragging.current = false }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [onSeek, onSeekTick, dragging, segmentMode, ticks])

  return (
    <div
      className={'txn-scrub' + (segmentMode ? ' txn-scrub-segments' : '')}
      ref={trackRef}
      role="slider"
      aria-label="position in transcript"
      aria-valuemin={1}
      aria-valuemax={Math.max(1, count)}
      aria-valuenow={activeIdx + 1}
      aria-valuetext={segmentMode
        ? activeTickEntry?.valueText ?? 'no segments'
        : 'turn ' + (activeIdx + 1) + ' of ' + count}
      tabIndex={0}
      onMouseDown={down}
    >
      {segmentMode
        ? ticks.map((tick) => (
          <span
            key={tick.key}
            className={'txn-scrub-tick txn-scrub-segment-tick' + (tick.index === activeTick ? ' txn-tick-on' : '')}
            data-segment-index={tick.index}
            title={tick.label}
            style={{ left: tick.leftPct + '%' }}
          />
        ))
        : turns.map((turn, i) => (
          <span
            key={turn.index}
            className={'txn-scrub-tick' + (turn.role === 'user' ? ' txn-tick-user' : '') + (turn.isError ? ' txn-tick-err' : '') + (active === turn.index ? ' txn-tick-on' : '')}
            style={{ left: (last > 0 ? (i / last) * 100 : 0) + '%' }}
          />
        ))}
      <span className="txn-scrub-bracket" style={{ left: bracketPct + '%' }} aria-hidden="true" />
    </div>
  )
}
