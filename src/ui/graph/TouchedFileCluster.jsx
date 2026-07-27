import SessionOverflowDisclosure from './SessionOverflowDisclosure.jsx'
import './timelinePrimitives.css'

/* TouchedFileCluster arranges files around their commit node.
    It uses the same gating discipline as the ranked list and ghost layer: at most 8
   files inline (ordered by DOI intrinsic score, or recorded visit order when
   a session is selected), then a "+N more files" disclosure reusing
   SessionOverflowDisclosure. */

const CLUSTER_LIMIT = 8

/**
 * @param {object} props
 * @param {string} props.commitHash
 * @param {string[]} props.files - already ordered by the caller (DOI intrinsic, or visit order when a session is selected).
 * @param {boolean} props.expanded
 * @param {(id: string) => void} props.onToggle
 * @param {(file: string) => void} [props.onOpenDiff]
 * @param {string} [props.className]
 */
export default function TouchedFileCluster({ commitHash, files, expanded, onToggle, onOpenDiff, className = '', ...rest }) {
  const inline = files.slice(0, CLUSTER_LIMIT)
  const overflow = files.slice(CLUSTER_LIMIT).map((file) => ({ sessionId: file, title: file }))
  return (
    <div className={`tlp-file-cluster${className ? ` ${className}` : ''}`} role="group" aria-label="touched files" {...rest}>
      {inline.map((file) => (
        <button key={file} type="button" className="tlp-file-cluster-item" onClick={() => onOpenDiff?.(file)}>
          {file}
        </button>
      ))}
      <SessionOverflowDisclosure
        commitHash={commitHash}
        overflow={overflow}
        expanded={expanded}
        onToggle={onToggle}
        onSelect={onOpenDiff}
        itemLabel="files"
      />
    </div>
  )
}
