import { loadFixturePair, withMountedSource, createReport, click, keydown } from './mounted-parts.mjs'

const { fixture } = loadFixturePair('scripts/testdata/publish-focus.yaml', 'scripts/testdata/publish-focus.manifest.yaml', { cases: 'requiredCaseNames', menu: 'requiredMenuNames' })
const report = createReport('publish keyboard focus')
await withMountedSource(async ({ load, mount, React, window }) => {
  const { PublishDialog } = await load('/src/ui/Publish.jsx')
  const { default: Menu } = await load('/src/ui/Menu.jsx')
  for (const row of fixture.cases) {
    const opener = window.document.createElement('button')
    window.document.body.appendChild(opener)
    opener.focus()
    const props = {
      open: true, onClose() {}, title: 'Recorded Session', scan: { matches: [] },
      access: [{ id: 'readers', name: 'Readers' }], onRemove() {},
      autoPublish: { checked: true, onChange() {} },
      done: { url: 'https://village.invalid/transcripts/test', collectives: ['Readers'] },
    }
    const mounted = await mount(React.createElement(PublishDialog, { ...props, state: 'ready' }))
    await mounted.act(() => mounted.container.querySelector(row.focus).focus())
    await mounted.rerender(React.createElement(PublishDialog, { ...props, state: 'publishing' }))
    const dialog = mounted.container.querySelector('[role="dialog"]')
    report.check(dialog.contains(window.document.activeElement) && !window.document.activeElement.disabled, `${row.name}: publishing must focus an enabled control inside the dialog`)
    await mounted.act(() => opener.focus())
    report.check(dialog.contains(window.document.activeElement), `${row.name}: outside focus is contained by the modal`)
    await mounted.rerender(React.createElement(PublishDialog, { ...props, state: 'done' }))
    report.check(mounted.container.querySelector('.dlg-foot button') === window.document.activeElement, `${row.name}: completion focuses done`)
    await mounted.rerender(React.createElement(PublishDialog, { ...props, open: false, state: 'done' }))
    await mounted.settle()
    report.check(window.document.activeElement === opener, `${row.name}: close returns to the original opener`)
    await mounted.unmount()
    opener.remove()
  }
  for (const row of fixture.menu) {
    // Freeze just the focus handoff, not React, so Escape is delivered in the real race window.
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancel = globalThis.cancelAnimationFrame
    const callbacks = new Map()
    let next = 0
    globalThis.requestAnimationFrame = (callback) => { callbacks.set(++next, callback); return next }
    globalThis.cancelAnimationFrame = (handle) => callbacks.delete(handle)
    try {
      const mounted = await mount(React.createElement(Menu, { label: 'actions', items: [{ label: 'copy link' }] }))
      const trigger = mounted.container.querySelector('.menu-trigger')
      await mounted.act(() => {
        trigger.focus()
        row.key ? keydown(window, trigger, row.key) : click(window, trigger)
      })
      report.check(trigger.getAttribute('aria-expanded') === 'true', `${row.name}: menu opened before the handoff`)
      await mounted.act(() => keydown(window, trigger, 'Escape'))
      report.check(trigger.getAttribute('aria-expanded') === 'false', `${row.name}: Escape closes the opening menu`)
      await mounted.act(() => { for (const callback of callbacks.values()) callback(0) })
      report.check(window.document.activeElement === trigger, `${row.name}: stale handoff cannot steal returned focus`)
      await mounted.unmount()
    } finally {
      globalThis.requestAnimationFrame = originalRaf
      globalThis.cancelAnimationFrame = originalCancel
    }
  }
})
report.finish('publish handoffs and the menu open-focus race')
