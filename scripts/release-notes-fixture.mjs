// @ts-check
/* release-notes-fixture — the one loader of the release-notes fixtures, shared
   by scripts/release-notes.test.mjs and scripts/release-notes.mutations.mjs so
   both read the same cases through the same parser. */
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import { closed } from '../src/ui/closed-value.js'

export const RELEASE_NOTES_FIXTURE_PATH = 'testdata/release-notes.yaml'
export const RELEASE_NOTES_MANIFEST_PATH = 'testdata/release-notes.manifest.yaml'

/**
 * Which extraction cases a mutation is probed against: a valid case must stop
 * returning its expected body, an invalid case must stop throwing.
 */
export const ProbeGroup = Object.freeze({
  Valid: closed('valid', 'valid extraction cases', { cases: (/** @type {any} */ fixture) => fixture.validCases }),
  Invalid: closed('invalid', 'invalid extraction cases', { cases: (/** @type {any} */ fixture) => fixture.invalidCases }),
})

/** Every probe group, in fixture order. */
export const ALL_PROBE_GROUPS = Object.freeze([ProbeGroup.Valid, ProbeGroup.Invalid])

/** @type {Readonly<Record<string, (typeof ALL_PROBE_GROUPS)[number]>>} */
const PROBE_GROUP_BY_WIRE = Object.freeze(Object.fromEntries(ALL_PROBE_GROUPS.map((group) => [group.wire, group])))

/**
 * @param {unknown} raw
 * @param {string} where
 */
export function parseProbeGroup(raw, where) {
  if (typeof raw === 'string' && Object.hasOwn(PROBE_GROUP_BY_WIRE, raw)) return PROBE_GROUP_BY_WIRE[raw]
  throw new Error(`${where}: probeGroup ${JSON.stringify(raw)} is not one of ${ALL_PROBE_GROUPS.map((group) => group.wire).join(', ')}. Fix scripts/${RELEASE_NOTES_MANIFEST_PATH}.`)
}

/**
 * Load one strict, single-document YAML file next to this module.
 *
 * @param {string} relativePath
 */
export function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) {
    throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  }
  return document.toJS()
}

/**
 * The manifest's mutations with each probe group parsed at this boundary.
 *
 * @param {any} manifest
 */
export function parsedMutations(manifest) {
  return manifest.mutations.map((/** @type {any} */ mutation) => Object.freeze({ ...mutation, probeGroup: parseProbeGroup(mutation.probeGroup, `release-notes mutation ${mutation.name}`) }))
}
