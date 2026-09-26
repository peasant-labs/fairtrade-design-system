// Neutral evidence barrel. Re-exports the browser-neutral evidence run model,
// typed failures, the caller-owned policy, the duplicate scopes, the report
// verdict, and the verifier. It reuses the shared host kind and theme
// vocabulary through the record module and adds no runner, route, selector,
// port, or product threshold at this layer.

export {
  EVIDENCE_FAILURE_CODES,
  createEvidenceFailure,
  uniqueFailureCodes,
  validateEvidenceFailure,
} from './failure.mjs'
export { artifactByteLength, artifactDigest, assertArtifactDigest } from './digest.mjs'
export {
  EVIDENCE_MODES,
  createArtifactObservation,
  createEvidenceRow,
  createEvidenceRun,
  rowByteTotal,
  validateArtifactObservation,
  validateEvidenceProvenance,
  validateEvidenceRow,
  validateEvidenceRun,
} from './record.mjs'
export {
  DUPLICATE_SCOPES,
  EVIDENCE_POLICY_VERSION,
  createEvidencePolicy,
  validateEvidencePolicy,
} from './policy.mjs'
export { evaluateDuplicateScopes } from './duplicate.mjs'
export { createEvidenceReport, validateEvidenceReport } from './verdict.mjs'
export { verifyEvidenceRun } from './verify.mjs'
