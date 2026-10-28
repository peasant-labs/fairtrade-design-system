#!/usr/bin/env node
/* Mounted-source gate for how the transcript viewer formats what it shows: an edit counts the lines
   its diff adds and removes (a same-length rewrite reads +3 −3), a thinking block counts in words,
   a model change names the models without their provider prefix and draws an arrow, a breadcrumb
   item with an href stays a link even when it is last, a tab without filters has no filters rail,
   and the stylesheet keeps chrome labels on one line, fades the narrow tab strip, wraps a long diff
   line instead of clipping it, and leaves the key hints out on a touch screen. It cooks the REAL
   adapter, mounts the REAL TranscriptViewer and Thinking, and reads the REAL stylesheet through the
   same loader, so a manifest mutation reaches it too.
   Cases: scripts/testdata/transcript-viewer-format.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-viewer-format; mutations: pnpm test:transcript-viewer-format:mutations. */
import { loadFixturePair, withMountedSource, createReport } from './mounted-parts.mjs'
import { walkCss } from './css-source.mjs'

const FIXTURE = 'scripts/testdata/transcript-viewer-format.yaml'
const MANIFEST = 'scripts/testdata/transcript-viewer-format.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })
const report = createReport('transcript viewer format')

const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
// What a sighted reader sees: the text without the screen-reader-only words.
const shown = (node) => {
  const copy = node.cloneNode(true)
  for (const sr of copy.querySelectorAll('.txn-sr')) sr.remove()
  return text(copy)
}

await withMountedSource(async ({ load, mount, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const { default: Thinking } = await load('/src/ui/transcript/Thinking.jsx')
  const vm = adaptTranscript(fixture.payload)
  const viewer = (props) => React.createElement(TranscriptViewer, { viewModel: vm, capabilities: CAPABILITIES, ...props })

  for (const row of fixture.cases) {
    const name = row.name
    if (row.kind === 'diff-counts') {
      const counts = vm.diffs.map((entry) => ({ adds: entry.adds, dels: entry.dels }))
      report.check(same(counts, [{ adds: row.expected.adds, dels: row.expected.dels }]), `${name}: counts must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(counts)}`)
      const taskStat = vm.tasks.find((task) => task.turnIndices?.includes(1))?.stat ?? null
      report.check(taskStat === row.expected.taskStat, `${name}: the task's churn must be ${JSON.stringify(row.expected.taskStat)}, received ${JSON.stringify(taskStat)}`)
      const mounted = await mount(viewer({ activeTab: 'diffs' }))
      const churn = [...mounted.container.querySelectorAll('.txn-diffentry .txn-churn')].map(text)
      report.check(same(churn, [row.expected.churn]), `${name}: counts on the diffs tab must read ${JSON.stringify(row.expected.churn)}, received ${JSON.stringify(churn)}`)
      await mounted.unmount()
    } else if (row.kind === 'thinking-words') {
      const badges = []
      for (const block of row.blocks) {
        const mounted = await mount(React.createElement(Thinking, { block }))
        const badge = mounted.container.querySelector('.txn-thinking-wc')
        badges.push(text(badge))
        report.check(!!badge?.querySelector('.tnum'), `${name}: the badge for ${block.words} must set its number in tabular figures`)
        await mounted.unmount()
      }
      report.check(same(badges, row.expected), `${name}: the badge must read ${JSON.stringify(row.expected)}, received ${JSON.stringify(badges)}`)
    } else if (row.kind === 'model-marker') {
      const mounted = await mount(viewer())
      const markers = [...mounted.container.querySelectorAll('.txn-modelchange')]
      const marker = markers[0]
      report.check(markers.length === 1, `${name}: the marker must render once, received ${markers.length}`)
      report.check(text(marker) === row.expected.text, `${name}: the marker must read ${JSON.stringify(row.expected.text)}, received ${JSON.stringify(text(marker))}`)
      report.check(!!marker && shown(marker) === row.expected.shown, `${name}: the marker must show ${JSON.stringify(row.expected.shown)}, received ${JSON.stringify(marker ? shown(marker) : null)}`)
      const arrow = marker?.querySelector('[aria-hidden="true"]')
      report.check(text(arrow) === '→', `${name}: the arrow must be decorative, received ${JSON.stringify(arrow ? text(arrow) : null)}`)
      await mounted.unmount()
    } else if (row.kind === 'crumb') {
      const mounted = await mount(viewer({ breadcrumb: row.breadcrumb }))
      const trail = mounted.container.querySelector('nav[aria-label="breadcrumb"]') ?? mounted.container.querySelector('.txn-crumb, .crumb')
      const items = row.breadcrumb.map((item) => [...(trail ?? mounted.container).querySelectorAll('a, span')].find((node) => text(node) === item.label && node.children.length === 0))
      const crumbs = items.map((node) => ({ tag: node?.tagName ?? null, href: node?.getAttribute('href') ?? null, current: node?.getAttribute('aria-current') ?? null }))
      report.check(same(crumbs, row.expected), `${name}: crumbs must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(crumbs)}`)
      await mounted.unmount()
    } else if (row.kind === 'crumb-context') {
      const mounted = await mount(viewer({ breadcrumbContext: row.breadcrumbContext }))
      const trail = mounted.container.querySelector('nav[aria-label="breadcrumb"]')
      const links = [...trail.querySelectorAll('a')].map((node) => ({ label: text(node), href: node.getAttribute('href') }))
      const current = trail.querySelector('[aria-current="page"]')
      report.check(same(links, row.breadcrumbContext), `${name}: ancestor links must be preserved`)
      report.check(text(current) === row.title, `${name}: current crumb must be ${JSON.stringify(row.title)}, received ${JSON.stringify(text(current))}`)
      await mounted.unmount()
    } else if (row.kind === 'filters-rail') {
      for (const [tab, want] of Object.entries(row.tabs)) {
        const mounted = await mount(viewer({ activeTab: tab }))
        const rail = mounted.container.querySelector('aside.txn-rail-right:not([hidden])')
        const grid = mounted.container.querySelector('.txn-body-grid')?.getAttribute('data-right-rail') ?? null
        report.check(!!rail === want.rail, `${name}: ${tab} must ${want.rail ? 'show' : 'leave out'} the filters rail`)
        report.check(grid === want.grid, `${name}: ${tab} grid must be data-right-rail=${JSON.stringify(want.grid)}, received ${JSON.stringify(grid)}`)
        report.check(!/not available/.test(text(mounted.container)), `${name}: ${tab} must never say a panel is not available`)
        await mounted.unmount()
      }
    } else if (row.kind === 'stylesheet') {
      const { default: sheet } = await load('/src/index.css?raw')
      const { blocks } = walkCss(sheet)
      for (const rule of row.rules) {
        const values = blocks
          .filter((block) => block.prelude === rule.selector && block.context.join(' > ') === rule.context)
          .flatMap((block) => block.decls.filter((decl) => decl.prop === rule.prop).map((decl) => decl.value))
        report.check(values.includes(rule.value), `${name}: ${rule.context} ${rule.selector} must set ${rule.prop}: ${rule.value}, received ${JSON.stringify(values)}`)
      }
    } else {
      throw new Error(`${FIXTURE}: unknown case kind ${row.kind}`)
    }
  }
})

report.finish(`${fixture.cases.length} cases over diff counts, thinking words, the model change, breadcrumbs, the filters rail and the stylesheet.`)
