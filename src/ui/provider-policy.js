// @ts-check

import { Harness as SchemaHarness, isHarness } from '@peasant-labs/schema'

/** @typedef {import('@peasant-labs/schema').Harness} Harness */
/** @typedef {'claude'|'gemini'|'openai'|'opencode'|'cursor'|'strike'|'pi'|'grok'|'devin'|'cline'|'kiro'} ProviderBrand */
/** @typedef {'amber'|'teal'|'olive'|'mauve'|'clay'} ProviderAccent */

/** @type {readonly Harness[]} */
export const PROVIDER_HARNESSES = Object.freeze(Object.values(SchemaHarness))

/** @type {Readonly<Record<Harness, string>>} */
export const PROVIDER_DISPLAY_NAMES = Object.freeze({
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  codex: 'Codex',
  opencode: 'opencode',
  cursor: 'Cursor',
  antigravity: 'Google Antigravity',
  strike: 'Strike',
  pi: 'Pi',
  'grok-build': 'Grok Build',
  'devin-desktop': 'Devin Desktop',
  cline: 'Cline',
  kiro: 'Kiro',
  'kiro-cli': 'Kiro CLI',
  'kiro-crew': 'Kiro Crew',
})

/** @type {Readonly<Record<Harness, ProviderBrand>>} */
export const PROVIDER_BRANDS = Object.freeze({
  'claude-code': 'claude',
  'gemini-cli': 'gemini',
  codex: 'openai',
  opencode: 'opencode',
  cursor: 'cursor',
  antigravity: 'gemini',
  strike: 'strike',
  pi: 'pi',
  'grok-build': 'grok',
  'devin-desktop': 'devin',
  cline: 'cline',
  kiro: 'kiro',
  'kiro-cli': 'kiro',
  'kiro-crew': 'kiro',
})

/** @type {Readonly<Record<Harness, ProviderAccent>>} */
export const PROVIDER_ACCENTS = Object.freeze({
  'claude-code': 'amber',
  'gemini-cli': 'teal',
  codex: 'olive',
  opencode: 'mauve',
  cursor: 'clay',
  antigravity: 'teal',
  strike: 'clay',
  pi: 'mauve',
  'grok-build': 'olive',
  'devin-desktop': 'teal',
  cline: 'mauve',
  kiro: 'mauve',
  'kiro-cli': 'mauve',
  'kiro-crew': 'mauve',
})

/**
 * Validate an untrusted provider value before it enters canonical display APIs.
 * @param {unknown} harness
 * @param {string} operation
 * @returns {asserts harness is Harness}
 */
export function assertHarness(harness, operation) {
  if (isHarness(harness)) return
  let rendered
  try {
    rendered = JSON.stringify(harness)
  } catch {
    rendered = String(harness)
  }
  throw new TypeError(
    `Provider harness validation failed for ${rendered} at src/ui/provider-policy.js during ${operation}: ` +
    'the value is outside the canonical @peasant-labs/schema Harness, so Fairtrade cannot select a trustworthy provider identity; ' +
    `the caller must validate its wire boundary and pass one of ${PROVIDER_HARNESSES.join(', ')}.`,
  )
}

/** @param {Harness} harness @returns {string} */
export function providerDisplayName(harness) {
  assertHarness(harness, 'provider display-name resolution')
  return PROVIDER_DISPLAY_NAMES[harness]
}

/** @param {Harness} harness @returns {ProviderBrand} */
export function providerBrand(harness) {
  assertHarness(harness, 'provider brand resolution')
  return PROVIDER_BRANDS[harness]
}

/** @param {Harness} harness @returns {ProviderAccent} */
export function providerAccent(harness) {
  assertHarness(harness, 'provider accent resolution')
  return PROVIDER_ACCENTS[harness]
}
