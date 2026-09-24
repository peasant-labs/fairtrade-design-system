#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

export function observeServedBuildAssets(page, origin) {
  const expectedOrigin = new URL(origin).origin
  const paths = new Set()
  const foreignOrigins = new Set()
  const onRequest = (request) => {
    const url = new URL(request.url())
    if (!/\.(?:js|css)$/.test(url.pathname)) return
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

export function assertFeatureGitIdentity({ sourceRoot = process.cwd(), base, expectedHead, expectedBranch }) {
  const root = resolve(sourceRoot)
  if (!base) throw provenanceError('feature provenance requires an explicit base commit', 'where: scripts/served-build-provenance.mjs feature preflight; when: git identity validation; what it means: the claimed review base cannot be verified; how to fix: pass the exact reviewed base SHA.')
  if (!expectedHead) throw provenanceError('feature provenance requires an explicit expectedHead commit', 'where: scripts/served-build-provenance.mjs feature preflight; when: git identity validation; what it means: the claimed reviewed head cannot be verified; how to fix: pass the exact expected head SHA.')

  const git = readGitState(root)
  const resolvedBase = resolveCommit(root, base, 'base')
  const resolvedExpectedHead = resolveCommit(root, expectedHead, 'expectedHead')
  if (git.head !== resolvedExpectedHead) throw provenanceError(`repository HEAD is ${git.head}, expected ${resolvedExpectedHead}`, 'where: repository state; when: exact-head check; what it means: the served build came from a stale or unreviewed commit; how to fix: check out the exact expected head and rerun the evidence gate.')
  const actualMergeBase = runGit(root, 'merge-base', resolvedBase, resolvedExpectedHead)
  if (actualMergeBase !== resolvedBase) throw provenanceError(`claimed base ${resolvedBase} is not the actual merge-base ${actualMergeBase} of base and expectedHead`, 'where: repository history; when: base/head relationship check; what it means: provenance would claim a base that is not the feature range; how to fix: pass the actual merge-base SHA for this exact head.')
  if (expectedBranch !== undefined && git.branch !== expectedBranch) throw provenanceError(`repository branch is ${git.branch || 'detached'}, expected ${expectedBranch}`, 'where: repository state; when: optional branch check; what it means: the evidence may come from another worktree; how to fix: run from the named feature branch or omit the branch only for a detached checkout.')
  if (git.dirty) throw provenanceError(`repository worktree is dirty in ${git.root}`, 'where: repository state; when: final provenance check; what it means: final evidence must name a clean build; how to fix: commit or remove every worktree change, then rerun the evidence gate.')

  return {
    ...git,
    base: resolvedBase,
    expectedHead: resolvedExpectedHead,
    actualMergeBase,
  }
}

export async function assertServedBuildProvenance({ mode = 'feature', origin, distRoot, observedJavaScriptPaths, observedForeignOrigins, marker, base, expectedHead, expectedBranch, sourceRoot = process.env.BREADCRUMB_SOURCE_ROOT || process.cwd(), mutationArtifactManifest } ) {
  if (!origin) throw provenanceError('missing served origin', 'where: scripts/served-build-provenance.mjs startup; when: provenance preflight; what it means: served bytes cannot be trusted; how to fix: pass the exact feature or canonical origin.')
  if (mode === 'feature' && !distRoot) throw provenanceError('feature provenance requires distRoot', 'where: scripts/served-build-provenance.mjs feature preflight; when: artifact comparison; what it means: served bytes have no local source of truth; how to fix: pass the exact dist directory.')
  if (mode !== 'feature' && mode !== 'remote') throw provenanceError(`unsupported provenance mode ${JSON.stringify(mode)}`, 'where: scripts/served-build-provenance.mjs startup; when: mode validation; what it means: the helper cannot select a trustworthy comparison; how to fix: use feature for local dist or remote for an independent canonical snapshot.')

  const featureIdentity = mode === 'feature' ? assertFeatureGitIdentity({ sourceRoot, base, expectedHead, expectedBranch }) : null
  const servedOrigin = new URL(origin).origin
  const indexResponse = await fetch(new URL('/', origin))
  const indexBytes = Buffer.from(await indexResponse.arrayBuffer())
  if (!indexResponse.ok) throw provenanceError(`served index returned ${indexResponse.status}`, 'where: served index; when: provenance preflight; what it means: the route is not serving a complete build; how to fix: rebuild and serve the exact dist before probing.')
  if (new URL(indexResponse.url).origin !== servedOrigin) throw provenanceError(`served index redirected to ${indexResponse.url}`, 'where: served index; when: mixed-origin check; what it means: the evidence is not from one origin; how to fix: serve the exact origin directly without redirects.')

  const indexAssets = extractBuildAssetPaths(indexBytes.toString('utf8'))
  const observed = normalizeObservedPaths(observedJavaScriptPaths, servedOrigin)
  const localRoot = distRoot ? resolve(distRoot) : null
  const expectedLocal = localRoot ? listBuildAssetPaths(localRoot) : []
  const expectedRemote = [...new Set([...indexAssets, ...observed])].sort()
  const expected = mode === 'feature' ? expectedLocal : expectedRemote

  if (observedForeignOrigins?.length) throw provenanceError(`the route requested build assets from mixed origins: ${observedForeignOrigins.join(', ')}`, 'where: mounted route; when: mixed-origin check; what it means: the evidence is not isolated to one served origin; how to fix: disable external script or stylesheet injection and rerun against the exact origin.')
  if (mode === 'remote' && expected.length === 0) throw provenanceError('the canonical origin served no JavaScript or CSS assets', 'where: remote index and route; when: asset discovery; what it means: the canonical snapshot is empty or unavailable; how to fix: verify the canonical origin is reachable and rerun the remote snapshot.')
  if (mode === 'feature' && expected.length === 0) throw provenanceError('the exact dist contains no JavaScript or CSS assets', 'where: dist; when: expected asset discovery; what it means: there is no build to compare; how to fix: run pnpm build and pass its dist directory.')
  if (mode === 'feature' && !indexAssets.length) throw provenanceError('the served index contains no JavaScript or CSS asset', 'where: served index; when: expected asset discovery; what it means: the server may be serving a stale or unrelated document; how to fix: serve the exact dist directory.')
  if (mode === 'feature' && !indexAssets.every((path) => expected.includes(path))) throw provenanceError(`served index references an asset outside exact dist: ${indexAssets.filter((path) => !expected.includes(path)).join(', ')}`, 'where: served index and dist; when: asset-set comparison; what it means: the server and local artifact are mixed; how to fix: rebuild from this worktree and serve that exact dist.')
  if (mode === 'feature' && expected.some((path) => !indexAssets.includes(path))) throw provenanceError(`exact dist contains a build asset absent from the served index: ${expected.filter((path) => !indexAssets.includes(path)).join(', ')}`, 'where: served index and dist; when: asset-set comparison; what it means: the server omitted a built asset; how to fix: serve the complete dist without filtering assets.')
  if (observed.some((path) => !expected.includes(path))) throw provenanceError(`the route requested a build asset outside the expected set: ${observed.filter((path) => !expected.includes(path)).join(', ')}`, 'where: mounted route; when: served asset inventory; what it means: the route is mixed or stale; how to fix: rebuild and serve the exact dist, then rerun the mounted journey.')

  if (mode === 'feature') {
    const diskIndexPath = join(localRoot, 'index.html')
    if (!existsSync(diskIndexPath)) throw provenanceError('exact dist index.html is missing', 'where: dist; when: index byte comparison; what it means: the server cannot be compared to the claimed build; how to fix: run pnpm build and serve the resulting dist directory.')
    if (!indexBytes.equals(readFileSync(diskIndexPath))) throw provenanceError('served index does not byte-equal exact dist/index.html', 'where: served index and dist; when: index byte comparison; what it means: the server is serving a different document; how to fix: stop the stale server, serve exact dist, and rerun the probe.')
  }

  const markerAssets = []
  const assetRecords = []
  for (const path of expected) {
    const response = await fetch(new URL(path, origin))
    if (!response.ok) throw provenanceError(`served build asset ${path} returned ${response.status}`, 'where: served JavaScript or CSS asset; when: byte provenance; what it means: the build is incomplete; how to fix: rebuild and serve the exact dist or canonical origin.')
    if (new URL(response.url).origin !== servedOrigin) throw provenanceError(`build asset ${path} redirected to ${response.url}`, 'where: served JavaScript or CSS asset; when: mixed-origin check; what it means: the evidence is not from one origin; how to fix: serve the exact origin directly without redirects.')
    const bytes = Buffer.from(await response.arrayBuffer())
    if (mode === 'feature') {
      const diskPath = join(localRoot, path.replace(/^\/+/, ''))
      if (!existsSync(diskPath)) throw provenanceError(`served asset ${path} is missing from exact dist`, 'where: dist; when: byte comparison; what it means: the server is serving an extra build; how to fix: rebuild from the exact worktree.')
      if (!bytes.equals(readFileSync(diskPath))) throw provenanceError(`served asset ${path} does not byte-equal exact dist`, 'where: served JavaScript or CSS asset and dist; when: byte comparison; what it means: the capture is not from the claimed build; how to fix: stop the stale server, serve exact dist, and rerun the probe.')
    }
    if (marker && bytes.toString('utf8').includes(marker)) markerAssets.push(path)
    assetRecords.push({ path, sha256: sha256(bytes), bytes: bytes.length })
  }

  if (mode === 'feature' && marker && markerAssets.length === 0) throw provenanceError(`the fix marker ${JSON.stringify(marker)} is absent from every served build asset`, 'where: served JavaScript or CSS assets; when: fix provenance; what it means: this is a stale or unrelated build; how to fix: rebuild from the branch containing the fix and rerun the mounted gate.')
  const manifestSha256 = manifestDigest(assetRecords)
  const mutationArtifact = mutationArtifactManifest ? loadMutationArtifactIdentity(mutationArtifactManifest, localRoot, assetRecords, manifestSha256, featureIdentity) : null
  const record = {
    mode,
    servedOrigin,
    indexSha256: sha256(indexBytes),
    sourceRoot: featureIdentity?.root ?? null,
    base: featureIdentity?.base ?? null,
    expectedHead: featureIdentity?.expectedHead ?? null,
    head: featureIdentity?.head ?? null,
    sourceSha: featureIdentity?.head ?? null,
    actualMergeBase: featureIdentity?.actualMergeBase ?? null,
    branch: featureIdentity?.branch ?? null,
    dirty: featureIdentity?.dirty ?? null,
    marker: marker ?? null,
    assets: assetRecords,
    manifestSha256,
    mutationArtifact,
  }
  return record
}

function extractBuildAssetPaths(indexText) {
  return [...new Set([...indexText.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)].map((match) => new URL(match[1], 'https://provenance.invalid/').pathname))].sort()
}

function normalizeObservedPaths(paths, origin) {
  return [...new Set((paths ?? []).map((path) => new URL(path, origin).pathname))].sort()
}

function listBuildAssetPaths(root) {
  const paths = []
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      const fullPath = join(directory, name)
      if (statSync(fullPath).isDirectory()) visit(fullPath)
      else if (/\.(?:js|css)$/.test(name)) {
        const relativePath = relative(root, fullPath).split(sep).join('/')
        if (!relativePath.startsWith('lib/')) paths.push(`/${relativePath}`)
      }
    }
  }
  visit(root)
  return paths.sort()
}

function readGitState(root) {
  const run = (...args) => runGit(root, ...args)
  return { root: run('rev-parse', '--show-toplevel'), branch: run('branch', '--show-current'), head: run('rev-parse', 'HEAD'), dirty: Boolean(run('status', '--porcelain')) }
}

function runGit(root, ...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    throw provenanceError(`git ${args.join(' ')} failed: ${error instanceof Error ? error.message : String(error)}`, 'where: repository state; when: git identity validation; what it means: the exact source identity cannot be proven; how to fix: run the command from a valid feature worktree with the requested base and head.')
  }
}

function resolveCommit(root, value, label) {
  if (typeof value !== 'string' || !value.trim()) throw provenanceError(`missing ${label} commit`, 'where: repository state; when: git identity validation; what it means: the exact source range cannot be proven; how to fix: pass a non-empty commit SHA for the required identity.')
  try {
    return runGit(root, 'rev-parse', '--verify', `${value}^{commit}`)
  } catch {
    throw provenanceError(`${label} ${JSON.stringify(value)} does not resolve to a commit`, 'where: repository state; when: git identity validation; what it means: the exact source range cannot be proven; how to fix: pass a commit SHA that exists in the feature repository.')
  }
}

function loadMutationArtifactIdentity(path, distRoot, actualAssets, actualManifestSha256, featureIdentity) {
  const manifestPath = resolve(path)
  if (!existsSync(manifestPath)) throw provenanceError(`mutation artifact identity is missing at ${manifestPath}`, 'where: external mutation artifact; when: identity validation; what it means: the mutant cannot be attributed to its source and build; how to fix: keep the generated identity beside the external /tmp artifact and rerun the mutation gate.')
  let identity
  try {
    identity = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    throw provenanceError(`mutation artifact identity is not valid JSON: ${error instanceof Error ? error.message : String(error)}`, 'where: external mutation artifact; when: identity validation; what it means: the mutant cannot be attributed; how to fix: regenerate the identity manifest and rerun the mutation gate.')
  }
  if (resolve(identity.artifact?.root ?? '') !== resolve(distRoot)) throw provenanceError(`mutation artifact root ${identity.artifact?.root} does not match served dist ${distRoot}`, 'where: external mutation artifact; when: identity validation; what it means: the mutation result may have been served from another build; how to fix: rerun the external mutation build and use its matching identity file.')
  if (identity.source?.head !== featureIdentity?.head || resolve(identity.source?.root ?? '') !== resolve(featureIdentity?.root ?? '')) throw provenanceError('mutation source identity does not match the clean feature worktree', 'where: external mutation artifact; when: identity validation; what it means: a mutant was built from a different source state; how to fix: rebuild from the exact clean feature head and rerun the mutation gate.')
  if (identity.artifact?.manifestSha256 !== actualManifestSha256) throw provenanceError(`mutation artifact manifest ${identity.artifact?.manifestSha256} does not match served assets ${actualManifestSha256}`, 'where: external mutation artifact and served assets; when: identity validation; what it means: the recorded mutant does not describe the served bytes; how to fix: keep the artifact identity and served dist together, then rerun.')
  const expectedAssets = (identity.artifact?.assets ?? []).map((record) => `${record.path}\0${record.sha256}\0${record.bytes}`).sort()
  const actualAssetIdentity = actualAssets.map((record) => `${record.path}\0${record.sha256}\0${record.bytes}`).sort()
  if (expectedAssets.join('\n') !== actualAssetIdentity.join('\n')) throw provenanceError('mutation artifact asset inventory does not byte-match the served JavaScript and CSS assets', 'where: external mutation artifact and served assets; when: identity validation; what it means: the recorded mutant does not describe the served bytes; how to fix: regenerate the external artifact manifest after the build and rerun.')
  return identity
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
