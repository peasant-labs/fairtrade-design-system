import { ChevronDown, ChevronRight } from 'lucide-react'

/* session group disclosure (.sgd-*): one collapsed count control that sits at
   the end of a session list, states how many rows the list holds back, and
   reveals them in place while it is open. Ported from village's local
   SessionGroupDisclosure so the design system owns the control once; the saved
   helper-group tree renders its chip through this same component. */

/**
 * SessionGroupDisclosure - the one collapsed count control for a session list.
 *
 * The label names the group's membership and its count ("orphan sessions 2"),
 * a chevron leads the control, and a trailing `show`/`hide` states what the
 * press will do. The control is a real `<button>` with `aria-expanded` and
 * `aria-controls`, so the row it reveals is named, not inferred.
 *
 * Expansion state stays with the caller: a group is an aside, and a viewer who
 * opened it once has not asked for it to be open on every future visit. The
 * revealed content renders only while expanded, so a folded row cannot be
 * mistaken for a visible one and holds no page height.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.label - the control's text while OPEN
 * @param {import('react').ReactNode} props.collapsedLabel - the control's text
 *   while CLOSED; the caller writes it, because the sibling groups do not agree
 *   on a leading mark
 * @param {boolean} props.expanded
 * @param {() => void} props.onToggle
 * @param {string} props.rowsID - the `id` of the element this control reveals;
 *   the caller owns that element
 * @param {boolean} [props.bare] - drop the outer border when the group sits
 *   inside an already-bordered panel
 * @param {boolean} [props.indent] - indent one step, so a group nested inside a
 *   list reads as belonging to it rather than as another list row
 * @param {string} [props.testID] - base for the wrapper and control test ids:
 *   `<base>`, `<base>-toggle`, and `<base>-label`
 * @param {import('react').ReactNode} [props.children] - revealed only while
 *   expanded
 */
export default function SessionGroupDisclosure({
  label,
  collapsedLabel,
  expanded,
  onToggle,
  rowsID,
  bare = false,
  indent = false,
  testID = 'session-group-disclosure',
  children,
}) {
  const className = `sgd${indent ? ' sgd-indent' : ''}${bare ? ' sgd-bare' : ''}`
  return (
    <div className={className} data-testid={testID}>
      <button
        type="button"
        className="sgd-trigger"
        aria-expanded={expanded}
        aria-controls={rowsID}
        data-testid={`${testID}-toggle`}
        onClick={onToggle}
      >
        {expanded
          ? <ChevronDown className="sgd-chevron" aria-hidden="true" />
          : <ChevronRight className="sgd-chevron" aria-hidden="true" />}
        <span className="sgd-count" data-testid={`${testID}-label`}>
          {expanded ? label : collapsedLabel}
        </span>
        <span className="sgd-spacer" aria-hidden="true" />
        <span className="sgd-show">{expanded ? 'hide' : 'show'}</span>
      </button>

      {expanded && children}
    </div>
  )
}
