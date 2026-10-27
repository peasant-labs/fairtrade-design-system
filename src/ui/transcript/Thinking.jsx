import { useState } from 'react'
import { Brain } from 'lucide-react'
import { formatDurationMs } from './time.js'

/* Thinking — a turn's thinking as one row in the same shape as a tool call: the kind icon and
   "Think" where a tool shows its name, the word count where a tool shows its argument, and the
   time spent thinking where a tool shows its duration. The row opens on the thinking text. DUMB:
   it renders the cooked `ThinkingVM` (text, a precomputed word count and, when the adapter could
   derive it, the time spent) and never parses wire. Absent thinking ⇒ the caller renders nothing.
   It is not a tool call, so it carries the row classes but never `txn-toolcall`. */

/** @typedef {import('./view-model.js').ThinkingVM} ThinkingVM */

/**
 * @param {object} props
 * @param {ThinkingVM} [props.block]   cooked thinking (e.g. `TurnVM.thinking`)
 */
export default function Thinking({ block }) {
  const [open, setOpen] = useState(false)
  if (!block) return null
  const words = block.words ?? 0
  const duration = formatDurationMs(block.durationMs)
  return (
    <div className="toolcall txn-thinking">
      <button
        type="button"
        className="tc-head txn-tc-head txn-thinking-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="kind">
          <Brain size={14} aria-hidden="true" />
          <span>Think</span>
        </span>
        <span className="path txn-thinking-wc"><span className="tnum">{words}</span> {words === 1 ? 'word' : 'words'}</span>
        <span className="right">
          {duration && <span className="tnum txn-tc-dur">{duration}</span>}
        </span>
      </button>
      {open && (
        <div className="txn-thinking-body">
          <em>{block.text}</em>
        </div>
      )}
    </div>
  )
}
