#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { loadSectionWidthFixtures } from './section-width.test.mjs'
import { SurfaceGate } from './surface-gate.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const EVIDENCE_DIR = resolve(process.env.SECTION_WIDTH_EVIDENCE_DIR ?? '/tmp/opencode/fairtrade-45')
const CHROME = process.env.CHROME_PATH
const VIEWPORT = Object.freeze({ width: 1460, height: 1000, deviceScaleFactor: 1 })
const BASE_MARKER = 'section.band{max-width:var(--maxw);margin:0auto}'
const IU_MARKER = '.iusection:not(.band){max-width:none;margin-inline:0}'
const MIME = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
})

if (!CHROME || !existsSync(CHROME)) {
  throw actionable('section-width mounted probe cannot start\ncase: browser-preflight\nfile: CHROME_PATH\nexpected: an existing Chromium executable\nremedy: build first, set CHROME_PATH to the job container browser, then rerun the focused probe')
}
if (!existsSync(resolve(DIST, 'index.html'))) {
  throw actionable('section-width mounted probe cannot start\ncase: dist-preflight\nfile: dist/index.html\nexpected: the exact production build\nremedy: run pnpm build in this worktree, then rerun the focused probe')
}

const { fixture } = loadSectionWidthFixtures(ROOT)
mkdirSync(EVIDENCE_DIR, { recursive: true })
const featureHead = git('rev-parse', 'HEAD')
const canonicalHead = git('rev-parse', 'origin/main')
const mergeBase = git('merge-base', 'HEAD', 'origin/main')
const branch = git('branch', '--show-current')
const status = git('status', '--porcelain')
const clean = status.length === 0
if (!clean && process.env.ALLOW_DIRTY_CAPTURE !== '1') {
  throw actionable(`section-width mounted probe requires a clean committed worktree\ncase: feature-provenance\nfile: ${ROOT}\nobserved: ${JSON.stringify(status)}\nexpected: clean git status\nremedy: commit the intended sources and evidence scripts, or set ALLOW_DIRTY_CAPTURE=1 only for non-final development diagnostics`)
}
if (featureHead === canonicalHead) throw actionable('section-width mounted probe cannot prove a feature artifact\ncase: feature-provenance\nfile: git HEAD\nexpected: feature head distinct from canonical origin/main\nremedy: run the probe on the isolated feature worktree')

const indexDisk = readFileSync(resolve(DIST, 'index.html'))
const allAssetPaths = listFiles(DIST).filter((path) => ['.css', '.js'].includes(extname(path))).map((path) => `/${relative(DIST, path).split(sep).join('/')}`).sort()
if (!allAssetPaths.some((path) => path.endsWith('.css')) || !allAssetPaths.some((path) => path.endsWith('.js'))) {
  throw actionable('section-width mounted probe found no complete production JavaScript/CSS set\ncase: dist-assets\nfile: dist\nexpected: at least one built .js and .css asset\nremedy: remove stale dist output and rerun pnpm build')
}
const htmlReferences = [...indexDisk.toString('utf8').matchAll(/(?:src|href)=["']([^"']+\.(?:css|js)(?:\?[^"']*)?)["']/g)].map((match) => match[1].split(/[?#]/)[0])
for (const reference of htmlReferences) {
  if (!allAssetPaths.includes(reference)) throw actionable(`section-width mounted probe found an index reference outside the fetched manifest\ncase: dist-references\nfile: dist/index.html\nexpected: ${JSON.stringify(reference)} in the built asset set\nremedy: rebuild dist from the current worktree and rerun provenance capture`)
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const path = resolve(DIST, requested)
    if (path !== DIST && !path.startsWith(DIST + sep)) {
      response.writeHead(403)
      response.end('forbidden')
      return
    }
    const bytes = readFileSync(path)
    response.statusCode = 200
    response.setHeader('content-type', MIME[extname(path)] ?? 'application/octet-stream')
    response.setHeader('content-length', bytes.length)
    response.end(bytes)
  } catch {
    response.writeHead(404)
    response.end('not found')
  }
})
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
const address = server.address()
if (!address || typeof address === 'string') throw actionable('section-width mounted probe could not resolve its local production-server address\ncase: server-listen\nfile: scripts/section-width-rendered-probe.mjs\nexpected: an OS-assigned TCP port\nremedy: check local port/socket permissions and rerun')
const origin = `http://127.0.0.1:${address.port}`

let browser
const evidence = {
  schema: 'fairtrade-section-width-mounted-evidence-v1',
  repository: 'peasant-labs/fairtrade-design-system',
  branch,
  featureHead,
  canonicalHead,
  mergeBase,
  clean,
  status,
  dist: resolve(DIST),
  servedOrigin: origin,
  sourceMarker: BASE_MARKER,
  iuHostMarker: IU_MARKER,
  index: null,
  assets: [],
  assetManifestDigest: '',
  themes: [],
  durableEmbedsRequired: true,
}
try {
  const servedIndex = Buffer.from(await (await fetch(`${origin}/`)).arrayBuffer())
  assert.deepEqual(servedIndex, indexDisk, 'served index differs from the exact dist/index.html')
  evidence.index = assetRecord('/', servedIndex)

  const servedAssets = []
  for (const assetPath of allAssetPaths) {
    const served = Buffer.from(await (await fetch(origin + assetPath)).arrayBuffer())
    const disk = readFileSync(resolve(DIST, assetPath.replace(/^\//, '')))
    assert.deepEqual(served, disk, `served asset differs from exact dist file: ${assetPath}`)
    servedAssets.push(assetRecord(assetPath, served))
  }
  evidence.assets = servedAssets.sort((left, right) => left.path.localeCompare(right.path))
  evidence.assetManifestDigest = createHash('sha256').update(evidence.assets.map((asset) => JSON.stringify(asset)).join('\n')).digest('hex')

  const compactCss = servedAssets.filter((asset) => asset.path.endsWith('.css')).map((asset) => readFileSync(resolve(DIST, asset.path.replace(/^\//, '')), 'utf8')).join('\n').replace(/\s+/g, '')
  if (!compactCss.includes(BASE_MARKER) || !compactCss.includes(IU_MARKER)) {
    throw actionable(`section-width mounted probe found stale production CSS\ncase: source-contract-marker\nfile: dist CSS assets\nexpected: ${JSON.stringify({ BASE_MARKER, IU_MARKER })}\nobserved: base=${compactCss.includes(BASE_MARKER)} iu=${compactCss.includes(IU_MARKER)}\nremedy: rebuild this exact worktree with pnpm build and rerun; do not serve a mixed or stale dist`)
  }

  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: VIEWPORT,
    args: process.getuid?.() === 0 ? ['--no-sandbox'] : [],
  })
  for (const [name, testCase] of Object.entries(fixture.mountedCases)) {
    evidence.themes.push(await runMountedCase({ browser, origin, name, testCase, geometry: fixture.geometry, sourceMarker: BASE_MARKER }))
  }
  writeFileSync(resolve(EVIDENCE_DIR, 'section-width-provenance.json'), JSON.stringify(evidence, null, 2) + '\n')
  console.log(`section-width mounted probe: ${evidence.themes.map((theme) => theme.name).join(', ')} passed`)
  console.log(`provenance: feature=${featureHead} canonical=${canonicalHead} base=${mergeBase} branch=${branch} clean=${clean}`)
  console.log(`asset manifest: ${evidence.assets.length} JS/CSS files sha256=${evidence.assetManifestDigest}`)
  for (const theme of evidence.themes) console.log(`${theme.name}: ${theme.screenshot} SurfaceGate=${theme.surfaceGate.passed}`)
} finally {
  await browser?.close()
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()))
}

async function runMountedCase({ browser, origin, name, testCase, geometry, sourceMarker }) {
  const page = await browser.newPage()
  const errors = []
  page.on('console', (message) => { if (message.type() === 'error' && !/favicon/i.test(message.text())) errors.push(`console: ${message.text()}`) })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  const query = new URLSearchParams({ app: 'graph', fb: 'off', theme: testCase.theme })
  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.goto(`${origin}/?${query}#inuse`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('#inuse.iu .iu-bar')
    await page.waitForSelector('#inuse-stage .iu-subnav')
    await page.waitForSelector('#inuse-stage .iu-screen')
    await page.evaluate((testCase) => {
      const stage = document.querySelector('#inuse-stage')
      if (!stage) throw new Error('mounted in-use stage is missing')
      const parent = document.createElement('div')
      parent.id = testCase.parentSelector.slice(1)
      parent.dataset.testOnly = 'section-width-specimen'
      Object.assign(parent.style, {
        inlineSize: '1280px',
        minInlineSize: `${testCase.parentMinWidth}px`,
        boxSizing: 'border-box',
        display: 'block',
        padding: 'var(--sp-4)',
        background: 'var(--surface-2)',
        borderBottom: 'var(--bd-strong)',
      })
      for (const specimen of [
        { key: 'bare', className: '', title: 'bare semantic section' },
        { key: 'band', className: 'band', title: 'explicit section.band' },
        { key: 'retained', className: 'txn-center', title: 'retained .txn-center host' },
      ]) {
        const section = document.createElement('section')
        section.dataset.sectionWidthSpecimen = specimen.key
        if (specimen.className) section.className = specimen.className
        const label = document.createElement('div')
        label.className = 'label'
        label.textContent = specimen.title
        const body = document.createElement('p')
        body.textContent = specimen.key === 'band' ? 'the explicit container owns its 1040px measure and centered placement' : 'the semantic host remains unconstrained by the base container'
        section.append(label, body)
        parent.append(section)
      }
      stage.prepend(parent)
      stage.scrollTop = 0
    }, testCase)
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(() => new Promise((resolvePaint) => requestAnimationFrame(() => requestAnimationFrame(resolvePaint))))

    const observed = await page.evaluate(({ testCase, geometry }) => {
      const box = (element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }
      }
      const styles = (element) => {
        const style = getComputedStyle(element)
        return {
          maxWidth: style.maxWidth,
          marginLeft: style.marginLeft,
          marginRight: style.marginRight,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
        }
      }
      const parent = document.querySelector(testCase.parentSelector)
      const bare = document.querySelector(testCase.bareSelector)
      const band = document.querySelector(testCase.bandSelector)
      const retained = document.querySelector(testCase.retainedSelector)
      const shell = document.querySelector('#inuse.iu')
      const bar = document.querySelector('#inuse .iu-bar')
      const selectedTabs = [...document.querySelectorAll('#inuse .iu-opt[aria-selected="true"]')]
      const selectedTab = selectedTabs[0]
      const stage = document.querySelector('#inuse-stage')
      const subnav = document.querySelector('#inuse-stage .iu-subnav')
      const activeSubnav = document.querySelector('#inuse-stage .iu-subnav-item.active, #inuse-stage .iu-subnav-item[aria-current="page"]')
      const activeAppBody = document.querySelector('#inuse-stage .iu-screen')
      const parentStyle = getComputedStyle(parent)
      const parentContentWidth = parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight)
      return {
        theme: document.documentElement.dataset.theme || 'dark',
        themeAttribute: document.documentElement.dataset.theme ?? null,
        parent: { ...box(parent), contentWidth: parentContentWidth, clientWidth: parent.clientWidth },
        bare: { ...box(bare), styles: styles(bare), matchesIuGuard: bare.matches('.iu section:not(.band)') },
        band: { ...box(band), styles: styles(band), matchesIuGuard: band.matches('.iu section:not(.band)') },
        retained: { ...box(retained), styles: styles(retained), matchesIuGuard: retained.matches('.iu section:not(.band)') },
        shell: {
          ...box(shell),
          bar: box(bar),
          selectedTabCount: selectedTabs.length,
          selectedTabText: selectedTab?.textContent.trim() ?? '',
          selectedTabControls: selectedTab?.getAttribute('aria-controls') ?? '',
          selectedTabId: selectedTab?.id ?? '',
          stageLabelledBy: stage?.getAttribute('aria-labelledby') ?? '',
          stage: box(stage),
          subnav: box(subnav),
          activeSubnav: box(activeSubnav),
          activeSubnavText: activeSubnav?.textContent.trim() ?? '',
          activeAppBody: box(activeAppBody),
          activeAppTextLength: activeAppBody?.innerText.trim().length ?? 0,
        },
        specimenTextLength: parent.innerText.trim().length,
        expected: geometry,
      }
    }, { testCase, geometry })

    requireCase(observed.theme === testCase.theme, name, 'theme attribute', observed.theme, testCase.theme, 'load the fixture theme through the production URL and verify the mounted root attribute')
    requireCase(observed.parent.width > 1040 && observed.parent.contentWidth > 1040, name, 'wide parent geometry', observed.parent, 'width and content box greater than 1040px', 'increase the test-only parent width without changing production components')
    requireCase(observed.bare.styles.maxWidth === geometry.bareMaxWidth, name, 'bare max-width', observed.bare.styles.maxWidth, geometry.bareMaxWidth, 'remove the global bare-section container and keep the scoped in-use guard')
    requireCase(observed.bare.styles.marginLeft === geometry.bareMarginLeft && observed.bare.styles.marginRight === geometry.bareMarginRight, name, 'bare margins', observed.bare.styles, `${geometry.bareMarginLeft}/${geometry.bareMarginRight}`, 'restore the .iu section:not(.band) margin reset')
    requireCase(observed.bare.styles.paddingLeft === geometry.barePaddingLeft && observed.bare.styles.paddingRight === geometry.barePaddingRight, name, 'bare padding', observed.bare.styles, `${geometry.barePaddingLeft}/${geometry.barePaddingRight}`, 'do not add page-gutter padding to the bare base or host guard')
    requireCase(Math.abs(observed.bare.width - observed.parent.contentWidth) <= 0.5 && observed.bare.matchesIuGuard, name, 'bare used width and selector match', { width: observed.bare.width, parentContentWidth: observed.parent.contentWidth, matchesIuGuard: observed.bare.matchesIuGuard }, 'full parent content width and true .iu section:not(.band) match', 'keep the in-use host guard scoped to unbanded semantic sections')
    requireCase(observed.band.styles.maxWidth === geometry.bandMaxWidth, name, 'section.band max-width', observed.band.styles.maxWidth, geometry.bandMaxWidth, 'restore the explicit base section.band container')
    requireCase(observed.band.styles.paddingLeft === geometry.bandPaddingLeft && observed.band.styles.paddingRight === geometry.bandPaddingRight, name, 'section.band padding', observed.band.styles, `${geometry.bandPaddingLeft}/${geometry.bandPaddingRight}`, 'retain the existing .band padding ownership')
    const marginsEqual = Math.abs(parseFloat(observed.band.styles.marginLeft) - parseFloat(observed.band.styles.marginRight)) <= 0.5
    const marginSum = parseFloat(observed.band.styles.marginLeft) + parseFloat(observed.band.styles.marginRight)
    requireCase(marginsEqual && Math.abs(marginSum - (observed.parent.contentWidth - parseFloat(geometry.bandMaxWidth))) <= 0.5 && !observed.band.matchesIuGuard, name, 'section.band centering and host exemption', { ...observed.band.styles, matchesIuGuard: observed.band.matchesIuGuard }, 'symmetric resolved auto margins filling remaining width and false host-guard match', 'keep section.band centered in base while exempting it from .iu section:not(.band)')
    requireCase(observed.band.height > 0, name, 'section.band used height', observed.band.height, 'greater than zero', 'retain non-empty band content in the mounted specimen')
    requireCase(observed.retained.styles.maxWidth === geometry.retainedMaxWidth && Math.abs(observed.retained.width - observed.parent.contentWidth) <= 0.5, name, 'retained semantic host width', { styles: observed.retained.styles, width: observed.retained.width, parentContentWidth: observed.parent.contentWidth }, `${geometry.retainedMaxWidth} and full parent content width`, 'retain the explicit .txn-center semantic-section neutralizer')
    requireCase(observed.shell.bar.width > 0 && observed.shell.bar.height > 0 && observed.shell.selectedTabCount === 1, name, 'persistent shell chrome and app tab', observed.shell, 'visible .iu-bar and one selected app tab', 'mount the specimen inside the real complete #inuse shell')
    requireCase(observed.shell.selectedTabControls === 'inuse-stage' && observed.shell.stageLabelledBy === observed.shell.selectedTabId, name, 'app tab and stage wiring', { selectedTabControls: observed.shell.selectedTabControls, stageLabelledBy: observed.shell.stageLabelledBy, selectedTabId: observed.shell.selectedTabId }, 'inuse-stage controls labelled by the selected tab', 'use the production InUseShell wiring')
    requireCase(observed.shell.subnav.width > 0 && observed.shell.subnav.height > 0 && observed.shell.activeSubnav.width > 0 && observed.shell.activeSubnavText.length > 0, name, 'active section navigation', { subnav: observed.shell.subnav, activeSubnav: observed.shell.activeSubnav, activeSubnavText: observed.shell.activeSubnavText }, 'non-empty section navigation with a visible active item', 'keep the complete production app navigation mounted')
    requireCase(observed.shell.stage.width > 0 && observed.shell.stage.height > 0 && observed.shell.activeAppBody.width > 0 && observed.shell.activeAppBody.height > 0 && observed.shell.activeAppTextLength > 0 && observed.specimenTextLength > 0, name, 'representative stage and body content', { stage: observed.shell.stage, activeAppBody: observed.shell.activeAppBody, activeAppTextLength: observed.shell.activeAppTextLength, specimenTextLength: observed.specimenTextLength }, 'non-zero production body and specimen content', 'keep the real app body mounted beside the test-only specimen')
    requireCase(errors.length === 0, name, 'browser errors', errors, [], 'fix the production or probe error and rerun; do not accept a blank or partial surface')

    const screenshot = resolve(EVIDENCE_DIR, testCase.screenshot)
    const shell = await page.$('#inuse.iu')
    if (!shell) throw actionable(`section-width mounted probe lost the full shell before capture\ncase: ${name}\nfile: #inuse.iu\nexpected: the complete production shell\nremedy: keep #inuse mounted and rerun`)
    await shell.screenshot({ path: screenshot, captureBeyondViewport: false })
    const gate = new SurfaceGate(page)
    const surfaceGate = await gate.assert(name, screenshot, { sel: '#inuse.iu', where: 'section-width-rendered-probe.mjs' })
    requireCase(errors.length === 0, name, 'browser errors after capture', errors, [], 'fix any page/console error raised during capture and rerun')
    return { name, theme: testCase.theme, sourceMarker, screenshot, geometry: observed, errors, surfaceGate: { passed: true, ...surfaceGate } }
  } finally {
    await page.close()
  }
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

function assetRecord(path, bytes) {
  return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
}

function requireCase(condition, name, observedName, observed, expected, remedy) {
  if (!condition) throw actionable(`section-width mounted contract failed\ncase: ${name}\nfile: dist full-shell specimen\nobserved: ${observedName}=${JSON.stringify(observed)}\nexpected: ${JSON.stringify(expected)}\nremedy: ${remedy}`)
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function actionable(message) {
  return new Error(message)
}
