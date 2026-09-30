#!/usr/bin/env node
/* Mounted-source gate for the small page parts the local and village pages share. Each family's
   cases live in scripts/testdata/village-parts.yaml (+ .manifest.yaml); the gate mounts the REAL
   component per case and checks what a user meets.
   Run: pnpm test:village-parts; mutations: pnpm test:village-parts:mutations. */
import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/village-parts.yaml'
const MANIFEST = 'scripts/testdata/village-parts.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, {
  statsStrip: 'requiredStatsStripNames',
  copyIconButton: 'requiredCopyIconButtonNames',
  overflowList: 'requiredOverflowListNames',
})
const report = createReport('village parts')
const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim()

await withMountedSource(async ({ load, mount, window, React }) => {
  const ui = await load('/src/ui/index.js')

  for (const row of fixture.statsStrip) {
    const mounted = await mount(React.createElement(ui.StatsStrip, { items: row.items, label: 'summary' }))
    const list = mounted.container.querySelector('ul.sst')
    report.check(!!list === row.expected.rendered, `${row.name}: rendered must be ${row.expected.rendered}`)
    const pairs = [...(list?.querySelectorAll('li.sst-pair') ?? [])].map(text)
    report.check(JSON.stringify(pairs) === JSON.stringify(row.expected.pairs), `${row.name}: pairs expected ${JSON.stringify(row.expected.pairs)}, received ${JSON.stringify(pairs)}`)
    for (const value of list?.querySelectorAll('.sst-value') ?? []) report.check(value.classList.contains('tnum'), `${row.name}: every value uses tabular numbers`)
    if (list) report.check(list.getAttribute('aria-label') === 'summary', `${row.name}: the strip is a named list`)
    await mounted.unmount()
  }

  const URL_VALUE = 'https://village.peasantlabs.org/transcripts/3f9c0a17'
  for (const row of fixture.copyIconButton) {
    const written = []
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: row.clipboard ? { writeText: async (value) => { written.push(value) } } : undefined })
    const mounted = await mount(React.createElement(ui.CopyIconButton, { value: URL_VALUE, label: 'copy link' }))
    const button = mounted.container.querySelector('button.cib')
    report.check(!!button === row.expected.rendered, `${row.name}: rendered must be ${row.expected.rendered}`)
    if (button && row.press) {
      await mounted.act(() => click(window, button))
      await mounted.settle(5)
    }
    if (button) {
      report.check(button.getAttribute('aria-label') === row.expected.name, `${row.name}: the button's name expected ${JSON.stringify(row.expected.name)}, received ${JSON.stringify(button.getAttribute('aria-label'))}`)
      report.check(!text(button), `${row.name}: the button is icon only`)
      const status = mounted.container.querySelector('.cib-status[role="status"]')
      report.check(text(status) === row.expected.status, `${row.name}: the status expected ${JSON.stringify(row.expected.status)}, received ${JSON.stringify(text(status))}`)
    }
    report.check(JSON.stringify(written) === JSON.stringify(row.expected.written), `${row.name}: written expected ${JSON.stringify(row.expected.written)}, received ${JSON.stringify(written)}`)
    await mounted.unmount()
  }

  for (const row of fixture.overflowList) {
    const nodes = row.items.map((item) => React.createElement('a', { href: `#pr-${item.slice(1)}` }, item))
    const mounted = await mount(React.createElement(ui.OverflowList, { items: nodes, limit: 2, label: 'pull requests', noun: ['pull request', 'pull requests'], empty: React.createElement('span', { className: 'ovl-none' }, 'none') }))
    const shown = () => [...mounted.container.querySelectorAll('.ovl-item')].map(text)
    report.check(JSON.stringify(shown()) === JSON.stringify(row.expected.items), `${row.name}: items expected ${JSON.stringify(row.expected.items)}, received ${JSON.stringify(shown())}`)
    const more = mounted.container.querySelector('button.ovl-more')
    if (row.expected.more === null) report.check(!more, `${row.name}: no +N button renders`)
    else {
      report.check(!!more && text(more) === row.expected.more.text && more.getAttribute('aria-label') === row.expected.more.name, `${row.name}: the +N button must read ${JSON.stringify(row.expected.more.text)} and be named ${JSON.stringify(row.expected.more.name)}`)
      if (more) await mounted.act(() => click(window, more))
      report.check(JSON.stringify(shown()) === JSON.stringify(row.expected.more.after), `${row.name}: after +N expected ${JSON.stringify(row.expected.more.after)}, received ${JSON.stringify(shown())}`)
      const focused = window.document.activeElement
      report.check(text(focused) === row.expected.more.focus, `${row.name}: after +N, focus lands on ${JSON.stringify(row.expected.more.focus)}, received ${JSON.stringify(text(focused) ?? focused?.tagName)}`)
    }
    if (row.expected.empty) report.check(text(mounted.container) === row.expected.empty, `${row.name}: no items renders the empty node`)
    await mounted.unmount()
  }
})

report.finish(`${fixture.statsStrip.length} StatsStrip, ${fixture.copyIconButton.length} CopyIconButton and ${fixture.overflowList.length} OverflowList cases.`)
