import { ProviderIcon } from '../ProviderIcon.jsx'
import GhostCommitNode from './GhostCommitNode.jsx'
import './timelinePrimitives.css'

/* SessionLane is one recorded session as a first-class object in the timeline's
   spine gutter. Hover is transient (dispatch hover-session on
   enter/leave); click/Enter/Space lingers the highlight (select-session). The
   caller wires both to the frozen reducer actions, this component only emits
   the gesture. Full keyboard/aria parity is required.

   Unresolved ghosts (no successor could be matched) hang off the SESSION
   lane, not off any commit because there is no commit to group them under. `ghosts`
   renders them as sibling GhostCommitNode chips next to the lane button. */

/**
 * @param {object} props
 * @param {string} props.sessionId
 * @param {string} props.title
 * @param {import('@peasant-labs/schema').Harness} [props.harness]
 * @param {boolean} [props.hovered]
 * @param {boolean} [props.selected]
 * @param {(sessionId: string|null) => void} props.onHover
 * @param {(sessionId: string) => void} props.onSelect
 * @param {Array<{ghostHash:string, subject?:string, resolution:string, method:string, confidence:string}>} [props.unresolvedGhosts]
 * @param {string} [props.className]
 */
export default function SessionLane({
  sessionId,
  title,
  harness,
  hovered = false,
  selected = false,
  onHover,
  onSelect,
  unresolvedGhosts = [],
  className = '',
  ...rest
}) {
  const cls = ['tlp-session-lane', hovered && 'tlp-session-lane-hover', selected && 'tlp-session-lane-sel', className]
    .filter(Boolean)
    .join(' ')
  const label = title || sessionId
  // Selection is the state that lingers, so it is the state worth announcing;
  // hover is transient and firing an announcement on every pointer pass would
  // be noise, not signal, for a screen-reader user.
  const announcement = selected ? `${label} selected` : ''
  return (
    <span className="tlp-session-lane-group">
      <button
        type="button"
        className={cls}
        aria-pressed={selected}
        onMouseEnter={() => onHover?.(sessionId)}
        onMouseLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(sessionId)}
        onBlur={() => onHover?.(null)}
        onClick={() => onSelect?.(sessionId)}
        {...rest}
      >
        {harness && <ProviderIcon harness={harness} label />}
        <span className="tlp-session-lane-title">{label}</span>
        <span className="tlp-sr" role="status" aria-live="polite">{announcement}</span>
      </button>
      {unresolvedGhosts.length > 0 && (
        <span className="tlp-session-lane-ghosts" role="group" aria-label={`session-era commits with no recorded mapping`}>
          {unresolvedGhosts.map((ghost) => (
            <GhostCommitNode
              key={ghost.ghostHash}
              ghostHash={ghost.ghostHash}
              subject={ghost.subject}
              resolution={ghost.resolution}
              method={ghost.method}
              confidence={ghost.confidence}
            />
          ))}
        </span>
      )}
    </span>
  )
}
