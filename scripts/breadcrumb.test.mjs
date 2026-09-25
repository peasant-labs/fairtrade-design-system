#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import YAML from 'yaml'
import { assertFeatureGitIdentity } from './served-build-provenance.mjs'
import { resolveFeatureGitIdentity } from './feature-git-identity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const fixture = loadFixture(resolve(HERE, 'testdata/breadcrumb.yaml'))
const manifest = loadFixture(resolve(HERE, 'testdata/breadcrumb.manifest.yaml'))
validateFixtureInventory()

const mutationName = process.env.BREADCRUMB_MUTATION_NAME
const sourceMutation = mutationName ? manifest.mutations.find((mutation) => mutation.name === mutationName) : null
if (mutationName && !sourceMutation) throw fixtureError(`unknown mutation ${JSON.stringify(mutationName)}`, 'where: scripts/breadcrumb.test.mjs mutation selection; when: source preflight; what it means: the requested source mutant cannot be attributed; how to fix: pass one exact name from the mutation manifest.')
const sourceCaseIds = selectCaseIds({
  raw: process.env.BREADCRUMB_SOURCE_CASES,
  owner: 'source',
  required: manifest.execution.source,
  selected: sourceMutation ? [sourceMutation.logicalCase] : null,
  requireFull: !sourceMutation,
})
const sourceCases = sourceCaseIds.map((name) => fixture.cases.find((testCase) => testCase.name === name))

const server = await createServer({
  root: ROOT,
  configFile: false,
  plugins: [react(), ...(sourceMutation ? [inMemorySourceMutation(sourceMutation)] : [])],
  server: { middlewareMode: true },
  logLevel: 'silent',
})

try {
  const module = await server.ssrLoadModule('/src/ui/Breadcrumb.jsx')
  const Breadcrumb = module.default
  const { Folder, FileText } = await import('lucide-react')
  const icons = { Folder, FileText }

  for (const testCase of sourceCases) await verifyCase(Breadcrumb, testCase, icons)
  verifyProvenanceNegativeCases()
} finally {
  await server.close()
}

console.log(`breadcrumb source execution: ${sourceCaseIds.join(',')}`)
console.log(`breadcrumb source: ${sourceCases.length} fixture cases passed against src/ui/Breadcrumb.jsx`)

async function verifyCase(Breadcrumb, testCase, icons) {
  try {
    const items = testCase.items.map((item) => ({
      ...item,
      ...(item.icon ? { icon: icons[item.icon] } : {}),
    }))
    const props = {
      items,
      ...(testCase.linkComponent === 'forwarding' ? { LinkComponent: ForwardingLink } : {}),
      ...(testCase.expected.navLabel === 'custom breadcrumb label' ? { label: testCase.expected.navLabel } : {}),
    }
    const document = new JSDOM(renderToStaticMarkup(React.createElement(Breadcrumb, props))).window.document
    const expected = testCase.expected
    const nav = document.querySelector('nav')
    assert.ok(nav, 'nav landmark is missing')
    if (expected.navLabel) assert.equal(nav.getAttribute('aria-label'), expected.navLabel, 'nav aria-label')

    if (expected.linkTag) {
      const link = document.querySelector('a')
      assert.ok(link, 'linked item anchor is missing')
      assert.equal(link.tagName.toLowerCase(), expected.linkTag, 'linked item tag')
      assert.equal(link.getAttribute('href'), expected.linkHref, 'linked item href')
      if (expected.customMarker) {
        if (link.getAttribute('data-custom-link') !== expected.customMarker || link.getAttribute('class') !== expected.linkClass || link.querySelector('.crumb-item')?.textContent !== expected.forwardedChildren) {
          throw new Error('breadcrumb custom link forwarding: expected custom-link marker and className=link')
        }
      } else if (expected.linkClass) {
        assert.equal(link.getAttribute('class'), expected.linkClass, 'linked item class')
      }
    }

    if (testCase.name === 'icon-and-separator-preserved') {
      const crumbItems = [...document.querySelectorAll('.crumb-item')]
      assert.equal(crumbItems.length, expected.itemCount, 'crumb item count')
      const linkedIcon = crumbItems[0]?.querySelector('svg')
      assert.ok(linkedIcon, 'linked Folder icon SVG is missing')
      assert.equal(linkedIcon.getAttribute('aria-hidden'), expected.linkedIconAriaHidden, 'linked icon aria-hidden')
      assert.ok(linkedIcon.classList.contains(expected.linkedIconClass), 'linked Folder icon component output')
      const finalIcon = crumbItems.at(-1)?.querySelector('svg')
      assert.ok(finalIcon, 'final icon SVG is missing')
      assert.equal(finalIcon.getAttribute('aria-hidden'), expected.finalIconAriaHidden, 'final icon aria-hidden')
      assert.ok(finalIcon.classList.contains(expected.finalIconClass), 'final icon component output')
      const separators = [...document.querySelectorAll('.crumb > span > svg')]
      assert.equal(separators.length, expected.separatorCount, 'ChevronRight separator count')
      assert.ok(separators.every((separator) => separator.classList.contains(expected.separatorClass)), 'real ChevronRight SVG output')
      for (const [index, item] of crumbItems.entries()) {
        const following = document.querySelector(`.crumb > span:nth-child(${index + 1}) > svg`)
        assert.equal(Boolean(following), index < expected.itemCount - 1, `separator placement after crumb ${index}`)
        assert.equal(Boolean(item.querySelector('svg')), index === 0 || index === expected.itemCount - 1, `icon placement in crumb ${index}`)
      }
    }

    if (expected.contentSelector) {
      const content = document.querySelector(expected.contentSelector)
      assert.ok(content, 'content crumb item is missing')
      assert.ok(content.classList.contains(expected.contentClass), 'content crumb class')
      if (expected.computedTextTransform) assert.equal(expected.computedTextTransform, 'none', 'source content transform contract')
    }

    if (expected.chromeClass) {
      const chrome = document.querySelector('.crumb-item-chrome')
      assert.ok(chrome, 'chrome crumb item is missing')
      assert.ok(chrome.classList.contains(expected.chromeClass), 'chrome class')
      assert.equal(expected.chromeComputedTextTransform, 'lowercase', 'chrome source transform contract')
    }

    if (expected.nonLinkSelector) {
      const nonLink = document.querySelector(expected.nonLinkSelector)
      assert.ok(nonLink, 'non-linked intermediate is missing')
      assert.equal(nonLink.tagName.toLowerCase(), expected.nonLinkTag, 'non-linked intermediate tag')
      assert.equal(nonLink.getAttribute('href'), expected.nonLinkHref, 'non-linked intermediate href')
    }

    if (expected.finalTag) {
      const final = document.querySelector('.cur')
      assert.ok(final, 'current crumb is missing')
      assert.equal(final.tagName.toLowerCase(), expected.finalTag, 'current crumb tag')
      assert.equal(final.getAttribute('aria-current'), expected.finalAriaCurrent, 'current crumb aria-current')
      assert.ok(final.classList.contains(expected.finalClass), 'current crumb class')
      if (Object.hasOwn(expected, 'finalHref')) assert.equal(final.getAttribute('href'), expected.finalHref, 'final href must be ignored')
      if (Object.hasOwn(expected, 'finalLinkCount')) assert.equal(final.querySelectorAll('a').length, expected.finalLinkCount, 'final crumb link count')
    }
  } catch (error) {
    throw new Error(`breadcrumb ${testCase.name} failed: ${error instanceof Error ? error.message : String(error)}; why: the real Breadcrumb source did not satisfy the named fixture contract; where: src/ui/Breadcrumb.jsx and scripts/testdata/breadcrumb.yaml; when: source verification; what it means: the public link, case, or semantics contract is not proven; how to fix: update the production implementation only after checking the named fixture expectation.`)
  }
}

function verifyProvenanceNegativeCases() {
  const { base, expectedHead: head } = resolveFeatureGitIdentity({ sourceRoot: ROOT })
  assert.throws(() => assertFeatureGitIdentity({ sourceRoot: ROOT, base, expectedHead: undefined }), /explicit expectedHead commit/)
  assert.throws(() => assertFeatureGitIdentity({ sourceRoot: ROOT, base: undefined, expectedHead: head }), /explicit base commit/)
  assert.throws(() => assertFeatureGitIdentity({ sourceRoot: ROOT, base, expectedHead: base }), /repository HEAD is .*expected/)
  assert.throws(() => assertFeatureGitIdentity({ sourceRoot: ROOT, base: 'not-a-commit', expectedHead: head }), /does not resolve to a commit/)
  assert.throws(() => assertFeatureGitIdentity({ sourceRoot: ROOT, base, expectedHead: head, expectedBranch: 'not-a-real-feature-branch' }), /repository branch is .*expected/)

  const unrelated = gitOutput('rev-list', '--all', '--not', head).split('\n').filter(Boolean)[0]
  if (unrelated) assert.throws(() => assertFeatureGitIdentity({ sourceRoot: ROOT, base: unrelated, expectedHead: head }), /not the actual merge-base/)

  const dirtyPath = resolve(ROOT, `.breadcrumb-provenance-dirty-${process.pid}`)
  writeFileSync(dirtyPath, 'dirty provenance negative\n')
  try {
    assert.throws(() => assertFeatureGitIdentity({ sourceRoot: ROOT, base, expectedHead: head }), /worktree is dirty/)
  } finally {
    unlinkSync(dirtyPath)
  }
  console.log('breadcrumb provenance negatives: omitted head, omitted/mismatched base, mismatched head/branch, and dirty worktree rejected')
}

function inMemorySourceMutation(mutation) {
  const sourcePath = normalize(resolve(ROOT, mutation.file))
  const source = readFileSync(sourcePath, 'utf8')
  const occurrences = source.split(mutation.find).length - 1
  if (occurrences !== 1) throw fixtureError(`source mutation target ${mutation.file} must occur exactly once; received ${occurrences}`, 'where: scripts/breadcrumb.test.mjs mutation preflight; when: in-memory source load; what it means: the designated mutant is not isolated; how to fix: correct the manifest find needle and rerun the mutation gate.')
  return {
    name: 'in-memory-breadcrumb-source-mutation',
    enforce: 'pre',
    load(id) {
      return normalize(id.split('?')[0]) === sourcePath ? source.replace(mutation.find, mutation.replace) : null
    },
  }
}

function ForwardingLink({ href, className, children }) {
  return React.createElement('a', { href, className, 'data-custom-link': 'custom-link' }, children)
}

function validateFixtureInventory() {
  const requiredCases = ['default-anchor-item', 'custom-link-forwarding', 'icon-and-separator-preserved', 'content-default-case', 'chrome-item-case', 'non-linked-intermediate-item', 'final-item-current-and-href-ignored', 'nav-label-preserved', 'commons-detail-dark', 'commons-detail-light']
  const requiredSource = requiredCases.filter((name) => !name.startsWith('commons-detail-'))
  const requiredMounted = requiredCases.filter((name) => name.startsWith('commons-detail-'))
  const requiredOwners = Object.fromEntries(requiredCases.map((name) => [name, name.startsWith('commons-detail-') ? 'mounted' : 'source']))
  const requiredMutations = [
    { name: 'restore-global-crumb-lowercase', file: 'src/index.css', find: '.crumb { @apply flex items-center gap-2 font-mono text-label text-ink-3;', replace: '.crumb { @apply flex items-center gap-2 font-mono text-label lowercase text-ink-3;', runner: 'scripts/breadcrumb-rendered-probe.mjs', probeCase: 'commons-detail-dark', logicalCase: 'content-default-case', diagnostic: 'breadcrumb content computed transform: expected none, observed lowercase' },
    { name: 'apply-per-item-crumb-lowercase', file: 'src/index.css', find: '.crumb .crumb-item-chrome { @apply lowercase; }', replace: '.crumb .crumb-item { @apply lowercase; }', runner: 'scripts/breadcrumb-rendered-probe.mjs', probeCase: 'commons-detail-dark', logicalCase: 'content-default-case', diagnostic: 'breadcrumb content computed transform: expected none, observed lowercase' },
    { name: 'remove-link-component-forwarding', file: 'src/ui/Breadcrumb.jsx', find: '<LinkComponent href={item.href} className="link">{content}</LinkComponent>', replace: '<a href={item.href}>{content}</a>', runner: 'scripts/breadcrumb.test.mjs', probeCase: 'custom-link-forwarding', logicalCase: 'custom-link-forwarding', diagnostic: 'breadcrumb custom link forwarding: expected custom-link marker and className=link' },
  ]
  assert.deepEqual(manifest.caseNames, requiredCases, 'breadcrumb manifest case names must match the required inventory')
  assert.deepEqual(manifest.sourceCaseNames, requiredSource, 'breadcrumb manifest source names must match the required inventory')
  assert.deepEqual(manifest.mountedCaseNames, requiredMounted, 'breadcrumb manifest mounted names must match the required inventory')
  assert.deepEqual(manifest.caseOwners, requiredOwners, 'breadcrumb manifest owners must match the required inventory')
  assert.deepEqual(manifest.execution?.source, requiredSource, 'breadcrumb source execution map must match the required source inventory')
  assert.deepEqual(manifest.execution?.mounted, requiredMounted, 'breadcrumb mounted execution map must match the required mounted inventory')
  assert.deepEqual(fixture.cases.map((testCase) => testCase.name), requiredCases, 'breadcrumb fixture case names must match the manifest')
  for (const testCase of fixture.cases) assert.equal(testCase.owner, requiredOwners[testCase.name], `${testCase.name} fixture owner must match the manifest`)
  assert.deepEqual(manifest.mutations, requiredMutations, 'breadcrumb mutation runner/probe/logical/diagnostic mapping must match the required contract')
  for (const mutation of manifest.mutations) {
    assert.ok(requiredCases.includes(mutation.probeCase), `${mutation.name} probe case is not in the required inventory`)
    assert.ok(requiredCases.includes(mutation.logicalCase), `${mutation.name} logical case is not in the required inventory`)
    assert.equal(manifest.caseOwners[mutation.probeCase], mutation.runner.endsWith('breadcrumb-rendered-probe.mjs') ? 'mounted' : 'source', `${mutation.name} probe case owner must match its runner`)
  }
}

function selectCaseIds({ raw, owner, required, selected, requireFull }) {
  const ids = parseCaseIds(raw, owner)
  if (selected) assert.deepEqual(ids, selected, `breadcrumb ${owner} mutation selection must equal its logical/probe case`)
  else if (requireFull) assert.deepEqual(ids, required, `breadcrumb ${owner} execution must equal the complete required inventory`)
  return ids
}

function parseCaseIds(raw, owner) {
  if (typeof raw !== 'string' || !raw.trim()) throw fixtureError(`explicit ${owner} case IDs are required`, `where: scripts/breadcrumb.test.mjs ${owner} selection; when: gate startup; what it means: an empty or owner-filtered run could pass without executing required cases; how to fix: pass the exact comma-separated ${owner} case IDs.`)
  const ids = raw.split(',').map((value) => value.trim())
  if (ids.some((value) => !value)) throw fixtureError(`empty ${owner} case ID in ${JSON.stringify(raw)}`, `where: scripts/breadcrumb.test.mjs ${owner} selection; when: gate startup; what it means: the required case inventory is ambiguous; how to fix: remove empty comma entries and pass exact IDs.`)
  if (new Set(ids).size !== ids.length) throw fixtureError(`duplicate ${owner} case ID in ${ids.join(',')}`, `where: scripts/breadcrumb.test.mjs ${owner} selection; when: gate startup; what it means: a case could be counted twice while another required case is skipped; how to fix: pass each required ${owner} case ID exactly once.`)
  for (const id of ids) {
    const testCase = fixture.cases.find((candidate) => candidate.name === id)
    if (!testCase) throw fixtureError(`unknown ${owner} case ${JSON.stringify(id)}`, `where: scripts/breadcrumb.test.mjs ${owner} selection; when: gate startup; what it means: the requested evidence case is not in the fixture; how to fix: pass only names from breadcrumb.yaml.`)
    if (testCase.owner !== owner) throw fixtureError(`${id} is owned by ${testCase.owner}, not ${owner}`, `where: scripts/breadcrumb.test.mjs ${owner} selection; when: gate startup; what it means: the wrong production path would be exercised; how to fix: pass the case to its owner-specific command.`)
  }
  return ids
}

function gitOutput(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function fixtureError(what, where) {
  return new Error(`breadcrumb fixture gate failed: what went wrong: ${what}; why: the named evidence inventory must be explicit and exact; ${where}; what it means: the requested gate cannot prove its contract; how to fix: correct the selection or manifest and rerun.`)
}

function loadFixture(path) {
  const source = readFileSync(path, 'utf8')
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (documents.length !== 1 || errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${path}: expected one strict YAML document with unique keys; received ${documents.length} document(s) and errors: ${errors.map((error) => error.message).join('; ')}`)
  }
  const value = documents[0].toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: fixture root must be an object`)
  return value
}
