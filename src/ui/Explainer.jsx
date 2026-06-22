import { useCallback, useEffect, useId, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import './Explainer.css'

/* teach-in-place help, modeled on peasant's Explainer + Term. the contract: a per-surface
   collapsible "what am i looking at?" box that says what the screen shows and what its words mean —
   NEVER a modal, NEVER a tour. the payload still leads; the box sits one click away behind a square
   "?" toggle, and a user who opens it stays opted-in (persisted per surface in localStorage).
   Term is the inline companion: a dotted-underline glossary word with a square tooltip definition.

   the chrome (the "?" toggle, the title, the term trigger) is mono + lowercase; the explanatory
   BODY is var(--font-body) because it is reading prose, not chrome. classes are namespaced `xpl-`
   (explainer) and `term-` (term) so nothing collides with index.css. */

const STORAGE_PREFIX = 'fairtrade.explainer.'

/* read the persisted open/closed state for a surface, guarding SSR / privacy-mode where
   window.localStorage throws or is absent. returns undefined when nothing is stored (or no key),
   so the caller falls back to `defaultOpen`. */
function readStored(storageKey) {
  if (!storageKey || typeof window === 'undefined') return undefined
  try {
    const v = window.localStorage.getItem(STORAGE_PREFIX + storageKey)
    if (v === 'open') return true
    if (v === 'hidden') return false
  } catch {
    /* localStorage unavailable — fall back to the default */
  }
  return undefined
}

/**
 * @typedef {Object} ExplainerProps
 * @property {React.ReactNode} children            the explanatory PROSE (rendered in var(--font-body)); may contain <Term> words.
 * @property {React.ReactNode} [title='what am i looking at?']  the toggle-row heading (mono chrome, lowercased by css).
 * @property {boolean} [defaultOpen=false]         initial open state when nothing is persisted.
 * @property {string} [storageKey]                 when given, open/closed persists to localStorage under this surface key.
 * @property {'card'|'inline'} [tone='card']       'card' = bordered panel; 'inline' = a quieter ghost (no fill/border).
 * @property {string} [className]                  extra class on the root.
 */

/**
 * The "what am i looking at?" block — one per surface. A square "?" / heading toggle row reveals or
 * hides a short prose body (the heading reads aria-expanded; the body is the toggle's aria-controls
 * region). The toggle target is the whole row (>= the 24px minimum). Open state persists per surface
 * when `storageKey` is set. Two tones: a bordered `card` panel, or a quieter `inline` ghost.
 * It is never a modal and never steals focus.
 */
export default function Explainer({
  children,
  title = 'what am i looking at?',
  defaultOpen = false,
  storageKey,
  tone = 'card',
  className = '',
}) {
  const reactId = useId()
  const bodyId = `xpl-${reactId}`

  // first render is deterministic (defaultOpen) so SSR and the client agree; reconcile with any
  // persisted choice right after mount, so a returning user's open/closed state wins without a
  // hydration mismatch.
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    const stored = readStored(storageKey)
    if (stored !== undefined) setOpen(stored)
  }, [storageKey])

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      if (storageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_PREFIX + storageKey, next ? 'open' : 'hidden')
        } catch {
          /* ignore — persistence is best-effort */
        }
      }
      return next
    })
  }, [storageKey])

  return (
    <section
      className={`xpl xpl--${tone}${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
    >
      <button
        type="button"
        className="xpl-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
      >
        <span className="xpl-mark" aria-hidden="true">
          <HelpCircle className="lucide" />
        </span>
        <span className="xpl-title">{title}</span>
        <span className="xpl-hint" aria-hidden="true">
          {open ? 'hide' : 'show'}
        </span>
      </button>

      {/* the region stays mounted so screen readers can announce the controlled relationship; it is
          hidden from layout and the a11y tree when collapsed. accessible name = the title. */}
      <div
        id={bodyId}
        role="region"
        aria-label={typeof title === 'string' ? title : 'explanation'}
        className="xpl-body"
        hidden={!open}
      >
        {children}
      </div>
    </section>
  )
}

/**
 * @typedef {Object} TermProps
 * @property {string} def              the plain-language definition shown in the tooltip (mono chrome).
 * @property {React.ReactNode} children  the inline word(s) to underline.
 * @property {string} [className]      extra class on the trigger.
 */

/**
 * Inline glossary term: a dotted-underline word that reveals a small square tooltip with its
 * definition on hover AND keyboard focus (and on tap, for touch). The trigger is a real <button> so
 * it's reachable and operable from the keyboard; the bubble is wired via aria-describedby so the
 * definition reinforces — never solely names — the word. A tooltip is reinforcement, so anything
 * load-bearing must also live in visible copy.
 */
export function Term({ def, children, className = '' }) {
  const reactId = useId()
  const tipId = `term-${reactId}`
  // touch has no hover/focus pairing, so a tap latches the bubble open; Escape / blur clears it.
  const [pinned, setPinned] = useState(false)

  return (
    <span className={`term-anchor${pinned ? ' is-pinned' : ''}`}>
      <button
        type="button"
        className={`term${className ? ` ${className}` : ''}`}
        aria-describedby={tipId}
        aria-expanded={pinned}
        onClick={() => setPinned((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && pinned) setPinned(false)
        }}
        onBlur={() => setPinned(false)}
      >
        {children}
      </button>
      <span className="term-bubble" role="tooltip" id={tipId}>
        {def}
      </span>
    </span>
  )
}
