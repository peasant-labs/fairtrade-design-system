import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import YAML from 'yaml'
const modulePath = process.env.FAIRTRADE_INITIAL_POSITION_MODULE
  ? `${pathToFileURL(resolve(process.env.FAIRTRADE_INITIAL_POSITION_MODULE)).href}?run=${Date.now()}`
  : '../src/ui/transcript/initial-position.js'
const {
  advanceTranscriptInitialPositionConsumption,
  normalizeTranscriptInitialPosition,
  resolveTranscriptInitialPosition,
  shouldApplyTranscriptInitialPosition,
  transcriptInitialPositionReadiness,
  transcriptInitialPositionToken,
} = await import(modulePath)

const manifestSource = readFileSync(resolve('scripts/testdata/transcript-initial-position.manifest.yaml'), 'utf8')
const casesSource = readFileSync(resolve('scripts/testdata/transcript-initial-position.yaml'), 'utf8')
const caseFields = ['name', 'family', 'steps', 'expectedAttempts']
const stepFields = ['session', 'kind', 'turn', 'requestKey', 'result', 'selection', 'dataRevision']
const normalizerFields = ['name', 'kind', 'turn', 'requestKey', 'extraKey', 'wantValid']
const untrustedFields = ['name', 'field', 'valueType', 'expectedValue']
const untrustedContainerFields = ['name', 'containerType', 'expectedValue', 'expectedInvariant', 'expectedDescriptorCalls']
const readinessFields = ['name', 'kind', 'turn', 'authoritativeTurns', 'renderedTurns', 'viewReady', 'scrollerReady', 'targetReady', 'expectedResult']
const precedenceCaseFields = ['name', 'steps']
const precedenceStepFields = ['initial', 'initialTurn', 'fallback', 'fallbackTurn', 'legacy', 'legacyTurn', 'expected', 'expectedTurn']
const mutationFields = ['name', 'file', 'find', 'replace', 'expectedError']
const kinds = new Set(['none', 'top', 'turn'])
const optionalKinds = new Set(['unset', 'none', 'top', 'turn'])
const results = new Set(['pending', 'applied', 'discarded'])

function parseDocument(source, label) {
  if ((source.match(/^---\s*$/gm) ?? []).length) throw new Error(`${label} must contain exactly one YAML document`)
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length) throw new Error(`${label} is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
  const value = document.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} root must be an object`)
  return value
}

function exactFields(value, fields, label) {
  const unknown = Object.keys(value).filter((field) => !fields.includes(field))
  const missing = fields.filter((field) => !(field in value))
  if (unknown.length || missing.length) throw new Error(`${label} fields are invalid; unknown=${unknown.join(',')} missing=${missing.join(',')}`)
}

function stringArray(value, label, unique = true) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) throw new Error(`${label} must be nonempty strings`)
  if (unique && new Set(value).size !== value.length) throw new Error(`${label} must be unique`)
  return value
}

function loadFixtures(manifestText = manifestSource, casesText = casesSource) {
  const manifest = parseDocument(manifestText, 'transcript initial-position manifest')
  exactFields(manifest, ['expectedCaseCount', 'requiredFamilies', 'requiredNames', 'expectedNormalizerCount', 'requiredNormalizerNames', 'expectedUntrustedCount', 'requiredUntrustedNames', 'expectedUntrustedContainerCount', 'requiredUntrustedContainerNames', 'expectedReadinessCount', 'requiredReadinessNames', 'expectedPrecedenceCount', 'requiredPrecedenceNames', 'expectedMutationCount', 'mutations'], 'transcript initial-position manifest')
  const requiredFamilies = stringArray(manifest.requiredFamilies, 'requiredFamilies')
  const requiredNames = stringArray(manifest.requiredNames, 'requiredNames')
  const requiredNormalizerNames = stringArray(manifest.requiredNormalizerNames, 'requiredNormalizerNames')
  const requiredUntrustedNames = stringArray(manifest.requiredUntrustedNames, 'requiredUntrustedNames')
  const requiredUntrustedContainerNames = stringArray(manifest.requiredUntrustedContainerNames, 'requiredUntrustedContainerNames')
  const requiredReadinessNames = stringArray(manifest.requiredReadinessNames, 'requiredReadinessNames')
  const requiredPrecedenceNames = stringArray(manifest.requiredPrecedenceNames, 'requiredPrecedenceNames')
  if (![manifest.expectedCaseCount, manifest.expectedNormalizerCount, manifest.expectedUntrustedCount, manifest.expectedUntrustedContainerCount, manifest.expectedReadinessCount, manifest.expectedPrecedenceCount, manifest.expectedMutationCount].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error('manifest counts must be safe nonnegative integers')
  if (!Array.isArray(manifest.mutations)) throw new Error('manifest mutations must be an array')
  const mutations = manifest.mutations.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`mutation ${index} must be an object`)
    exactFields(value, mutationFields, `mutation ${index}`)
    if (!['hook', 'normalizer'].includes(value.file) || ['name', 'find', 'expectedError'].some((field) => typeof value[field] !== 'string' || value[field].length === 0) || typeof value.replace !== 'string') throw new Error(`mutation ${index} has invalid typed values`)
    return value
  })
  if (mutations.length !== manifest.expectedMutationCount || new Set(mutations.map((row) => row.name)).size !== mutations.length) throw new Error('mutation inventory count or names are invalid')

  const root = parseDocument(casesText, 'transcript initial-position cases')
  exactFields(root, ['cases', 'normalizerCases', 'untrustedCases', 'untrustedContainerCases', 'readinessCases', 'precedenceCases'], 'transcript initial-position cases')
  if (!Array.isArray(root.cases) || !Array.isArray(root.normalizerCases) || !Array.isArray(root.untrustedCases) || !Array.isArray(root.untrustedContainerCases) || !Array.isArray(root.readinessCases) || !Array.isArray(root.precedenceCases)) throw new Error('case families must be arrays')
  const cases = root.cases.map((fixture, index) => {
    if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) throw new Error(`case ${index} must be an object`)
    exactFields(fixture, caseFields, `case ${index}`)
    if (typeof fixture.name !== 'string' || fixture.name.length === 0 || typeof fixture.family !== 'string' || fixture.family.length === 0 || !Array.isArray(fixture.steps) || fixture.steps.length === 0 || !Array.isArray(fixture.expectedAttempts)) throw new Error(`case ${index} has invalid typed values`)
    fixture.steps.forEach((step, stepIndex) => {
      if (!step || typeof step !== 'object' || Array.isArray(step)) throw new Error(`case ${index} step ${stepIndex} must be an object`)
      exactFields(step, stepFields, `case ${index} step ${stepIndex}`)
      if (typeof step.session !== 'string' || step.session.length === 0 || !kinds.has(step.kind) || !Number.isSafeInteger(step.turn) || typeof step.requestKey !== 'string' || step.requestKey.length === 0 || !results.has(step.result) || !Number.isSafeInteger(step.selection) || step.selection < 0 || !Number.isSafeInteger(step.dataRevision) || step.dataRevision < 0) throw new Error(`case ${index} step ${stepIndex} has invalid typed values`)
      if ((step.kind === 'turn') !== (step.turn >= 0) || (step.kind === 'none' && step.result !== 'pending')) throw new Error(`case ${index} step ${stepIndex} has invalid sentinel relations`)
    })
    stringArray(fixture.expectedAttempts, `case ${index} expectedAttempts`, false)
    return fixture
  })
  const normalizerCases = root.normalizerCases.map((fixture, index) => {
    if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) throw new Error(`normalizer case ${index} must be an object`)
    exactFields(fixture, normalizerFields, `normalizer case ${index}`)
    if (typeof fixture.name !== 'string' || fixture.name.length === 0 || typeof fixture.kind !== 'string' || !Number.isFinite(fixture.turn) || typeof fixture.requestKey !== 'string' || fixture.requestKey.length === 0 || typeof fixture.extraKey !== 'string' || fixture.extraKey.length === 0 || typeof fixture.wantValid !== 'boolean') throw new Error(`normalizer case ${index} has invalid typed values`)
    return fixture
  })
  const untrustedCases = root.untrustedCases.map((fixture, index) => {
    if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) throw new Error(`untrusted case ${index} must be an object`)
    exactFields(fixture, untrustedFields, `untrusted case ${index}`)
    if (typeof fixture.name !== 'string' || fixture.name.length === 0 || !['kind', 'turnIndex'].includes(fixture.field) || !['bigint', 'symbol', 'function', 'cycle', 'undefined', 'hostile-toJSON'].includes(fixture.valueType) || typeof fixture.expectedValue !== 'string' || fixture.expectedValue.length === 0) throw new Error(`untrusted case ${index} has invalid typed values`)
    if (fixture.field === 'turnIndex' && fixture.valueType !== 'bigint') throw new Error(`untrusted case ${index} has an unsupported turnIndex value type`)
    return fixture
  })
  const untrustedContainerCases = root.untrustedContainerCases.map((fixture, index) => {
    if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) throw new Error(`untrusted container case ${index} must be an object`)
    exactFields(fixture, untrustedContainerFields, `untrusted container case ${index}`)
    if (typeof fixture.name !== 'string' || fixture.name.length === 0 || !['revoked-proxy', 'prototype-trap', 'ownKeys-trap', 'descriptor-trap', 'kind-accessor', 'turnIndex-accessor', 'requestKey-accessor', 'hidden-kind', 'reported-requestKey-no-descriptor'].includes(fixture.containerType) || typeof fixture.expectedValue !== 'string' || fixture.expectedValue.length === 0 || typeof fixture.expectedInvariant !== 'string' || fixture.expectedInvariant.length === 0 || !Array.isArray(fixture.expectedDescriptorCalls) || fixture.expectedDescriptorCalls.some((token) => typeof token !== 'string' || !/^(?:kind|turnIndex|requestKey):1$/.test(token)) || new Set(fixture.expectedDescriptorCalls).size !== fixture.expectedDescriptorCalls.length) throw new Error(`untrusted container case ${index} has invalid typed values`)
    return fixture
  })
  const readinessCases = root.readinessCases.map((fixture, index) => {
    if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) throw new Error(`readiness case ${index} must be an object`)
    exactFields(fixture, readinessFields, `readiness case ${index}`)
    if (typeof fixture.name !== 'string' || fixture.name.length === 0 || !['top', 'turn'].includes(fixture.kind) || !Number.isSafeInteger(fixture.turn) || !Array.isArray(fixture.authoritativeTurns) || !Array.isArray(fixture.renderedTurns) || [fixture.viewReady, fixture.scrollerReady, fixture.targetReady].some((value) => typeof value !== 'boolean') || !results.has(fixture.expectedResult)) throw new Error(`readiness case ${index} has invalid typed values`)
    for (const [field, values] of [['authoritativeTurns', fixture.authoritativeTurns], ['renderedTurns', fixture.renderedTurns]]) {
      if (values.some((value) => !Number.isSafeInteger(value) || value < 0) || new Set(values).size !== values.length) throw new Error(`readiness case ${index} ${field} must contain unique safe nonnegative integers`)
    }
    if (fixture.renderedTurns.some((turn) => !fixture.authoritativeTurns.includes(turn))) throw new Error(`readiness case ${index} rendered turns must be a subset of authoritative turns`)
    if ((fixture.kind === 'turn') !== (fixture.turn >= 0)) throw new Error(`readiness case ${index} has invalid turn sentinel`)
    return fixture
  })
  const precedenceCases = root.precedenceCases.map((fixture, index) => {
    if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) throw new Error(`precedence case ${index} must be an object`)
    exactFields(fixture, precedenceCaseFields, `precedence case ${index}`)
    if (typeof fixture.name !== 'string' || fixture.name.length === 0 || !Array.isArray(fixture.steps) || fixture.steps.length === 0) throw new Error(`precedence case ${index} has invalid typed values`)
    fixture.steps.forEach((step, stepIndex) => {
      if (!step || typeof step !== 'object' || Array.isArray(step)) throw new Error(`precedence case ${index} step ${stepIndex} must be an object`)
      exactFields(step, precedenceStepFields, `precedence case ${index} step ${stepIndex}`)
      if (![step.initial, step.fallback, step.legacy].every((kind) => optionalKinds.has(kind)) || !['none', 'top', 'turn'].includes(step.expected) || ![step.initialTurn, step.fallbackTurn, step.legacyTurn, step.expectedTurn].every(Number.isSafeInteger)) throw new Error(`precedence case ${index} step ${stepIndex} has invalid typed values`)
      for (const [kind, turn] of [[step.initial, step.initialTurn], [step.fallback, step.fallbackTurn], [step.legacy, step.legacyTurn], [step.expected, step.expectedTurn]]) if ((kind === 'turn') !== (turn >= 0)) throw new Error(`precedence case ${index} step ${stepIndex} has invalid turn sentinel`)
    })
    return fixture
  })
  const caseNames = cases.map((row) => row.name)
  const families = cases.map((row) => row.family)
  const normalizerNames = normalizerCases.map((row) => row.name)
  const untrustedNames = untrustedCases.map((row) => row.name)
  const untrustedContainerNames = untrustedContainerCases.map((row) => row.name)
  const readinessNames = readinessCases.map((row) => row.name)
  const precedenceNames = precedenceCases.map((row) => row.name)
  const exactSet = (actual, required) => actual.length === required.length && actual.every((name) => required.includes(name)) && new Set(actual).size === actual.length
  if (cases.length !== manifest.expectedCaseCount || !exactSet(caseNames, requiredNames) || !exactSet([...new Set(families)], requiredFamilies)) throw new Error('behavior cases do not match their independent manifest')
  if (normalizerCases.length !== manifest.expectedNormalizerCount || !exactSet(normalizerNames, requiredNormalizerNames)) throw new Error('normalizer cases do not match their independent manifest')
  if (untrustedCases.length !== manifest.expectedUntrustedCount || !exactSet(untrustedNames, requiredUntrustedNames)) throw new Error('untrusted cases do not match their independent manifest')
  if (untrustedContainerCases.length !== manifest.expectedUntrustedContainerCount || !exactSet(untrustedContainerNames, requiredUntrustedContainerNames)) throw new Error('untrusted container cases do not match their independent manifest')
  if (readinessCases.length !== manifest.expectedReadinessCount || !exactSet(readinessNames, requiredReadinessNames)) throw new Error('readiness cases do not match their independent manifest')
  if (precedenceCases.length !== manifest.expectedPrecedenceCount || !exactSet(precedenceNames, requiredPrecedenceNames)) throw new Error('precedence cases do not match their independent manifest')
  const allNames = [...caseNames, ...normalizerNames, ...untrustedNames, ...untrustedContainerNames, ...readinessNames, ...precedenceNames, ...mutations.map((row) => row.name)]
  if (new Set(allNames).size !== allNames.length) throw new Error('all transcript initial-position case and mutation names must be globally unique')
  return { cases, normalizerCases, untrustedCases, untrustedContainerCases, readinessCases, precedenceCases, mutations }
}

function assertThrows(fn, pattern) {
  let error
  try { fn() } catch (caught) { error = caught }
  if (!(error instanceof Error) || !pattern.test(error.message)) throw new Error(`expected failure ${pattern}; received ${error?.message ?? 'no error'}`)
}

const fixtures = loadFixtures()

const actionablePattern = /What went wrong:.*Why it happened:.*Where it failed:.*When it failed:.*What it means for the caller:.*How to fix it:/

for (const fixture of fixtures.normalizerCases) {
  const value = fixture.kind === 'turn' ? { kind: fixture.kind, turnIndex: fixture.turn } : { kind: fixture.kind }
  if (fixture.requestKey === 'blank') value.requestKey = '   '
  else if (fixture.requestKey !== 'none') value.requestKey = fixture.requestKey
  if (fixture.extraKey !== 'none') value[fixture.extraKey] = true
  if (fixture.wantValid) normalizeTranscriptInitialPosition(value)
  else assertThrows(() => normalizeTranscriptInitialPosition(value), actionablePattern)
}

function untrustedValue(valueType) {
  if (valueType === 'bigint') return 42n
  if (valueType === 'symbol') return Symbol('hostile')
  if (valueType === 'function') return () => undefined
  if (valueType === 'undefined') return undefined
  if (valueType === 'cycle') { const value = {}; value.self = value; return value }
  return { toJSON() { throw new Error('hostile toJSON must never execute') } }
}

for (const fixture of fixtures.untrustedCases) {
  const invalid = untrustedValue(fixture.valueType)
  const value = fixture.field === 'kind' ? { kind: invalid } : { kind: 'turn', turnIndex: invalid }
  let caught
  try { normalizeTranscriptInitialPosition(value) } catch (error) { caught = error }
  if (!(caught instanceof TypeError) || !actionablePattern.test(caught.message) || !caught.message.includes(fixture.expectedValue)) {
    throw new Error(`${fixture.name.replace(' keeps actionable diagnostics', '')} actionable invariant failed: expected six-part diagnostic containing ${fixture.expectedValue}; received ${caught instanceof Error ? caught.message : String(caught)}`)
  }
}

function hostileContainer(containerType, getterCounter, descriptorCounter) {
  const countDescriptor = (key) => descriptorCounter.set(key, (descriptorCounter.get(key) ?? 0) + 1)
  if (containerType === 'revoked-proxy') {
    const revocable = Proxy.revocable({ kind: 'top' }, {})
    revocable.revoke()
    return revocable.proxy
  }
  if (containerType === 'prototype-trap') return new Proxy({ kind: 'top' }, { getPrototypeOf() { throw new Error('UNSAFE_REFLECTION_SENTINEL') } })
  if (containerType === 'ownKeys-trap') return new Proxy({ kind: 'top' }, { ownKeys() { throw new Error('UNSAFE_REFLECTION_SENTINEL') } })
  if (containerType === 'descriptor-trap') return new Proxy({ kind: 'top' }, { getOwnPropertyDescriptor(_target, key) { countDescriptor(key); throw new Error('UNSAFE_REFLECTION_SENTINEL') } })
  if (containerType === 'hidden-kind') return new Proxy({ kind: 'top' }, { ownKeys() { return [] }, getOwnPropertyDescriptor(target, key) { countDescriptor(key); return Reflect.getOwnPropertyDescriptor(target, key) } })
  if (containerType === 'reported-requestKey-no-descriptor') return new Proxy({ kind: 'top' }, {
    ownKeys() { return ['kind', 'requestKey'] },
    getOwnPropertyDescriptor(target, key) { countDescriptor(key); return key === 'requestKey' ? undefined : Reflect.getOwnPropertyDescriptor(target, key) },
  })
  const record = containerType === 'turnIndex-accessor' ? { kind: 'turn' } : containerType === 'requestKey-accessor' ? { kind: 'top' } : {}
  const key = containerType === 'kind-accessor' ? 'kind' : containerType === 'turnIndex-accessor' ? 'turnIndex' : 'requestKey'
  const value = key === 'kind' ? 'top' : key === 'turnIndex' ? 42 : 'stable-request'
  Object.defineProperty(record, key, { enumerable: true, configurable: true, get() { getterCounter.count += 1; return value } })
  return new Proxy(record, { getOwnPropertyDescriptor(target, field) { countDescriptor(field); return Reflect.getOwnPropertyDescriptor(target, field) } })
}

for (const fixture of fixtures.untrustedContainerCases) {
  const getterCounter = { count: 0 }
  const descriptorCounter = new Map()
  const value = hostileContainer(fixture.containerType, getterCounter, descriptorCounter)
  let caught
  try { normalizeTranscriptInitialPosition(value) } catch (error) { caught = error }
  const message = caught instanceof Error ? caught.message : ''
  const descriptorCalls = [...descriptorCounter.entries()].map(([key, count]) => `${String(key)}:${count}`).sort()
  const expectedDescriptorCalls = [...fixture.expectedDescriptorCalls].sort()
  if (!(caught instanceof TypeError) || !actionablePattern.test(message) || !message.includes(fixture.expectedValue) || /UNSAFE_REFLECTION_SENTINEL|proxy that has been revoked|Cannot perform/.test(message) || getterCounter.count !== 0 || JSON.stringify(descriptorCalls) !== JSON.stringify(expectedDescriptorCalls)) {
    throw new Error(`${fixture.expectedInvariant} invariant failed: expected a six-part diagnostic containing ${fixture.expectedValue}, no native trap text, zero getter calls, and descriptor calls ${JSON.stringify(expectedDescriptorCalls)}; received ${message || String(caught)} with ${getterCounter.count} getter calls and ${JSON.stringify(descriptorCalls)} descriptor calls`)
  }
}

for (const fixture of fixtures.readinessCases) {
  const position = fixture.kind === 'top' ? { kind: 'top' } : { kind: 'turn', turnIndex: fixture.turn }
  const result = transcriptInitialPositionReadiness(position, {
    authoritativeTurnIndices: fixture.authoritativeTurns,
    renderedTurnIndices: fixture.renderedTurns,
    viewReady: fixture.viewReady,
    scrollerReady: fixture.scrollerReady,
    targetReady: fixture.targetReady,
  })
  if (result !== fixture.expectedResult) throw new Error(`readiness behavior: ${fixture.name} expected ${fixture.expectedResult}, received ${result}`)
}

function fixturePosition(kind, turn) {
  if (kind === 'unset') return undefined
  if (kind === 'none') return null
  return kind === 'top' ? { kind: 'top' } : { kind: 'turn', turnIndex: turn }
}

for (const fixture of fixtures.precedenceCases) {
  let explicitUsed = false
  let fallbackUsed = false
  for (const step of fixture.steps) {
    const resolved = resolveTranscriptInitialPosition({
      initialPosition: fixturePosition(step.initial, step.initialTurn),
      fallbackInitialPosition: fixturePosition(step.fallback, step.fallbackTurn),
      legacyInitialPosition: fixturePosition(step.legacy, step.legacyTurn),
      explicitUsed,
      fallbackUsed,
    })
    explicitUsed = resolved.explicitUsed
    fallbackUsed = resolved.fallbackUsed
    const receivedKind = resolved.position?.kind ?? 'none'
    const receivedTurn = resolved.position?.kind === 'turn' ? resolved.position.turnIndex : -1
    if (receivedKind !== step.expected || receivedTurn !== step.expectedTurn) throw new Error(`precedence behavior: ${fixture.name} expected ${step.expected}:${step.expectedTurn}, received ${receivedKind}:${receivedTurn}`)
  }
}

for (const fixture of fixtures.cases) {
  let consumedToken = null
  const attempts = []
  for (const step of fixture.steps) {
    const rawPosition = step.kind === 'none' ? null : step.kind === 'top' ? { kind: 'top' } : { kind: 'turn', turnIndex: step.turn }
    if (rawPosition && step.requestKey !== 'none') rawPosition.requestKey = step.requestKey
    const position = normalizeTranscriptInitialPosition(rawPosition)
    const token = transcriptInitialPositionToken(step.session, position)
    if (token == null) {
      consumedToken = null
      continue
    }
    if (shouldApplyTranscriptInitialPosition(consumedToken, token)) {
      attempts.push(`${step.session}|${step.kind}|${step.turn}|${step.requestKey}|${step.result}`)
      consumedToken = advanceTranscriptInitialPositionConsumption(consumedToken, token, step.result)
    }
  }
  if (JSON.stringify(attempts) !== JSON.stringify(fixture.expectedAttempts)) throw new Error(`terminal consumption or session token behavior: ${fixture.name} expected ${JSON.stringify(fixture.expectedAttempts)}, received ${JSON.stringify(attempts)}`)
}

console.log(`transcript initial-position state: ${fixtures.cases.length} lifecycle, ${fixtures.normalizerCases.length} normalizer, ${fixtures.untrustedCases.length} untrusted-value, ${fixtures.untrustedContainerCases.length} untrusted-container, ${fixtures.readinessCases.length} readiness, and ${fixtures.precedenceCases.length} precedence cases passed`)
