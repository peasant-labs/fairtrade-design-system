/* ViewSwitch — a labelled on/off switch for the filters rail "view options" (show hidden
   indicators / expand all tool calls / compact mode), lifted verbatim from the canonical
   mockup (src/mockups/inuse/TranscriptApp.jsx:1906). DUMB + controlled: the caller owns `on`
   and handles `onToggle`. Exported as `TranscriptViewSwitch`. */

/**
 * @param {object} props
 * @param {string} [props.label]      the switch label + its accessible name
 * @param {boolean} [props.on]
 * @param {Function} [props.onToggle]
 */
export default function ViewSwitch({ label = '', on = false, onToggle = () => {} }) {
  return (
    <div className="txn-viewsw">
      <button type="button" role="switch" aria-checked={on} className="sw" onClick={onToggle} aria-label={label} />
      <span className="txn-viewsw-label">{label}</span>
      <span className="txn-viewsw-state">{on ? 'on' : 'off'}</span>
    </div>
  )
}
