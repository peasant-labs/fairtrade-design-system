import { useEffect, useRef, useState } from 'react'
import './SettingsNav.css'

/* the settings section bar: one list of a settings page's sections, inside the page body, so a
   settings page never takes over the app sidebar. every app's settings use it: the account
   settings, a collective's settings and the local app's settings.

     wide      (its column >= 44rem)  a sticky column beside the sections, the current section on
                                      a surface-2 fill with the amber inset bar (the app sidebar's
                                      look, one level down).
     narrow    (its column < 44rem)   a single row above the sections that scrolls sideways, the
                                      current section underlined in amber like a tab; the current
                                      one is kept in view.

   a section is a link (a route such as `?section=github`, or an anchor such as `#profile`) or,
   with no href, a button that calls onSelect. the current section carries aria-current: 'page'
   for a route, 'location' for an anchor on the same page, 'true' for a button. on one long page
   of anchors, `spy` marks the section being read as the reader scrolls. the layout is picked by
   a container query, so it follows the width the page body really has (beside an expanded or a
   collapsed sidebar), not the window's. chrome is mono and lowercase; tokens only, square
   corners, classes namespaced `snav-`. motion: a press scales to 0.98 under
   prefers-reduced-motion: no-preference; hover only on a fine pointer. */

/**
 * @typedef {Object} SettingsNavSection
 * @property {string} id
 * @property {string} label                          lowercase chrome.
 * @property {string} [href]                         a route or an in-page anchor (`#id`); renders a link.
 * @property {import('react').ComponentType<any>} [icon]  a lucide icon component.
 */

/**
 * @typedef {Object} SettingsNavProps
 * @property {SettingsNavSection[]} sections
 * @property {string} [currentId]                    the section the page shows.
 * @property {(id: string) => void} [onSelect]       called when a section is chosen; with no href, the section is a button.
 * @property {boolean} [spy]                         anchors on one page: mark the section in view while the reader scrolls.
 * @property {string} [label]                        the nav landmark's name, default 'settings sections'.
 * @property {import('react').ComponentType<any>} [LinkComponent]  a router link; receives href, className,
 *   aria-current, onClick and children.
 * @property {string} [className]
 */

/**
 * @typedef {Object} SettingsLayoutProps
 * @property {import('react').ReactNode} children    the sections.
 * @property {string} [bodyClassName]
 */

const anchorOf = (href) => (typeof href === 'string' && href.startsWith('#') ? href.slice(1) : null)

/* the section being read: the first one crossing the upper part of the window */
function useSpiedSection(sections, enabled) {
  const [spied, setSpied] = useState(null)
  // observe again only when the anchors change, not on every new sections array
  const anchors = sections.map((section) => `${section.id}=${section.href ?? ''}`).join('|')
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return undefined
    const targets = sections
      .map((section) => ({ id: section.id, el: anchorOf(section.href) && document.getElementById(anchorOf(section.href)) }))
      .filter((entry) => entry.el)
    if (targets.length === 0) return undefined
    const showing = new Map()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) showing.set(entry.target, entry.isIntersecting)
      const first = targets.find((target) => showing.get(target.el))
      if (first) setSpied(first.id)
    }, { rootMargin: '-15% 0px -65% 0px' })
    for (const target of targets) observer.observe(target.el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchors, enabled])
  return [spied, setSpied]
}

/**
 * The settings section bar: the sections of one settings page, as a nav inside the page body.
 * @param {SettingsNavProps} props
 */
export function SettingsNav({ sections = [], currentId, onSelect, spy = false, label = 'settings sections', LinkComponent, className = '' }) {
  const Link = LinkComponent ?? 'a'
  const [spied, setSpied] = useSpiedSection(sections, spy)
  const active = (spy && spied) || currentId
  const listRef = useRef(null)

  // in the sideways row, keep the current section in view without moving the page
  useEffect(() => {
    const list = listRef.current
    const item = list?.querySelector('[aria-current]')
    if (!list || !item || list.scrollWidth <= list.clientWidth) return
    const start = item.offsetLeft
    const end = start + item.offsetWidth
    if (start < list.scrollLeft) list.scrollLeft = start
    else if (end > list.scrollLeft + list.clientWidth) list.scrollLeft = end - list.clientWidth
  }, [active])

  const choose = (id) => {
    if (spy) setSpied(id)
    onSelect?.(id)
  }

  return (
    <nav className={['snav', className].filter(Boolean).join(' ')} aria-label={label}>
      <ul ref={listRef} className="snav-list">
        {sections.map((section) => {
          const current = section.id === active
          const Icon = section.icon
          const body = (
            <>
              {Icon ? <span className="snav-ic" aria-hidden="true"><Icon /></span> : null}
              <span className="snav-label">{section.label}</span>
            </>
          )
          let ariaCurrent
          if (current) ariaCurrent = section.href ? (anchorOf(section.href) ? 'location' : 'page') : 'true'
          return (
            <li key={section.id}>
              {section.href ? (
                <Link href={section.href} className="snav-item" aria-current={ariaCurrent} onClick={() => choose(section.id)}>
                  {body}
                </Link>
              ) : (
                <button type="button" className="snav-item" aria-current={ariaCurrent} onClick={() => choose(section.id)}>
                  {body}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * A settings page body: the section bar beside the sections on a wide column, above them on a
 * narrow one. Takes every SettingsNav prop.
 * @param {SettingsNavProps & SettingsLayoutProps} props
 */
export function SettingsLayout({ children, bodyClassName = '', className = '', ...nav }) {
  return (
    <div className={['snav-layout', className].filter(Boolean).join(' ')}>
      <div className="snav-grid">
        <SettingsNav {...nav} />
        <div className={['snav-body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>
      </div>
    </div>
  )
}
