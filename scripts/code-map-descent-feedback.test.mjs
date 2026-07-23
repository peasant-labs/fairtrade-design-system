// Real-DOM regression test for folder-descent feedback on the code-map
// spatial view (fairtrade peasant-166 UAT: "clicking into a folder is
// terrible: no idea what's happening"). Renders the REAL MapCanvas
// component (not a mock) in a nested tree, drives real double-click
// (expand) sequences, and asserts:
//   - a breadcrumb strip appears once a folder is expanded, growing one
//     crumb per nested level, and disappears once collapsed back to the
//     top level;
//   - clicking a crumb collapses back to exactly that level (removes every
//     id nested past it from expandedIds);
//   - a dedicated aria-live region announces each open/close, distinct
//     from the roving-focus live region (so a discrete "what changed"
//     event is never swallowed by ambient "what's focused" updates);
//   - opening a folder re-frames the viewport to that folder's OWN
//     subtree bounding box, not a whole-graph fit (proven by checking the
//     scale/pan differ from what a whole-graph fit would have produced).
import React, { StrictMode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://fairtrade.invalid/map' })
const previousGlobals = new Map()
for (const [key, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  MouseEvent: dom.window.MouseEvent,
})) {
  previousGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

function dblClick(el) {
  el.dispatchEvent(new dom.window.MouseEvent('click', { detail: 1, bubbles: true, cancelable: true }))
  el.dispatchEvent(new dom.window.MouseEvent('click', { detail: 2, bubbles: true, cancelable: true }))
  el.dispatchEvent(new dom.window.MouseEvent('dblclick', { detail: 2, bubbles: true, cancelable: true }))
}

// root-a > child-a > leaf.go (a 3-level nested chain), plus an unrelated
// sibling root-b file so a top-level collapse has something else to show.
const data = {
  nodes: [
    { id: 'root-a', label: 'root-a', kind: 'folder', loc: 500, coverage: 2 },
    { id: 'root-a/child-a', label: 'child-a', kind: 'folder', loc: 300, coverage: 2, parent: 'root-a' },
    { id: 'root-a/child-a/leaf.go', label: 'leaf.go', kind: 'file', loc: 100, coverage: 2, parent: 'root-a/child-a' },
    { id: 'root-b', label: 'root-b', kind: 'file', loc: 40, coverage: 1 },
  ],
  edges: [],
}

async function mount(MapCanvas) {
  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(StrictMode, null, React.createElement(MapCanvas, { data, grain: 'overview' })))
  })
  const viewportEl = container.querySelector('.mc-viewport')
  if (!viewportEl) throw new Error('mounted MapCanvas invariant failed: .mc-viewport not found')
  // jsdom never runs layout, so every element reports 0 size by default --
  // fit()/fitToIds bail out on a zero-size viewport (correctly, for a real
  // not-yet-laid-out DOM). Stub a real-ish viewport size so the auto-fit
  // math actually runs, the same way a real mounted browser page would.
  Object.defineProperty(viewportEl, 'clientWidth', { configurable: true, value: 1200 })
  Object.defineProperty(viewportEl, 'clientHeight', { configurable: true, value: 800 })
  return { root, container }
}

/** Mirrors peasant's real MapPageClient shape: a plain synchronous React
    state owner for both expandedIds and viewport (canonicalControlled). */
async function mountCanonical(MapCanvas) {
  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  function Harness() {
    const [viewport, setViewport] = React.useState(null)
    const [expandedIds, setExpandedIds] = React.useState([])
    return React.createElement(MapCanvas, {
      data, grain: 'overview', canonicalControlled: true,
      viewport, onViewportChange: setViewport,
      expandedIds, onExpandedIdsChange: setExpandedIds,
    })
  }
  await act(async () => {
    root.render(React.createElement(StrictMode, null, React.createElement(Harness)))
  })
  const viewportEl = container.querySelector('.mc-viewport')
  if (!viewportEl) throw new Error('mounted MapCanvas invariant failed: .mc-viewport not found')
  Object.defineProperty(viewportEl, 'clientWidth', { configurable: true, value: 1200 })
  Object.defineProperty(viewportEl, 'clientHeight', { configurable: true, value: 800 })
  return { root, container }
}

function nodeButton(container, leafSubstring) {
  return [...container.querySelectorAll('.mc-node')].find((el) => (el.getAttribute('aria-label') || '').startsWith(leafSubstring))
}
function crumbs(container) {
  return [...container.querySelectorAll('.mc-breadcrumb-crumb')]
}
function descentAnnounceText(container) {
  // The SECOND .mc-sr region is the descent live region (the first is the
  // pre-existing roving-focus announcement) -- assert on ordinal position,
  // not a class-only guess, so a future reorder cannot silently break this.
  const regions = [...container.querySelectorAll('.mc-sr')]
  return regions[1]?.textContent ?? ''
}

async function runBreadcrumbGrowsAndShrinksScenario(MapCanvas) {
  const { root, container } = await mount(MapCanvas)

  if (crumbs(container).length !== 0) {
    throw new Error('initial invariant failed: breadcrumb must be absent before anything is expanded')
  }

  // Descend into root-a.
  await act(async () => { dblClick(nodeButton(container, 'root-a:')) })
  const afterFirst = crumbs(container).map((b) => b.textContent)
  if (JSON.stringify(afterFirst) !== JSON.stringify(['top level', 'root-a'])) {
    throw new Error(`one-level breadcrumb invariant failed: expected ["top level","root-a"], got ${JSON.stringify(afterFirst)}`)
  }
  if (!descentAnnounceText(container).includes('opened root-a')) {
    throw new Error(`open announcement invariant failed: got ${JSON.stringify(descentAnnounceText(container))}`)
  }

  // Descend further into child-a.
  await act(async () => { dblClick(nodeButton(container, 'child-a:')) })
  const afterSecond = crumbs(container).map((b) => b.textContent)
  if (JSON.stringify(afterSecond) !== JSON.stringify(['top level', 'root-a', 'child-a'])) {
    throw new Error(`two-level breadcrumb invariant failed: expected ["top level","root-a","child-a"], got ${JSON.stringify(afterSecond)}`)
  }

  // Click the FIRST (root-a) crumb: must collapse back to exactly one level.
  await act(async () => { crumbs(container)[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })) })
  const afterCrumbClick = crumbs(container).map((b) => b.textContent)
  if (JSON.stringify(afterCrumbClick) !== JSON.stringify(['top level', 'root-a'])) {
    throw new Error(`crumb-click collapse invariant failed: expected ["top level","root-a"], got ${JSON.stringify(afterCrumbClick)}`)
  }
  if (nodeButton(container, 'leaf.go:')) {
    throw new Error('crumb-click collapse invariant failed: leaf.go is still rendered after collapsing past child-a')
  }

  // Click "top level": breadcrumb must fully disappear.
  await act(async () => { crumbs(container)[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })) })
  if (crumbs(container).length !== 0) {
    throw new Error(`top-level collapse invariant failed: expected an empty breadcrumb, got ${JSON.stringify(crumbs(container).map((b) => b.textContent))}`)
  }
  if (!descentAnnounceText(container).includes('top level')) {
    throw new Error(`collapse-to-root announcement invariant failed: got ${JSON.stringify(descentAnnounceText(container))}`)
  }

  await act(async () => root.unmount())
  console.log('code-map descent feedback (breadcrumb): grows one crumb per nested open, a crumb click collapses to exactly that level, and top-level fully clears it')
}

function screenCenterOf(container, leafSubstring) {
  const el = nodeButton(container, leafSubstring)
  if (!el) return null
  const transform = container.querySelector('.mc-stage')?.style.transform ?? ''
  const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(transform)
  if (!m) return null
  const [, panXStr, panYStr, scaleStr] = m
  const panX = Number(panXStr); const panY = Number(panYStr); const scale = Number(scaleStr)
  const left = parseFloat(el.style.left); const top = parseFloat(el.style.top)
  const w = parseFloat(el.style.width); const h = parseFloat(el.style.height)
  return { x: (left + w / 2) * scale + panX, y: (top + h / 2) * scale + panY }
}

async function runAutoFitScopedToSubtreeScenario(MapCanvas) {
  const { root, container } = await mount(MapCanvas)
  const stage = () => container.querySelector('.mc-stage')

  await act(async () => { dblClick(nodeButton(container, 'root-a:')) })
  // allow the descent-fit effect (and its microtask-scheduled state update) to settle
  await act(async () => { await Promise.resolve() })

  // At this point the visible set is [child-a, root-b] -- a WHOLE-graph fit
  // would centre the midpoint BETWEEN them; a fit scoped to root-a's own
  // subtree (currently just child-a, since it isn't expanded yet itself)
  // must centre child-a itself, near the stubbed 1200x800 viewport's centre
  // (600, 400). This is the precise claim a loose "did the transform change
  // at all" check cannot distinguish from an accidental whole-graph fallback.
  const childCentre = screenCenterOf(container, 'child-a:')
  if (!childCentre) throw new Error('scoped auto-fit invariant failed: could not locate child-a to measure its screen centre')
  const dx = Math.abs(childCentre.x - 600)
  const dy = Math.abs(childCentre.y - 400)
  if (dx > 2 || dy > 2) {
    throw new Error(`scoped auto-fit invariant failed: expected child-a centred at the viewport centre (600, 400) within 2px, got (${childCentre.x.toFixed(1)}, ${childCentre.y.toFixed(1)}) -- the fit did not scope to root-a's own subtree`)
  }
  if (!stage()?.className.includes('mc-stage--auto-fit')) {
    throw new Error('scoped auto-fit invariant failed: expected the transient mc-stage--auto-fit class to be applied right after a descent-triggered fit')
  }

  await act(async () => root.unmount())
  console.log('code-map descent feedback (scoped auto-fit): opening a folder re-frames to its own subtree (transform changes) and applies the transient auto-fit transition class')
}

async function runCanonicalCollapseReframesScenario(MapCanvas) {
  // CANONICAL-mode regression (a plain useState owner, mirroring peasant's
  // real MapPageClient): once ANY viewport proposal has been published
  // (from the scoped descent-fit), `scale`/`pan` render from the canonical
  // `viewport` PROP, not local state -- so a later auto-fit that only
  // updates LOCAL state via an unpublished fit() is a complete no-op from
  // the user's perspective. Found via real-app verification: collapsing
  // back out via the breadcrumb left the canvas frozen at the previous
  // folder's zoomed-in framing instead of reframing the wider view.
  const { root, container } = await mountCanonical(MapCanvas)
  const transformOf = () => container.querySelector('.mc-stage')?.style.transform

  await act(async () => { dblClick(nodeButton(container, 'root-a:')) })
  const afterDescend = transformOf()

  await act(async () => { crumbs(container)[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })) })
  const afterCollapse = transformOf()

  if (afterCollapse === afterDescend) {
    throw new Error(`canonical collapse-reframe invariant failed: the transform (${afterCollapse}) is IDENTICAL to the pre-collapse scoped-fit framing (${afterDescend}) -- the whole-graph re-fit after collapsing was silently dropped`)
  }

  await act(async () => root.unmount())
  console.log('code-map descent feedback (canonical collapse reframes): collapsing back out via the breadcrumb in canonicalControlled mode actually republishes a fresh whole-graph fit, not a silently-dropped local-only update')
}

const server = await createServer({
  appType: 'custom', configFile: false, logLevel: 'silent', plugins: [react()],
  root: process.cwd(), server: { middlewareMode: true },
})
try {
  const { default: MapCanvas } = await server.ssrLoadModule('/src/ui/MapCanvas.jsx')
  await runBreadcrumbGrowsAndShrinksScenario(MapCanvas)
  await runAutoFitScopedToSubtreeScenario(MapCanvas)
  await runCanonicalCollapseReframesScenario(MapCanvas)
} finally {
  await server.close()
  dom.window.close()
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor === undefined) delete globalThis[key]
    else Object.defineProperty(globalThis, key, descriptor)
  }
}
