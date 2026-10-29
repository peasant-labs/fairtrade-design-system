import { CircleHelp, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { INTEGRITY_COPY } from './integrity.js'

/* IntegrityBadge: the transcript's integrity flag: one outlined badge button (the warning glyph,
   the label and a (?) glyph) that discloses a short explanation, and a visually hidden status
   line. DUMB: the host decides whether the flag exists; the badge draws the same panel either
   way, and the panel holds no link. The badge is the only control: it is named by the help
   question, which contains its visible label. It toggles a panel that stays in the DOM (hidden
   when closed) so aria-controls always resolves; opening never moves focus, the panel never traps
   it, and it never opens by itself or on hover. Escape closes it and returns focus to the badge; a
   pointer down outside closes it and leaves focus where it was, and so does the host folding the
   badge out of view (a condensed header), so a panel nobody can see never holds Escape. The status
   line is empty when it first enters the page and is filled a moment later, so a screen reader
   that watches a live region the badge arrived with still hears it. Every string comes from
   INTEGRITY_COPY. */

/** Keep the open panel inside the viewport by the page gutter, shifting it sideways when needed. */
const VIEWPORT_GUTTER_PX = 16

/** How long the status line stays empty after the badge enters the page. */
const ANNOUNCE_DELAY_MS = 100

/**
 * @param {object} props
 * @param {number} [props.headingLevel=2]  the panel heading's level, one under the viewer title
 * @param {boolean} [props.folded=false]  the host has folded the badge out of view; an open panel closes
 */
export default function IntegrityBadge({ headingLevel = 2, folded = false }) {
  const [open, setOpen] = useState(false)
  const [announced, setAnnounced] = useState(false)
  const rootRef = useRef(null)
  const badgeRef = useRef(null)
  const panelRef = useRef(null)
  const panelId = useId()
  const headingId = useId()
  const Heading = `h${Math.min(6, Math.max(1, headingLevel))}`

  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(true), ANNOUNCE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (folded) setOpen(false)
  }, [folded])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    /* Escape is heard on the document: Safari does not focus a button on a mouse click, so after a
       click-open focus may sit outside the badge and a handler on the badge would never see it */
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.stopPropagation()
      setOpen(false)
      badgeRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
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

  return (
    <span className="txn-integrity" ref={rootRef}>
      <button
        type="button"
        ref={badgeRef}
        className="txn-integrity-badge"
        aria-label={INTEGRITY_COPY.helpName}
        title={INTEGRITY_COPY.helpName}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <TriangleAlert size={14} aria-hidden="true" className="txn-integrity-warn" />
        <span className="txn-integrity-label">{INTEGRITY_COPY.badgeLabel}</span>
        <CircleHelp size={14} aria-hidden="true" className="txn-integrity-q" />
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
        <p>{INTEGRITY_COPY.panelBody}</p>
        <p>{INTEGRITY_COPY.panelOtherTools}</p>
      </div>
      <span className="txn-sr" role="status">{announced ? INTEGRITY_COPY.statusText : ''}</span>
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
