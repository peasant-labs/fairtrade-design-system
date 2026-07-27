import './timelinePrimitives.css'

/* GhostCommitNode represents a rewritten-away commit. Identity is carried by
   node shape (a rotated-square diamond at --ink-3), never dash. Dash stays
   reserved exclusively for "forked/merged out of view" per CommitGraph's own
   header contract. Resolution confidence rides the tether TERMINAL glyph:
   filled (high) / half (medium) / open (low). */

/** @typedef {'live'|'rewritten'|'unresolved'} RewriteResolution */
/** @typedef {'hash'|'patch_id'|'author_identity'|'message_embedded'|'temporal'|'none'} RewriteMethod */
/** @typedef {'high'|'medium'|'low'} Confidence */

const METHOD_WORDS = Object.freeze({
  hash: 'matched by hash',
  patch_id: 'matched by patch content',
  author_identity: 'matched by author and time',
  message_embedded: 'matched by message text',
  temporal: 'matched by nearby time only',
  none: 'no match found',
})

/**
 * @param {object} props
 * @param {string} props.ghostHash
 * @param {string} [props.subject] - '' when unrecorded.
 * @param {RewriteResolution} props.resolution
 * @param {RewriteMethod} props.method
 * @param {Confidence} props.confidence
 * @param {string} [props.className]
 */
export default function GhostCommitNode({ ghostHash, subject, resolution, method, confidence, className = '', ...rest }) {
  const explanation = resolution === 'unresolved'
    ? 'session-era commit, no longer in history; not enough recorded metadata to map it'
    : `${METHOD_WORDS[method] ?? method}, ${confidence} confidence`
  return (
    <span
      className={`tlp-ghost-node tlp-terminal-${confidence}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={`rewritten commit ${ghostHash.slice(0, 8)}${subject ? `: ${subject}` : ''}: ${explanation}`}
      title={explanation}
      {...rest}
    >
      <svg className="tlp-ghost-diamond" viewBox="0 0 9 9" width="9" height="9" aria-hidden="true">
        <rect x="1.3" y="1.3" width="6.4" height="6.4" transform="rotate(45 4.5 4.5)" />
      </svg>
    </span>
  )
}
