import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import './Tour.css'

/* ───────────────────────────────────────────────────────────────────────────
   Tour — fairtrade "in use" guided-tour / spotlight coachmark
   ─────────────────────────────────────────────────────────────────────────
   modeled on peasant's TourProvider / TourOverlay: a full-viewport scrim that
   dims the canvas EXCEPT for a square cut-out around the current step's anchor
   element (resolved by id from real page DOM), a faint amber ring around the
   cut-out, and a coachmark popover beside the anchor with the step title (display
   type), reading-prose body, progress dots (current = amber), and back / next /
   done controls. esc + a skip control close it; focus is trapped inside the
   coachmark.

   the cut-out is drawn as FOUR scrim rectangles around the anchor rect (top /
   bottom / left / right) rather than an SVG mask — so the lit element keeps its
   own painted background and the four panels still catch clicks (the page behind
   the overlay stays inert). the anchor rect is re-measured on resize / scroll via
   a rAF loop while a step is shown, so the spotlight tracks layout changes.

   chrome (eyebrow "step n of m", skip, buttons) is mono + lowercase; the title is
   display type; the body is reading prose in var(--font-body). tokens only, square
   corners, hairline rules, amber kept scarce (only the ring + the active dot). all
   transitions are gated behind prefers-reduced-motion: no-preference — under
   reduced motion the spotlight jumps instantly between steps. classes namespaced
   `tour-`. ────────────────────────────────────────────────────────────────── */

/** padding (px-ish, in CSS px) between the anchor and the spotlight ring. */
const SPOTLIGHT_PADDING = 8
/** gap between the spotlight ring and the coachmark popover. */
const POPOVER_GAP = 12
/** approximate coachmark width, used for horizontal clamping + placement. */
const POPOVER_WIDTH = 340
/** viewport edge inset so the coachmark never touches the screen edge. */
const EDGE_INSET = 16

/**
 * @typedef {Object} TourStep
 * @property {string} anchorId   id (or data-tour value) of the element to spotlight
 * @property {React.ReactNode} title  the coachmark title (display type)
 * @property {React.ReactNode} body   the coachmark prose body (reading type)
 */

/** clamp v into [min, max]. */
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

/**
 * resolve a step's anchor element. accepts a raw element id OR the value of a
 * `data-tour="…"` attribute, so callers can opt into either convention without
 * the anchor needing a globally-unique id.
 */
function resolveAnchor(anchorId) {
  if (!anchorId) return null
  return (
    document.getElementById(anchorId) ||
    document.querySelector(`[data-tour="${CSS.escape(anchorId)}"]`)
  )
}

/**
 * Tour — a portal-rendered spotlight coachmark over real page anchors.
 *
 * controlled by `open`; `onClose` fires on esc / skip / scrim-intent, and
 * `onFinish` fires when "done" is pressed on the last step. internal step index
 * is owned here and re-armed to 0 each time the tour (re)opens.
 *
 * @param {Object} props
 * @param {TourStep[]} props.steps          ordered steps; each spotlights one anchor
 * @param {boolean} props.open              whether the tour is mounted / visible
 * @param {() => void} [props.onClose]      called on esc / skip / scrim (tour dismissed)
 * @param {() => void} [props.onFinish]     called when "done" is pressed on the last step
 * @param {(index: number) => void} [props.onStepChange]  notified when the active step changes
 * @param {string} [props.labelId='tour-title']  id wiring aria-labelledby on the coachmark
 */
export default function Tour({
  steps = [],
  open,
  onClose,
  onFinish,
  onStepChange,
  labelId = 'tour-title',
}) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [mounted, setMounted] = useState(false)
  // a frame counter to recompute the (rAF-tracked) rect on viewport changes
  // without thrashing React state every animation frame.
  const [, bump] = useReducer((n) => n + 1, 0)

  const coachRef = useRef(null)
  const nextBtnRef = useRef(null)

  const count = steps.length
  const step = open && count > 0 ? steps[clamp(index, 0, count - 1)] : null
  const isFirst = index <= 0
  const isLast = index >= count - 1

  // latest callbacks via refs so the key/measure effects depend only on stable
  // triggers (open + index), never on fresh callback closures.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  const onStepChangeRef = useRef(onStepChange)
  onStepChangeRef.current = onStepChange

  useEffect(() => setMounted(true), [])

  // re-arm to the first step each time the tour (re)opens, and lock background
  // scroll while it is shown.
  useEffect(() => {
    if (!open) return
    setIndex(0)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= count - 1) {
        onFinishRef.current?.()
        return i
      }
      const next = i + 1
      onStepChangeRef.current?.(next)
      return next
    })
  }, [count])

  const goPrev = useCallback(() => {
    setIndex((i) => {
      if (i <= 0) return i
      const prev = i - 1
      onStepChangeRef.current?.(prev)
      return prev
    })
  }, [])

  const close = useCallback(() => {
    onCloseRef.current?.()
  }, [])

  // measure + track the current step's anchor. poll via rAF so the spotlight
  // stays glued to the anchor through scroll / resize / layout shifts; also bring
  // the anchor into view when a step activates so the spotlight isn't off-screen.
  useLayoutEffect(() => {
    if (!step) {
      setRect(null)
      return
    }
    let raf = 0
    let cancelled = false

    const el = resolveAnchor(step.anchorId)
    if (el) {
      el.scrollIntoView({
        behavior:
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: no-preference)').matches
            ? 'smooth'
            : 'auto',
        block: 'nearest',
        inline: 'nearest',
      })
    }

    const read = () => {
      const node = resolveAnchor(step.anchorId)
      if (!node) {
        setRect((r) => (r === null ? r : null))
        return
      }
      const r = node.getBoundingClientRect()
      setRect((prev) => {
        if (
          prev &&
          prev.top === r.top &&
          prev.left === r.left &&
          prev.width === r.width &&
          prev.height === r.height
        ) {
          return prev
        }
        return { top: r.top, left: r.left, width: r.width, height: r.height }
      })
    }

    const tick = () => {
      if (cancelled) return
      read()
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
    }
  }, [step, index])

  // recompute geometry on resize so popover placement / clamping stay correct.
  useEffect(() => {
    if (!step) return
    const onResize = () => bump()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [step])

  // move focus to the primary ("next" / "done") action when a step activates;
  // restore focus to whatever was focused when the tour opened, on unmount.
  useLayoutEffect(() => {
    if (!step) return
    const prevFocus = document.activeElement
    // defer a frame so the coachmark has painted at its placed position.
    const id = window.requestAnimationFrame(() => {
      nextBtnRef.current?.focus()
    })
    return () => {
      window.cancelAnimationFrame(id)
      if (prevFocus && typeof prevFocus.focus === 'function') {
        requestAnimationFrame(() => prevFocus.focus())
      }
    }
    // re-run per step so each step re-focuses its primary action.
  }, [step])

  // keyboard: esc closes, arrow-right / arrow-left step, tab is trapped inside
  // the coachmark.
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (!isFirst) goPrev()
        return
      }
      if (e.key === 'Tab') {
        const root = coachRef.current
        if (!root) return
        const items = [
          ...root.querySelectorAll(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((el) => el.offsetParent !== null || el === document.activeElement)
        if (!items.length) {
          e.preventDefault()
          root.focus()
          return
        }
        const a = items[0]
        const z = items[items.length - 1]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          z.focus()
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault()
          a.focus()
        }
      }
    },
    [close, goNext, goPrev, isFirst],
  )

  if (!mounted || !step) return null

  const vw = window.innerWidth
  const vh = window.innerHeight

  // spotlight ring geometry (anchor rect, padded). with no resolvable anchor we
  // dim the whole viewport and center the coachmark.
  const ring = rect
    ? {
        top: rect.top - SPOTLIGHT_PADDING,
        left: rect.left - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      }
    : null

  // coachmark placement: below the ring when there's room, otherwise above; fall
  // back to viewport-centered when there's no anchor.
  let coachStyle
  let placement = 'center'
  if (ring) {
    const spaceBelow = vh - (ring.top + ring.height)
    const placeBelow = spaceBelow > 220 || spaceBelow > ring.top
    placement = placeBelow ? 'below' : 'above'
    const left = clamp(
      ring.left + ring.width / 2 - POPOVER_WIDTH / 2,
      EDGE_INSET,
      Math.max(EDGE_INSET, vw - POPOVER_WIDTH - EDGE_INSET),
    )
    coachStyle = placeBelow
      ? { top: ring.top + ring.height + POPOVER_GAP, left, width: POPOVER_WIDTH }
      : { bottom: vh - ring.top + POPOVER_GAP, left, width: POPOVER_WIDTH }
  } else {
    coachStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: POPOVER_WIDTH,
    }
  }

  return createPortal(
    <div
      className="tour-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      onKeyDown={onKeyDown}
    >
      {/* scrim: four panels around the ring leave a square cut-out over the
          anchor. without an anchor, a single full-viewport panel. */}
      {ring ? (
        <>
          <span
            className="tour-scrim"
            aria-hidden="true"
            style={{ top: 0, left: 0, width: vw, height: Math.max(0, ring.top) }}
          />
          <span
            className="tour-scrim"
            aria-hidden="true"
            style={{
              top: ring.top + ring.height,
              left: 0,
              width: vw,
              height: Math.max(0, vh - (ring.top + ring.height)),
            }}
          />
          <span
            className="tour-scrim"
            aria-hidden="true"
            style={{ top: ring.top, left: 0, width: Math.max(0, ring.left), height: ring.height }}
          />
          <span
            className="tour-scrim"
            aria-hidden="true"
            style={{
              top: ring.top,
              left: ring.left + ring.width,
              width: Math.max(0, vw - (ring.left + ring.width)),
              height: ring.height,
            }}
          />
          {/* the faint amber spotlight ring (the one scarce accent). */}
          <span
            className="tour-ring"
            aria-hidden="true"
            style={{ top: ring.top, left: ring.left, width: ring.width, height: ring.height }}
          />
        </>
      ) : (
        <span
          className="tour-scrim"
          aria-hidden="true"
          style={{ top: 0, left: 0, width: vw, height: vh }}
        />
      )}

      {/* the coachmark popover */}
      <div
        className={`tour-coach tour-coach--${placement}`}
        ref={coachRef}
        style={coachStyle}
        tabIndex={-1}
      >
        <div className="tour-coach-head">
          <p className="tour-eyebrow">
            step {index + 1} of {count}
          </p>
          <button
            type="button"
            className="tour-close"
            aria-label="skip tour"
            onClick={close}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="tour-coach-body">
          <h2 id={labelId} className="tour-title">
            {step.title}
          </h2>
          <div className="tour-prose">{step.body}</div>
        </div>

        <div className="tour-coach-foot">
          {/* progress dots — current is amber; status is also announced as text
              in the eyebrow above, so it never rides on color alone. */}
          <ol className="tour-dots" aria-hidden="true">
            {steps.map((s, i) => (
              <li
                key={s.anchorId ?? i}
                className={`tour-dot${i === index ? ' tour-dot--on' : ''}`}
              />
            ))}
          </ol>

          <div className="tour-actions">
            <button
              type="button"
              className="tour-btn tour-btn--ghost"
              onClick={goPrev}
              disabled={isFirst}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              back
            </button>
            <button
              type="button"
              className="tour-btn tour-btn--primary"
              ref={nextBtnRef}
              onClick={goNext}
            >
              {isLast ? (
                <>
                  <Check size={16} aria-hidden="true" />
                  done
                </>
              ) : (
                <>
                  next
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
