#!/usr/bin/env node
/* Mount the actual in-use wizard and drive the same tree controls a reader uses. */
import { click, createReport, loadFixturePair, withMountedSource } from './mounted-parts.mjs'
import { zSessionDetailPayload } from '@peasant-labs/schema'

const { fixture } = loadFixturePair('scripts/testdata/kickstart-demo.yaml', 'scripts/testdata/kickstart-demo.manifest.yaml')
const browserFixture = loadFixturePair('scripts/testdata/kickstart-preview-browser.yaml', 'scripts/testdata/kickstart-preview-browser.manifest.yaml').fixture
const report = createReport('kickstart demo')

await withMountedSource(async ({ load, mount, React, window }) => {
  const { default: KickstartView } = await load('/src/mockups/inuse/LocalKickstart.jsx')
  const { KICKSTART_FOREST, KICKSTART_SESSION_DETAILS } = await load('/src/mockups/inuse/kickstart-fixture.js')
  for (const row of KICKSTART_FOREST.filter(row => row.kind === 'session')) {
    report.check(zSessionDetailPayload.safeParse(KICKSTART_SESSION_DETAILS[row.id]).success, `${row.id}: every preview is a valid synthetic session detail`)
  }
  report.check(KICKSTART_SESSION_DETAILS[browserFixture.probe.node]?.turns.some(turn => turn.content.includes(browserFixture.probe.secret)), 'the browser privacy probe reaches the secret-bearing synthetic image in the selected session')
  for (const row of fixture.cases) {
    const mounted = await mount(React.createElement(KickstartView, { theme: row.theme ?? 'dark' }))
    const root = mounted.container
    const title = root.querySelector(`[data-node-id="${row.node}"] > .st-row > button.st-title`)
    const checkbox = root.querySelector(`[data-node-id="${row.node}"] > .st-row input[type="checkbox"]`)
    report.check(!!root.querySelector('.swz') && !!root.querySelector('.iu-ks-tree'), `${row.name}: frame and tree are mounted`)
    report.check(!!root.querySelector('.iu-ks-selection .iu-ks-stop') && !!root.querySelector('.iu-ks-selection .iu-ks-tree'), `${row.name}: the selection heading belongs to the tree pane`)
    report.check(!root.querySelector('.swz-body > .iu-ks-stop'), `${row.name}: the selection heading does not occupy a row over both panes`)
    if (!title || !checkbox) throw new Error(`${row.name}: tree controls are missing`)
    const selectedBefore = checkbox.checked
    if (row.kind === 'caret') {
      await mounted.act(() => click(window, title))
      const previewBefore = root.querySelector('.iu-ks-preview')?.textContent
      const disclosure = root.querySelector(`[data-node-id="${row.node}"] > .st-row > .st-disclosure`)
      const openBefore = disclosure?.getAttribute('aria-expanded')
      await mounted.act(() => click(window, disclosure))
      report.check(disclosure?.getAttribute('aria-expanded') !== openBefore, `${row.name}: caret folds the branch`)
      report.check(checkbox.checked === selectedBefore && root.querySelector('.iu-ks-preview')?.textContent === previewBefore, `${row.name}: caret changes neither selection nor preview`)
    } else if (row.kind === 'checkbox') {
      await mounted.act(() => click(window, title))
      const previewBefore = root.querySelector('.iu-ks-preview')?.textContent
      await mounted.act(() => click(window, checkbox))
      report.check(checkbox.checked !== selectedBefore, `${row.name}: checkbox changes selection`)
      report.check(root.querySelector('.iu-ks-preview')?.textContent === previewBefore, `${row.name}: checkbox must not change preview`)
    } else {
      await mounted.act(() => click(window, title))
      report.check(checkbox.checked === selectedBefore, `${row.name}: title must not change selection`)
      if (row.kind === 'summary') {
        report.check(!!root.querySelector('.iu-ks-lines') && root.querySelector('.iu-ks-preview')?.textContent.includes(row.expected), `${row.name}: typed summary remains available`)
        report.check(!root.querySelector('.iu-ks-preview .txn-app'), `${row.name}: a summary is not a transcript`)
      } else {
        for (let n = 0; n < 80 && !root.querySelector('.iu-ks-preview [data-highlighted="true"]'); n++) await mounted.settle(25)
        const viewer = root.querySelector('.iu-ks-preview .txn-app')
        const preview = root.querySelector('.iu-ks-preview')
        report.check(!!viewer, `${row.name}: real TranscriptViewer is mounted`)
        report.check(viewer?.getAttribute('data-theme') === row.theme, `${row.name}: viewer receives host theme`)
        report.check(!root.querySelector('.iu-ks-selection .iu-ks-preview-note'), `${row.name}: the bottom-left notice is removed`)
        report.check(!preview?.querySelector('.iu-ks-preview-note'), `${row.name}: the notice does not consume the preview header`)
        report.check(viewer?.querySelector('h4.txn-title')?.textContent === row.title, `${row.name}: viewer title is nested under the wizard stop`)
        report.check(viewer?.textContent.includes(row.user) && viewer?.textContent.includes(row.assistant), `${row.name}: user and assistant turns render`)
        report.check(viewer?.querySelector('[data-highlighted="true"]')?.textContent.includes(row.code), `${row.name}: real fenced code is highlighted`)
        report.check(viewer?.querySelector('.txn-body-grid')?.getAttribute('data-left-rail') === 'closed' && viewer?.querySelector('.txn-body-grid')?.getAttribute('data-right-rail') === 'closed', `${row.name}: rails initially closed`)
        report.check(!viewer?.querySelector('[aria-label="more actions"], [aria-label="change visibility"]'), `${row.name}: side-effect affordances are absent`)
      }
    }
    await mounted.unmount()
  }
})
report.finish('mounted selection, summaries, themes and viewer')
