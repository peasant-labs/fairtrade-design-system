import { CircleHelp, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { INTEGRITY_COPY } from './integrity.js'

/* IntegrityBadge: the transcript's integrity flag: a static outlined badge, a (?) button that
   discloses a short explanation, and a visually hidden status line. DUMB: the host decides whether
   the flag exists and passes only `hasHighlights` (whether any turn is marked) and an optional
   help link. The badge is not a control. The (?) toggles a panel that stays in the DOM (hidden
   when closed) so aria-controls always resolves; opening never moves focus, the panel never traps
   it, and it never opens by itself or on hover. Escape closes it and returns focus to the (?); a
   pointer down outside closes it and leaves focus where it was. */

/** Keep the open panel inside the viewport by the page gutter, shifting it sideways when needed. */
const VIEWPORT_GUTTER_PX = 16

/**
 * @param {object} props
 * @param {boolean} [props.hasHighlights=false]  true when at least one turn is marked
 * @param {string} [props.helpHref]  optional link to the explanation of the check
 * @param {number} [props.headingLevel=2]  the panel heading's level, one under the viewer title
 */
export default function IntegrityBadge({ hasHighlights = false, helpHref, headingLevel = 2 }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const helpRef = useRef(null)
  const panelRef = useRef(null)
  const panelId = useId()
  const headingId = useId()
  const Heading = `h${Math.min(6, Math.max(1, headingLevel))}`

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  /* measure after layout and shift the panel back inside the viewport; re-measure on resize */
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return undefined
    if (!open) {
      panel.style.removeProperty('--txn-integrity-shift')
      return undefined
    }
    const place = () => {
      panel.style.removeProperty('--txn-integrity-shift')
      const rect = panel.getBoundingClientRect()
      const viewport = document.documentElement.clientWidth || window.innerWidth
      let shift = 0
      if (rect.right > viewport - VIEWPORT_GUTTER_PX) shift = viewport - VIEWPORT_GUTTER_PX - rect.right
      if (rect.left + shift < VIEWPORT_GUTTER_PX) shift = VIEWPORT_GUTTER_PX - rect.left
      if (shift !== 0) panel.style.setProperty('--txn-integrity-shift', `${Math.round(shift)}px`)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  const onKeyDown = (event) => {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    close()
    helpRef.current?.focus()
  }

  return (
    <span className="txn-integrity" ref={rootRef} onKeyDown={onKeyDown}>
      <span className="txn-integrity-badge">
        <TriangleAlert size={14} aria-hidden="true" />
        {INTEGRITY_COPY.badgeLabel}
      </span>
      <button
        type="button"
        ref={helpRef}
        className="txn-integrity-help"
        aria-label={INTEGRITY_COPY.helpName}
        title={INTEGRITY_COPY.helpName}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp size={16} aria-hidden="true" />
      </button>
      <div
        id={panelId}
        ref={panelRef}
        className="txn-integrity-panel menu-pop menu-float"
        data-align="end"
        role="region"
        aria-labelledby={headingId}
        hidden={!open}
      >
        <Heading id={headingId} className="txn-integrity-heading">{INTEGRITY_COPY.panelHeading}</Heading>
        <p>{INTEGRITY_COPY.panelBody}{hasHighlights ? ` ${INTEGRITY_COPY.panelHighlights}` : ''}</p>
        <p>{INTEGRITY_COPY.panelBestEffort} {INTEGRITY_COPY.panelOtherTools}</p>
        <p>{INTEGRITY_COPY.panelNoVerify}</p>
        {helpHref ? <a className="txn-integrity-link" href={helpHref}>{INTEGRITY_COPY.helpLink}</a> : null}
      </div>
      <span className="txn-sr" role="status">{INTEGRITY_COPY.statusText}</span>
    </span>
  )
}

/**
 * The flagged-turn mark: the warning glyph and a word. On a turn head or a system row the heading
 * carries the accessible name, so the mark is `aria-hidden`; in a work group, which has no heading
 * of its own, it stays readable.
 * @param {object} props
 * @param {string} [props.text]  the word beside the glyph
 * @param {boolean} [props.decorative=true]  hide the whole mark from assistive technology
 */
export function IntegrityMark({ text = INTEGRITY_COPY.turnMark, decorative = true }) {
  return (
    <span className="txn-integrity-mark" aria-hidden={decorative ? 'true' : undefined}>
      <TriangleAlert size={14} aria-hidden="true" />
      {text}
    </span>
  )
}
