import fs from 'node:fs'

// Extracts the body of one `## <version>` CHANGELOG.md section (everything
// between that header and the next `## ` header, or EOF). Header lines with
// a trailing " - <date>" (e.g. "## 0.0.18 - 2026-08-28") are supported; the
// version token is compared for EXACT equality, never substring/prefix
// matching, so "## 0.0.1" and "## 0.0.10" can never cross-match. Used by
// .github/workflows/release.yml to build the GitHub Release notes body.
export function extractChangelogSection(changelog, version) {
  if (typeof changelog !== 'string') throw new Error('Release notes extraction failed: changelog text must be a string. Called from release.yml with CHANGELOG.md contents; pass the file text, not a path.')
  if (typeof version !== 'string' || version.length === 0) throw new Error('Release notes extraction failed: version must be a non-empty string, e.g. "0.0.18" or "0.0.18-rc1". Pass the tag-derived version (no leading v).')

  const lines = changelog.split('\n')
  const headers = []
  lines.forEach((line, index) => {
    const match = /^## (\S+)/.exec(line)
    if (match) headers.push({ version: match[1], index })
  })

  const at = headers.findIndex((header) => header.version === version)
  if (at === -1) {
    throw new Error(`Release notes extraction failed: no "## ${version}" section found in CHANGELOG.md. This means the release PR did not add a CHANGELOG entry for ${version} before the tag was cut. Fix: add a "## ${version}" section to CHANGELOG.md and re-run this release.`)
  }

  const start = headers[at].index + 1
  const end = at + 1 < headers.length ? headers[at + 1].index : lines.length
  const body = lines.slice(start, end).join('\n').trim()
  if (body.length === 0) {
    throw new Error(`Release notes extraction failed: the "## ${version}" section in CHANGELOG.md is empty. This means the release PR added a bare header with no notes content. Fix: add release notes under "## ${version}" in CHANGELOG.md and re-run this release.`)
  }
  return body
}

async function cli(argv) {
  const [version, changelogPath = 'CHANGELOG.md'] = argv
  if (!version) throw new Error('Release notes extraction failed: a version argument is required. Usage: node scripts/release-notes.mjs <version> [changelogPath].')
  const changelog = fs.readFileSync(changelogPath, 'utf8')
  process.stdout.write(extractChangelogSection(changelog, version) + '\n')
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  cli(process.argv.slice(2)).catch((error) => { console.error(`::error::${error.message}`); process.exitCode = 1 })
}
