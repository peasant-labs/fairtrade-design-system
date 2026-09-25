#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import YAML from 'yaml'
import { SurfaceGate } from './surface-gate.mjs'
import { assertServedBuildProvenance, observeServedBuildAssets } from './served-build-provenance.mjs'
import { resolveFeatureGitIdentity } from './feature-git-identity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const featureIdentity = resolveFeatureGitIdentity({ sourceRoot: ROOT })
const CHROME = process.env.CHROME_PATH
const DIST_ROOT = resolve(process.env.BREADCRUMB_DIST_ROOT || resolve(ROOT, 'dist'))
const SHOT_DIR = process.env.BREADCRUMB_MOUNTED_SHOT_DIR
const fixture = loadFixture(resolve(HERE, 'testdata/breadcrumb.yaml'))
const manifest = loadDocument(resolve(HERE, 'testdata/breadcrumb.manifest.yaml'))
const mutationName = process.env.BREADCRUMB_MUTATION_NAME
const mutation = mutationName ? manifest.mutations.find((candidate) => candidate.name === mutationName) : null
if (mutationName && !mutation) throw mountedFixtureError(`unknown mounted mutation ${JSON.stringify(mutationName)}`, 'where: scripts/breadcrumb-rendered-probe.mjs mutation selection; when: mounted preflight; what it means: the requested mounted mutant cannot be attributed; how to fix: pass one exact mounted mutation name from breadcrumb.manifest.yaml.')
if (mutation && mutation.runner !== 'scripts/breadcrumb-rendered-probe.mjs') throw mountedFixtureError(`${mutation.name} is not a mounted runner`, 'where: scripts/breadcrumb-rendered-probe.mjs mutation selection; when: mounted preflight; what it means: the wrong runner would be credited with the kill; how to fix: use the manifest runner and rerun the mutation gate.')
const mountedCaseIds = selectCaseIds({
  raw: process.env.BREADCRUMB_MOUNTED_CASES,
  required: manifest.execution.mounted,
  selected: mutation ? [mutation.probeCase] : null,
  requireFull: !mutation,
})

if (!CHROME || !existsSync(CHROME)) {
  throw new Error('breadcrumb mounted probe failed: what went wrong: CHROME_PATH does not name an existing browser; why: the exact production route must be exercised; where: scripts/breadcrumb-rendered-probe.mjs startup; when: browser preflight; what it means: dark/light mounted behavior and focus styles are unverified; how to fix: set CHROME_PATH to Chrome or Chromium and rerun pnpm test:breadcrumb-mounted.')
}
if (!existsSync(resolve(DIST_ROOT, 'index.html'))) {
  throw new Error('breadcrumb mounted probe failed: what went wrong: the exact dist index is missing; why: browser evidence must come from a production build; where: dist/index.html; when: artifact preflight; what it means: no mounted build can be verified; how to fix: run pnpm build and pass the resulting dist root.')
}
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true })

const server = createStaticServer(DIST_ROOT)
await listen(server)
const address = server.address()
if (!address || typeof address === 'string') throw new Error('breadcrumb mounted probe failed: what went wrong: the exact static server did not expose a TCP address; why: the exact served origin is required; where: static server startup; when: server preflight; what it means: provenance cannot run; how to fix: rerun after the static server starts successfully.')
const origin = `http://127.0.0.1:${address.port}`

let browser
try {
  for (const caseId of mountedCaseIds) {
    const testCase = fixture.cases.find((candidate) => candidate.name === caseId)
    if (!testCase || testCase.owner !== 'mounted') throw mountedFixtureError(`mounted case ${caseId} is missing or has the wrong owner`, 'where: scripts/breadcrumb-rendered-probe.mjs mounted execution; when: case selection; what it means: the browser path would not exercise the required mounted fixture; how to fix: pass the exact mounted IDs from breadcrumb.manifest.yaml.')
    browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1460, height: 1000, deviceScaleFactor: 1 }, args: typeof process.getuid === 'function' && process.getuid() === 0 ? ['--no-sandbox'] : [] })
    const page = await browser.newPage()
    const errors = []
    const observer = observeServedBuildAssets(page, origin)
    page.on('console', (message) => { if (message.type() === 'error' && !/favicon/.test(message.text())) errors.push(message.text()) })
    page.on('pageerror', (error) => errors.push(error.message))
    try {
      await page.goto(`${origin}/?fb=off${testCase.theme === 'light' ? '&theme=light' : ''}`, { waitUntil: 'networkidle0' })
      await clickText(page, '[role="tab"]', 'village')
      await page.waitForSelector('#inuse-stage .iu-subnav')
      await clickText(page, '#inuse-stage .iu-subnav-item', 'collectives')
      await page.waitForSelector('#inuse-stage .cmg-grid')
      await clickText(page, '#inuse-stage .cmg-col-card', 'AI Research Team')
      await page.waitForSelector('#inuse-stage .cmg-detail')
      observer.stop()

      const provenance = await assertServedBuildProvenance({ mode: 'feature', origin, distRoot: DIST_ROOT, observedJavaScriptPaths: [...observer.paths], observedForeignOrigins: [...observer.foreignOrigins], marker: 'crumb-item-chrome', base: featureIdentity.base, expectedHead: featureIdentity.expectedHead, expectedBranch: featureIdentity.expectedBranch, mutationArtifactManifest: process.env.BREADCRUMB_MUTATION_ARTIFACT_MANIFEST })
      const expected = testCase.expected
      const result = await page.evaluate((expected) => {
        const root = document.querySelector(expected.rootSelector)
        const detail = document.querySelector(expected.detailSelector)
        const breadcrumb = document.querySelector(expected.breadcrumbSelector)
        const current = breadcrumb?.querySelector('.cur')
        const content = current?.querySelector('.crumb-item')
        const chrome = [...(breadcrumb?.querySelectorAll('.crumb-item-chrome') ?? [])]
        const links = [...(breadcrumb?.querySelectorAll('a.link') ?? [])]
        const wrappers = [...(breadcrumb?.querySelectorAll('.crumb > span') ?? [])]
        const separators = wrappers.map((wrapper) => wrapper.querySelector(':scope > svg')).filter(Boolean)
        const box = root?.getBoundingClientRect()
        const stageBox = document.querySelector('#inuse-stage')?.getBoundingClientRect()
        return {
          theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
          shell: Boolean(root?.querySelector('.iu-bar') && root?.querySelector('.iu-stage') && root?.querySelector('.iu-subnav')),
          breadcrumbFound: Boolean(breadcrumb),
          activeSections: [...document.querySelectorAll('#inuse-stage .iu-subnav-item.active')].map((item) => item.textContent.trim()),
          detail: Boolean(detail && detail.querySelector('.cmg-tiles') && detail.querySelector('.cmg-d-grid')),
          shellWidth: box?.width ?? 0,
          shellHeight: box?.height ?? 0,
          stageWidth: stageBox?.width ?? 0,
          stageHeight: stageBox?.height ?? 0,
          breadcrumbLabel: breadcrumb?.getAttribute('aria-label'),
          currentText: current?.textContent,
          currentAria: current?.getAttribute('aria-current'),
          currentTagName: current?.tagName,
          currentClassName: current?.getAttribute('class'),
          currentIsAnchor: current?.matches('a') ?? false,
          currentLinks: current?.querySelectorAll('a').length ?? 0,
          contentTransform: content ? getComputedStyle(content).textTransform : null,
          chromeTransforms: chrome.map((item) => getComputedStyle(item).textTransform),
          links: links.map((link) => ({ href: link.getAttribute('href'), className: link.getAttribute('class'), text: link.textContent })),
          separatorCount: separators.length,
          separatorClasses: separators.map((separator) => separator.getAttribute('class')),
          separatorAria: separators.map((separator) => separator.getAttribute('aria-hidden')),
          separatorPlacement: wrappers.map((wrapper) => Boolean(wrapper.querySelector(':scope > svg'))),
        }
      }, expected)

      assert.equal(result.theme, testCase.theme, `${testCase.name}: data-theme`)
      assert.equal(result.shell, true, `${testCase.name}: complete persistent in-use shell`)
      assert.equal(result.breadcrumbFound, true, `${testCase.name}: public breadcrumb mounts in the detail shell`)
      assert.equal(result.activeSections.includes('collectives'), true, `${testCase.name}: active collectives section`)
      assert.equal(result.detail, true, `${testCase.name}: representative detail body`)
      assert.ok(result.shellWidth > 1000 && result.shellHeight > 500, `${testCase.name}: full shell geometry`)
      assert.ok(result.stageWidth > 1000 && result.stageHeight > 400, `${testCase.name}: stage geometry`)
      assert.equal(result.breadcrumbLabel, expected.breadcrumbLabel, `${testCase.name}: breadcrumb nav label`)
      assert.equal(result.currentText, expected.collectiveTitle, `${testCase.name}: mixed-case current content`)
      assert.equal(result.currentAria, 'page', `${testCase.name}: final aria-current`)
      assert.equal(result.currentTagName, 'SPAN', `${testCase.name}: current element must be a span`)
      assert.equal(result.currentClassName, 'cur', `${testCase.name}: current element must have class cur`)
      assert.equal(result.currentIsAnchor, false, `${testCase.name}: current element must not be an anchor`)
      assert.equal(result.currentLinks, 0, `${testCase.name}: current element must contain no descendant anchors`)
      if (result.contentTransform !== 'none') throw new Error(`${testCase.name}: logical case content-default-case; breadcrumb content computed transform: expected none, observed ${result.contentTransform ?? 'missing'}`)
      assert.deepEqual(result.chromeTransforms, ['lowercase', 'lowercase'], `${testCase.name}: chrome computed transforms`)
      assert.deepEqual(result.links.map((link) => [link.href, link.className]), expected.linkHrefs.map((href) => [href, 'link']), `${testCase.name}: default link forwarding`)
      assert.equal(result.separatorCount, 2, `${testCase.name}: exact n-1 separator count`)
      assert.ok(result.separatorClasses.every((className) => className?.includes('lucide-chevron-right')), `${testCase.name}: real ChevronRight separators`)
      assert.deepEqual(result.separatorAria, ['true', 'true'], `${testCase.name}: separator accessibility`)
      assert.deepEqual(result.separatorPlacement, [true, true, false], `${testCase.name}: separator placement`)

      const focus = await focusBreadcrumb(page)
      assert.equal(focus.isBreadcrumbLink, true, `${testCase.name} (${testCase.theme}): actual Tab reaches breadcrumb link`)
      assert.equal(focus.outlineWidth, '3px', `${testCase.name} (${testCase.theme}): global focus outline width`)
      assert.equal(focus.outlineStyle, 'solid', `${testCase.name} (${testCase.theme}): global focus outline style`)
      assert.equal(focus.textColor, focus.expectedInkColor, `${testCase.name} (${testCase.theme}): focused text color must resolve to --ink; expected ${focus.expectedInkColor}, observed ${focus.textColor}`)
      assert.equal(focus.outlineColor, focus.expectedFocusRingColor, `${testCase.name} (${testCase.theme}): focus outline must resolve to --focus-ring; expected ${focus.expectedFocusRingColor}, observed ${focus.outlineColor}`)
      assert.equal(focus.textDecorationLine, 'underline', `${testCase.name}: link decoration`)
      assert.deepEqual(errors, [], `${testCase.name}: browser console and page errors`)

      if (SHOT_DIR) {
        const shotPath = resolve(SHOT_DIR, `${testCase.theme}.png`)
        const shell = await page.$(expected.rootSelector)
        if (!shell) throw new Error(`${testCase.name}: full shell disappeared before screenshot capture`)
        await shell.screenshot({ path: shotPath, captureBeyondViewport: false })
        await new SurfaceGate(page).assert(testCase.name, shotPath, { sel: expected.rootSelector, where: 'breadcrumb-rendered-probe.mjs' })
      }
      console.log(`${testCase.name}: provenance ${provenance.manifestSha256}; shell and focus checks passed`)
    } finally {
      observer.stop()
      await page.close()
      await browser.close()
      browser = undefined
    }
  }
} finally {
  await browser?.close()
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()))
}

console.log(`breadcrumb mounted execution: ${mountedCaseIds.join(',')}`)
console.log(`breadcrumb mounted: ${mountedCaseIds.length} dark/light full-shell cases passed against exact dist`)

async function clickText(page, selector, text) {
  const clicked = await page.evaluate(({ selector, text }) => {
    const element = [...document.querySelectorAll(selector)].find((candidate) => candidate.textContent.trim() === text || candidate.textContent.includes(text))
    element?.click()
    return Boolean(element)
  }, { selector, text })
  assert.equal(clicked, true, `mounted control path: ${text} (${selector})`)
}

async function focusBreadcrumb(page) {
  await page.focus('#iu-tab-commons')
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const element = document.activeElement
      if (!element?.matches('.cmg-crumb a.link')) return { isBreadcrumbLink: false }
      const style = getComputedStyle(element)
      const resolveToken = (property, variable) => {
        const probe = document.createElement('span')
        probe.style.position = 'fixed'
        probe.style.opacity = '0'
        probe.style[property] = `var(${variable})`
        if (property === 'outlineColor') {
          probe.style.outlineStyle = 'solid'
          probe.style.outlineWidth = '1px'
        }
        document.body.append(probe)
        const value = getComputedStyle(probe)[property]
        probe.remove()
        return value
      }
      return {
        isBreadcrumbLink: true,
        textColor: style.color,
        expectedInkColor: resolveToken('color', '--ink'),
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        outlineColor: style.outlineColor,
        expectedFocusRingColor: resolveToken('outlineColor', '--focus-ring'),
        textDecorationLine: style.textDecorationLine,
      }
    })
    if (focused.isBreadcrumbLink) return focused
  }
  return { isBreadcrumbLink: false }
}

function createStaticServer(root) {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2' }
  return createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent((request.url ?? '/').split('?')[0])
      if (pathname === '/') pathname = '/index.html'
      const file = join(root, normalize(pathname).replace(/^(\.\.[/\\])+/, ''))
      if (!existsSync(file)) { response.writeHead(404); response.end('not found'); return }
      response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' })
      response.end(readFileSync(file))
    } catch {
      response.writeHead(500)
      response.end('server error')
    }
  })
}

function listen(server) {
  return new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
}

function selectCaseIds({ raw, required, selected, requireFull }) {
  if (typeof raw !== 'string' || !raw.trim()) throw mountedFixtureError('explicit mounted case IDs are required', 'where: scripts/breadcrumb-rendered-probe.mjs mounted selection; when: gate startup; what it means: an empty or owner-filtered run could pass without required themes; how to fix: pass the exact comma-separated mounted case IDs.')
  const ids = raw.split(',').map((value) => value.trim())
  if (ids.some((value) => !value)) throw mountedFixtureError(`empty mounted case ID in ${JSON.stringify(raw)}`, 'where: scripts/breadcrumb-rendered-probe.mjs mounted selection; when: gate startup; what it means: the required theme inventory is ambiguous; how to fix: remove empty comma entries and pass exact IDs.')
  if (new Set(ids).size !== ids.length) throw mountedFixtureError(`duplicate mounted case ID in ${ids.join(',')}`, 'where: scripts/breadcrumb-rendered-probe.mjs mounted selection; when: gate startup; what it means: a case could be counted twice while another theme is skipped; how to fix: pass each required mounted case exactly once.')
  for (const id of ids) {
    const testCase = fixture.cases.find((candidate) => candidate.name === id)
    if (!testCase) throw mountedFixtureError(`unknown mounted case ${JSON.stringify(id)}`, 'where: scripts/breadcrumb-rendered-probe.mjs mounted selection; when: gate startup; what it means: the requested evidence case is not in the fixture; how to fix: pass only mounted names from breadcrumb.yaml.')
    if (testCase.owner !== 'mounted') throw mountedFixtureError(`${id} is owned by ${testCase.owner}, not mounted`, 'where: scripts/breadcrumb-rendered-probe.mjs mounted selection; when: gate startup; what it means: the wrong production path would be exercised; how to fix: pass the case to the mounted command.')
  }
  if (selected) assert.deepEqual(ids, selected, 'breadcrumb mounted mutation selection must equal its manifest probeCase')
  else if (requireFull) assert.deepEqual(ids, required, 'breadcrumb mounted execution must equal the complete required inventory')
  return ids
}

function mountedFixtureError(what, where) {
  return new Error(`breadcrumb mounted fixture gate failed: what went wrong: ${what}; why: the named mounted inventory must be explicit and exact; ${where}; what it means: the requested gate cannot prove its contract; how to fix: correct the selection or manifest and rerun.`)
}

function loadFixture(path) {
  const value = loadDocument(path)
  if (!value || typeof value !== 'object' || !Array.isArray(value.cases)) throw new Error(`breadcrumb mounted fixture root must contain a cases array`)
  return value
}

function loadDocument(path) {
  const source = readFileSync(path, 'utf8')
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (documents.length !== 1 || errors.length || (source.match(/^---\s*$/gm) ?? []).length) throw new Error(`breadcrumb mounted fixture ${path} is not one strict unique-key YAML document: ${errors.map((error) => error.message).join('; ')}`)
  const value = documents[0].toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`breadcrumb mounted fixture ${path} root must be an object`)
  return value
}
