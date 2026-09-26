#!/usr/bin/env node
// Browser-neutral Fairtest evidence verifier CLI. It reloads the run root a
// maintainer points at with FAIRTEST_RUN_ROOT, rebuilds the neutral run model
// from the producer records and artifact bytes, verifies it against the
// app-owned policy through the private child core, and writes a typed evidence
// report under the run root's evidence/ subtree. It starts no service, opens
// no page, and imports no browser runner: every Fairtrade-specific id, root,
// and threshold comes from fairtest-evidence-policy.mjs, and every generic
// check comes from the private child evidence core through the sole source
// route.
//
// Invocation: FAIRTEST_RUN_ROOT=<run-root> FAIRTEST_RUN_ID=<run-id> pnpm test:fairtest:verify
//
// REQUIRED-CI MOUNT: ENFORCED. The Fairtest required-CI job in
// .github/workflows/ci.yml invokes this command after the mounted producers, so
// the browser-neutral verifier is now enforced rather than merely declared.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { importFairtestSource } from '../fairtest-source.mjs'
import { FAIRTEST_EVIDENCE_ROW_KEYS, fairtestEvidencePolicyInput } from './fairtest-evidence-policy.mjs'

const evidence = await importFairtestSource('src/evidence/index.mjs')

/**
 * What this command is. `status: 'mounted'` is the observable statement that a
 * required CI workflow invokes the command; `enforcedBy` names the job that
 * mounts it.
 * @type {{ status: string, enforcedBy: string, reason: string }}
 */
export const VERIFY_REQUIRED_CI_MOUNT = Object.freeze({
  status: 'mounted',
  enforcedBy: '"Fairtest evidence verification" in .github/workflows/ci.yml',
  reason: 'a required CI workflow invokes this command, so a green CI run proves the verifier ran',
})

/**
 * Resolve the run root from FAIRTEST_RUN_ROOT. The root must be an absolute
 * path so a report always lands inside the run it describes.
 * @returns {string} the resolved run root
 */
export function resolveVerifyRunRoot() {
  const root = process.env.FAIRTEST_RUN_ROOT || ''
  if (!root) {
    throw new Error(
      'fairtest verify: missing run root for field "FAIRTEST_RUN_ROOT" at path run.root; ' +
      'repair: run with FAIRTEST_RUN_ROOT=<run-root> pointing at the run directory to verify.',
    )
  }
  if (!isAbsolute(root)) {
    throw new Error(
      `fairtest verify: invalid run root ${JSON.stringify(root)} for field "FAIRTEST_RUN_ROOT" at path run.root; ` +
      'repair: use an absolute directory path for FAIRTEST_RUN_ROOT.',
    )
  }
  return resolve(root)
}

/**
 * Read and parse one JSON record from the run root.
 * @param {string} path file path to read
 * @param {string} label record label used in diagnostics
 * @returns {Record<string, any>} the parsed record
 */
function readJson(path, label) {
  let source
  try {
    source = readFileSync(path, 'utf8')
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `fairtest verify: cannot read ${JSON.stringify(path)} for field "${label}" at path run.root; caused by ${cause}; ` +
      `repair: keep the ${label} record intact or rebuild the run root.`,
    )
  }
  try {
    return JSON.parse(source)
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `fairtest verify: invalid JSON in ${JSON.stringify(path)} for field "${label}" at path run.root; caused by ${cause}; ` +
      `repair: rebuild the run root so ${label} holds valid JSON.`,
    )
  }
}

/**
 * Resolve the run identity id the produce run actually belongs to. The run
 * envelope is authoritative when present; otherwise the caller-supplied
 * FAIRTEST_RUN_ID names it.
 * @param {string} root resolved run root
 * @returns {string | null} the envelope run id, or null when no envelope exists
 */
function readEnvelopeRunId(root) {
  const envelopePath = join(root, 'guards', 'run-envelope.json')
  if (!existsSync(envelopePath)) return null
  const envelope = readJson(envelopePath, 'run-envelope')
  if (typeof envelope.runId !== 'string' || envelope.runId.length === 0) {
    throw new Error(
      `fairtest verify: run envelope is missing a run id for field "runId" at path guards/run-envelope.json; ` +
      'repair: write the run id the envelope covers, or remove the envelope to fall back to FAIRTEST_RUN_ID.',
    )
  }
  return envelope.runId
}

/**
 * Rebuild one neutral evidence row from a producer row directory. A row whose
 * essential records are absent is returned as null so the verifier reports it
 * as a missing row instead of the CLI crashing; a row whose records are present
 * but malformed fails closed with an actionable error.
 * @param {string} root resolved run root
 * @param {{ key: string, kind: string, theme: string }} required required row
 * @param {string[]} artifactClasses caller-declared artifact classes
 * @returns {object | null} the neutral row, or null when the row is absent
 */
function readProducerRow(root, required, artifactClasses) {
  const dir = join(root, 'producer', required.key)
  const recordPath = join(dir, 'record.json')
  const proofPath = join(dir, 'resolution.json')
  if (!existsSync(recordPath) || !existsSync(proofPath)) return null
  const record = readJson(recordPath, `${required.key}/record.json`)
  const proof = readJson(proofPath, `${required.key}/resolution.json`)
  const provenancePath = join(dir, 'provenance.json')
  const provenance = existsSync(provenancePath) ? readJson(provenancePath, `${required.key}/provenance.json`) : null
  const artifacts = artifactClasses
    .filter((name) => existsSync(join(dir, name)))
    .map((name) => {
      const bytes = readFileSync(join(dir, name))
      return evidence.createArtifactObservation({ name, content: bytes, digest: evidence.artifactDigest(bytes) })
    })
  const observedAtMs = Number.isInteger(record.producedAtMs) ? record.producedAtMs : Date.now()
  return evidence.createEvidenceRow({
    key: required.key,
    kind: record.kind ?? required.kind,
    theme: record.rowTheme ?? record.theme?.observed,
    identity: proof.identity,
    proof,
    themeObservation: record.theme,
    provenance: provenance === null
      ? null
      : { root: provenance.root, servedFrom: provenance.servedFrom },
    artifacts,
    observedAtMs,
  })
}

/**
 * Run the verifier: rebuild the run, verify it, write the report, and return
 * the process exit code. Any missing run root or run id fails closed with an
 * actionable error before a browser would be needed (and none is ever started).
 * @returns {number} the process exit code
 */
function main() {
  const root = resolveVerifyRunRoot()
  const expectedRunId = process.env.FAIRTEST_RUN_ID || ''
  if (!expectedRunId) {
    throw new Error(
      'fairtest verify: missing expected run id for field "FAIRTEST_RUN_ID" at path policy.runId; ' +
      'repair: set FAIRTEST_RUN_ID to the run id the policy expects.',
    )
  }
  const envelopeRunId = readEnvelopeRunId(root)
  const runId = envelopeRunId ?? expectedRunId
  // The verifier owns a FRESH evidence/ subtree. A prior report means this
  // root already carries a verifier result, so a rerun would silently replace
  // one run's evidence with another's; refuse before reading any producer row.
  const priorReportPath = join(root, 'evidence', 'evidence.json')
  if (existsSync(priorReportPath)) {
    throw new Error(
      'fairtest verify: prior evidence present for field "evidence" at path evidence/evidence.json; ' +
      `found ${JSON.stringify(priorReportPath)}; ` +
      'repair: use a fresh FAIRTEST_RUN_ROOT per run so the verifier writes evidence/ once.',
    )
  }
  const policy = evidence.createEvidencePolicy(fairtestEvidencePolicyInput(expectedRunId))
  const rows = []
  for (const required of policy.requiredRows) {
    const row = readProducerRow(root, required, policy.artifactClasses)
    if (row !== null) rows.push(row)
  }
  const createdAtMs = Date.now()
  const run = evidence.createEvidenceRun({
    identity: { kind: 'run', id: runId, createdAtMs },
    mode: 'single-capture',
    rows,
  })
  const report = evidence.verifyEvidenceRun(run, policy, { nowMs: createdAtMs })
  const evidenceDir = join(root, 'evidence')
  mkdirSync(evidenceDir, { recursive: true })
  const reportPath = join(evidenceDir, 'evidence.json')
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

  console.log('fairtest verify: browser-neutral evidence verification over the run root')
  console.log(`  run root   ${root}`)
  console.log(`  run id     ${runId}`)
  console.log(`  rows       ${report.rows.length} of ${FAIRTEST_EVIDENCE_ROW_KEYS.length} required, ${report.artifactClasses.length} artifact classes`)
  console.log(`  verdict    ${report.verdict} (${report.failureCodes.length} distinct failure codes)`)
  console.log(`  report     ${reportPath}`)
  console.log(`  required-ci mount: ${VERIFY_REQUIRED_CI_MOUNT.status} (${VERIFY_REQUIRED_CI_MOUNT.reason})`)
  if (!report.complete) {
    for (const failure of report.failures) {
      console.error(`  FAIL ${failure.code} at ${failure.path}: expected ${JSON.stringify(failure.expected)} observed ${JSON.stringify(failure.observed)}; repair: ${failure.repair}`)
    }
    return 1
  }
  return 0
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    process.exit(main())
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
