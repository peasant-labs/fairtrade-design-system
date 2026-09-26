// App-owned, kind-neutral Fairtest artifact contract.
//
// This module holds the values BOTH the product and the component mounted rows
// share, so neither kind has to reach into the other kind's producer module for
// them:
//
// - the closed six-class durable artifact set every row writes, so one verifier
//   reads both kinds;
// - the served-digest comparison that binds the bytes a row read over HTTP to
//   the run root's own built tree, parameterized by the tree label the receipt
//   names;
// - the shared host contract's product-only field list, re-exported once so a
//   component module never re-spells it.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { importFairtestSource } from '../fairtest-source.mjs'

const resolutionContract = await importFairtestSource('src/host-contract/resolution.mjs')

/**
 * The six durable artifact classes every mounted row writes. Exact set, no
 * silent extras. The verifier owns completeness against this list, and both
 * kinds alias this one frozen array so the two can never diverge.
 * @type {string[]}
 */
export const ARTIFACT_CLASSES = Object.freeze([
  'record.json',
  'aria.json',
  'axe.json',
  'screenshot.png',
  'provenance.json',
  'resolution.json',
])

/**
 * The product-only shell fields the shared host contract refuses on the
 * component branch, re-exported from the contract so component modules read one
 * source instead of re-spelling the list.
 * @type {string[]}
 */
export const PRODUCT_ONLY_FIELDS = Object.freeze([...resolutionContract.PRODUCT_ONLY_FIELDS])

/**
 * Hash bytes with sha256 and return the hex digest.
 * @param {Buffer|string} data bytes to hash
 * @returns {string} hex digest
 */
function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Compare the digests the row read over HTTP against the bytes the run's own
 * build tree holds on disk, so the recorded provenance is a MEASURED
 * correspondence instead of a bare list of hashes.
 *
 * What this proves: every recorded digest is the digest of the same bytes the
 * run root's built tree contains, so a served origin that was not this run's
 * build (an unrelated server already holding the port, a stale copy, a mutated
 * file) fails closed instead of producing a record whose digests describe
 * something other than what the row looked at.
 *
 * What this does NOT prove, and must not be read as proving: that the built
 * tree was produced from the recorded commit. dist/ and storybook-static/ are
 * gitignored, so `commit` and `dirty` describe the worktree the build ran in,
 * not the bytes. Binding those bytes to a commit needs a build digest recorded
 * in source, which is the verifier's comparison, not the producer's. The record
 * says so in `commitCorrespondence` rather than implying more.
 * @param {object} input comparison inputs
 * @param {Record<string, string>} input.assetDigests digests the row read over HTTP, keyed by run-root-relative path
 * @param {string} input.distRoot the run's built tree on disk
 * @param {string} [input.label] owning producer used in the diagnostic, defaults to the product producer
 * @param {string} [input.against] the tree label the receipt names as compared, defaults to the product run root
 * @returns {object} the comparison receipt naming what was compared
 */
export function assertServedDigestsMatchRunRoot({ assetDigests, distRoot, label = 'product producer', against = 'run-root-dist' } = {}) {
  if (typeof against !== 'string' || against.length === 0) {
    throw new Error(
      `${label}: missing served-tree label for field "servedFrom" at path provenance.servedFrom; ` +
      'repair: pass the tree label the recorded digests are actually compared against.',
    )
  }
  const compared = Object.keys(assetDigests).sort()
  if (compared.length === 0) {
    throw new Error(
      `${label}: empty served digest set for field "assetDigests" at path provenance.assetDigests; ` +
      'repair: record at least the served index.html digest before comparing the served bytes to the built tree.',
    )
  }
  for (const relative of compared) {
    const onDiskPath = join(distRoot, relative)
    let onDisk
    try {
      onDisk = readFileSync(onDiskPath)
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error)
      throw new Error(
        `${label}: served asset ${JSON.stringify(relative)} is missing from the run build tree for field "assetDigests" at path provenance.assetDigests; ` +
        `looked for ${JSON.stringify(onDiskPath)}; caused by ${cause}; ` +
        'repair: rebuild the served tree so the served origin and the built tree are the same tree.',
      )
    }
    const onDiskDigest = sha256(onDisk)
    if (onDiskDigest !== assetDigests[relative]) {
      throw new Error(
        `${label}: served bytes differ from the run build tree for field "assetDigests" at path provenance.assetDigests; ` +
        `${JSON.stringify(relative)} served digest ${JSON.stringify(assetDigests[relative])} but ${JSON.stringify(onDiskPath)} holds ${JSON.stringify(onDiskDigest)}; ` +
        'repair: serve the exact built tree (rebuild it and make sure no other server holds the loopback port).',
      )
    }
  }
  return Object.freeze({
    against,
    entries: Object.freeze(compared),
    commitCorrespondence: 'verifier-owned',
  })
}
