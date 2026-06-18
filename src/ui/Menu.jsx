import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/* a self-contained, accessible dropdown menu (the react version of the overlays-section live
   specimen). the trigger reuses .btn + .menu-trigger and declares aria-haspopup="menu" +
   aria-expanded; the open popout is a .menu-pop.menu-float with a role="menu" list of
   role="menuitem" rows (icon + .menu-text + optional .menu-kbd shortcut, .menu-danger variant,
   aria-disabled rows skipped). keyboard/focus behavior is ported from App.jsx's [data-menu-trigger]
   useEffect: click/Down/Up opens (Down -> first item, Up -> last), arrows move between enabled
   items, Home/End jump, Esc/Tab/outside-click close, and Esc returns focus to the trigger.
   reuses the .menu-* styles with zero new css. */

/**
 * @typedef {Object} MenuItem
 * @property {string}   label            row label (passed-through children case preserved)
 * @property {React.ComponentType<any>} [icon]    leading lucide icon component (e.g. icon={Copy})
 * @property {string}   [kbd]            right-aligned shortcut hint (e.g. "⌘D")
 * @property {boolean}  [danger]         destructive (.menu-danger) variant - clay, keeps icon + label
 * @property {boolean}  [disabled]       aria-disabled row, skipped by arrow keys, not selectable
 * @property {boolean}  [separator]      a role="separator" .menu-sep hairline row, skipped by keyboard nav
 * @property {() => void} [onSelect]     invoked when the row is chosen (click or Enter/Space)
 */

/**
 * Menu - a dropdown menu controlled by a single trigger button.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.label             trigger label (lowercase chrome by default)
 * @param {MenuItem[]} [props.items=[]]             menu rows
 * @param {'start'|'end'} [props.align='start']     which edge of the trigger the popout aligns to
 * @param {React.ReactNode} [props.caption]         optional .menu-cap caption rendered inside the popout before the list
 */
export default function Menu({ label, items = [], align = 'start', caption }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()

  // index of each item that is selectable (skips aria-disabled rows AND role="separator" rows),
  // matching App.jsx's items() helper that queries [role="menuitem"]:not([aria-disabled="true"]).
  const enabledIndexes = items.map((it, i) => (it.disabled || it.separator ? -1 : i)).filter((i) => i >= 0)

  // focus an item row by its index into `items`. refs are collected per-render below.
  const itemRefs = useRef([])
  const focusItem = (idx) => {
    if (idx == null || idx < 0) return
    itemRefs.current[idx]?.focus()
  }
  const firstEnabled = () => enabledIndexes[0]
  const lastEnabled = () => enabledIndexes[enabledIndexes.length - 1]

  const openMenu = (which) => {
    setOpen(true)
    // wait for the popout to render, then place focus on the first / last enabled item
    requestAnimationFrame(() => focusItem(which === 'last' ? lastEnabled() : firstEnabled()))
  }
  const close = (returnFocus) => {
    setOpen(false)
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  // outside-click + Tab-out dismissal (Esc is handled on the menu so it can return focus)
  useEffect(() => {
    if (!open) return
    const onDocDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) close(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  const onTriggerClick = (e) => {
    e.preventDefault()
    open ? close(true) : openMenu('first')
  }
  const onTriggerKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); openMenu('first') }
    else if (e.key === 'ArrowUp') { e.preventDefault(); openMenu('last') }
  }

  const onMenuKey = (e) => {
    const order = enabledIndexes
    if (!order.length) {
      if (e.key === 'Escape') { e.preventDefault(); close(true) }
      else if (e.key === 'Tab') close(false)
      return
    }
    const active = itemRefs.current.indexOf(document.activeElement)
    const pos = order.indexOf(active)
    if (e.key === 'Escape') { e.preventDefault(); close(true) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(order[(pos + 1) % order.length]) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(order[(pos - 1 + order.length) % order.length]) }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(order[0]) }
    else if (e.key === 'End') { e.preventDefault(); focusItem(order[order.length - 1]) }
    else if (e.key === 'Tab') close(false)
  }

  const choose = (item) => {
    if (item.disabled) return
    item.onSelect?.()
    close(true)
  }
  const onItemKey = (item) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(item) }
  }

  return (
    <div className="menu-anchor">
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-secondary menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={menuId}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKey}
      >
        {label} <ChevronDown className="menu-caret" aria-hidden="true" />
      </button>
      <div
        ref={menuRef}
        className="menu-pop menu-float"
        id={menuId}
        hidden={!open}
        style={align === 'end' ? { left: 'auto', right: 0 } : undefined}
      >
        {caption != null && <p className="menu-cap">{caption}</p>}
        <ul className="menu-list" role="menu" aria-label={typeof label === 'string' ? label : undefined} onKeyDown={onMenuKey}>
          {items.map((item, i) => {
            if (item.separator) return <li key={i} role="separator" className="menu-sep" />
            const Icon = item.icon
            return (
              <li
                key={i}
                ref={(el) => (itemRefs.current[i] = el)}
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled ? 'true' : undefined}
                className={'menu-item' + (item.danger ? ' menu-danger' : '')}
                onClick={() => choose(item)}
                onKeyDown={onItemKey(item)}
              >
                {Icon && <Icon size={14} aria-hidden="true" />}
                <span className="menu-text">{item.label}</span>
                {item.kbd && <kbd className="kbd menu-kbd">{item.kbd}</kbd>}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
