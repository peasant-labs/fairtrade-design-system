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
      'modules — never cross-import the other sub-barrel.',
    ].join('\n'),
  )
}

console.log(
  `pack-content assertion: all ${targets.size} exports targets present in the tarball; fileCount ${fileCount} (floor ${FLOOR}); per-surface bundle isolation OK.`,
)
