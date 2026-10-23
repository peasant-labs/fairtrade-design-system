#!/usr/bin/env node
/* Mounted-source gate for a wrapped CommandBlock: its words and each word's runs (a line breaks at a
   space or after an address's slashes; a lone "|" keeps to the word after it), plain spaces in the
   drawn command, and a copy that takes the exact command. Unwrapped, the command is one text run.
   Cases: scripts/testdata/command-block.yaml (+ .manifest.yaml).
   Run: pnpm test:command-block; mutations: pnpm test:command-block:mutations. */
import { loadFixturePair, withMountedSource, createReport, click } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/command-block.yaml'
const MANIFEST = 'scripts/testdata/command-block.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })
const report = createReport('command block')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

await withMountedSource(async ({ load, mount, window, React }) => {
  const { CommandBlock } = await load('/src/ui/CliOnboard.jsx')
  const copied = []
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { copied.push(text) } } })

  for (const row of fixture.cases) {
    const name = row.name
    copied.length = 0
    const mounted = await mount(React.createElement(CommandBlock, { command: row.command, wrap: true }))
    const words = [...mounted.container.querySelectorAll('.cli-tok')].map((word) => [...word.querySelectorAll('.cli-run')].map((run) => run.textContent))
    report.check(same(words, row.words), `${name}: words must be ${JSON.stringify(row.words)}, received ${JSON.stringify(words)}`)
    const drawn = mounted.container.querySelector('code')?.textContent
    report.check(drawn === `$ ${row.command}`, `${name}: the command must read as written, with plain spaces, received ${JSON.stringify(drawn)}`)
    await mounted.act(() => click(window, mounted.container.querySelector('button.cli-copy')))
    await mounted.settle(5)
    report.check(same(copied, [row.command]), `${name}: copy must take the exact command, received ${JSON.stringify(copied)}`)
    await mounted.unmount()

    const flat = await mount(React.createElement(CommandBlock, { command: row.command }))
    report.check(flat.container.querySelectorAll('.cli-tok').length === 0 && flat.container.querySelector('code')?.textContent === `$ ${row.command}`, `${name}: unwrapped, the command must be one text run`)
    await flat.unmount()
  }
})

report.finish(`${fixture.cases.length} wrapped commands, their words, runs, spaces and copy.`)
