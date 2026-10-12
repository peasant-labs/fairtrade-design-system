import { SCENT_TAGS } from './ranking.js'
import Tooltip from '../Tooltip.jsx'
import './timelinePrimitives.css'

/* ScentTag is one closed-set comprehension-debt/relevance label. tokens only;
   the copy is a "prompt to look, not a verdict" and says so via the accessible
   focus/tap tooltip passed in as hoverText.

   `onToggle` (optional) turns the SAME label into the ranked-list's scent
    filter control (a toggle button wired to the frozen `set-scent-filter`
    action) instead of a purely decorative row label. The closed set is
   shared, so there is no second vocabulary to keep in sync. */

/**
 * @param {object} props
 * @param {string} props.tag - a `SCENT_TAGS` member.
 * @param {string} [props.hoverText] - the path-conditioned hover copy for `partial-read` rows.
 * @param {boolean} [props.active] - when interactive, whether this tag is the active filter.
 * @param {(tag: string|null) => void} [props.onToggle] - present -> renders as an interactive filter toggle; absent -> a plain decorative label.
 * @param {string} [props.className]
 */
export default function ScentTag({ tag, hoverText, active = false, onToggle, className = '', ...rest }) {
  if (!SCENT_TAGS.includes(tag)) {
    throw new Error(
      `ScentTag render failed: what went wrong: unknown scent tag ${JSON.stringify(tag)}; why: the value is not a member of the closed SCENT_TAGS set; ` +
      `where: src/ui/graph/ScentTag.jsx; when: rendering a ranked-list row; what it means: an upstream ranking derivation produced a value outside the frozen vocabulary; ` +
      `how to fix: only pass one of ${SCENT_TAGS.join(', ')}.`,
    )
  }
  if (!onToggle) {
    const label = (
      <span className={`tlp-scent${className ? ` ${className}` : ''}`} tabIndex={hoverText ? 0 : undefined} {...rest}>
        {tag}
      </span>
    )
    return hoverText ? <Tooltip content={hoverText}>{label}</Tooltip> : label
  }
  const control = (
    <button
      type="button"
      className={`tlp-scent tlp-scent-filter${active ? ' tlp-scent-filter-active' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={active}
      onClick={() => onToggle(active ? null : tag)}
      {...rest}
    >
      {tag}
    </button>
  )
  return hoverText ? <Tooltip content={hoverText}>{control}</Tooltip> : control
}
