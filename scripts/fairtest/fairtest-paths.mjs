// @ts-check

// Fairtest repository-path owner.
//
// Placement rule: repository-level gates and tooling, and the source-route
// seam, live in the `scripts/` root; the Fairtest harness and its
// harness-scoped guards live in `scripts/fairtest/`. This module is the single
// owner of the repo-relative locations the harness names: the two build roots,
// the private child package and its manifest, installed packages, the
// required-CI workflow, and the declared subset of the `scripts/testdata`
// corpora and required-name manifests it resolves (boundary, ts-program,
// surface-consumers, runner-inventory, process-cases, promotion, paths,
// dispatch). Both this list and FAIRTEST_PATH_ROOTS are the whole claim:
// every location an in-scope guard reads is declared here, because the
// raw-literal path guard (scripts/fairtest/assert-fairtest-paths.mjs) refuses a
// bare literal equal to, or under, any declared root; a guard cannot take
// private ownership of a corpus by spelling its path. A module that needs one
// of these values reads it here instead of spelling the path as a bare string
// literal.
//
// Plain data plus pure functions only: a frozen record of named repo-relative
// locations, a frozen list of the directory roots the guard treats as
// repository-level, a resolver that fails closed on an unknown name, and a
// resolver that proves a repo-relative candidate stays inside the repository
// root. No classes, no methods, no per-kind factories, and no dispatch on a
// tag. The repository root is the existing FAIRTEST_REPO_ROOT from
// `fairtest-runtime.mjs`; this module never declares a second root.
import { isAbsolute, resolve, sep } from 'node:path'
import { FAIRTEST_REPO_ROOT } from './fairtest-runtime.mjs'

/**
 * Every repository-relative location the Fairtest harness names, keyed by a
 * stable role. Values are posix, repo-relative, and never absolute.
 * @type {Readonly<Record<string, string>>}
 */
export const FAIRTEST_PATHS = Object.freeze({
  distRoot: 'dist',
  storybookRoot: 'storybook-static',
  childPackageRoot: 'packages/fairtest',
  childPackageManifest: 'packages/fairtest/package.json',
  nodeModulesRoot: 'node_modules',
  ciWorkflow: '.github/workflows/ci.yml',
  boundaryCorpus: 'scripts/testdata/fairtest-boundary.yaml',
  boundaryManifest: 'scripts/testdata/fairtest-boundary.manifest.yaml',
  tsProgramCorpus: 'scripts/testdata/fairtest-ts-program.yaml',
  tsProgramManifest: 'scripts/testdata/fairtest-ts-program.manifest.yaml',
  surfaceConsumersCorpus: 'scripts/testdata/fairtest-surface-consumers.yaml',
  surfaceConsumersManifest: 'scripts/testdata/fairtest-surface-consumers.manifest.yaml',
  runnerInventoryCorpus: 'scripts/testdata/fairtest-runner-inventory.yaml',
  runnerInventoryManifest: 'scripts/testdata/fairtest-runner-inventory.manifest.yaml',
  processCasesCorpus: 'scripts/testdata/fairtest-process-cases.yaml',
  promotionCorpus: 'scripts/testdata/test-promotion.yaml',
  promotionManifest: 'scripts/testdata/test-promotion.manifest.yaml',
  pathsCorpus: 'scripts/testdata/fairtest-paths.yaml',
  pathsManifest: 'scripts/testdata/fairtest-paths.manifest.yaml',
  dispatchCorpus: 'scripts/testdata/fairtest-dispatch.yaml',
  dispatchManifest: 'scripts/testdata/fairtest-dispatch.manifest.yaml',
})

/**
 * The directory roots the harness treats as repository-level, longest first so
 * a diagnostic names the most specific root. A bare string literal equal to
 * one of these, or to a repo-relative path under one, is a raw inventory path
 * literal the guard refuses outside this module.
 * @type {readonly string[]}
 */
export const FAIRTEST_PATH_ROOTS = Object.freeze([
  'packages/fairtest',
  'storybook-static',
  '.github/workflows',
  'scripts/testdata',
  'node_modules',
  'dist',
])

/**
 * Test modules the raw-literal path guard exempts from its no-bare-literal
 * rule. Every other `*.test.mjs` and `*.type-test.mjs` under the harness
 * directory IS scanned, so a new test that hardcodes a location under a
 * declared root fails the guard. These four carry an inventory literal
 * deliberately as fixture-mutation data (a corpus path they load, or an app
 * root they pass to the code under test); each is a migration candidate to read
 * the location from this owner instead of repeating it. The exemption lives
 * here, in the owner, rather than as a second list inside the guard.
 * @type {readonly string[]}
 */
export const FAIRTEST_FIXTURE_TEST_MODULES = Object.freeze([
  'component-mutations.test.mjs',
  'product-adapter.test.mjs',
  'product-mutations.test.mjs',
  'run-envelope.test.mjs',
])

/**
 * Resolve a declared location name to its repo-relative posix path. Fails
 * closed on an unknown name.
 * @param {string} name
 * @returns {string}
 */
export function fairtestRelative(name) {
  const value = FAIRTEST_PATHS[name]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `fairtest paths: unknown location ${JSON.stringify(name)} for field "name" at path fairtestPaths.name; ` +
      `repair: use one of ${Object.keys(FAIRTEST_PATHS).join(', ')}.`,
    )
  }
  return value
}

/**
 * Resolve a declared location name to an absolute path inside the repository
 * root. Fails closed on an unknown name or an escaping value.
 * @param {string} name
 * @returns {string}
 */
export function fairtestPath(name) {
  const relativePath = fairtestRelative(name)
  const absolute = resolve(FAIRTEST_REPO_ROOT, ...relativePath.split('/'))
  return assertFairtestPathInside(absolute, `fairtestPaths.${name}`)
}

/**
 * Resolve a repo-relative candidate to an absolute path that is proven to sit
 * inside FAIRTEST_REPO_ROOT. Refuses empty and non-string candidates, null
 * bytes, windows separators, absolute paths, and parent-directory segments, so
 * a caller can never reach outside the repository through this seam.
 * @param {string} candidate
 * @param {string} [path]
 * @returns {string}
 */
export function resolveFairtestRepoPath(candidate, path = 'fairtestPaths.candidate') {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    fail(candidate, 'candidate must be a non-empty string', path)
  }
  if (candidate.includes('\0')) fail(candidate, 'null bytes are not allowed', path)
  if (candidate.includes('\\')) fail(candidate, 'windows separators are not allowed; use posix slashes', path)
  if (isAbsolute(candidate)) fail(candidate, 'absolute paths are not allowed', path)
  const segments = candidate.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.') fail(candidate, 'empty and current-directory segments are not allowed', path)
    if (segment === '..') fail(candidate, 'parent-directory segments are not allowed', path)
  }
  const absolute = resolve(FAIRTEST_REPO_ROOT, ...segments)
  return assertFairtestPathInside(absolute, path)
}

/**
 * Assert an absolute path sits inside FAIRTEST_REPO_ROOT, or fail closed. The
 * assertion helper the path-resolution guard runs over every declared
 * location, and that both resolvers run before returning.
 * @param {string} absolute
 * @param {string} path
 * @returns {string}
 */
export function assertFairtestPathInside(absolute, path) {
  if (typeof absolute !== 'string' || !isAbsolute(absolute)) {
    throw new Error(
      `fairtest paths: resolved location ${JSON.stringify(absolute)} is not absolute for field "path" at path ${path}; ` +
      'repair: build the location from FAIRTEST_REPO_ROOT with resolveFairtestRepoPath or fairtestPath.',
    )
  }
  const root = FAIRTEST_REPO_ROOT
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    throw new Error(
      `fairtest paths: resolved location ${JSON.stringify(absolute)} escapes ${JSON.stringify(root)} for field "path" at path ${path}; ` +
      'repair: use a declared repo-relative location without parent-directory segments.',
    )
  }
  return absolute
}

/**
 * Reject a candidate with the repository's path-context repair idiom.
 * @param {unknown} candidate
 * @param {string} reason
 * @param {string} path
 * @returns {never}
 */
function fail(candidate, reason, path) {
  throw new Error(
    `fairtest paths: rejected ${JSON.stringify(candidate)}: ${reason} for field "path" at path ${path}; ` +
    'repair: use a repo-relative path without parent-directory segments or absolute prefixes.',
  )
}
