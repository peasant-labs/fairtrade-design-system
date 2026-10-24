#!/usr/bin/env node
/* Gate for the one number format (src/ui/format.js): every formatter case from the fixture, the
   mounted usage panels and turn badge showing formatted figures and never recorded float noise, and
   a source guard that keeps hand-made number formatting out of shipped components.
   Cases: scripts/testdata/number-format.yaml (+ .manifest.yaml).
   Run: pnpm test:number-format; mutations: pnpm test:number-format:mutations. */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { loadFixturePair, assertExactNames, withMountedSource, createReport, ROOT } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/number-format.yaml'
const MANIFEST = 'scripts/testdata/number-format.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, { formatterCases: 'requiredFormatterNames', mountedCases: 'requiredMountedNames' })
assertExactNames(fixture.sourceGuard.allowed.map((entry) => entry.file), manifest.requiredAllowedFiles, `${FIXTURE} allowed files`)
const report = createReport('number format')
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()

/* the shipped source files under a root, without stories, tests and type tests */
function shippedFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...shippedFiles(path))
    else if (/\.(js|jsx)$/.test(name) && !fixture.sourceGuard.skip.some((suffix) => name.endsWith(suffix))) out.push(path)
  }
  return out
}

await withMountedSource(async ({ load, mount, React }) => {
  const format = await load('/src/ui/format.js')
  const barrel = await load('/src/ui/index.js')
  for (const name of ['formatCount', 'formatInteger', 'formatCost', 'formatDecimal']) {
    report.check(barrel[name] === format[name], `${name} must be exported from the ui barrel`)
  }

  for (const row of fixture.formatterCases) {
    const fn = format[row.fn]
    const received = row.places === undefined ? fn(row.input) : fn(row.input, row.places)
    report.check(received === row.expected, `${row.name}: ${row.fn}(${JSON.stringify(row.input)}) must read ${JSON.stringify(row.expected)}, received ${JSON.stringify(received)}`)
  }

  const { default: UsageDisclosure, UsageScopes } = await load('/src/ui/transcript/UsageDisclosure.jsx')
  const { default: TurnCard } = await load('/src/ui/transcript/TurnCard.jsx')
  for (const row of fixture.mountedCases) {
    let element
    if (row.kind === 'usage') element = React.createElement(UsageDisclosure, { usage: row.usage })
    else if (row.kind === 'scopes') element = React.createElement(UsageScopes, { scopes: row.scopes })
    else if (row.kind === 'turn-tokens') element = React.createElement(TurnCard, { turn: { index: 1, role: 'assistant', label: '1', content: 'counted', depth: 0, toolCalls: [], annotations: [], tokens: row.tokens } })
    else throw new Error(`${FIXTURE}: unknown mounted kind ${row.kind}`)
    const mounted = await mount(element)
    const shown = text(mounted.container)
    for (const figure of row.shows) report.check(shown.includes(figure), `${row.name}: must show ${JSON.stringify(figure)}, received ${JSON.stringify(shown)}`)
    for (const noise of row.hides) report.check(!shown.includes(noise), `${row.name}: must not show ${JSON.stringify(noise)}`)
    await mounted.unmount()
  }
})

const allowed = new Set(fixture.sourceGuard.allowed.map((entry) => entry.file))
for (const root of fixture.sourceGuard.roots) {
  for (const path of shippedFiles(join(ROOT, root))) {
    const file = relative(ROOT, path)
    if (allowed.has(file)) continue
    const source = readFileSync(path, 'utf8')
    for (const pattern of fixture.sourceGuard.patterns) {
      report.check(!source.includes(pattern), `${file} formats a number by hand (${pattern}); use the one number format in src/ui/format.js`)
    }
  }
}

report.finish(`${fixture.formatterCases.length} formatter cases, ${fixture.mountedCases.length} mounted cases and the source guard over ${fixture.sourceGuard.roots.join(', ')}.`)
