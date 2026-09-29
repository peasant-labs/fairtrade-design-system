#!/usr/bin/env node
/* Mounted-source gate for the publish parts: every PublishStateLabel value through PublishBar
   (words, icon, the one action), every PublishDialog state (heading, primary button and whether it
   is enabled, re-scan, the lines and alerts a user reads), the update popup's derived action, and
   the AccessList's named remove buttons.
   Cases: scripts/testdata/publish-states.yaml (+ .manifest.yaml).
   Run: pnpm test:publish-states; mutations: pnpm test:publish-states:mutations. */
import { loadFixturePair, withMountedSource, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/publish-states.yaml'
const MANIFEST = 'scripts/testdata/publish-states.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { labels: 'requiredLabelNames', popup: 'requiredPopupNames', update: 'requiredUpdateNames' })
const report = createReport('publish states')
const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim()
const noop = () => {}

await withMountedSource(async ({ load, mount, window, React }) => {
  const ui = await load('/src/ui/index.js')
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } })

  for (const row of fixture.labels) {
    const mounted = await mount(React.createElement(ui.PublishBar, { state: row.state, ...row.props, onAction: noop }))
    const label = mounted.container.querySelector('.pub-state')
    report.check(text(label) === row.text, `${row.name}: the label must read ${JSON.stringify(row.text)}, received ${JSON.stringify(text(label))}`)
    report.check(!!label?.querySelector(`.${row.icon}`), `${row.name}: the label must lead with ${row.icon}`)
    const action = mounted.container.querySelector('.pub-bar-action')
    report.check(text(action) === row.action, `${row.name}: the bar's action must be ${JSON.stringify(row.action)}, received ${JSON.stringify(text(action))}`)
    report.check((action?.getAttribute('aria-busy') === 'true') === Boolean(row.busy), `${row.name}: the action's busy state must be ${Boolean(row.busy)}`)
    report.check(!!mounted.container.querySelector('.pub-bar [role="status"] .pub-state'), `${row.name}: the label sits in the bar's status region`)
    await mounted.unmount()
  }

  const base = (overrides) => ({
    open: true,
    onClose: noop,
    title: fixture.session,
    scan: fixture.scan,
    onRescan: noop,
    access: fixture.access,
    onRemove: noop,
    picker: { suggestions: [], onAdd: noop },
    autoPublish: { checked: false, onChange: noop },
    onPublish: noop,
    onConnect: noop,
    joinHref: 'https://village.peasantlabs.org/collectives',
    stoppedAt: 'setting who can read it',
    onRetry: noop,
    done: fixture.done,
    ...overrides,
  })

  for (const row of fixture.popup) {
    const props = base({ state: row.state, ...(row.access ? { access: row.access } : {}), ...(row.pending ? { done: { ...fixture.done, pending: row.pending } } : {}) })
    const mounted = await mount(React.createElement(ui.PublishDialog, props))
    const dialog = mounted.container.querySelector('[role="dialog"]')
    report.check(!!dialog && dialog.classList.contains('dialog-wide'), `${row.name}: the popup is the wide dialog`)
    const heading = text(dialog?.querySelector('.dlg-head h3'))
    report.check(heading === row.heading, `${row.name}: heading expected ${JSON.stringify(row.heading)}, received ${JSON.stringify(heading)}`)
    const buttons = [...(dialog?.querySelectorAll('.dlg-foot button') ?? [])]
    const primary = buttons.find((button) => button.classList.contains('btn-primary'))
    if (row.primary === null) {
      report.check(!primary, `${row.name}: no primary button renders`)
    } else {
      report.check(text(primary) === row.primary.label, `${row.name}: primary expected ${JSON.stringify(row.primary.label)}, received ${JSON.stringify(text(primary))}`)
      report.check(!!primary && primary.disabled === !row.primary.enabled, `${row.name}: the primary button must be ${row.primary.enabled ? 'enabled' : 'disabled'}`)
    }
    const rescan = dialog?.querySelector('.pub-rescan')
    if (row.rescan === null) report.check(!rescan, `${row.name}: no re-scan button renders`)
    else report.check(!!rescan && rescan.disabled === !row.rescan.enabled, `${row.name}: re-scan must be ${row.rescan.enabled ? 'enabled' : 'disabled'}`)
    const body = text(dialog)
    for (const line of row.lines) report.check(body?.includes(line), `${row.name}: the popup must read ${JSON.stringify(line)}`)
    if (row.alert) report.check(text(dialog?.querySelector('[role="alert"]'))?.includes(row.alert), `${row.name}: an alert must read ${JSON.stringify(row.alert)}`)
    const removes = [...(dialog?.querySelectorAll('.pub-access-remove') ?? [])].map((button) => button.getAttribute('aria-label'))
    const named = (row.access ?? fixture.access).map((item) => `remove ${item.name}`)
    if (removes.length) report.check(JSON.stringify(removes) === JSON.stringify(named), `${row.name}: every access row's remove button is named remove <collective>; received ${JSON.stringify(removes)}`)
    await mounted.unmount()
  }

  /* the popup's review is read-only: it states each match and offers no keep/revert, even with a
     toggle handler present. */
  {
    const mounted = await mount(React.createElement(ui.RedactionReview, { readOnly: true, onToggle: noop, matches: fixture.scan.matches, total: 3, availableLevels: ['standard'] }))
    report.check(mounted.container.querySelectorAll('.rdx-card').length === fixture.scan.matches.length, 'a read-only review lists every match')
    report.check(mounted.container.querySelectorAll('.rdx-toggle').length === 0, 'a read-only review has no keep or revert button')
    await mounted.unmount()
    const editable = await mount(React.createElement(ui.RedactionReview, { matches: fixture.scan.matches, total: 3, availableLevels: ['standard'] }))
    report.check(editable.container.querySelectorAll('.rdx-toggle').length === fixture.scan.matches.length, 'the default review keeps its keep/revert buttons')
    await editable.unmount()
  }

  for (const row of fixture.update) {
    const mounted = await mount(React.createElement(ui.PublishDialog, base({ state: 'ready', mode: 'update', access: row.access, onRestore: noop, changes: { summary: '6 new turns since you published · 1 new match, redacted' } })))
    const dialog = mounted.container.querySelector('[role="dialog"]')
    const primary = [...dialog.querySelectorAll('.dlg-foot .btn-primary')][0]
    report.check(text(primary) === row.primary, `${row.name}: primary expected ${JSON.stringify(row.primary)}, received ${JSON.stringify(text(primary))}`)
    for (const line of row.lines) report.check(text(dialog).includes(line), `${row.name}: the popup must read ${JSON.stringify(line)}`)
    for (const item of row.access.filter((entry) => entry.pending === 'removal')) {
      report.check(!!dialog.querySelector(`button[aria-label="keep ${item.name}"]`), `${row.name}: a row pending removal offers keep ${item.name}`)
    }
    await mounted.unmount()
  }
})

report.finish(`${fixture.labels.length} label values, ${fixture.popup.length} popup states and ${fixture.update.length} update cases.`)
