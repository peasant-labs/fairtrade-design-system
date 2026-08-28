#!/usr/bin/env node
/* Fixture-driven verification for TranscriptOutcomeChip (src/ui/transcript/
   OutcomeChip.jsx) — the reusable component form of the outcome chip
   TranscriptViewer renders inline in its header. Loads the REAL component
   source through vite's ssrLoadModule (no build step required — safe to run
   standalone or inside test:gates) and asserts the resolved tone class,
   title, label text, and leading icon for every recognized outcome, plus the
   render-nothing contract for unrecognized/absent outcomes.

   Cases live in scripts/testdata/transcript-outcome-chip.yaml; the
   required-name inventory (deletion protection) lives in the paired
   .manifest.yaml. Run: `pnpm test:transcript-outcome-chip` (wired into
   test:gates). */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import YAML from 'yaml'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const fixture = loadStrictYaml('testdata/transcript-outcome-chip.yaml')
const manifest = loadStrictYaml('testdata/transcript-outcome-chip.manifest.yaml')

validateManifest(manifest)
validateFixture(fixture, manifest)

const server = await createServer({ appType: 'custom', configFile: false, logLevel: 'silent', root: ROOT })
const failures = []
let totalChecks = 0
function check(passed, message) {
  totalChecks += 1
  if (!passed) failures.push(message)
}

try {
  const { default: TranscriptOutcomeChip } = await server.ssrLoadModule('/src/ui/transcript/OutcomeChip.jsx')

  for (const testCase of fixture.cases) {
    const markup = renderToStaticMarkup(React.createElement(TranscriptOutcomeChip, { outcome: testCase.outcome }))
    const document = new JSDOM(markup).window.document
    const el = document.querySelector('span')
    check(!!el, `${testCase.name}: expected a rendered <span>`)
    check(el?.getAttribute('class') === testCase.expectedClass, `${testCase.name}: class expected ${JSON.stringify(testCase.expectedClass)}, received ${JSON.stringify(el?.getAttribute('class'))}`)
    check(el?.getAttribute('title') === testCase.expectedTitle, `${testCase.name}: title expected ${JSON.stringify(testCase.expectedTitle)}, received ${JSON.stringify(el?.getAttribute('title'))}`)
    check(el?.textContent?.trim() === testCase.expectedLabel, `${testCase.name}: label expected ${JSON.stringify(testCase.expectedLabel)}, received ${JSON.stringify(el?.textContent?.trim())}`)
    check(!!document.querySelector(`svg.${testCase.expectedIconClass}`), `${testCase.name}: expected the ${testCase.expectedIconClass} icon`)
  }

  for (const testCase of fixture.renderNothingCases) {
    const markup = renderToStaticMarkup(React.createElement(TranscriptOutcomeChip, { outcome: testCase.outcome ?? undefined }))
    check(markup === '', `${testCase.name}: expected empty markup, received ${JSON.stringify(markup)}`)
  }
} finally {
  await server.close()
}

if (failures.length > 0) {
  console.error([
    'transcript outcome chip verification failed.',
    'What went wrong: TranscriptOutcomeChip diverged from a fixtured outcome case.',
    'Why it happened: the outcome-to-tone/icon/label mapping or the render-nothing guard changed.',
    'Where: src/ui/transcript/OutcomeChip.jsx and scripts/testdata/transcript-outcome-chip*.yaml.',
    `When: focused transcript outcome chip verification (${failures.join('; ')}).`,
    'What it means: the session header outcome chip may render the wrong tone, label, or nothing at all.',
    'How to fix: restore the fixtured mapping in OutcomeChip.jsx, then rerun pnpm test:transcript-outcome-chip.',
  ].join('\n'))
  process.exit(1)
}

console.log(`transcript outcome chip: ${totalChecks} checks across ${fixture.cases.length} recognized outcomes and ${fixture.renderNothingCases.length} render-nothing cases passed.`)

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return document.toJS()
}

function names(list) {
  return list.map((item) => item.name)
}

function assertNameSet(actualNames, requiredNames, label) {
  const actualSet = new Set(actualNames)
  const requiredSet = new Set(requiredNames)
  if (actualSet.size !== actualNames.length) throw new Error(`${label}: duplicate case names`)
  if (actualSet.size !== requiredSet.size || [...requiredSet].some((name) => !actualSet.has(name))) {
    throw new Error(`${label}: case names do not match the required-name manifest exactly`)
  }
}

function validateManifest(value) {
  for (const field of ['requiredCaseNames', 'requiredRenderNothingNames']) {
    if (!Array.isArray(value[field]) || value[field].some((name) => typeof name !== 'string' || name.length === 0)) {
      throw new Error(`transcript-outcome-chip manifest field ${field} must be a non-empty string array`)
    }
  }
}

function validateFixture(value, manifestValue) {
  assertNameSet(names(value.cases), manifestValue.requiredCaseNames, 'cases')
  assertNameSet(names(value.renderNothingCases), manifestValue.requiredRenderNothingNames, 'renderNothingCases')
}
