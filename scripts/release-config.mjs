// @ts-check
/* release-config — the one place the release tests name the repository's
   release files and read them.
   ─────────────────────────────────────────────────────────────────────────────
   The release config (`tag_prefix`, `changelog`, `bot_branches`) and the queue
   policy (required checks, the release job, the bot jobs) are the contract the
   release-intent tool checks. The workflows read them, the tool validates them,
   and the tests read the same files through this module, so a test never
   restates a prefix, a changelog path, a workflow file, or a bot kind. Every
   field is validated here, at the boundary, with an actionable error. */
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { closed } from '../src/ui/closed-value.js'

/** The repository root this module reads from. */
export const REPO_ROOT = path.resolve(import.meta.dirname, '..')

/** Repository-relative paths of the files the release tooling reads. */
export const RepoPath = Object.freeze({
  /** The release config the release-intent tool and the tag workflows read. */
  ReleaseConfig: '.github/release-intent.yaml',
  /** The merge-queue policy `check-workflows` compares the workflows against. */
  QueuePolicy: '.github/release-queue.policy.yml',
  /** The workflows directory the policy names its workflow files in. */
  Workflows: '.github/workflows',
  /** The npm package manifest whose scripts the library build runs. */
  PackageManifest: 'package.json',
})

/**
 * The release-config keys the tests and the tag workflows read. The tag
 * workflows read the same keys with `yq`, so a test can check that a workflow
 * reads the field it needs from the release config instead of spelling the
 * value.
 */
export const ConfigKey = Object.freeze({
  TagPrefix: closed('tag_prefix', 'the release tag prefix'),
  Changelog: closed('changelog', 'the changelog path'),
  BotBranches: closed('bot_branches', 'the bot branch for each bot PR kind'),
})

/** Every release-config key this module reads. */
export const ALL_CONFIG_KEYS = Object.freeze([ConfigKey.TagPrefix, ConfigKey.Changelog, ConfigKey.BotBranches])

/**
 * @typedef {{
 *   tagPrefix: string,
 *   changelog: string,
 *   botKinds: ReadonlySet<string>,
 * }} ReleaseConfig
 */

/**
 * @typedef {{ context: string, workflow: string, job: string, guard: boolean, aggregator: boolean }} RequiredCheck
 * @typedef {{ workflow: string, job: string }} ReleaseJob
 * @typedef {{ workflow: string, job: string, kind: string }} BotJob
 * @typedef {{ required: readonly RequiredCheck[], releaseJob: ReleaseJob, botJobs: readonly BotJob[] }} QueuePolicy
 */

/**
 * @param {string} relative
 * @param {string} root
 */
function readYaml(relative, root) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0) throw new Error(`${relative}: the YAML is invalid (${document.errors.map((error) => error.message).join('; ')}). Fix the file; release-intent check-config and check-workflows refuse it too.`)
  return document.toJS()
}

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {string}
 */
function text(value, where) {
  if (typeof value === 'string' && value.length > 0) return value
  throw new Error(`${where} must be a non-empty string, found ${JSON.stringify(value)}. Fix the file it was read from; the release tests read it through scripts/release-config.mjs.`)
}

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {Record<string, unknown>}
 */
function record(value, where) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return /** @type {Record<string, unknown>} */ (value)
  throw new Error(`${where} must be a mapping, found ${JSON.stringify(value)}. Fix the file it was read from; the release tests read it through scripts/release-config.mjs.`)
}

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {unknown[]}
 */
function list(value, where) {
  if (Array.isArray(value)) return value
  throw new Error(`${where} must be a list, found ${JSON.stringify(value)}. Fix the file it was read from; the release tests read it through scripts/release-config.mjs.`)
}

/**
 * Read and validate the release config.
 *
 * @param {string} [root]
 * @returns {Readonly<ReleaseConfig>}
 */
export function loadReleaseConfig(root = REPO_ROOT) {
  const raw = record(readYaml(RepoPath.ReleaseConfig, root), RepoPath.ReleaseConfig)
  const at = (/** @type {{ wire: string }} */ key) => `${RepoPath.ReleaseConfig} ${key.wire}`
  const branches = record(raw[ConfigKey.BotBranches.wire], at(ConfigKey.BotBranches))
  for (const [kind, branch] of Object.entries(branches)) text(branch, `${at(ConfigKey.BotBranches)}.${kind}`)
  return Object.freeze({
    tagPrefix: text(raw[ConfigKey.TagPrefix.wire], at(ConfigKey.TagPrefix)),
    changelog: text(raw[ConfigKey.Changelog.wire], at(ConfigKey.Changelog)),
    botKinds: new Set(Object.keys(branches)),
  })
}

/**
 * Read and validate the merge-queue policy.
 *
 * @param {string} [root]
 * @returns {Readonly<QueuePolicy>}
 */
export function loadQueuePolicy(root = REPO_ROOT) {
  const where = RepoPath.QueuePolicy
  const queue = record(record(readYaml(where, root), where).queue, `${where} queue`)
  const required = list(queue.required, `${where} queue.required`).map((value, index) => {
    const row = record(value, `${where} queue.required[${index}]`)
    return Object.freeze({
      context: text(row.context, `${where} queue.required[${index}].context`),
      workflow: text(row.workflow, `${where} queue.required[${index}].workflow`),
      job: text(row.job, `${where} queue.required[${index}].job`),
      guard: row.guard === true,
      aggregator: row.aggregator === true,
    })
  })
  const release = record(queue.release_job, `${where} queue.release_job`)
  const botJobs = list(queue.bot_jobs, `${where} queue.bot_jobs`).map((value, index) => {
    const row = record(value, `${where} queue.bot_jobs[${index}]`)
    return Object.freeze({
      workflow: text(row.workflow, `${where} queue.bot_jobs[${index}].workflow`),
      job: text(row.job, `${where} queue.bot_jobs[${index}].job`),
      kind: text(row.kind, `${where} queue.bot_jobs[${index}].kind`),
    })
  })
  return Object.freeze({
    required: Object.freeze(required),
    releaseJob: Object.freeze({ workflow: text(release.workflow, `${where} queue.release_job.workflow`), job: text(release.job, `${where} queue.release_job.job`) }),
    botJobs: Object.freeze(botJobs),
  })
}

/**
 * Read one workflow file. `on` parses as boolean true under YAML 1.1, so the
 * trigger is read from either key.
 *
 * @param {string} file the workflow file name the policy or a test names
 * @param {string} [root]
 */
export function readWorkflow(file, root = REPO_ROOT) {
  const relative = path.join(RepoPath.Workflows, file)
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  return parseWorkflow(file, source)
}

/**
 * @param {string} file
 * @param {string} source
 */
export function parseWorkflow(file, source) {
  const workflow = record(YAML.parse(source), `${RepoPath.Workflows}/${file}`)
  return Object.freeze({ file, text: source, workflow, trigger: record(workflow.on ?? workflow.true, `${RepoPath.Workflows}/${file} on`) })
}

/** Read the package manifest. */
export function readPackageManifest(root = REPO_ROOT) {
  return record(JSON.parse(fs.readFileSync(path.join(root, RepoPath.PackageManifest), 'utf8')), RepoPath.PackageManifest)
}
