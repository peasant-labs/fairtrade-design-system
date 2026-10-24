#!/usr/bin/env node
/* Gate for the share card. The data (src/share/data.js): the model chip label, the card fields
   derived from a session detail payload (figures follow the transcript page's header rules), the
   link text, the count format, and the rule that the module imports nothing that imports React.
   The prompt clamp's advance table (src/share/metrics.js) against the shipped font.
   The component (src/share/ShareCard.jsx): drawn by satori, the renderer behind Next's
   ImageResponse, with the card's own fonts, at the card sizes, with the prompt clamped to three
   lines; and its source free of class names and hex colours. The drift guard: the styles the card
   draws equal fairtrade's own CSS (the source sheets, resolved through the dark tokens).
   Cases: scripts/testdata/share-card.yaml (+ .manifest.yaml).
   Run: pnpm test:share-card. */
import { readFileSync } from 'node:fs'
import React from 'react'
import satori from 'satori'
import { loadFixturePair, withMountedSource, createReport, ROOT } from './mounted-parts.mjs'
import { walkCss } from './css-source.mjs'
import { readAdvances, renderShareMetrics, SHARE_FONT_FILE, SHARE_MONO_BOLD_FILE, SHARE_METRICS_FILE, ASCII_RANGE, LATIN_1_RANGE, PUNCTUATION, FIGURE_CHARS } from './gen-share-metrics.mjs'

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
  styleCases: 'requiredStyleNames',
  layoutCases: 'requiredLayoutNames',
})
const report = createReport('share card')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
/** a drawn text for a failure message, cut so a 600-character prompt does not flood the report */
const clip = (text) => JSON.stringify(String(text).length > 120 ? `${String(text).slice(0, 120)}...` : String(text))
const produced = []
/* the face the tile numbers are drawn in, read straight from the shipped file: the value check
   measures a drawn number with it, independently of the card's own table */
const MONO_BOLD = readAdvances(readFileSync(`${ROOT}/${SHARE_MONO_BOLD_FILE}`))

/** Draw a card with satori, given only the width, and keep its layout nodes. */
async function layout(ShareCard, props, fonts) {
  const nodes = []
  const svg = await satori(React.createElement(ShareCard, props), { width: 1200, fonts, onNodeDetected: (node) => nodes.push(node) })
  return { svg, nodes }
}

/* The prompt as drawn. The card lays the prompt out itself, one row a line, a word to a node keyed
   `w<n>` and a space to a node keyed `s<n>` (a space where a line breaks is kept, drawn zero
   wide), so the drawn text is those nodes' text in order, the no-break space read as a space. */
const PROMPT_PIECE = /^[ws]\d+$/
function promptText(nodes) {
  return nodes.filter((node) => PROMPT_PIECE.test(String(node.key ?? ''))).map((node) => String(node.textContent ?? '')).join('').replace(/\u00a0/g, ' ')
}

/* ---- the drift guard: fairtrade's CSS, resolved through the dark tokens ---- */

const sheets = new Map()
function sheet(file) {
  if (!sheets.has(file)) sheets.set(file, walkCss(readFileSync(`${ROOT}/${file}`, 'utf8')).blocks)
  return sheets.get(file)
}
const plainContext = (block) => !block.context.some((p) => p.startsWith('@media') || p.startsWith('@supports') || p.includes('data-theme'))
/** The dark theme's custom properties: the top-level :root rules of src/index.css, first definition wins. */
function rootProperties() {
  const props = new Map()
  for (const block of sheet('src/index.css')) {
    if (block.prelude !== ':root' || !plainContext(block)) continue
    for (const decl of block.decls) if (decl.prop.startsWith('--') && !props.has(decl.prop)) props.set(decl.prop, decl.value)
  }
  return props
}
/** The value of `property` in the one plain rule of `file` whose selector list holds `selector`, or undefined. */
function cssDeclaration({ file, selector, property }) {
  const hits = []
  for (const block of sheet(file)) {
    if (!plainContext(block) || block.prelude.startsWith('@')) continue
    if (!block.prelude.split(',').map((part) => part.trim()).includes(selector)) continue
    for (const decl of block.decls) if (decl.prop === property) hits.push(decl.value)
  }
  if (hits.length > 1) throw new Error(`${file}: ${selector} sets ${property} ${hits.length} times; the drift guard needs one`)
  return hits[0]
}
function resolveVars(value, props, depth = 0) {
  if (depth > 8) throw new Error(`custom properties nest too deep in ${value}`)
  const next = value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
    if (!props.has(name)) throw new Error(`${name} is not a :root custom property of src/index.css`)
    return props.get(name)
  })
  return next === value ? value : resolveVars(next, props, depth + 1)
}
const hexRgb = (hex) => {
  const h = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1, 7)
  return [0, 2, 4].map((at) => parseInt(h.slice(at, at + 2), 16))
}
/** Canonical text for a style value: colours as rgb(r, g, b), color-mix in srgb evaluated, numbers in px. */
function canonical(value) {
  if (typeof value === 'number') return `${value}px`
  let text = String(value).trim().replace(/\s+/g, ' ')
  text = text.replace(/color-mix\(in srgb, (#[0-9a-f]{3,6}) ([\d.]+)%, (#[0-9a-f]{3,6})\)/gi, (_, a, pct, b) => {
    const [x, y, t] = [hexRgb(a), hexRgb(b), Number(pct) / 100]
    return `rgb(${x.map((channel, i) => Math.round(channel * t + y[i] * (1 - t))).join(', ')})`
  })
  text = text.replace(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi, (hex) => `rgb(${hexRgb(hex).join(', ')})`)
  return text.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, 'rgb($1, $2, $3)')
}

function checkStyle(row, drawnCard, { shipped, spaceAdvance }) {
  const props = rootProperties()
  const { nodes } = drawnCard
  const targets = row.node.match !== undefined
    ? nodes.filter((node) => new RegExp(row.node.match).test(String(node.key ?? '')) && Number(node.props?.style?.[row.node.property]) > 0)
    : (row.node.keys ?? [row.node.key]).map((key) => nodes.find((node) => node.key === key) ?? key)
  const missing = targets.filter((target) => typeof target === 'string')
  report.check(missing.length === 0 && targets.length > 0, `${row.name}: the card drew no node keyed ${JSON.stringify(missing.length ? missing : row.node.match ?? row.node.key)}`)
  const drawnValues = targets.filter((target) => typeof target !== 'string').map((node) => node.props?.style?.[row.node.property])

  if (row.override) {
    const css = cssDeclaration(row.css)
    const fair = css === undefined ? 'initial' : canonical(resolveVars(css, props))
    const plain = (value) => (typeof value === 'number' ? String(value) : canonical(value))
    report.check(fair !== plain(row.override.value), `${row.name}: fairtrade now sets ${row.css.property} to ${fair} itself; drop the override (${row.override.reason})`)
    for (const value of drawnValues) report.check(plain(value) === plain(row.override.value), `${row.name}: the card draws ${JSON.stringify(value)}, the approved override is ${JSON.stringify(row.override.value)}`)
    return
  }

  if (row.transform === 'spaceWidth') {
    const prompt = nodes.find((node) => node.key === 'prompt')
    const size = Number(prompt?.props?.style?.fontSize)
    const ems = row.css.map((ref) => {
      const css = cssDeclaration(ref)
      if (css === undefined) throw new Error(`${row.name}: ${ref.file} ${ref.selector} sets no ${ref.property}`)
      const resolved = resolveVars(css, props)
      if (!/^[\d.]+em$/.test(resolved)) throw new Error(`${row.name}: ${ref.property} ${resolved} is not in em`)
      return parseFloat(resolved)
    })
    const expected = (spaceAdvance / 1000 + ems.reduce((a, b) => a + b, 0)) * size
    for (const value of drawnValues) report.check(Math.abs(Number(value) - expected) < 0.01, `${row.name}: a space is drawn ${value}px wide, fairtrade's prose space at ${size}px is ${expected.toFixed(2)}px`)
    return
  }

  const css = row.token !== undefined ? props.get(row.token) : cssDeclaration(row.css)
  if (css === undefined) { report.check(false, `${row.name}: ${row.token ?? `${row.css.file} ${row.css.selector} ${row.css.property}`} is not set`); return }
  let expected = canonical(resolveVars(css, props))
  if (row.transform === 'nearestShippedWeight') {
    const weight = Number(expected.replace(/px$/, ''))
    expected = String(shipped.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best)))
  } else if (row.transform !== undefined) {
    report.check(false, `${row.name}: unknown transform ${JSON.stringify(row.transform)}`)
    return
  }
  for (const value of drawnValues) {
    const actual = row.transform === 'nearestShippedWeight' ? String(value) : canonical(value)
    report.check(actual === expected, `${row.name}: the card draws ${row.node.property} ${JSON.stringify(actual)}, fairtrade's CSS gives ${JSON.stringify(expected)}`)
  }
}

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

  const fontBytesForStyle = readFileSync(`${ROOT}/${SHARE_FONT_FILE}`)
  const shipped = SHARE_CARD_FONTS.map((font) => font.weight)
  const drawnCards = {
    public: await layout(ShareCard, { card: share.shareCardFromPayload(buildPayload({})), height: 600 }, fonts),
    generic: await layout(ShareCard, { card: null, height: 600 }, fonts),
  }
  for (const row of fixture.styleCases) {
    checkStyle(row, drawnCards[row.card ?? 'public'], { shipped, spaceAdvance: readAdvances(fontBytesForStyle).advance(0x20) })
  }
  for (const row of fixture.layoutCases) checkLayout(row, drawnCards[row.card ?? 'public'].nodes)

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
      const figureWrong = [...FIGURE_CHARS].filter((char) => metrics.MONO_BOLD_ADVANCE !== MONO_BOLD.advance(/** @type {number} */ (char.codePointAt(0))))
      report.check(MONO_BOLD.unitsPerEm === 1000, `${row.name}: ${SHARE_MONO_BOLD_FILE} has ${MONO_BOLD.unitsPerEm} units per em, the table assumes 1000`)
      report.check(figureWrong.length === 0, `${row.name}: MONO_BOLD_ADVANCE ${metrics.MONO_BOLD_ADVANCE} differs from ${SHARE_MONO_BOLD_FILE} for ${JSON.stringify(figureWrong.join(''))}`)
    } else if (row.check === 'generated') {
      const fresh = renderShareMetrics(fontBytes, readFileSync(`${ROOT}/${SHARE_MONO_BOLD_FILE}`))
      report.check(readFileSync(`${ROOT}/${SHARE_METRICS_FILE}`, 'utf8') === fresh, `${row.name}: ${SHARE_METRICS_FILE} differs from a fresh run; run node scripts/gen-share-metrics.mjs`)
    } else {
      report.check(false, `${row.name}: unknown check ${JSON.stringify(row.check)}`)
    }
  }
})

/** One layout case: the card's geometry as satori laid it out. */
function checkLayout(row, nodes) {
  const find = (key) => nodes.find((node) => node.key === key)
  const wanted = row.check === 'sameTop' ? row.keys : row.check === 'gapBelow' ? [row.key, row.below] : row.check === 'textIsolated' ? ['frame'] : [row.key]
  const missing = wanted.filter((key) => !find(key))
  if (missing.length) { report.check(false, `${row.name}: the card drew no node keyed ${JSON.stringify(missing)}`); return }
  if (row.check === 'sameTop') {
    const tops = row.keys.map((key) => find(key).top)
    report.check(tops.every((top) => Math.abs(top - tops[0]) < 0.5), `${row.name}: ${row.keys.join(', ')} start at y ${tops.join(', ')}`)
  } else if (row.check === 'size') {
    const node = find(row.key)
    const [width, height] = row.size
    report.check((width === null || Math.abs(node.width - width) < 0.5) && (height === null || Math.abs(node.height - height) < 0.5), `${row.name}: ${row.key} is ${node.width} x ${node.height}, expected ${width ?? 'any'} x ${height ?? 'any'}`)
  } else if (row.check === 'style') {
    const style = find(row.key).props?.style ?? {}
    for (const [property, value] of Object.entries(row.style)) {
      report.check(String(style[property]) === String(value), `${row.name}: ${row.key} sets ${property} ${JSON.stringify(style[property])}, expected ${JSON.stringify(value)}`)
    }
  } else if (row.check === 'textIsolated') {
    // satori sets textContent on the element that holds a text child
    const holdsText = (node) => typeof node.textContent === 'string'
    const targets = [find('frame'), ...nodes.filter(holdsText)]
    const open = targets.flatMap((node) => row.properties.filter((property) => node.props?.style?.[property] === undefined).map((property) => `${node.key ?? JSON.stringify(node.textContent)} ${property}`))
    report.check(targets.length > 1 && open.length === 0, `${row.name}: ${open.length} text styles are left to inheritance: ${open.slice(0, 8).join(', ')}`)
  } else if (row.check === 'gapBelow') {
    const [above, below] = [find(row.key), find(row.below)]
    const gap = below.top - (above.top + above.height)
    report.check(Math.abs(gap - row.px) < 0.5, `${row.name}: ${row.below} starts ${gap}px below ${row.key}, expected ${row.px}px`)
  } else {
    report.check(false, `${row.name}: unknown check ${JSON.stringify(row.check)}`)
  }
}

/* Draw one render case with satori and check what it pins. satori gets only the width, so the
   SVG's height is the height the card itself lays out. Layout nodes carry the text satori drew;
   the prompt is the node keyed `prompt`. */
async function checkRender(row, share, ShareCard, fonts) {
  const card = row.generic ? null : share.shareCardFromPayload(buildPayload(row))
  if (!row.generic && !card) { report.check(false, `${row.name}: the payload did not parse`); return }
  const props = row.height === undefined ? { card } : { card, height: row.height }
  let nodes
  let svg
  try {
    ({ svg, nodes } = await layout(ShareCard, props, fonts))
  } catch (error) {
    report.check(false, `${row.name}: satori threw ${error.message}`)
    return
  }
  const expect = row.expect
  const prompt = nodes.find((node) => node.key === 'prompt')
  const drawnPrompt = prompt ? promptText(nodes) : undefined
  const drawn = nodes.map((node) => node.textContent).filter((text) => typeof text === 'string')
  if (drawnPrompt !== undefined) drawn.push(drawnPrompt)
  produced.push(...drawn)
  if (prompt) {
    // the card wraps the prompt itself, so a line too long for the box would run out sideways
    const right = prompt.left + prompt.width
    const over = nodes.filter((node) => PROMPT_PIECE.test(String(node.key ?? '')) && node.left + node.width > right + 0.5)
    report.check(over.length === 0, `${row.name}: ${over.length} prompt pieces run past the prompt's width (${prompt.width}px): ${over.slice(0, 3).map((node) => clip(node.textContent)).join(', ')}`)
  }
  if (card?.figures) {
    // a tile number is measured with the shipped mono bold face at the size the card drew it, and
    // must end inside its tile's content box, which the eyebrow above it spans
    for (const label of ['prompts', 'tokens']) {
      const value = nodes.find((node) => node.key === `value-${label}`)
      const eyebrow = nodes.find((node) => node.key === `eyebrow-${label}`)
      if (!value || !eyebrow) { report.check(false, `${row.name}: no value or eyebrow node for ${label}`); continue }
      const size = Number(value.props?.style?.fontSize)
      const text = String(value.textContent ?? '')
      const units = [...text].reduce((sum, char) => sum + (MONO_BOLD.advance(/** @type {number} */ (char.codePointAt(0))) ?? MONO_BOLD.unitsPerEm), 0)
      const width = (units / MONO_BOLD.unitsPerEm) * size
      const right = value.left + width
      const inside = Number.isFinite(width) && value.left >= eyebrow.left - 0.5 && right <= eyebrow.left + eyebrow.width + 0.5
      report.check(inside, `${row.name}: the ${label} number ${JSON.stringify(text)} at ${size}px is ${width.toFixed(1)}px wide and ends at x ${right.toFixed(1)}, past its tile's content box (x ${eyebrow.left} to ${eyebrow.left + eyebrow.width})`)
    }
  }
  for (const [label, size] of Object.entries(expect.valueFontSize ?? {})) {
    const value = nodes.find((node) => node.key === `value-${label}`)
    report.check(Number(value?.props?.style?.fontSize) === size, `${row.name}: the ${label} number ${JSON.stringify(value?.textContent)} is drawn at ${value?.props?.style?.fontSize}px, expected ${size}px`)
  }
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
    const prefix = drawnPrompt.endsWith('…') ? drawnPrompt.slice(0, -1) : drawnPrompt
    const atWordEnd = source.startsWith(prefix) && /^[,;:]*( |$)/.test(source.slice(prefix.length))
    report.check(atWordEnd === expect.promptCutAtWordEnd, `${row.name}: the cut ${expect.promptCutAtWordEnd ? 'must' : 'must not'} end at a word end; drawn ${clip(drawnPrompt)}`)
  }
  if (expect.promptEllipsis !== undefined) {
    const text = drawnPrompt
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

report.finish(`${fixture.modelLabelCases.length} label, ${fixture.payloadCases.length} payload, ${fixture.textCases.length} text, ${fixture.formatCases.length} format and ${fixture.parseFailureCases.length} parse-failure, ${fixture.sweepCases.length} sweep, ${fixture.renderCases.length} render, ${fixture.sourceCases.length} source, ${fixture.metricsCases.length} metrics, ${fixture.styleCases.length} style and ${fixture.layoutCases.length} layout cases.`)
