import { loadFixturePair, withMountedSource, createReport, click, assertExactNames } from './mounted-parts.mjs'

const { fixture, manifest } = loadFixturePair('scripts/testdata/redaction-labels.yaml', 'scripts/testdata/redaction-labels.manifest.yaml', { categories: 'requiredCategoryNames', unknown: 'requiredUnknownNames', invalidLabels: 'requiredInvalidLabelNames' })
assertExactNames(fixture.exports, manifest.requiredExportNames, 'public category exports')
assertExactNames(fixture.frozen, manifest.requiredFrozenNames, 'frozen category exports')
const report = createReport('redaction labels')
const match = (category) => ({ id: String(category), category, confidence: fixture.confidence, before: 'SensitiveOriginal', after: '<REDACTED>' })
await withMountedSource(async ({ load, mount, React, window }) => {
  const { RedactionReview } = await load('/src/ui/Redaction.jsx')
  const { PublishDialog } = await load('/src/ui/Publish.jsx')
  const { default: DiffView } = await load('/src/ui/DiffView.jsx')
  const diffMatch = (category) => ({ id: String(category), category, confidence: fixture.confidence, original: 'SensitiveOriginal', replacement: '<REDACTED>' })
  for (const row of fixture.categories) {
    const mounted = await mount(React.createElement(RedactionReview, { matches: [match(row.category)], availableLevels: ['standard'] }))
    report.check(mounted.container.querySelector('.rdx-badge-cat')?.textContent === row.label, `${row.name}: canonical label`)
    const lead = mounted.container.querySelector('.rdx-badge-cat')?.parentElement
    report.check(!!lead && !lead.classList.contains('rdx-badge') && lead.textContent === `${row.label},`, `${row.name}: the comma sits against the label`)
    report.check(mounted.container.querySelector('.rdx-badge-conf .term')?.textContent + ' ' + mounted.container.querySelector('.rdx-confidence-value')?.textContent === fixture.confidenceText, `${row.name}: confidence must be labeled`)
    report.check(mounted.container.querySelector('.rdx-badge-conf [role="tooltip"]')?.textContent === fixture.confidenceHelp, `${row.name}: confidence help must define the score`)
    await mounted.unmount()
    const diff = await mount(React.createElement(DiffView, { file: 'config/app.go', variant: 'redaction', matches: [diffMatch(row.category)] }))
    report.check(diff.container.querySelector('.dv-badge-cat')?.textContent === row.label, `${row.name}: the diff view shows the engine label`)
    await diff.unmount()
  }
  const api = await load('/src/ui/index.js')
  assertExactNames(api.AllRedactionCategories, fixture.categories.map((row) => row.category), 'canonical category ids')
  assertExactNames(api.AllRedactionCategoryLabels, fixture.categories.map((row) => row.label), 'canonical category labels')
  for (const row of fixture.categories) {
    report.check(api.RedactionCategory[row.member] === row.category && api.RedactionCategoryLabel[row.labelMember] === row.label, `${row.name}: named bindings`)
    report.check(api.redactionCategoryLabel(api.RedactionCategory[row.member]) === row.label && api.redactionCategoryFromLabel(api.RedactionCategoryLabel[row.labelMember]) === row.category, `${row.name}: public conversion roundtrip`)
  }
  for (const row of fixture.unknown) {
    const matches = [match('secrets'), match(row.category)]
    const review = await mount(React.createElement(RedactionReview, { matches, availableLevels: ['standard'] }))
    report.check(!!review.container.querySelector('[role="alert"]') && !review.container.querySelector('.rdx-card') && !review.container.querySelector('.rdx-summary-safe'), `${row.name}: unknown review must fail closed without original content or trusted labels`)
    await review.unmount()
    const diff = await mount(React.createElement(DiffView, { file: 'config/app.go', variant: 'redaction', matches: [diffMatch('secrets'), diffMatch(row.category)] }))
    report.check(!!diff.container.querySelector('[role="alert"]') && !diff.container.querySelector('.dv-match') && !diff.container.textContent.includes('SensitiveOriginal'), `${row.name}: the diff view must fail closed without original content or labels`)
    await diff.unmount()
    let published = false
    const popup = await mount(React.createElement(PublishDialog, {
      open: true, onClose() {}, title: 'Recorded Session', state: row.state ?? 'ready', scan: { matches },
      access: [{ id: 'c', name: 'Readers' }], onPublish() { published = true }, onRetry() { published = true },
    }))
    const primary = popup.container.querySelector('.dlg-foot .btn-primary')
    report.check(primary?.disabled === true && !!popup.container.querySelector('[role="alert"]') && !popup.container.textContent.includes('all redacted'), `${row.name}: unknown scan must block publishing and trusted summary`)
    await popup.act(() => click(window, primary))
    report.check(!published, `${row.name}: unknown scan cannot invoke publish`)
    await popup.unmount()
  }
})
report.finish('canonical category membership and fail-closed reviews and publishes')
