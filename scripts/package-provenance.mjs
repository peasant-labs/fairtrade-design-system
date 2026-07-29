export const CANONICAL_REPOSITORY = Object.freeze({
  type: 'git',
  url: 'https://github.com/peasant-labs/fairtrade-design-system',
})

export function normalizeRepositoryUrl(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/^git\+/, '').replace(/\.git$/, '')
}

export function assertPackageProvenanceMetadata(manifest) {
  const repository = manifest?.repository
  if (
    repository?.type === CANONICAL_REPOSITORY.type
    && normalizeRepositoryUrl(repository.url) === CANONICAL_REPOSITORY.url
  ) return

  throw new Error([
    'package provenance metadata check failed.',
    'What went wrong: package.json does not identify the canonical Fairtrade source repository.',
    'Why it happened: the repository type or URL is missing or points somewhere other than the GitHub repository used by npm Trusted Publishing.',
    'Where it failed: package.json repository metadata.',
    'When it failed: before building or publishing the npm package.',
    'What it means: npm cannot resolve this package to the GitHub repository that npm Trusted Publishing authenticates from, so no provenance attestation can be bound once the repository is public.',
    `How to fix: set package.json repository to ${JSON.stringify(CANONICAL_REPOSITORY)} and rerun pnpm test:package-provenance.`,
  ].join('\n'))
}
