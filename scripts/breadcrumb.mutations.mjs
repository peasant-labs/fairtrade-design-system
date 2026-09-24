#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const MANIFEST_PATH = resolve(HERE, 'testdata/breadcrumb.manifest.yaml')
const BASE = process.env.BREADCRUMB_BASE
const HEAD = process.env.BREADCRUMB_HEAD
const BRANCH = process.env.BREADCRUMB_BRANCH
const manifest = loadManifest(MANIFEST_PATH)
const outputRoot = mkdtempSync(join(tmpdir(), 'fairtrade-breadcrumb-mutants-'))

assertRequiredProvenanceEnv()
assertCleanWorktree('before mutation baseline')
const trackedMutationFiles = [...new Set(manifest.mutations.map((mutation) => mutation.file))]
const sourceBefore = new Map(trackedMutationFiles.map((file) => [file, readFileSync(resolve(ROOT, file))]))
const provenanceEnv = { BREADCRUMB_BASE: BASE, BREADCRUMB_HEAD: HEAD }
if (BRANCH !== undefined) provenanceEnv.BREADCRUMB_BRANCH = BRANCH

try {
  const cleanSource = await runNode('scripts/breadcrumb.test.mjs', {
    BREADCRUMB_SOURCE_CASES: manifest.execution.source.join(','),
    BREADCRUMB_REQUIRE_FULL_CASES: '1',
  })
  assert.equal(cleanSource.code, 0, `unmodified source baseline failed:\n${cleanSource.output}`)
  assertExecutionLine(cleanSource.output, 'breadcrumb source execution:', manifest.execution.source)

  const cleanMounted = await runNode('scripts/breadcrumb-rendered-probe.mjs', {
    ...provenanceEnv,
    BREADCRUMB_MOUNTED_CASES: manifest.execution.mounted.join(','),
    BREADCRUMB_REQUIRE_FULL_CASES: '1',
  })
  assert.equal(cleanMounted.code, 0, `unmodified mounted baseline failed:\n${cleanMounted.output}`)
  assertExecutionLine(cleanMounted.output, 'breadcrumb mounted execution:', manifest.execution.mounted)
  assertCleanWorktree('after clean source and mounted baselines')

  for (const mutation of manifest.mutations) {
    const artifactRoot = join(outputRoot, mutation.name)
    assertExternalArtifactRoot(artifactRoot, mutation.name)
    await build({
      root: ROOT,
      configFile: resolve(ROOT, 'vite.config.js'),
      logLevel: 'silent',
      plugins: [inMemoryMutation(mutation)],
      build: { outDir: artifactRoot, emptyOutDir: true },
    })
    assert.ok(existsSync(join(artifactRoot, 'index.html')), `${mutation.name}: isolated external build did not emit index.html`)
    const identityPath = writeMutationArtifactIdentity(mutation, artifactRoot)
    assertCleanWorktree(`after external ${mutation.name} build`)

    const result = mutation.runner === 'scripts/breadcrumb.test.mjs'
      ? await runNode(mutation.runner, {
          BREADCRUMB_MUTATION_NAME: mutation.name,
          BREADCRUMB_SOURCE_CASES: mutation.logicalCase,
          BREADCRUMB_REQUIRE_FULL_CASES: '0',
        })
      : await runNode(mutation.runner, {
          ...provenanceEnv,
          BREADCRUMB_MUTATION_NAME: mutation.name,
          BREADCRUMB_MOUNTED_CASES: mutation.probeCase,
          BREADCRUMB_REQUIRE_FULL_CASES: '0',
          BREADCRUMB_DIST_ROOT: artifactRoot,
          BREADCRUMB_MUTATION_ARTIFACT_MANIFEST: identityPath,
        })

    assert.notEqual(result.code, 0, `${mutation.name}: designated mutation survived; a generic successful exit is not a kill`)
    assert.ok(result.output.includes(mutation.probeCase), `${mutation.name}: failure did not identify probe case ${mutation.probeCase}; received:\n${result.output}`)
    assert.ok(result.output.includes(mutation.logicalCase), `${mutation.name}: failure did not identify logical case ${mutation.logicalCase}; received:\n${result.output}`)
    assert.ok(result.output.includes(mutation.diagnostic), `${mutation.name}: failure did not include exact diagnostic ${JSON.stringify(mutation.diagnostic)}; received:\n${result.output}`)
    for (const [file, bytes] of sourceBefore) assert.ok(readFileSync(resolve(ROOT, file)).equals(bytes), `${mutation.name}: tracked source bytes changed in ${file}`)
    assertCleanWorktree(`after ${mutation.name} kill`)
    console.log(`${mutation.name}: killed at logical case ${mutation.logicalCase} via ${mutation.runner} probe case ${mutation.probeCase}`)
  }
  for (const [file, bytes] of sourceBefore) assert.ok(readFileSync(resolve(ROOT, file)).equals(bytes), `tracked source bytes changed in ${file}`)
  assertCleanWorktree('after all mutations')
  console.log('breadcrumb mutations: clean source and mounted baselines passed; all three exact mapped mutants were killed')
} finally {
  rmSync(outputRoot, { recursive: true, force: true })
}

function inMemoryMutation(mutation) {
  const sourcePath = normalize(resolve(ROOT, mutation.file))
  const source = readFileSync(sourcePath, 'utf8')
  const occurrences = source.split(mutation.find).length - 1
  assert.equal(occurrences, 1, `${mutation.name}: mutation target must occur exactly once in ${mutation.file}`)
  return {
    name: `in-memory-${mutation.name}`,
    enforce: 'pre',
    load(id) {
      return normalize(id.split('?')[0]) === sourcePath ? source.replace(mutation.find, mutation.replace) : null
    },
  }
}

function writeMutationArtifactIdentity(mutation, artifactRoot) {
  const sourcePath = resolve(ROOT, mutation.file)
  const sourceBytes = readFileSync(sourcePath)
  const sourceText = sourceBytes.toString('utf8')
  assert.equal(sourceText.split(mutation.find).length - 1, 1, `${mutation.name}: mutation find needle must occur exactly once in ${mutation.file}`)
  const mutatedText = sourceText.replace(mutation.find, mutation.replace)
  const assets = listArtifactAssets(artifactRoot)
  assert.ok(assets.length > 0, `${mutation.name}: external build emitted no JavaScript or CSS assets`)
  const artifactManifestSha256 = manifestDigest(assets)
  const identity = {
    mutation: {
      name: mutation.name,
      runner: mutation.runner,
      probeCase: mutation.probeCase,
      logicalCase: mutation.logicalCase,
      diagnostic: mutation.diagnostic,
      find: mutation.find,
      replace: mutation.replace,
      manifestSha256: sha256(readFileSync(MANIFEST_PATH)),
    },
    source: {
      root: ROOT,
      head: HEAD,
      file: mutation.file,
      sha256: sha256(sourceBytes),
      mutatedSha256: sha256(Buffer.from(mutatedText)),
    },
    artifact: {
      root: artifactRoot,
      assets,
      manifestSha256: artifactManifestSha256,
    },
  }
  const identityPath = join(artifactRoot, 'breadcrumb-mutation-artifact.json')
  writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`)
  return identityPath
}

function listArtifactAssets(root) {
  const records = []
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      const fullPath = join(directory, name)
      if (statSync(fullPath).isDirectory()) visit(fullPath)
      else if (/\.(?:js|css)$/.test(name)) {
        const path = `/${relative(root, fullPath).split(sep).join('/')}`
        const bytes = readFileSync(fullPath)
        records.push({ path, sha256: sha256(bytes), bytes: bytes.length })
      }
    }
  }
  visit(root)
  return records.sort((left, right) => left.path.localeCompare(right.path))
}

function assertExternalArtifactRoot(artifactRoot, name) {
  const pathFromRoot = relative(ROOT, artifactRoot)
  assert.ok(pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot), `${name}: mutation artifact ${artifactRoot} must remain outside the source worktree ${ROOT}`)
}

function assertRequiredProvenanceEnv() {
  if (!BASE) throw new Error('breadcrumb mutation gate failed: what went wrong: BREADCRUMB_BASE is missing; why: exact source provenance is required; where: scripts/breadcrumb.mutations.mjs startup; when: clean baseline preflight; what it means: the baseline cannot identify its review range; how to fix: run with the exact base and head exported explicitly.')
  if (!HEAD) throw new Error('breadcrumb mutation gate failed: what went wrong: BREADCRUMB_HEAD is missing; why: exact source provenance is required; where: scripts/breadcrumb.mutations.mjs startup; when: clean baseline preflight; what it means: the baseline cannot identify its reviewed head; how to fix: run with the exact base and head exported explicitly.')
}

function assertCleanWorktree(when) {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim()
  assert.equal(status, '', `breadcrumb mutation gate failed: what went wrong: worktree is dirty ${when}; why: mutation evidence must preserve the clean source; where: git status --porcelain in ${ROOT}; when: ${when}; what it means: the evidence cannot be trusted; how to fix: remove the worktree change and rerun the gate.`)
}

function assertExecutionLine(output, prefix, expected) {
  const line = output.split('\n').find((candidate) => candidate.startsWith(prefix))
  assert.ok(line, `breadcrumb mutation gate failed: what went wrong: missing execution map ${JSON.stringify(prefix)}; why: a bare count cannot prove exact case membership; where: child gate output; when: baseline or mutant completion; what it means: the requested inventory may have been skipped; how to fix: emit and verify the exact comma-separated execution map.`)
  assert.equal(line.slice(prefix.length).trim(), expected.join(','), `breadcrumb mutation gate failed: what went wrong: execution map ${line}; why: exact case membership is required; where: child gate output; when: baseline or mutant completion; what it means: the requested inventory was not executed; how to fix: pass exactly ${expected.join(',')}.`)
}

function runNode(script, extraEnv = {}) {
  return new Promise((resolveResult) => {
    execFile(process.execPath, [script], {
      cwd: ROOT,
      env: { ...process.env, ...extraEnv },
      maxBuffer: 50 * 1024 * 1024,
    }, (error, stdout, stderr) => resolveResult({ code: error?.code ?? 0, output: `${stdout}\n${stderr}` }))
  })
}

function manifestDigest(records) {
  const lines = [...records].sort((left, right) => left.path.localeCompare(right.path)).map((record) => `${record.path}\0${record.sha256}`)
  return sha256(Buffer.from(lines.join('\n')))
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function loadManifest(path) {
  const source = readFileSync(path, 'utf8')
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (documents.length !== 1 || errors.length || (source.match(/^---\s*$/gm) ?? []).length) throw new Error(`breadcrumb mutation manifest is not one strict unique-key YAML document: ${errors.map((error) => error.message).join('; ')}`)
  const value = documents[0].toJS()
  const required = [
    { name: 'restore-global-crumb-lowercase', file: 'src/index.css', find: '.crumb { @apply flex items-center gap-2 font-mono text-label text-ink-3;', replace: '.crumb { @apply flex items-center gap-2 font-mono text-label lowercase text-ink-3;', runner: 'scripts/breadcrumb-rendered-probe.mjs', probeCase: 'commons-detail-dark', logicalCase: 'content-default-case', diagnostic: 'breadcrumb content computed transform: expected none, observed lowercase' },
    { name: 'apply-per-item-crumb-lowercase', file: 'src/index.css', find: '.crumb .crumb-item-chrome { @apply lowercase; }', replace: '.crumb .crumb-item { @apply lowercase; }', runner: 'scripts/breadcrumb-rendered-probe.mjs', probeCase: 'commons-detail-dark', logicalCase: 'content-default-case', diagnostic: 'breadcrumb content computed transform: expected none, observed lowercase' },
    { name: 'remove-link-component-forwarding', file: 'src/ui/Breadcrumb.jsx', find: '<LinkComponent href={item.href} className="link">{content}</LinkComponent>', replace: '<a href={item.href}>{content}</a>', runner: 'scripts/breadcrumb.test.mjs', probeCase: 'custom-link-forwarding', logicalCase: 'custom-link-forwarding', diagnostic: 'breadcrumb custom link forwarding: expected custom-link marker and className=link' },
  ]
  assert.deepEqual(value.mutations, required, 'breadcrumb mutation manifest runner/probe/logical/diagnostic mapping')
  assert.deepEqual(value.execution?.source, ['default-anchor-item', 'custom-link-forwarding', 'icon-and-separator-preserved', 'content-default-case', 'chrome-item-case', 'non-linked-intermediate-item', 'final-item-current-and-href-ignored', 'nav-label-preserved'], 'breadcrumb mutation source execution map')
  assert.deepEqual(value.execution?.mounted, ['commons-detail-dark', 'commons-detail-light'], 'breadcrumb mutation mounted execution map')
  return value
}
