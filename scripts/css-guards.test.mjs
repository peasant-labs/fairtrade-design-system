#!/usr/bin/env node
/* Cases and mutations for the shipped-CSS guards. Data: scripts/testdata/css-guards.yaml
   (+ .manifest.yaml).
     - lint cases feed synthetic CSS through lintCssDecls (scripts/css-token-lint.mjs);
     - isolation cases feed a synthetic components.css through checkLibIsolation;
     - every mutation plants a named break in the REAL bytes (dist/lib after the library
       build, or a source sheet) and runs the same guard the build runs: the guard must
       fail and its report must contain the mutation's expectedDiagnostic, so it failed for
       the intended reason. The unmutated bytes must pass first.
   Runs in build:lib after scripts/finalize-lib-build.mjs (dist/lib must exist).
   Run: node scripts/css-guards.test.mjs */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, assertExactNames } from './css-source.mjs'
import { lintCssDecls, runCssLint } from './css-token-lint.mjs'
import { loadGuardSpec, checkLibIsolation, readEmitted } from './css-guards.mjs'

const { spec, manifest } = loadGuardSpec()
let failed = 0
const check = async (name, fn) => {
  try {
    await fn()
    console.log('PASS', name)
  } catch (e) {
    console.error('FAIL', name, '-', e.message)
    failed++
  }
}
const same = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

assertExactNames(spec.lintCases.map((c) => c.name), manifest.requiredLintCaseNames, 'css-guards lintCases')
assertExactNames(spec.isolationCases.map((c) => c.name), manifest.requiredIsolationCaseNames, 'css-guards isolationCases')
assertExactNames(manifest.mutations.map((m) => m.name), manifest.requiredMutationNames, 'css-guards mutations')

for (const c of spec.lintCases) {
  await check(`lint case: ${c.name}`, () => same(lintCssDecls(c.css, 'case.css').map((v) => v.check), c.expect, c.name))
}

for (const c of spec.isolationCases) {
  await check(`isolation case: ${c.name}`, () => {
    const problems = checkLibIsolation({ 'tokens.css': '', 'base.css': '', 'components.css': c.css }, spec)
    if (problems.length !== c.expect.length || c.expect.some((frag, i) => !problems[i].includes(frag))) {
      throw new Error(`expected ${JSON.stringify(c.expect)}, got ${JSON.stringify(problems)}`)
    }
  })
}

// The real bytes pass before any mutation is planted.
const emitted = readEmitted(spec)
await check('the emitted library is isolated', () => same(checkLibIsolation(emitted, spec), [], 'isolation of dist/lib'))
const clean = await runCssLint()
await check('the source sheets pass the lint and ownership guards', () => same(clean.report, null, 'css lint'))

const plant = (text, m) => {
  if (m.append !== undefined) return text + m.append
  if (m.prepend !== undefined) return m.prepend + text
  const n = text.split(m.find).length - 1
  if (n !== 1) throw new Error(`${m.name}: the anchor must occur exactly once in ${m.target}, found ${n}`)
  return text.replace(m.find, m.replace)
}

for (const m of manifest.mutations) {
  await check(`mutation killed: ${m.name}`, async () => {
    let report
    if (m.guard === 'isolation') {
      const file = m.target.replace(/^dist\/lib\//, '')
      if (!(file in emitted)) throw new Error(`${m.name}: ${m.target} is not an isolation file`)
      report = checkLibIsolation({ ...emitted, [file]: plant(emitted[file], m) }, spec).join('\n')
    } else if (m.guard === 'ownership' || m.guard === 'lint') {
      if (m.allowlistEntry) report = (await runCssLint({}, [m.allowlistEntry])).report
      else report = (await runCssLint({ [m.target]: plant(readFileSync(join(ROOT, m.target), 'utf8'), m) })).report
    } else {
      throw new Error(`${m.name}: unknown guard ${m.guard}`)
    }
    if (!report) throw new Error(`${m.name}: the guard passed with the mutation planted`)
    if (!report.includes(m.expectedDiagnostic)) throw new Error(`${m.name}: the guard failed for another reason; expected ${JSON.stringify(m.expectedDiagnostic)}, got:\n${report}`)
  })
}

if (failed) {
  console.error(`\ncss guards: ${failed} check(s) FAILED`)
  process.exit(1)
}
console.log(`\ncss guards: ${spec.lintCases.length} lint case(s), ${spec.isolationCases.length} isolation case(s), ${manifest.mutations.length} mutation(s) killed`)
