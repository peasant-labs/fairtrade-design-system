import { useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/* accordion (.acc-*): a NEW tier-2 component, so it ships its own namespaced css
   (the .acc-* block appended to index.css) but reuses the existing tokens, fonts,
   borders and focus-ring exactly like the bs / is / sw / fb families. each item is
   a hairline panel: a header <button aria-expanded aria-controls> (lowercase mono,
   optional lucide leading icon, a trailing ChevronDown that rotates open) controlling
   a role="region" body that is toggled with the `hidden` attribute. single-open by
   default; allowMultiple lets several stay open. keyboard: Enter/Space toggle (native
   to <button>); Up/Down/Home/End roam between headers (roving focus, never selection).
   square, amber scarce, surface-hover on hover, reduced-motion guarded in the css. */

/**
 * @typedef {Object} AccordionItem
 * @property {string} id        stable id for the item (used for the header/region aria wiring)
 * @property {React.ReactNode} title  the header's visible label (not force-lowercased)
 * @property {React.ComponentType<any>} [icon]  optional leading lucide icon component (e.g. icon={Boxes})
 * @property {React.ReactNode} content  the panel body, shown when the item is open
 */

/**
 * Accordion - a stack of collapsible, hairline panels.
 *
 * Uncontrolled only (manages its own open set seeded from `defaultOpen`). With
 * allowMultiple=false (default) opening one item closes the others; with
 * allowMultiple=true any number may be open at once.
 *
 * @param {Object} props
 * @param {AccordionItem[]} props.items                 the items to render (each needs a unique id)
 * @param {string|string[]} [props.defaultOpen]         id(s) open on mount; a lone string or an array.
 *        when allowMultiple is false only the first matching id is honoured (default: none open)
 * @param {boolean} [props.allowMultiple=false]         allow several items open simultaneously
 * @param {number} [props.headingLevel=3]               heading level (1-6) for each item header,
 *        so the accordion fits the surrounding document outline (default: h3)
 * @param {string} [props['aria-label']]                accessible name for the accordion group
 */
export default function Accordion({ items, defaultOpen, allowMultiple = false, headingLevel = 3, 'aria-label': ariaLabel }) {
  const baseId = useId()
  const headerRefs = useRef([])

  // seed the open set from defaultOpen, normalising a string|array to a Set and
  // collapsing to a single id when allowMultiple is off.
  const [openSet, setOpenSet] = useState(() => {
    const seed = defaultOpen == null ? [] : Array.isArray(defaultOpen) ? defaultOpen : [defaultOpen]
    const valid = seed.filter((id) => items.some((it) => it.id === id))
    return new Set(allowMultiple ? valid : valid.slice(0, 1))
  })

  const toggle = (id) => {
    setOpenSet((prev) => {
      const next = new Set(allowMultiple ? prev : [])
      if (prev.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onHeaderKey = (e) => {
    const i = headerRefs.current.indexOf(document.activeElement)
    if (i < 0) return
    let j = i
    if (e.key === 'ArrowDown') j = (i + 1) % items.length
    else if (e.key === 'ArrowUp') j = (i - 1 + items.length) % items.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = items.length - 1
    else return
    e.preventDefault()
    headerRefs.current[j]?.focus()
  }

  const headId = (id) => `${baseId}-head-${id}`
  const panelId = (id) => `${baseId}-panel-${id}`

  // clamp the heading level to a valid 1-6 and render that real heading element.
  const Heading = `h${Math.min(Math.max(headingLevel, 1), 6)}`

  // empty guard: render a stable, full-width box with a lowercase chrome message
  // instead of a near-zero floating bordered rectangle.
  if (!items || items.length === 0) {
    return (
      <div className="acc acc-empty" role="group" aria-label={ariaLabel}>
        <p className="acc-empty-msg">no items</p>
      </div>
    )
  }

  return (
    <div className="acc" role="group" aria-label={ariaLabel} onKeyDown={onHeaderKey}>
      {items.map((it, idx) => {
        const open = openSet.has(it.id)
        const Icon = it.icon
        return (
          <div className={open ? 'acc-item acc-open' : 'acc-item'} key={it.id}>
            <Heading className="acc-h">
              <button
                ref={(el) => { headerRefs.current[idx] = el }}
                type="button"
                className="acc-trigger"
                id={headId(it.id)}
                aria-expanded={open}
                aria-controls={panelId(it.id)}
                onClick={() => toggle(it.id)}
              >
                {Icon && <Icon className="acc-ico" aria-hidden="true" />}
                <span className="acc-title">{it.title}</span>
                <ChevronDown className="acc-chevron" aria-hidden="true" />
              </button>
            </Heading>
            <div
              className="acc-region"
              id={panelId(it.id)}
              role="region"
              aria-labelledby={headId(it.id)}
              hidden={!open}
            >
              <div className="acc-body">{it.content}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
