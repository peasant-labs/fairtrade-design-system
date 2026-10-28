import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { loadFixturePair } from './mounted-parts.mjs'
import { renderedSearchRanges } from '../src/ui/transcript/search-highlights.js'

const { fixture } = loadFixturePair('scripts/testdata/transcript-search-ranges.yaml', 'scripts/testdata/transcript-search-ranges.manifest.yaml', { cases: 'requiredCases' })
const dom = new JSDOM('')
const previous = Object.getOwnPropertyDescriptor(globalThis, 'NodeFilter')
try {
  Object.defineProperty(globalThis, 'NodeFilter', { configurable: true, value: undefined })
  for (const row of fixture.cases) {
    const doc = row.detached ? dom.window.document.implementation.createHTMLDocument('') : dom.window.document
    if (row.detached) assert.equal(doc.defaultView, null, row.name)
    const root = doc.createElement('div')
    const paragraph = doc.createElement('p')
    for (const part of row.parts) {
      const span = doc.createElement('span')
      span.textContent = part
      // JSDOM does not perform layout; the mounted browser tests cover actual visibility.
      span.getClientRects = () => [{ width: 1, height: 1 }]
      paragraph.append(span)
    }
    root.append(paragraph)
    assert.deepEqual(renderedSearchRanges(root, row.query).map(range => range.toString()), row.expected, row.name)
  }
} finally {
  if (previous) Object.defineProperty(globalThis, 'NodeFilter', previous)
  else delete globalThis.NodeFilter
  dom.window.close()
}
console.log('transcript search ranges: passed')
