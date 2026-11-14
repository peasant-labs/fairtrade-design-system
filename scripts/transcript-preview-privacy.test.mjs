#!/usr/bin/env node
/* Production adapter and mounted viewer: all Markdown paths share image policy and nesting. */
import { createReport, loadFixturePair, withMountedSource } from './mounted-parts.mjs'

const { fixture } = loadFixturePair('scripts/testdata/transcript-preview-privacy.yaml', 'scripts/testdata/transcript-preview-privacy.manifest.yaml', {
  paths: 'requiredPathNames', policies: 'requiredPolicyNames', unsafe: 'requiredUnsafeNames',
})
const report = createReport('transcript preview privacy')
const capabilities = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }

await withMountedSource(async ({ load, mount, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { DEFAULT_TRANSCRIPT_FILTERS } = await load('/src/ui/transcript/filters.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const { default: Markdown } = await load('/src/ui/transcript/Markdown.jsx')
  const vm = adaptTranscript(fixture.payload)
  for (const policy of fixture.policies) {
    const mounted = await mount(React.createElement(TranscriptViewer, {
      viewModel: vm, capabilities, headingLevel: 4, presentation: 'ledger',
      ...(policy.allow === undefined ? {} : { allowMarkdownImages: policy.allow }),
      filters: { ...DEFAULT_TRANSCRIPT_FILTERS, categories: { ...DEFAULT_TRANSCRIPT_FILTERS.categories, system: true } },
      earlierHistoryOpen: { [vm.earlierHistory[0].id]: true },
    }))
    for (const path of fixture.paths) {
      const section = mounted.container.querySelector(path.selector)
      const image = section?.querySelector('img')
      const placeholder = section?.querySelector('[data-txn-image-blocked]')
      const heading = [...(section?.querySelectorAll('[role="heading"],h1,h2,h3,h4,h5,h6') ?? [])].find(el => el.textContent === path.heading)
      report.check(!!section, `${policy.name} / ${path.name}: body is mounted`)
      report.check(policy.images ? image?.alt === path.alt && image.src.includes('SECRET-') : !image && placeholder?.textContent.includes(path.alt), `${policy.name} / ${path.name}: image policy is applied`)
      report.check(heading?.getAttribute('role') === 'heading' && Number(heading?.getAttribute('aria-level')) === path.level, `${policy.name} / ${path.name}: authored heading is nested and retained`)
    }
    report.check(!!mounted.container.querySelector('.txn-earlier h6.txn-turn-heading'), `${policy.name}: retained turn has the host's turn level`)
    await mounted.unmount()
  }
  for (const row of fixture.unsafe) {
    const mounted = await mount(React.createElement(Markdown, { text: row.source }))
    report.check(!mounted.container.querySelector('img') && mounted.container.querySelector('[data-txn-image-blocked]')?.textContent.includes(row.alt), `${row.name}: invalid image is not loaded`)
    await mounted.unmount()
  }
})
report.finish('all viewer Markdown paths, policy defaults, unsafe images and heading hierarchy')
