#!/usr/bin/env node
/* Cases and mutation for the breakpoint-scale guard. Data: scripts/testdata/breakpoints.yaml
   (+ .manifest.yaml).
     - cases feed synthetic @media preludes through lintViewportQuery, the same code the build runs;
     - the mutation plants a named break in the REAL bytes of a source sheet and runs the guard the
       build runs: the guard must fail and its report must contain the mutation's expectedDiagnostic,
       so it failed for the intended reason. The unmutated sheets must pass first.
   Runs in build:lib, after the source sheets are final.
   Run: node scripts/breakpoint-scale.test.mjs */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadStrictYaml, assertExactNames } from './css-source.mjs'
import { lintViewportQuery, loadScale, runBreakpointGuard, sourceSheets } from './breakpoint-scale.mjs'

const spec = loadStrictYaml('scripts/testdata/breakpoints.yaml')
const manifest = loadStrictYaml('scripts/testdata/breakpoints.manifest.yaml')
let failed = 0
const check = (name, fn) => {
  try {
    fn()
    console.log('PASS', name)
  } catch (e) {
    console.error('FAIL', name, '-', e.message)
    failed++
  }
}

assertExactNames(spec.cases.map((c) => c.name), manifest.requiredCaseNames, 'breakpoints cases')
assertExactNames(manifest.mutations.map((m) => m.name), manifest.requiredMutationNames, 'breakpoints mutations')

const scale = loadScale()
for (const c of spec.cases) {
  check(`case: ${c.name}`, () => {
    const actual = lintViewportQuery(c.media, scale).map((v) => v.check)
    if (JSON.stringify(actual) !== JSON.stringify(c.expect)) {
      throw new Error(`${c.name}: expected the checks ${JSON.stringify(c.expect)}, got ${JSON.stringify(actual)}`)
    }
  })
}

// The real sheets pass before any mutation is planted.
const clean = runBreakpointGuard()
check('every viewport query under src/ is on the scale', () => {
  if (clean.report) throw new Error(clean.report)
})

const plant = (text, m) => {
  if (m.append !== undefined) return text + m.append
  if (m.prepend !== undefined) return m.prepend + text
  const n = text.split(m.find).length - 1
  if (n !== 1) throw new Error(`${m.name}: the anchor must occur exactly once in ${m.target}, found ${n}`)
  return text.replace(m.find, m.replace)
}

for (const m of manifest.mutations) {
  check(`mutation killed: ${m.name}`, () => {
    if (!sourceSheets().includes(m.target)) throw new Error(`${m.name}: ${m.target} is not a stylesheet under src/`)
    const { report } = runBreakpointGuard({ [m.target]: plant(readFileSync(join(ROOT, m.target), 'utf8'), m) })
    if (!report) throw new Error(`${m.name}: the guard passed with the mutation planted`)
    if (!report.includes(m.expectedDiagnostic)) {
      throw new Error(`${m.name}: the guard failed for another reason; expected ${JSON.stringify(m.expectedDiagnostic)}, got:\n${report}`)
    }
  })
}

if (failed) {
  console.error(`\nbreakpoint scale: ${failed} check(s) FAILED`)
  process.exit(1)
}
console.log(`\nbreakpoint scale: ${spec.cases.length} case(s), ${manifest.mutations.length} mutation(s) killed, ${sourceSheets().length} sheet(s) scanned.`)
