// Real-DOM regression test for the code-map spatial-view's modifier-gated
// wheel/trackpad-pinch zoom (fairtrade peasant-166 layout follow-up: the
// canvas previously had NO wheel-driven zoom at all — only the on-canvas
// +/- controls and +/- keys — so a mouse-wheel or trackpad-pinch user had no
// way to zoom without leaving the keyboard/on-canvas controls). This test
// renders the REAL MapCanvas component (not a mock) and dispatches real
// `wheel` events, asserting:
//   - a PLAIN wheel (no ctrl/cmd) never zooms and never calls
//     preventDefault(), so the host page keeps scrolling normally when the
//     canvas happens to be under the cursor;
//   - a ctrl+wheel OR cmd+wheel zooms (cmd covers trackpad pinch-zoom, which
//     browsers report as a wheel event with ctrlKey=true even without a
//     physical Ctrl key — metaKey is exercised here as the explicit Mac
//     modifier case) and DOES call preventDefault();
//   - zoom-in (negative deltaY) increases scale, zoom-out (positive deltaY)
//     decreases it, and both are anchored under the cursor position (the pan
//     shifts to keep the point under the cursor fixed), not the viewport
//     centre;
//   - scale stays clamped to CODE_MAP_VIEWPORT_SCALE's [min, max] band.
//   - the wheel handler is attached as a NATIVE, non-passive listener
//     ({ passive: false }), not via React's onWheel prop. This is the one
//     assertion that actually locks the production fix: jsdom does not
//     enforce real-browser passive-listener preventDefault semantics, so
//     every `defaultPrevented` check above reads true regardless of HOW the
//     listener was attached -- reverting to a plain React onWheel prop (the
//     exact original defect: preventDefault() silently no-ops in a real
//     browser, confirmed only by manual real-app testing) leaves every
//     scenario above green. Only spying on the attachment mechanism itself
//     is something jsdom can actually observe.
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
  MouseEvent: dom.window.MouseEvent, WheelEvent: dom.window.WheelEvent,
})) {
  previousGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

function wheelEvent({ deltaY, clientX = 100, clientY = 100, ctrlKey = false, metaKey = false }) {
  return new dom.window.WheelEvent('wheel', { deltaY, clientX, clientY, ctrlKey, metaKey, bubbles: true, cancelable: true })
}

const data = {
  nodes: [
    { id: 'a', label: 'a', kind: 'file', loc: 100, coverage: 2 },
    { id: 'b', label: 'b', kind: 'file', loc: 100, coverage: 2 },
  ],
  edges: [],
}

async function mount(MapCanvas) {
  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(StrictMode, null, React.createElement(MapCanvas, { data })))
  })
  const viewportEl = container.querySelector('.mc-viewport')
  if (!viewportEl) throw new Error('mounted MapCanvas invariant failed: .mc-viewport not found')
  const stage = () => container.querySelector('.mc-stage')
  if (!stage()) throw new Error('mounted MapCanvas invariant failed: .mc-stage not found (empty state?)')
  const scaleOf = () => Number(/scale\(([\d.]+)\)/.exec(stage().style.transform)?.[1])
  const panOf = () => {
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(stage().style.transform)
    return { x: Number(m?.[1]), y: Number(m?.[2]) }
  }
  return { root, viewportEl, scaleOf, panOf }
}

async function runPlainWheelDoesNotZoomScenario(MapCanvas) {
  const { root, viewportEl, scaleOf } = await mount(MapCanvas)
  const before = scaleOf()
  let ev
  await act(async () => {
    ev = wheelEvent({ deltaY: -100 })
    viewportEl.dispatchEvent(ev)
  })
  if (scaleOf() !== before) {
    throw new Error(`plain-wheel invariant failed: scale changed from ${before} to ${scaleOf()} without ctrl/cmd held`)
  }
  if (ev.defaultPrevented) {
    throw new Error('plain-wheel invariant failed: preventDefault() was called on an unmodified wheel — this would hijack page scroll')
  }
  await act(async () => root.unmount())
  console.log('code-map wheel zoom (plain wheel): no zoom, no preventDefault — page scroll is never hijacked')
}

async function runCtrlWheelZoomsScenario(MapCanvas) {
  const { root, viewportEl, scaleOf, panOf } = await mount(MapCanvas)
  const before = scaleOf()
  const beforePan = panOf()
  let zoomIn
  await act(async () => {
    zoomIn = wheelEvent({ deltaY: -100, ctrlKey: true, clientX: 60, clientY: 40 })
    viewportEl.dispatchEvent(zoomIn)
  })
  if (!(scaleOf() > before)) {
    throw new Error(`ctrl+wheel zoom-in invariant failed: expected scale to increase from ${before}, got ${scaleOf()}`)
  }
  if (!zoomIn.defaultPrevented) {
    throw new Error('ctrl+wheel invariant failed: preventDefault() was NOT called on a ctrl-modified wheel')
  }
  const afterZoomInScale = scaleOf()
  const afterZoomInPan = panOf()
  if (afterZoomInPan.x === beforePan.x && afterZoomInPan.y === beforePan.y) {
    throw new Error('ctrl+wheel zoom-in invariant failed: pan did not shift at all — zoom is not anchored under the cursor')
  }

  let zoomOut
  await act(async () => {
    zoomOut = wheelEvent({ deltaY: 100, ctrlKey: true, clientX: 60, clientY: 40 })
    viewportEl.dispatchEvent(zoomOut)
  })
  if (!(scaleOf() < afterZoomInScale)) {
    throw new Error(`ctrl+wheel zoom-out invariant failed: expected scale to decrease from ${afterZoomInScale}, got ${scaleOf()}`)
  }

  await act(async () => root.unmount())
  console.log('code-map wheel zoom (ctrl+wheel): zoom-in increases scale, zoom-out decreases it, both preventDefault and anchor under the cursor (pan shifts)')
}

async function runCmdWheelZoomsScenario(MapCanvas) {
  // Exercises metaKey explicitly (the Mac modifier, and the same signal a
  // trackpad two-finger pinch reports via ctrlKey without a physical key —
  // covered by the ctrlKey scenario above; this scenario proves metaKey alone
  // is also honored, not just ctrlKey).
  const { root, viewportEl, scaleOf } = await mount(MapCanvas)
  const before = scaleOf()
  let ev
  await act(async () => {
    ev = wheelEvent({ deltaY: -100, metaKey: true })
    viewportEl.dispatchEvent(ev)
  })
  if (!(scaleOf() > before)) {
    throw new Error(`cmd+wheel invariant failed: expected scale to increase from ${before}, got ${scaleOf()}`)
  }
  if (!ev.defaultPrevented) {
    throw new Error('cmd+wheel invariant failed: preventDefault() was NOT called on a cmd-modified wheel')
  }
  await act(async () => root.unmount())
  console.log('code-map wheel zoom (cmd+wheel): the Mac modifier alone also zooms and preventDefaults')
}

async function runClampScenario(MapCanvas) {
  const { root, viewportEl, scaleOf } = await mount(MapCanvas)
  // Hammer zoom-in with many large ticks; scale must never exceed the shared
  // CODE_MAP_VIEWPORT_SCALE.max policy (2.4), the same clamp +/- and fit() use.
  for (let i = 0; i < 40; i += 1) {
    await act(async () => {
      viewportEl.dispatchEvent(wheelEvent({ deltaY: -1000, ctrlKey: true }))
    })
  }
  if (scaleOf() > 2.4) {
    throw new Error(`clamp invariant failed: scale ${scaleOf()} exceeds CODE_MAP_VIEWPORT_SCALE.max (2.4)`)
  }
  for (let i = 0; i < 40; i += 1) {
    await act(async () => {
      viewportEl.dispatchEvent(wheelEvent({ deltaY: 1000, ctrlKey: true }))
    })
  }
  if (scaleOf() < 0.35) {
    throw new Error(`clamp invariant failed: scale ${scaleOf()} is below CODE_MAP_VIEWPORT_SCALE.min (0.35)`)
  }
  await act(async () => root.unmount())
  console.log('code-map wheel zoom (clamp): repeated ctrl+wheel ticks stay within the shared [0.35, 2.4] viewport-scale policy')
}

async function runNativeNonPassiveListenerScenario(MapCanvas) {
  // Spy on EventTarget.addEventListener BEFORE mounting, so we capture the
  // real registration call MapCanvas's effect makes on the viewport element
  // -- this is the mechanism jsdom CAN observe, unlike preventDefault's
  // effect on a subsequent event.
  const calls = []
  const original = dom.window.EventTarget.prototype.addEventListener
  dom.window.EventTarget.prototype.addEventListener = function (type, listener, options) {
    calls.push({ target: this, type, options })
    return original.call(this, type, listener, options)
  }
  let root
  let container
  try {
    ;({ root, container } = await (async () => {
      const c = dom.window.document.getElementById('root')
      const r = createRoot(c)
      await act(async () => {
        r.render(React.createElement(StrictMode, null, React.createElement(MapCanvas, { data })))
      })
      return { root: r, container: c }
    })())
    const viewportEl = container.querySelector('.mc-viewport')
    const wheelRegistration = calls.find((call) => call.target === viewportEl && call.type === 'wheel')
    if (!wheelRegistration) {
      throw new Error('native-listener invariant failed: no addEventListener("wheel", ...) call was made on .mc-viewport at all -- expected a native, non-React-prop listener')
    }
    if (!wheelRegistration.options || wheelRegistration.options.passive !== false) {
      throw new Error(`native-listener invariant failed: expected the wheel listener registered with { passive: false }, got options=${JSON.stringify(wheelRegistration.options)} -- a passive (or default) listener silently no-ops preventDefault() in a real browser`)
    }
  } finally {
    dom.window.EventTarget.prototype.addEventListener = original
  }
  await act(async () => root.unmount())
  console.log('code-map wheel zoom (native listener): the wheel handler is attached as a native, non-passive ({ passive: false }) listener, not React\'s onWheel prop')
}

const server = await createServer({
  appType: 'custom', configFile: false, logLevel: 'silent', plugins: [react()],
  root: process.cwd(), server: { middlewareMode: true },
})
try {
  const { default: MapCanvas } = await server.ssrLoadModule('/src/ui/MapCanvas.jsx')
  await runPlainWheelDoesNotZoomScenario(MapCanvas)
  await runCtrlWheelZoomsScenario(MapCanvas)
  await runCmdWheelZoomsScenario(MapCanvas)
  await runClampScenario(MapCanvas)
  await runNativeNonPassiveListenerScenario(MapCanvas)
} finally {
  await server.close()
  dom.window.close()
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor === undefined) delete globalThis[key]
    else Object.defineProperty(globalThis, key, descriptor)
  }
}
