#!/usr/bin/env node
/* Mounted-source gate for LocalOfflineBanner: the message in its role=status region, the command
   chip (mono code, case kept), the copy button (hidden without a clipboard), `try again` and its
   busy state, the `last checked` time outside the live region, and no wifi glyph.
   Cases: scripts/testdata/local-offline-banner.yaml (+ .manifest.yaml).
   Run: pnpm test:local-offline-banner; mutations: pnpm test:local-offline-banner:mutations. */
import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/local-offline-banner.yaml'
const MANIFEST = 'scripts/testdata/local-offline-banner.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames', interactions: 'requiredInteractionNames' })
const report = createReport('local offline banner')
const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim()

await withMountedSource(async ({ load, mount, window, React }) => {
  const { LocalOfflineBanner } = await load('/src/ui/ConnectionState.jsx')
  const { LocalOfflineBanner: barrelExport } = await load('/src/ui/index.js')
  report.check(barrelExport === LocalOfflineBanner, 'LocalOfflineBanner must be exported from the ui barrel')
  const clipboard = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard')
  const setClipboard = (present) => Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: present ? { writeText: async () => {} } : undefined })

  for (const row of fixture.cases) {
    setClipboard(row.clipboard)
    const { onRetry, checkedAt, ...rest } = row.props
    const props = { ...rest, onRetry: onRetry ? () => {} : undefined, checkedAt: checkedAt ? new Date(checkedAt) : undefined }
    const mounted = await mount(React.createElement(LocalOfflineBanner, props))
    const banner = mounted.container.querySelector('section.cx-offline')
    const expected = row.expected
    report.check(!!banner, `${row.name}: the banner must render`)
    const status = banner?.querySelectorAll('[role="status"]') ?? []
    report.check(status.length === 1 && text(status[0]) === fixture.message, `${row.name}: the one role=status region must read the message; received ${JSON.stringify(text(status[0]))}`)
    report.check(!banner?.querySelector('.lucide-wifi-off') && !!banner?.querySelector('.lucide-plug'), `${row.name}: the banner must carry the unplug icon and must carry no wifi glyph`)
    const command = banner?.querySelector('code.cx-cmd-code .cx-cmd-text')
    report.check(text(command) === expected.command, `${row.name}: the command chip must read ${JSON.stringify(expected.command)}, received ${JSON.stringify(text(command))}`)
    const copy = banner?.querySelector('button.cx-copy')
    report.check(!!copy === expected.copy, `${row.name}: the copy button must be ${expected.copy ? 'present' : 'absent'}`)
    const retry = banner?.querySelector('button.cx-offline-retry')
    report.check(expected.retry == null ? !retry : text(retry) === expected.retry, `${row.name}: the retry button must be ${expected.retry == null ? 'absent' : JSON.stringify(expected.retry)}, received ${JSON.stringify(text(retry) ?? null)}`)
    if (retry) report.check((retry.getAttribute('aria-busy') === 'true') === expected.busy, `${row.name}: aria-busy must be ${expected.busy}`)
    const time = banner?.querySelector('.cx-offline-checked time')
    report.check(expected.checked == null ? !time : text(time) === expected.checked, `${row.name}: last checked must read ${JSON.stringify(expected.checked)}, received ${JSON.stringify(text(time) ?? null)}`)
    if (time) {
      report.check(time.classList.contains('tnum'), `${row.name}: the time must use tabular numbers`)
      report.check(!time.closest('[role="status"]'), `${row.name}: the last checked time must sit outside the live region`)
    }
    await mounted.unmount()
  }

  setClipboard(true)
  for (const row of fixture.interactions) {
    let calls = 0
    const mounted = await mount(React.createElement(LocalOfflineBanner, { onRetry: () => { calls += 1 }, retrying: row.retrying }))
    const retry = mounted.container.querySelector('button.cx-offline-retry')
    for (let press = 0; press < row.presses; press += 1) await mounted.act(() => click(window, retry))
    report.check(calls === row.expectedCalls, `${row.name}: expected ${row.expectedCalls} onRetry calls, received ${calls}`)
    await mounted.unmount()
  }
  if (clipboard) Object.defineProperty(window.navigator, 'clipboard', clipboard)
  else delete window.navigator.clipboard
})

report.finish(`${fixture.cases.length} cases and ${fixture.interactions.length} interactions.`)
