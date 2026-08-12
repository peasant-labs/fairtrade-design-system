#!/usr/bin/env node
/* Built-export contract for TranscriptMarkdown. The YAML corpus is the single source of
   combinatorial cases: it covers the requested GFM structures, source newline preservation, safe
   links, inert HTML, and width-bearing blocks. This script imports the same ui.js export that a
   package consumer imports, then renders it into a DOM and checks semantic output. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { JSDOM } from 'jsdom'
import YAML from 'yaml'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const MANIFEST_PATH = resolve(ROOT, 'scripts/testdata/transcript-markdown.manifest.yaml')
const CORPUS_PATH = resolve(ROOT, 'scripts/testdata/transcript-markdown.yaml')
const HAS_PROTOCOL = /^[a-z][a-z\d+.-]*:/i
const manifestSource = readFileSync(MANIFEST_PATH, 'utf8')
const corpusSource = readFileSync(CORPUS_PATH, 'utf8')

/* react-markdown's browser build decodes character references through a tiny DOM helper at
   module evaluation time. Give the built browser-facing export the same minimal DOM that its
   package consumers have, before dynamically importing it into this Node smoke. */
const importDom = new JSDOM('<!doctype html><html><body></body></html>')
for (const [key, value] of Object.entries({ window: importDom.window, document: importDom.window.document, navigator: importDom.window.navigator })) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
const ui = await import('../dist/lib/ui.js')

const CASE_FIELDS = ['name', 'prop', 'source', 'expect']
const EXPECT_FIELDS = [
  'requiredTags',
  'textIncludes',
  'brCount',
  'tableWrapCount',
  'codeWrapCount',
  'safeHrefCount',
  'blockedLinkCount',
  'languageClass',
  'unsafeHrefAbsent',
  'rawHtmlAbsent',
]
const MUTATION_FIELDS = ['name', 'file', 'find', 'replace', 'expectedError']
const MOUNTED_FIELDS = ['fixtureMarker', 'expectedTurnCount', 'requiredTags']

function parseDocument(source, label) {
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length) throw new Error(`${label} is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
  const value = document.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} root must be an object`)
  return value
}

function exactFields(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  const unknown = Object.keys(value).filter((field) => !fields.includes(field))
  const missing = fields.filter((field) => !(field in value))
  if (unknown.length || missing.length) throw new Error(`${label} fields are invalid; unknown=${unknown.join(',')} missing=${missing.join(',')}`)
}

function uniqueStrings(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0) || new Set(value).size !== value.length) {
    throw new Error(`${label} must contain unique nonempty strings`)
  }
  return value
}

function loadFixtures() {
  const manifest = parseDocument(manifestSource, 'Markdown manifest')
  exactFields(manifest, ['expectedCaseCount', 'requiredNames', 'expectedMutationCount', 'mounted', 'mutations'], 'Markdown manifest')
  if (!Number.isSafeInteger(manifest.expectedCaseCount) || manifest.expectedCaseCount < 1) throw new Error('Markdown manifest expectedCaseCount must be a positive safe integer')
  if (!Number.isSafeInteger(manifest.expectedMutationCount) || manifest.expectedMutationCount < 1) throw new Error('Markdown manifest expectedMutationCount must be a positive safe integer')
  const requiredNames = uniqueStrings(manifest.requiredNames, 'Markdown manifest requiredNames')
  exactFields(manifest.mounted, MOUNTED_FIELDS, 'Markdown manifest mounted')
  if (typeof manifest.mounted.fixtureMarker !== 'string' || !manifest.mounted.fixtureMarker) throw new Error('Markdown manifest mounted.fixtureMarker must be a nonempty string')
  if (!Number.isSafeInteger(manifest.mounted.expectedTurnCount) || manifest.mounted.expectedTurnCount < 1) throw new Error('Markdown manifest mounted.expectedTurnCount must be a positive safe integer')
  const mountedRequiredTags = uniqueStrings(manifest.mounted.requiredTags, 'Markdown manifest mounted.requiredTags')
  if (!mountedRequiredTags.includes('br') || !mountedRequiredTags.includes('table') || !mountedRequiredTags.includes('ul') || !mountedRequiredTags.includes('pre')) throw new Error('Markdown manifest mounted.requiredTags must cover br, table, ul, and pre')
  if (!Array.isArray(manifest.mutations) || manifest.mutations.length !== manifest.expectedMutationCount) throw new Error('Markdown manifest mutation inventory count is stale')
  const mutations = manifest.mutations.map((mutation, index) => {
    exactFields(mutation, MUTATION_FIELDS, `Markdown manifest mutation ${index}`)
    if (typeof mutation.name !== 'string' || typeof mutation.file !== 'string' || typeof mutation.find !== 'string' || typeof mutation.replace !== 'string' || typeof mutation.expectedError !== 'string' || !mutation.name || !mutation.file || !mutation.find || !mutation.expectedError) {
      throw new Error(`Markdown manifest mutation ${index} has invalid string values`)
    }
    return mutation
  })
  if (new Set(mutations.map((mutation) => mutation.name)).size !== mutations.length) throw new Error('Markdown manifest mutation names must be unique')

  const corpus = parseDocument(corpusSource, 'Markdown corpus')
  exactFields(corpus, ['cases'], 'Markdown corpus')
  if (!Array.isArray(corpus.cases) || corpus.cases.length !== manifest.expectedCaseCount) throw new Error('Markdown corpus case count does not match its manifest')
  const cases = corpus.cases.map((testCase, index) => {
    exactFields(testCase, CASE_FIELDS, `Markdown corpus case ${index}`)
    if (typeof testCase.name !== 'string' || !testCase.name || !['text', 'source'].includes(testCase.prop) || typeof testCase.source !== 'string' || !testCase.source) {
      throw new Error(`Markdown corpus case ${index} has invalid name, prop, or source`)
    }
    exactFields(testCase.expect, EXPECT_FIELDS, `Markdown corpus case ${index}.expect`)
    uniqueStrings(testCase.expect.requiredTags, `Markdown corpus case ${index}.expect.requiredTags`)
    uniqueStrings(testCase.expect.textIncludes, `Markdown corpus case ${index}.expect.textIncludes`)
    if (!Number.isSafeInteger(testCase.expect.brCount) || testCase.expect.brCount < 0 || !Number.isSafeInteger(testCase.expect.tableWrapCount) || testCase.expect.tableWrapCount < 0 || !Number.isSafeInteger(testCase.expect.codeWrapCount) || testCase.expect.codeWrapCount < 0 || !Number.isSafeInteger(testCase.expect.safeHrefCount) || testCase.expect.safeHrefCount < 0 || !Number.isSafeInteger(testCase.expect.blockedLinkCount) || testCase.expect.blockedLinkCount < 0) {
      throw new Error(`Markdown corpus case ${index}.expect count fields must be safe nonnegative integers`)
    }
    if (typeof testCase.expect.languageClass !== 'string' || typeof testCase.expect.unsafeHrefAbsent !== 'boolean' || typeof testCase.expect.rawHtmlAbsent !== 'boolean') {
      throw new Error(`Markdown corpus case ${index}.expect has invalid language or safety fields`)
    }
    return testCase
  })
  const names = cases.map((testCase) => testCase.name)
  if (requiredNames.length !== cases.length || names.some((name) => !requiredNames.includes(name)) || requiredNames.some((name) => !names.includes(name)) || new Set(names).size !== names.length) {
    throw new Error('Markdown corpus names do not match the independent manifest')
  }
  const allNames = [...names, ...mutations.map((mutation) => mutation.name)]
  if (new Set(allNames).size !== allNames.length) throw new Error('Markdown corpus and mutation names must be globally unique')
  return { cases, mutations, mounted: manifest.mounted }
}

const fixtures = loadFixtures()
const mutation = process.env.FAIRTRADE_MARKDOWN_SOURCE_MUTATION ? JSON.parse(process.env.FAIRTRADE_MARKDOWN_SOURCE_MUTATION) : null
let TranscriptMarkdown = ui.TranscriptMarkdown
let viteServer

if (mutation) {
  const mutationPlugin = {
    name: 'fairtrade-markdown-source-mutation',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith(`/${mutation.file}`)) return null
      const count = code.split(mutation.find).length - 1
      if (count !== 1) throw new Error(`${mutation.name}: source mutation anchor occurred ${count} times`)
      return { code: code.replace(mutation.find, mutation.replace), map: null }
    },
  }
  viteServer = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    plugins: [mutationPlugin],
    root: ROOT,
    server: { middlewareMode: true },
  })
  const loaded = await viteServer.ssrLoadModule('/src/ui/transcript/Markdown.jsx')
  TranscriptMarkdown = loaded.default
}

const results = []
function assert(id, description, condition) {
  results.push({ id, description, ok: !!condition })
}

for (const testCase of fixtures.cases) {
  const props = { [testCase.prop]: testCase.source }
  let markup = ''
  try {
    markup = renderToStaticMarkup(React.createElement(TranscriptMarkdown, props))
  } catch (error) {
    assert(testCase.name, `${testCase.name}: production renderer must render without throwing (${error instanceof Error ? error.message : String(error)})`, false)
    continue
  }
  const { window } = new JSDOM(`<!doctype html><main>${markup}</main>`)
  const root = window.document.querySelector('.txn-body')
  assert(`${testCase.name}-root`, `${testCase.name}: public renderer emits the transcript body`, root !== null)
  if (!root) continue

  for (const tag of testCase.expect.requiredTags) {
    assert(`${testCase.name}-tag-${tag}`, `${testCase.name}: emits semantic ${tag}`, root.querySelector(tag) !== null)
  }
  for (const text of testCase.expect.textIncludes) {
    assert(`${testCase.name}-text-${text}`, `${testCase.name}: preserves source text ${JSON.stringify(text)}`, root.textContent.includes(text))
  }
  assert(`${testCase.name}-br`, `${testCase.name}: preserves the expected number of source line breaks`, root.querySelectorAll('br').length === testCase.expect.brCount)
  assert(`${testCase.name}-table-wrap`, `${testCase.name}: table blocks own local overflow`, root.querySelectorAll('.txn-md-table-wrap').length === testCase.expect.tableWrapCount)
  assert(`${testCase.name}-code-wrap`, `${testCase.name}: fenced code blocks own local overflow`, root.querySelectorAll('.txn-md-code-wrap').length === testCase.expect.codeWrapCount)
  assert(`${testCase.name}-safe-links`, `${testCase.name}: safe links remain anchors`, root.querySelectorAll('a.txn-md-link').length === testCase.expect.safeHrefCount)
  assert(`${testCase.name}-blocked-links`, `${testCase.name}: unsafe links become inert text`, root.querySelectorAll('[data-txn-link-blocked="true"]').length === testCase.expect.blockedLinkCount)
  if (testCase.expect.languageClass) {
    assert(`${testCase.name}-language`, `${testCase.name}: fenced code preserves its language class`, root.querySelector(`code.${testCase.expect.languageClass}`) !== null)
  }
  if (testCase.expect.unsafeHrefAbsent) {
    const hrefs = [...root.querySelectorAll('a')].map((anchor) => anchor.getAttribute('href') || '')
    assert(`${testCase.name}-unsafe-href`, `${testCase.name}: no anchor has an empty or executable href`, hrefs.every((href) => href && !HAS_PROTOCOL.test(href) || /^(https?|mailto):/i.test(href)))
  }
  if (testCase.expect.rawHtmlAbsent) {
    assert(`${testCase.name}-raw-html`, `${testCase.name}: raw HTML cannot create executable elements`, root.querySelector('script,[data-executable]') === null)
  }
}

/* Mount the canonical in-use demo, not a hand-built view model, so the shipped fixture is checked
   through TranscriptApp -> buildWire -> adaptTranscript -> TranscriptViewer -> TurnCard ->
   TranscriptMarkdown. The marker locates the existing turn that owns the structured body; all
   required semantic tags must be inside that turn rather than coming from a rail or tool output. */
if (!viteServer) {
  viteServer = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    root: ROOT,
    server: { middlewareMode: true },
  })
}
try {
  const mounted = await viteServer.ssrLoadModule('/src/mockups/inuse/TranscriptApp.jsx')
  const markup = renderToStaticMarkup(React.createElement(mounted.default, { theme: 'dark' }))
  const { window } = new JSDOM(`<!doctype html><main>${markup}</main>`)
  const mountedTurn = [...window.document.querySelectorAll('.txn-turn')].find((turn) => turn.querySelector('.txn-body')?.textContent.includes(fixtures.mounted.fixtureMarker))
  const mountedBody = mountedTurn?.querySelector('.txn-body')
  assert('mounted-inuse-turn-count', 'in-use TranscriptApp preserves the canonical turn count while changing only one body fixture', window.document.querySelectorAll('.txn-turn').length === fixtures.mounted.expectedTurnCount)
  assert('mounted-inuse-turn', 'in-use TranscriptApp sends the structured fixture through the production viewer into one turn', mountedTurn !== undefined)
  assert('mounted-inuse-markdown-body', 'in-use fixture reaches the TranscriptMarkdown body inside that turn', mountedBody !== null && mountedBody !== undefined)
  for (const tag of fixtures.mounted.requiredTags) {
    assert(`mounted-inuse-tag-${tag}`, `in-use fixture reaches semantic ${tag} DOM inside its rendered Markdown body`, mountedBody ? mountedBody.querySelector(tag) !== null : false)
  }
} catch (error) {
  assert('mounted-inuse-render', `in-use TranscriptApp must render its production path without throwing (${error instanceof Error ? error.message : String(error)})`, false)
}

if (viteServer) await viteServer.close()
const failures = results.filter((result) => !result.ok)
for (const result of results) console.log((result.ok ? 'PASS ' : 'FAIL ') + result.id + ' — ' + result.description)
if (failures.length) {
  console.error([
    '',
    `transcript markdown fixture gate FAILED: ${failures.length}/${results.length} assertions are red.`,
    'What went wrong: the public TranscriptMarkdown export did not preserve a required structure or safety boundary.',
    'Why it matters: transcript content is untrusted and must remain readable without changing page width or executing source markup.',
    'Where: ' + failures.map((failure) => failure.id).join(', '),
    'How to fix: inspect src/ui/transcript/Markdown.jsx and the token-only .txn-md-* rules in src/index.css, then rerun the built-library gate.',
  ].join('\n'))
  process.exit(1)
}
console.log(`\ntranscript markdown fixture gate: all ${results.length} built-export assertions passed across ${fixtures.cases.length} strict cases.`)
