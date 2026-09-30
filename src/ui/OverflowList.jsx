import { useEffect, useRef, useState } from 'react'
import './OverflowList.css'

/* OverflowList — a short inline list that shows its first items and folds the rest behind a
   `+N` button: "#42, #45 +2". Pressing `+N` shows every item in place; nothing is fetched. The
   items are the host's own nodes (links, chips), kept exactly as given. The button's accessible
   name spells the count and the noun ("show 2 more pull requests"). No items renders the host's
   `empty` node, or nothing. Pressing `+N` removes the button, so focus moves to the first item it
   revealed. */

/**
 * @param {object} props
 * @param {import('react').ReactNode[]} props.items - the host's item nodes, in order.
 * @param {number} [props.limit=2] - how many items show before the `+N` button.
 * @param {string} props.label - the list's accessible name ("pull requests").
 * @param {[string, string]} [props.noun=['item', 'items']] - singular and plural for the button's name.
 * @param {import('react').ReactNode} [props.empty=null] - rendered when there are no items.
 * @param {string} [props.className]
 */
export default function OverflowList({ items, limit = 2, label, noun = ['item', 'items'], empty = null, className = '', ...rest }) {
  const [open, setOpen] = useState(false)
  const listRef = useRef(null)
  const revealRef = useRef(false)
  const cap = Math.max(1, limit)
  // after `+N`, focus lands on the first revealed item (its own control, or the row itself)
  useEffect(() => {
    if (!open || !revealRef.current) return
    revealRef.current = false
    const row = listRef.current?.children[cap]
    if (!row) return
    const target = row.querySelector('a[href], button, input, select, textarea, [tabindex]') ?? row
    if (target === row) row.tabIndex = -1
    target.focus()
  }, [open, cap])
  if (!Array.isArray(items) || items.length === 0) return empty
  const hidden = open ? 0 : Math.max(0, items.length - cap)
  const shown = hidden > 0 ? items.slice(0, cap) : items
  const cls = ['ovl', className].filter(Boolean).join(' ')
  return (
    <span className={cls} {...rest}>
      <ul className="ovl-list" aria-label={label} ref={listRef}>
        {shown.map((item, index) => <li key={index} className="ovl-item">{item}</li>)}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          className="ovl-more tnum"
          aria-label={`show ${hidden} more ${hidden === 1 ? noun[0] : noun[1]}`}
          onClick={() => { revealRef.current = true; setOpen(true) }}
        >
          +{hidden}
        </button>
      )}
    </span>
  )
}
