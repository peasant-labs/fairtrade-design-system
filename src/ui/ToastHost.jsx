import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react'
import { Toast } from './Feedback.jsx'

/* toast host (tsx-*): a NEW tier-2 layer over the presentational Toast (Feedback.jsx).
   it adds the queue, auto-dismiss, and the imperative toast.ok()/toast.err() api without
   changing the look of a single toast. one fixed, persistent aria-live="polite" region
   created up front (a region added with its content is not reliably announced); the inner
   Toast owns its own role (status for ok, alert for err), mirroring the status vs alert
   split in Feedback.jsx, so the wrapper adds no second live region. each toast owns a
   setTimeout(duration) that PAUSES on pointer-enter / focus-within and resumes only when
   focus or the pointer truly leaves the host (a neuroinclusive must: never yank a message
   a slow reader is mid-way through, and never reset the countdown when tabbing between
   stacked toasts). max caps the visible stack and hard-drops the oldest from the front
   (fifo) so the live stack never overflows, never stacks off-screen. dismiss flips state
   to 'leave', waits one --dur-2 (0 under reduced-motion) then removes. styling (tone,
   border, icon, the dismiss target) is inherited from .fb-toast; the tsx-* css owns only
   placement, stacking, width and the enter/exit motion. amber stays scarce (status is
   olive/clay), square, all-lowercase chrome, no portals (fixed node, like the dialog). */

const ToastCtx = createContext(null)

// the exit transition window before removal, read from --dur-2 so it can never drift
// from the css exit animation. falls back to 160 when there is no document (ssr/tests).
function exitMs() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 160
  const v = getComputedStyle(document.documentElement).getPropertyValue('--dur-2')
  return parseFloat(v) || 160
}

const TONE = {
  ok: { icon: CircleCheck, title: 'done' },
  err: { icon: CircleX, title: 'something went wrong' },
}

function reducer(state, action) {
  switch (action.type) {
    case 'add': {
      // cap on insert: hard-remove the oldest non-leaving toast from the front (fifo).
      // dropping it from state (rather than flipping to 'leave') keeps the live stack at
      // most `max` tall, so a capped drop can never overflow the host and clip mid-row.
      let next = state
      const live = next.filter((t) => t.state !== 'leave')
      if (live.length >= action.max) {
        const oldest = live[0]
        next = next.filter((t) => t.id !== oldest.id)
      }
      return [...next, action.toast]
    }
    case 'leave':
      return state.map((t) => (t.id === action.id ? { ...t, state: 'leave' } : t))
    case 'remove':
      return state.filter((t) => t.id !== action.id)
    case 'patch':
      return state.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t))
    case 'clear':
      return state.map((t) => ({ ...t, state: 'leave' }))
    default:
      return state
  }
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * @typedef {Object} ToastOpts
 * @property {React.ReactNode} [title]    the title line; defaults to the tone label.
 * @property {'ok'|'err'} [variant]       tone; defaults per method ('ok' for show()).
 * @property {React.ComponentType} [icon] override the leading lucide glyph.
 * @property {number} [duration]          per-toast auto-dismiss ms; 0/Infinity = sticky.
 * @property {string} [closeLabel]        aria-label for the dismiss button.
 * @property {string} [id]                supply to dedupe / target with update().
 */

/**
 * ToastProvider — wraps a subtree and renders the fixed stacking host. children that
 * call useToast() get a stable imperative api (memoised; identity never changes).
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children          the app subtree that may call useToast().
 * @param {'bottom-right'|'bottom-left'|'top-right'|'top-left'|'bottom-center'|'top-center'} [props.placement='bottom-right']
 *        which corner the fixed region pins to and the edge new toasts enter from.
 * @param {number} [props.max=4]                    cap on simultaneously-visible toasts.
 * @param {number} [props.duration=5000]            default auto-dismiss ms; 0/Infinity = sticky.
 * @param {boolean} [props.inline=false]            pin the host absolutely inside a relative
 *        container (for an in-frame doc/story example) instead of fixed to the viewport.
 */
export function ToastProvider({
  children,
  placement = 'bottom-right',
  max = 4,
  duration = 5000,
  inline = false,
}) {
  const [toasts, dispatch] = useReducer(reducer, [])
  const idSeed = useId()
  const counter = useRef(0)
  // per-toast timer bookkeeping: { timer, remaining, startedAt }.
  const timers = useRef(new Map())
  // insertion order of currently-live (non-leaving) toast ids, used to apply the fifo
  // cap and clean up the dropped toast's timer without reading state in show().
  const liveIds = useRef([])
  const paused = useRef(false)

  const remove = useCallback((id) => {
    const rec = timers.current.get(id)
    if (rec?.timer) clearTimeout(rec.timer)
    timers.current.delete(id)
    dispatch({ type: 'remove', id })
  }, [])

  const dismiss = useCallback(
    (id) => {
      const rec = timers.current.get(id)
      if (rec?.timer) {
        clearTimeout(rec.timer)
        timers.current.set(id, { ...rec, timer: null })
      }
      // a leaving toast no longer counts toward the live cap.
      liveIds.current = liveIds.current.filter((x) => x !== id)
      dispatch({ type: 'leave', id })
      const wait = prefersReducedMotion() ? 0 : exitMs()
      const t = setTimeout(() => remove(id), wait)
      timers.current.set(id, { ...timers.current.get(id), exit: t })
    },
    [remove],
  )

  const arm = useCallback(
    (id, ms) => {
      if (!ms || ms === Infinity || !Number.isFinite(ms)) return // sticky
      const timer = setTimeout(() => dismiss(id), ms)
      timers.current.set(id, { timer, remaining: ms, startedAt: Date.now() })
    },
    [dismiss],
  )

  const show = useCallback(
    (opts = {}) => {
      const variant = opts.variant === 'err' ? 'err' : 'ok'
      const preset = TONE[variant]
      const id = opts.id ?? `${idSeed}-${(counter.current += 1)}`
      const dur = opts.duration ?? duration
      const toast = {
        id,
        variant,
        title: opts.title ?? preset.title,
        message: opts.message,
        icon: opts.icon ?? preset.icon,
        duration: dur,
        closeLabel: opts.closeLabel ?? 'dismiss notification',
        state: 'enter',
      }
      // mirror the reducer's fifo cap so the dropped toast's timer is cleared too
      // (the reducer is pure and cannot reach the timer map). liveIds tracks insertion
      // order of non-leaving toasts via a ref, so show() keeps a stable identity.
      if (liveIds.current.length >= max) {
        const droppedId = liveIds.current.shift()
        const rec = timers.current.get(droppedId)
        if (rec?.timer) clearTimeout(rec.timer)
        if (rec?.exit) clearTimeout(rec.exit)
        timers.current.delete(droppedId)
      }
      liveIds.current.push(id)
      dispatch({ type: 'add', toast, max })
      arm(id, dur)
      return id
    },
    [arm, duration, idSeed, max],
  )

  const update = useCallback(
    (id, opts = {}) => {
      const patch = {}
      if ('title' in opts) patch.title = opts.title
      if ('message' in opts) patch.message = opts.message
      if ('variant' in opts) {
        patch.variant = opts.variant === 'err' ? 'err' : 'ok'
        if (!('icon' in opts) && !('title' in opts)) {
          // realign the default glyph to the new tone when not explicitly set.
          patch.icon = TONE[patch.variant].icon
        }
      }
      if ('icon' in opts) patch.icon = opts.icon
      if ('closeLabel' in opts) patch.closeLabel = opts.closeLabel
      dispatch({ type: 'patch', id, patch })
      if ('duration' in opts) {
        const rec = timers.current.get(id)
        if (rec?.timer) clearTimeout(rec.timer)
        arm(id, opts.duration)
      }
    },
    [arm],
  )

  const api = useMemo(() => {
    const ok = (message, opts) => show({ ...opts, message, variant: 'ok' })
    const err = (message, opts) => show({ ...opts, message, variant: 'err' })
    const dismissAll = () => {
      for (const [id, rec] of timers.current) {
        if (rec?.timer) clearTimeout(rec.timer)
      }
      // every toast is leaving; none counts toward the live cap any more.
      liveIds.current = []
      // run the exit transition on each, then remove.
      dispatch({ type: 'clear' })
      const wait = prefersReducedMotion() ? 0 : exitMs()
      const snapshot = Array.from(timers.current.keys())
      setTimeout(() => {
        for (const id of snapshot) remove(id)
      }, wait)
    }
    const promise = (p, msgs = {}) => {
      const id = show({
        message: msgs.pending ?? 'working',
        title: msgs.pendingTitle ?? 'in progress',
        icon: LoaderCircle,
        duration: Infinity,
      })
      Promise.resolve(p).then(
        (value) => {
          const r = typeof msgs.ok === 'function' ? msgs.ok(value) : msgs.ok
          update(id, { variant: 'ok', message: r ?? 'done', duration })
          return value
        },
        (error) => {
          const r = typeof msgs.err === 'function' ? msgs.err(error) : msgs.err
          update(id, { variant: 'err', message: r ?? 'something went wrong', duration })
          throw error
        },
      )
      return id
    }
    return { ok, err, show, dismiss, dismissAll, update, promise }
  }, [show, dismiss, update, remove, duration])

  // pause every armed timer on hover / focus within the host; resume on leave.
  const pauseAll = useCallback(() => {
    if (paused.current) return
    paused.current = true
    for (const [id, rec] of timers.current) {
      if (rec?.timer) {
        clearTimeout(rec.timer)
        const elapsed = Date.now() - (rec.startedAt ?? Date.now())
        const remaining = Math.max(0, (rec.remaining ?? 0) - elapsed)
        timers.current.set(id, { ...rec, timer: null, remaining })
      }
    }
  }, [])

  const resumeAll = useCallback(() => {
    if (!paused.current) return
    paused.current = false
    for (const [id, rec] of timers.current) {
      if (rec && rec.timer == null && rec.remaining > 0) {
        const timer = setTimeout(() => dismiss(id), rec.remaining)
        timers.current.set(id, { ...rec, timer, startedAt: Date.now() })
      }
    }
  }, [dismiss])

  // clear every pending timer on unmount.
  useEffect(() => {
    const map = timers.current
    return () => {
      for (const [, rec] of map) {
        if (rec?.timer) clearTimeout(rec.timer)
        if (rec?.exit) clearTimeout(rec.exit)
      }
      map.clear()
    }
  }, [])

  const hostCls = ['tsx-host', `tsx-${placement}`, inline && 'tsx-host--inline']
    .filter(Boolean)
    .join(' ')

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        className={hostCls}
        aria-live="polite"
        aria-atomic="false"
        onMouseEnter={pauseAll}
        onMouseLeave={resumeAll}
        onFocusCapture={pauseAll}
        onBlur={(e) => {
          // only resume when focus actually leaves the host; ignore moves between toasts.
          if (!e.currentTarget.contains(e.relatedTarget)) resumeAll()
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} className="tsx-item" data-state={t.state}>
            <Toast
              variant={t.variant}
              title={t.title}
              icon={t.icon}
              closeLabel={t.closeLabel}
              onClose={() => dismiss(t.id)}
            >
              {t.message}
            </Toast>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/**
 * useToast — the imperative api object from the nearest ToastProvider. throws a clear
 * lowercase error when called outside a provider so a missing host is caught in dev.
 * @returns {{ ok: Function, err: Function, show: Function, dismiss: Function, dismissAll: Function, update: Function, promise: Function }}
 */
export function useToast() {
  const ctx = useContext(ToastCtx)
  if (ctx == null) throw new Error('usetoast must be used inside a toastprovider')
  return ctx
}

export default ToastProvider
