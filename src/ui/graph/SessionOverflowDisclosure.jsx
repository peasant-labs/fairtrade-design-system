import { ProviderIcon } from '../ProviderIcon.jsx'
import './timelinePrimitives.css'

/* SessionOverflowDisclosure is the "+N more" inline disclosure for a
   multi-session commit row: two session chips inline, then this
   expands in place to the full list. Also reused by TouchedFileCluster's
   "+N more files" gating. */

/**
 * @param {object} props
 * @param {string} props.commitHash - or any owning-row id; used to key the reducer's `toggle-commit-sessions`.
 * @param {Array<{sessionId:string, title:string, harness?:import('@peasant-labs/schema').Harness}>} props.overflow - the sessions beyond the inline-2.
 * @param {boolean} props.expanded
 * @param {(id: string) => void} props.onToggle
 * @param {(sessionId: string) => void} [props.onSelect]
 * @param {string} [props.itemLabel='sessions']
 * @param {string} [props.className]
 */
export default function SessionOverflowDisclosure({ commitHash, overflow, expanded, onToggle, onSelect, itemLabel = 'sessions', className = '', ...rest }) {
  if (overflow.length === 0) return null
  return (
    <span className={`tlp-overflow${className ? ` ${className}` : ''}`} {...rest}>
      <button
        type="button"
        className="tlp-overflow-toggle"
        aria-expanded={expanded}
        aria-label={`${overflow.length} more ${itemLabel}`}
        onClick={() => onToggle(commitHash)}
      >
        <span className="tnum">+{overflow.length}</span> more {itemLabel}
      </button>
      <span className="tlp-sr" role="status" aria-live="polite">{expanded ? `${overflow.length} more ${itemLabel} expanded` : ''}</span>
      {expanded && (
        <span className="tlp-overflow-list" role="group" aria-label={`all ${itemLabel}`}>
          {overflow.map((item) => (
            <button
              key={item.sessionId}
              type="button"
              className="tlp-overflow-item"
              data-session-id={item.sessionId}
              onClick={() => onSelect?.(item.sessionId)}
            >
              {item.harness && <ProviderIcon harness={item.harness} label />}
              {item.title || item.sessionId}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
