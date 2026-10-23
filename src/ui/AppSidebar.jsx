import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { AppWindow, BookOpen, ExternalLink, Globe, Laptop, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import './AppSidebar.css'

/* the shared app sidebar every peasant app screen mounts: the hosted app (online), the local app
   (local) and the docs. one nav DOM serves both layouts, and css picks which one shows:

     desktop (width >= 768px)  a sticky full-height column. the brand and a collapse toggle sit on
                               top, then the caller's groups, then the app switcher, then the
                               account row. collapsed, it is an icon rail: labels stay in the DOM as
                               the accessible names (visually hidden) and every item carries a title
                               tooltip. a separator on the right edge resizes it by pointer or keys.
     narrow (width < 768px)    a top bar with the brand and a menu button. the menu opens the same
                               nav as an opaque drawer from the left (no glass, no blur), always
                               expanded; Escape, the scrim, the close button or a nav link closes it
                               and focus returns to the menu button.

   collapsed state and width persist in localStorage under `${storageKey}.collapsed` and
   `${storageKey}.width`. storage is read after mount (so a server render and the first client
   render agree) and every access is wrapped, so the sidebar renders the same without it. chrome is
   mono and lowercase; item labels render as given because collective names are user content.
   tokens only, square corners, classes namespaced `asb-`. */

/**
 * @typedef {Object} AppSidebarApp
 * @property {string} id         'online' | 'local' | 'docs', or another app id (shown with a generic icon).
 * @property {string} label      the switcher label.
 * @property {string} [href]     where the app lives. A non-current app without an href is omitted.
 * @property {string} [target]
 * @property {string} [rel]
 */

/**
 * @typedef {Object} AppSidebarItem
 * @property {string} id
 * @property {string} label                rendered as given (never lowercased: it may be user content).
 * @property {string} [href]               renders a link (or `LinkComponent`).
 * @property {(id: string) => void} [onSelect]  with no href, renders a button that calls this.
 * @property {import('react').ComponentType<any>} [icon]  a lucide icon component.
 * @property {string} [swatch]             a CSS colour for a 12px square in place of an icon, e.g. 'var(--olive)'.
 * @property {boolean} [external]          the item leaves this app: a trailing marker and a spoken suffix.
 * @property {string} [title]              tooltip; defaults to the label.
 * @property {0|1} [depth]                 1 indents the item under the one above it.
 * @property {string} [target]
 * @property {string} [rel]
 */

/**
 * @typedef {Object} AppSidebarGroup
 * @property {string} id
 * @property {string} [label]       a visible group label, shown only while expanded.
 * @property {string} [ariaLabel]   the nav landmark name; defaults to the label, then the id.
 * @property {AppSidebarItem[]} items
 */

/**
 * @typedef {Object} AppSidebarAccount
 * @property {string} handle   shown as @handle; its first letter fills the square avatar.
 * @property {string} [href]   makes the account row a link.
 */

/**
 * @typedef {Object} AppSidebarProps
 * @property {'online'|'local'|'docs'|string} app   which app renders the sidebar; marks its switcher entry current.
 * @property {AppSidebarApp[]} [apps]               the app switcher entries (default APP_SIDEBAR_APPS, no hrefs).
 * @property {AppSidebarGroup[]} groups
 * @property {string} [currentId]                   the id of the current item (aria-current="page").
 * @property {string} [homeHref]                    the brand links here.
 * @property {string} [brand]                       the wordmark, default 'peasant'.
 * @property {AppSidebarAccount} [account]
 * @property {import('react').ReactNode} [accountSlot]  replaces the default account row content.
 * @property {import('react').ComponentType<any>} [LinkComponent]  a router link; receives href, className,
 *   aria-current, title, target, rel, onClick and children.
 * @property {string|null} [storageKey]             localStorage key prefix, default 'fairtrade.app-sidebar'; null disables persistence.
 * @property {boolean} [defaultCollapsed]
 * @property {number} [defaultWidth]                px, default 248.
 * @property {number} [minWidth]                    px, default 200.
 * @property {number} [maxWidth]                    px, default 360.
 * @property {(collapsed: boolean) => void} [onCollapsedChange]
 * @property {string} [label]                       the aside's accessible name, default 'peasant'.
 * @property {string} [className]
 */

/**
 * @typedef {Object} AppSidebarLayoutProps
 * @property {import('react').ReactNode} sidebar   an <AppSidebar>.
 * @property {import('react').ReactNode} children  the page body.
 * @property {string} [className]
 */

/** The app switcher's default entries, in order. Consumers map their hrefs in.
 * @type {ReadonlyArray<Readonly<AppSidebarApp>>} */
export const APP_SIDEBAR_APPS = Object.freeze([
  Object.freeze({ id: 'online', label: 'online' }),
  Object.freeze({ id: 'local', label: 'local' }),
  Object.freeze({ id: 'docs', label: 'docs' }),
])

const APP_ICONS = { online: Globe, local: Laptop, docs: BookOpen }
const RESIZE_STEP = 16
const EXTERNAL_SUFFIX = ', opens outside this app'

// a layout effect on the client (no flash of the default width), a plain effect on the server
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function readStored(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeStored(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // storage is a convenience: a blocked or full store leaves the sidebar working as it is
  }
}

const clampWidth = (value, min, max) => Math.min(max, Math.max(min, value))

function WheatMark() {
  return (
    <svg className="asb-mark" viewBox="0 0 18 22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
      <path d="M9 21V3" />
      <path d="M9 7 5 4" />
      <path d="M9 7l4-3" />
      <path d="M9 11 5 8" />
      <path d="M9 11l4-3" />
      <path d="M9 15l-4-3" />
      <path d="M9 15l4-3" />
    </svg>
  )
}

function Brand({ brand, homeHref, Link, onNavigate }) {
  const body = (
    <>
      <WheatMark />
      <span className="asb-wordmark">{brand}</span>
    </>
  )
  if (!homeHref) return <span className="asb-brand">{body}</span>
  return <Link href={homeHref} className="asb-brand" onClick={onNavigate}>{body}</Link>
}

function Leading({ icon: Icon, swatch, label }) {
  if (Icon) return <span className="asb-ic" aria-hidden="true"><Icon /></span>
  if (swatch) return <span className="asb-sw" aria-hidden="true" style={{ background: swatch }} />
  // with neither, the collapsed rail still needs something to show: the label's first letter
  return <span className="asb-ic asb-initial" aria-hidden="true">{label.charAt(0)}</span>
}

function ItemBody({ item, external }) {
  return (
    <>
      <Leading icon={item.icon} swatch={item.swatch} label={item.label} />
      <span className="asb-label">{item.label}</span>
      {external ? (
        <>
          <span className="asb-ext" aria-hidden="true"><ExternalLink /></span>
          <span className="asb-sr">{EXTERNAL_SUFFIX}</span>
        </>
      ) : null}
    </>
  )
}

function SidebarItem({ item, current, Link, onNavigate }) {
  const className = 'asb-item' + (item.depth === 1 ? ' asb-item-sub' : '')
  const title = item.title ?? item.label
  const ariaCurrent = current ? 'page' : undefined
  const body = <ItemBody item={item} external={!!item.external} />
  if (item.href) {
    return (
      <Link
        href={item.href}
        className={className}
        aria-current={ariaCurrent}
        title={title}
        target={item.target}
        rel={item.rel}
        onClick={() => { item.onSelect?.(item.id); onNavigate() }}
      >
        {body}
      </Link>
    )
  }
  if (item.onSelect) {
    return (
      <button type="button" className={className} aria-current={ariaCurrent} title={title} onClick={() => { item.onSelect(item.id); onNavigate() }}>
        {body}
      </button>
    )
  }
  return <span className={className} aria-current={ariaCurrent} title={title}>{body}</span>
}

function AppSwitcher({ app, apps, Link, onNavigate }) {
  const shown = apps.filter((entry) => entry.id === app || entry.href)
  if (shown.length === 0) return null
  return (
    <nav className="asb-group asb-apps" aria-label="apps">
      <ul className="asb-list">
        {shown.map((entry) => {
          const current = entry.id === app
          const item = { id: entry.id, label: entry.label, icon: APP_ICONS[entry.id] ?? AppWindow }
          const body = <ItemBody item={item} external={!current} />
          return (
            <li key={entry.id}>
              {entry.href ? (
                <Link
                  href={entry.href}
                  className="asb-item"
                  aria-current={current ? 'true' : undefined}
                  title={entry.label}
                  target={entry.target}
                  rel={entry.rel}
                  onClick={onNavigate}
                >
                  {body}
                </Link>
              ) : (
                <span className="asb-item" aria-current="true" title={entry.label}>{body}</span>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function AccountRow({ account, Link, onNavigate }) {
  const handle = account.handle ?? ''
  const body = (
    <>
      <span className="asb-av" aria-hidden="true">{handle.charAt(0).toUpperCase()}</span>
      <span className="asb-label asb-handle">@{handle}</span>
    </>
  )
  if (account.href) {
    return <Link href={account.href} className="asb-account" title={'@' + handle} onClick={onNavigate}>{body}</Link>
  }
  return <span className="asb-account" title={'@' + handle}>{body}</span>
}

/**
 * The shared app sidebar: brand, collapse toggle, the caller's nav groups, the online / local /
 * docs app switcher and an account row. A sticky resizable column on desktop that collapses to an
 * icon rail; a top bar plus an opaque drawer below 768px.
 * @param {AppSidebarProps} props
 */
export default function AppSidebar({
  app,
  apps = APP_SIDEBAR_APPS,
  groups = [],
  currentId,
  homeHref,
  brand = 'peasant',
  account,
  accountSlot,
  LinkComponent,
  storageKey = 'fairtrade.app-sidebar',
  defaultCollapsed = false,
  defaultWidth = 248,
  minWidth = 200,
  maxWidth = 360,
  onCollapsedChange,
  label = 'peasant',
  className = '',
}) {
  const Link = LinkComponent ?? 'a'
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [width, setWidth] = useState(() => clampWidth(defaultWidth, minWidth, maxWidth))
  const [resizing, setResizing] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const reactId = useId()
  const panelId = `asb-panel-${reactId}`
  const panelRef = useRef(null)
  const menuRef = useRef(null)
  const closeRef = useRef(null)
  const dragRef = useRef(null)
  const widthRef = useRef(width)
  widthRef.current = width

  // restore the remembered state after mount, so the server render and the first client render agree
  useIsoLayoutEffect(() => {
    if (!storageKey) return
    const storedCollapsed = readStored(`${storageKey}.collapsed`)
    if (storedCollapsed === 'true' || storedCollapsed === 'false') setCollapsed(storedCollapsed === 'true')
    const storedWidth = Number.parseInt(readStored(`${storageKey}.width`) ?? '', 10)
    if (Number.isFinite(storedWidth)) setWidth(clampWidth(storedWidth, minWidth, maxWidth))
  }, [storageKey, minWidth, maxWidth])

  const persistWidth = useCallback((next) => {
    if (storageKey) writeStored(`${storageKey}.width`, String(next))
  }, [storageKey])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    if (storageKey) writeStored(`${storageKey}.collapsed`, String(next))
    onCollapsedChange?.(next)
  }

  const closeDrawer = useCallback((returnFocus = true) => {
    setDrawerOpen(false)
    if (returnFocus) requestAnimationFrame(() => menuRef.current?.focus())
  }, [])

  // a nav choice inside the drawer closes it; on desktop it is a no-op
  const onNavigate = useCallback(() => {
    if (drawerOpen) closeDrawer(false)
  }, [drawerOpen, closeDrawer])

  // the open drawer holds focus: it starts on the close button, Tab wraps inside, Escape closes
  useEffect(() => {
    if (!drawerOpen) return
    const panel = panelRef.current
    closeRef.current?.focus()
    const focusables = () =>
      [...panel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.getClientRects().length > 0 || el === document.activeElement)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDrawer()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (!panel.contains(document.activeElement)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // crossing back to the desktop layout leaves no drawer to close, so drop the state
    const wide = window.matchMedia?.('(width >= 768px)')
    const onWide = (e) => { if (e.matches) closeDrawer(false) }
    wide?.addEventListener?.('change', onWide)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      wide?.removeEventListener?.('change', onWide)
    }
  }, [drawerOpen, closeDrawer])

  const onResizeKey = (e) => {
    let next
    if (e.key === 'ArrowRight') next = width + RESIZE_STEP
    else if (e.key === 'ArrowLeft') next = width - RESIZE_STEP
    else if (e.key === 'Home') next = minWidth
    else if (e.key === 'End') next = maxWidth
    else return
    e.preventDefault()
    next = clampWidth(next, minWidth, maxWidth)
    setWidth(next)
    persistWidth(next)
  }

  const onResizeDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { x: e.clientX, width: widthRef.current }
    setResizing(true)
  }
  const onResizeMove = (e) => {
    const drag = dragRef.current
    if (!drag) return
    setWidth(clampWidth(drag.width + e.clientX - drag.x, minWidth, maxWidth))
  }
  const onResizeEnd = (e) => {
    if (!dragRef.current) return
    dragRef.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    setResizing(false)
    persistWidth(widthRef.current)
  }

  const rootClass = ['asb', className].filter(Boolean).join(' ')
  const shownAccount = accountSlot ?? (account ? <AccountRow account={account} Link={Link} onNavigate={onNavigate} /> : null)

  return (
    <div
      className={rootClass}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-drawer-open={drawerOpen ? 'true' : 'false'}
      data-resizing={resizing ? 'true' : undefined}
      style={{ '--asb-w': `${width}px` }}
    >
      <div className="asb-bar">
        <Brand brand={brand} homeHref={homeHref} Link={Link} onNavigate={onNavigate} />
        <button
          ref={menuRef}
          type="button"
          className="asb-icon-btn asb-menu"
          aria-label="open the menu"
          aria-expanded={drawerOpen ? 'true' : 'false'}
          aria-controls={panelId}
          onClick={() => setDrawerOpen(true)}
        >
          <Menu aria-hidden="true" />
        </button>
      </div>

      <div className="asb-scrim" aria-hidden="true" onClick={() => closeDrawer()} />

      <aside id={panelId} ref={panelRef} className="asb-panel" aria-label={label}>
        <div className="asb-top">
          <Brand brand={brand} homeHref={homeHref} Link={Link} onNavigate={onNavigate} />
          <button
            type="button"
            className="asb-icon-btn asb-toggle"
            aria-label={collapsed ? 'expand the sidebar' : 'collapse the sidebar'}
            aria-expanded={collapsed ? 'false' : 'true'}
            aria-controls={panelId}
            title={collapsed ? 'expand the sidebar' : 'collapse the sidebar'}
            onClick={toggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </button>
          <button ref={closeRef} type="button" className="asb-icon-btn asb-close" aria-label="close the menu" onClick={() => closeDrawer()}>
            <X aria-hidden="true" />
          </button>
        </div>

        {groups.map((group) => (
          <nav key={group.id} className="asb-group" aria-label={group.ariaLabel ?? group.label ?? group.id}>
            {group.label ? <span className="asb-glabel">{group.label}</span> : null}
            <ul className="asb-list">
              {group.items.map((item) => (
                <li key={item.id}>
                  <SidebarItem item={item} current={item.id === currentId} Link={Link} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <AppSwitcher app={app} apps={apps} Link={Link} onNavigate={onNavigate} />

        {shownAccount ? <div className="asb-me">{shownAccount}</div> : null}
      </aside>

      {collapsed ? null : (
        <div
          role="separator"
          tabIndex={0}
          className="asb-resize"
          aria-orientation="vertical"
          aria-label="resize the sidebar"
          aria-controls={panelId}
          aria-valuenow={width}
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          onKeyDown={onResizeKey}
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
        />
      )}
    </div>
  )
}

/**
 * The page frame for an app screen: the sidebar column beside a main column that takes the rest
 * (min-width 0, so wide content stays contained). One column below 768px, the top bar above the page.
 * @param {AppSidebarLayoutProps} props
 */
export function AppSidebarLayout({ sidebar, children, className = '' }) {
  return (
    <div className={['asb-layout', className].filter(Boolean).join(' ')}>
      {sidebar}
      <div className="asb-main">{children}</div>
    </div>
  )
}
