#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { Harness as SchemaHarness } from '@peasant-labs/schema'
import { JSDOM } from 'jsdom'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import YAML from 'yaml'
import { PROVIDER_MUTATION_STRATEGY_NAMES } from './provider-harnesses.mutation-strategies.mjs'
import {
  PROVIDER_ACCENTS,
  PROVIDER_BRANDS,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_HARNESSES,
  providerAccent,
  providerBrand,
  providerDisplayName,
} from '../src/ui/provider-policy.js'
import { providerLabel } from '../src/ui/commons/providers.js'

const fixture = loadStrictYaml('testdata/provider-harnesses.yaml')
const manifest = loadStrictYaml('testdata/provider-harnesses.manifest.yaml')
const providerModule = process.env.FAIRTRADE_PROVIDER_MODULE
  ? pathToFileURL(process.env.FAIRTRADE_PROVIDER_MODULE).href
  : new URL('../dist/lib/ui.js', import.meta.url).href
const ui = await import(`${providerModule}?provider-contract=${Date.now()}`)
const graph = await import(`${new URL('./graph.js', providerModule).href}?provider-contract=${Date.now()}`)
const failures = []

// Every observable assertion in this file goes through `check()`, which both
// records the pass/fail outcome AND increments a total inventory counter.
// The mutation runner (provider-harnesses.mutations.mjs) reports this
// inventory (via the PROVIDER_HARNESS_REPORT trailer below) so it can prove
// structurally that (a) the SAME number of checks ran under a mutation as
// under a clean baseline (nothing was silently skipped by an early throw),
// and (b) exactly one designated check failed while every other check in
// the inventory passed -- not merely that some substring appeared anywhere
// in the process's combined stdout/stderr.
let totalChecks = 0
function check(passed, message) {
  totalChecks += 1
  if (!passed) failures.push(message)
  return passed
}

validateManifest(manifest)
validateFixture(fixture, manifest)

const expectedSlugs = fixture.harnesses.map((entry) => entry.slug)
compareValues('schema Harness values', Object.values(SchemaHarness), expectedSlugs)
compareValues('provider policy inventory', PROVIDER_HARNESSES, expectedSlugs)
compareValues('provider display-name keys', Object.keys(PROVIDER_DISPLAY_NAMES), expectedSlugs)
compareValues('provider brand keys', Object.keys(PROVIDER_BRANDS), expectedSlugs)
compareValues('provider accent keys', Object.keys(PROVIDER_ACCENTS), expectedSlugs)
compareValues('Fairtrade provider policy keys', Object.keys(ui.PROVIDER_ACCENT), expectedSlugs)
compareValues('provider rendering surfaces', fixture.surfaces, manifest.requiredSurfaceCases)

for (const entry of fixture.harnesses) {
  const policyAccent = providerAccent(entry.slug)
  check(
    policyAccent === entry.accent && ui.PROVIDER_ACCENT[entry.slug] === entry.accent,
    `${entry.slug}: accent expected ${entry.accent}, received policy=${policyAccent} ui=${ui.PROVIDER_ACCENT[entry.slug]}`,
  )
  const policyBrand = providerBrand(entry.slug)
  check(
    policyBrand === entry.brand && ui.resolveBrand(policyBrand) === entry.brand,
    `${entry.slug}: brand expected ${entry.brand}, received policy=${policyBrand} resolved=${ui.resolveBrand(policyBrand)}`,
  )
  const names = [providerDisplayName(entry.slug), ui.providerDisplayName(entry.slug), providerLabel(entry.slug)]
  check(
    names.every((name) => name === entry.accessibleName),
    `${entry.slug}: display name expected ${entry.accessibleName}, received ${JSON.stringify(names)}`,
  )

  const rendered = {
    'turn-card': renderToStaticMarkup(React.createElement(ui.TranscriptTurnCard, {
      turn: { index: 1, role: 'assistant', label: '1', content: 'provider rendering', depth: 0, provider: entry.slug, toolCalls: [], annotations: [] },
    })),
    'graph-turn-node': renderToStaticMarkup(React.createElement(ui.GraphTurnNode, {
      role: 'assistant', provider: entry.slug, turnNumber: 1, contentPreview: 'provider rendering', toolCount: 0, totalTokens: 0,
    })),
    'graph-legend': renderToStaticMarkup(React.createElement(ui.GraphLegend, {
      items: [{ kind: 'assistant', label: entry.slug, provider: entry.slug }],
    })),
    changes: renderToStaticMarkup(React.createElement(graph.Changes, {
      payload: {
        repoFound: true,
        defaultBranch: 'main',
        changes: [],
        recentCommits: [],
        sessions: [{
          sessionId: `provider-${entry.slug}`,
          title: `${entry.accessibleName} session`,
          harness: entry.slug,
          startMs: 1,
          hasCommitBinding: false,
        }],
      },
      nowMs: 1,
    })),
  }
  for (const surface of fixture.surfaces) {
    const markup = rendered[surface]
    check(typeof markup === 'string' && markup.length > 0, `${entry.slug}: ${surface} did not render`)
    if (surface !== 'changes') {
      check(markup?.includes(`var(--${entry.accent})`), `${entry.slug}: ${surface} did not render canonical accent ${entry.accent}`)
    }
    if (surface === 'turn-card' || surface === 'changes') {
      const document = new JSDOM(markup).window.document
      check(
        !!document.querySelector(`svg.brand[data-brand="${entry.brand}"]`),
        `${entry.slug}: brand expected ${entry.brand} on mounted ${surface}`,
      )
      if (entry.slug === fixture.mountedHarness) {
        check(
          document.querySelector(`svg.brand[data-brand="${entry.brand}"]`)?.getAttribute('viewBox') === fixture.mountedMark.viewBox
            && document.querySelector(`svg.brand[data-brand="${entry.brand}"] path`)?.getAttribute('d') === fixture.mountedMark.path,
          `${entry.slug}: ${surface} did not render the authoritative Strike mark`,
        )
      }
      if (surface === 'turn-card') {
        check(
          document.querySelector('.txn-rolelabel')?.textContent?.includes(entry.accessibleName),
          `${entry.slug}: accessible name ${entry.accessibleName} was not mounted on turn-card`,
        )
      } else {
        check(
          document.querySelector('.pv-name-label')?.textContent === entry.slug,
          `${entry.slug}: Changes did not mount the canonical harness slug`,
        )
      }
    }
  }
}

for (const entry of fixture.brands) {
  const markup = renderToStaticMarkup(React.createElement(ui.BrandMark, { name: entry.key, label: true }))
  const document = new JSDOM(markup).window.document
  const mark = document.querySelector(`svg.brand[data-brand="${entry.key}"]`)
  check(ui.resolveBrand(entry.key) === entry.key, `${entry.key}: canonical brand key did not resolve to itself`)
  check(
    mark?.getAttribute('aria-label') === entry.accessibleName,
    `${entry.key}: informative brand mark expected accessible name ${entry.accessibleName}`,
  )
  if (entry.key === fixture.mountedMark.brand) {
    check(
      mark?.getAttribute('viewBox') === fixture.mountedMark.viewBox
        && mark.querySelector('path')?.getAttribute('d') === fixture.mountedMark.path,
      `${entry.key}: BrandMark did not render the authoritative Strike mark`,
    )
  }
}

for (const entry of fixture.aliases) {
  const markup = renderToStaticMarkup(React.createElement(ui.BrandMark, { name: entry.name }))
  const document = new JSDOM(markup).window.document
  check(ui.resolveBrand(entry.name) === entry.brand, `${entry.name}: alias expected brand ${entry.brand}`)
  check(
    !!document.querySelector(`svg.brand[data-brand="${entry.brand}"]`),
    `${entry.name}: alias did not mount canonical brand ${entry.brand}`,
  )
}

const absentProviderMarkup = [
  renderToStaticMarkup(React.createElement(ui.TranscriptTurnCard, { turn: { index: 1, role: 'assistant', label: '1', content: '', depth: 0, toolCalls: [], annotations: [] } })),
  renderToStaticMarkup(React.createElement(ui.GraphTurnNode, { role: 'assistant', turnNumber: 1, contentPreview: '', toolCount: 0, totalTokens: 0 })),
  renderToStaticMarkup(React.createElement(ui.GraphLegend, { items: [{ kind: 'assistant', label: 'agent' }] })),
]
check(
  absentProviderMarkup.every((markup) => markup.includes(`var(--${fixture.absentProviderAccent})`)),
  'absent provider: every optional provider surface must use the declared amber fallback',
)

const mounted = fixture.harnesses.find((entry) => entry.slug === fixture.mountedHarness)
if (check(!!mounted, 'mountedHarness must identify a fixture harness')) {
  const markup = renderToStaticMarkup(React.createElement('div', null,
    React.createElement(ui.ProviderIcon, { harness: mounted.slug, accent: true, label: true }),
    React.createElement(ui.ProviderTag, { harness: mounted.slug, accent: true }),
    React.createElement(ui.ProviderName, { harness: mounted.slug, accent: true }),
    React.createElement(ui.AccentLegend),
  ))
  const document = new JSDOM(markup).window.document
  check(
    !!document.querySelector(`svg[aria-label="${mounted.accessibleName}"]`),
    `${mounted.slug}: accessible name ${mounted.accessibleName} was not mounted`,
  )
  const mountedBrandMarks = [...document.querySelectorAll(`svg.brand[data-brand="${mounted.brand}"]`)]
  check(
    mountedBrandMarks.length === fixture.expectedMountedBrandCount,
    `${mounted.slug}: expected ${fixture.expectedMountedBrandCount} mounted ${mounted.brand} marks, received ${mountedBrandMarks.length}`,
  )
  check(
    mountedBrandMarks.every((mark) => mark.getAttribute('viewBox') === fixture.mountedMark.viewBox
      && mark.querySelector('path')?.getAttribute('d') === fixture.mountedMark.path),
    `${mounted.slug}: mounted primitives did not render the authoritative Strike mark`,
  )
  const mountedLabels = [...document.querySelectorAll('.pv-tag, .pv-name')].filter((node) => node.textContent?.trim() === mounted.slug)
  check(mountedLabels.length === 2, `${mounted.slug}: tag and name did not both mount the canonical slug`)
  const legendRows = [...document.querySelectorAll('.pv-legend-row')]
  check(
    legendRows.length === fixture.expectedHarnessCount,
    `mounted legend: expected ${fixture.expectedHarnessCount} rows, received ${legendRows.length}`,
  )
  const mountedLegend = legendRows.find((row) => row.querySelector('.pv-legend-name')?.textContent === mounted.slug)
  check(
    mountedLegend?.querySelector('.pv-legend-token')?.textContent === mounted.accent,
    `${mounted.slug}: accent ${mounted.accent} was not mounted in the legend`,
  )
}

for (const invalidCase of fixture.invalidHarnesses) {
  const invalid = invalidCase.value
  const calls = [
    ['ProviderIcon', () => renderToStaticMarkup(React.createElement(ui.ProviderIcon, { harness: invalid }))],
    ['public accent helper', () => ui.providerAccent(invalid)],
    ['turn-card', () => renderToStaticMarkup(React.createElement(ui.TranscriptTurnCard, { turn: { index: 1, role: 'assistant', label: '1', content: '', depth: 0, provider: invalid, toolCalls: [], annotations: [] } }))],
    ['graph-turn-node', () => renderToStaticMarkup(React.createElement(ui.GraphTurnNode, { role: 'assistant', provider: invalid, turnNumber: 1, contentPreview: '', toolCount: 0, totalTokens: 0 }))],
    ['graph-legend', () => renderToStaticMarkup(React.createElement(ui.GraphLegend, { items: [{ kind: 'assistant', label: 'invalid', provider: invalid }] }))],
    ['changes', () => renderToStaticMarkup(React.createElement(graph.Changes, {
      payload: {
        repoFound: true,
        defaultBranch: 'main',
        changes: [],
        recentCommits: [],
        sessions: [{ sessionId: 'invalid-provider', title: 'Invalid provider', harness: invalid, startMs: 1, hasCommitBinding: false }],
      },
      nowMs: 1,
    }))],
    ['public display helper', () => ui.providerDisplayName(invalid)],
    ['commons provider label', () => providerLabel(invalid)],
  ]
  for (const [surface, call] of calls) {
    let error
    try {
      call()
    } catch (cause) {
      error = cause
    }
    const message = error instanceof Error ? error.message : ''
    check(
      message.includes('outside the canonical @peasant-labs/schema Harness')
        && message.includes('src/ui/provider-policy.js')
        && message.includes('the caller must validate its wire boundary'),
      `invalid harness case ${invalidCase.id} (${JSON.stringify(invalid)}) did not fail loudly through ${surface}`,
    )
  }
}

// Machine-readable trailer: the sole channel the mutation runner reads to
// prove structural rigor (total inventory size, failed count, and the exact
// failure text set) instead of grepping combined stdout/stderr for a
// substring. Printed on BOTH the pass and fail paths so a clean baseline run
// (no mutation applied) reports its own inventory size for comparison.
console.log(`PROVIDER_HARNESS_REPORT=${JSON.stringify({ totalChecks, failedChecks: failures.length, failures })}`)

if (failures.length > 0) {
  console.error([
    'provider harness verification failed.',
    'What went wrong: the canonical harness inventory, provider display policy, or mounted provider rendering diverged.',
    'Why it happened: a schema harness was omitted, relabeled, recolored, or widened to an arbitrary string without an explicit display decision.',
    'Where: src/ui/ProviderIcon.jsx, src/ui/BrandMark.jsx, and scripts/testdata/provider-harnesses*.yaml.',
    `When: focused provider harness verification (${failures.join('; ')}).`,
    'What it means: a canonical transcript provider may be missing or misidentified, or an untrusted provider string may render as a trusted brand.',
    'How to fix: restore the exact canonical Harness mapping and mounted rendering, rebuild dist/lib, then rerun pnpm test:provider-harnesses.',
  ].join('\n'))
  process.exit(1)
}

console.log(`provider harnesses: ${fixture.harnesses.length} canonical providers, mounted ${fixture.mountedHarness}, and ${fixture.invalidHarnesses.length} fail-loud values passed.`)

function validateManifest(value) {
  check(exactFieldsBool(value, ['expectedMutationCount', 'requiredSurfaceCases', 'requiredBrandCases', 'requiredAliasCases', 'requiredInvalidHarnessCases', 'mutations']), 'manifest: root fields must be exact')
  for (const field of ['requiredSurfaceCases', 'requiredBrandCases', 'requiredAliasCases', 'requiredInvalidHarnessCases']) {
    check(uniqueStrings(value[field], false), `manifest: ${field} must contain unique non-empty case identities`)
  }
  check(Array.isArray(value.mutations) && value.mutations.length === value.expectedMutationCount, 'manifest: mutations must match expectedMutationCount')
  for (const [index, mutation] of (value.mutations ?? []).entries()) {
    const semantic = typeof mutation?.strategy === 'string'
    const fields = semantic
      ? ['name', 'target', 'strategy', 'expectedFailedCheckCount', 'expectedError']
      : ['name', 'target', 'find', 'replace', 'expectedFailedCheckCount', 'expectedError']
    check(exactFieldsBool(mutation, fields), `manifest.mutations[${index}]: fields must be exact`)
    check(['provider-policy', 'ui'].includes(mutation?.target), `manifest.mutations[${index}]: target is unsupported`)
    for (const field of semantic ? ['name', 'target', 'strategy', 'expectedError'] : ['name', 'target', 'find', 'replace', 'expectedError']) {
      check(typeof mutation?.[field] === 'string' && mutation[field].length > 0, `manifest.mutations[${index}]: ${field} must be non-empty`)
    }
    if (semantic) check(PROVIDER_MUTATION_STRATEGY_NAMES.includes(mutation.strategy), `manifest.mutations[${index}]: strategy is unsupported`)
    check(Number.isInteger(mutation?.expectedFailedCheckCount) && mutation.expectedFailedCheckCount >= 1, `manifest.mutations[${index}]: expectedFailedCheckCount must be a positive integer`)
  }
  check(uniqueStrings((value.mutations ?? []).map((mutation) => mutation?.name), false), 'manifest: mutation names must be unique')
}

function validateFixture(value, manifestValue) {
  check(exactFieldsBool(value, ['expectedHarnessCount', 'expectedBrandCount', 'expectedAliasCount', 'expectedInvalidHarnessCount', 'expectedSurfaceCount', 'expectedMountedBrandCount', 'absentProviderAccent', 'mountedHarness', 'mountedMark', 'surfaces', 'brands', 'aliases', 'harnesses', 'invalidHarnesses']), 'fixture: root fields must be exact')
  for (const [count, list] of [
    ['expectedHarnessCount', 'harnesses'],
    ['expectedBrandCount', 'brands'],
    ['expectedAliasCount', 'aliases'],
    ['expectedInvalidHarnessCount', 'invalidHarnesses'],
    ['expectedSurfaceCount', 'surfaces'],
  ]) {
    check(Number.isInteger(value[count]) && value[count] === value[list]?.length, `fixture: ${count} must match ${list}`)
  }
  check(Number.isInteger(value.expectedMountedBrandCount) && value.expectedMountedBrandCount > 0, 'fixture: expectedMountedBrandCount must be a positive integer')
  check(value.absentProviderAccent === 'amber', 'fixture: absentProviderAccent must be amber')
  validateMountedMark(value.mountedMark, 'fixture.mountedMark')
  compareValues('fixture surface case identities', value.surfaces, manifestValue.requiredSurfaceCases)
  check(Array.isArray(value.harnesses) && value.harnesses.length === value.expectedHarnessCount, 'fixture: harnesses must match expectedHarnessCount')
  const slugs = []
  for (const [index, entry] of (value.harnesses ?? []).entries()) {
    check(exactFieldsBool(entry, ['slug', 'accessibleName', 'brand', 'accent']), `fixture.harnesses[${index}]: fields must be exact`)
    for (const field of ['slug', 'accessibleName', 'brand', 'accent']) {
      check(typeof entry?.[field] === 'string' && entry[field].length > 0, `fixture.harnesses[${index}]: ${field} must be non-empty`)
    }
    slugs.push(entry?.slug)
  }
  compareValues('fixture harness slugs', slugs, Object.values(SchemaHarness))
  check(value.expectedHarnessCount === Object.values(SchemaHarness).length, 'fixture: expectedHarnessCount must match the schema Harness inventory')

  const brandKeys = []
  for (const [index, entry] of (value.brands ?? []).entries()) {
    check(exactFieldsBool(entry, ['key', 'accessibleName']), `fixture.brands[${index}]: fields must be exact`)
    for (const field of ['key', 'accessibleName']) {
      check(typeof entry?.[field] === 'string' && entry[field].length > 0, `fixture.brands[${index}]: ${field} must be non-empty`)
    }
    brandKeys.push(entry?.key)
  }
  check(uniqueStrings(brandKeys, false), 'fixture: brand keys must be unique')
  compareValues('fixture brand case identities', brandKeys, manifestValue.requiredBrandCases)
  check(brandKeys.includes(value.mountedMark?.brand), 'fixture: mountedMark must identify a canonical brand case')
  for (const entry of value.harnesses ?? []) {
    check(brandKeys.includes(entry?.brand), `fixture: harness ${entry?.slug ?? 'unknown'} must reference a canonical brand case`)
  }

  const aliasNames = []
  for (const [index, entry] of (value.aliases ?? []).entries()) {
    check(exactFieldsBool(entry, ['name', 'brand']), `fixture.aliases[${index}]: fields must be exact`)
    for (const field of ['name', 'brand']) {
      check(typeof entry?.[field] === 'string' && entry[field].length > 0, `fixture.aliases[${index}]: ${field} must be non-empty`)
    }
    check(brandKeys.includes(entry?.brand), `fixture.aliases[${index}]: brand must reference a canonical brand case`)
    aliasNames.push(entry?.name)
  }
  check(uniqueStrings(aliasNames, false), 'fixture: alias names must be unique')
  compareValues('fixture alias case identities', aliasNames, manifestValue.requiredAliasCases)

  const invalidIds = []
  const invalidValues = []
  for (const [index, entry] of (value.invalidHarnesses ?? []).entries()) {
    check(exactFieldsBool(entry, ['id', 'value']), `fixture.invalidHarnesses[${index}]: fields must be exact`)
    check(typeof entry?.id === 'string' && entry.id.length > 0, `fixture.invalidHarnesses[${index}]: id must be non-empty`)
    check(typeof entry?.value === 'string', `fixture.invalidHarnesses[${index}]: value must be a string`)
    invalidIds.push(entry?.id)
    invalidValues.push(entry?.value)
  }
  check(uniqueStrings(invalidIds, false), 'fixture: invalid harness case identities must be unique')
  check(uniqueStrings(invalidValues, true), 'fixture: invalid harness values must be unique strings')
  compareValues('fixture invalid harness case identities', invalidIds, manifestValue.requiredInvalidHarnessCases)
  check((value.harnesses ?? []).some((entry) => entry?.slug === value.mountedHarness), 'fixture: mountedHarness must identify a canonical harness')
}

function validateMountedMark(value, label) {
  check(exactFieldsBool(value, ['brand', 'viewBox', 'path', 'source', 'sourceLicense']), `${label}: fields must be exact`)
  for (const field of ['brand', 'viewBox', 'path', 'source', 'sourceLicense']) {
    check(typeof value?.[field] === 'string' && value[field].length > 0, `${label}: ${field} must be non-empty`)
  }
}

function compareValues(label, actual, expected) {
  check(
    Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length && actual.every((value, index) => value === expected[index]),
    `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  )
}

function exactFieldsBool(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const expected = fields.slice().sort()
  return actual.length === expected.length && expected.every((field, index) => field === actual[index])
}

function uniqueStrings(value, allowEmpty) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && (allowEmpty || item.length > 0)) && new Set(value).size === value.length
}

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return document.toJS()
}
