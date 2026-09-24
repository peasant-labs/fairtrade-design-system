#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const fixture = loadFixture(resolve(HERE, 'testdata/breadcrumb.yaml'))
const manifest = loadFixture(resolve(HERE, 'testdata/breadcrumb.manifest.yaml'))
const sourceCases = fixture.cases.filter((testCase) => testCase.owner === 'source' && (!process.env.BREADCRUMB_SOURCE_CASE || testCase.name === process.env.BREADCRUMB_SOURCE_CASE))
const sourceMutation = process.env.BREADCRUMB_MUTATION_FILE
  ? { file: process.env.BREADCRUMB_MUTATION_FILE, find: process.env.BREADCRUMB_MUTATION_FIND, replace: process.env.BREADCRUMB_MUTATION_REPLACE }
  : null
validateFixtureInventory()

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

  for (const testCase of sourceCases) {
    await verifyCase(Breadcrumb, testCase, icons)
  }
} finally {
  await server.close()
}

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
    assert.ok(nav, `nav landmark is missing`)
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

function inMemorySourceMutation(mutation) {
  const sourcePath = normalize(resolve(ROOT, mutation.file))
  const source = readFileSync(sourcePath, 'utf8')
  const occurrences = source.split(mutation.find).length - 1
  if (occurrences !== 1) throw new Error(`breadcrumb source mutation target ${mutation.file} must occur exactly once; received ${occurrences}`)
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
  assert.deepEqual(manifest.caseNames, requiredCases, 'breadcrumb manifest case names must match the required inventory')
  assert.deepEqual(manifest.sourceCaseNames, requiredSource, 'breadcrumb manifest source names must match the required inventory')
  assert.deepEqual(manifest.mountedCaseNames, requiredMounted, 'breadcrumb manifest mounted names must match the required inventory')
  assert.deepEqual(fixture.cases.map((testCase) => testCase.name), requiredCases, 'breadcrumb fixture case names must match the manifest')
  assert.deepEqual(manifest.mutations.map((mutation) => mutation.name), ['restore-global-crumb-lowercase', 'apply-per-item-crumb-lowercase', 'remove-link-component-forwarding'], 'breadcrumb mutation names must match the required inventory')
  for (const mutation of manifest.mutations) {
    for (const field of ['name', 'file', 'find', 'replace', 'designatedCase', 'diagnostic']) assert.equal(typeof mutation[field], 'string', `${mutation.name} manifest field ${field}`)
    assert.ok(requiredCases.includes(mutation.designatedCase), `${mutation.name} designated case is not in the required inventory`)
  }
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
