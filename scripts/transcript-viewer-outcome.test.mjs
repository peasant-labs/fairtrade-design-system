#!/usr/bin/env node
/* Mounted-viewer verification for the session-outcome chip. Renders the REAL
   TranscriptViewer (adaptTranscript -> TranscriptViewer, loaded through vite's
   ssrLoadModule so no prior build step is required) with each canonical
   SessionOutcome and asserts the rendered header chip's tone class and label
   — the end-to-end proof that TranscriptOutcomeChip is wired into the mounted
   header for outcomes beyond "resolved" (the old inline span was hard-coded
   to chip-ok + ShieldCheck for ANY outcome, so this callsite was previously
   untested for partial/failed).

   Set FAIRTRADE_VIEWER_OUTCOME_MUTATION to a JSON {file, find, replace} to
   run against a mutated OutcomeChip.jsx (used by
   scripts/transcript-viewer-outcome.mutations.mjs).

   Cases live in scripts/testdata/transcript-viewer-outcome.yaml; the
   required-name inventory lives in the paired .manifest.yaml. Run:
   `pnpm test:transcript-viewer-outcome` (wired into test:gates). */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import YAML from 'yaml'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const fixture = loadStrictYaml('testdata/transcript-viewer-outcome.yaml')
const manifest = loadStrictYaml('testdata/transcript-viewer-outcome.manifest.yaml')
validateManifest(manifest)
assertNameSet(fixture.cases.map((c) => c.name), manifest.requiredCaseNames, 'transcript-viewer-outcome cases')

const mutation = process.env.FAIRTRADE_VIEWER_OUTCOME_MUTATION ? JSON.parse(process.env.FAIRTRADE_VIEWER_OUTCOME_MUTATION) : null
const plugins = [react()]
if (mutation) {
  plugins.unshift({
    name: 'fairtrade-viewer-outcome-mutation',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith(`/${mutation.file}`)) return null
      const occurrences = code.split(mutation.find).length - 1
      if (occurrences !== 1) throw new Error(`viewer-outcome mutation: find string must occur exactly once in ${mutation.file}, found ${occurrences}`)
      return { code: code.split(mutation.find).join(mutation.replace), map: null }
    },
  })
}

const server = await createServer({ appType: 'custom', configFile: false, logLevel: 'silent', plugins, root: ROOT, server: { middlewareMode: true } })
const failures = []
let totalChecks = 0
function check(passed, message) {
  totalChecks += 1
  if (!passed) failures.push(message)
}

try {
  const { adaptTranscript } = await server.ssrLoadModule('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await server.ssrLoadModule('/src/ui/transcript/TranscriptViewer.jsx')
  const capabilities = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }

  for (const testCase of fixture.cases) {
    const payload = {
      id: `viewer-outcome-${testCase.outcome}`,
      harness: 'strike',
      startTime: '2026-07-16T08:00:00Z',
      endTime: '2026-07-16T08:01:00Z',
      durationMins: 1,
      totalTokens: 12,
      tokensIn: 7,
      tokensOut: 5,
      turnCount: 1,
      toolCallCount: 0,
      outcome: testCase.outcome,
      turns: [{ index: 0, role: 'user', content: 'hello', timestamp: '2026-07-16T08:00:00Z', depth: 0 }],
    }
    const viewModel = adaptTranscript(payload)
    check(viewModel.session.outcome === testCase.outcome, `${testCase.name}: adapter did not pass outcome through (got ${JSON.stringify(viewModel.session.outcome)})`)

    const markup = renderToStaticMarkup(React.createElement(TranscriptViewer, { viewModel, capabilities }))
    const document = new JSDOM(markup).window.document
    const chip = document.querySelector('.txn-meta.chips > .chip')
    check(!!chip, `${testCase.name}: expected a mounted header outcome chip`)
    check(chip?.getAttribute('class') === testCase.expectedClass, `${testCase.name}: class expected ${JSON.stringify(testCase.expectedClass)}, received ${JSON.stringify(chip?.getAttribute('class'))}`)
    check(chip?.textContent?.trim() === testCase.expectedLabel, `${testCase.name}: label expected ${JSON.stringify(testCase.expectedLabel)}, received ${JSON.stringify(chip?.textContent?.trim())}`)
  }
} finally {
  await server.close()
}

if (failures.length > 0) {
  console.error([
    'transcript viewer outcome verification failed.',
    'What went wrong: the mounted TranscriptViewer header outcome chip diverged from a fixtured case.',
    'Why it happened: TranscriptOutcomeChip stopped being wired at the header callsite, or its tone map changed.',
    'Where: src/ui/transcript/TranscriptViewer.jsx, src/ui/transcript/OutcomeChip.jsx, and scripts/testdata/transcript-viewer-outcome*.yaml.',
    `When: focused mounted-viewer outcome verification (${failures.join('; ')}).`,
    'What it means: the session header may render the wrong outcome tone/label, or none at all, for non-resolved outcomes.',
    'How to fix: restore the fixtured wiring/tone map, then rerun pnpm test:transcript-viewer-outcome.',
  ].join('\n'))
  process.exit(1)
}

console.log(`transcript viewer outcome: ${totalChecks} checks across ${fixture.cases.length} mounted outcome cases passed.`)

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return document.toJS()
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
  if (!Array.isArray(value.requiredCaseNames) || value.requiredCaseNames.some((n) => typeof n !== 'string' || n.length === 0)) {
    throw new Error('transcript-viewer-outcome manifest requiredCaseNames must be a non-empty string array')
  }
  if (!Array.isArray(value.mutations) || value.mutations.length === 0) {
    throw new Error('transcript-viewer-outcome manifest mutations must be a non-empty array')
  }
  if (!Array.isArray(value.requiredMutationNames) || value.requiredMutationNames.some((n) => typeof n !== 'string' || n.length === 0)) {
    throw new Error('transcript-viewer-outcome manifest requiredMutationNames must be a non-empty string array')
  }
  assertNameSet(value.mutations.map((m) => m.name), value.requiredMutationNames, 'transcript-viewer-outcome mutations')
  for (const mutation of value.mutations) {
    for (const field of ['name', 'file', 'find', 'replace', 'expectedDiagnostic']) {
      if (typeof mutation[field] !== 'string' || mutation[field].length === 0) {
        throw new Error(`transcript-viewer-outcome mutation ${mutation.name ?? '(unnamed)'} field ${field} must be a non-empty string`)
      }
    }
  }
}
