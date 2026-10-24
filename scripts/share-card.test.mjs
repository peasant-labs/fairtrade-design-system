#!/usr/bin/env node
/* Gate for the share-card data (src/share/data.js): the model chip label, the card fields derived
   from a session detail payload (figures follow the transcript page's header rules), the link
   text, the count format, and the rule that the module imports nothing that imports React.
   Cases: scripts/testdata/share-card.yaml (+ .manifest.yaml).
   Run: pnpm test:share-card. */
import { readFileSync } from 'node:fs'
import { loadFixturePair, withMountedSource, createReport, ROOT } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/share-card.yaml'
const MANIFEST = 'scripts/testdata/share-card.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, {
  modelLabelCases: 'requiredModelLabelNames',
  payloadCases: 'requiredPayloadNames',
  textCases: 'requiredTextNames',
  formatCases: 'requiredFormatNames',
  parseFailureCases: 'requiredParseFailureNames',
  sweepCases: 'requiredSweepNames',
})
const report = createReport('share card')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
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
})

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

report.finish(`${fixture.modelLabelCases.length} label, ${fixture.payloadCases.length} payload, ${fixture.textCases.length} text, ${fixture.formatCases.length} format and ${fixture.parseFailureCases.length} parse-failure and ${fixture.sweepCases.length} sweep cases.`)
