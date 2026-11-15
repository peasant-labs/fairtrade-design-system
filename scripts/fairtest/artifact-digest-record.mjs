// @ts-check

// Row-owned artifact digest record: the one write/read boundary that binds each
// producer's exact artifact bytes to a SHA-256 recorded after the six declared
// artifact classes are written.
//
// Producers hash the bytes they write: the product and component rows hash the
// screenshot buffer the browser returned, then write that same buffer. The
// verifier reads this record and compares the current artifact bytes against
// the recorded digests BEFORE it parses any JSON artifact, so a byte mutation
// that makes a JSON artifact malformed still surfaces as a digest mismatch.
//
// What this proves: a changed artifact byte is detected relative to an
// unchanged digest record. It does NOT authenticate provenance. A writer who
// can modify an artifact can also modify this record, so this is change
// detection, not tamper evidence against that writer; an independently
// protected trust anchor belongs outside the writable run root.
//
// The digest record is NOT a seventh artifact class. ARTIFACT_CLASSES stays the
// closed six-class set, and this record is read/written as row-owned metadata
// beside those classes.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { importFairtestSource } from '../fairtest-source.mjs'
import { ARTIFACT_CLASSES } from './fairtest-artifacts.mjs'

const evidenceDigest = await importFairtestSource('src/evidence/digest.mjs')

/**
 * Row-owned digest record file name. It is deliberately outside
 * ARTIFACT_CLASSES: the verifier owns completeness against the six classes and
 * treats this file as metadata, never as an artifact observation.
 * @type {string}
 */
export const ARTIFACT_DIGEST_RECORD = 'digests.json'

/**
 * Digest record schema version written into every row record.
 * @type {number}
 */
export const ARTIFACT_DIGEST_RECORD_VERSION = 1

const ARTIFACT_CLASS_NAMES = /** @type {readonly string[]} */ (ARTIFACT_CLASSES)

/**
 * One artifact write receipt returned by writeRowArtifact.
 * @typedef {object} ArtifactWrite
 * @property {string} name declared artifact class name
 * @property {string} sha256 lowercase 64-character hex SHA-256 of the written bytes
 */

/**
 * The row-owned digest record.
 * @typedef {object} ArtifactDigestRecord
 * @property {number} version record schema version
 * @property {string} row producer row key (the row directory name)
 * @property {Readonly<Record<string, string>>} artifacts recorded digest per artifact class
 */

/**
 * One verified artifact observation: current bytes plus the digest the record
 * recorded for them.
 * @typedef {object} VerifiedArtifact
 * @property {string} name artifact class name
 * @property {Buffer} content current artifact bytes
 * @property {string} digest recorded digest
 */

/**
 * The verified artifact set plus the record it was checked against.
 * @typedef {object} VerifiedRowArtifacts
 * @property {ArtifactDigestRecord} record validated digest record
 * @property {readonly VerifiedArtifact[]} artifacts verified artifact observations in declared class order
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainRecord(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Hash artifact bytes with the shared evidence digest primitive.
 * @param {string | Uint8Array} bytes artifact bytes
 * @returns {string} lowercase 64-character hex digest
 */
function digestOf(bytes) {
  return evidenceDigest.artifactDigest(bytes)
}

/**
 * Return whether a value is a recorded SHA-256 digest, using the child
 * evidence core's canonical digest validator instead of maintaining a second
 * digest regex in the app harness.
 * @param {unknown} value candidate digest
 * @returns {value is string}
 */
function isArtifactDigest(value) {
  try {
    evidenceDigest.assertArtifactDigest(value, 'artifact.digest')
    return true
  } catch {
    return false
  }
}

/**
 * Artifact path used in diagnostics. The producer writes under
 * producer/<row-key>/ and the verifier reads the same row-owned layout.
 * @param {string} rowKey row key
 * @param {string} rest row-relative file or field name
 * @returns {string} diagnostic path
 */
function artifactPath(rowKey, rest) {
  return `producer/${rowKey}/${rest}`
}

/**
 * Write one artifact with exclusive creation, hash the EXACT bytes handed in,
 * and return the write receipt the digest record is built from. A pre-existing
 * file is refused instead of overwritten, so a rerun can never silently append
 * into a previous run's row directory.
 * @param {string} rowDir prepared row directory
 * @param {string} name declared artifact class name
 * @param {string | Uint8Array} bytes artifact bytes to write
 * @returns {ArtifactWrite} frozen write receipt
 */
export function writeRowArtifact(rowDir, name, bytes) {
  if (!ARTIFACT_CLASS_NAMES.includes(name)) {
    throw new Error(
      `artifact digests: unknown artifact class ${JSON.stringify(name)} for field "artifact" at path ${artifactPath(basename(rowDir), name)}; ` +
      `expected one of ${JSON.stringify([...ARTIFACT_CLASSES])}; ` +
      'repair: write only the declared six artifact classes into a row directory.',
    )
  }
  // Hash the caller's bytes first, before the write, so an invalid byte value
  // never leaves a partially written artifact that a later row could mistake
  // for evidence.
  const sha256 = digestOf(bytes)
  const path = join(rowDir, name)
  try {
    writeFileSync(path, bytes, { flag: 'wx' })
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'EEXIST') {
      throw new Error(
        `artifact digests: stale artifact ${JSON.stringify(name)} for field "artifact" at path ${artifactPath(basename(rowDir), name)}; ` +
        `refusing to overwrite ${JSON.stringify(path)}; ` +
        'repair: use a fresh run root instead of rewriting a previous run artifact.',
      )
    }
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `artifact digests: cannot write artifact ${JSON.stringify(name)} for field "artifact" at path ${artifactPath(basename(rowDir), name)}; ` +
      `tried ${JSON.stringify(path)}; caused by ${cause}; ` +
      'repair: prepare the row directory under a writable run root before writing artifacts.',
    )
  }
  return Object.freeze({ name, sha256 })
}

/**
 * Write the row-owned digest record after all six artifacts are written. The
 * record names exactly the declared classes and is created exclusively, so a
 * previously existing sidecar is never silently accepted. Before writing, the
 * row directory is checked to carry exactly the six artifact files, so a
 * partial row cannot receive a digest record that would later read as complete.
 * @param {string} rowDir prepared row directory
 * @param {readonly ArtifactWrite[]} writes write receipts, one per artifact class
 * @returns {ArtifactDigestRecord} the frozen written record
 */
export function writeArtifactDigestRecord(rowDir, writes) {
  const rowKey = basename(rowDir)
  if (!Array.isArray(writes)) {
    throw new Error(
      `artifact digests: invalid write receipt list ${JSON.stringify(writes)} for field "writes" at path ${artifactPath(rowKey, ARTIFACT_DIGEST_RECORD)}; ` +
      'repair: pass the six writeRowArtifact receipts in artifact class order.',
    )
  }
  /** @type {Map<string, string>} */
  const recorded = new Map()
  for (const entry of writes) {
    if (!isPlainRecord(entry)) {
      throw new Error(
        `artifact digests: invalid write receipt ${JSON.stringify(entry)} for field "writes" at path ${artifactPath(rowKey, ARTIFACT_DIGEST_RECORD)}; ` +
        'repair: pass the writeRowArtifact receipts unchanged.',
      )
    }
    const name = entry.name
    const sha256 = entry.sha256
    if (typeof name !== 'string' || !ARTIFACT_CLASS_NAMES.includes(name)) {
      throw new Error(
        `artifact digests: unknown artifact class ${JSON.stringify(name)} for field "writes[].name" at path ${artifactPath(rowKey, ARTIFACT_DIGEST_RECORD)}; ` +
        `expected one of ${JSON.stringify([...ARTIFACT_CLASSES])}; ` +
        'repair: write only the declared six artifact classes into a row directory.',
      )
    }
    if (recorded.has(name)) {
      throw new Error(
        `artifact digests: duplicate write receipt ${JSON.stringify(name)} for field "writes[].name" at path ${artifactPath(rowKey, ARTIFACT_DIGEST_RECORD)}; ` +
        'repair: write each artifact class once.',
      )
    }
    if (!isArtifactDigest(sha256)) {
      throw new Error(
        `artifact digests: invalid digest ${JSON.stringify(sha256)} for field "writes[].sha256" at path ${artifactPath(rowKey, ARTIFACT_DIGEST_RECORD)}; ` +
        'repair: use the sha256 value writeRowArtifact returned for the exact written bytes.',
      )
    }
    recorded.set(name, sha256)
  }
  const missingReceipts = ARTIFACT_CLASSES.filter((name) => !recorded.has(name))
  if (missingReceipts.length > 0) {
    throw new Error(
      `artifact digests: missing write receipt ${JSON.stringify(missingReceipts[0])} for field "writes" at path ${artifactPath(rowKey, ARTIFACT_DIGEST_RECORD)}; ` +
      `the row writes exactly ${JSON.stringify([...ARTIFACT_CLASSES])}; ` +
      'repair: write all six artifacts before writing the digest record.',
    )
  }

  const recordPath = join(rowDir, ARTIFACT_DIGEST_RECORD)
  if (existsSync(recordPath)) {
    throw new Error(
      `artifact digests: stale digest record for field "digests" at path ${artifactPath(rowKey, ARTIFACT_DIGEST_RECORD)}; ` +
      `found ${JSON.stringify(recordPath)} before this row wrote one; ` +
      'repair: use a fresh run root so a previous run digest record is never accepted.',
    )
  }
  const entries = readdirSync(rowDir, { withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
  const unexpected = files.filter((name) => !ARTIFACT_CLASS_NAMES.includes(name)).sort()
  if (unexpected.length > 0) {
    throw new Error(
      `artifact digests: unexpected-artifact ${JSON.stringify(unexpected[0])} for field "artifact" at path ${artifactPath(rowKey, unexpected[0])}; ` +
      `the row writes exactly ${JSON.stringify([...ARTIFACT_CLASSES])}; ` +
      'repair: remove the extra file before writing the digest record so the row keeps the closed six-class artifact set.',
    )
  }
  const missingFiles = ARTIFACT_CLASSES.filter((name) => !files.includes(name))
  if (missingFiles.length > 0) {
    throw new Error(
      `artifact digests: missing-artifact ${JSON.stringify(missingFiles[0])} for field "artifact" at path ${artifactPath(rowKey, missingFiles[0])}; ` +
      'repair: write every declared artifact before writing the digest record.',
    )
  }

  const artifacts = Object.freeze(Object.fromEntries(ARTIFACT_CLASSES.map((name) => [name, /** @type {string} */ (recorded.get(name))])))
  const record = Object.freeze({
    version: ARTIFACT_DIGEST_RECORD_VERSION,
    row: rowKey,
    artifacts,
  })
  try {
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' })
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'EEXIST') {
      throw new Error(
        `artifact digests: stale digest record for field "digests" at path ${artifactPath(rowKey, ARTIFACT_DIGEST_RECORD)}; ` +
        `refusing to overwrite ${JSON.stringify(recordPath)}; ` +
        'repair: use a fresh run root so a previous run digest record is never accepted.',
      )
    }
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `artifact digests: cannot write digest record for field "digests" at path ${artifactPath(rowKey, ARTIFACT_DIGEST_RECORD)}; ` +
      `tried ${JSON.stringify(recordPath)}; caused by ${cause}; ` +
      'repair: prepare the row directory under a writable run root before writing the digest record.',
    )
  }
  return record
}

/**
 * Read and validate one row-owned digest record. Missing, unreadable,
 * malformed, extra-entry, missing-entry, and invalid-hash records all fail
 * closed with the row and field named. This reader never computes a digest to
 * stand in for an absent recorded one.
 * @param {string} rowDir row directory
 * @param {string} rowKey expected row key (the row directory name)
 * @param {readonly string[]} [artifactClasses] declared artifact classes, defaults to the shared six
 * @returns {ArtifactDigestRecord} frozen validated record
 */
export function readArtifactDigestRecord(rowDir, rowKey, artifactClasses = ARTIFACT_CLASSES) {
  if (typeof rowKey !== 'string' || rowKey.length === 0) {
    throw new Error(
      'artifact digests: missing row key for field "rowKey" at path producer.rowKey; ' +
      'repair: pass the producer row key the run root declares.',
    )
  }
  const recordPath = join(rowDir, ARTIFACT_DIGEST_RECORD)
  const diagnosticPath = artifactPath(rowKey, ARTIFACT_DIGEST_RECORD)
  if (!existsSync(recordPath)) {
    throw new Error(
      `artifact digests: missing-digest-record for field "digests" at path ${diagnosticPath}; ` +
      `looked for ${JSON.stringify(recordPath)}; ` +
      'repair: re-run the producer row so it writes digests.json after its six artifacts.',
    )
  }
  let source
  try {
    source = readFileSync(recordPath, 'utf8')
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `artifact digests: unreadable-digest-record for field "digests" at path ${diagnosticPath}; ` +
      `cannot read ${JSON.stringify(recordPath)}; caused by ${cause}; ` +
      'repair: restore the row digest record or re-run the producer row.',
    )
  }
  let parsed
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `artifact digests: malformed-digest-record for field "digests" at path ${diagnosticPath}; ` +
      `invalid JSON in ${JSON.stringify(recordPath)}; caused by ${cause}; ` +
      'repair: re-run the producer row so digests.json holds valid JSON.',
    )
  }
  if (!isPlainRecord(parsed)) {
    throw new Error(
      `artifact digests: malformed-digest-record for field "digests" at path ${diagnosticPath}; ` +
      `expected a record at ${JSON.stringify(recordPath)} observed ${JSON.stringify(parsed)}; ` +
      'repair: re-run the producer row so digests.json holds a versioned record.',
    )
  }
  const fields = Object.keys(parsed).sort()
  if (JSON.stringify(fields) !== JSON.stringify(['artifacts', 'row', 'version'])) {
    throw new Error(
      `artifact digests: malformed-digest-record for field "digests" at path ${diagnosticPath}; ` +
      `expected fields ["artifacts","row","version"] observed ${JSON.stringify(fields)}; ` +
      'repair: re-run the producer row so digests.json carries exactly the declared fields.',
    )
  }
  if (parsed.version !== ARTIFACT_DIGEST_RECORD_VERSION) {
    throw new Error(
      `artifact digests: malformed-digest-record for field "version" at path ${diagnosticPath}.version; ` +
      `expected ${ARTIFACT_DIGEST_RECORD_VERSION} observed ${JSON.stringify(parsed.version)}; ` +
      'repair: re-run the producer row with the supported digest record version.',
    )
  }
  if (parsed.row !== rowKey) {
    throw new Error(
      `artifact digests: malformed-digest-record for field "row" at path ${diagnosticPath}.row; ` +
      `expected ${JSON.stringify(rowKey)} observed ${JSON.stringify(parsed.row)}; ` +
      'repair: keep the digest record in its own row directory and name the row it belongs to.',
    )
  }
  if (!isPlainRecord(parsed.artifacts)) {
    throw new Error(
      `artifact digests: malformed-digest-record for field "artifacts" at path ${diagnosticPath}.artifacts; ` +
      `expected a record observed ${JSON.stringify(parsed.artifacts)}; ` +
      'repair: re-run the producer row so digests.json names every artifact digest.',
    )
  }
  const recorded = /** @type {Record<string, unknown>} */ (parsed.artifacts)
  const observedNames = Object.keys(recorded)
  const unexpected = observedNames.filter((name) => !artifactClasses.includes(name)).sort()
  if (unexpected.length > 0) {
    throw new Error(
      `artifact digests: unexpected-digest-entry ${JSON.stringify(unexpected[0])} for field "artifacts" at path ${diagnosticPath}.artifacts.${unexpected[0]}; ` +
      `the record names exactly ${JSON.stringify([...artifactClasses])}; ` +
      'repair: remove the extra digest entry so the row keeps the closed six-class artifact set.',
    )
  }
  const missing = artifactClasses.filter((name) => !Object.hasOwn(recorded, name))
  if (missing.length > 0) {
    throw new Error(
      `artifact digests: missing-digest-entry ${JSON.stringify(missing[0])} for field "artifacts" at path ${diagnosticPath}.artifacts; ` +
      `the record names exactly ${JSON.stringify([...artifactClasses])}; ` +
      'repair: re-run the producer row so digests.json records every artifact digest.',
    )
  }
  /** @type {Record<string, string>} */
  const artifacts = {}
  for (const name of artifactClasses) {
    const digest = recorded[name]
    if (!isArtifactDigest(digest)) {
      throw new Error(
        `artifact digests: invalid-digest ${JSON.stringify(digest)} for field "artifacts.${name}" at path ${diagnosticPath}.artifacts.${name}; ` +
        'repair: use the 64-character lowercase hex SHA-256 the producer recorded for the exact artifact bytes.',
      )
    }
    artifacts[name] = digest
  }
  return Object.freeze({
    version: ARTIFACT_DIGEST_RECORD_VERSION,
    row: rowKey,
    artifacts: Object.freeze(artifacts),
  })
}

/**
 * Read the digest record, check the row directory carries exactly the declared
 * artifact classes plus the digest record, read every artifact, and compare its
 * current SHA-256 against the recorded one. No artifact content is parsed here:
 * the verifier calls this before reading any JSON artifact, so a malformed JSON
 * byte mutation still reports a digest mismatch.
 * @param {object} input verification inputs
 * @param {string} input.rowDir row directory
 * @param {string} input.rowKey expected row key
 * @param {readonly string[]} [input.artifactClasses] declared artifact classes, defaults to the shared six
 * @returns {VerifiedRowArtifacts} frozen verified artifacts and their record
 */
export function readVerifiedRowArtifacts({ rowDir, rowKey, artifactClasses = ARTIFACT_CLASSES }) {
  const record = readArtifactDigestRecord(rowDir, rowKey, artifactClasses)
  const entries = readdirSync(rowDir, { withFileTypes: true })
  const unexpected = entries
    .filter((entry) => !entry.isFile() || (!artifactClasses.includes(entry.name) && entry.name !== ARTIFACT_DIGEST_RECORD))
    .map((entry) => entry.name)
    .sort()
  if (unexpected.length > 0) {
    throw new Error(
      `artifact digests: unexpected-artifact ${JSON.stringify(unexpected[0])} for field "artifact" at path ${artifactPath(rowKey, unexpected[0])}; ` +
      `the row carries exactly ${JSON.stringify([...artifactClasses])} plus ${JSON.stringify(ARTIFACT_DIGEST_RECORD)}; ` +
      'repair: remove the extra file so one verifier reads the closed six-class artifact set.',
    )
  }
  /** @type {VerifiedArtifact[]} */
  const artifacts = []
  for (const name of artifactClasses) {
    const path = join(rowDir, name)
    let content
    try {
      content = readFileSync(path)
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
        throw new Error(
          `artifact digests: missing-artifact ${JSON.stringify(name)} for field "artifact" at path ${artifactPath(rowKey, name)}; ` +
          `looked for ${JSON.stringify(path)}; ` +
          'repair: re-run the producer row so it writes every artifact the digest record names.',
        )
      }
      const cause = error instanceof Error ? error.message : String(error)
      throw new Error(
        `artifact digests: unreadable-artifact ${JSON.stringify(name)} for field "artifact" at path ${artifactPath(rowKey, name)}; ` +
        `cannot read ${JSON.stringify(path)}; caused by ${cause}; ` +
        'repair: restore the artifact file or re-run the producer row.',
      )
    }
    const current = digestOf(content)
    const recordedDigest = record.artifacts[name]
    if (current !== recordedDigest) {
      throw new Error(
        `artifact digests: digest-mismatch for field "digest" at path ${artifactPath(rowKey, `${name}.digest`)}; ` +
        `recorded ${JSON.stringify(recordedDigest)} current ${JSON.stringify(current)}; ` +
        'repair: rebuild the row or restore the unchanged artifact bytes; the digest record is the expected value and is never regenerated from the current file.',
      )
    }
    artifacts.push(Object.freeze({ name, content, digest: recordedDigest }))
  }
  return Object.freeze({ record, artifacts: Object.freeze(artifacts) })
}
