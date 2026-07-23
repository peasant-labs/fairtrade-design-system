import { useMemo, useState } from 'react'
import RailShell from '../RailShell.jsx'
import CodeMap from './CodeMap.jsx'
import CodeMapNavigator from './CodeMapNavigator.jsx'
import { codeMapStatesEqual, createCodeMapState, reduceCodeMapState } from './codeMapState.js'

/**
 * CodeMapComposition — the FULL map surface (full-lift): the
 * RailShell frame (sticky toolbar + canvas + rail), the persistent visual-
 * channel legend, and the shared <CodeMap> canvas, composed once here so the
 * demo GraphMap mockup and every consuming app (peasant, village) render the
 * SAME toolbar/rail-shell/legend/interaction composition — not just the same
 * canvas wrapped in each host's own hand-rolled shell.
 *
 * Before this component, only the canvas itself (<CodeMap>) was shared; the
 * surrounding toolbar, rail shell, and legend were reimplemented per host
 * (review finding: "CodeMap boundary only lifts the canvas wrapper").
 * Composition-level pieces that are inherently
 * host-specific — the RAIL's content (real API data vs. demo mock data) and
 * the canvas region's loading/empty/error states (peasant's WS/REST fetch
 * lifecycle vs. the demo's static fixture) — stay host-owned via the `rail`
 * and `canvasSlot` slots below; everything else (frame, legend, interaction
 * wiring) is now ONE implementation.
 *
 * @param {object} props
 * @param {import('./types.js').CodeMapPayload} [props.payload]              forwarded to <CodeMap> when `canvasSlot` is omitted
 * @param {{level:'project'|'package'|'file', expanded?: Iterable<string>}} [props.zoom]
 * @param {(zoom:{level:'project'|'package'|'file', expanded:string[]})=>void} [props.onZoomChange]
 * @param {string|null} [props.selectedId]
 * @param {(id:string|null, node:import('./types.js').MapNodePayload|null)=>void} [props.onSelect]
 * @param {(id:string)=>void} [props.onExpand]
 * @param {Iterable<string>} [props.highlightedIds]
 * @param {Record<string,'new'|'removed'>} [props.nodeDeltas]
 * @param {Record<string,'new'|'removed'>} [props.structureEdgeDeltas]
 * @param {number|string} [props.height=480]                canvas height, forwarded to <CodeMap>
 * @param {string} [props.ariaLabel='code map']              forwarded to <CodeMap>
 * @param {React.ReactNode} [props.canvasSlot]                override the canvas region entirely
 *   (e.g. a host's loading/disconnected/error states); when omitted, renders
 *   <CodeMap> from the props above — the demo mockup and any host without
 *   custom fetch-lifecycle states can rely on the default.
 * @param {React.ReactNode} props.rail                        the rail's content (host-specific:
 *   real API data vs. demo mock data) — compose with the kit's <RailSection>.
 * @param {React.ReactNode} [props.toolbar]                   optional extra sticky toolbar content
 *   ABOVE the canvas (e.g. a connection indicator) — the canvas's OWN shared
 *   grain/search toolbar (owned by <CodeMap>/<MapCanvas>) is unaffected either way.
 * @param {string} [props.sheetTitle='code area']              RailShell's mobile bottom-sheet title
 * @param {React.ReactNode} [props.sheetMeta]
 * @param {'left'|'right'} [props.railSide='right']
 * @param {React.ReactNode|false} [props.legend]               override the default legend; `false` hides it
 * @param {string} [props.canvasWrapperClassName]              extra class on the canvas region wrapper
 * @param {React.CSSProperties} [props.canvasWrapperStyle]     inline style on the canvas region wrapper
 *   (e.g. a host's own responsive height clamp)
 * @param {string} [props.className]                           extra class on the root
 * @param {'canvas'|'navigator'} [props.presentation='canvas'] additive presentation switch; omitted preserves the historical canvas DOM
 * @param {React.ReactNode} [props.navigatorSlot]              host-controlled navigator content
 * @param {(presentation:'canvas'|'navigator')=>void} [props.onPresentationChange] when present, renders the canonical browse/map switch
 * @param {{scale:number, panX:number, panY:number}} [props.viewport]
 * @param {(viewport:{scale:number, panX:number, panY:number})=>void} [props.onViewportChange]
 * @param {import('./codeMapState.js').CodeMapState} [props.state] canonical controlled state
 * @param {Partial<import('./codeMapState.js').CodeMapState>} [props.defaultState] initial canonical uncontrolled state
 * @param {(state:import('./codeMapState.js').CodeMapState)=>void} [props.onStateChange]
 */
export default function CodeMapComposition({
  payload,
  zoom,
  onZoomChange,
  selectedId,
  onSelect,
  onExpand,
  highlightedIds,
  nodeDeltas,
  structureEdgeDeltas,
  height = 480,
  ariaLabel = 'code map',
  canvasSlot,
  rail,
  toolbar,
  sheetTitle = 'code area',
  sheetMeta,
  railSide = 'right',
  legend,
  canvasWrapperClassName = '',
  canvasWrapperStyle,
  className = '',
  presentation = 'canvas',
  navigatorSlot,
  onPresentationChange,
  viewport,
  onViewportChange,
  state,
  defaultState,
  onStateChange,
}) {
  const canonicalMode = state !== undefined || defaultState !== undefined
  const [internalState, setInternalState] = useState(() => createCodeMapState(defaultState))
  const canonicalState = useMemo(
    () => canonicalMode ? createCodeMapState(state ?? internalState) : null,
    [canonicalMode, state, internalState],
  )
  const activePresentation = canonicalState?.presentation ?? presentation

  function publish(next, notify) {
    if (state === undefined) setInternalState(next)
    onStateChange?.(next)
    notify?.(next)
  }

  function apply(action, notify) {
    if (!canonicalState) return
    const next = reduceCodeMapState(canonicalState, action)
    if (!codeMapStatesEqual(canonicalState, next)) publish(next, notify)
  }

  const showPresentationSwitch = canonicalMode || onPresentationChange
  const composedToolbar = showPresentationSwitch ? (
    <>
      <div className="gmp-presentation-switch" role="group" aria-label="code map view">
        <button
          type="button"
          aria-pressed={activePresentation === 'navigator'}
          onClick={() => canonicalMode
            ? apply({ type: 'set-presentation', presentation: 'navigator' }, () => onPresentationChange?.('navigator'))
            : onPresentationChange?.('navigator')}
        >
          {activePresentation === 'canvas' ? 'back to browse' : 'browse'}
        </button>
        <button
          type="button"
          aria-pressed={activePresentation === 'canvas'}
          onClick={() => canonicalMode
            ? apply({ type: 'set-presentation', presentation: 'canvas' }, () => onPresentationChange?.('canvas'))
            : onPresentationChange?.('canvas')}
        >
          spatial map
        </button>
      </div>
      {toolbar}
    </>
  ) : toolbar
  const canvasContent = canvasSlot ?? (
    <CodeMap
      payload={payload}
      zoom={canonicalState ? { level: canonicalState.grain, expanded: canonicalState.expandedIds } : zoom}
      onZoomChange={onZoomChange}
      selectedId={canonicalState ? canonicalState.selectedId : selectedId}
      onSelect={onSelect}
      onExpand={onExpand}
      highlightedIds={highlightedIds}
      nodeDeltas={nodeDeltas}
      structureEdgeDeltas={structureEdgeDeltas}
      height={height}
      ariaLabel={ariaLabel}
      viewport={canonicalState ? canonicalState.viewport ?? undefined : viewport}
      onViewportChange={onViewportChange}
      state={canonicalState ?? undefined}
      onStateChange={canonicalState ? (next) => publish(next) : undefined}
    />
  )
  const navigatorContent = navigatorSlot ?? (canonicalState && payload ? (
    <CodeMapNavigator
      payload={payload}
      grain={canonicalState.grain}
      expandedIds={canonicalState.expandedIds}
      selectedId={canonicalState.selectedId}
      focusedId={canonicalState.navigatorFocusedId}
      filter={canonicalState.navigatorFilter}
      onStateAction={(action) => apply(action, () => {
        if (action.type === 'select') {
          onSelect?.(action.id, payload.nodes.find((node) => node.id === action.id) ?? null)
        } else if (action.type === 'clear-selection') {
          onSelect?.(null, null)
        } else if (action.type === 'set-expanded') {
          onZoomChange?.({ level: canonicalState.grain, expanded: Array.from(action.ids) })
        } else if (action.type === 'open-in-map') {
          onSelect?.(action.id, payload.nodes.find((node) => node.id === action.id) ?? null)
          onPresentationChange?.('canvas')
        }
      })}
      ariaLabel={`browse ${ariaLabel}`}
    />
  ) : null)
  const showingNavigator = activePresentation === 'navigator' && navigatorContent !== null

  return (
    <div className={['gmp-root', className].filter(Boolean).join(' ')}>
      <RailShell
        toolbar={composedToolbar}
        rail={rail}
        sheetTitle={sheetTitle}
        sheetMeta={sheetMeta}
        railSide={railSide}
      >
        {/* The legend lives HERE — inside RailShell's canvas column (a sibling of
            the canvas region, not a sibling of <RailShell> itself) — on purpose.
            RailShell's rail column is `align-self: stretch` against the FRAME's
            flex-row cross-size, and the rail card caps itself to the viewport
            height (RailShell.css .rs-rail-card `max-height: 100vh`) rather than
            to the canvas's height. A real, content-heavy rail (many recorded
            conversations) is routinely taller than a compact canvas, so the
            frame's row height — and with it anything positioned AFTER
            </RailShell> — follows the RAIL's height, not the canvas's. Placing
            the legend inside the canvas column instead means its position is
            governed only by the canvas column's OWN natural content height
            (canvas region + legend), so it sits directly beneath the canvas
            regardless of how tall the rail's real content gets — matching the
            demo, whose short mock rail happened to never expose this. */}
        <div
          className={['gmp-map-canvas-region', canvasWrapperClassName].filter(Boolean).join(' ')}
          style={canvasWrapperStyle}
          data-testid="gmp-map-canvas-region"
        >
          {showingNavigator ? navigatorContent : canvasContent}
        </div>
        {!showingNavigator && legend !== false && (legend ?? <DefaultMapLegend />)}
      </RailShell>
    </div>
  )
}

/**
 * The persistent legend explaining the canvas's four orthogonal visual channels
 * (peasant spec §4/§5: WIDTH ∝ loc, monochrome FILL ∝ coverage, folder/file ICON,
 * amber SELECTION, clay VIOLATION badge) — so the picture never needs decoding.
 * Lifted here from the peasant app (was app-only chrome, spec-legend drift risk)
 * so demo and every consuming app show the SAME legend for the SAME canvas.
 */
export function DefaultMapLegend() {
  return (
    <p className="gmp-map-legend">
      <span className="gmp-legend-item">
        <span className="gmp-map-swatch" aria-hidden="true" /> code area (folder or file)
      </span>
      <span className="gmp-legend-item gmp-legend-dim">
        <span className="gmp-map-swatch gmp-map-swatch--empty" aria-hidden="true" /> no saved
        conversation behind it
      </span>
      <span className="gmp-legend-item gmp-legend-dim">brighter = more of it built with AI on record</span>
      <span className="gmp-legend-item gmp-legend-dim">
        <span className="gmp-map-swatch gmp-map-swatch--edge" aria-hidden="true" /> one area uses another
      </span>
      <span className="gmp-legend-item gmp-map-legend-danger">
        ⚠ tangle — two areas that depend on each other
      </span>
      <span className="gmp-legend-item gmp-legend-dim">double-click a folder to open its files</span>
    </p>
  )
}
