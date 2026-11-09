// @ts-check
/* The two saved-view pickers the transcript library table draws above its rows:
   the group-by picker and the column picker.

   Both are disclosures, not menus. The trigger is a real <button> that reports
   `aria-expanded`, and every choice inside is a native checkbox or radio, so a
   screen reader announces its state and Tab reaches it in declaration order.
   Escape closes the open panel and returns focus to its trigger, and a pointer
   press outside the picker closes it.

   Nothing here reads or writes storage, a URL, or history. Every change is
   reported to the host through the picker's callback; the host owns the URL
   `groupBy` and the device `visibleColumns` and `open`. */

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * The one disclosure shell both pickers share: a trigger button, its label,
 * and a panel that only renders while open.
 *
 * @param {object} props
 * @param {string} props.triggerLabel the trigger's visible and accessible text, including the current state.
 * @param {string} props.panelLabel the panel's accessible name.
 * @param {'group' | 'radiogroup'} props.role the panel role: a checkbox group or a single-choice radio group.
 * @param {import('react').ReactNode} props.children the choice rows.
 */
function Disclosure({ triggerLabel, panelLabel, role, children }) {
  const [open, setOpen] = useState(false)
  /** @type {import('react').RefObject<HTMLButtonElement | null>} */
  const triggerRef = useRef(null)
  /** @type {import('react').RefObject<HTMLDivElement | null>} */
  const wrapRef = useRef(null)
  const panelId = useId()

  // A pointer press outside the picker closes it without moving focus: the person
  // clicked somewhere else on purpose. Escape returns focus to the trigger below.
  useEffect(() => {
    if (!open) return undefined
    /** @param {PointerEvent} event */
    const onPointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(/** @type {Node} */ (event.target))) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  /** @param {import('react').KeyboardEvent<HTMLDivElement>} event */
  const onKeyDown = (event) => {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="libt-pick" ref={wrapRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="libt-pick-btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="libt-pick-value">{triggerLabel}</span>
        <ChevronDown className="libt-pick-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="libt-pick-panel" id={panelId} role={role} aria-label={panelLabel}>
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * The group-by picker. The trigger names the current grouping, and each offered
 * member is a native radio, so the chosen row is announced as checked.
 *
 * @param {object} props
 * @param {readonly { wire: string, label: string }[]} props.options the host's grouping members.
 * @param {{ wire: string, label: string }} props.value the active grouping member.
 * @param {(next: { wire: string, label: string }) => void} props.onChange receives the chosen member.
 */
export function GroupByPicker({ options, value, onChange }) {
  const name = useId()
  return (
    <Disclosure triggerLabel={`group by: ${value.label}`} panelLabel="group by" role="radiogroup">
      {options.map((option) => (
        <label key={option.wire} className="libt-pick-row">
          <input
            type="radio"
            className="libt-pick-box"
            name={name}
            checked={option.wire === value.wire}
            onChange={() => onChange(option)}
          />
          <span className="libt-pick-label">{option.label}</span>
        </label>
      ))}
    </Disclosure>
  )
}

/**
 * The column picker. The trigger names how many columns show, and every column is
 * a native checkbox. The first declared column is the row identity and always
 * shows, so its checkbox is checked and disabled; the label says why.
 *
 * @param {object} props
 * @param {readonly { id: { wire: string }, label: string }[]} props.columns every host column, in declaration order.
 * @param {readonly { wire: string }[]} props.visibleColumns the columns the saved view shows.
 * @param {(column: { id: { wire: string }, label: string }, checked: boolean) => void} props.onChange receives the toggled column and whether it was checked before the change.
 */
export function ColumnPicker({ columns, visibleColumns, onChange }) {
  const shown = new Set(visibleColumns.map((id) => id.wire))
  return (
    <Disclosure
      triggerLabel={`columns: ${visibleColumns.length} of ${columns.length}`}
      panelLabel="columns"
      role="group"
    >
      {columns.map((column, index) => {
        const fixed = index === 0
        return (
          <label key={column.id.wire} className="libt-pick-row">
            <input
              type="checkbox"
              className="libt-pick-box"
              checked={fixed || shown.has(column.id.wire)}
              disabled={fixed}
              onChange={() => {
                if (!fixed) onChange(column, shown.has(column.id.wire))
              }}
            />
            <span className="libt-pick-label">{column.label}</span>
            {fixed && <span className="libt-pick-note">always shown</span>}
          </label>
        )
      })}
    </Disclosure>
  )
}
