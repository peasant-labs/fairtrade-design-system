import { useRef, useState } from 'react'
import { ChevronLeft, ScrollText, Users, Waypoints } from 'lucide-react'

export const IN_USE_APPS = Object.freeze([
  { id: 'transcript', mark: 'transcript-browser', icon: ScrollText },
  { id: 'commons', mark: 'village', icon: Users },
  { id: 'graph', mark: 'peasant', icon: Waypoints },
])

/**
 * One entry of a section list. `inNav: false` keeps a section out of the section navigation; an
 * entry without `inNav` is listed. A consumer's own list may carry more fields (an `href`).
 * @typedef {{ id: string, label: string, inNav?: boolean, title?: string }} AppSection
 */

/* The local app's section registry, in canonical order. `inNav` says whether a section is
   listed in the section navigation: home and settings are; analytics, changes and code map keep
   their ids, labels and routes, and are reached by route only. A consumer derives its nav and
   routes from this list and fails loudly on an id it does not map. The declared type keeps the
   components' `sections` prop open to any AppSection list, not only these five entries. */
/** @type {ReadonlyArray<Readonly<AppSection>>} */
export const LOCAL_APP_SECTIONS = Object.freeze([
  Object.freeze({ id: 'home', label: 'home', inNav: true }),
  Object.freeze({ id: 'settings', label: 'settings', inNav: true }),
  Object.freeze({ id: 'analytics', label: 'analytics', inNav: false }),
  Object.freeze({ id: 'changes', label: 'changes', inNav: false }),
  Object.freeze({ id: 'map', label: 'code map', inNav: false }),
])

/**
 * @deprecated use LOCAL_APP_SECTIONS. The earlier three-section registry, kept with its original
 * value so a consumer on the old shape keeps working until it re-pins.
 */
export const GRAPH_APP_SECTIONS = Object.freeze([
  { id: 'analytics', label: 'analytics' },
  { id: 'changes', label: 'changes' },
  { id: 'map', label: 'code map' },
])

/* The entries a section navigation lists: every entry not marked `inNav: false`. An entry with no
   `inNav` field (the deprecated registry, or a consumer's own list) keeps rendering. */
export function navSectionsOf(sections) {
  return sections.filter((section) => section.inNav !== false)
}

function isTextEntry(target) {
  return target && (/(INPUT|TEXTAREA|SELECT)/.test(target.tagName) || target.isContentEditable)
}

export default function InUseShell({
  apps = IN_USE_APPS,
  defaultApp,
  activeApp,
  onAppChange,
  renderApp,
  brand = 'fairtrade',
  ariaLabel = 'the design system in use',
}) {
  const firstApp = defaultApp ?? apps[0]?.id
  const [localApp, setLocalApp] = useState(firstApp)
  const app = activeApp ?? localApp
  const tabRefs = useRef({})
  const selectApp = (next) => {
    if (activeApp === undefined) setLocalApp(next)
    onAppChange?.(next)
  }
  const active = apps.find((a) => a.id === app) ?? apps[0]

  const onKeyDown = (e) => {
    if (isTextEntry(e.target)) return
    const i = { '1': 0, '2': 1, '3': 2 }[e.key]
    if (i != null && apps[i]) { e.preventDefault(); selectApp(apps[i].id) }
  }

  const onTabKeyDown = (e) => {
    const ids = apps.map((a) => a.id)
    const i = ids.indexOf(active?.id)
    if (i < 0) return
    let j = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % ids.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + ids.length) % ids.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = ids.length - 1
    else return
    e.preventDefault()
    selectApp(ids[j])
    tabRefs.current[ids[j]]?.focus()
  }

  return (
    <section className="iu" id="inuse" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      <div className="iu-bar">
        <div className="iu-bar-brand">
          <svg className="logo" width="18" height="18" viewBox="0 0 32 32" aria-hidden="true"><use href="#logo" /></svg>
          <span>{brand}</span>
        </div>

        <div className="iu-switch" role="tablist" aria-label="apps" aria-orientation="horizontal" onKeyDown={onTabKeyDown}>
          {apps.map((a, i) => {
            const Icon = a.icon
            const on = a.id === active?.id
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={'iu-tab-' + a.id}
                aria-selected={on ? 'true' : 'false'}
                aria-controls="inuse-stage"
                tabIndex={on ? 0 : -1}
                ref={(el) => { tabRefs.current[a.id] = el }}
                className={'iu-opt' + (on ? ' iu-opt-on' : '')}
                onClick={() => selectApp(a.id)}
              >
                {Icon ? <span className="iu-opt-ico"><Icon size={16} aria-hidden="true" /></span> : null}
                <span className="iu-opt-label">{a.mark}</span>
                <span className="iu-opt-key" aria-hidden="true">{i + 1}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="iu-stage" id="inuse-stage" role="tabpanel" aria-labelledby={'iu-tab-' + active?.id} tabIndex={-1}>
        <div className="iu-screen" key={active?.id}>
          {active ? renderApp?.(active.id) : null}
        </div>
      </div>
    </section>
  )
}

export function GraphAppShell({
  sections = LOCAL_APP_SECTIONS,
  activeId,
  activePrimaryId,
  onSectionChange,
  backTo,
  onBack,
  notice = null,
  children,
  ariaLabel = 'peasant sections',
}) {
  const active = activePrimaryId ?? activeId
  return (
    <div className="iu-app-root">
      <nav className="iu-subnav" aria-label={ariaLabel}>
        {backTo ? (
          <button type="button" className="iu-subnav-back" onClick={() => onBack ? onBack(backTo) : onSectionChange?.(backTo)}>
            <ChevronLeft size={14} aria-hidden="true" /> back
          </button>
        ) : null}
        {navSectionsOf(sections).map((p) => (
          <button
            key={p.id}
            type="button"
            className={'iu-subnav-item' + (active === p.id ? ' active' : '')}
            aria-current={activeId === p.id ? 'page' : undefined}
            onClick={() => onSectionChange?.(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      {/* a page-level notice (e.g. the local offline banner) sits between the nav and the body */}
      {notice}
      <div className="iu-view">{children}</div>
    </div>
  )
}

export function GraphSectionNav({
  sections = LOCAL_APP_SECTIONS,
  activeId = undefined,
  hrefFor = undefined,
  LinkComponent = undefined,
  onSectionChange = undefined,
  className = 'iu-subnav',
  itemClassName = 'iu-subnav-item',
  activeItemClassName = 'active',
  activeMarker = null,
  ariaLabel = 'peasant sections',
}) {
  return (
    <nav className={className} aria-label={ariaLabel}>
      {navSectionsOf(sections).map((p) => {
        const active = activeId === p.id
        const itemClasses = itemClassName + (active && activeItemClassName ? ' ' + activeItemClassName : '')
        const body = <>{p.label}{active ? activeMarker : null}</>
        const href = hrefFor?.(p)
        if (href && LinkComponent) {
          return (
            <LinkComponent key={p.id} href={href} className={itemClasses} aria-current={active ? 'page' : undefined} title={p.title}>
              {body}
            </LinkComponent>
          )
        }
        if (href) {
          return (
            <a key={p.id} href={href} className={itemClasses} aria-current={active ? 'page' : undefined} title={p.title}>
              {body}
            </a>
          )
        }
        return (
          <button
            key={p.id}
            type="button"
            className={itemClasses}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSectionChange?.(p.id)}
          >
            {body}
          </button>
        )
      })}
    </nav>
  )
}
