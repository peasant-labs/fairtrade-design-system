import { useId, useRef, useState } from 'react'

/**
 * @typedef {Object} TabItem
 * @property {string} id        stable id for the tab/panel pair (used for ids + aria wiring)
 * @property {React.ReactNode} label  the tab's visible label; force-lowercased as ui chrome, so pass a section name, never user content / proper nouns
 * @property {number} [count]   optional count shown in a .cnt badge after the label
 * @property {React.ReactNode} content  the panel's content
 */

/**
 * Self-contained ARIA tablist matching the trails-section specimen. Renders a
 * `role="tablist".tabs` of `role="tab".tab` buttons (roving tabindex, `.active`
 * on the selected tab, optional `.cnt` count) controlling `role="tabpanel".tabpanel`
 * regions whose `hidden` attribute is toggled. Keyboard: Arrow/Home/End move
 * selection (also focusing the tab), click selects + focuses. Ports the delegated
 * logic from App.jsx's tablist useEffect.
 *
 * Supports controlled (`value` + `onChange`) and uncontrolled (`defaultTab`) use.
 *
 * @param {Object} props
 * @param {TabItem[]} props.tabs           the tabs to render
 * @param {string} [props.defaultTab]      initial selected tab id (uncontrolled; defaults to tabs[0].id)
 * @param {string} [props.value]           selected tab id (controlled)
 * @param {(id: string) => void} [props.onChange]  called with the newly selected tab id
 * @param {string} [props['aria-label']]   accessible name for the tablist (default "tabs")
 */
export default function Tabs({ tabs, defaultTab, value, onChange, 'aria-label': ariaLabel = 'tabs' }) {
  const baseId = useId()
  const tabRefs = useRef([])
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(() => defaultTab ?? tabs[0]?.id)
  const selected = isControlled ? value : internal

  const select = (id) => {
    if (!isControlled) setInternal(id)
    if (id !== selected) onChange?.(id)
  }

  const onKeyDown = (e) => {
    const i = tabs.findIndex((t) => t.id === selected)
    if (i < 0) return
    let j = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = tabs.length - 1
    else return
    e.preventDefault()
    select(tabs[j].id)
    tabRefs.current[j]?.focus()
  }

  const tabId = (id) => `${baseId}-tab-${id}`
  const panelId = (id) => `${baseId}-panel-${id}`

  return (
    <>
      <div className="tabs" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
        {tabs.map((t, idx) => {
          const on = t.id === selected
          return (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[idx] = el }}
              className={on ? 'tab active' : 'tab'}
              role="tab"
              id={tabId(t.id)}
              aria-controls={panelId(t.id)}
              aria-selected={on ? 'true' : 'false'}
              tabIndex={on ? 0 : -1}
              onClick={() => { select(t.id); tabRefs.current[idx]?.focus() }}
            >
              {t.label}
              {t.count != null && <span className="cnt">{t.count}</span>}
            </button>
          )
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          className="tabpanel"
          id={panelId(t.id)}
          role="tabpanel"
          aria-labelledby={tabId(t.id)}
          tabIndex={t.id === selected ? 0 : -1}
          hidden={t.id !== selected}
        >
          {t.content}
        </div>
      ))}
    </>
  )
}
