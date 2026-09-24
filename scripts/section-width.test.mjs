#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const GENERIC_DIAGNOSTIC = 'source: section width contract mismatch'
const GENERATED_DIAGNOSTIC = 'generated: base.css differs from section.band generator contract'

export function loadSectionWidthFixtures(root = ROOT) {
  const fixture = parseOne(readFileSync(resolve(root, 'scripts/testdata/section-width.yaml'), 'utf8'), 'section-width fixture')
  const manifest = parseOne(readFileSync(resolve(root, 'scripts/testdata/section-width.manifest.yaml'), 'utf8'), 'section-width manifest')
  validateInventory(fixture, manifest)
  return { fixture, manifest }
}

export function validateSectionWidthContract({ root = ROOT, fixture, manifest } = {}) {
  const loaded = fixture && manifest ? { fixture, manifest } : loadSectionWidthFixtures(root)
  const paths = defaultPaths(root)
  const source = readFileSync(paths.source, 'utf8')
  const generated = readFileSync(paths.generated, 'utf8')
  const generator = readFileSync(paths.generator, 'utf8')
  const design = readFileSync(paths.design, 'utf8')
  const transcriptSource = readFileSync(paths.transcriptSource, 'utf8')
  const transcriptFixtureSource = readFileSync(paths.transcriptFixture, 'utf8')
  const sourceRules = parseCssRules(stripCssComments(source))
  const generatedRules = parseCssRules(stripCssComments(generated))
  const results = []

  for (const [name, testCase] of Object.entries(loaded.fixture.sourceCases)) {
    switch (testCase.contract) {
      case 'bare-global-section-unconstrained': {
        const bare = sourceRules.filter((rule) => rule.selectors.includes(testCase.forbiddenSelector))
        if (bare.length) {
          const owned = bare.filter((rule) => Object.keys(rule.declarations).some((property) => testCase.forbiddenProperties.includes(property)))
          if (owned.length) fail({
            name,
            file: testCase.file,
            diagnostic: 'source: bare section base constraint restored',
            observed: JSON.stringify(owned),
            expected: `no ${testCase.forbiddenSelector} selector with ${testCase.forbiddenProperties.join(', ')}`,
            remedy: 'keep the base constraint on section.band and leave bare sections unconstrained',
          })
        }
        results.push(`${name}: no bare global section container`)
        break
      }
      case 'explicit-section-band': {
        assertExactRule({
          rules: sourceRules,
          name,
          file: testCase.file,
          selector: testCase.selector,
          declarations: testCase.declarations,
          diagnostic: 'source: section.band base container missing',
        })
        results.push(`${name}: ${testCase.selector} owns the base container`)
        break
      }
      case 'iu-host-guard': {
        assertExactRule({
          rules: sourceRules,
          name,
          file: testCase.file,
          selector: testCase.selector,
          declarations: testCase.declarations,
          diagnostic: GENERIC_DIAGNOSTIC,
        })
        results.push(`${name}: ${testCase.selector} retains the host declarations`)
        break
      }
      case 'iu-host-band-exempt': {
        const required = sourceRules.filter((rule) => rule.selectors.includes(testCase.requiredSelector))
        const forbidden = sourceRules.filter((rule) => rule.selectors.includes(testCase.forbiddenSelector))
        if (required.length !== 1 || forbidden.length) fail({
          name,
          file: testCase.file,
          diagnostic: GENERIC_DIAGNOSTIC,
          observed: JSON.stringify({ required: required.length, forbidden: forbidden.length }),
          expected: `one ${testCase.requiredSelector} rule and no ${testCase.forbiddenSelector} rule`,
          remedy: 'keep the :not(.band) exemption exact on the in-use host guard',
        })
        results.push(`${name}: banded elements are outside the bare-section host guard`)
        break
      }
      case 'retained-host-guards': {
        for (const guard of testCase.guards) assertRuleContains({ rules: sourceRules, name, file: testCase.file, ...guard, diagnostic: GENERIC_DIAGNOSTIC })
        results.push(`${name}: ${testCase.guards.map((guard) => guard.selector).join(', ')} retained`)
        break
      }
      case 'retained-txn-center': {
        assertRuleContains({ rules: sourceRules, name, file: testCase.file, ...testCase, diagnostic: GENERIC_DIAGNOSTIC })
        results.push(`${name}: transcript semantic section remains explicit`)
        break
      }
      case 'generated-explicit-section-band': {
        assertExactRule({ rules: generatedRules, name, file: testCase.file, ...testCase, diagnostic: GENERATED_DIAGNOSTIC })
        results.push(`${name}: generated ${testCase.selector} matches the base contract`)
        break
      }
      case 'generated-excludes-iu': {
        const present = generatedRules.flatMap((rule) => rule.selectors).filter((selector) => testCase.forbiddenSelectors.includes(selector))
        if (present.length) fail({
          name,
          file: testCase.file,
          diagnostic: GENERATED_DIAGNOSTIC,
          observed: JSON.stringify(present),
          expected: `generated base excludes ${testCase.forbiddenSelectors.join(', ')}`,
          remedy: 'emit only the base section.band contract from the package generator',
        })
        results.push(`${name}: component host CSS is absent from generated base output`)
        break
      }
      case 'generator-source-sync': {
        const requiredMissing = testCase.requiredSnippets.filter((snippet) => !generator.includes(snippet))
        const forbiddenPresent = testCase.forbiddenSnippets.filter((snippet) => generator.includes(snippet))
        if (requiredMissing.length || forbiddenPresent.length) fail({
          name,
          file: testCase.file,
          diagnostic: GENERATED_DIAGNOSTIC,
          observed: JSON.stringify({ requiredMissing, forbiddenPresent }),
          expected: 'generator emits the exact section.band rule and no bare-section rule',
          remedy: 'update buildBaseCss source, then regenerate packages/tokens/base.css',
        })
        const generatedRule = generatedRules.find((rule) => rule.selectors.includes('section.band'))
        const authoredRule = sourceRules.find((rule) => rule.selectors.includes('section.band'))
        if (!generatedRule || !authoredRule || generatedRule.declarations['max-width'] !== 'var(--maxw)' || generatedRule.declarations.margin !== '0 auto' || JSON.stringify(generatedRule.declarations) !== JSON.stringify(authoredRule.declarations)) fail({
          name,
          file: testCase.file,
          diagnostic: GENERATED_DIAGNOSTIC,
          observed: JSON.stringify(generatedRule ?? null),
          expected: 'generated section.band max-width and centering declarations',
          remedy: 'regenerate packages/tokens/base.css from the corrected generator source',
        })
        results.push(`${name}: generator source and generated base rule agree`)
        break
      }
      case 'design-contract': {
        assertSnippets({ text: design, ...testCase, name })
        const sectionClasses = [...design.matchAll(/section\.([a-z][\w-]*)/g)].map((match) => `section.${match[1]}`)
        const unexpected = [...new Set(sectionClasses)].filter((selector) => selector !== 'section.band')
        if (unexpected.length) fail({
          name,
          file: testCase.file,
          diagnostic: GENERIC_DIAGNOSTIC,
          observed: JSON.stringify(unexpected),
          expected: 'section.band is the only documented section container class',
          remedy: 'document the existing section.band contract without inventing another class',
        })
        results.push(`${name}: bare, band, and host ownership are documented`)
        break
      }
      case 'transcript-source-rationale': {
        assertSnippets({ text: transcriptSource, ...testCase, name })
        results.push(`${name}: stale global-reset rationale removed from source guard`)
        break
      }
      case 'transcript-fixture-rationale': {
        assertSnippets({ text: transcriptFixtureSource, ...testCase, name })
        const transcriptFixture = parseOne(transcriptFixtureSource, 'transcript-composite-width fixture')
        const invariant = transcriptFixture.invariants?.find((entry) => entry.id === 'txn-center-retains-semantic-section-neutralizer')
        if (!invariant || !['max-width: none;', 'margin-inline: 0;', 'padding-inline: 0;'].every((declaration) => invariant.mustContainAll?.includes(declaration))) fail({
          name,
          file: testCase.file,
          diagnostic: GENERIC_DIAGNOSTIC,
          observed: JSON.stringify(invariant ?? null),
          expected: 'txn-center-retains-semantic-section-neutralizer with explicit width, margin, and padding resets',
          remedy: 'retain the named .txn-center declarations in the transcript fixture',
        })
        results.push(`${name}: transcript fixture retains the semantic host guard`)
        break
      }
      case 'band-component-padding': {
        assertExactRule({ rules: sourceRules, name, file: testCase.file, ...testCase, diagnostic: GENERIC_DIAGNOSTIC })
        results.push(`${name}: .band retains padding and border ownership`)
        break
      }
      case 'existing-band-usage': {
        for (const expected of testCase.expectedUsage) {
          const observed = countBandSections(resolve(root, expected.path))
          if (observed !== expected.count) fail({
            name,
            file: expected.path,
            diagnostic: GENERIC_DIAGNOSTIC,
            observed: `${observed} section.band use(s)`,
            expected: `${expected.count} section.band use(s)`,
            remedy: 'retain the existing explicit-band usage grounding; this correction does not migrate JSX',
          })
        }
        results.push(`${name}: existing usage remains 1 + 5 + 6 + 21 across the named owners`)
        break
      }
      default:
        fail({
          name,
          file: testCase.file,
          diagnostic: GENERIC_DIAGNOSTIC,
          observed: testCase.contract,
          expected: 'a contract implemented by this source guard',
          remedy: 'add the named contract to the source guard and independent manifest',
        })
    }
  }
  return results
}

function validateInventory(fixture, manifest) {
  assertObject(fixture, 'section-width fixture root')
  assertObject(manifest, 'section-width manifest root')
  assertExactKeys(fixture, ['schema', 'sourceCases', 'mountedCases', 'geometry', 'mutationCases'], 'section-width fixture')
  assertExactKeys(manifest, ['schema', 'sourceCases', 'sourceFiles', 'mountedCases', 'mutationCases'], 'section-width manifest')
  assert.equal(fixture.schema, 'fairtrade-section-width-v1')
  assert.equal(manifest.schema, 'fairtrade-section-width-manifest-v1')
  assertObject(fixture.sourceCases, 'section-width sourceCases')
  assertObject(manifest.sourceCases, 'section-width manifest sourceCases')
  assert.deepEqual(Object.keys(fixture.sourceCases).sort(), Object.keys(manifest.sourceCases).sort(), 'section-width source cases differ from the independent name manifest')
  for (const [name, testCase] of Object.entries(fixture.sourceCases)) {
    if (testCase.contract !== manifest.sourceCases[name]) throw new Error(`section-width source case ${JSON.stringify(name)} contract differs between fixture (${JSON.stringify(testCase.contract)}) and independent manifest (${JSON.stringify(manifest.sourceCases[name])})`)
  }
  assertUnique(Object.keys(fixture.sourceCases), 'section-width source case names')
  assertUnique(Object.keys(fixture.mountedCases), 'section-width mounted case names')
  assertUnique(Object.keys(fixture.mutationCases), 'section-width mutation case names')
  assertExactSet(fixture.mountedCases, manifest.mountedCases, 'mounted case names')
  assert.deepEqual(Object.keys(fixture.mutationCases).sort(), Object.keys(manifest.mutationCases).sort(), 'section-width mutation cases differ from the independent name manifest')
  for (const [name, testCase] of Object.entries(fixture.mutationCases)) {
    if (testCase.diagnostic !== manifest.mutationCases[name]) throw new Error(`section-width mutation ${JSON.stringify(name)} diagnostic differs between fixture (${JSON.stringify(testCase.diagnostic)}) and independent manifest (${JSON.stringify(manifest.mutationCases[name])})`)
  }
  const mountedThemes = Object.values(fixture.mountedCases).map((testCase) => testCase.theme)
  assertUnique(mountedThemes, 'section-width mounted themes')
  if (!Object.values(fixture.mountedCases).every((testCase) => testCase.theme === 'dark' || testCase.theme === 'light')) {
    throw new Error('section-width contract inventory rejected unsupported mounted theme names; keep the stable dark/light cases')
  }
  const usedFiles = new Set()
  for (const testCase of Object.values(fixture.sourceCases)) {
    assert.equal(typeof testCase.file, 'string', `section-width source case file must be a string, received ${JSON.stringify(testCase)}`)
    if (!manifest.sourceFiles.includes(testCase.file)) throw new Error(`section-width contract inventory rejected unknown source owner ${JSON.stringify(testCase.file)}; update the independent manifest only when ownership changes`)
    usedFiles.add(testCase.file)
    for (const expected of testCase.expectedUsage ?? []) usedFiles.add(expected.path)
  }
  for (const file of manifest.sourceFiles) if (!usedFiles.has(file)) throw new Error(`section-width contract inventory contains unused source owner ${JSON.stringify(file)}; remove it or add the named case`)
}

function assertExactRule({ rules, name, file, selector, declarations, diagnostic }) {
  const matches = rules.filter((rule) => rule.selectors.length === 1 && rule.selectors[0] === normalizeSelector(selector))
  if (matches.length !== 1) fail({ name, file, diagnostic, observed: `${matches.length} exact ${JSON.stringify(selector)} rule(s)`, expected: `one exact ${JSON.stringify(selector)} rule`, remedy: `restore one exact ${selector} rule with the fixture declarations` })
  const observed = matches[0].declarations
  const expected = Object.fromEntries(Object.entries(declarations).map(([property, value]) => [property, normalizeValue(String(value))]))
  if (JSON.stringify(observed) !== JSON.stringify(expected)) fail({ name, file, diagnostic, observed: JSON.stringify(observed), expected: JSON.stringify(expected), remedy: `restore the exact declarations on ${selector}` })
}

function assertRuleContains({ rules, name, file, selector, declarations, diagnostic }) {
  const expectedSelector = splitSelectors(selector).map(normalizeSelector)
  const matches = rules.filter((rule) => JSON.stringify(rule.selectors) === JSON.stringify(expectedSelector))
  if (!matches.length) fail({ name, file, diagnostic, observed: `no exact ${JSON.stringify(selector)} rule`, expected: `a retained ${JSON.stringify(selector)} rule`, remedy: `restore the retained host rule ${selector}` })
  const satisfied = matches.some((rule) => Object.entries(declarations).every(([property, value]) => rule.declarations[property] === normalizeValue(String(value))))
  if (!satisfied) fail({ name, file, diagnostic, observed: JSON.stringify(matches.map((rule) => rule.declarations)), expected: JSON.stringify(declarations), remedy: `restore the named declarations on ${selector}` })
}

function assertSnippets({ text, requiredSnippets, forbiddenSnippets, name, file }) {
  const missing = requiredSnippets.filter((snippet) => !text.includes(snippet))
  const forbidden = forbiddenSnippets.filter((snippet) => text.includes(snippet))
  if (missing.length || forbidden.length) fail({ name, file, diagnostic: GENERIC_DIAGNOSTIC, observed: JSON.stringify({ missing, forbidden }), expected: JSON.stringify({ requiredSnippets, forbiddenSnippets }), remedy: 'update the stale contract text while preserving the named guard and declarations' })
}

function fail({ name, file, diagnostic, observed, expected, remedy }) {
  throw new Error([
    diagnostic,
    `case: ${name}`,
    `file: ${file}`,
    `observed: ${observed}`,
    `expected: ${expected}`,
    `remedy: ${remedy}`,
  ].join('\n'))
}

function parseOne(source, label) {
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  assert.equal(documents.length, 1, `${label} must contain exactly one YAML document`)
  assert.deepEqual(errors, [], `${label} YAML is invalid: ${errors.map((error) => error.message).join('; ')}`)
  return documents[0].toJS()
}

function assertObject(value, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`)
}

function assertExactKeys(value, expected, label) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} keys differ from the strict contract`)
}

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`)
}

function assertExactSet(value, expected, label) {
  assert.deepEqual([...Object.keys(value)].sort(), [...expected].sort(), `${label} differ from the independent manifest`)
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
}

function parseCssRules(css) {
  const rules = []
  scanRules(css, 0, css.length, rules)
  return rules
}

function scanRules(css, start, end, rules) {
  let preludeStart = start
  for (let index = start; index < end; index++) {
    const character = css[index]
    if (character === ';') {
      preludeStart = index + 1
      continue
    }
    if (character !== '{') continue
    const prelude = css.slice(preludeStart, index).trim()
    const close = matchingBrace(css, index, end)
    const openAtRule = /^@(layer|media|supports|container)\b/.test(prelude)
    if (openAtRule) scanRules(css, index + 1, close, rules)
    else if (prelude && !prelude.startsWith('@')) rules.push({ selectors: splitSelectors(prelude).map(normalizeSelector), declarations: parseDeclarations(css.slice(index + 1, close)) })
    index = close
    preludeStart = close + 1
  }
}

function matchingBrace(css, open, end) {
  let depth = 0
  for (let index = open; index < end; index++) {
    if (css[index] === '{') depth++
    else if (css[index] === '}' && --depth === 0) return index
  }
  throw new Error(`section-width CSS parser found an unclosed block beginning at byte ${open}`)
}

function splitSelectors(selectorList) {
  const selectors = []
  let start = 0
  let parentheses = 0
  for (let index = 0; index < selectorList.length; index++) {
    const character = selectorList[index]
    if (character === '(') parentheses++
    else if (character === ')') parentheses--
    else if (character === ',' && parentheses === 0) {
      selectors.push(selectorList.slice(start, index))
      start = index + 1
    }
  }
  selectors.push(selectorList.slice(start))
  return selectors
}

function normalizeSelector(selector) {
  return selector.trim().replace(/\s*([>+~])\s*/g, ' $1 ').replace(/\s+/g, ' ')
}

function parseDeclarations(body) {
  const declarations = {}
  let start = 0
  let parentheses = 0
  for (let index = 0; index <= body.length; index++) {
    const character = body[index]
    if (character === '(') parentheses++
    else if (character === ')') parentheses--
    if ((character === ';' && parentheses === 0) || index === body.length) {
      const declaration = body.slice(start, index).trim()
      if (declaration) {
        const colon = declaration.indexOf(':')
        if (colon > 0) declarations[declaration.slice(0, colon).trim()] = normalizeValue(declaration.slice(colon + 1))
      }
      start = index + 1
    }
  }
  return declarations
}

function normalizeValue(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function countBandSections(path) {
  const pattern = /<section\b[^>]*className=["'][^"']*\bband\b[^"']*["']/g
  if (!statSync(path).isDirectory()) return (readFileSync(path, 'utf8').match(pattern) ?? []).length
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsx'))
    .reduce((total, entry) => total + (readFileSync(resolve(path, entry.name), 'utf8').match(pattern) ?? []).length, 0)
}

function defaultPaths(root) {
  return {
    source: resolve(root, 'src/index.css'),
    generated: resolve(root, 'packages/tokens/base.css'),
    generator: resolve(root, 'scripts/gen-llm-artifacts.mjs'),
    design: resolve(root, 'llm/DESIGN.md'),
    transcriptSource: resolve(root, 'scripts/transcript-composite-width.test.mjs'),
    transcriptFixture: resolve(root, 'scripts/testdata/transcript-composite-width-invariants.yaml'),
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const results = validateSectionWidthContract()
    for (const result of results) console.log(`PASS ${result}`)
    console.log(`section-width source guard: ${results.length} named source cases passed`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
