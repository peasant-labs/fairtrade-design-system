import { useCallback, useId, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import './RailShell.css'

/* canvas + sticky-rail app-shell, ported from peasant's RailShell / RailSection / split-rail idiom.
   the contract: a main content column that scrolls (min-width:0 so a wide canvas never blows the
   layout out) sitting beside a 320px hairline rail card that STAYS sticky as the canvas scrolls. on
   desktop the rail is the second column; below the two-column breakpoint (<=880px) it detaches into
   a fixed bottom-sheet with a "details" drag-handle header you expand/collapse (a real <button> with
   aria-expanded), so the rail never compromises the desktop layout — it only complements on mobile.

   three pieces:
     RailShell    the shell frame — optional sticky toolbar, scrolling main, sticky 320px rail.
     RailSection  one mono-headed hairline section inside a rail (optionally collapsible).
     SplitRail    the dual-rail variant — two independently-collapsible columns that stack on mobile.

   chrome (toolbar labels, section headers, the sheet toggle) is mono + lowercase; section BODIES
   carry whatever the caller renders. tokens only, square corners, hairline rules; every transition
   is gated behind prefers-reduced-motion: no-preference. classes are namespaced `rs-` so nothing
   collides with index.css. */

/**
 * @typedef {Object} RailShellProps
 * @property {React.ReactNode} [toolbar]      optional sticky top toolbar (mono chrome row); omitted when absent.
 * @property {React.ReactNode} children        the main content / canvas column (scrolls; min-width:0).
 * @property {React.ReactNode} rail            the rail contents — compose with <RailSection> children.
 * @property {'left'|'right'} [railSide='right']  which side the desktop rail sits on.
 * @property {string} [sheetTitle='details']   the bottom-sheet toggle label (mono, lowercased) on mobile.
 * @property {React.ReactNode} [sheetMeta]     quiet right-side content in the sheet header (e.g. a count).
 * @property {string} [className]              extra class on the root.
 */

/**
 * The shell frame: a two-column canvas + sticky-rail layout on desktop that collapses the rail into
 * a fixed bottom-sheet below 880px. The main column scrolls and is min-width:0 so a wide canvas
 * stays contained; the rail is a 320px sticky hairline card. The same `rail` content renders in both
 * the desktop card and the mobile sheet, so avoid `id` attributes inside it. The sheet's expand /
 * collapse is a button reporting aria-expanded and is wired to the sheet body via aria-controls.
 */
export default function RailShell({
  toolbar,
  children,
  rail,
  railSide = 'right',
  sheetTitle = 'details',
  sheetMeta,
  className = '',
}) {
  // the bottom-sheet (mobile only) starts collapsed — the canvas leads; details sit one tap away.
  const [sheetOpen, setSheetOpen] = useState(false)
  const reactId = useId()
  const sheetBodyId = `rs-sheet-${reactId}`

  return (
    <div
      className={`rs rs--${railSide}${className ? ` ${className}` : ''}`}
      data-sheet-open={sheetOpen ? 'true' : 'false'}
    >
      {/* the two-column frame lives one level inside the query container so a container query can
          flip it between row (desktop) and single-column (mobile) — an element can't be restyled by
          its own container, only its descendants can. */}
      <div className="rs-frame">
        <div className="rs-main">
          {toolbar && <div className="rs-toolbar">{toolbar}</div>}
          <div className="rs-canvas">{children}</div>
        </div>

        {/* desktop rail: a 320px sticky hairline card. hidden below the breakpoint, where the sheet
            takes over. labeled by the same sheetTitle so the panel announces what it is. */}
        <aside className="rs-rail" aria-label={sheetTitle}>
          <div className="rs-rail-card">{rail}</div>
        </aside>
      </div>

      {/* mobile bottom-sheet: a fixed, full-width hairline panel pinned to the viewport bottom. the
          header toggle expands/collapses the body region (aria-controls/aria-expanded); the same
          `rail` content lives inside. shown only below the breakpoint via css. */}
      <div className="rs-sheet" aria-label={sheetTitle}>
        <button
          type="button"
          className="rs-sheet-toggle"
          aria-expanded={sheetOpen}
          aria-controls={sheetBodyId}
          onClick={() => setSheetOpen((v) => !v)}
        >
          {/* the drag-handle affordance — a short hairline bar that reads "grabbable". */}
          <span className="rs-sheet-grip" aria-hidden="true" />
          <span className="rs-sheet-row">
            <span className="rs-sheet-title">{sheetTitle}</span>
            <span className="rs-sheet-end">
              {sheetMeta && <span className="rs-sheet-meta">{sheetMeta}</span>}
              <ChevronDown className="rs-sheet-chevron lucide" aria-hidden="true" />
            </span>
          </span>
        </button>
        <div
          id={sheetBodyId}
          role="region"
          aria-label={sheetTitle}
          className="rs-sheet-body"
          hidden={!sheetOpen}
        >
          {rail}
        </div>
      </div>
    </div>
  )
}

/**
 * @typedef {Object} RailSectionProps
 * @property {React.ReactNode} [title]         mono section header (lowercased by css).
 * @property {React.ComponentType} [icon]      optional lucide icon component shown before the title.
 * @property {React.ReactNode} [meta]          quiet right-aligned header content (a count, a glyph).
 * @property {React.ReactNode} children         the section body.
 * @property {boolean} [collapsible=false]     when true, the header is a button that toggles the body.
 * @property {boolean} [defaultOpen=true]      initial open state when collapsible.
 * @property {string} [className]              extra class on the section.
 */

/**
 * One titled hairline section inside a rail: a mono header (optional icon + title + meta) over a
 * body. When `collapsible`, the header becomes a button reporting aria-expanded and wired to the
 * body via aria-controls; the chevron rotates open. Sections divide from one another with the
 * rail card's hairlines.
 */
export function RailSection({
  title,
  icon: Icon,
  meta,
  children,
  collapsible = false,
  defaultOpen = true,
  className = '',
}) {
  const [open, setOpen] = useState(defaultOpen)
  const reactId = useId()
  const bodyId = `rs-sec-${reactId}`

  const head = (
    <>
      {Icon && <Icon className="rs-sec-icon lucide" aria-hidden="true" />}
      {title && <span className="rs-sec-title">{title}</span>}
      <span className="rs-sec-end">
        {meta && <span className="rs-sec-meta">{meta}</span>}
        {collapsible && (
          <ChevronRight className="rs-sec-chevron lucide" aria-hidden="true" />
        )}
      </span>
    </>
  )

  return (
    <section
      className={`rs-sec${collapsible ? ' rs-sec--collapsible' : ''}${
        open ? ' is-open' : ''
      }${className ? ` ${className}` : ''}`}
    >
      {collapsible ? (
        <button
          type="button"
          className="rs-sec-head rs-sec-head--button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
        >
          {head}
        </button>
      ) : (
        <div className="rs-sec-head">{head}</div>
      )}
      {/* non-collapsible sections render the body always; collapsible ones hide it from layout and
          the a11y tree when closed while keeping the controlled region mounted. */}
      <div
        id={collapsible ? bodyId : undefined}
        className="rs-sec-body"
        hidden={collapsible ? !open : undefined}
      >
        {children}
      </div>
    </section>
  )
}

/**
 * @typedef {Object} SplitRailPanelProps
 * @property {React.ReactNode} [title]         mono header for the column.
 * @property {React.ComponentType} [icon]      optional lucide icon before the title.
 * @property {React.ReactNode} [meta]          quiet right-aligned header content.
 * @property {React.ReactNode} children         the column body.
 * @property {boolean} [defaultOpen=true]      initial open state (each column collapses independently).
 */

/**
 * One independently-collapsible column of a SplitRail. Always collapsible — the dual-rail idiom is
 * about toggling each side (outline / filters) on its own. Same header/body/aria contract as a
 * collapsible RailSection, framed as its own hairline card so the two columns read as peers.
 */
function SplitRailPanel({ title, icon: Icon, meta, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const reactId = useId()
  const bodyId = `rs-split-${reactId}`

  return (
    <section className={`rs-split-panel${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="rs-split-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        {Icon && <Icon className="rs-sec-icon lucide" aria-hidden="true" />}
        {title && <span className="rs-sec-title">{title}</span>}
        <span className="rs-sec-end">
          {meta && <span className="rs-sec-meta">{meta}</span>}
          <ChevronRight className="rs-sec-chevron lucide" aria-hidden="true" />
        </span>
      </button>
      <div id={bodyId} className="rs-split-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}

/**
 * @typedef {Object} SplitRailProps
 * @property {React.ReactNode} left            content of the left column (e.g. an outline tree).
 * @property {React.ReactNode} right           content of the right column (e.g. filters).
 * @property {string} [leftTitle='outline']    left column header (mono, lowercased).
 * @property {string} [rightTitle='filters']   right column header (mono, lowercased).
 * @property {React.ComponentType} [leftIcon]  optional lucide icon for the left header.
 * @property {React.ComponentType} [rightIcon] optional lucide icon for the right header.
 * @property {React.ReactNode} [leftMeta]      quiet right-aligned content in the left header.
 * @property {React.ReactNode} [rightMeta]     quiet right-aligned content in the right header.
 * @property {string} [className]              extra class on the root.
 */

/**
 * The dual-rail variant: two independently-collapsible columns (outline-left / filters-right), each
 * a hairline panel that collapses on its own. Side by side on desktop; stacks to a single column on
 * mobile. Use as the `rail` of a RailShell, or standalone as a two-pane control surface.
 */
export function SplitRail({
  left,
  right,
  leftTitle = 'outline',
  rightTitle = 'filters',
  leftIcon,
  rightIcon,
  leftMeta,
  rightMeta,
  className = '',
}) {
  return (
    <div className={`rs-split${className ? ` ${className}` : ''}`}>
      <SplitRailPanel title={leftTitle} icon={leftIcon} meta={leftMeta}>
        {left}
      </SplitRailPanel>
      <SplitRailPanel title={rightTitle} icon={rightIcon} meta={rightMeta}>
        {right}
      </SplitRailPanel>
    </div>
  )
}
