import { CircleAlert, CircleCheck, CircleX, LoaderCircle, SearchX, X } from 'lucide-react'

/* the feedback surfaces from sections/36-states.html: skeleton, progress, spinner,
   toast and inline panel. each pairs an icon with a label (never colour alone, WCAG
   1.4.1) and wires the right live region (status for polite, alert for errors). motion
   is opt-in: the CSS animates the shimmer / spinner only under prefers-reduced-motion:
   no-preference, so we don't touch animation here. all styling lives in the .fb-*
   classes — zero new CSS. lucide icons get aria-hidden (the surrounding label + role
   carries the meaning); sizes come from the CSS (.lucide rules), so we let the icon
   default to its rendered size and the stylesheet clamps it via width/height. */

/**
 * Skeleton — a placeholder block that mirrors the shape of loading content.
 * @typedef {Object} SkeletonProps
 * @property {string} [label='loading'] aria-label announcing what is loading.
 * @property {boolean} [avatar=true]    render the leading 32px avatar block + two
 *                                      stacked lines (w-40 / w-70) at the top.
 * @property {number} [lines=2]         number of full-width body lines below the row;
 *                                      they cycle through w-90 / w-70 widths.
 * @property {string} [className]       extra classes appended to the .fb-skel root.
 */

/**
 * @param {SkeletonProps} props
 */
export function Skeleton({ label = 'loading', avatar = true, lines = 2, className }) {
  const widths = ['w-90', 'w-70']
  return (
    <div
      className={className ? `fb-skel ${className}` : 'fb-skel'}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {avatar && (
        <div className="fb-skel-row">
          <span className="fb-skel-block fb-skel-av" aria-hidden="true" />
          <span className="fb-skel-lines">
            <span className="fb-skel-line w-40" />
            <span className="fb-skel-line w-70" />
          </span>
        </div>
      )}
      {Array.from({ length: Math.max(0, lines) }, (_, i) => (
        <span key={i} className={`fb-skel-line ${widths[i % widths.length]}`} />
      ))}
    </div>
  )
}

/**
 * Progress — a determinate progress bar with a labelled head + tabular percent.
 * @typedef {Object} ProgressProps
 * @property {number} [value=0]         current value, 0–100 (clamped); drives the fill
 *                                      width and aria-valuenow + the displayed percent.
 * @property {number} [min=0]           aria-valuemin.
 * @property {number} [max=100]         aria-valuemax.
 * @property {React.ReactNode} [label]  caption shown at the left of the head row.
 * @property {string} [ariaLabel]       accessible name for the track (progressbar);
 *                                      falls back to the string `label` when omitted.
 * @property {boolean} [showPct=true]   render the tabular percent on the right.
 * @property {string} [className]       extra classes appended to the .fb-prog root.
 */

/**
 * @param {ProgressProps} props
 */
export function Progress({
  value = 0,
  min = 0,
  max = 100,
  label,
  ariaLabel,
  showPct = true,
  className,
}) {
  const pct = Math.max(0, Math.min(100, value))
  const trackLabel = ariaLabel ?? (typeof label === 'string' ? label : undefined)
  return (
    <div className={className ? `fb-prog ${className}` : 'fb-prog'}>
      {(label != null || showPct) && (
        <div className="fb-prog-head">
          <span>{label}</span>
          {showPct && <span className="fb-prog-pct tnum">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className="fb-prog-track"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={trackLabel}
      >
        <div className="fb-prog-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/**
 * Spinner — an inline busy marker: spinning icon + lowercase label, in a live region.
 * @typedef {Object} SpinnerProps
 * @property {React.ReactNode} [children] label text beside the icon (the live message).
 * @property {React.ComponentType} [icon=LoaderCircle] icon component reference; the CSS
 *                                      spins .lucide only under no-preference + aria-busy.
 * @property {string} [className]       extra classes appended to the .fb-spin root.
 */

/**
 * @param {SpinnerProps} props
 */
export function Spinner({ children, icon: Icon = LoaderCircle, className }) {
  return (
    <span
      className={className ? `fb-spin ${className}` : 'fb-spin'}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Icon aria-hidden="true" /> {children}
    </span>
  )
}

/**
 * Toast — a transient notification: icon + title + message + dismiss button.
 * Render inside an aria-live region (e.g. a wrapper with aria-live="polite") for the
 * announcement; the toast itself carries role status (ok) or alert (error).
 * @typedef {Object} ToastProps
 * @property {'ok'|'err'} [variant='ok'] tone; 'ok' = circle-check/olive + role=status,
 *                                      'err' = circle-x/clay + role=alert.
 * @property {React.ReactNode} title    the .fb-toast-title line.
 * @property {React.ReactNode} [children] the body message (.fb-toast-msg).
 * @property {React.ComponentType} [icon] override the leading icon component reference.
 * @property {() => void} [onClose]     called when the dismiss button is clicked; when
 *                                      omitted the close button is not rendered.
 * @property {string} [closeLabel='dismiss notification'] aria-label for the close button.
 * @property {string} [className]       extra classes appended to the .fb-toast root.
 */

/**
 * @param {ToastProps} props
 */
export function Toast({
  variant = 'ok',
  title,
  children,
  icon: Icon,
  onClose,
  closeLabel = 'dismiss notification',
  className,
}) {
  const isErr = variant === 'err'
  const ToneIcon = Icon ?? (isErr ? CircleX : CircleCheck)
  const cls = ['fb-toast', isErr ? 'is-err' : 'is-ok', className].filter(Boolean).join(' ')
  return (
    <div className={cls} role={isErr ? 'alert' : 'status'}>
      <span className="fb-toast-ico">
        <ToneIcon aria-hidden="true" />
      </span>
      <div className="fb-toast-body">
        {title != null && <div className="fb-toast-title">{title}</div>}
        {children != null && <div className="fb-toast-msg">{children}</div>}
      </div>
      {onClose && (
        <button className="fb-toast-x" type="button" aria-label={closeLabel} onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/**
 * FeedbackPanel — a centred inline state surface (loading / error / empty), with an
 * icon tile, lowercase title and a message. Loading sets aria-busy + role=status;
 * error sets role=alert; the neutral (empty / resolved) panel has no role.
 * @typedef {Object} FeedbackPanelProps
 * @property {'loading'|'error'|'empty'} [variant='empty'] which surface to render; picks
 *                                      the default icon, role and .is-err styling.
 * @property {React.ReactNode} [title]  the .fb-panel-title (defaults per variant).
 * @property {React.ReactNode} [children] the message body (.fb-panel-msg).
 * @property {React.ComponentType} [icon] override the icon component reference; defaults
 *                                      to loader-circle / circle-alert / search-x.
 * @property {string} [className]       extra classes appended to the .fb-panel root.
 */

/**
 * @param {FeedbackPanelProps} props
 */
export function FeedbackPanel({ variant = 'empty', title, children, icon: Icon, className }) {
  const isErr = variant === 'error'
  const isLoading = variant === 'loading'
  const defaults = {
    loading: { icon: LoaderCircle, title: 'loading' },
    error: { icon: CircleAlert, title: 'error' },
    empty: { icon: SearchX, title: 'no results' },
  }
  const preset = defaults[variant] ?? defaults.empty
  const PanelIcon = Icon ?? preset.icon
  const cls = ['fb-panel', isErr && 'is-err', className].filter(Boolean).join(' ')
  return (
    <div
      className={cls}
      role={isErr ? 'alert' : isLoading ? 'status' : undefined}
      aria-busy={isLoading || undefined}
      aria-live={isLoading ? 'polite' : undefined}
    >
      <span className="fb-panel-ico">
        <PanelIcon aria-hidden="true" />
      </span>
      <div className="fb-panel-title">{title ?? preset.title}</div>
      <p className="fb-panel-msg">{children}</p>
    </div>
  )
}

export default Spinner
