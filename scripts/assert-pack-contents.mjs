#!/usr/bin/env node
/* pack-content assertion
   Asserts the ACTUAL npm tarball file set — not just on-disk dist — so a
   files[] <-> exports drift (or a dist-less build) cannot ship a package that
   omits a documented export. This is the tarball-level guard against the exact
   failure class that shipped @peasant-labs/fairtrade@0.0.1 with no dist/.

   Wired into build:lib (= the prepack hook), and runnable standalone via
   `pnpm pack:check`. */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SURFACE_BUNDLES, findForeignNamespaces } from './surface-namespaces.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

// fileCount floor: after excluding Storybook .d.ts the healthy tarball is ~67
// files; a dist-less tarball is ~3. 60 sits safely between.
const FLOOR = 60

// Every concrete file the exports map promises (js + css + json + the .d.ts
// "types" targets), normalized to a package-relative path (npm reports paths
// without a leading "./").
const norm = (p) => p.replace(/^\.\//, '')
const targets = new Set()
for (const entry of Object.values(pkg.exports ?? {})) {
  if (typeof entry === 'string') targets.add(norm(entry))
  else for (const v of Object.values(entry)) if (typeof v === 'string') targets.add(norm(v))
}

// Ask npm what it WOULD pack. --ignore-scripts is essential: this script runs at
// the tail of build:lib, which is itself the prepack hook, so a plain `npm pack`
// here would recurse into prepack -> build:lib. --dry-run --json just reports the
// file list for the current on-disk dist, which is exactly what we assert.
let report
try {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  report = JSON.parse(out)[0]
} catch (err) {
  throw new Error(
    `pack-content assertion failed in scripts/assert-pack-contents.mjs: could not run \`npm pack --dry-run --json --ignore-scripts\` in ${ROOT}: ${err?.message ?? err}. Fix: ensure npm is on PATH and package.json parses.`,
  )
}

const packed = new Set((report.files ?? []).map((f) => f.path))
const fileCount = report.entryCount ?? report.files?.length ?? 0

const problems = []
const runtimeReact = ['react', 'react-dom'].filter((name) => Object.hasOwn(pkg.dependencies ?? {}, name))
if (runtimeReact.length) problems.push(`React host packages incorrectly ship as runtime dependencies: ${runtimeReact.join(', ')}`)
for (const name of ['react', 'react-dom']) {
  if (pkg.peerDependencies?.[name] !== '>=19.0.0 <20') problems.push(`${name} peer range must be the supported React 19 contract ">=19.0.0 <20"`)
  if (pkg.devDependencies?.[name] !== '19.2.7') problems.push(`${name} dev dependency must remain exactly pinned to 19.2.7 for reproducible package gates`)
}
const missing = [...targets].filter((t) => !packed.has(t))
if (missing.length) problems.push(`exports targets absent from the packed tarball: ${missing.join(', ')}`)
if (fileCount < FLOOR) {
  problems.push(`packed fileCount ${fileCount} is below the floor ${FLOOR} — dist/lib is likely missing (the 0.0.1 dist-less failure class)`)
}

if (problems.length) {
  throw new Error(
    [
      'pack-content assertion FAILED in scripts/assert-pack-contents.mjs.',
      `What went wrong (the tarball would ship ${fileCount} files):`,
      ...problems.map((p) => `  - ${p}`),
      'Why it matters: every package.json "exports" target must be present in the published tarball; this is the',
      'exact failure class that shipped @peasant-labs/fairtrade@0.0.1 with no dist/.',
      'How to fix: run pnpm build:lib (so dist/lib + dist/lib/types exist) and keep package.json files[] <-> exports in sync.',
    ].join('\n'),
  )
}

// ── Per-surface JS bundle isolation (HYBRID boundary) ─────────────────────────
// Each per-surface JS entry that the tarball ships (graph.js / commons.js) must
// carry ONLY its own surface code — never the OTHER surface family's class-name
// namespaces. A lifted surface emits its prefixed className strings into its
// bundle, so a co-bundling leak (e.g. peasant's ./graph entry pulling in village's
// ./commons surface) would surface the foreign prefix in the wrong bundle. This is
// the JS half of the intra-package isolation guarantee (the CSS half is asserted
// in finalize-lib-build.mjs). Asserted on the packed dist bytes.
const DIST = join(ROOT, 'dist', 'lib')
const isoProblems = []
const initialPositionDeclaration = join(DIST, 'types', 'transcript', 'initial-position.d.ts')
if (!existsSync(initialPositionDeclaration)) {
  isoProblems.push('packed initial-position declaration is missing')
} else if (!/resolveTranscriptInitialPosition[\s\S]*?position:\s*TranscriptInitialPosition \| null;/.test(readFileSync(initialPositionDeclaration, 'utf8'))) {
  isoProblems.push('resolveTranscriptInitialPosition.position must be declared as TranscriptInitialPosition | null')
}
const bundledReactMarkers = [
  'react.development.js',
  'react.production.js',
  '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE',
  '__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE',
]
for (const file of ['ui.js', 'graph.js', 'commons.js', 'analytics.js']) {
  const path = join(DIST, file)
  if (!existsSync(path)) continue
  const text = readFileSync(path, 'utf8')
  const marker = bundledReactMarkers.find((candidate) => text.includes(candidate))
  if (marker) isoProblems.push(`${file} contains bundled React marker ${marker}; React must remain host-owned and external`)
}
// The @xyflow/react optional-peer boundary. The trajectory-graph engine is the
// ONLY code in the package that reaches @xyflow/react, and it ships behind the
// ./graph entry alone. An app importing ./ui (or ./commons, or ./analytics) must
// therefore never be asked to resolve the optional peer — so nothing those entries
// LOAD may name it. ./graph is the one entry allowed to.
//
// Asserted over each entry's TRANSITIVE chunk closure, never the entry file alone.
// Rollup hoists code shared by two entries into a separate chunk, so an entry-only
// check is vacuous: a leak simply lands one hop away in a chunk the entry imports.
const XYFLOW_MARKER = '@xyflow'

/**
 * Every packed chunk an entry loads, including the entry itself, followed transitively.
 * @param {string} entryFile  a file name inside dist/lib (e.g. 'ui.js')
 * @returns {string[]} file names in the closure, in discovery order
 */
function entryChunkClosure(entryFile) {
  const seen = new Set()
  const queue = [entryFile]
  while (queue.length) {
    const name = queue.shift()
    if (seen.has(name)) continue
    const path = join(DIST, name)
    if (!existsSync(path)) continue
    seen.add(name)
    const text = readFileSync(path, 'utf8')
    for (const match of text.matchAll(/from\s*["']\.\/([^"']+\.js)["']/g)) queue.push(match[1])
    for (const match of text.matchAll(/import\s*["']\.\/([^"']+\.js)["']/g)) queue.push(match[1])
  }
  return [...seen]
}

for (const entry of ['ui.js', 'commons.js', 'analytics.js']) {
  if (!existsSync(join(DIST, entry))) continue
  const leaked = entryChunkClosure(entry).filter((name) => readFileSync(join(DIST, name), 'utf8').includes(XYFLOW_MARKER))
  if (leaked.length) {
    isoProblems.push(
      `the ./${entry.replace(/\.js$/, '')} entry loads ${XYFLOW_MARKER} via ${leaked.join(', ')} — only the ./graph entry may, because @xyflow/react is an OPTIONAL peer dependency and a consumer of this entry is not required to install it`,
    )
  }
}
if (existsSync(join(DIST, 'graph.js'))) {
  const carriers = entryChunkClosure('graph.js').filter((name) => readFileSync(join(DIST, name), 'utf8').includes(XYFLOW_MARKER))
  if (carriers.length === 0) {
    isoProblems.push(
      `the ./graph entry does not load ${XYFLOW_MARKER} anywhere in its chunk closure — the trajectory-graph engine did not reach the ./graph bundle, so the boundary check above proves nothing`,
    )
  }
}

for (const { surface, js, forbidden } of SURFACE_BUNDLES) {
  const path = join(DIST, js)
  if (!existsSync(path)) {
    isoProblems.push(`${js} is missing from dist/lib (the per-surface JS entry did not build)`)
    continue
  }
  const text = readFileSync(path, 'utf8')
  const leaked = findForeignNamespaces(text, forbidden)
  if (leaked.length) {
    isoProblems.push(
      `${js} (the ${surface} entry) contains foreign surface namespace(s) ${leaked.join(', ')} — a consumer importing ./${surface} would bundle the other app's surface code`,
    )
  }
}
if (isoProblems.length) {
  throw new Error(
    [
      'pack-content assertion FAILED in scripts/assert-pack-contents.mjs: per-surface JS bundle isolation FAILED.',
      'What went wrong (a per-surface entry co-bundled the OTHER surface family):',
      ...isoProblems.map((p) => `  - ${p}`),
      'Why it matters: the HYBRID package boundary promises an app importing one surface entry (./graph or',
      './commons) never ships the other app\'s surfaces; a leaked namespace breaks that intra-package isolation.',
      'How to fix: keep src/ui/graph/index.js and src/ui/commons/index.js importing ONLY their own surface',
      'modules — never cross-import the other sub-barrel. For an @xyflow leak, keep the trajectory-graph',
      'engine (src/ui/transcript/graph/engine/) reachable ONLY from src/ui/graph/index.js — never from',
      'src/ui/index.js or the transcript sub-barrels.',
    ].join('\n'),
  )
}

console.log(
  `pack-content assertion: all ${targets.size} exports targets present in the tarball; fileCount ${fileCount} (floor ${FLOOR}); per-surface bundle isolation OK.`,
)
