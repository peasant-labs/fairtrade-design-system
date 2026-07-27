import { ChevronRight } from 'lucide-react'
import GhostCommitNode from './GhostCommitNode.jsx'
import './timelinePrimitives.css'

/* GhostGroup is the collapsed "N session-era commits" affordance under a
   successor, expanding via `toggle-ghost-group` to individual
   GhostCommitNodes. Stacked-diamond shape + a tnum count when collapsed. */

/**
 * @param {object} props
 * @param {string} props.successorHash
 * @param {Array<{ghostHash:string, subject?:string, resolution:string, method:string, confidence:string}>} props.ghosts
 * @param {boolean} props.expanded
 * @param {(successorHash: string) => void} props.onToggle
 * @param {string} [props.className]
 */
export default function GhostGroup({ successorHash, ghosts, expanded, onToggle, className = '', ...rest }) {
  const label = `${ghosts.length} session-era commit${ghosts.length === 1 ? '' : 's'}`
  return (
    <div className={`tlp-ghost-group${className ? ` ${className}` : ''}`} {...rest}>
      <button
        type="button"
        className="tlp-ghost-group-toggle"
        aria-expanded={expanded}
        aria-label={`${label}, mapped to ${successorHash.slice(0, 8)}`}
        onClick={() => onToggle(successorHash)}
      >
        <ChevronRight className={`tlp-ghost-group-chevron${expanded ? ' tlp-ghost-group-chevron-open' : ''}`} aria-hidden="true" />
        <span className="tlp-ghost-group-stack" aria-hidden="true">
          <svg viewBox="0 0 9 9" width="9" height="9"><rect x="1.3" y="1.3" width="6.4" height="6.4" transform="rotate(45 4.5 4.5)" /></svg>
        </span>
        <span className="tnum tlp-ghost-group-count">{ghosts.length}</span>
        <span className="tlp-ghost-group-label">{label}</span>
        <span className="tlp-sr" role="status" aria-live="polite">{expanded ? `${label} expanded` : `${label} collapsed`}</span>
      </button>
      {expanded && (
        <ul className="tlp-ghost-group-list">
          {ghosts.map((ghost) => (
            <li key={ghost.ghostHash}>
              <GhostCommitNode
                ghostHash={ghost.ghostHash}
                subject={ghost.subject}
                resolution={ghost.resolution}
                method={ghost.method}
                confidence={ghost.confidence}
              />
              {ghost.subject && <span className="tlp-ghost-subject">{ghost.subject}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
