import { useState } from 'react'
import { ChevronDown, ChevronRight, Brain } from 'lucide-react'

/* Thinking — the collapsible "thinking" disclosure for a turn. Lifted verbatim from the
   canonical mockup (src/mockups/inuse/TranscriptApp.jsx:384). DUMB: it renders the cooked
   `ThinkingVM` (text + a precomputed word count) the adapter extracted from the folded turn
   content; it never parses wire. Absent thinking ⇒ the caller renders nothing. */

/** @typedef {import('./view-model.js').ThinkingVM} ThinkingVM */

/**
 * @param {object} props
 * @param {ThinkingVM} [props.block]   cooked thinking (e.g. `TurnVM.thinking`)
 */
export default function Thinking({ block }) {
  const [open, setOpen] = useState(false)
  if (!block) return null
  return (
    <div className="txn-thinking">
      <button
        type="button"
        className="txn-thinking-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
        <Brain size={14} aria-hidden="true" />
        <i>thinking</i>
        <span className="txn-thinking-wc tnum">{block.words ?? 0}w</span>
      </button>
      {open && (
        <div className="txn-thinking-body">
          <em>{block.text}</em>
        </div>
      )}
    </div>
  )
}
