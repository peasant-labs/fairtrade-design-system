import { useLayoutEffect, useRef, useState } from 'react'

/* Shared transcript disclosure motion. Closed output stays unmounted until first opened;
   on close it remains only for the exit animation, immediately inert and aria-hidden. A
   reversal starts at the currently painted height rather than jumping to either endpoint.
   Sidebars keep their paint: their parent grid owns the clipped width transition. */
export default function Collapsible({ open, children, className = '', id, keepMounted = false, animateSize = true, as: Tag = 'div', 'aria-label': ariaLabel }) {
  const nodeRef = useRef(null)
  const animationRef = useRef(null)
  const previousOpen = useRef(open)
  const [present, setPresent] = useState(open)
  const [animating, setAnimating] = useState(false)

  useLayoutEffect(() => {
    if (previousOpen.current === open) return
    previousOpen.current = open
    const node = nodeRef.current
    const current = animationRef.current
    const height = animateSize ? current ? node.getBoundingClientRect().height : open ? 0 : node.scrollHeight : 0
    const opacity = animateSize ? (current ? getComputedStyle(node).opacity : open ? 0 : 1) : 1
    current?.cancel()
    animationRef.current = null
    const allowed = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches
    const style = getComputedStyle(node)
    const token = style.getPropertyValue('--txn-disclosure-duration').trim() || style.getPropertyValue('--dur-3').trim()
    const duration = Number.parseFloat(token) * (token.endsWith('ms') ? 1 : 1000)
    if (!allowed || typeof node.animate !== 'function' || !Number.isFinite(duration) || duration <= 0) {
      setPresent(open)
      setAnimating(false)
      return
    }
    setPresent(true)
    setAnimating(true)
    const animation = node.animate([
      { ...(animateSize ? { height: `${height}px` } : {}), opacity },
      { ...(animateSize ? { height: open ? `${node.scrollHeight}px` : '0px' } : {}), opacity: animateSize ? (open ? 1 : 0) : 1 },
    ], { duration, easing: style.getPropertyValue('--ease-in-out').trim(), fill: 'both' })
    animationRef.current = animation
    animation.finished.then(() => {
      if (animationRef.current !== animation) return
      setAnimating(false)
      setPresent(open)
    }).catch(() => { /* a reversal or unmount cancels the preceding animation */ })
  }, [open, animateSize])

  // Hold the final frame until React has committed the hidden/unmounted contents. Releasing
  // it in the promise callback would paint one frame at natural height before that commit.
  useLayoutEffect(() => {
    const animation = animationRef.current
    if (!animating && animation?.playState === 'finished') {
      animation.cancel()
      animationRef.current = null
    }
  }, [animating, present])

  useLayoutEffect(() => () => {
    animationRef.current?.cancel()
    animationRef.current = null
  }, [])

  return (
    <Tag ref={nodeRef} id={id} aria-label={ariaLabel} className={`txn-disclosure ${className}`.trim()}
      hidden={!open && !present} aria-hidden={!open} inert={!open}
      data-animating={animating ? 'true' : undefined}>
      {(keepMounted || open || present) ? children : null}
    </Tag>
  )
}
