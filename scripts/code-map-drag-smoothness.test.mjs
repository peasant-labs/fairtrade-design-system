// Real-DOM regression test for the code-map spatial-view drag gesture
// (fairtrade peasant-166 UAT: "The code map no longer has smooth
// click-and-drag on the spatial map."). Root cause: in canonicalControlled
// mode, MapCanvas's onPointerMove did nothing at all — the pan only updated
// once, on pointerup, via a single proposal round-trip. This test renders the
// REAL MapCanvas component (not a mock) in canonicalControlled mode and
// dispatches a real pointerdown/pointermove/pointerup sequence, asserting the
// rendered transform tracks the pointer BEFORE pointerup — not only after.
//
// A second scenario locks the fix for a follow-on finding: a
// canonicalControlled owner that never reconciles the released proposal
// must NOT snap the gesture back immediately — MapCanvas holds the local
// preview for a bounded window (DRAG_RECONCILE_TIMEOUT_MS) so a
// synchronous-but-not-instant owner still gets a fair chance, and only
// falls back to the canonical prop once that window elapses.
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

function pointerEvent(type, { clientX, clientY, pointerId = 1, button = 0 }) {
  const ev = new dom.window.MouseEvent(type, { clientX, clientY, button, bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'pointerId', { value: pointerId })
  return ev
}

const data = {
  nodes: [
    { id: 'a', label: 'a', kind: 'file', loc: 100, coverage: 2 },
    { id: 'b', label: 'b', kind: 'file', loc: 100, coverage: 2 },
  ],
  edges: [],
}

/** Drives the shared pointerdown → 2 pointermoves → returns { root, container, transformOf, proposals }. */
async function mountAndDrag(MapCanvas, Harness) {
  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(StrictMode, null, React.createElement(Harness)))
  })

  const viewportEl = container.querySelector('.mc-viewport')
  if (!viewportEl) throw new Error('mounted MapCanvas invariant failed: .mc-viewport not found')
  const stage = () => container.querySelector('.mc-stage')
  if (!stage()) throw new Error('mounted MapCanvas invariant failed: .mc-stage not found (empty state?)')
  const transformOf = () => stage().style.transform

  const initialTransform = transformOf()
  if (initialTransform !== 'translate(0px, 0px) scale(1)') {
    throw new Error(`initial transform invariant failed: got ${initialTransform}`)
  }

  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }))
  })
  // Below the 3px move threshold: must NOT count as a drag yet.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 101, clientY: 100 }))
  })
  if (transformOf() !== initialTransform) {
    throw new Error(`sub-threshold move invariant failed: transform changed to ${transformOf()} before crossing the drag threshold`)
  }

  // Past the threshold: THIS is the original regression. The transform must
  // move immediately, mid-gesture — no pointerup yet, no proposal emitted yet.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 140, clientY: 100 }))
  })
  const midDragTransform = transformOf()
  if (midDragTransform !== 'translate(40px, 0px) scale(1)') {
    throw new Error(`mid-drag smoothness invariant failed: expected the stage to track the pointer DURING the drag (translate(40px, 0px)), got ${midDragTransform} — the canvas is not moving until release`)
  }

  // Continue the drag further — the preview must keep tracking, not freeze
  // after the first move.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 175, clientY: 130 }))
  })
  const midDragTransform2 = transformOf()
  if (midDragTransform2 !== 'translate(75px, 30px) scale(1)') {
    throw new Error(`continued mid-drag invariant failed: expected translate(75px, 30px), got ${midDragTransform2}`)
  }

  return { root, transformOf }
}

async function runSynchronousOwnerScenario(MapCanvas) {
  // Mirrors peasant's real MapPageClient shape: the "owner" is a plain
  // synchronous React state holder, not a mock of MapCanvas itself.
  const proposals = []
  function Harness() {
    const [viewport, setViewport] = React.useState({ scale: 1, panX: 0, panY: 0 })
    return React.createElement(MapCanvas, {
      data,
      canonicalControlled: true,
      viewport,
      onViewportChange: (next) => {
        proposals.push(next)
        setViewport(next)
      },
    })
  }

  const { root, transformOf } = await mountAndDrag(MapCanvas, Harness)
  if (proposals.length !== 0) {
    throw new Error(`mid-drag proposal invariant failed: expected zero proposals mid-gesture (only one on release), got ${proposals.length}`)
  }

  // Release: exactly one proposal goes to the owner, and the final transform
  // matches (no snap-back, since the synchronous owner reconciles immediately).
  const viewportEl = dom.window.document.querySelector('.mc-viewport')
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerup', { clientX: 175, clientY: 130 }))
  })
  if (proposals.length !== 1) {
    throw new Error(`release proposal invariant failed: expected exactly 1 proposal on release, got ${proposals.length}`)
  }
  if (proposals[0].panX !== 75 || proposals[0].panY !== 30 || proposals[0].scale !== 1) {
    throw new Error(`release proposal shape invariant failed: got ${JSON.stringify(proposals[0])}`)
  }
  const finalTransform = transformOf()
  if (finalTransform !== 'translate(75px, 30px) scale(1)') {
    throw new Error(`post-release transform invariant failed: expected translate(75px, 30px) with no snap-back, got ${finalTransform}`)
  }

  await act(async () => root.unmount())
  console.log('code-map drag smoothness (synchronous owner): mid-gesture tracking (2 checkpoints), sub-threshold no-op, single release proposal, and no post-release snap-back all passed')
}

async function runNonReconcilingOwnerScenario(MapCanvas) {
  // An owner that NEVER updates `viewport` in response to the release
  // proposal — it rejects the change, or simply never round-trips the way a
  // debounced or network-backed owner might not within a single render.
  // `viewport` here is a FIXED, never-changing prop, deliberately never
  // re-supplied by a `setState` call.
  const proposals = []
  function Harness() {
    return React.createElement(MapCanvas, {
      data,
      canonicalControlled: true,
      viewport: { scale: 1, panX: 0, panY: 0 },
      onViewportChange: (next) => { proposals.push(next) }, // never reconciles
    })
  }

  const { root, transformOf } = await mountAndDrag(MapCanvas, Harness)

  const viewportEl = dom.window.document.querySelector('.mc-viewport')
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerup', { clientX: 175, clientY: 130 }))
  })
  if (proposals.length !== 1) {
    throw new Error(`non-reconciling owner: expected exactly 1 proposal on release, got ${proposals.length}`)
  }

  // Immediately after release the gesture must still be visible — NOT an
  // instant snap-back — giving a same-tick-but-not-instant owner room to
  // reconcile before the fallback gives up.
  const immediatelyAfterRelease = transformOf()
  if (immediatelyAfterRelease !== 'translate(75px, 30px) scale(1)') {
    throw new Error(`non-reconciling owner: expected the gesture to still be held immediately after release (translate(75px, 30px)), got ${immediatelyAfterRelease} — the fix must not snap back before the reconcile window elapses`)
  }

  // After the bounded reconcile window elapses with no reconciliation, the
  // preview must give up and fall back to the (unchanged) canonical prop —
  // the documented, deliberate snap-back for a genuinely non-reconciling
  // owner, NOT an indefinite pin.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650))
  })
  const afterTimeout = transformOf()
  if (afterTimeout !== 'translate(0px, 0px) scale(1)') {
    throw new Error(`non-reconciling owner: expected the preview to fall back to the canonical (pre-drag) transform after the reconcile window, got ${afterTimeout}`)
  }

  await act(async () => root.unmount())
  console.log('code-map drag smoothness (non-reconciling owner): gesture held through the reconcile window, then bounded fallback to canonical — no indefinite pin, no instant snap-back')
}

async function runAsyncDelayedOwnerScenario(MapCanvas) {
  // Reviewer-B finding: an owner whose onViewportChange round-trips through a
  // real (but bounded) delay — a websocket ack, a debounce, anything short of
  // instant — must NOT see a visible snap-back-to-stale-then-jump-forward
  // flicker on release. 50ms mirrors the probe that demonstrated the defect;
  // well inside DRAG_RECONCILE_TIMEOUT_MS (500ms).
  const proposals = []
  function Harness() {
    const [viewport, setViewport] = React.useState({ scale: 1, panX: 0, panY: 0 })
    return React.createElement(MapCanvas, {
      data,
      canonicalControlled: true,
      viewport,
      onViewportChange: (next) => {
        proposals.push(next)
        setTimeout(() => setViewport(next), 50)
      },
    })
  }

  const { root, transformOf } = await mountAndDrag(MapCanvas, Harness)

  const viewportEl = dom.window.document.querySelector('.mc-viewport')
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerup', { clientX: 175, clientY: 130 }))
  })
  if (proposals.length !== 1) {
    throw new Error(`async-delayed owner: expected exactly 1 proposal on release, got ${proposals.length}`)
  }

  // THE defect this locks: immediately post-release, before the 50ms delayed
  // owner update lands, the transform must still read the released position —
  // NOT snap back to the stale canonical translate(0px, 0px) and then jump
  // forward once the delayed update arrives.
  const immediatelyAfterRelease = transformOf()
  if (immediatelyAfterRelease !== 'translate(75px, 30px) scale(1)') {
    throw new Error(`async-delayed owner: expected NO snap-back immediately after release (translate(75px, 30px)), got ${immediatelyAfterRelease} — this is the exact flicker the reviewer demonstrated`)
  }

  // Once the delayed owner update lands, the transform is unchanged (the
  // reconciliation effect matches it and quietly hands control back).
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100))
  })
  const afterDelayedUpdate = transformOf()
  if (afterDelayedUpdate !== 'translate(75px, 30px) scale(1)') {
    throw new Error(`async-delayed owner: expected the transform to remain translate(75px, 30px) once the delayed update lands, got ${afterDelayedUpdate}`)
  }

  await act(async () => root.unmount())
  console.log('code-map drag smoothness (async-delayed owner): no snap-back-then-forward flicker across a 50ms reconciliation delay')
}

async function runMultiPointerGuardScenario(MapCanvas) {
  // Reviewer-B finding: a SECOND pointer going down mid-gesture (the first
  // never released) must not hijack/rebase the drag. Single-pointer only, by
  // design — the second pointer's events are ignored outright, not composed
  // into a second concurrent drag.
  const proposals = []
  function Harness() {
    const [viewport, setViewport] = React.useState({ scale: 1, panX: 0, panY: 0 })
    return React.createElement(MapCanvas, {
      data,
      canonicalControlled: true,
      viewport,
      onViewportChange: (next) => { proposals.push(next); setViewport(next) },
    })
  }

  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(StrictMode, null, React.createElement(Harness)))
  })
  const viewportEl = container.querySelector('.mc-viewport')
  const stage = () => container.querySelector('.mc-stage')
  const transformOf = () => stage().style.transform

  // Pointer 1 starts a drag and moves.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 }))
  })
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 140, clientY: 100, pointerId: 1 }))
  })
  if (transformOf() !== 'translate(40px, 0px) scale(1)') {
    throw new Error(`multi-pointer guard: expected pointer 1's drag to reach translate(40px, 0px) before pointer 2 arrives, got ${transformOf()}`)
  }

  // Pointer 2 goes down and moves WITHOUT pointer 1 releasing — must be
  // ignored entirely: no rebase, no jump, transform unchanged.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 500, clientY: 500, pointerId: 2 }))
  })
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 510, clientY: 505, pointerId: 2 }))
  })
  const afterSecondPointer = transformOf()
  if (afterSecondPointer !== 'translate(40px, 0px) scale(1)') {
    throw new Error(`multi-pointer guard: a second pointer's events must be ignored while pointer 1's drag is active; expected translate(40px, 0px) unchanged, got ${afterSecondPointer} — the drag was hijacked/rebased`)
  }

  // Pointer 1 continues moving — its OWN trajectory must still be honored
  // (the guard ignores pointer 2, it doesn't freeze pointer 1).
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 160, clientY: 110, pointerId: 1 }))
  })
  if (transformOf() !== 'translate(60px, 10px) scale(1)') {
    throw new Error(`multi-pointer guard: pointer 1 must keep tracking after pointer 2 was ignored, got ${transformOf()}`)
  }

  // Pointer 2's pointerup must also be ignored (it never owned the drag).
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerup', { clientX: 510, clientY: 505, pointerId: 2 }))
  })
  if (transformOf() !== 'translate(60px, 10px) scale(1)') {
    throw new Error(`multi-pointer guard: pointer 2's pointerup must not affect pointer 1's still-active drag, got ${transformOf()}`)
  }
  if (proposals.length !== 0) {
    throw new Error(`multi-pointer guard: pointer 2's pointerup must not emit a proposal, got ${proposals.length}`)
  }

  // Pointer 1 finally releases — its own drag commits normally.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerup', { clientX: 160, clientY: 110, pointerId: 1 }))
  })
  if (proposals.length !== 1 || proposals[0].panX !== 60 || proposals[0].panY !== 10) {
    throw new Error(`multi-pointer guard: expected pointer 1's own release to commit translate(60px, 10px), got ${JSON.stringify(proposals)}`)
  }

  await act(async () => root.unmount())
  console.log('code-map drag smoothness (multi-pointer guard): a second concurrent pointer is ignored outright — no hijack/rebase of the active drag')
}

async function runPointerCancelAbortsScenario(MapCanvas) {
  // MINOR finding: pointercancel must ABORT the gesture (no committed
  // proposal, no held preview), not commit it like a normal release —
  // pointercancel means the browser/OS invalidated this pointer's gesture
  // (e.g. a system gesture took over), which is semantically a discard.
  const proposals = []
  function Harness() {
    const [viewport, setViewport] = React.useState({ scale: 1, panX: 0, panY: 0 })
    return React.createElement(MapCanvas, {
      data,
      canonicalControlled: true,
      viewport,
      onViewportChange: (next) => { proposals.push(next); setViewport(next) },
    })
  }

  const { root, transformOf } = await mountAndDrag(MapCanvas, Harness)

  const viewportEl = dom.window.document.querySelector('.mc-viewport')
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointercancel', { clientX: 175, clientY: 130 }))
  })
  if (proposals.length !== 0) {
    throw new Error(`pointercancel abort: expected NO committed proposal on cancel, got ${proposals.length}`)
  }
  const afterCancel = transformOf()
  if (afterCancel !== 'translate(0px, 0px) scale(1)') {
    throw new Error(`pointercancel abort: expected the transform to revert to the canonical pre-drag value (translate(0px, 0px)) on cancel, got ${afterCancel}`)
  }

  // A fresh drag afterward must work normally — cancel must fully release
  // dragRef, not leave the canvas stuck thinking a drag is still active.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 50, clientY: 50, pointerId: 7 }))
  })
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 65, clientY: 50, pointerId: 7 }))
  })
  if (transformOf() !== 'translate(15px, 0px) scale(1)') {
    throw new Error(`pointercancel abort: expected a fresh drag after cancel to work normally, got ${transformOf()}`)
  }
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerup', { clientX: 65, clientY: 50, pointerId: 7 }))
  })

  await act(async () => root.unmount())
  console.log('code-map drag smoothness (pointercancel aborts): cancel discards the gesture (no proposal, reverts to canonical) rather than committing it; a later drag still works')
}

async function runLostPointerCaptureRecoversScenario(MapCanvas) {
  // BLOCKER finding (reviewer A on the multi-pointer guard): pointer1 starts
  // a drag and never delivers pointerup OR pointercancel at all — a real,
  // documented browser occurrence (focus loss during a native OS drag,
  // certain touch/pen driver quirks, a disconnected device). Without a
  // recovery path, onPointerDown's single-pointer guard would then silently
  // ignore every future pointerdown forever. `lostpointercapture` is the
  // browser's own spec-guaranteed safety net for exactly this — it fires
  // whenever a captured pointer's capture is released for ANY reason,
  // explicit or implicit — so wiring it to the same abort path as
  // pointercancel is what actually closes the guard's escape hatch.
  const proposals = []
  function Harness() {
    const [viewport, setViewport] = React.useState({ scale: 1, panX: 0, panY: 0 })
    return React.createElement(MapCanvas, {
      data,
      canonicalControlled: true,
      viewport,
      onViewportChange: (next) => { proposals.push(next); setViewport(next) },
    })
  }

  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(StrictMode, null, React.createElement(Harness)))
  })
  const viewportEl = container.querySelector('.mc-viewport')
  const transformOf = () => container.querySelector('.mc-stage').style.transform

  // Pointer 1 starts a drag and moves — no release, no cancel, ever.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 }))
  })
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 140, clientY: 100, pointerId: 1 }))
  })
  if (transformOf() !== 'translate(40px, 0px) scale(1)') {
    throw new Error(`lostpointercapture recovery: expected pointer 1's drag to reach translate(40px, 0px), got ${transformOf()}`)
  }

  // Without any recovery signal, a fresh pointerdown from a different
  // pointer must still be ignored (the guard itself is intact) — verifying
  // this BEFORE the capture-loss event distinguishes "the guard works" from
  // "the guard never engaged".
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 500, clientY: 500, pointerId: 2 }))
  })
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 510, clientY: 505, pointerId: 2 }))
  })
  if (transformOf() !== 'translate(40px, 0px) scale(1)') {
    throw new Error(`lostpointercapture recovery: expected pointer 2 to still be ignored before any capture-loss signal, got ${transformOf()}`)
  }

  // The browser reports pointer 1's capture was implicitly lost (its
  // pointerup/pointercancel never arrived) — this must abort pointer 1's
  // drag WITHOUT committing a proposal, exactly like pointercancel.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('lostpointercapture', { clientX: 140, clientY: 100, pointerId: 1 }))
  })
  if (proposals.length !== 0) {
    throw new Error(`lostpointercapture recovery: expected NO committed proposal from the lost pointer, got ${proposals.length}`)
  }
  if (transformOf() !== 'translate(0px, 0px) scale(1)') {
    throw new Error(`lostpointercapture recovery: expected the transform to revert to canonical after the capture-loss abort, got ${transformOf()}`)
  }

  // NOW a fresh pointerdown must work immediately — the guard has been
  // released, not just eventually timed out.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 200, clientY: 200, pointerId: 3 }))
  })
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 225, clientY: 210, pointerId: 3 }))
  })
  if (transformOf() !== 'translate(25px, 10px) scale(1)') {
    throw new Error(`lostpointercapture recovery: expected a fresh drag to work immediately after capture loss, got ${transformOf()}`)
  }
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerup', { clientX: 225, clientY: 210, pointerId: 3 }))
  })
  if (proposals.length !== 1 || proposals[0].panX !== 25 || proposals[0].panY !== 10) {
    throw new Error(`lostpointercapture recovery: expected the recovered drag to commit translate(25px, 10px), got ${JSON.stringify(proposals)}`)
  }

  await act(async () => root.unmount())
  console.log('code-map drag smoothness (lostpointercapture recovers): a lost release event does not wedge the canvas — capture loss aborts the stale drag and a fresh pointerdown works immediately')
}

async function runMidDragPauseScenario(MapCanvas) {
  // BLOCKER finding (reviewer B): the reconcile-or-timeout effect armed on
  // EVERY dragPreview update, including the ones onPointerMove fires
  // mid-gesture — not just the one at release. A fully synchronous,
  // well-behaved owner (no async, no rejection, nothing exotic) that simply
  // PAUSES for longer than DRAG_RECONCILE_TIMEOUT_MS mid-drag — pointer still
  // held down, just not moving for a beat — would have that timer fire and
  // snap the preview back to the stale canonical position WHILE THE GESTURE
  // IS STILL ACTIVE, then resume tracking on the next move. This is reachable
  // by any ordinary user who pauses a drag, unlike the exotic non-reconciling/
  // async-owner cases the timeout exists for. Fix: the effect is gated on
  // dragRef.current being null, so it only ever arms once the gesture is
  // actually over.
  const proposals = []
  function Harness() {
    const [viewport, setViewport] = React.useState({ scale: 1, panX: 0, panY: 0 })
    return React.createElement(MapCanvas, {
      data,
      canonicalControlled: true,
      viewport,
      onViewportChange: (next) => { proposals.push(next); setViewport(next) },
    })
  }

  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(StrictMode, null, React.createElement(Harness)))
  })
  const viewportEl = container.querySelector('.mc-viewport')
  const transformOf = () => container.querySelector('.mc-stage').style.transform

  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 }))
  })
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 140, clientY: 100, pointerId: 1 }))
  })
  if (transformOf() !== 'translate(40px, 0px) scale(1)') {
    throw new Error(`mid-drag pause: expected the drag to reach translate(40px, 0px) before the pause, got ${transformOf()}`)
  }

  // PAUSE past DRAG_RECONCILE_TIMEOUT_MS (500ms) — pointer still held down,
  // no pointerup/pointercancel/lostpointercapture, just no movement. This is
  // exactly the scenario the reconcile timer must NOT race: the gesture is
  // still active and must hold its current visual position throughout.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650))
  })
  const duringPause = transformOf()
  if (duringPause !== 'translate(40px, 0px) scale(1)') {
    throw new Error(`mid-drag pause: expected the paused gesture to hold translate(40px, 0px) — no snap to canonical mid-drag — got ${duringPause}`)
  }
  if (proposals.length !== 0) {
    throw new Error(`mid-drag pause: expected no proposal to have been emitted during an in-progress pause, got ${proposals.length}`)
  }

  // Resume the same gesture — it must continue smoothly from where it was
  // paused, not from a snapped-back position.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 175, clientY: 130, pointerId: 1 }))
  })
  const afterResume = transformOf()
  if (afterResume !== 'translate(75px, 30px) scale(1)') {
    throw new Error(`mid-drag pause: expected the resumed drag to continue to translate(75px, 30px), got ${afterResume}`)
  }

  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerup', { clientX: 175, clientY: 130, pointerId: 1 }))
  })
  if (proposals.length !== 1 || proposals[0].panX !== 75 || proposals[0].panY !== 30) {
    throw new Error(`mid-drag pause: expected exactly one release proposal (translate(75px, 30px)), got ${JSON.stringify(proposals)}`)
  }
  const finalTransform = transformOf()
  if (finalTransform !== 'translate(75px, 30px) scale(1)') {
    throw new Error(`mid-drag pause: expected no post-release snap-back, got ${finalTransform}`)
  }

  await act(async () => root.unmount())
  console.log('code-map drag smoothness (mid-drag pause): a paused-but-still-active gesture holds its visual position across the reconcile window instead of snapping to stale canonical, then commits cleanly on release')
}

async function runLostPointerCaptureDuringPauseScenario(MapCanvas) {
  // Confirms the two BLOCKER fixes (lostpointercapture recovery + the
  // reconcile-effect's drag-active gate) don't interact badly: a capture-loss
  // signal arriving mid-PAUSE (gesture still nominally active, no movement in
  // a while) must still abort cleanly, exactly as it would with no pause at
  // all — the staleness-agnostic abort path is orthogonal to the reconcile
  // timer's now-added active-drag gate.
  const proposals = []
  function Harness() {
    const [viewport, setViewport] = React.useState({ scale: 1, panX: 0, panY: 0 })
    return React.createElement(MapCanvas, {
      data,
      canonicalControlled: true,
      viewport,
      onViewportChange: (next) => { proposals.push(next); setViewport(next) },
    })
  }

  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(StrictMode, null, React.createElement(Harness)))
  })
  const viewportEl = container.querySelector('.mc-viewport')
  const transformOf = () => container.querySelector('.mc-stage').style.transform

  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 }))
  })
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 140, clientY: 100, pointerId: 1 }))
  })
  // Pause past the reconcile window while still "active" (no release yet).
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650))
  })
  if (transformOf() !== 'translate(40px, 0px) scale(1)') {
    throw new Error(`lostpointercapture-during-pause: expected the paused gesture to still hold translate(40px, 0px), got ${transformOf()}`)
  }

  // Capture loss arrives during the pause — must abort cleanly, same as the
  // no-pause case: no proposal, revert to canonical.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('lostpointercapture', { clientX: 140, clientY: 100, pointerId: 1 }))
  })
  if (proposals.length !== 0) {
    throw new Error(`lostpointercapture-during-pause: expected no committed proposal, got ${proposals.length}`)
  }
  if (transformOf() !== 'translate(0px, 0px) scale(1)') {
    throw new Error(`lostpointercapture-during-pause: expected revert to canonical after the capture-loss abort, got ${transformOf()}`)
  }

  // A fresh drag must work immediately afterward.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 200, clientY: 200, pointerId: 2 }))
  })
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 220, clientY: 205, pointerId: 2 }))
  })
  if (transformOf() !== 'translate(20px, 5px) scale(1)') {
    throw new Error(`lostpointercapture-during-pause: expected a fresh drag to work immediately, got ${transformOf()}`)
  }

  await act(async () => root.unmount())
  console.log('code-map drag smoothness (lostpointercapture during pause): a capture-loss signal mid-pause still aborts cleanly — the two hardening fixes do not interact badly')
}

async function runStaleDragTimeoutRecoversScenario(MapCanvas) {
  // Belt-and-braces: even if NEITHER pointerup/pointercancel NOR
  // lostpointercapture ever arrives for the stale pointer (the theoretical
  // gap if capture itself was never established), a sufficiently stale
  // dragRef must eventually let a new pointer take over rather than wedging
  // the canvas for the rest of the session. DRAG_STALE_TIMEOUT_MS is a real
  // 10s in production; this test fast-forwards Date.now() rather than
  // sleeping for real, since that's the only thing onPointerDown consults.
  const proposals = []
  function Harness() {
    const [viewport, setViewport] = React.useState({ scale: 1, panX: 0, panY: 0 })
    return React.createElement(MapCanvas, {
      data,
      canonicalControlled: true,
      viewport,
      onViewportChange: (next) => { proposals.push(next); setViewport(next) },
    })
  }

  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(StrictMode, null, React.createElement(Harness)))
  })
  const viewportEl = container.querySelector('.mc-viewport')
  const transformOf = () => container.querySelector('.mc-stage').style.transform

  // Pointer 1 starts a drag and moves — no release, no cancel, no
  // lostpointercapture, ever.
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 }))
  })
  await act(async () => {
    viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 140, clientY: 100, pointerId: 1 }))
  })

  const realDateNow = Date.now
  try {
    // Well before the staleness window: a second pointer is still ignored.
    Date.now = () => realDateNow() + 2_000
    await act(async () => {
      viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 500, clientY: 500, pointerId: 2 }))
    })
    await act(async () => {
      viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 510, clientY: 505, pointerId: 2 }))
    })
    if (transformOf() !== 'translate(40px, 0px) scale(1)') {
      throw new Error(`stale-drag timeout: expected pointer 2 to still be ignored 2s into the stale drag, got ${transformOf()}`)
    }

    // Past the staleness window: a fresh pointerdown recovers, abandoning
    // pointer 1's stale, never-released drag without committing it. The new
    // drag continues panning from wherever the canvas VISUALLY was left
    // (pointer 1's abandoned translate(40px, 0px) preview, still the
    // current render's `pan` at the moment pointer 4 touches down) rather
    // than jumping back to canonical first — no visible snap, matching a
    // "take over from here" recovery rather than "revert then take over".
    Date.now = () => realDateNow() + 11_000
    await act(async () => {
      viewportEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 300, clientY: 300, pointerId: 4 }))
    })
    await act(async () => {
      viewportEl.dispatchEvent(pointerEvent('pointermove', { clientX: 320, clientY: 315, pointerId: 4 }))
    })
    if (transformOf() !== 'translate(60px, 15px) scale(1)') {
      throw new Error(`stale-drag timeout: expected pointer 4 to take over (continuing from pointer 1's abandoned translate(40px, 0px)) once pointer 1's drag exceeded the staleness window, got ${transformOf()}`)
    }
    await act(async () => {
      viewportEl.dispatchEvent(pointerEvent('pointerup', { clientX: 320, clientY: 315, pointerId: 4 }))
    })
    if (proposals.length !== 1 || proposals[0].panX !== 60 || proposals[0].panY !== 15) {
      throw new Error(`stale-drag timeout: expected only the recovered drag to commit (translate(60px, 15px)), got ${JSON.stringify(proposals)}`)
    }
  } finally {
    Date.now = realDateNow
  }

  await act(async () => root.unmount())
  console.log('code-map drag smoothness (stale-drag timeout recovers): a drag whose pointer never sends up/cancel/lostpointercapture at all is abandoned after the staleness window, not wedged forever')
}

const server = await createServer({
  appType: 'custom', configFile: false, logLevel: 'silent', plugins: [react()],
  root: process.cwd(), server: { middlewareMode: true },
})
try {
  const { default: MapCanvas } = await server.ssrLoadModule('/src/ui/MapCanvas.jsx')
  await runSynchronousOwnerScenario(MapCanvas)
  await runNonReconcilingOwnerScenario(MapCanvas)
  await runAsyncDelayedOwnerScenario(MapCanvas)
  await runMultiPointerGuardScenario(MapCanvas)
  await runPointerCancelAbortsScenario(MapCanvas)
  await runLostPointerCaptureRecoversScenario(MapCanvas)
  await runStaleDragTimeoutRecoversScenario(MapCanvas)
  await runMidDragPauseScenario(MapCanvas)
  await runLostPointerCaptureDuringPauseScenario(MapCanvas)
} finally {
  await server.close()
  dom.window.close()
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor === undefined) delete globalThis[key]
    else Object.defineProperty(globalThis, key, descriptor)
  }
}
