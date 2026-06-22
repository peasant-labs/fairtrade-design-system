import { useEffect, useRef, useState } from 'react'
import { X, ShieldCheck } from 'lucide-react'
import './ConsentDialog.css'

/* ───────────────────────────────────────────────────────────────────────────
   ConsentDialog family — fairtrade "in use" governance pattern
   ─────────────────────────────────────────────────────────────────────────
   the consent / governance dialog, generalized from village's JoinConsentDialog
   / ConfirmContributeDialog / LeaveCollectiveDialog. the whole point is to name,
   before an irreversible-ish action, exactly WHAT crosses a boundary and TO WHOM
   — identity visibility, data access, contribution, retention. so the dialog is
   not a generic confirm: its body is a structured <ConsentSummary> of governance
   axes plus an explicit "i understand and consent" gate on the primary action.

   the chrome (title, close, axis keys, checkbox, buttons) is mono + lowercase;
   the intro is reading prose in var(--font-body); user content (collective names,
   handles, transcript titles) is NEVER lowercased — pass it through .cns-name /
   .cns-mono which only set the font, not text-transform. tokens only, square
   corners, hairline rules. classes are namespaced `cns-`. focus-trap + esc +
   return-focus are implemented minimally here (it is a showcase, but it should
   still behave). ─────────────────────────────────────────────────────────── */

/**
 * @typedef {Object} ConsentAxis
 * @property {React.ElementType} [icon]  lucide component for the row (rendered in a square chip)
 * @property {string} key                the mono, lowercase axis label (e.g. "identity", "data access")
 * @property {React.ReactNode} value      the chosen value — may contain user content (NOT lowercased)
 * @property {React.ReactNode} [scope]    optional "who can see / what changes" note shown under the value
 * @property {'reveal'|'open'|'restricted'} [tone]  colors the icon chip: reveal=amber, open=teal, restricted=clay
 */

/**
 * ConsentSummary — the reusable axes block. an aligned grid of rows, each an icon
 * chip + a mono key + the value (+ an optional scope note). this is the seed that
 * already lived in the join dialog; here it is generalized so every governance
 * dialog renders the same legible "here is what is at stake" panel.
 *
 * @param {Object} props
 * @param {ConsentAxis[]} props.axes              the rows to render
 * @param {string} [props.caption]                optional mono eyebrow above the rows
 * @param {string} [props.className]              extra classes appended after .cns-summary
 */
export function ConsentSummary({ axes = [], caption, className, ...rest }) {
  const cls = ['cns-summary', className].filter(Boolean).join(' ')
  return (
    <div className={cls} {...rest}>
      {caption && <p className="cns-summary-cap">{caption}</p>}
      <dl className="cns-axes">
        {axes.map((axis, i) => {
          const Icon = axis.icon
          const tone = axis.tone ? `cns-axis--${axis.tone}` : ''
          return (
            <div className={['cns-axis', tone].filter(Boolean).join(' ')} key={axis.key ?? i}>
              <span className="cns-axis-chip" aria-hidden="true">
                {Icon && <Icon size={16} aria-hidden="true" />}
              </span>
              <dt className="cns-axis-key">{axis.key}</dt>
              <dd className="cns-axis-val">
                <span className="cns-axis-value">{axis.value}</span>
                {axis.scope && <span className="cns-axis-scope">{axis.scope}</span>}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

/**
 * ConsentDialog — a scrim + bordered modal that frames a governance decision.
 * structure: head (mono lowercase title + close) / body (intro prose, a
 * <ConsentSummary>, an optional "i understand and consent" checkbox, optional
 * extra children rendered after the summary) / foot (cancel secondary + the
 * primary confirm in amber). when `requireConsent`, the primary stays disabled
 * until the checkbox is ticked, so the irreversible action never rides on a
 * single reflexive click.
 *
 * controlled by `open` + `onCancel`. focus is trapped while open; Escape and a
 * scrim click cancel; focus returns to whatever was focused when it opened (or
 * `returnFocusRef` if given); background scroll is locked.
 *
 * @param {Object} props
 * @param {boolean} props.open                       whether the dialog is mounted/visible
 * @param {React.ReactNode} props.title              the mono lowercase head title (may embed a .cns-name)
 * @param {React.ReactNode} [props.intro]            reading-prose lede above the summary
 * @param {ConsentAxis[]} [props.axes]               axes for the embedded <ConsentSummary>
 * @param {string} [props.summaryCaption]            eyebrow above the summary rows
 * @param {React.ReactNode} [props.children]         extra content rendered after the summary (e.g. a retention choice)
 * @param {string} [props.confirmLabel='confirm']    primary button label (mono lowercase)
 * @param {React.ElementType} [props.confirmIcon]    lucide icon for the primary button
 * @param {string} [props.cancelLabel='cancel']      secondary button label
 * @param {() => void} props.onCancel                called on cancel / esc / scrim / close
 * @param {() => void} props.onConfirm               called when the (enabled) primary is pressed
 * @param {boolean} [props.requireConsent=true]      gate the primary behind the consent checkbox
 * @param {React.ReactNode} [props.consentLabel]     the checkbox label (default "i understand and consent")
 * @param {'primary'|'danger'} [props.tone='primary'] primary button treatment (danger for leave/retract)
 * @param {boolean} [props.busy=false]               disables controls + shows the primary as busy
 * @param {string} [props.labelId='cns-title']       id wiring aria-labelledby (unique it if two can co-exist)
 * @param {React.RefObject<HTMLElement>} [props.returnFocusRef]  where to send focus on close
 */
export default function ConsentDialog({
  open,
  title,
  intro,
  axes,
  summaryCaption,
  children,
  confirmLabel = 'confirm',
  confirmIcon: ConfirmIcon = ShieldCheck,
  cancelLabel = 'cancel',
  onCancel,
  onConfirm,
  requireConsent = true,
  consentLabel = 'i understand and consent',
  tone = 'primary',
  busy = false,
  labelId = 'cns-title',
  returnFocusRef,
}) {
  const dialogRef = useRef(null)
  const [consented, setConsented] = useState(false)

  // latest callbacks via refs so the focus effect can depend ONLY on `open` —
  // depending on onCancel (a fresh closure each render) would re-run the effect
  // mid-open and its cleanup would yank focus back to the trigger while open.
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  const rfRef = useRef(returnFocusRef)
  rfRef.current = returnFocusRef

  // re-arm the consent gate each time the dialog (re)opens.
  useEffect(() => {
    if (open) setConsented(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement
    const dlg = dialogRef.current
    const focusables = () =>
      [...dlg.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.offsetParent !== null || el === document.activeElement)
    ;(focusables()[0] || dlg).focus()

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelRef.current?.(); return }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (!items.length) { e.preventDefault(); dlg.focus(); return }
      const a = items[0]
      const z = items[items.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      const rf = rfRef.current
      const target = (rf && rf.current) || prevFocus
      // defer a frame: focusing synchronously races the browser moving focus to
      // <body> as the dialog DOM is torn down.
      if (target && typeof target.focus === 'function') requestAnimationFrame(() => target.focus())
    }
  }, [open])

  if (!open) return null

  const gateBlocks = requireConsent && !consented
  const primaryDisabled = busy || gateBlocks
  const primaryClass = ['cns-btn', tone === 'danger' ? 'cns-btn--danger' : 'cns-btn--primary']
    .filter(Boolean)
    .join(' ')

  const handleConfirm = () => {
    if (primaryDisabled) return
    onConfirm?.()
  }

  return (
    <div
      className="cns-overlay"
      onMouseDown={(e) => { if (e.target.classList.contains('cns-scrim') && !busy) onCancel?.() }}
    >
      <div className="cns-scrim" />
      <div
        className="cns-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
      >
        <div className="cns-head">
          <h3 id={labelId} className="cns-title">{title}</h3>
          <button
            type="button"
            className="cns-close"
            aria-label="close dialog"
            onClick={() => { if (!busy) onCancel?.() }}
            disabled={busy}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="cns-body">
          {intro && <div className="cns-intro">{intro}</div>}

          {axes && axes.length > 0 && (
            <ConsentSummary axes={axes} caption={summaryCaption} />
          )}

          {children}

          {requireConsent && (
            <label className="cns-consent">
              <input
                type="checkbox"
                className="cns-consent-box"
                checked={consented}
                disabled={busy}
                onChange={(e) => setConsented(e.target.checked)}
              />
              <span className="cns-consent-label">{consentLabel}</span>
            </label>
          )}
        </div>

        <div className="cns-foot">
          <button
            type="button"
            className="cns-btn cns-btn--ghost"
            onClick={() => { if (!busy) onCancel?.() }}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={primaryClass}
            onClick={handleConfirm}
            disabled={primaryDisabled}
            aria-busy={busy || undefined}
          >
            {busy ? (
              <span className="cns-spin" aria-hidden="true" />
            ) : (
              ConfirmIcon && <ConfirmIcon size={16} aria-hidden="true" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
