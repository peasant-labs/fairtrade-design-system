/* storybook render + play smoke: serve storybook-static, load every story's iframe (which auto-runs
   its play() function), and report any story that logs a console/page error.

   usage: node scripts/sbsmoke.mjs [story-id-substring]
     - no arg: the full catalog (CI mode)
     - substring: only matching story ids, for fast local iteration (the run
       says loudly that it is filtered — a filtered green is not a full green)

   Wait strategy: SIGNAL-DRIVEN, never a tuned sleep. A pre-navigation hook
   subscribes to Storybook's preview channel and resolves when the story
   reports itself finished (render-phase completed/errored/aborted, story
   rendered, or a thrown story/play exception); a hard ceiling only bounds a
   story that never signals at all — it is a failure boundary, not a pacing
   knob. Stories run through a small tab pool (SMOKE_TABS, default/max 4 —
   CI runners have 2-4 vCPUs; more tabs just contend). */
import puppeteer from 'puppeteer-core'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = 'storybook-static'
const PORT = Number(process.env.SB_PORT) || 6017 // env override so concurrent review runs don't collide on the port; default 6017 preserved
const TABS = Math.max(1, Math.min(4, Number(process.env.SMOKE_TABS) || 4))
const SETTLE_CEILING_MS = 15000 // failure boundary for a story that never signals (not a pacing knob)
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.mp4':'video/mp4', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf' }
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'
    const fp = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''))
    if (!existsSync(fp)) { res.writeHead(404); return res.end('nf') }
    const buf = await readFile(fp)
    res.writeHead(200, { 'content-type': MIME[extname(fp)] || 'application/octet-stream' })
    res.end(buf)
  } catch { res.writeHead(500); res.end('err') }
})
await new Promise((r) => server.listen(PORT, r))

const idx = JSON.parse(await readFile(join(ROOT, 'index.json'), 'utf8'))
const allIds = Object.values(idx.entries || idx.stories || {}).filter((e) => e.type !== 'docs').map((e) => e.id)
const filter = process.argv[2]
const ids = filter ? allIds.filter((id) => id.includes(filter)) : allIds
if (filter) console.log(`FILTERED run: ${ids.length} of ${allIds.length} stories match "${filter}" — not a full-catalog result`)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 900, height: 700 } })
const bad = []
const noise = []
let n = 0

/* Installed before any page script runs: subscribe to the preview channel as
   soon as it exists and expose ONE promise the runner awaits. Every terminal
   story state resolves it — completed play() included — so the runner never
   guesses how long a story needs. */
const installSettleHook = (page) => page.evaluateOnNewDocument(() => {
  window.__SB_SETTLED__ = new Promise((resolve) => {
    const hook = () => {
      const channel = window.__STORYBOOK_ADDONS_CHANNEL__
      if (!channel) return void setTimeout(hook, 25)
      const done = (signal) => () => resolve(signal)
      // render lifecycle: 'completed' fires AFTER a play() finishes; errored/
      // aborted are terminal too (the error itself surfaces via console/pageerror)
      channel.on('storyRenderPhaseChanged', ({ newPhase }) => {
        if (newPhase === 'completed' || newPhase === 'errored' || newPhase === 'aborted') resolve(newPhase)
      })
      channel.on('storyRendered', done('rendered'))
      channel.on('storyErrored', done('storyErrored'))
      channel.on('storyThrewException', done('storyThrewException'))
      channel.on('playFunctionThrewException', done('playFunctionThrewException'))
      channel.on('storyMissing', done('storyMissing'))
    }
    hook()
  })
})

/* Run one story to completion and return its findings (no shared state — the
   caller decides what a failure means, so the isolation-retry pass below can
   reuse this verbatim). */
const checkStory = async (id) => {
  const page = await browser.newPage()
  // Only one tab is truly focused in a Chrome process; with a tab pool the
  // other pages would report document.hasFocus() === false and break
  // focus-dependent play() assertions (toHaveFocus). Emulate focus per tab —
  // the same CDP primitive test runners use — so every story behaves like it
  // runs in a focused window.
  const cdp = await page.createCDPSession()
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  const errs = []
  const res404 = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('requestfailed', (r) => res404.push(r.url().split('/').pop() + ' (' + (r.failure()?.errorText || 'failed') + ')'))
  page.on('response', (r) => { if (r.status() === 404) res404.push(r.url().split('/').pop() + ' (404)') })
  let rootEmpty = false
  try {
    await installSettleHook(page)
    // domcontentloaded (not networkidle0): stories whose play() drives heavy re-renders
    // (e.g. the TanStack DataTable sort/select interactions) never settle to network-idle even
    // with 0 in-flight requests, so networkidle0 false-times-out. Actual readiness comes from
    // the channel signal below.
    await page.goto(`http://localhost:${PORT}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    const settled = await Promise.race([
      page.evaluate(() => window.__SB_SETTLED__),
      new Promise((resolve) => setTimeout(() => resolve(null), SETTLE_CEILING_MS)),
    ])
    if (settled === null) errs.push(`smoke: story never signalled a terminal render state within ${SETTLE_CEILING_MS}ms`)
    // one macrotask of grace so console/pageerror events emitted at settle time flush through CDP
    await new Promise((r) => setTimeout(r, 50))
    rootEmpty = await page.evaluate(() => { const r = document.querySelector('#storybook-root,#root'); return !r || r.childElementCount === 0 })
  } catch (e) { errs.push('goto: ' + e.message) }
  await page.close()
  // real failures = JS / assertion errors (play() throws are logged here); resource 404s are reported
  // separately (deliberate broken-image fallback demos + framework noise are not test failures)
  const isResourceNoise = (t) => /Failed to load resource|ERR_NAME_NOT_RESOLVED|net::ERR|favicon|Download the React DevTools|preload/i.test(t)
  return {
    id,
    rootEmpty,
    errs: errs.filter((t) => !isResourceNoise(t)).slice(0, 2),
    res: [...new Set(res404)].slice(0, 3),
  }
}

/* Pass 1 — tab pool: TABS workers pull the next story id off a shared cursor
   (read+increment has no await between them, so single-threaded JS makes it
   race-free). */
const suspects = []
let cursor = 0
await Promise.all(Array.from({ length: TABS }, async () => {
  while (true) {
    const i = cursor++
    if (i >= ids.length) break
    const result = await checkStory(ids[i])
    n++
    if (result.errs.length || result.rootEmpty) suspects.push(result)
    if (result.res.length) noise.push({ id: result.id, res: result.res })
  }
}))

/* Pass 2 — isolation retry: interaction-heavy play() stories can starve for
   CPU under tab contention and blow their assertion time budgets (observed:
   focus-trap and exit-animation waits). Anything that failed in the pool gets
   ONE serial, uncontended re-run; only a story that ALSO fails in isolation
   is a real failure. Recovered stories are reported loudly as contention
   flakes — retries absorb scheduling noise, they must never hide a signal. */
const flaky = []
for (const suspect of suspects.sort((a, b) => a.id.localeCompare(b.id))) {
  const retry = await checkStory(suspect.id)
  if (retry.errs.length || retry.rootEmpty) bad.push(retry)
  else flaky.push({ id: suspect.id, errs: suspect.errs })
}

await browser.close(); server.close()
const byId = (a, b) => a.id.localeCompare(b.id)
bad.sort(byId); noise.sort(byId); flaky.sort(byId)
console.log(`\nstorybook smoke: ${n} stories loaded (${TABS} tabs), ${bad.length} with REAL errors, ${flaky.length} contention-flaky (passed isolated retry), ${noise.length} with resource noise`)
for (const b of bad) console.log('  FAIL', b.id, b.rootEmpty ? '(empty root)' : '', JSON.stringify(b.errs))
for (const f of flaky) console.log('  FLAKY', f.id, '(pool fail → isolated pass)', JSON.stringify(f.errs))
for (const x of noise) console.log('  note', x.id, JSON.stringify(x.res))
process.exit(bad.length ? 1 : 0)
