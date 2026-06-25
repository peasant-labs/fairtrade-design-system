#!/usr/bin/env node
/* pack-content assertion
   Asserts the ACTUAL npm tarball file set — not just on-disk dist — so a
   files[] <-> exports drift (or a dist-less build) cannot ship a package that
   omits a documented export. This is the tarball-level guard against the exact
   failure class that shipped @peasant-labs/fairtrade@0.0.1 with no dist/.

   Wired into build:lib (= the prepack hook), and runnable standalone via
   `pnpm pack:check`. */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

console.log(`pack-content assertion: all ${targets.size} exports targets present in the tarball; fileCount ${fileCount} (floor ${FLOOR}).`)
