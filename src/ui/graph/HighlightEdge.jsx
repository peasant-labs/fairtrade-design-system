import './timelinePrimitives.css'

/* HighlightEdge is the session-to-commit highlight. The stroke
   width-step is the INVARIANT FLOOR present in BOTH motion states; in normal
   motion an animated glow layers on top as decoration carrying NO channel of
   its own (so losing it under prefers-reduced-motion loses no information).
   Both halves are independently required; see timeline-encoding-channels.yaml. */

/**
 * @param {object} props
 * @param {'primary'|'secondary'} props.weight - selection (primary) vs hover (secondary, subordinate to a lingering selection).
 * @param {{x1:number, y1:number, x2:number, y2:number}} props.geometry
 * @param {string} [props.className]
 */
export default function HighlightEdge({ weight, geometry, className = '', ...rest }) {
  const cls = ['tlp-highlight-edge', `tlp-highlight-edge-${weight}`, className].filter(Boolean).join(' ')
  return (
    <line
      className={cls}
      x1={geometry.x1}
      y1={geometry.y1}
      x2={geometry.x2}
      y2={geometry.y2}
      aria-hidden="true"
      {...rest}
    />
  )
}
