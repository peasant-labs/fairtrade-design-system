#!/usr/bin/env node
/* Mounted-source gate for SettingRow and SettingGroup: each row state (idle, pending, settled,
   failed with the previous value restored and the error announced), instant-apply select and
   checkbox, text edit with save, Enter, cancel and Escape (one write per save), the tag, a
   switch and a text write that land and fail under React.StrictMode (whose development double
   effect run must not strand a row at saving), and an open and a collapsed group. Cases:
   scripts/testdata/setting-row.yaml (+ .manifest.yaml).
   Run: pnpm test:setting-row; mutations: pnpm test:setting-row:mutations. */
import { loadFixturePair, withMountedSource, click, keydown, createReport, assertExactNames, assertFields } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/setting-row.yaml'
const MANIFEST = 'scripts/testdata/setting-row.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { rows: 'requiredRowNames', groups: 'requiredGroupNames' })
const report = createReport('setting row')
const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim() ?? ''

await withMountedSource(async ({ load, mount, window, React }) => {
  const { SettingRow, SettingGroup, SETTING_ROW_STATES } = await load('/src/ui/index.js')
  // every exported row state has a word, and a case reads every word
  assertExactNames(Object.keys(fixture.statusWords), [...SETTING_ROW_STATES], 'setting row: status words against SETTING_ROW_STATES')
  assertExactNames([...new Set(fixture.rows.map((row) => row.expected.status))], Object.values(fixture.statusWords), 'setting row: the statuses the cases read')
  const setInputValue = (input, value) => {
    const proto = input.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
    input.dispatchEvent(new window.Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }

  for (const row of fixture.rows) {
    const writes = []
    const onCommit = (next) => {
      writes.push(next)
      if (row.commit === 'hold') return new Promise(() => {})
      if (row.commit === 'reject') return Promise.reject(new Error(row.error))
      return Promise.resolve()
    }
    // a misspelt key must fail loudly, and a case named for StrictMode must actually run inside it
    assertFields(row, ['name', 'control', 'value', 'steps', 'expected'], `${FIXTURE} row ${row.name}`, ['commit', 'error', 'options', 'tag', 'strictMode'])
    if (row.strictMode !== undefined && row.strictMode !== true) throw new Error(`${FIXTURE}: ${row.name}: strictMode is true or left out`)
    if (row.name.startsWith('strict mode') !== (row.strictMode === true)) throw new Error(`${FIXTURE}: ${row.name}: strictMode: true belongs to the cases named "strict mode, ..." and to no others`)
    const settingRow = React.createElement(SettingRow, { label: 'the setting', help: 'what it does', control: row.control, value: row.value, options: row.options, tag: row.tag, onCommit })
    const mounted = await mount(row.strictMode ? React.createElement(React.StrictMode, null, settingRow) : settingRow)
    const root = mounted.container
    for (const step of row.steps) {
      const [kind, arg] = step.split(/:(.*)/s)
      await mounted.act(() => {
        if (kind === 'toggle') click(window, root.querySelector('button[role="switch"]'))
        else if (kind === 'pick') setInputValue(root.querySelector('select'), arg)
        else if (kind === 'check') click(window, root.querySelector('input[type="checkbox"]'))
        else if (kind === 'edit') click(window, root.querySelector('.srow-edit'))
        else if (kind === 'type') setInputValue(root.querySelector('.srow-input'), arg)
        else if (kind === 'enter') keydown(window, root.querySelector('.srow-input'), 'Enter')
        else if (kind === 'escape') keydown(window, root.querySelector('.srow-input'), 'Escape')
        else if (kind === 'save') click(window, root.querySelector('.srow-save'))
        else if (kind === 'cancel') click(window, root.querySelector('.srow-cancel'))
        else throw new Error(`${FIXTURE}: unknown step ${JSON.stringify(step)}`)
      })
      await mounted.settle(5)
    }
    const expected = row.expected
    let value
    if (row.control === 'switch') value = root.querySelector('button[role="switch"]').getAttribute('aria-checked') === 'true'
    else if (row.control === 'select') value = root.querySelector('select').value
    else if (row.control === 'checkbox') value = root.querySelector('input[type="checkbox"]').checked
    else value = text(root.querySelector('.srow-text-value'))
    report.check(value === expected.value, `${row.name}: value expected ${JSON.stringify(expected.value)}, received ${JSON.stringify(value)}`)
    const status = text(root.querySelector('.srow-status')) || 'idle'
    report.check(status === expected.status, `${row.name}: status expected ${JSON.stringify(expected.status)}, received ${JSON.stringify(status)}`)
    report.check(root.querySelector('.srow-status')?.getAttribute('aria-live') === 'polite', `${row.name}: the status is a polite live region`)
    const alert = text(root.querySelector('[role="alert"]'))
    report.check(alert === (expected.alert ?? ''), `${row.name}: alert expected ${JSON.stringify(expected.alert ?? '')}, received ${JSON.stringify(alert)}`)
    report.check(JSON.stringify(writes) === JSON.stringify(expected.writes), `${row.name}: writes expected ${JSON.stringify(expected.writes)}, received ${JSON.stringify(writes)}`)
    if (expected.tag) report.check(text(root.querySelector('.srow-tag')) === expected.tag, `${row.name}: the tag must read ${JSON.stringify(expected.tag)}`)
    else report.check(!root.querySelector('.srow-tag'), `${row.name}: no tag renders`)
    await mounted.unmount()
  }

  for (const group of fixture.groups) {
    const rows = Array.from({ length: group.rows }, (_, index) => React.createElement('div', { key: index, className: 'srow' }, `row ${index}`))
    const mounted = await mount(React.createElement(SettingGroup, { label: 'village', defaultOpen: group.defaultOpen }, rows))
    const details = mounted.container.querySelector('details.srow-group')
    report.check(!!details && details.open === group.expected.open, `${group.name}: the group must start ${group.expected.open ? 'open' : 'collapsed'}`)
    report.check(text(details?.querySelector('summary')) === group.expected.summary, `${group.name}: summary expected ${JSON.stringify(group.expected.summary)}, received ${JSON.stringify(text(details?.querySelector('summary')))}`)
    await mounted.unmount()
  }
})

report.finish(`${fixture.rows.length} rows and ${fixture.groups.length} groups.`)
