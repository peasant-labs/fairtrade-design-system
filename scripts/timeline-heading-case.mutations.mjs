#!/usr/bin/env node
/* Build two temporary, source-in-memory heading-case mutants and prove the
 * mounted rendered probe rejects each at its declared computed-style check. */

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { build } from 'vite'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CHROME = process.env.CHROME_PATH
const fixture = loadFixture(resolve(HERE, 'testdata/timeline-rendered-probe.yaml'))
const SOURCE_PATHS = [resolve(ROOT, 'src/index.css'), resolve(ROOT, 'src/mockups/inuse/CommonsManage.jsx')]
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
}

if (!CHROME || !existsSync(CHROME)) {
  throw new Error('timeline heading-case mutations failed: what went wrong: CHROME_PATH does not name an existing browser; why: each mutant must run through the mounted rendered probe; where: scripts/timeline-heading-case.mutations.mjs startup; when: browser preflight; what it means: source mutations were not exercised; how to fix: set CHROME_PATH to Chrome or Chromium and rerun the mutation command.')
}

const sourceBefore = new Map(SOURCE_PATHS.map((path) => [path, readFileSync(path)]))
const outputRoot = mkdtempSync(join(tmpdir(), 'fairtrade-heading-case-'))
let server

try {
  for (const mutation of fixture.mutations.cases) {
    const sourcePath = resolve(ROOT, mutation.file)
    assert.ok(SOURCE_PATHS.includes(sourcePath), `${mutation.name}: mutation target is outside the authorized source files`)
    const source = sourceBefore.get(sourcePath)
    const occurrences = source.toString('utf8').split(mutation.find).length - 1
    assert.equal(occurrences, 1, `${mutation.name}: mutation target must occur exactly once in ${mutation.file}`)
    const mutatedSource = source.toString('utf8').replace(mutation.find, mutation.replace)
    const artifactRoot = join(outputRoot, mutation.name.replace(/[^a-z0-9]+/gi, '-'))

    await build({
      root: ROOT,
      configFile: resolve(ROOT, 'vite.config.js'),
      logLevel: 'silent',
      plugins: [inMemorySourcePlugin(new Map([[sourcePath, mutatedSource]]))],
      resolve: { dedupe: ['react', 'react-dom'] },
      build: { outDir: artifactRoot, emptyOutDir: true },
    })

    assertSourceUnchanged(mutation.name, 'after mutant build')
    server = createStaticServer(artifactRoot)
    await listen(server)
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error(`${mutation.name}: mutant static server did not expose a TCP address`)
    const origin = `http://127.0.0.1:${address.port}`
    const probe = await runRenderedProbe(origin, artifactRoot)
    if (probe.status === 0) throw new Error(`${mutation.name}: mounted rendered probe survived the production-point mutation`)
    if (!probe.output.includes(mutation.expectedFailure)) throw new Error(`${mutation.name}: mounted probe failed outside its declared computed-style diagnostic; expected ${JSON.stringify(mutation.expectedFailure)}, received: ${probe.output.trim()}`)
    console.log(`killed: ${mutation.name} (${mutation.expectedFailure})`)
    await close(server)
    server = undefined
    assertSourceUnchanged(mutation.name, 'after mounted mutant probe')
  }
} finally {
  await close(server)
  rmSync(outputRoot, { recursive: true, force: true })
  assertSourceUnchanged('all mutants', 'after cleanup')
}

console.log(`timeline heading-case mutations: ${fixture.mutations.cases.length} isolated production mutations were killed without modifying tracked sources`)

function inMemorySourcePlugin(sources) {
  const normalized = new Map([...sources].map(([path, source]) => [normalize(path), source]))
  return {
    name: 'in-memory-heading-case-mutation',
    enforce: 'pre',
    load(id) {
      return normalized.get(normalize(id.split('?')[0])) ?? null
    },
  }
}

function assertSourceUnchanged(label, phase) {
  for (const path of SOURCE_PATHS) {
    const before = sourceBefore.get(path)
    const after = readFileSync(path)
    assert.deepEqual(after, before, `timeline heading-case mutations changed tracked source ${relative(ROOT, path)} ${phase}; this indicates the in-memory build escaped its sandbox`)
  }
}

function runRenderedProbe(origin, distRoot) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [resolve(HERE, 'timeline-rendered-probe.mjs')], {
      cwd: ROOT,
      env: {
        ...process.env,
        CHROME_PATH: CHROME,
        TIMELINE_PROBE_CASE: 'desktop dark theme with reduced motion',
        TIMELINE_PROBE_ORIGIN: origin,
        TIMELINE_PROBE_DIST_ROOT: distRoot,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk.toString() })
    child.stderr.on('data', (chunk) => { output += chunk.toString() })
    child.once('error', reject)
    child.once('close', (status, signal) => resolveResult({ status: status ?? 1, signal, output }))
  })
}

function createStaticServer(root) {
  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
      let pathname = decodeURIComponent(requestUrl.pathname)
      if (pathname === '/') pathname = '/index.html'
      const file = resolve(root, `.${pathname}`)
      if (!file.startsWith(`${root}${sep}`)) { response.writeHead(403); response.end('forbidden'); return }
      const content = await readFile(file)
      response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
      response.end(content)
    } catch (error) {
      if (error?.code === 'ENOENT') { response.writeHead(404); response.end('not found'); return }
      console.error(`mutant static server failed for ${request.url}: ${error instanceof Error ? error.stack : String(error)}`)
      response.writeHead(500)
      response.end('server error')
    }
  })
}

function listen(value) {
  return new Promise((resolveListen) => value.listen(0, '127.0.0.1', resolveListen))
}

function close(value) {
  if (!value) return Promise.resolve()
  return new Promise((resolveClose, rejectClose) => value.close((error) => error ? rejectClose(error) : resolveClose()))
}

function loadFixture(path) {
  const source = readFileSync(path, 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length || (source.match(/^---\s*$/gm) ?? []).length > 0) throw new Error('timeline heading-case mutation fixture must be one strict YAML document with unique keys')
  const value = document.toJS()
  assert.ok(value?.mutations, 'timeline heading-case mutation fixture is missing its mutation inventory')
  assert.equal(value.mutations.expectedMutationCount, value.mutations.cases.length, 'timeline heading-case mutation count does not match its cases')
  assert.deepEqual(Object.keys(value.mutations.cases[0] ?? {}).sort(), ['expectedFailure', 'file', 'find', 'name', 'replace'], 'timeline heading-case mutation fields changed')
  const names = value.mutations.cases.map((mutation) => mutation.name)
  assert.deepEqual(names, value.mutations.requiredMutationNames, 'timeline heading-case mutation required names do not match the inventory')
  return value
}
