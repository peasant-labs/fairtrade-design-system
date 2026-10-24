#!/usr/bin/env node
/* Gate for the share card. The data (src/share/data.js): the model chip label, the card fields
   derived from a session detail payload (figures follow the transcript page's header rules), the
   link text, the count format, and the rule that the module imports nothing that imports React.
   The prompt clamp's advance table (src/share/metrics.js) against the shipped font.
   The component (src/share/ShareCard.jsx): drawn by satori, the renderer behind Next's
   ImageResponse, with the card's own fonts, at the card sizes, with the prompt clamped to three
   lines; and its source free of class names and hex colours.
   Cases: scripts/testdata/share-card.yaml (+ .manifest.yaml).
   Run: pnpm test:share-card. */
import { readFileSync } from 'node:fs'
import React from 'react'
import satori from 'satori'
import { loadFixturePair, withMountedSource, createReport, ROOT } from './mounted-parts.mjs'
import { readAdvances, renderShareMetrics, SHARE_FONT_FILE, SHARE_METRICS_FILE, ASCII_RANGE, LATIN_1_RANGE, PUNCTUATION } from './gen-share-metrics.mjs'

const FIXTURE = 'scripts/testdata/share-card.yaml'
const MANIFEST = 'scripts/testdata/share-card.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, {
  modelLabelCases: 'requiredModelLabelNames',
  payloadCases: 'requiredPayloadNames',
  textCases: 'requiredTextNames',
  formatCases: 'requiredFormatNames',
  parseFailureCases: 'requiredParseFailureNames',
  sweepCases: 'requiredSweepNames',
  renderCases: 'requiredRenderNames',
  sourceCases: 'requiredSourceNames',
  metricsCases: 'requiredMetricsNames',
})
const report = createReport('share card')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
/** a drawn text for a failure message, cut so a 600-character prompt does not flood the report */
const clip = (text) => JSON.stringify(String(text).length > 120 ? `${String(text).slice(0, 120)}...` : String(text))
const produced = []

function buildPayload(row) {
  const payload = { ...structuredClone(fixture.basePayload), ...structuredClone(row.set ?? {}) }
  for (const key of row.omit ?? []) delete payload[key]
  const text = row.firstTurnRepeat ? row.firstTurnRepeat.unit.repeat(row.firstTurnRepeat.times) : row.firstTurnContent
  if (text !== undefined) payload.turns = [{ ...payload.turns[0], content: text }, ...payload.turns.slice(1)]
  return payload
}

await withMountedSource(async ({ load }) => {
  const share = await load('/src/share/data.js')

  for (const row of fixture.modelLabelCases) {
    const label = share.shareCardModelLabel(row.harness, row.model)
    produced.push(label)
    report.check(label === row.expected, `${row.name}: expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(label)}`)
  }

  for (const row of fixture.payloadCases) {
    let card
    try { card = share.shareCardFromPayload(buildPayload(row)) } catch (error) { report.check(false, `${row.name}: threw ${error.message}`); continue }
    if (!card) { report.check(false, `${row.name}: the payload did not parse`); continue }
    produced.push(card.title, card.chip, card.firstPrompt, share.shareCardDescription(card), share.shareCardAlt(card))
    for (const [field, expected] of Object.entries(row.expect)) {
      const actual = field === 'firstPromptLength' ? card.firstPrompt.length : card[field]
      report.check(same(actual, expected), `${row.name}: ${field} expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
    }
  }

  for (const row of fixture.textCases) {
    if (row.description !== undefined) {
      const description = share.shareCardDescription(row.card)
      produced.push(description)
      report.check(description === row.description, `${row.name}: description expected ${JSON.stringify(row.description)}, received ${JSON.stringify(description)}`)
    }
    if (row.alt !== undefined) {
      const alt = share.shareCardAlt(row.card)
      produced.push(alt)
      report.check(alt === row.alt, `${row.name}: alt expected ${JSON.stringify(row.alt)}, received ${JSON.stringify(alt)}`)
    }
  }

  for (const row of fixture.formatCases) {
    const text = share.formatShareCount(row.input)
    produced.push(text)
    report.check(text === row.expected, `${row.name}: expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(text)}`)
  }

  for (const row of fixture.parseFailureCases) {
    let card
    try { card = share.shareCardFromPayload(row.payload) } catch (error) { report.check(false, `${row.name}: threw ${error.message}`); continue }
    report.check(card === null, `${row.name}: expected null, received ${JSON.stringify(card)}`)
  }

  const { ShareCard } = await load('/src/share/ShareCard.jsx')
  const { SHARE_CARD_FONTS } = await load('/src/share/fonts.js')
  const fonts = SHARE_CARD_FONTS.map((font) => ({
    name: font.name, weight: font.weight, style: font.style, data: readFileSync(`${ROOT}/src/share/fonts/${font.file}`),
  }))
  for (const row of fixture.renderCases) await checkRender(row, share, ShareCard, fonts)

  const metrics = await load('/src/share/metrics.js')
  const fontBytes = readFileSync(`${ROOT}/${SHARE_FONT_FILE}`)
  const font = readAdvances(fontBytes)
  const span = ([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
  for (const row of fixture.metricsCases) {
    if (row.check === 'values') {
      const points = [...span(ASCII_RANGE), ...span(LATIN_1_RANGE), ...PUNCTUATION]
      const wrong = points.filter((point) => metrics.bodyAdvance(point) !== font.advance(point))
      report.check(font.unitsPerEm === 1000, `${row.name}: the font has ${font.unitsPerEm} units per em, the table assumes 1000`)
      report.check(wrong.length === 0, `${row.name}: ${wrong.length} table entries differ from ${SHARE_FONT_FILE}: ${wrong.slice(0, 8).map((point) => `U+${point.toString(16).toUpperCase()} table ${metrics.bodyAdvance(point)} font ${font.advance(point)}`).join(', ')}`)
      report.check(metrics.ELLIPSIS_ADVANCE === font.advance(0x2026), `${row.name}: ELLIPSIS_ADVANCE ${metrics.ELLIPSIS_ADVANCE}, the font's ellipsis ${font.advance(0x2026)}`)
    } else if (row.check === 'generated') {
      const fresh = renderShareMetrics(fontBytes)
      report.check(readFileSync(`${ROOT}/${SHARE_METRICS_FILE}`, 'utf8') === fresh, `${row.name}: ${SHARE_METRICS_FILE} differs from a fresh run; run node scripts/gen-share-metrics.mjs`)
    } else {
      report.check(false, `${row.name}: unknown check ${JSON.stringify(row.check)}`)
    }
  }
})

/* Draw one render case with satori and check what it pins. satori gets only the width, so the
   SVG's height is the height the card itself lays out. Layout nodes carry the text satori drew;
   the prompt is the node keyed `prompt`. */
async function checkRender(row, share, ShareCard, fonts) {
  const card = row.generic ? null : share.shareCardFromPayload(buildPayload(row))
  if (!row.generic && !card) { report.check(false, `${row.name}: the payload did not parse`); return }
  const props = row.height === undefined ? { card } : { card, height: row.height }
  const nodes = []
  let svg
  try {
    svg = await satori(React.createElement(ShareCard, props), { width: 1200, fonts, onNodeDetected: (node) => nodes.push(node) })
  } catch (error) {
    report.check(false, `${row.name}: satori threw ${error.message}`)
    return
  }
  const expect = row.expect
  const drawn = nodes.map((node) => node.textContent).filter((text) => typeof text === 'string')
  produced.push(...drawn)
  if (expect.size) {
    const match = /^<svg width="(\d+)" height="(\d+)"/.exec(svg)
    const size = match ? [Number(match[1]), Number(match[2])] : null
    report.check(same(size, expect.size), `${row.name}: SVG size expected ${JSON.stringify(expect.size)}, received ${JSON.stringify(size)}`)
  }
  for (const text of expect.textIncludes ?? []) {
    report.check(drawn.some((value) => value.includes(text)), `${row.name}: no drawn text contains ${JSON.stringify(text)}; drawn ${drawn.map(clip).join(', ')}`)
  }
  for (const text of expect.textExcludes ?? []) {
    const hit = drawn.find((value) => value.includes(text))
    report.check(hit === undefined, `${row.name}: drawn text ${JSON.stringify(hit)} contains ${JSON.stringify(text)}`)
  }
  if (expect.promptMaxLines === undefined && expect.promptMinLines === undefined && expect.promptEllipsis === undefined && expect.promptCutAtWordEnd === undefined) return
  const prompt = nodes.find((node) => node.key === 'prompt')
  if (!prompt) { report.check(false, `${row.name}: no layout node keyed prompt`); return }
  if (expect.promptMaxLines !== undefined) {
    const style = prompt.props.style ?? {}
    const lineHeight = Number(style.fontSize) * Number(style.lineHeight)
    // satori rounds each line box to whole pixels, so a line count is read to the nearest line
    const lines = Math.round(prompt.height / lineHeight)
    report.check(Number.isFinite(lines) && lines <= expect.promptMaxLines, `${row.name}: the prompt takes ${lines} lines (${prompt.height}px at ${lineHeight}px a line), at most ${expect.promptMaxLines} allowed; drawn ${clip(prompt.textContent)}`)
  }
  if (expect.promptMinLines !== undefined) {
    const style = prompt.props.style ?? {}
    const lines = Math.round(prompt.height / (Number(style.fontSize) * Number(style.lineHeight)))
    report.check(lines >= expect.promptMinLines, `${row.name}: the prompt takes ${lines} lines, at least ${expect.promptMinLines} expected (cut too early?); drawn ${clip(prompt.textContent)}`)
  }
  if (expect.promptCutAtWordEnd !== undefined) {
    // the drawn text, less its ellipsis, is a prefix of the prompt that ends where a word ends
    const source = card.firstPrompt.replace(/\s+/g, ' ').trim()
    const drawnPrompt = String(prompt.textContent ?? '')
    const prefix = drawnPrompt.endsWith('…') ? drawnPrompt.slice(0, -1) : drawnPrompt
    const atWordEnd = source.startsWith(prefix) && /^[,;:]*( |$)/.test(source.slice(prefix.length))
    report.check(atWordEnd === expect.promptCutAtWordEnd, `${row.name}: the cut ${expect.promptCutAtWordEnd ? 'must' : 'must not'} end at a word end; drawn ${clip(drawnPrompt)}`)
  }
  if (expect.promptEllipsis !== undefined) {
    const text = String(prompt.textContent ?? '')
    report.check(text.endsWith('…') === expect.promptEllipsis, `${row.name}: the prompt ${expect.promptEllipsis ? 'must' : 'must not'} end in an ellipsis; drawn ${clip(text)}`)
  }
}

for (const row of fixture.sweepCases) {
  const hit = produced.find((text) => text.includes(row.forbidden))
  report.check(produced.length > 0 && hit === undefined, `${row.name}: a produced string contains ${JSON.stringify(row.forbidden)}: ${JSON.stringify(hit)}`)
}

const guard = fixture.dataModuleGuard
const source = readFileSync(`${ROOT}/${guard.file}`, 'utf8')
const imports = [...source.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1])
for (const forbidden of guard.forbiddenImports) {
  report.check(!imports.includes(forbidden), `${guard.file} must not import ${forbidden}`)
}

for (const row of fixture.sourceCases) {
  const text = readFileSync(`${ROOT}/${row.file}`, 'utf8')
  if (row.forbidden !== undefined) report.check(!text.includes(row.forbidden), `${row.name}: ${row.file} contains ${JSON.stringify(row.forbidden)}`)
  if (row.forbiddenPattern !== undefined) {
    const hit = new RegExp(row.forbiddenPattern).exec(text)
    report.check(hit === null, `${row.name}: ${row.file} contains ${JSON.stringify(hit?.[0])}`)
  }
}

report.finish(`${fixture.modelLabelCases.length} label, ${fixture.payloadCases.length} payload, ${fixture.textCases.length} text, ${fixture.formatCases.length} format and ${fixture.parseFailureCases.length} parse-failure, ${fixture.sweepCases.length} sweep, ${fixture.renderCases.length} render, ${fixture.sourceCases.length} source and ${fixture.metricsCases.length} metrics cases.`)
