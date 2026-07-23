#!/usr/bin/env node
import fs from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import YAML from 'yaml'
import { Changes } from '../dist/lib/graph.js'

const fixtureUrl = new URL('./testdata/changes-timeline.yaml', import.meta.url)
const fixtureSource = fs.readFileSync(fixtureUrl, 'utf8')
const fixtureDocument = YAML.parseDocument(fixtureSource, { strict: true, uniqueKeys: true })
const fixture = fixtureDocument.toJS()
const failures = []
const rootFields = new Set(['expectedCaseCount', 'cases'])
const caseFields = new Set(['name', 'payload', 'expect'])
const payloadFields = new Set(['repoFound', 'defaultBranch', 'changes', 'recentCommits', 'sessions'])
const commitFields = new Set(['hash', 'subject', 'timeMs', 'hasSession', 'sessionIds'])
const sessionFields = new Set(['sessionId', 'title', 'harness', 'startMs', 'hasCommitBinding'])
const expectFields = new Set(['linkedActionCount', 'linkedGroupLabels', 'unlinkedTitles', 'absentUnlinkedTitles', 'outsideWindowTitles'])
const requiredCaseNames = [
  'named_many_to_many_and_unlinked',
  'complete_relation_prevents_false_unlinked_rows',
  'legacy_boolean_only',
]

function unknownFields(value, allowed) {
  return Object.keys(value ?? {}).filter((field) => !allowed.has(field))
}

function validateFixture(value, label) {
  const problems = []
  if (unknownFields(value, rootFields).length > 0) problems.push(`${label}: unknown root fields ${unknownFields(value, rootFields).join(', ')}`)
  if (!Number.isInteger(value.expectedCaseCount) || value.expectedCaseCount !== requiredCaseNames.length) problems.push(`${label}: expectedCaseCount must be exactly ${requiredCaseNames.length}`)
  if (!Array.isArray(value.cases) || value.cases.length !== value.expectedCaseCount) problems.push(`${label}: expected ${value.expectedCaseCount} cases, got ${value.cases?.length ?? 0}`)
  const names = new Set()
  for (const [caseIndex, testCase] of (value.cases ?? []).entries()) {
    const where = `${label}.cases[${caseIndex}]`
    if (unknownFields(testCase, caseFields).length > 0 || !caseFields.size || ![...caseFields].every((field) => field in testCase)) problems.push(`${where}: case must contain exactly name, payload, and expect`)
    if (typeof testCase.name !== 'string' || testCase.name === '' || names.has(testCase.name)) problems.push(`${where}: name must be non-empty and unique`)
    names.add(testCase.name)
    if (unknownFields(testCase.payload, payloadFields).length > 0 || ![...payloadFields].every((field) => field in (testCase.payload ?? {}))) problems.push(`${where}.payload: invalid fields`)
    if (!Array.isArray(testCase.payload?.changes) || !Array.isArray(testCase.payload?.recentCommits) || !Array.isArray(testCase.payload?.sessions)) problems.push(`${where}.payload: changes, recentCommits, and sessions must be arrays`)
    for (const [index, commit] of (testCase.payload?.recentCommits ?? []).entries()) {
      if (unknownFields(commit, commitFields).length > 0 || !['hash', 'subject', 'hasSession', 'sessionIds'].every((field) => field in commit) || !Array.isArray(commit.sessionIds)) problems.push(`${where}.payload.recentCommits[${index}]: invalid commit shape`)
    }
    for (const [index, session] of (testCase.payload?.sessions ?? []).entries()) {
      if (unknownFields(session, sessionFields).length > 0 || !['sessionId', 'title', 'harness'].every((field) => field in session)) problems.push(`${where}.payload.sessions[${index}]: invalid session shape`)
    }
    if (unknownFields(testCase.expect, expectFields).length > 0 || !['linkedActionCount', 'unlinkedTitles'].every((field) => field in (testCase.expect ?? {}))) problems.push(`${where}.expect: invalid expectation shape`)
  }
  for (const required of requiredCaseNames) if (!names.has(required)) problems.push(`${label}: missing required behavior family ${required}`)
  return problems
}

if (fixtureDocument.errors.length > 0 || (fixtureSource.match(/^---\s*$/gm) ?? []).length > 0) failures.push('fixture: must be one strict YAML document with unique keys')
failures.push(...validateFixture(fixture, 'fixture'))
for (const required of requiredCaseNames) {
  const mutated = structuredClone(fixture)
  mutated.cases.find((testCase) => testCase.name === required).name = `removed_${required}`
  if (!validateFixture(mutated, `mutation ${required}`).some((problem) => problem.includes('missing required behavior family'))) failures.push(`fixture mutation: renaming ${required} was not rejected`)
}

for (const testCase of fixture.cases) {
  const html = renderToStaticMarkup(
    React.createElement(Changes, {
      payload: testCase.payload,
      nowMs: 1770001000000,
      onOpenSession: () => {},
    }),
  )
  const actionCount = (html.match(/class="cg-session"/g) || []).length
  if (actionCount !== testCase.expect.linkedActionCount) {
    failures.push(`${testCase.name}: expected ${testCase.expect.linkedActionCount} linked session actions, got ${actionCount}`)
  }
  for (const label of testCase.expect.linkedGroupLabels ?? []) {
    if (!html.includes(`role="group" aria-label="${label}"`)) {
      failures.push(`${testCase.name}: missing accessible linked-session action group ${label}`)
    }
  }
  for (const title of testCase.expect.unlinkedTitles) {
    if (!html.includes(title) || !html.includes('sessions not linked to a commit')) {
      failures.push(`${testCase.name}: missing unattached session section for ${title}`)
    }
  }
  const unlinkedSection = html.match(/sessions not linked to a commit[\s\S]*?<\/section>/)?.[0] ?? ''
  for (const title of testCase.expect.absentUnlinkedTitles ?? []) {
    if (unlinkedSection.includes(title)) {
      failures.push(`${testCase.name}: incorrectly rendered bound session as unattached: ${title}`)
    }
  }
  for (const title of testCase.expect.outsideWindowTitles ?? []) {
    if (!html.includes('sessions linked outside this visible commit window') || !html.includes(title)) {
      failures.push(`${testCase.name}: missing outside-window session action ${title}`)
    }
  }
  let buttonDepth = 0
  let nestedButtons = false
  for (const tag of html.match(/<\/?button\b[^>]*>/g) || []) {
    if (tag.startsWith('</')) buttonDepth -= 1
    else {
      buttonDepth += 1
      nestedButtons ||= buttonDepth > 1
    }
  }
  if (nestedButtons) {
    failures.push(`${testCase.name}: rendered nested buttons`)
  }
}

if (failures.length > 0) {
  console.error([
    'changes timeline smoke failed.',
    'What went wrong: the Git timeline no longer renders its session bindings safely.',
    'Why it matters: users could lose transcript links or receive invalid nested controls.',
    'Where: scripts/smoke-changes.mjs.',
    `When: built-bundle smoke (${failures.join('; ')}).`,
    'What it means: the Fairtrade graph bundle is not ready for consumers.',
    'How to fix: restore the fixture-backed session action and unattached-session contracts in Changes and CommitGraph.',
  ].join('\n'))
  process.exit(1)
}

console.log(`changes timeline smoke: all ${fixture.cases.length} fixture cases passed.`)
