import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/* a real, accessible modal dialog. role=dialog + aria-modal + aria-labelledby;
   focus is trapped while open; Escape and a scrim click close it; focus returns
   to the opener; background scroll is locked. */
export default function Dialog({ open, onClose, title, labelId = 'dlg-title', children, footer, returnFocusRef }) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const rfRef = useRef(returnFocusRef)
  rfRef.current = returnFocusRef

  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement
    const dlg = dialogRef.current
    const focusables = () =>
      [...dlg.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.offsetParent !== null || el === document.activeElement)
    ;(focusables()[0] || dlg).focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (!items.length) {
        e.preventDefault()
        dlg.focus()
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
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      const rf = rfRef.current
      const target = (rf && rf.current) || prevFocus
      if (target && typeof target.focus === 'function') requestAnimationFrame(() => target.focus())
    }
  }, [open])

  if (!open) return null
  return (
    <div className="dlg-overlay" onMouseDown={(e) => { if (e.target.classList.contains('scrim')) onClose() }}>
      <div className="scrim" />
      <div className="dialog framed" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1}>
        <div className="dlg-head">
          <h3 id={labelId}>{title}</h3>
          <button className="btn btn-ghost btn-icon" aria-label="close dialog" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="dlg-body">{children}</div>
        {footer && <div className="dlg-foot">{footer}</div>}
      </div>
    </div>
  )
}
