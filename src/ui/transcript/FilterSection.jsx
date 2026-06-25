import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

/* FilterSection — a collapsible titled section in the filters rail, lifted verbatim from the
   canonical mockup (src/mockups/inuse/TranscriptApp.jsx:1779). The open/closed state is local
   disclosure UI (seeded by `defaultOpen`), exactly as in the mockup — it is not transcript
   view-state, so it stays internal. Exported as `TranscriptFilterSection`. */

/**
 * @param {object} props
 * @param {*} [props.title]              the section heading (lowercase chrome)
 * @param {*} [props.children]           the section body (rows)
 * @param {boolean} [props.defaultOpen]
 */
export default function FilterSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="txn-fsec">
      <button type="button" className="txn-fsec-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />} {title}
      </button>
      {open && <div className="txn-fsec-body">{children}</div>}
    </div>
  )
}
