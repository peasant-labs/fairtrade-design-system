/* screenshot the in-use demos: drive the app-switcher + each app's own navigation, capture the window.
   the transcript app gets a deep walk — all 5 tabs, the graph view-mode, and every sub-surface
   (trace canvas, scorecard, rails, scrubber, label popover) — so a screenshot set covers every
   surface the mockup renders over its OWN fixtures, in one theme.

   usage: node scripts/shootdemo.mjs <theme> <outdir>
     theme  = dark | light   (light loads the page with ?theme=light, which the index.html boot
              script maps to <html data-theme="light">; the apps re-theme purely from tokens)
     outdir = directory to write <surface>.png into

   CHROME_PATH overrides the browser binary (matches imgdiff.mjs / sbshot.mjs); it falls back to the
   macOS Google Chrome path so the script still runs unchanged on a dev mac. Set CHROME_PATH to the
   path of your Chrome/Chromium binary, e.g.:
     CHROME_PATH=/home/you/.nix-profile/bin/google-chrome node scripts/shootdemo.mjs dark shots/

   The demo server must be running on :5180 before invoking (pnpm dev). */
import puppeteer from 'puppeteer-core'
import { mkdirSync, existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { SurfaceGate } from './surface-gate.mjs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const theme = process.argv[2] || 'dark'
const out = process.argv[3] || `/tmp/demo-${theme}`
/* DEMO_PORT lets the gate target a non-default dev-server port (default 5180) so a
   parallel worktree already holding 5180 does not block a capture run. */
const DEMO_PORT = Number(process.env.DEMO_PORT) || 5180
mkdirSync(out, { recursive: true })

/* ── actionable preflight checks ─────────────────────────────────────────── */

/* (1) Chrome binary — fail with instructions before puppeteer produces an opaque error. */
if (!existsSync(CHROME)) {
  console.error(
    `ERROR [shootdemo.mjs] Chrome binary not found at: ${CHROME}\n` +
    `  What failed: puppeteer could not locate the browser to launch.\n` +
    `  Why: CHROME_PATH is unset or points to a missing file.\n` +
    `  Where: shootdemo.mjs startup, binary check.\n` +
    `  Means: the script cannot take any screenshots.\n` +
    `  Fix: set CHROME_PATH to your Chrome/Chromium binary, e.g.\n` +
    `    CHROME_PATH=/home/you/.nix-profile/bin/google-chrome node scripts/shootdemo.mjs ${theme}`
  )
  process.exit(1)
}

/* (2) Demo server liveness — probe :5180 before navigating; a blank page looks like a successful
   capture but contains nothing meaningful, which would silently corrupt the baseline. */
/* try 'localhost' first (OS resolves IPv4 or IPv6 correctly); fall back to '::1' then '127.0.0.1'
   so the check works regardless of whether Vite binds to IPv4 or IPv6. */
const probePort = (host) => new Promise((resolve) => {
  const s = createConnection({ port: DEMO_PORT, host })
  s.on('connect', () => { s.destroy(); resolve(true) })
  s.on('error', () => resolve(false))
})
const alive = (await probePort('localhost')) || (await probePort('::1')) || (await probePort('127.0.0.1'))
if (!alive) {
  console.error(
    `ERROR [shootdemo.mjs] Demo server is not listening on port 5180.\n` +
    `  What failed: TCP connect to localhost:5180 (IPv4 + IPv6) was refused.\n` +
    `  Why: the Vite dev server is not running.\n` +
    `  Where: shootdemo.mjs startup, server liveness check.\n` +
    `  Means: page.goto() would receive an empty page, producing blank baselines.\n` +
    `  Fix: start the dev server first — pnpm dev — then re-run this script.`
  )
  process.exit(1)
}

/* ── browser launch ───────────────────────────────────────────────────────── */

const url = `http://localhost:${DEMO_PORT}/?fb=off${theme === 'light' ? '&theme=light' : ''}`
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: 1460, height: 1000, deviceScaleFactor: 1 },
})
const page = await browser.newPage()

/* reduce-motion removes CSS transitions and animations so every frame settles in one
   rAF cycle; this is required for deterministic captures (scroll-reveal, fade-in, etc.) */
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])

const errs = []
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()) })
page.on('pageerror', (e) => errs.push('pageerr: ' + e.message))
await page.goto(url, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 800))

/* ── helpers ──────────────────────────────────────────────────────────────── */

const pause = (ms) => new Promise((r) => setTimeout(r, ms))

/* wait for a selector to appear (polls; throws actionably on timeout) */
const waitFor = async (sel, surface, timeoutMs = 3000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const el = await page.$(sel)
    if (el) return el
    await pause(80)
  }
  throw new Error(
    `ERROR [shootdemo.mjs] Expected element did not mount.\n` +
    `  What failed: page.$(${JSON.stringify(sel)}) returned null after ${timeoutMs}ms.\n` +
    `  Why: the surface was not rendered (navigation may have failed, or a view-state guard is blocking it).\n` +
    `  Where: shootdemo.mjs, capturing surface "${surface}".\n` +
    `  Means: the screenshot for "${surface}" would silently capture the wrong surface.\n` +
    `  Fix: confirm the navigation step before this surface succeeds, and that the mockup fixture has content for it.`
  )
}

/* gate (e): the non-empty-surface assertion lives in surface-gate.mjs (one implementation, shared with
   its self-check). shot() runs it on every capture so a blank/near-empty/duplicate fails the run. */
const gate = new SurfaceGate(page)

/* screenshot a selector; throws if the element is missing or has zero/negligible size.

   CAPTURE METHOD — captureBeyondViewport:false is load-bearing, do not remove.
   The in-use stage nests the captured surfaces inside a CSS scroll-snap section (.iu) whose
   inner stage (.iu-stage) is overflow:auto with a position:sticky banner. Puppeteer's default
   element screenshot (captureBeyondViewport:true) re-rasters the page OFF the live compositor;
   that off-screen raster does not paint the snap/overflow-clipped subtree, so every surface
   comes out as a uniform background rectangle (the silent-blank failure this harness guards).
   captureBeyondViewport:false captures the on-screen composited pixels — exactly what a user
   sees — so the surface renders with real content. This requires the element to be fully within
   the viewport, which holds here: the stage is centred (banner pinned at the top) and every
   surface is bounded by .txn-app, which is locked to the stage height (< the viewport height).
   We re-assert that invariant below and fail loud if a surface ever exceeds the viewport. */
const shot = async (name, sel = '.txn-app') => {
  const el = await waitFor(sel, name)
  /* keep the stage pinned to the top of the viewport so the surface is fully on-screen for a
     live-compositor capture (the snap section is 100svh; centring it aligns it to the viewport) */
  await page.evaluate(() => document.getElementById('inuse-stage')?.scrollIntoView({ block: 'center' }))
  await pause(80)
  const box = await el.boundingBox()
  if (!box || box.width < 4 || box.height < 4) {
    await browser.close()
    throw new Error(
      `ERROR [shootdemo.mjs] Captured region is blank or zero-size.\n` +
      `  What failed: ${JSON.stringify(sel)} resolved to a box of ${JSON.stringify(box)}.\n` +
      `  Why: the element is hidden, collapsed, or not laid out.\n` +
      `  Where: shootdemo.mjs, shot("${name}", "${sel}").\n` +
      `  Means: the PNG for "${name}" would be empty, corrupting the baseline.\n` +
      `  Fix: ensure the navigation step that shows this surface ran successfully before capturing it.`
    )
  }
  const vp = page.viewport()
  if (box.y < -0.5 || box.y + box.height > vp.height + 0.5) {
    await browser.close()
    throw new Error(
      `ERROR [shootdemo.mjs] Surface extends beyond the viewport — cannot capture it live.\n` +
      `  What failed: "${sel}" box y=${box.y.toFixed(0)}..${(box.y + box.height).toFixed(0)} is outside [0, ${vp.height}].\n` +
      `  Why: a live-compositor capture (captureBeyondViewport:false) only sees on-screen pixels;\n` +
      `       a surface taller than the viewport would be silently clipped.\n` +
      `  Where: shootdemo.mjs, shot("${name}", "${sel}") — viewport-fit guard.\n` +
      `  Means: the "${name}" capture would be partial, corrupting the baseline.\n` +
      `  Fix: raise the launch viewport height, or scroll the surface fully into view before capturing.`
    )
  }
  await el.screenshot({ path: `${out}/${name}.png`, captureBeyondViewport: false })
  /* gate (e): fail the run unless this capture carries real, non-duplicate content */
  const r = await gate.assert(name, `${out}/${name}.png`, { sel, where: 'shootdemo.mjs' })
  console.log('shot', name.padEnd(20), `${Math.round(box.width)}x${Math.round(box.height)}`.padEnd(11), `nonbg=${(r.nonbgRatio * 100).toFixed(1)}% colors=${r.distinctColors} ${(r.bytes / 1024).toFixed(1)}KB`)
}

/* capture a surface whose content scrolls inside an inner container (`scroller`) IN FULL: temporarily
   grow the viewport so the whole scroller lays out on-screen, then live-capture it (captureBeyondViewport
   :false still needs every pixel on-screen). Used for the trace canvas so the single artifact shows the
   whole stream — every turn card, thinking block, per-kind tool renderer, phase/task/checkpoint marker,
   and the nested subagent turn — not just the top fold. The base viewport is restored afterwards so the
   scroll-dependent surfaces that follow (scrubber/rails) still behave normally. Capped at 4000px (Chrome's
   practical raster ceiling); a stream taller than that fails loud rather than silently clipping. */
const shotTall = async (name, sel = '.txn-app', scroller = '.txn-stream') => {
  await waitFor(sel, name)
  const baseVp = page.viewport()
  const extra = await page.evaluate((s) => { const el = document.querySelector(s); return el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0 }, scroller)
  const tallH = Math.min(baseVp.height + extra + 24, 4000)
  await page.setViewport({ ...baseVp, height: tallH })
  await pause(350)
  await page.evaluate(() => document.getElementById('inuse-stage')?.scrollIntoView({ block: 'center' }))
  await pause(150)
  const el = await page.$(sel)
  const box = await el.boundingBox()
  if (!box || box.width < 4 || box.height < 4) {
    await browser.close()
    throw new Error(
      `ERROR [shootdemo.mjs] Full-stream capture resolved to a blank/zero-size box.\n` +
      `  What failed: "${sel}" box is ${JSON.stringify(box)} after growing the viewport to ${tallH}px.\n` +
      `  Where: shootdemo.mjs, shotTall("${name}", "${sel}").\n` +
      `  Means: the "${name}" baseline would be empty.\n` +
      `  Fix: confirm the trace tab + list view-mode are active and the stream mounted before this capture.`
    )
  }
  if (box.y + box.height > tallH + 0.5) {
    await browser.close()
    throw new Error(
      `ERROR [shootdemo.mjs] Stream is taller than the capped viewport — would be clipped.\n` +
      `  What failed: "${sel}" extends to y=${(box.y + box.height).toFixed(0)} but the viewport is capped at ${tallH}px.\n` +
      `  Why: the inner scroller (${scroller}) is taller than the 4000px raster ceiling.\n` +
      `  Where: shootdemo.mjs, shotTall("${name}", "${sel}") — height-cap guard.\n` +
      `  Means: the "${name}" capture would silently drop the bottom of the stream.\n` +
      `  Fix: raise the cap in shotTall (and confirm Chrome can still raster it), or split the stream capture.`
    )
  }
  await el.screenshot({ path: `${out}/${name}.png`, captureBeyondViewport: false })
  const r = await gate.assert(name, `${out}/${name}.png`, { sel, where: 'shootdemo.mjs' })
  console.log('shot', name.padEnd(20), `${Math.round(box.width)}x${Math.round(box.height)}`.padEnd(11), `nonbg=${(r.nonbgRatio * 100).toFixed(1)}% colors=${r.distinctColors} ${(r.bytes / 1024).toFixed(1)}KB (full stream)`)
  /* restore the base viewport so the scroll-reveal surfaces that follow see a scrollable stream again */
  await page.setViewport(baseVp)
  await pause(300)
  await page.evaluate(() => document.getElementById('inuse-stage')?.scrollIntoView({ block: 'center' }))
  await pause(150)
}

/* bring the full-screen in-use stage into view and let its snap settle */
await page.evaluate(() => document.getElementById('inuse-stage')?.scrollIntoView({ block: 'center' }))
await pause(400)

/* app switcher: the banner tablist buttons (.iu-opt), 0=transcript 1=village 2=peasant */
const app = async (i) => {
  await page.evaluate((i) => document.querySelectorAll('.iu-opt')[i]?.click(), i)
  await pause(500)
}

/* transcript top tab strip: select a tab by its visible label (highlights / full trace / diffs /
   files / annotations). matches on a label substring so the count badge text is tolerated. */
const txnTab = async (label) => {
  const found = await page.evaluate((label) => {
    const b = [...document.querySelectorAll('.txn-tab')].find((x) => x.textContent.toLowerCase().includes(label))
    if (!b) return false
    b.click(); return true
  }, label)
  if (!found) {
    await browser.close()
    throw new Error(
      `ERROR [shootdemo.mjs] Tab navigation failed.\n` +
      `  What failed: no .txn-tab button whose text includes "${label}" was found.\n` +
      `  Why: the tab strip may not be mounted (wrong app active) or the label changed.\n` +
      `  Where: shootdemo.mjs, txnTab("${label}").\n` +
      `  Means: subsequent shots will capture the previous tab under the new name.\n` +
      `  Fix: confirm the transcript app is active (.iu-opt index 0) and the tab label is correct.`
    )
  }
  /* settle: poll for the tab's aria-selected=true; reduces reliance on a fixed pause */
  const settled = await page.evaluate((label) => {
    return new Promise((resolve) => {
      let n = 0
      const check = () => {
        const b = [...document.querySelectorAll('.txn-tab')].find((x) => x.textContent.toLowerCase().includes(label))
        if (b && b.getAttribute('aria-selected') === 'true') { resolve(true); return }
        if (++n > 50) { resolve(false); return }
        setTimeout(check, 20)
      }
      check()
    })
  }, label)
  if (!settled) await pause(450) // fallback if aria-selected never flips (shouldn't happen)
}

/* the trace-view list/graph segmented control (.txn-viewtoggle .bs-seg-opt) */
const txnViewMode = async (mode) => {
  const found = await page.evaluate((mode) => {
    const b = [...document.querySelectorAll('.txn-viewtoggle .bs-seg-opt')].find((x) => x.textContent.toLowerCase().includes(mode))
    if (!b) return false
    b.click(); return true
  }, mode)
  if (!found) {
    await browser.close()
    throw new Error(
      `ERROR [shootdemo.mjs] View-mode button not found.\n` +
      `  What failed: no .txn-viewtoggle .bs-seg-opt button matching "${mode}" was found.\n` +
      `  Why: the view-mode toggle only renders on the "full trace" tab in list context.\n` +
      `  Where: shootdemo.mjs, txnViewMode("${mode}").\n` +
      `  Means: the subsequent shot would capture the wrong view.\n` +
      `  Fix: ensure txnTab("full trace") runs successfully before txnViewMode().`
    )
  }
  await pause(450)
}

/* scroll the transcript stream past the sticky threshold so the condensed scrubber header reveals.
   HARD-FAILS if the scrubber does not mount — post-lift absence would corrupt the gate. */
const revealScrubber = async () => {
  const scrolled = await page.evaluate(() => {
    const sc = document.querySelector('.txn-stream')
    if (!sc) return false
    sc.scrollTop = 240
    /* dispatch scroll synchronously so React's onScroll fires before the next evaluate */
    sc.dispatchEvent(new Event('scroll', { bubbles: true }))
    return true
  })
  if (!scrolled) {
    await browser.close()
    throw new Error(
      `ERROR [shootdemo.mjs] .txn-stream not found — cannot reveal scrubber.\n` +
      `  What failed: the trace stream container is absent from the DOM.\n` +
      `  Why: the "full trace" tab may not be active, or the list view-mode is not selected.\n` +
      `  Where: shootdemo.mjs, revealScrubber().\n` +
      `  Means: the txn-scrubber surface cannot be captured.\n` +
      `  Fix: ensure txnTab("full trace") + txnViewMode("list") run before revealScrubber().`
    )
  }
  /* poll until React state update renders .txn-scrub (onScroll -> setSticky -> re-render) */
  const scrubEl = await waitFor('.txn-scrub', 'txn-scrubber', 2000).catch(() => null)
  if (!scrubEl) {
    await browser.close()
    throw new Error(
      `ERROR [shootdemo.mjs] .txn-scrub did not mount after scrolling the stream.\n` +
      `  What failed: React's sticky/scrubber state did not activate within 2 s.\n` +
      `  Why: the stream may be too short to scroll past the 56px sticky threshold, or\n` +
      `       reduce-motion prevented the scroll from registering.\n` +
      `  Where: shootdemo.mjs, revealScrubber() — .txn-scrub poll.\n` +
      `  Means: the txn-scrubber baseline would be missing, so the post-refactor pre/post diff\n` +
      `       would vacuously pass (no baseline to diff against).\n` +
      `  Fix: confirm the fixture has enough turns to fill the scroll container, or increase\n` +
      `       the scrollTop value above the sticky threshold in this script.`
    )
  }
  await pause(200) // let the sticky header layout settle before capturing
}

/* reset the inner stream scroll to top so the rails shot starts from a stable position.
   waits for the sticky state to clear (sticky=false → re-render) before returning. */
const resetScroll = async () => {
  await page.evaluate(() => {
    const sc = document.querySelector('.txn-stream')
    if (sc) { sc.scrollTop = 0; sc.dispatchEvent(new Event('scroll', { bubbles: true })) }
  })
  /* poll until the sticky condensed header disappears (React state catch-up) */
  const cleared = await page.evaluate(() => {
    return new Promise((resolve) => {
      let n = 0
      const check = () => {
        if (!document.querySelector('.txn-sticky')) { resolve(true); return }
        if (++n > 40) { resolve(false); return }
        setTimeout(check, 25)
      }
      check()
    })
  })
  if (!cleared) await pause(400) // fallback: wait longer if sticky never cleared
  await pause(150) // final layout settle
}

/* open the per-turn label popover via the first turn's label button (.txn-labelbtn).
   HARD-FAILS if either the button or the resulting popover doesn't mount. */
const openLabelPopover = async () => {
  const clicked = await page.evaluate(() => {
    const b = document.querySelector('.txn-labelbtn')
    if (!b) return false
    b.click(); return true
  })
  if (!clicked) {
    await browser.close()
    throw new Error(
      `ERROR [shootdemo.mjs] .txn-labelbtn not found — cannot open label popover.\n` +
      `  What failed: no .txn-labelbtn element in the DOM.\n` +
      `  Why: the "full trace" tab may not be active, or a turn with a label button is not visible.\n` +
      `  Where: shootdemo.mjs, openLabelPopover().\n` +
      `  Means: the txn-label-popover surface cannot be captured.\n` +
      `  Fix: ensure txnTab("full trace") + txnViewMode("list") run before openLabelPopover().`
    )
  }
  const popEl = await waitFor('.txn-label-pop', 'txn-label-popover', 2000).catch(() => null)
  if (!popEl) {
    await browser.close()
    throw new Error(
      `ERROR [shootdemo.mjs] .txn-label-pop did not mount after clicking .txn-labelbtn.\n` +
      `  What failed: the label popover did not appear within 2 s.\n` +
      `  Why: the click may not have reached the button, or the popover state guard blocked it.\n` +
      `  Where: shootdemo.mjs, openLabelPopover() — .txn-label-pop poll.\n` +
      `  Means: the txn-label-popover baseline would be missing.\n` +
      `  Fix: confirm the button click lands correctly (check for pointer-events: none or z-index stacking).`
    )
  }
}

const closeLabelPopover = async () => {
  await page.keyboard.press('Escape')
  await pause(250)
}

/* flip the "expand all tool calls" view switch (right filters rail) so every tool body — and thus
   every per-kind tool renderer present in the fixtures — paints in the trace canvas. */
const expandAllTools = async () => {
  const found = await page.evaluate(() => {
    const sw = [...document.querySelectorAll('.txn-viewsw')].find((x) => x.textContent.toLowerCase().includes('expand all'))
    if (!sw) return false
    const btn = sw.querySelector('button, [role="switch"], .toggle') || sw
    btn.click(); return true
  })
  if (!found) {
    await browser.close()
    throw new Error(
      `ERROR [shootdemo.mjs] "expand all tool calls" ViewSwitch not found.\n` +
      `  What failed: no .txn-viewsw with text "expand all" in the DOM.\n` +
      `  Why: the filters rail may not be mounted, or the label changed.\n` +
      `  Where: shootdemo.mjs, expandAllTools().\n` +
      `  Means: tool bodies will not render in the trace canvas, missing per-kind renderers.\n` +
      `  Fix: ensure txnTab("full trace") runs before expandAllTools().`
    )
  }
  await pause(450)
}

/* ── overview: the three sibling apps (continuity with the prior 3-app overview set) ── */
await app(0); await shot('app-1-transcript', '.iu-screen')
await app(1); await shot('app-2-village', '.iu-screen')
await app(2); await shot('app-3-peasant', '.iu-screen')

/* ── deep walk of the transcript app: every tab + sub-surface ── */
await app(0)
await pause(300)

/* highlights tab — carries the scorecard at its head.
   clip each at its own element so they are genuinely distinct surfaces for the imgdiff gate. */
await txnTab('highlights')
await shot('txn-highlights')                   // full highlights tab (.txn-app)
await shot('txn-scorecard', '.txn-scorecard')  // just the scorecard sub-region

/* full trace — the list canvas: subagent nesting + thinking + per-kind tool renderers.
   expand all tool calls first so every tool body renders, then capture the WHOLE stream (shotTall grows
   the viewport so every turn — including the nested subagent turn and each tool renderer — is in frame). */
await txnTab('full trace')
await txnViewMode('list')
await expandAllTools()
await shotTall('txn-trace-canvas')

/* scrubber: clip the .txn-scrub element directly so it's distinct from the rails whole-app shot.
   then reset scroll to stable top before the rails capture. */
await revealScrubber()
await shot('txn-scrubber', '.txn-scrub')

await resetScroll()
await shot('txn-rails') // full .txn-app: left outline rail + right filters rail at scroll-top

/* label popover overlay */
await openLabelPopover()
await shot('txn-label-popover')
await closeLabelPopover()

/* trajectory graph view-mode */
await txnViewMode('graph'); await shot('txn-graph')
await txnViewMode('list')

/* remaining tabs */
await txnTab('diffs'); await shot('txn-diffs')
await txnTab('files'); await shot('txn-files')
await txnTab('annotations'); await shot('txn-annotations')

console.log('console errors:', errs.length ? errs.slice(0, 5) : 'none')
await browser.close()
