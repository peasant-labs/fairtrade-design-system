#!/usr/bin/env node
/* Smoke for the BUILT share entry. src/share is exercised by share-card.test.mjs; this proves the
   published file: dist/lib/share.js loads in plain Node ESM, exports the documented names, and
   draws a card with satori from the fonts shipped in dist/lib/share-fonts, the way a consumer
   resolves `@peasant-labs/fairtrade/share/fonts/<file>`. Run after pnpm build:lib. */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import satori from 'satori'
import * as share from '../dist/lib/share.js'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'lib')
const failures = []
const check = (ok, message) => { if (!ok) failures.push(message) }

const EXPECTED = ['ShareCard', 'shareCardFromPayload', 'shareCardDescription', 'shareCardAlt', 'shareCardModelLabel', 'SHARE_CARD_FONTS']
for (const name of EXPECTED) check(name in share, `dist/lib/share.js does not export ${name}`)

const fonts = []
for (const { name, weight, style, file } of share.SHARE_CARD_FONTS ?? []) {
  const path = join(DIST, 'share-fonts', file)
  if (!existsSync(path)) { failures.push(`font ${file} is not published under dist/lib/share-fonts`); continue }
  fonts.push({ name, weight, style, data: readFileSync(path) })
}
check(fonts.length === 4, `expected 4 published fonts, found ${fonts.length}`)

if (!failures.length) {
  const card = {
    title: 'Fix the flaky upload test',
    harness: 'claude-code',
    brand: 'claude',
    chip: share.shareCardModelLabel('claude-code', 'claude-opus-5-5'),
    firstPrompt: 'The upload test fails one run in five. Find out why and fix it.',
    figures: { prompts: 12, tokens: 345_000 },
  }
  for (const [label, props] of [['public card', { card }], ['generic card', { card: null }], ['630 high', { card, height: 630 }]]) {
    try {
      const svg = await satori(React.createElement(share.ShareCard, props), { width: 1200, fonts })
      check(svg.startsWith('<svg') && svg.length > 1000, `${label}: satori returned no card`)
    } catch (error) {
      failures.push(`${label}: satori threw ${error.message}`)
    }
  }
  check(share.shareCardAlt(card).length > 0 && share.shareCardDescription(card).length > 0, 'link text is empty')
}

if (failures.length) {
  console.error(['share smoke FAILED in scripts/smoke-share.mjs (the built ./share entry):', ...failures.map((f) => `  - ${f}`), 'Run pnpm build:lib first.'].join('\n'))
  process.exit(1)
}
console.log('share smoke: dist/lib/share.js exports the card, its data and fonts; satori drew 3 cards from dist/lib/share-fonts.')
