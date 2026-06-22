/* ───────────────────────────────────────────────────────────────────────────
   TimeStrip — fairtrade "in use" component
   ─────────────────────────────────────────────────────────────────────────
   a bottom full-width activity time-strip / sparkline-scrubber, modelled on
   peasant's map TimeStrip: per-bucket quantized vertical bars on a MONOCHROME
   intensity ramp (magnitude = fill weight, never hue), right-anchored so the
   newest bucket ("now") never clips, plus a draggable viewport playhead the
   user scrubs with the pointer or the keyboard.

   the strip is a real <input type=range>-style control: role="slider" with
   aria-valuemin/max/now + an accessible text readout, so the playhead position
   is legible to a screen reader without relying on the bars' colour.

   props:
     buckets   [{ label, value, intensity(0..4) }]  oldest → newest; rightmost
               is "now". `value` drives bar HEIGHT; `intensity` drives FILL.
               (omit intensity and it's auto-quantized from value vs. the max.)
     value     0..1 playhead position (0 = oldest bucket, 1 = newest). controlled
               if `onScrub` is passed; otherwise self-managed from `defaultValue`.
     onScrub   (next:0..1, bucketIndex:number) => void
     branches  [{ label }]  small square mono chips above the strip (open work)
     label     accessible name for the slider (default "activity timeline")

   all styling lives in TimeStrip.css (token-driven, namespaced `ts2-`).
   ─────────────────────────────────────────────────────────────────────────── */
import { useCallback, useId, useMemo, useRef, useState } from 'react'
import './TimeStrip.css'

/** clamp a number into [lo, hi]. */
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

/** clamp any number into the 0..4 ramp domain (integers only). */
function clampLevel(level) {
  const n = Math.round(Number(level) || 0)
  return Math.max(0, Math.min(4, n))
}

/**
 * generic value-vs-max quantization onto the 0..4 ramp (peasant's quantizeLevel).
 * used when a bucket omits an explicit `intensity`, so fill always has a value.
 */
function quantize(value, max) {
  if (value <= 0 || max <= 0) return 0
  const ratio = Math.min(value / max, 1)
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/* a playhead at fraction f over N buckets maps to the nearest bucket index. */
function fractionToIndex(fraction, count) {
  if (count <= 1) return 0
  return Math.round(clamp(fraction, 0, 1) * (count - 1))
}
function indexToFraction(index, count) {
  if (count <= 1) return 0
  return clamp(index, 0, count - 1) / (count - 1)
}

export function TimeStrip({
  buckets = [],
  value,
  defaultValue = 1,
  onScrub,
  branches = [],
  label = 'activity timeline',
  maxBranchChips = 4,
  className = '',
  ...rest
}) {
  const count = buckets.length
  const trackRef = useRef(null)
  const sliderId = useId()
  const readoutId = `${sliderId}-readout`

  // controlled when onScrub is supplied; otherwise own the playhead internally.
  const isControlled = value != null && onScrub != null
  const [internal, setInternal] = useState(
    clamp(typeof defaultValue === 'number' ? defaultValue : 1, 0, 1),
  )
  const fraction = clamp(isControlled ? value : internal, 0, 1)

  // bucket max drives both bar height and the auto-quantize fallback.
  const max = useMemo(
    () => buckets.reduce((m, b) => Math.max(m, Number(b.value) || 0), 0),
    [buckets],
  )
  const total = useMemo(
    () => buckets.reduce((s, b) => s + (Number(b.value) || 0), 0),
    [buckets],
  )

  const playheadIndex = fractionToIndex(fraction, count)
  const current = buckets[playheadIndex]

  // the slider's value domain is the bucket index (an integer step the AT can
  // announce), exposed as aria-valuenow / min / max. the readout text gives the
  // human-legible "label · value" so the position never depends on colour.
  const readout = current
    ? `${current.label} · ${Number(current.value) || 0} ${
        (Number(current.value) || 0) === 1 ? 'session' : 'sessions'
      }`
    : 'no activity'

  const commit = useCallback(
    (nextIndex) => {
      const idx = clamp(Math.round(nextIndex), 0, Math.max(0, count - 1))
      const nextFraction = indexToFraction(idx, count)
      if (!isControlled) setInternal(nextFraction)
      onScrub?.(nextFraction, idx)
    },
    [count, isControlled, onScrub],
  )

  // pointer → bucket index from the track geometry (right-anchored, but the
  // index math is uniform left→right so the leftmost x is bucket 0).
  const scrubFromPointer = useCallback(
    (clientX) => {
      const el = trackRef.current
      if (!el || count === 0) return
      const rect = el.getBoundingClientRect()
      const f = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
      commit(fractionToIndex(f, count))
    },
    [commit, count],
  )

  const onPointerDown = useCallback(
    (e) => {
      if (count === 0) return
      e.currentTarget.setPointerCapture?.(e.pointerId)
      scrubFromPointer(e.clientX)
    },
    [count, scrubFromPointer],
  )
  const onPointerMove = useCallback(
    (e) => {
      // only scrub while the pointer is captured (a drag), not on hover.
      if (count === 0 || !e.currentTarget.hasPointerCapture?.(e.pointerId)) return
      scrubFromPointer(e.clientX)
    },
    [count, scrubFromPointer],
  )

  const onKeyDown = useCallback(
    (e) => {
      if (count === 0) return
      const big = Math.max(1, Math.round(count / 10))
      let next = playheadIndex
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = playheadIndex - 1
          break
        case 'ArrowRight':
        case 'ArrowUp':
          next = playheadIndex + 1
          break
        case 'PageDown':
          next = playheadIndex - big
          break
        case 'PageUp':
          next = playheadIndex + big
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = count - 1
          break
        default:
          return
      }
      e.preventDefault()
      commit(next)
    },
    [commit, count, playheadIndex],
  )

  const shownBranches = branches.slice(0, maxBranchChips)
  const overflow = branches.length - shownBranches.length

  // covered region: from the playhead to the right edge ("now"). expressed as a
  // left inset percentage so it highlights everything up to & including current.
  const coveredLeftPct = count > 1 ? (playheadIndex / (count - 1)) * 100 : 0
  // playhead x as a percentage of the track (left→right, bucket-centred).
  const playheadPct = count > 1 ? (playheadIndex / (count - 1)) * 100 : 100

  return (
    <section
      className={`ts2-scope ts2${className ? ` ${className}` : ''}`}
      aria-label={label}
      {...rest}
    >
      {/* top row — open-branch chips (left) and the "now" marker label (right). */}
      {(shownBranches.length > 0 || overflow > 0) && (
        <div className="ts2-branches">
          {shownBranches.map((b, i) => (
            <span key={`${b.label}-${i}`} className="ts2-chip" title={`branch ${b.label}`}>
              {b.label}
            </span>
          ))}
          {overflow > 0 && (
            <span
              className="ts2-chip ts2-chip--more"
              title={branches.slice(maxBranchChips).map((b) => b.label).join(', ')}
            >
              +{overflow}
            </span>
          )}
        </div>
      )}

      {/* the strip: bars + the playhead, one focusable slider. */}
      <div
        ref={trackRef}
        className="ts2-track"
        role="slider"
        tabIndex={count > 0 ? 0 : -1}
        aria-label={`${label} scrubber`}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, count - 1)}
        aria-valuenow={playheadIndex}
        aria-valuetext={readout}
        aria-describedby={readoutId}
        aria-orientation="horizontal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      >
        {/* covered region — a faint amber wash from the playhead to "now". */}
        {count > 0 && (
          <span
            className="ts2-covered"
            aria-hidden="true"
            style={{ left: `${coveredLeftPct}%` }}
          />
        )}

        {/* bars — one quantized vertical bar per bucket, right-anchored so the
            newest bucket hugs the right edge and history clips on the left. */}
        <div className="ts2-bars" aria-hidden="true">
          {buckets.map((b, i) => {
            const v = Number(b.value) || 0
            const level = b.intensity != null ? clampLevel(b.intensity) : quantize(v, max)
            // height ∝ value (min 2px sliver so an empty bucket still reads).
            const hPct = max > 0 ? Math.max((v / max) * 100, v > 0 ? 8 : 2) : 2
            return (
              <span
                key={`${b.label}-${i}`}
                className="ts2-bar"
                data-level={level}
                data-on={i === playheadIndex ? 'true' : undefined}
                style={{ height: `${hPct}%` }}
              />
            )
          })}
        </div>

        {/* the playhead — a vertical rule with a top grip, anchored on its
            bucket. it rides the same left→right percentage as the bars. */}
        {count > 0 && (
          <span className="ts2-playhead" aria-hidden="true" style={{ left: `${playheadPct}%` }}>
            <span className="ts2-playhead__grip" />
          </span>
        )}

        {/* the "now" edge — a hairline + label pinned to the right. */}
        {count > 0 && <span className="ts2-now" aria-hidden="true">now</span>}
      </div>

      {/* baseline + the accessible, always-visible readout. */}
      <div className="ts2-foot">
        <span className="ts2-foot__total" aria-hidden="true">
          {total} {total === 1 ? 'session' : 'sessions'} · {count} {count === 1 ? 'bucket' : 'buckets'}
        </span>
        <output id={readoutId} className="ts2-foot__readout">
          {readout}
        </output>
      </div>
    </section>
  )
}

export default TimeStrip
