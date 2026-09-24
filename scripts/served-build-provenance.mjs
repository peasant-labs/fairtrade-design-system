#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

export function observeServedJavaScript(page, origin) {
  const expectedOrigin = new URL(origin).origin
  const paths = new Set()
  const foreignOrigins = new Set()
  const onRequest = (request) => {
    const url = new URL(request.url())
    if (!url.pathname.endsWith('.js')) return
    if (url.origin !== expectedOrigin) foreignOrigins.add(url.origin)
    else paths.add(url.pathname)
  }
  page.on('request', onRequest)
  return {
    paths,
    foreignOrigins,
    stop: () => page.off('request', onRequest),
  }
}

export async function assertServedBuildProvenance({ mode = 'feature', origin, distRoot, page, observedJavaScriptPaths, observedForeignOrigins, marker, base, expectedBranch, sourceRoot = process.env.BREADCRUMB_SOURCE_ROOT || process.cwd(), allowDirty = false }) {
  if (!origin) throw provenanceError('missing served origin', 'where: scripts/served-build-provenance.mjs startup; when: provenance preflight; what it means: served bytes cannot be trusted; how to fix: pass the exact feature or canonical origin.')
  if (mode === 'feature' && !distRoot) throw provenanceError('feature provenance requires distRoot', 'where: scripts/served-build-provenance.mjs feature preflight; when: artifact comparison; what it means: served bytes have no local source of truth; how to fix: pass the exact dist directory.')

  const servedOrigin = new URL(origin).origin
  const indexResponse = await fetch(new URL('/', origin))
  const indexBytes = Buffer.from(await indexResponse.arrayBuffer())
  if (!indexResponse.ok) throw provenanceError(`served index returned ${indexResponse.status}`, 'where: served index; when: provenance preflight; what it means: the route is not serving a complete build; how to fix: rebuild and serve the exact dist before probing.')
  const indexText = indexBytes.toString('utf8')
  const indexAssets = extractJavaScriptPaths(indexText)
  const observed = normalizeObservedPaths(observedJavaScriptPaths, servedOrigin)
  const localRoot = distRoot ? resolve(distRoot) : null
  const expectedLocal = localRoot ? listJavaScriptPaths(localRoot) : []
  const expectedRemote = [...new Set([...indexAssets, ...observed])].sort()
  const expected = mode === 'feature' ? expectedLocal : expectedRemote

  if (observedForeignOrigins?.length) throw provenanceError(`the route requested JavaScript from mixed origins: ${observedForeignOrigins.join(', ')}`, 'where: mounted route; when: mixed-origin check; what it means: the evidence is not isolated to one served origin; how to fix: disable external script injection and rerun against the exact origin.')
  if (mode === 'remote' && expected.length === 0) throw provenanceError('the canonical origin served no JavaScript assets', 'where: remote index and route; when: asset discovery; what it means: the canonical snapshot is empty or unavailable; how to fix: verify the canonical origin is reachable and rerun the remote snapshot.')
  if (mode === 'feature' && expected.length === 0) throw provenanceError('the exact dist contains no JavaScript assets', 'where: dist; when: expected asset discovery; what it means: there is no build to compare; how to fix: run pnpm build and pass its dist directory.')
  if (mode === 'feature' && !indexAssets.length) throw provenanceError('the served index contains no JavaScript asset', 'where: served index; when: expected asset discovery; what it means: the server may be serving a stale or unrelated document; how to fix: serve the exact dist directory.')
  if (mode === 'feature' && !indexAssets.every((path) => expected.includes(path))) throw provenanceError(`served index references an asset outside exact dist: ${indexAssets.filter((path) => !expected.includes(path)).join(', ')}`, 'where: served index and dist; when: asset-set comparison; what it means: the server and local artifact are mixed; how to fix: rebuild from this worktree and serve that exact dist.')
  if (mode === 'feature' && expected.some((path) => !indexAssets.includes(path))) throw provenanceError(`exact dist contains a JavaScript asset absent from the served index: ${expected.filter((path) => !indexAssets.includes(path)).join(', ')}`, 'where: served index and dist; when: asset-set comparison; what it means: the server omitted a built asset; how to fix: serve the complete dist without filtering assets.')
  if (observed.some((path) => !expected.includes(path))) throw provenanceError(`the route requested JavaScript outside the expected set: ${observed.filter((path) => !expected.includes(path)).join(', ')}`, 'where: mounted route; when: served asset inventory; what it means: the route is mixed or stale; how to fix: rebuild and serve the exact dist, then rerun the mounted journey.')

  const markerAssets = []
  const assetRecords = []
  for (const path of expected) {
    const response = await fetch(new URL(path, origin))
    if (!response.ok) throw provenanceError(`served asset ${path} returned ${response.status}`, 'where: served JavaScript asset; when: byte provenance; what it means: the build is incomplete; how to fix: rebuild and serve the exact dist.')
    if (new URL(response.url).origin !== servedOrigin) throw provenanceError(`asset ${path} redirected to ${response.url}`, 'where: served JavaScript asset; when: mixed-origin check; what it means: the evidence is not from one origin; how to fix: serve the exact origin directly without redirects.')
    const bytes = Buffer.from(await response.arrayBuffer())
    if (mode === 'feature') {
      const diskPath = join(localRoot, path)
      if (!existsSync(diskPath)) throw provenanceError(`served asset ${path} is missing from exact dist`, 'where: dist; when: byte comparison; what it means: the server is serving an extra build; how to fix: rebuild from the exact worktree.')
      const diskBytes = readFileSync(diskPath)
      if (!bytes.equals(diskBytes)) throw provenanceError(`served asset ${path} does not byte-equal exact dist`, 'where: served JavaScript asset and dist; when: byte comparison; what it means: the capture is not from the claimed build; how to fix: stop the stale server, serve exact dist, and rerun the probe.')
    }
    if (marker && bytes.toString('utf8').includes(marker)) markerAssets.push(path)
    assetRecords.push({ path, sha256: sha256(bytes), bytes: bytes.length })
  }

  if (mode === 'feature' && marker && markerAssets.length === 0) throw provenanceError(`the fix marker ${JSON.stringify(marker)} is absent from every served JavaScript asset`, 'where: served JavaScript assets; when: fix provenance; what it means: this is a stale or unrelated build; how to fix: rebuild from the branch containing the fix and rerun the mounted gate.')
  const repo = resolve(sourceRoot)
  const git = readGitState(repo)
  if (expectedBranch && git.branch !== expectedBranch) throw provenanceError(`served build came from branch ${git.branch || 'detached'}, expected ${expectedBranch}`, 'where: repository state; when: stale-worktree check; what it means: the evidence may be from another implementation; how to fix: run the probe from the exact feature worktree.')
  if (!allowDirty && git.dirty) throw provenanceError(`served build source is dirty in ${git.root}`, 'where: repository state; when: final provenance check; what it means: final evidence must name a clean build; how to fix: commit the reviewed source or explicitly use development mode for an intermediate local run.')
  const manifestSha256 = manifestDigest(assetRecords)
  const record = { mode, servedOrigin, indexSha256: sha256(indexBytes), sourceRoot: git.root, base: base ?? git.base, head: git.head, sourceSha: git.head, dirty: git.dirty, marker: marker ?? null, assets: assetRecords, manifestSha256 }
  return record
}

function extractJavaScriptPaths(indexText) {
  return [...new Set([...indexText.matchAll(/(?:src|href)=["']([^"']+\.js(?:\?[^"']*)?)["']/g)].map((match) => new URL(match[1], 'https://provenance.invalid/').pathname))].sort()
}

function normalizeObservedPaths(paths, origin) {
  return [...new Set((paths ?? []).map((path) => new URL(path, origin).pathname))].sort()
}

function listJavaScriptPaths(root) {
  const paths = []
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      const fullPath = join(directory, name)
      if (statSync(fullPath).isDirectory()) visit(fullPath)
      else if (name.endsWith('.js')) {
        const relativePath = relative(root, fullPath).split(sep).join('/')
        if (!relativePath.startsWith('lib/')) paths.push(`/${relativePath}`)
      }
    }
  }
  visit(root)
  return paths.sort()
}

function readGitState(root) {
  const run = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  return { root: run('rev-parse', '--show-toplevel'), branch: run('branch', '--show-current'), head: run('rev-parse', 'HEAD'), base: run('merge-base', 'HEAD', 'HEAD'), dirty: Boolean(run('status', '--porcelain')) }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function manifestDigest(records) {
  const lines = [...records].sort((left, right) => left.path.localeCompare(right.path)).map((record) => `${record.path}\0${record.sha256}`)
  return sha256(Buffer.from(lines.join('\n')))
}

function provenanceError(what, where) {
  return new Error(`served build provenance failed: what went wrong: ${what}; why: exact served bytes and the claimed build must be identical; ${where}; what it means: this evidence cannot support a review capture; how to fix: rebuild and serve the exact clean artifact, then rerun the provenance check.`)
}
