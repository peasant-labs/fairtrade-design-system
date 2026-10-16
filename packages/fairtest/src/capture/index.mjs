// @ts-check

// Capture-subtree barrel. Re-exports the browser-neutral capture model only:
// the capture-case document and its row expansion, the capture observation
// record and its reconciliation invariants, the served-build record and the
// served-versus-dist comparison, the sheet plan and its escaped renderer, and
// the capture-run evidence composition. It is deliberately NOT re-exported
// from the core or evidence barrels, so a consumer must name the capture
// subtree explicitly. No runner, page global, selector data, or scheme address
// is added at this layer.

export {
  CAPTURE_PROBE_OPTION_FIELDS,
  captureRowKey,
  captureRowTargets,
  captureSurfaceTargets,
  loadCaptureCases,
  validateCaptureCases,
  validateCaptureSurface,
} from './cases.mjs'
export { CAPTURE_NAME_PATTERN, CAPTURE_MAX_WIDTH, CAPTURE_TARGET_KINDS, assertCaptureName } from './values.mjs'
export {
  assertCaptureShotsDigest,
  captureRecordDigest,
  captureRecordKey,
  classifyCaptureTarget,
  createCaptureRecord,
  reconcileCaptureRecord,
  serializeCaptureRecord,
  validateCaptureRecord,
  validateCaptureTarget,
} from './record.mjs'
export { assertServedMatchesDist, createServedBuild, validateServedBuild } from './build.mjs'
export {
  DEFAULT_SHEET_ORDER,
  SHEET_CELL_STATUSES,
  assertSheetManifestMatchesPlan,
  escapeSheetText,
  planSheets,
  renderSheetDocument,
  validateSheetManifest,
} from './sheet.mjs'
export {
  CAPTURE_ARTIFACT_CLASSES,
  CAPTURE_PROVENANCE_SOURCE,
  CAPTURE_RUN_MODE,
  buildCaptureRun,
} from './evidence.mjs'
