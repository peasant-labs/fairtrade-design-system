// Neutral evidence verifier. Independently reloads a run model and checks run
// identity, the single-capture mode, the required row inventory, each row's
// kind, theme, theme observation, proof, provenance, artifact set, artifact
// digests, and freshness, the caller output cap, and the caller-selected
// duplicate scopes. Every rejection is a typed failure with a path, expected
// and observed values, and a repair. The verifier never throws for a failing
// run; it returns a frozen report whose `complete` flag and failure codes
// reproduce the verdict. It executes no page code and names no runner, route,
// selector, port, or product threshold.

import { artifactDigest } from './digest.mjs'
import { createEvidenceFailure } from './failure.mjs'
import { validateEvidenceRun, rowByteTotal } from './record.mjs'
import { validateEvidencePolicy } from './policy.mjs'
import { evaluateDuplicateScopes } from './duplicate.mjs'
import { createEvidenceReport } from './verdict.mjs'

/**
 * Compare the proof identity to the row identity. Both are shared identity
 * records; the proof proves the row only when both the kind and the id match.
 * @param {object} proof resolution proof
 * @param {object} identity row identity
 * @returns {boolean}
 */
function sameProofIdentity(proof, identity) {
  return proof.identity.kind === identity.kind && proof.identity.id === identity.id
}

/**
 * Assert every required artifact class is present and every present class is
 * declared, and that every recorded digest matches its content.
 * @param {object} row evidence row
 * @param {import('./policy.mjs').EvidencePolicyInput} policy caller-owned policy
 * @param {string} label row label used in diagnostics
 * @returns {import('./failure.mjs').EvidenceFailure[]}
 */
function verifyArtifacts(row, policy, label) {
  const failures = []
  const present = new Set(row.artifacts.map((artifact) => artifact.name))
  for (const name of policy.artifactClasses) {
    if (!present.has(name)) {
      failures.push(createEvidenceFailure({
        code: 'missing-artifact',
        path: `${label}.artifacts`,
        expected: name,
        observed: [...present],
        repair: `re-run the ${label} producer row so it writes the ${JSON.stringify(name)} artifact`,
      }))
    }
  }
  for (const artifact of row.artifacts) {
    if (!policy.artifactClasses.includes(artifact.name)) {
      failures.push(createEvidenceFailure({
        code: 'unexpected-artifact',
        path: `${label}.artifacts`,
        expected: policy.artifactClasses,
        observed: artifact.name,
        repair: `remove the undeclared ${JSON.stringify(artifact.name)} artifact from the ${label} row so it carries exactly the declared classes`,
      }))
    }
    const recomputed = artifactDigest(artifact.content)
    if (recomputed !== artifact.digest) {
      failures.push(createEvidenceFailure({
        code: 'digest-mismatch',
        path: `${label}.artifacts.${artifact.name}.digest`,
        expected: recomputed,
        observed: artifact.digest,
        repair: `rebuild the ${JSON.stringify(artifact.name)} artifact and record its SHA-256 digest beside the row`,
      }))
    }
  }
  return failures
}

/**
 * Verify one run against one caller-owned policy. Returns a frozen report.
 * @param {object} run evidence run to verify
 * @param {import('./policy.mjs').EvidencePolicyInput} policy caller-owned policy
 * @param {{ nowMs: number }} options caller-owned reference clock for freshness
 * @returns {object} the frozen evidence report
 */
export function verifyEvidenceRun(run, policy, options = {}) {
  const validatedRun = validateEvidenceRun(run, 'run')
  const validatedPolicy = validateEvidencePolicy(policy, 'policy')
  const nowMs = options.nowMs
  if (!Number.isInteger(nowMs) || nowMs < 0) {
    throw new Error(
      `invalid value ${JSON.stringify(nowMs)} for field "nowMs" at path options.nowMs; ` +
      'repair: pass the caller reference clock in whole milliseconds for "nowMs".',
    )
  }

  const failures = []

  if (validatedRun.identity.id !== validatedPolicy.runId) {
    failures.push(createEvidenceFailure({
      code: 'run-identity-mismatch',
      path: 'run.identity.id',
      expected: validatedPolicy.runId,
      observed: validatedRun.identity.id,
      repair: 'verify the run root that belongs to the policy run id, or update the caller-owned policy run id',
    }))
  }
  if (validatedRun.mode !== 'single-capture') {
    failures.push(createEvidenceFailure({
      code: 'unsupported-mode',
      path: 'run.mode',
      expected: 'single-capture',
      observed: validatedRun.mode,
      repair: 'verify a single-capture run; side-by-side, reference, and baseline evidence are not supported',
    }))
  }

  const requiredKeys = new Set(validatedPolicy.requiredRows.map((entry) => entry.key))
  for (const [index, required] of validatedPolicy.requiredRows.entries()) {
    const label = `run.rows[${index}]`
    const matches = validatedRun.rows.filter((row) => row.key === required.key)
    if (matches.length === 0) {
      failures.push(createEvidenceFailure({
        code: 'missing-row',
        path: 'run.rows',
        expected: required.key,
        observed: validatedRun.rows.map((row) => row.key),
        repair: `re-run the ${required.key} producer row so the run carries it`,
      }))
      continue
    }
    const row = matches[0]
    if (row.kind !== required.kind) {
      failures.push(createEvidenceFailure({
        code: 'kind-mismatch',
        path: `${label}.kind`,
        expected: required.kind,
        observed: row.kind,
        repair: `verify the ${required.key} row as ${required.kind} or correct the caller-owned required kind`,
      }))
    }
    if (row.theme !== required.theme) {
      failures.push(createEvidenceFailure({
        code: 'theme-mismatch',
        path: `${label}.theme`,
        expected: required.theme,
        observed: row.theme,
        repair: `verify the ${required.key} row as theme ${required.theme} or correct the caller-owned required theme`,
      }))
    }
    if (row.themeObservation.expected !== required.theme || row.themeObservation.observed !== required.theme) {
      failures.push(createEvidenceFailure({
        code: 'theme-mismatch',
        path: `${label}.themeObservation`,
        expected: required.theme,
        observed: row.themeObservation.observed,
        repair: `re-observe the rendered theme for ${required.key} after mount and record ${required.theme}`,
      }))
    }
    if (row.proof === null) {
      failures.push(createEvidenceFailure({
        code: 'unproven',
        path: `${label}.proof`,
        expected: 'a resolution proof on the row kind',
        observed: null,
        repair: `keep the ${required.key} resolution proof so the row proves its mounted parts`,
      }))
    } else if (row.proof.kind !== row.kind || !sameProofIdentity(row.proof, row.identity)) {
      failures.push(createEvidenceFailure({
        code: 'unproven',
        path: `${label}.proof`,
        expected: `${row.kind} proof for identity ${row.identity.id}`,
        observed: `${row.proof.kind} proof for identity ${row.proof.identity.id}`,
        repair: `rebuild the ${required.key} proof on its own kind and identity so it proves the row`,
      }))
    } else if (row.proof.theme.expected !== row.theme || row.proof.theme.observed !== row.theme) {
      failures.push(createEvidenceFailure({
        code: 'unproven',
        path: `${label}.proof.theme`,
        expected: row.theme,
        observed: row.proof.theme.observed,
        repair: `rebuild the ${required.key} proof from the rendered theme so it proves the row`,
      }))
    }
    if (row.provenance === null) {
      failures.push(createEvidenceFailure({
        code: 'missing-provenance',
        path: `${label}.provenance`,
        expected: `provenance naming ${required.root}`,
        observed: null,
        repair: `re-run the ${required.key} producer row so it records provenance for the served build`,
      }))
    } else if (row.provenance.root !== required.root) {
      failures.push(createEvidenceFailure({
        code: 'cross-root',
        path: `${label}.provenance.root`,
        expected: required.root,
        observed: row.provenance.root,
        repair: `verify the ${required.key} row against the ${required.root} built tree or correct the caller-owned required root`,
      }))
    }
    if (row.observedAtMs > nowMs || nowMs - row.observedAtMs > validatedPolicy.maxAgeMs) {
      failures.push(createEvidenceFailure({
        code: 'stale-record',
        path: `${label}.observedAtMs`,
        expected: `an observation no older than ${validatedPolicy.maxAgeMs} ms before ${nowMs}`,
        observed: row.observedAtMs,
        repair: `re-run the ${required.key} producer row for the current run instead of verifying a previous run`,
      }))
    }
    failures.push(...verifyArtifacts(row, validatedPolicy, label))
  }

  for (const [index, row] of validatedRun.rows.entries()) {
    if (!requiredKeys.has(row.key)) {
      failures.push(createEvidenceFailure({
        code: 'unexpected-row',
        path: `run.rows[${index}].key`,
        expected: [...requiredKeys],
        observed: row.key,
        repair: `remove the undeclared ${JSON.stringify(row.key)} row or register it in the caller-owned required rows`,
      }))
    }
  }

  const totalBytes = validatedRun.rows.reduce((total, row) => total + rowByteTotal(row), 0)
  if (totalBytes > validatedPolicy.maxOutputBytes) {
    failures.push(createEvidenceFailure({
      code: 'output-cap',
      path: 'run.rows[].artifacts',
      expected: `at most ${validatedPolicy.maxOutputBytes} bytes`,
      observed: totalBytes,
      repair: 're-capture the run within the caller-owned output cap or raise the cap deliberately',
    }))
  }

  const duplicates = evaluateDuplicateScopes(validatedRun.rows, validatedPolicy)
  failures.push(...duplicates.failures)

  const rows = validatedRun.rows.map((row, index) => ({
    key: row.key,
    kind: row.kind,
    theme: row.theme,
    artifactCount: row.artifacts.length,
    bytes: rowByteTotal(row),
    duplicate: duplicates.outcomes[index],
  }))

  return createEvidenceReport({
    policyVersion: validatedPolicy.version,
    runId: validatedRun.identity.id,
    mode: validatedRun.mode,
    failures,
    rows,
    artifactClasses: validatedPolicy.artifactClasses,
  })
}
