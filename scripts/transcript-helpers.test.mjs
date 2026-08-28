#!/usr/bin/env node
/* Fixture-driven verification for the standalone transcript helpers ported
   from transcript-browser: turnNav.js (nextNavTurn), time.js (formatRelative /
   formatDurationMins / formatDateLong), and title.js (summarizePrompt /
   projectLabel / composeSessionTitle). Every case is asserted directly
   against the production modules under src/ui/transcript/ — never a
   test-only reimplementation.

   Cases live in scripts/testdata/transcript-helpers.yaml; the required-name
   inventory (deletion protection) lives in the paired .manifest.yaml. Run:
   `pnpm test:transcript-helpers` (wired into test:gates). */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import YAML from 'yaml'

const fixture = loadStrictYaml('testdata/transcript-helpers.yaml')
const manifest = loadStrictYaml('testdata/transcript-helpers.manifest.yaml')

const turnNavModule = process.env.FAIRTRADE_TURNNAV_MODULE
  ? pathToFileURL(process.env.FAIRTRADE_TURNNAV_MODULE).href
  : new URL('../src/ui/transcript/turnNav.js', import.meta.url).href
const timeModule = process.env.FAIRTRADE_TIME_MODULE
  ? pathToFileURL(process.env.FAIRTRADE_TIME_MODULE).href
  : new URL('../src/ui/transcript/time.js', import.meta.url).href
const titleModule = process.env.FAIRTRADE_TITLE_MODULE
  ? pathToFileURL(process.env.FAIRTRADE_TITLE_MODULE).href
  : new URL('../src/ui/transcript/title.js', import.meta.url).href

const { nextNavTurn } = await import(`${turnNavModule}?helpers-contract=${Date.now()}`)
const { formatRelative, formatDurationMins, formatDateLong } = await import(`${timeModule}?helpers-contract=${Date.now()}`)
const { summarizePrompt, projectLabel, composeSessionTitle } = await import(`${titleModule}?helpers-contract=${Date.now()}`)

const failures = []
let totalChecks = 0
function check(passed, message) {
  totalChecks += 1
  if (!passed) failures.push(message)
}

validateManifest(manifest)
validateFixture(fixture, manifest)

/* ── turnNav ──────────────────────────────────────────────────────────────── */
for (const testCase of fixture.turnNavCases) {
  const actual = nextNavTurn(testCase.turnIndices, testCase.current ?? undefined, testCase.dir)
  const expected = testCase.expected ?? undefined
  check(actual === expected, `nextNavTurn — ${testCase.name}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
}

/* ── formatRelative ───────────────────────────────────────────────────────── */
const nowMs = new Date(fixture.formatRelativeCases.nowIso).getTime()
for (const testCase of fixture.formatRelativeCases.cases) {
  const iso = 'iso' in testCase ? testCase.iso : new Date(nowMs - testCase.deltaSeconds * 1000).toISOString()
  const actual = formatRelative(iso, nowMs)
  check(actual === testCase.expected, `formatRelative — ${testCase.name}: expected ${JSON.stringify(testCase.expected)}, received ${JSON.stringify(actual)}`)
}

/* ── formatDurationMins ───────────────────────────────────────────────────── */
for (const testCase of fixture.formatDurationMinsCases) {
  const actual = formatDurationMins(testCase.mins ?? undefined)
  check(actual === testCase.expected, `formatDurationMins — ${testCase.name}: expected ${JSON.stringify(testCase.expected)}, received ${JSON.stringify(actual)}`)
}

/* ── formatDateLong ───────────────────────────────────────────────────────── */
for (const testCase of fixture.formatDateLongCases) {
  const actual = formatDateLong(testCase.iso)
  if ('expectedPattern' in testCase) {
    check(new RegExp(testCase.expectedPattern).test(actual), `formatDateLong — ${testCase.name}: ${JSON.stringify(actual)} did not match /${testCase.expectedPattern}/`)
  } else {
    check(actual === testCase.expected, `formatDateLong — ${testCase.name}: expected ${JSON.stringify(testCase.expected)}, received ${JSON.stringify(actual)}`)
  }
}

/* ── summarizePrompt ──────────────────────────────────────────────────────── */
for (const testCase of fixture.summarizePromptCases) {
  const actual = summarizePrompt(testCase.raw ?? undefined)
  check(actual === testCase.expected, `summarizePrompt — ${testCase.name}: expected ${JSON.stringify(testCase.expected)}, received ${JSON.stringify(actual)}`)
}

/* ── projectLabel ─────────────────────────────────────────────────────────── */
for (const testCase of fixture.projectLabelCases) {
  const actual = projectLabel(testCase.project ?? undefined)
  check(actual === testCase.expected, `projectLabel — ${testCase.name}: expected ${JSON.stringify(testCase.expected)}, received ${JSON.stringify(actual)}`)
}

/* ── composeSessionTitle ──────────────────────────────────────────────────── */
for (const testCase of fixture.composeSessionTitleCases) {
  const actual = composeSessionTitle({
    id: testCase.id,
    project: testCase.project ?? undefined,
    promptContent: testCase.promptContent ?? undefined,
  })
  check(actual.title === testCase.expectedTitle, `composeSessionTitle — ${testCase.name}: title expected ${JSON.stringify(testCase.expectedTitle)}, received ${JSON.stringify(actual.title)}`)
  check(actual.tooltip === testCase.expectedTooltip, `composeSessionTitle — ${testCase.name}: tooltip expected ${JSON.stringify(testCase.expectedTooltip)}, received ${JSON.stringify(actual.tooltip)}`)
}

if (failures.length > 0) {
  console.error([
    'transcript helpers verification failed.',
    'What went wrong: nextNavTurn / time / title diverged from a fixtured case.',
    'Why it happened: a ported helper stopped matching its transcript-browser source behavior.',
    'Where: src/ui/transcript/{turnNav,time,title}.js and scripts/testdata/transcript-helpers*.yaml.',
    `When: focused transcript-helpers verification (${failures.join('; ')}).`,
    'What it means: keyboard navigation, relative/duration/date formatting, or the session title may render incorrectly.',
    'How to fix: restore the fixtured behavior in the helper module, then rerun pnpm test:transcript-helpers.',
  ].join('\n'))
  process.exit(1)
}

console.log(`transcript helpers: ${totalChecks} checks across turnNav/time/title passed.`)

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
  const fields = [
    'requiredTurnNavNames', 'requiredFormatRelativeNames', 'requiredFormatDurationMinsNames',
    'requiredFormatDateLongNames', 'requiredSummarizePromptNames', 'requiredProjectLabelNames',
    'requiredComposeSessionTitleNames',
  ]
  for (const field of fields) {
    if (!Array.isArray(value[field]) || value[field].some((name) => typeof name !== 'string' || name.length === 0)) {
      throw new Error(`transcript-helpers manifest field ${field} must be a non-empty string array`)
    }
  }
}

function validateFixture(value, manifestValue) {
  assertNameSet(names(value.turnNavCases), manifestValue.requiredTurnNavNames, 'turnNavCases')
  assertNameSet(names(value.formatRelativeCases.cases), manifestValue.requiredFormatRelativeNames, 'formatRelativeCases')
  assertNameSet(names(value.formatDurationMinsCases), manifestValue.requiredFormatDurationMinsNames, 'formatDurationMinsCases')
  assertNameSet(names(value.formatDateLongCases), manifestValue.requiredFormatDateLongNames, 'formatDateLongCases')
  assertNameSet(names(value.summarizePromptCases), manifestValue.requiredSummarizePromptNames, 'summarizePromptCases')
  assertNameSet(names(value.projectLabelCases), manifestValue.requiredProjectLabelNames, 'projectLabelCases')
  assertNameSet(names(value.composeSessionTitleCases), manifestValue.requiredComposeSessionTitleNames, 'composeSessionTitleCases')
}
