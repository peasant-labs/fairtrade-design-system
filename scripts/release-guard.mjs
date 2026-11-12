// @ts-check
/* release-guard — the release tag parser the tag-triggered workflows call.
   ─────────────────────────────────────────────────────────────────────────────
   The tag prefix is not written here: the release config owns it, and each
   tag-triggered workflow reads it from that config and passes it in. Titles,
   package content, and pull-request checks belong to the release-intent tool
   and title-guard; this script keeps only the tag grammar, the release kind,
   and the outputs the workflows read. */
import fs from 'node:fs'
import { closed } from '../src/ui/closed-value.js'

/**
 * The kind of a release tag. release.yml publishes a candidate as a GitHub
 * prerelease and a final release as the latest release. The candidate's wire
 * is also the marker in the tag grammar (`-rc<N>`), so the grammar and the
 * kind cannot disagree.
 */
export const ReleaseKind = Object.freeze({
  Candidate: closed('rc', 'release candidate'),
  Final: closed('final', 'final release'),
})

/** @typedef {(typeof ReleaseKind)[keyof typeof ReleaseKind]} ReleaseKindValue */

/** Every release kind, in the order the workflows document them. */
export const ALL_RELEASE_KINDS = Object.freeze([ReleaseKind.Candidate, ReleaseKind.Final])

/** @type {Readonly<Record<string, ReleaseKindValue>>} */
const RELEASE_KIND_BY_WIRE = Object.freeze(Object.fromEntries(ALL_RELEASE_KINDS.map((kind) => [kind.wire, kind])))

/**
 * Parse a release kind's wire value. Anything else fails closed: an unknown
 * kind is never relabeled as a final release.
 *
 * @param {unknown} raw
 * @returns {ReleaseKindValue}
 */
export function parseReleaseKind(raw) {
  if (typeof raw === 'string' && Object.hasOwn(RELEASE_KIND_BY_WIRE, raw)) return RELEASE_KIND_BY_WIRE[raw]
  throw new Error(`Release kind parsing failed in scripts/release-guard.mjs: ${JSON.stringify(raw)} is not one of ${ALL_RELEASE_KINDS.map((kind) => kind.wire).join(', ')}. Pass a kind the tag parser produced.`)
}

/**
 * The key of each value parse-tag writes to the step output. The workflows
 * read these keys as `steps.<id>.outputs.<key>`.
 */
export const TagOutput = Object.freeze({
  Version: closed('version', 'the tag version without the prefix'),
  Kind: closed('kind', 'the release kind'),
})

/** Every output key, in the order parse-tag writes them. */
export const ALL_TAG_OUTPUTS = Object.freeze([TagOutput.Version, TagOutput.Kind])

/** The commands this script's command line accepts. */
export const GuardCommand = Object.freeze({
  ParseTag: closed('parse-tag', 'parse and classify a release tag'),
})

/** Every command, in usage order. */
export const ALL_GUARD_COMMANDS = Object.freeze([GuardCommand.ParseTag])

/** @typedef {(typeof GuardCommand)[keyof typeof GuardCommand]} GuardCommandValue */

/** @type {Readonly<Record<string, GuardCommandValue>>} */
const GUARD_COMMAND_BY_WIRE = Object.freeze(Object.fromEntries(ALL_GUARD_COMMANDS.map((command) => [command.wire, command])))

/**
 * @param {unknown} raw
 * @returns {GuardCommandValue}
 */
export function parseGuardCommand(raw) {
  if (typeof raw === 'string' && Object.hasOwn(GUARD_COMMAND_BY_WIRE, raw)) return GUARD_COMMAND_BY_WIRE[raw]
  throw new Error(`Release guard command failed in scripts/release-guard.mjs: ${JSON.stringify(raw)} is not one of ${ALL_GUARD_COMMANDS.map((command) => command.wire).join(', ')}. Title, package, pull-request, and approval checks moved to the release-intent tool and title-guard; this script keeps only the tag parser the tag-triggered workflows call.`)
}

const CORE_NUMBER = '(?:0|[1-9][0-9]*)'
const CANDIDATE_NUMBER = '[1-9][0-9]*'

/** @param {string} text */
function escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

/** @param {string} tagPrefix */
function tagShape(tagPrefix) { return `${tagPrefix}X.Y.Z[-${ReleaseKind.Candidate.wire}N]` }

/**
 * Parse one release tag against the release config's tag prefix.
 *
 * @param {unknown} tag the pushed tag name
 * @param {unknown} tagPrefix the release config's tag prefix
 * @returns {Readonly<{ tag: string, version: string, kind: ReleaseKindValue }>}
 */
export function parseReleaseTag(tag, tagPrefix) {
  if (typeof tagPrefix !== 'string' || tagPrefix.length === 0) {
    throw new Error(`Release tag validation failed in scripts/release-guard.mjs: the tag prefix was ${JSON.stringify(tagPrefix)}, not a non-empty string. Read the tag prefix from the release config and pass it after the tag.`)
  }
  if (typeof tag !== 'string') throw new Error(`Release tag validation failed in scripts/release-guard.mjs: the tag was not a string. Use ${tagShape(tagPrefix)}.`)
  const grammar = new RegExp(`^${escapeRegExp(tagPrefix)}(${CORE_NUMBER}\\.${CORE_NUMBER}\\.${CORE_NUMBER}(-${escapeRegExp(ReleaseKind.Candidate.wire)}${CANDIDATE_NUMBER})?)$`)
  const match = grammar.exec(tag)
  if (!match) throw new Error(`Release tag validation failed for ${JSON.stringify(tag)}: expected exactly ${tagShape(tagPrefix)}. Use the tag the release job pushed for the landed release commit.`)
  return Object.freeze({ tag, version: match[1], kind: match[2] === undefined ? ReleaseKind.Final : ReleaseKind.Candidate })
}

/**
 * The step outputs for one parsed tag, keyed by the output wire.
 *
 * @param {ReturnType<typeof parseReleaseTag>} parsed
 * @returns {Readonly<Record<string, string>>}
 */
export function tagOutputs(parsed) {
  return Object.freeze({ [TagOutput.Version.wire]: parsed.version, [TagOutput.Kind.wire]: parsed.kind.wire })
}

/** @param {Readonly<Record<string, string>>} values */
function output(values) {
  const lines = ALL_TAG_OUTPUTS.map((key) => `${key.wire}=${values[key.wire]}`).join('\n') + '\n'
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines); else process.stdout.write(lines)
}

/** @param {string[]} argv */
async function cli(argv) {
  const [rawCommand, ...args] = argv
  const command = parseGuardCommand(rawCommand)
  if (command === GuardCommand.ParseTag) {
    const [tag, tagPrefix] = args
    return output(tagOutputs(parseReleaseTag(tag, tagPrefix)))
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) cli(process.argv.slice(2)).catch((error) => { console.error(`::error::${error.message}`); process.exitCode = 1 })
