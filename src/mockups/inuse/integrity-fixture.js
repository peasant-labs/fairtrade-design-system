/* The flagged integrity value the demo and the stories serve alongside the reading payload.
   Positions 2 and 3 of readingPayload() are the flagged turns: an assistant prose turn with one
   action, and the tool-only turn the ledger folds into its action block. The served hash and the
   rendered hash match, so the marks draw; a host whose two hashes differ draws the badge alone. */
export const integrityFlagged = Object.freeze({ flagged_turns: Object.freeze([2, 3]) })
export const integrityServedHash = 'sha256:3f1c9a0d52b7e48a6c0e1d7f94b2a8c5d63e07f1b9a4c2d85e60f713a9b4c0de'
export const integrityOtherHash = 'sha256:9b7e2c40a1d86f35e0c4b7a92d18f6035ac7e4b1d90f2a6837c5e1b04d9a2f68'

/** the props a host passes when the served flag and the rendered content agree */
export const integrityBoundProps = Object.freeze({
  integrity: integrityFlagged,
  transcriptContentHash: integrityServedHash,
  contentHash: integrityServedHash,
  integrityHelpHref: 'https://example.org/docs/transcript-check',
})
