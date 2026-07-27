#!/usr/bin/env node
/* Build a source-mutated GraphApp in isolation, then prove the actual mounted
 * third-session route rejects the missing return mapping. The fixture owns both
 * the mutation and the route case, so a future routing edit must update its
 * proof deliberately. */

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { build } from 'vite'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const GRAPH_APP_PATH = resolve(ROOT, 'src/mockups/inuse/GraphApp.jsx')
const CHROME = process.env.CHROME_PATH
const fixture = loadFixture(resolve(HERE, 'testdata/timeline-session-route.mutations.yaml'))
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' }

if (!CHROME || !existsSync(CHROME)) {
  throw new Error('timeline session-route mutations failed: what went wrong: CHROME_PATH does not name an existing browser; why: the mounted mutant must run in a real browser; where: scripts/timeline-session-route.mutations.mjs startup; when: browser preflight; what it means: the session return route was not exercised; how to fix: set CHROME_PATH to Chrome or Chromium and rerun the mutation test.')
}

const graphAppSource = readFileSync(GRAPH_APP_PATH, 'utf8')
const outputRoot = mkdtempSync(join(tmpdir(), 'fairtrade-session-route-mutant-'))
let browser
let server

try {
  for (const mutation of fixture.mutations) {
    const occurrences = graphAppSource.split(mutation.find).length - 1
    assert.equal(occurrences, 1, `${mutation.name}: mutation anchor must occur exactly once`)
    await build({
      root: ROOT,
      configFile: resolve(ROOT, 'vite.config.js'),
      logLevel: 'silent',
      plugins: [inMemoryGraphAppMutation(graphAppSource.replace(mutation.find, mutation.replace))],
      resolve: { dedupe: ['react', 'react-dom'] },
      build: { outDir: join(outputRoot, mutation.name.replace(/[^a-z0-9]+/gi, '-')), emptyOutDir: true },
    })

    const artifactRoot = join(outputRoot, mutation.name.replace(/[^a-z0-9]+/gi, '-'))
    server = createStaticServer(artifactRoot)
    await listen(server)
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error(`${mutation.name}: mutant preview server did not expose a TCP address`)

    browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1460, height: 1000, deviceScaleFactor: 1 } })
    const page = await browser.newPage()
    try {
      const routeError = await captureRouteFailure(page, `http://127.0.0.1:${address.port}`, fixture.routeCase)
      assert.match(routeError, new RegExp(escapeRegExp(mutation.expectedFailure)), `${mutation.name}: the mounted route must fail at its declared return assertion`)
    } finally {
      await page.close()
      await browser.close()
      browser = undefined
      await close(server)
      server = undefined
    }
  }

  console.log(`timeline session-route mutations: ${fixture.mutations.length} isolated production source mutation was killed by the mounted return route`)
} finally {
  await browser?.close()
  if (server) await close(server)
  rmSync(outputRoot, { recursive: true, force: true })
}

function inMemoryGraphAppMutation(mutatedSource) {
  const graphAppId = normalize(GRAPH_APP_PATH)
  return {
    name: 'in-memory-graph-app-mutation',
    enforce: 'pre',
    load(id) {
      return normalize(id.split('?')[0]) === graphAppId ? mutatedSource : null
    },
  }
}

async function captureRouteFailure(page, origin, routeCase) {
  try {
    await page.goto(`${origin}/?fb=off&app=graph`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('#inuse-stage .iu-subnav')
    const openedChanges = await page.evaluate(() => {
      const button = [...document.querySelectorAll('#inuse-stage .iu-subnav-item')].find((candidate) => candidate.textContent.trim() === 'changes')
      button?.click()
      return Boolean(button)
    })
    assert.equal(openedChanges, true, 'session return route: changes navigation')
    await page.waitForSelector(`.cg-history-row[data-commit-hash="${routeCase.commitHash}"] .tlp-overflow-toggle`)
    const openedDestination = await page.evaluate(async ({ commitHash, toggleLabel, thirdSessionTitle }) => {
      const row = document.querySelector(`.cg-history-row[data-commit-hash="${CSS.escape(commitHash)}"]`)
      const toggle = row?.querySelector('.tlp-overflow-toggle')
      if (toggle?.getAttribute('aria-label') !== toggleLabel) return false
      toggle.click()
      await new Promise((resolvePaint) => requestAnimationFrame(() => requestAnimationFrame(resolvePaint)))
      const thirdSession = [...(row?.querySelectorAll('.tlp-overflow-item') ?? [])].find((item) => item.textContent.includes(thirdSessionTitle))
      thirdSession?.click()
      await new Promise((resolvePaint) => requestAnimationFrame(() => requestAnimationFrame(resolvePaint)))
      return Boolean(thirdSession)
    }, routeCase)
    assert.equal(openedDestination, true, 'session return route: third session is selectable')
    await page.waitForSelector(routeCase.sessionDestinationSelector)
    assert.equal(await documentSelector(page, routeCase.sessionDestinationSelector), true, 'session return route: session destination mounts')
    assert.equal(await documentSelector(page, routeCase.backSelector), true, 'session destination provides a Changes back control')
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('session return route mutation was not killed')
}

async function documentSelector(page, selector) {
  return page.evaluate((query) => Boolean(document.querySelector(query)), selector)
}

function createStaticServer(root) {
  return createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent((req.url ?? '/').split('?')[0])
      if (pathname === '/') pathname = '/index.html'
      const file = join(root, normalize(pathname).replace(/^(\.\.[/\\])+/, ''))
      if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return }
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(await readFile(file))
    } catch {
      res.writeHead(500)
      res.end('server error')
    }
  })
}

function listen(server) {
  return new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
}

function close(server) {
  return new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()))
}

function loadFixture(path) {
  const source = readFileSync(path, 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) throw new Error('timeline session-route mutations fixture must be one strict YAML document with unique keys')
  const value = document.toJS()
  assert.deepEqual(Object.keys(value ?? {}).sort(), ['expectedMutationCount', 'mutations', 'routeCase'], 'timeline session-route mutations fixture fields')
  assert.equal(value.expectedMutationCount, value.mutations.length, 'timeline session-route mutations expected mutation count')
  assert.equal(value.mutations.length, 1, 'timeline session-route mutations must retain its required source mutation')
  assert.deepEqual(Object.keys(value.routeCase ?? {}).sort(), ['backSelector', 'commitHash', 'sessionDestinationSelector', 'thirdSessionTitle', 'toggleLabel'], 'timeline session-route mutations route case fields')
  for (const field of Object.keys(value.routeCase)) assert.equal(typeof value.routeCase[field], 'string', `timeline session-route mutations route case ${field}`)
  for (const [index, mutation] of value.mutations.entries()) {
    assert.deepEqual(Object.keys(mutation ?? {}).sort(), ['expectedFailure', 'find', 'name', 'replace'], `timeline session-route mutations mutation ${index} fields`)
    for (const field of ['name', 'find', 'replace', 'expectedFailure']) assert.equal(typeof mutation[field], 'string', `timeline session-route mutations mutation ${index} ${field}`)
  }
  return value
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
