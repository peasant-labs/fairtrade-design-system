import { cloneElement, useEffect, useId, useRef, useState } from 'react'

/* tooltip + popover overlays (the interactive version of the canvas-section specimens, and the
   pattern the apps copy). both reuse the namespaced .tip-* / .pop-* styling so the live tools match
   the documented ones: square, hairline, surface-elev floating panels positioned with css only. */

/**
 * @typedef {Object} TooltipProps
 * @property {React.ReactNode} content    short, single-line helper text shown in the .tip-bubble (role=tooltip).
 * @property {React.ReactNode} children   the trigger; receives id-less wiring via aria-describedby.
 * @property {string} [id]                id for the bubble, linked from the trigger via aria-describedby. auto-generated if omitted.
 */

/* Tooltip: wraps a trigger (.tip-anchor) and shows a .tip-bubble (role=tooltip) on hover/focus,
   hiding on blur/leave/Esc. the trigger is described by the bubble via aria-describedby — a tooltip
   only supplements a control that already carries its own name, never as the sole label. */
export default function Tooltip({ content, children, id }) {
  const autoId = useId()
  const tipId = id || `tip-${autoId}`
  const [open, setOpen] = useState(false)

  const show = () => setOpen(true)
  const hide = () => setOpen(false)
  const onKeyDown = (e) => { if (e.key === 'Escape' && open) { setOpen(false) } }

  return (
    <span
      className="tip-anchor"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      onKeyDown={onKeyDown}
    >
      <Described describedById={tipId}>{children}</Described>
      {open && (
        <span className="tip-bubble" role="tooltip" id={tipId}>{content}</span>
      )}
    </span>
  )
}

/* clone the single trigger element to attach aria-describedby, so the bubble describes (never names)
   the control. matches the specimen: one already-named button per anchor. non-element children
   (plain text) are returned as-is. */
function Described({ children, describedById }) {
  if (children && typeof children === 'object' && children.type) {
    const existing = children.props['aria-describedby']
    const merged = existing ? `${existing} ${describedById}` : describedById
    return cloneElement(children, { 'aria-describedby': merged })
  }
  return children
}

/**
 * @typedef {Object} PopoverProps
 * @property {React.ReactNode} children   the trigger button content (e.g. an icon + label).
 * @property {string} label               accessible name for the floating dialog (aria-label on .pop-card).
 * @property {React.ReactNode} [title]    .pop-title text shown in the .pop-head; defaults to `label`.
 * @property {import('react').ComponentType<{size?: number}>} [icon]  lucide icon component for the .pop-head; decorative.
 * @property {React.ReactNode} content    the .pop-body content.
 * @property {React.ReactNode} [footer]   the .pop-foot content (e.g. cancel / confirm buttons).
 * @property {string} [triggerClassName]  classes for the trigger button. defaults to "btn btn-secondary btn-sm".
 * @property {string} [id]                id for the .pop-card, linked from the trigger via aria-controls. auto-generated if omitted.
 */

/* Popover: a titled floating .pop-card (role=dialog) toggled by a trigger button. the trigger sets
   aria-expanded + aria-controls so the open state is announced, not just drawn. dismisses on a click
   outside or Esc, returning focus to the trigger. */
export function Popover({
  children,
  label,
  title,
  icon: Icon,
  content,
  footer,
  triggerClassName = 'btn btn-secondary btn-sm',
  id,
}) {
  const autoId = useId()
  const popId = id || `pop-${autoId}`
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocDown = (e) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span className="tip-anchor" ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {open && (
        <div className="pop-card" role="dialog" aria-label={label} id={popId}>
          <div className="pop-head">
            {Icon && <Icon size={14} aria-hidden="true" />}
            <span className="pop-title">{title ?? label}</span>
          </div>
          <div className="pop-body">{content}</div>
          {footer && <div className="pop-foot">{footer}</div>}
        </div>
      )}
    </span>
  )
}
