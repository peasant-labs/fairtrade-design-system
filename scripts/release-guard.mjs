import fs from 'node:fs'

const CORE_NUMBER = '(?:0|[1-9][0-9]*)'
const VERSION_GRAMMAR = `v${CORE_NUMBER}\\.${CORE_NUMBER}\\.${CORE_NUMBER}(?:-rc[1-9][0-9]*)?`
const TAG = new RegExp(`^fairtrade-(${VERSION_GRAMMAR})$`)

// kind classifies the tag for the release.yml GitHub Release job: "rc" gets
// --prerelease, "final" gets --latest. Derived once here (the tested source),
// never re-derived by a shell substring match in the workflow.
export function releaseKind(version) { return version.includes('-rc') ? 'rc' : 'final' }

export function parseFairtradeTag(tag) {
  if (typeof tag !== 'string') throw new Error('Release tag validation failed: the tag was not a string. Use fairtrade-vX.Y.Z[-rcN].')
  const match = TAG.exec(tag)
  if (!match) throw new Error(`Release tag validation failed for ${JSON.stringify(tag)}: expected exactly fairtrade-vX.Y.Z[-rcN]. Use the tag the release job pushed for the landed release commit.`)
  const version = match[1].slice(1)
  return { version, versionWithV: match[1], tag, kind: releaseKind(version) }
}

function output(values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n'
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines); else process.stdout.write(lines)
}

async function cli(argv) {
  const [command, ...args] = argv
  if (command === 'parse-tag') return output(parseFairtradeTag(args[0] ?? process.env.TAG ?? ''))
  throw new Error('Release guard command failed: expected parse-tag. Title, package, pull-request, and approval checks moved to the release-intent tool and title-guard; this script keeps only the tag parser the tag-triggered workflows call.')
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) cli(process.argv.slice(2)).catch((error) => { console.error(`::error::${error.message}`); process.exitCode = 1 })
