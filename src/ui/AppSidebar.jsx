import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { AppWindow, BookOpen, ChevronLeft, ExternalLink, Globe, Laptop, MessagesSquare, Moon, Search, Sun } from 'lucide-react'
import './AppSidebar.css'

/* the shared app sidebar every peasant app screen mounts: the hosted app (online), the local app
   (local) and the docs. one nav DOM serves both layouts, and css picks which one shows:

     desktop (width >= 768px)  a sticky full-height column in one fixed order that every app gets:
                                 1. the brand mark, with the collapse control
                                 2. the app's nav groups
                                 3. search, when the app has one (`search`)
                                 4. the switcher to the other apps
                                 5. the footer, one row pinned to the column's foot: the account on
                                    the left, an icon-only theme toggle (`theme`) on the right
                               the collapse control is a small handle seated on the column's
                               right edge, level with the brand. collapsed, it is an icon rail:
                               labels stay in the DOM as the accessible names (visually hidden) and
                               every item carries a title tooltip. a separator on the right edge
                               resizes it by pointer or keys.
     narrow (width < 768px)    a top bar with the brand mark and a menu button. the menu opens the same
                               nav, in the same order, as an opaque drawer from the left (no glass, no blur), always
                               expanded; the menu button turns into its close control, and Escape,
                               the scrim, the button or a nav link closes it, focus returning to
                               the button.

   motion lives in the css, behind prefers-reduced-motion: no-preference, on transform and opacity
   only, and every transition is interruptible: the drawer slides from its edge and its items
   stagger in, the menu glyph turns into a cross, expanded labels fade in from a 4px offset while
   the rail width snaps, and one indicator slides between current items instead of jumping. the
   indicator is placed from layout offsets, so a pressed (scaled) item never skews it.

   collapsed state and width persist in localStorage under `${storageKey}.collapsed` and
   `${storageKey}.width`. storage is read after mount (so a server render and the first client
   render agree) and every access is wrapped, so the sidebar renders the same without it. chrome is
   mono and lowercase; item labels render as given because collective names are user content.
   the brand is the wheat mark alone, its name kept as the accessible name: the full logo with the
   wordmark belongs to the landing page. the switcher lists only the other apps, never the one the
   reader is in, and each opens in a new tab unless the entry says otherwise.
   tokens only, square corners, classes namespaced `asb-`. */

/**
 * @typedef {Object} AppSidebarApp
 * @property {string} id         'online' | 'local' | 'docs', or another app id (shown with a generic icon).
 * @property {string} label      the switcher label.
 * @property {string} [href]     where the app lives. An app without an href is omitted, unless it has a tag.
 * @property {string} [tag]      a short note after the label. With no href the entry is shown as text, not a link.
 * @property {boolean} [soon]    a place that does not exist yet: shown as text, aria-disabled, with a 'soon' note
 *                               and no hover or press. The switcher always ends with community as soon unless
 *                               `apps` names a community entry of its own.
 * @property {string} [target]   default '_blank': another app opens in a new tab.
 * @property {string} [rel]      default 'noopener noreferrer' when the target is '_blank'.
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
 * @typedef {Object} AppSidebarSearch
 * @property {() => void} onOpen     opens the app's search (a command palette, a search page).
 * @property {string} [label]        default 'search'.
 * @property {string} [shortcut]     the key hint shown beside the label, e.g. '⌘K'.
 * @property {string} [keyShortcuts] the same keys for aria-keyshortcuts, e.g. 'Meta+K'.
 */

/**
 * @typedef {Object} AppSidebarAccount
 * @property {string} handle   shown as @handle; its first letter fills the square avatar.
 * @property {string} [href]   makes the account row a link.
 */

/**
 * @typedef {Object} AppSidebarProps
 * @property {'online'|'local'|'docs'|string} app   which app renders the sidebar; its own switcher entry is left out.
 * @property {AppSidebarApp[]} [apps]               the app switcher entries (default APP_SIDEBAR_APPS, no hrefs).
 * @property {AppSidebarGroup[]} groups
 * @property {string} [currentId]                   the id of the current item (aria-current="page").
 * @property {string} [homeHref]                    the brand links here.
 * @property {string} [brand]                       the brand's accessible name and tooltip, default 'peasant'.
 * @property {AppSidebarSearch} [search]           the app's search, placed after its nav groups.
 * @property {'light'|'dark'} [theme]               the current theme; with onThemeChange, the footer leads with the theme toggle.
 * @property {(next: 'light'|'dark') => void} [onThemeChange]  called with the theme to switch to.
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

/**
 * @typedef {Object} AppPageProps
 * @property {import('react').ReactNode} children  the page's parts, top to bottom.
 * @property {import('react').ElementType} [as]     the element, default 'div'.
 * @property {string} [className]
 */

/** The app switcher's default entries, in order. Consumers map their hrefs in.
 * @type {ReadonlyArray<Readonly<AppSidebarApp>>} */
export const APP_SIDEBAR_APPS = Object.freeze([
  Object.freeze({ id: 'online', label: 'online' }),
  Object.freeze({ id: 'local', label: 'local' }),
  Object.freeze({ id: 'docs', label: 'docs' }),
])

const APP_ICONS = { online: Globe, local: Laptop, docs: BookOpen, community: MessagesSquare }

/** The switcher's last entry in every app until a community space exists. */
const COMMUNITY_SOON = Object.freeze({ id: 'community', label: 'community', soon: true })
const RESIZE_STEP = 16
const EXTERNAL_SUFFIX = ', opens outside this app'
const NEW_TAB_SUFFIX = ', opens in a new tab'

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

/* an element's layout offset inside a positioned container, summed up the offsetParent chain: a
   transformed ancestor (a drawer item mid-stagger) becomes an offsetParent of its own, and layout
   offsets ignore transforms, so the sum is the resting position whatever is moving */
function offsetWithin(el, container) {
  let top = 0
  let left = 0
  for (let node = el; node && node !== container; node = node.offsetParent) {
    top += node.offsetTop
    left += node.offsetLeft
  }
  return { top, left }
}

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

/* the mark alone; the name stays as the accessible name and the tooltip */
function Brand({ brand, homeHref, Link, onNavigate }) {
  const body = (
    <>
      <WheatMark />
      <span className="asb-sr">{brand}</span>
    </>
  )
  if (!homeHref) return <span className="asb-brand" title={brand}>{body}</span>
  return <Link href={homeHref} className="asb-brand" title={brand} onClick={onNavigate}>{body}</Link>
}

function Leading({ icon: Icon, swatch, label }) {
  if (Icon) return <span className="asb-ic" aria-hidden="true"><Icon /></span>
  if (swatch) return <span className="asb-sw" aria-hidden="true" style={{ background: swatch }} />
  // with neither, the collapsed rail still needs something to show: the label's first letter
  return <span className="asb-ic asb-initial" aria-hidden="true">{label.charAt(0)}</span>
}

/* three strokes that turn into a cross while the drawer is open (css moves them, transform only) */
function MenuGlyph() {
  return (
    <svg className="asb-glyph lucide" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line className="asb-glyph-top" x1="4" y1="6" x2="20" y2="6" />
      <line className="asb-glyph-mid" x1="4" y1="12" x2="20" y2="12" />
      <line className="asb-glyph-bot" x1="4" y1="18" x2="20" y2="18" />
    </svg>
  )
}

function ItemBody({ item, external, suffix = EXTERNAL_SUFFIX }) {
  return (
    <>
      <Leading icon={item.icon} swatch={item.swatch} label={item.label} />
      <span className="asb-label">{item.label}</span>
      {external ? (
        <>
          <span className="asb-ext" aria-hidden="true"><ExternalLink /></span>
          <span className="asb-sr">{suffix}</span>
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

/* the other apps: the one the reader is in is not a destination, so it is left out, and an app
   with nowhere to go is left out too. each opens in a new tab unless its entry names a target. */
function AppSwitcher({ app, apps, Link, onNavigate, firstIndex }) {
  // every app ends its switcher with community; an app names its own entry once the place exists
  const withCommunity = apps.some((entry) => entry.id === COMMUNITY_SOON.id) ? apps : [...apps, COMMUNITY_SOON]
  const shown = withCommunity.filter((entry) => entry.id !== app && (entry.href || entry.tag || entry.soon))
  if (shown.length === 0) return null
  return (
    <nav className="asb-group asb-apps" aria-label="apps">
      <ul className="asb-list">
        {shown.map((entry, index) => {
          const item = { id: entry.id, label: entry.label, icon: APP_ICONS[entry.id] ?? AppWindow }
          const target = entry.target ?? '_blank'
          const rel = entry.rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)
          const note = entry.soon ? 'soon' : entry.tag
          // the space keeps the note a separate word in the text; flex layout ignores it
          const tag = note ? <>{' '}<span className="asb-tag">{note}</span></> : null
          return (
            <li key={entry.id} style={{ '--asb-i': firstIndex + index }}>
              {entry.href && !entry.soon ? (
                <Link href={entry.href} className="asb-item" title={note ? `${entry.label}, ${note}` : entry.label} target={target} rel={rel} onClick={onNavigate}>
                  <ItemBody item={item} external suffix={target === '_blank' ? NEW_TAB_SUFFIX : EXTERNAL_SUFFIX} />
                  {tag}
                </Link>
              ) : (
                <span className="asb-item asb-item-soon" aria-disabled="true" title={`${entry.label}, ${note}`}>
                  <ItemBody item={item} external={false} />
                  {tag}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/* the app's search: one item after the nav groups, its key hint beside the label */
function SearchItem({ search, onNavigate, index }) {
  const label = search.label ?? 'search'
  return (
    <div className="asb-group asb-search">
      <ul className="asb-list">
        <li style={{ '--asb-i': index }}>
          <button
            type="button"
            className="asb-item"
            title={search.shortcut ? `${label} (${search.shortcut})` : label}
            aria-keyshortcuts={search.keyShortcuts}
            onClick={() => { onNavigate(); search.onOpen?.() }}
          >
            <span className="asb-ic" aria-hidden="true"><Search /></span>
            <span className="asb-label">{label}</span>
            {search.shortcut ? <kbd className="asb-kbd" aria-hidden="true">{search.shortcut}</kbd> : null}
          </button>
        </li>
      </ul>
    </div>
  )
}

/* the theme toggle: a square icon button that names the theme it switches to, with that theme's
   icon. its tip sits above it (beside it in the rail), never over the account. */
function ThemeItem({ theme, onThemeChange }) {
  const next = theme === 'light' ? 'dark' : 'light'
  const name = `switch to ${next} mode`
  return (
    <button type="button" className="asb-icon-btn asb-theme" aria-label={name} onClick={() => onThemeChange(next)}>
      {next === 'dark' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      <span className="asb-tip" aria-hidden="true">{name}</span>
    </button>
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
 * The shared app sidebar, in one order for every app: the brand mark with a collapse handle on the
 * column's edge, the caller's nav groups, search, the switcher to the other apps, then the footer
 * row (the account on the left, the theme toggle on the right). A sticky resizable column on desktop
 * that collapses to an icon rail; a top bar plus an opaque drawer below 768px.
 * @param {AppSidebarProps} props
 */
export default function AppSidebar({
  app,
  apps = APP_SIDEBAR_APPS,
  groups = [],
  currentId,
  homeHref,
  brand = 'peasant',
  search,
  theme,
  onThemeChange,
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
  // set by the first user toggle, so expand-only entrance motion never plays on page load
  const [toggled, setToggled] = useState(false)
  // the one current-item indicator: placed from layout offsets, animated only when the current
  // item changes (never on mount, collapse or resize, which would read as drift)
  const [indicator, setIndicator] = useState(null)
  const placedForRef = useRef(null)
  const reactId = useId()
  const panelId = `asb-panel-${reactId}`
  const panelRef = useRef(null)
  const scrollRef = useRef(null)
  const menuRef = useRef(null)
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
    setToggled(true)
    if (storageKey) writeStored(`${storageKey}.collapsed`, String(next))
    onCollapsedChange?.(next)
  }

  useIsoLayoutEffect(() => {
    const panel = scrollRef.current
    if (!panel) return undefined
    const place = () => {
      const current = panel.querySelector('nav:not(.asb-apps) .asb-item[aria-current="page"]')
      if (!current) {
        placedForRef.current = null
        setIndicator((previous) => (previous === null ? previous : null))
        return
      }
      // slide only when the current item itself changed; a re-measure for the same item snaps
      const animate = placedForRef.current !== null && placedForRef.current !== currentId
      placedForRef.current = currentId
      // layout offsets relative to the positioned scroller, unaffected by a press scale or a stagger
      const { top, left } = offsetWithin(current, panel)
      const next = { id: currentId, top, left, width: current.offsetWidth, height: current.offsetHeight, animate }
      setIndicator((previous) => (previous && previous.id === next.id && previous.top === next.top && previous.left === next.left && previous.width === next.width && previous.height === next.height ? previous : next))
    }
    place()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(place)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [currentId, collapsed, width, groups, drawerOpen])

  const closeDrawer = useCallback((returnFocus = true) => {
    setDrawerOpen(false)
    if (returnFocus) requestAnimationFrame(() => menuRef.current?.focus())
  }, [])

  // a nav choice inside the drawer closes it; on desktop it is a no-op
  const onNavigate = useCallback(() => {
    if (drawerOpen) closeDrawer(false)
  }, [drawerOpen, closeDrawer])

  // the open drawer holds focus: the menu button (now its close control) and the drawer form one
  // Tab loop, and Escape closes
  useEffect(() => {
    if (!drawerOpen) return
    const panel = panelRef.current
    const menu = menuRef.current
    menu?.focus()
    const inLoop = (el) => el === menu || panel.contains(el)
    const focusables = () =>
      [menu, ...panel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el && (el.getClientRects().length > 0 || el === document.activeElement))
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
      if (!inLoop(document.activeElement)) {
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
  // a running index over every listed item, so the drawer can stagger them in order
  let listIndex = 0
  const shownAccount = accountSlot ?? (account ? <AccountRow account={account} Link={Link} onNavigate={onNavigate} /> : null)
  const showTheme = (theme === 'light' || theme === 'dark') && typeof onThemeChange === 'function'

  return (
    <div
      className={rootClass}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-drawer-open={drawerOpen ? 'true' : 'false'}
      data-resizing={resizing ? 'true' : undefined}
      data-indicator={indicator ? 'ready' : undefined}
      data-toggled={toggled ? 'true' : undefined}
      style={{ '--asb-w': `${width}px` }}
    >
      {/* the narrow top bar is a landmark of its own, so nothing on the page sits outside one */}
      <nav className="asb-bar" aria-label={`${label} menu`}>
        <Brand brand={brand} homeHref={homeHref} Link={Link} onNavigate={onNavigate} />
        <button
          ref={menuRef}
          type="button"
          className="asb-icon-btn asb-menu"
          aria-label={drawerOpen ? 'close the menu' : 'open the menu'}
          aria-expanded={drawerOpen ? 'true' : 'false'}
          aria-controls={panelId}
          onClick={() => (drawerOpen ? closeDrawer() : setDrawerOpen(true))}
        >
          <MenuGlyph />
        </button>
      </nav>

      <div className="asb-scrim" aria-hidden="true" onClick={() => closeDrawer()} />

      {/* the aside holds everything else, the resize separator included; its content scrolls in an
          inner column so the separator on the edge is never clipped */}
      <aside id={panelId} ref={panelRef} className="asb-panel" aria-label={label}>
        {/* the brand row stays put while the nav scrolls; the collapse handle sits on the column's
            edge level with it, so it is reached right after the brand */}
        <div className="asb-top">
          <Brand brand={brand} homeHref={homeHref} Link={Link} onNavigate={onNavigate} />
          <button
            type="button"
            className="asb-toggle"
            aria-label={collapsed ? 'expand the sidebar' : 'collapse the sidebar'}
            aria-expanded={collapsed ? 'false' : 'true'}
            aria-controls={panelId}
            title={collapsed ? 'expand the sidebar' : 'collapse the sidebar'}
            onClick={toggleCollapsed}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
        </div>
        <div ref={scrollRef} className="asb-scroll">
          <span
            className="asb-indicator"
            aria-hidden="true"
            data-placed={indicator ? 'true' : 'false'}
            data-animate={indicator?.animate ? 'true' : 'false'}
            style={indicator ? { transform: `translateY(${indicator.top}px)`, left: `${indicator.left}px`, width: `${indicator.width}px`, height: `${indicator.height}px` } : undefined}
          />
          {groups.map((group) => (
            <nav key={group.id} className="asb-group" aria-label={group.ariaLabel ?? group.label ?? group.id}>
              {group.label ? <span className="asb-glabel">{group.label}</span> : null}
              <ul className="asb-list">
                {group.items.map((item) => (
                  <li key={item.id} style={{ '--asb-i': listIndex++ }}>
                    <SidebarItem item={item} current={item.id === currentId} Link={Link} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {search ? <SearchItem search={search} onNavigate={onNavigate} index={listIndex++} /> : null}

          <AppSwitcher app={app} apps={apps} Link={Link} onNavigate={onNavigate} firstIndex={listIndex} />

        </div>

        {/* the footer: one row pinned under the nav, the account on the left (or the host's
            signed-out slot) and the theme toggle on the right */}
        {showTheme || shownAccount ? (
          <div className="asb-foot">
            {shownAccount ? <div className="asb-me">{shownAccount}</div> : null}
            {showTheme ? <ThemeItem theme={theme} onThemeChange={onThemeChange} /> : null}
          </div>
        ) : null}

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
      </aside>
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

/**
 * The frame for one app page inside AppSidebarLayout: the full width of the main column with the
 * same padding on the left and the right, so a page is never a capped column with an uneven gap
 * beside the sidebar. A full-bleed screen (a transcript, a map) leaves it out.
 * @param {AppPageProps} props
 */
export function AppPage({ children, as: Tag = 'div', className = '', ...rest }) {
  return <Tag className={['asb-page', className].filter(Boolean).join(' ')} {...rest}>{children}</Tag>
}
