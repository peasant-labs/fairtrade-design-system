#!/usr/bin/env node
/* Mounted-source gate for the publish parts: every PublishStateLabel value through PublishBar
   (words, icon, the one action), every PublishDialog state (heading, primary button and whether it
   is enabled, re-scan, the lines and alerts a user reads), the update popup's derived action, and
   the AccessList's named remove buttons (and none while publishing), what each button and Escape
   call, a kept match or a missing scan stated instead of an all-clear, and a read-only review that
   follows the host's decisions. The fixture covers exactly the exported state sets.
   Cases: scripts/testdata/publish-states.yaml (+ .manifest.yaml).
   Run: pnpm test:publish-states; mutations: pnpm test:publish-states:mutations. */
import { loadFixturePair, withMountedSource, createReport, assertExactNames, assertFields, click, keydown } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/publish-states.yaml'
const MANIFEST = 'scripts/testdata/publish-states.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { labels: 'requiredLabelNames', popup: 'requiredPopupNames', update: 'requiredUpdateNames', transitions: 'requiredTransitionNames' })
const report = createReport('publish states')
const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim()
const noop = () => {}
const POPUP_FIELDS = ['name', 'state', 'heading', 'primary', 'rescan', 'lines', 'removeButtons', 'steps']
const POPUP_OPTIONAL = ['access', 'pending', 'alert', 'absent', 'kept', 'unscanned', 'matchesOpen', 'mode', 'doneCollectives', 'noRetry', 'matchCount']
for (const row of fixture.popup) assertFields(row, POPUP_FIELDS, `publish states popup row ${row.name}`, POPUP_OPTIONAL)

await withMountedSource(async ({ load, mount, window, React }) => {
  const ui = await load('/src/ui/index.js')
  // the fixture covers exactly the exported state sets, so a new state cannot ship untested
  assertExactNames([...new Set(fixture.labels.map((row) => row.state))], [...ui.PUBLISH_STATES], 'publish states: label states against PUBLISH_STATES')
  assertExactNames([...new Set(fixture.popup.map((row) => row.state))], [...ui.PUBLISH_DIALOG_STATES], 'publish states: popup states against PUBLISH_DIALOG_STATES')
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
    const calls = []
    // a callback records its name and its arguments; a DOM or React event is left out, a payload kept
    const isEvent = (arg) => !!arg && typeof arg === 'object' && (arg instanceof window.Event || 'nativeEvent' in arg)
    const record = (name) => (...args) => { calls.push([name, ...args.filter((arg) => !isEvent(arg))]) }
    const scan = row.unscanned ? undefined : { ...fixture.scan, ...(row.matchCount !== undefined ? { matchCount: row.matchCount } : {}), matches: fixture.scan.matches.map((match) => ({ ...match, kept: (row.kept ?? []).includes(match.id) })) }
    const props = base({
      state: row.state,
      ...(row.mode ? { mode: row.mode } : {}),
      scan,
      onClose: record('onClose'),
      onRescan: record('onRescan'),
      onRemove: record('onRemove'),
      onPublish: record('onPublish'),
      onConnect: record('onConnect'),
      onRetry: row.noRetry ? undefined : record('onRetry'),
      ...(row.access ? { access: row.access } : {}),
      done: { ...fixture.done, ...(row.pending ? { pending: row.pending } : {}), ...(row.doneCollectives ? { collectives: row.doneCollectives } : {}) },
    })
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
      report.check(!!primary && (primary.disabled || primary.getAttribute('aria-disabled') === 'true') === !row.primary.enabled, `${row.name}: the primary button must be ${row.primary.enabled ? 'enabled' : 'disabled'}`)
    }
    const rescan = dialog?.querySelector('.pub-rescan')
    if (row.rescan === null) report.check(!rescan, `${row.name}: no re-scan button renders`)
    else report.check(!!rescan && rescan.disabled === !row.rescan.enabled, `${row.name}: re-scan must be ${row.rescan.enabled ? 'enabled' : 'disabled'}`)
    const body = text(dialog)
    for (const line of row.lines) report.check(body?.includes(line), `${row.name}: the popup must read ${JSON.stringify(line)}`)
    for (const line of row.absent ?? []) report.check(!body?.includes(line), `${row.name}: the popup must not read ${JSON.stringify(line)}`)
    if (row.alert) report.check(text(dialog?.querySelector('[role="alert"]'))?.includes(row.alert), `${row.name}: an alert must read ${JSON.stringify(row.alert)}`)
    if (row.matchesOpen !== undefined) {
      const toggle = dialog?.querySelector('.pub-toggle')
      report.check(toggle?.getAttribute('aria-expanded') === String(row.matchesOpen) && !!dialog?.querySelector('.pub-review') === row.matchesOpen, `${row.name}: the matches must be ${row.matchesOpen ? 'open' : 'closed'}`)
    }
    const removes = [...(dialog?.querySelectorAll('.pub-access-remove') ?? [])].map((button) => button.getAttribute('aria-label'))
    report.check(JSON.stringify(removes) === JSON.stringify(row.removeButtons), `${row.name}: every access row's remove button is named remove <collective>; expected ${JSON.stringify(row.removeButtons)}, received ${JSON.stringify(removes)}`)
    // each step presses one control (by its accessible name or text) or a key, then reads the calls
    for (const step of row.steps) {
      calls.length = 0
      if (step.key) {
        await mounted.act(() => { keydown(window, dialog, step.key) })
      } else {
        const control = [...(dialog?.querySelectorAll('button, a') ?? [])].find((node) => node.getAttribute('aria-label') === step.press || text(node) === step.press)
        report.check(!!control, `${row.name}: a control named ${JSON.stringify(step.press)} must render`)
        if (control) await mounted.act(() => { click(window, control) })
      }
      report.check(JSON.stringify(calls) === JSON.stringify(step.calls), `${row.name}: ${step.press ?? step.key} must call ${JSON.stringify(step.calls)}, received ${JSON.stringify(calls)}`)
    }
    await mounted.unmount()
  }

  for (const row of fixture.transitions) {
    let calls = 0
    const onPublish = () => { calls += 1 }
    const mounted = await mount(React.createElement(ui.PublishDialog, base({ state: 'ready', onPublish })))
    const primary = mounted.container.querySelector('.pub-primary')
    await mounted.act(() => primary.focus())
    await mounted.rerender(React.createElement(ui.PublishDialog, base({ state: 'publishing', onPublish })))
    report.check(window.document.activeElement === primary, `${row.name}: publishing keeps the primary focused`)
    await mounted.act(() => click(window, primary))
    report.check(calls === 0, `${row.name}: publishing ignores a repeated activation`)
    await mounted.rerender(React.createElement(ui.PublishDialog, base({ state: row.result, onPublish })))
    const dialog = mounted.container.querySelector('[role="dialog"]')
    report.check(dialog.contains(window.document.activeElement), `${row.name}: finishing keeps focus inside the popup`)
    report.check(text(window.document.activeElement) === 'done', `${row.name}: finishing focuses done`)
    await mounted.unmount()
  }

  /* the popup's review is read-only: it states each match and offers no keep/revert, even with a
     toggle handler present. */
  {
    const mounted = await mount(React.createElement(ui.RedactionReview, { readOnly: true, onToggle: noop, matches: fixture.scan.matches, total: 3, availableLevels: ['standard'] }))
    report.check(mounted.container.querySelectorAll('.rdx-card').length === fixture.scan.matches.length, 'a read-only review lists every match')
    report.check(mounted.container.querySelectorAll('.rdx-toggle').length === 0, 'a read-only review has no keep or revert button')
    await mounted.unmount()
    // a read-only card shows the host's current decision, not the one it mounted with
    const states = (node) => [...node.querySelectorAll('.rdx-card')].map((card) => card.classList.contains('rdx-card-kept') ? 'kept' : 'redacted')
    const first = fixture.scan.matches.map((match) => ({ ...match, kept: false }))
    const followed = await mount(React.createElement(ui.RedactionReview, { readOnly: true, matches: first, total: 3, availableLevels: ['standard'] }))
    await followed.rerender(React.createElement(ui.RedactionReview, { readOnly: true, matches: first.map((match, i) => ({ ...match, kept: i === 1 })), total: 3, availableLevels: ['standard'] }))
    report.check(JSON.stringify(states(followed.container)) === JSON.stringify(['redacted', 'kept', 'redacted']), `a read-only review follows a changed decision; received ${JSON.stringify(states(followed.container))}`)
    await followed.unmount()
    const editable = await mount(React.createElement(ui.RedactionReview, { matches: fixture.scan.matches, total: 3, availableLevels: ['standard'] }))
    report.check(editable.container.querySelectorAll('.rdx-toggle').length === fixture.scan.matches.length, 'the default review keeps its keep/revert buttons')
    await editable.unmount()
  }

  for (const row of fixture.update) {
    let publishCalls = 0
    const mounted = await mount(React.createElement(ui.PublishDialog, base({ state: row.state ?? 'ready', mode: 'update', access: row.access, onRestore: noop, onPublish: () => { publishCalls++ }, changes: { summary: '6 new turns since you published · 1 new match, redacted' } })))
    const dialog = mounted.container.querySelector('[role="dialog"]')
    const primary = [...dialog.querySelectorAll('.dlg-foot .btn-primary')][0]
    report.check(text(primary) === row.primary, `${row.name}: primary expected ${JSON.stringify(row.primary)}, received ${JSON.stringify(text(primary))}`)
    report.check(primary.disabled === !row.enabled, `${row.name}: update primary must be ${row.enabled ? 'enabled' : 'disabled'}`)
    await mounted.act(() => click(window, primary))
    report.check(publishCalls === row.publishCalls, `${row.name}: update activation must call onPublish ${row.publishCalls} times, received ${publishCalls}`)
    for (const line of row.lines) report.check(text(dialog).includes(line), `${row.name}: the popup must read ${JSON.stringify(line)}`)
    for (const item of row.access.filter((entry) => entry.pending === 'removal')) {
      report.check(!!dialog.querySelector(`button[aria-label="keep ${item.name}"]`), `${row.name}: a row pending removal offers keep ${item.name}`)
    }
    await mounted.unmount()
  }
})

report.finish(`${fixture.labels.length} label values, ${fixture.popup.length} popup states and ${fixture.update.length} update cases.`)
