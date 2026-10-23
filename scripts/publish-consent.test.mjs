import { loadFixturePair, withMountedSource, createReport, click } from './mounted-parts.mjs'

const { fixture } = loadFixturePair('scripts/testdata/publish-consent.yaml', 'scripts/testdata/publish-consent.manifest.yaml')
const report = createReport('publish consent')
await withMountedSource(async ({ load, mount, React, window }) => {
  const { PublishDialog } = await load('/src/ui/Publish.jsx')
  for (const row of fixture.cases) {
    let changed
    const props = {
      open: true, onClose() {}, title: 'Recorded Session', state: 'ready',
      scan: { matches: [] }, access: [{ id: 'c', name: 'Readers' }],
      autoPublish: { checked: row.checked, hint: row.hint ?? undefined, onChange(value) { changed = value } },
    }
    const mounted = await mount(React.createElement(PublishDialog, props))
    report.check(mounted.container.querySelector('.pub-auto .check')?.textContent.trim() === fixture.label, `${row.name}: exact checkbox label`)
    report.check((mounted.container.querySelector('.pub-auto .pub-hint')?.textContent ?? null) === row.expected, `${row.name}: exact consent must read ${JSON.stringify(row.expected)}`)
    const checkbox = mounted.container.querySelector('input[type="checkbox"]')
    await mounted.act(() => click(window, checkbox))
    report.check(changed === !row.checked, `${row.name}: checkbox calls the host with the next state`)
    await mounted.rerender(React.createElement(PublishDialog, { ...props, autoPublish: { ...props.autoPublish, checked: true } }))
    report.check(mounted.container.querySelector('.pub-auto .pub-hint')?.textContent === fixture.checkedSentence, `${row.name}: checking visibly renders canonical consent`)
    await mounted.unmount()
  }
})
report.finish('exact default and host-supplied consent states')
