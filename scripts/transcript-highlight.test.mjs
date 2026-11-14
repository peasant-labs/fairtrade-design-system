#!/usr/bin/env node
/* Mounted Markdown and its real structured-token validation. Fixture cases live in testdata. */
import { createReport, loadFixturePair, withMountedSource } from './mounted-parts.mjs'

const { fixture } = loadFixturePair('scripts/testdata/transcript-highlight.yaml', 'scripts/testdata/transcript-highlight.manifest.yaml', {
  cases: 'requiredCaseNames', invalid: 'requiredInvalidNames', failures: 'requiredFailureNames', rerenders: 'requiredRerenderNames',
  preservation: 'requiredPreservationNames', budgets: 'requiredBudgetNames', searches: 'requiredSearchNames',
})
const report = createReport('transcript highlighting')

await withMountedSource(async ({ load, mount, React }) => {
  const { default: Markdown } = await load('/src/ui/transcript/Markdown.jsx')
  const { validateHighlight, highlightCode } = await load('/src/ui/transcript/code-highlight.js')
  const { renderedSearchRanges } = await load('/src/ui/transcript/search-highlights.js')
  const markdown = (language, source) => `\`\`\`${language}\n${source}\n\`\`\``
  const waitForTokens = async (mounted) => {
    for (let attempt = 0; attempt < 80 && !mounted.container.querySelector('[data-highlighted="true"]'); attempt++) await mounted.settle(25)
  }
  for (const row of fixture.cases) {
    const source = row.source.repeat(row.repeat ?? 1)
    const mounted = await mount(React.createElement(Markdown, { text: markdown(row.language, source) }))
    const code = mounted.container.querySelector('.txn-md-code code')
    report.check(code?.textContent === `${source}\n`, `${row.name}: initial source must be present and exact`)
    if (row.highlighted) await waitForTokens(mounted)
    else await mounted.settle(30)
    report.check(code?.textContent === `${source}\n`, `${row.name}: rendering must preserve exact code text`)
    const highlighted = !!(code?.matches('[data-highlighted="true"]') || code?.querySelector('[data-highlighted="true"]'))
    report.check(highlighted === row.highlighted, `${row.name}: highlighted state must be ${row.highlighted}`)
    report.check(!mounted.container.querySelector('script, img, [onerror]'), `${row.name}: code must never become executable markup`)
    await mounted.unmount()
  }
  for (const row of fixture.invalid) {
    const source = row.source.repeat(row.sourceRepeat ?? 1)
    const tokens = row.token ? [Array.from({ length: row.tokenRepeat }, () => row.token)] : row.tokens
    report.check(validateHighlight(source, tokens) === null, `${row.name}: malformed structured output must fail closed`)
  }
  for (const row of fixture.failures) {
    const result = await highlightCode(row.source, row.language, async () => { throw new Error('synthetic tokenizer failure') })
    report.check(result === null, `${row.name}: tokenizer failure must return plain-source fallback`)
  }
  for (const row of fixture.preservation) {
    const tokens = await highlightCode(row.source, row.language)
    report.check(tokens !== null && tokens.map(token => token.content).join('') === row.source, `${row.name}: token text must preserve all original separators`)
  }
  for (const row of fixture.budgets) {
    let called = false
    const result = await highlightCode(row.source.repeat(row.repeat), row.language, async () => { called = true; return [] })
    report.check(result === null && !called, `${row.name}: budget must fail before tokenization`)
  }
  for (const row of fixture.searches) {
    const mounted = await mount(React.createElement(Markdown, { text: markdown(row.language, row.source) }))
    await waitForTokens(mounted)
    const code = mounted.container.querySelector('[data-highlighted="true"]')
    // jsdom has no layout; the production search deliberately skips unrendered text.
    for (const element of code?.querySelectorAll('span') ?? []) element.getClientRects = () => [{}]
    const ranges = renderedSearchRanges(mounted.container.querySelector('.txn-body'), row.query)
    report.check(!!code?.querySelector('span') && ranges.length === 1 && ranges[0].toString() === row.query, `${row.name}: the real search range must join token spans`)
    await mounted.unmount()
  }
  for (const row of fixture.rerenders) {
    const mounted = await mount(React.createElement(Markdown, { text: markdown(row.language, row.first) }))
    await waitForTokens(mounted)
    await mounted.rerender(React.createElement(Markdown, { text: markdown(row.language, row.second) }))
    report.check(!mounted.container.textContent.includes(row.first), `${row.name}: a new source must not show the old source`)
    report.check(mounted.container.textContent.includes(row.second), `${row.name}: a new source must stay visible while tokens load`)
    await waitForTokens(mounted)
    report.check(mounted.container.textContent.includes(row.second) && !mounted.container.textContent.includes(row.first), `${row.name}: old results must not replace the new source`)
    await mounted.unmount()
  }
})
report.finish('real Markdown, structured output, failures and rerenders')
