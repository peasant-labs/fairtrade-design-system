import { useCallback, useRef } from 'react'
import { CornerDownRight } from 'lucide-react'
import './EvidenceCaption.css'

/* EvidenceCaption — a deterministic click-to-evidence recap, modeled on peasant's change-detail
   Caption (web/src/app/review/.../caption.ts): one readable sentence assembled from FACT fragments,
   where every fragment that carries proof is a dotted-underline button that scroll-jumps to its
   evidence anchor and briefly highlights it.

   the recap is reading text, so it's PROSE — var(--font-body), sentence case (a fragment may carry
   any casing its facts demand; the surrounding sentence is not lowercased chrome). the clickable
   parts are real <button>s (not spans): a dotted underline + a focus ring carry "this is a target",
   never color alone; each names what it jumps to via aria-describedby + an sr-only "jump to" label,
   so the destination is legible to AT before the click. targets render <EvidenceTarget> below.

   classes are namespaced ec-; tokens + the ec-* rules live in EvidenceCaption.css. transitions
   (and the highlight pulse) run only under prefers-reduced-motion: no-preference — for a reader who
   opts out of motion the jump is instant and the highlight is a steady (briefly held) outline. */

/**
 * scroll an EvidenceTarget into view and fire its highlight pulse. resolves the node by id, brings
 * it into view (smooth only when motion is allowed), then toggles the `data-ec-flash` attribute the
 * CSS animates — the animation's `animationend` clears it so a repeat jump re-triggers cleanly.
 * (reduced-motion readers get a steady outline held for ~1.2s instead of a pulse — see the CSS.)
 */
function jumpToTarget(anchorId) {
  if (typeof document === 'undefined') return
  const node = document.getElementById(anchorId)
  if (!node) return

  const reduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })

  // re-arm: drop the attribute, force a reflow, set it again so a second jump to the same target
  // restarts the animation rather than no-op'ing on an already-present attribute.
  node.removeAttribute('data-ec-flash')
  void node.offsetWidth
  node.setAttribute('data-ec-flash', '')
}

/**
 * a single fragment. text-only fragments render as prose; fragments with an `anchorId` render as a
 * dotted-underline button that jumps to (and flashes) the matching <EvidenceTarget>. the leading
 * separator (a normal space) is included so the joined sentence reads naturally.
 */
function Fragment({ fragment, leadingSpace, onJump }) {
  const { text, anchorId, label } = fragment

  if (!anchorId) {
    return (
      <span className="ec-text">
        {leadingSpace ? ' ' : ''}
        {text}
      </span>
    )
  }

  // the accessible description names the destination: "jump to <label or anchor>". this is what
  // aria-describedby points at, so a screen-reader announces where the button goes before activation.
  const destName = label || anchorId
  const handle = () => {
    onJump?.(anchorId)
    jumpToTarget(anchorId)
  }

  return (
    <>
      {leadingSpace ? ' ' : ''}
      <button
        type="button"
        className="ec-frag"
        onClick={handle}
        aria-describedby={`ec-jump-${anchorId}`}
      >
        {text}
        <span className="ec-sr" id={`ec-jump-${anchorId}`}>
          {' '}
          jump to {destName}
        </span>
      </button>
    </>
  )
}

/**
 * EvidenceCaption — the recap sentence assembled from fragments.
 *
 * @param {object} props
 * @param {Array<{text: string, anchorId?: string, label?: string}>} props.fragments
 *        the ordered fragments. a fragment WITH `anchorId` is a clickable proof link (jumps to the
 *        <EvidenceTarget id={anchorId}> and flashes it); `label` names the destination for AT
 *        (defaults to the anchorId). a fragment without `anchorId` is plain prose.
 * @param {(anchorId: string) => void} [props.onJump] - called with the anchorId when a fragment is
 *        activated (in addition to the built-in scroll + highlight).
 * @param {string} [props['aria-label']] - accessible label for the recap region (default: "recap").
 * @param {string} [props.className]
 */
export function EvidenceCaption({
  fragments = [],
  onJump,
  'aria-label': ariaLabel = 'recap',
  className = '',
  ...rest
}) {
  const cls = ['ec', className].filter(Boolean).join(' ')
  return (
    <p className={cls} aria-label={ariaLabel} {...rest}>
      {fragments.map((f, i) => (
        <Fragment
          key={i}
          fragment={f}
          leadingSpace={i > 0}
          onJump={onJump}
        />
      ))}
    </p>
  )
}

/**
 * EvidenceTarget — the proof block a fragment jumps to. it owns the `id` the caption scrolls to and
 * the `data-ec-flash` attribute the CSS animates on arrival. give it an `eyebrow` (a small mono
 * anchor label, lowercased chrome) so the reader sees which evidence they landed on.
 *
 * @param {object} props
 * @param {string} props.id - the anchor id; a fragment's `anchorId` points here.
 * @param {string} [props.eyebrow] - the small anchor label shown above the block (chrome → mono).
 * @param {React.ReactNode} props.children - the evidence content.
 * @param {string} [props.className]
 */
export function EvidenceTarget({ id, eyebrow, children, className = '', ...rest }) {
  const ref = useRef(null)

  // clear the flash attribute once its animation ends so a later jump can re-trigger it. (the
  // attribute is the animation switch; CSS drives the visual.)
  const onAnimationEnd = useCallback(() => {
    ref.current?.removeAttribute('data-ec-flash')
  }, [])

  const cls = ['ec-target', className].filter(Boolean).join(' ')
  return (
    <section
      ref={ref}
      id={id}
      className={cls}
      tabIndex={-1}
      onAnimationEnd={onAnimationEnd}
      {...rest}
    >
      {eyebrow && (
        <span className="ec-target-eyebrow">
          <CornerDownRight className="ec-target-eyebrow-icon" aria-hidden="true" />
          {eyebrow}
        </span>
      )}
      {children}
    </section>
  )
}

export default EvidenceCaption
