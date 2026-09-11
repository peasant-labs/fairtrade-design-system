// @ts-check

import PromptDigest from './PromptDigest.jsx'

/** @typedef {import('@peasant-labs/schema').PromptDigest} PromptDigestPayload */
/** @typedef {import('@peasant-labs/schema').PromptDigestItem} PromptDigestItemPayload */

const TRANSCRIPT_ID = '7b1e4d2a-9c3f-4e8b-a1d6-2f5c8e9a0b13'

/* The component's `digest` prop IS the schema type, with no local restatement of its shape: this
   object is declared as the canonical PromptDigest, so a contract change that the component has
   not adopted fails here rather than in a consumer. */
/** @type {PromptDigestPayload} */
const digest = {
  header: {
    sessionCount: 1,
    promptCount: 1,
    commitsCovered: 1,
    commitsTotal: 1,
    harness: 'claude-code',
    redactionLevel: 'standard',
    villageUrl: 'https://village.example/pulls/peasant-labs/village/116',
  },
  skills: [{ name: '/toolkit:write-plan', invocationCount: 1 }],
  items: [
    {
      kind: 'session',
      transcriptId: TRANSCRIPT_ID,
      timestamp: '2026-09-06T14:00:00Z',
      text: 'session 1',
      promptCount: 1,
      commitCount: 1,
    },
    {
      kind: 'prompt',
      transcriptId: TRANSCRIPT_ID,
      timestamp: '2026-09-06T14:02:00Z',
      text: 'add a github check that posts the prompts behind a PR',
      turnIndex: 4,
      ordinal: 1,
    },
    {
      kind: 'skill',
      transcriptId: TRANSCRIPT_ID,
      timestamp: '2026-09-06T14:02:30Z',
      text: '/toolkit:write-plan',
      turnIndex: 5,
    },
    {
      kind: 'commit',
      transcriptId: TRANSCRIPT_ID,
      timestamp: '2026-09-06T14:10:00Z',
      text: '',
      commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    },
  ],
}

PromptDigest({ digest })
PromptDigest({ digest, className: 'pd-demo' })

/* the link builder receives the canonical item type, so the item's `kind` and its per-kind fields
   are what a consumer switches on to pick a destination. */
PromptDigest({
  digest,
  itemHref: (item) =>
    item.kind === 'commit'
      ? `https://github.com/peasant-labs/village/commit/${item.commitSha}`
      : `${digest.header.villageUrl}/transcripts/${item.transcriptId}`,
})

/** @type {(item: PromptDigestItemPayload) => string} */
const itemHref = (item) => item.transcriptId
PromptDigest({ digest, itemHref })

/* `author` is a component prop supplied by the page, not part of the wire payload: it is not
   read from `PromptDigestPayload` above, only declared locally by the component. */
PromptDigest({ digest, author: { login: 'octocat', avatarUrl: 'https://example.test/octocat.png' } })

// @ts-expect-error author is { login, avatarUrl }, not an arbitrary object
PromptDigest({ digest, author: { login: 'octocat' } })

/* every negative below is a SINGLE-LINE call on purpose: `@ts-expect-error` suppresses only a
   diagnostic reported on the very next line, and tsc reports a bad item kind deep inside the
   object literal, not on the line the call opens. */
// @ts-expect-error the digest is required; the component renders what it is given and builds nothing
PromptDigest({})

// @ts-expect-error a loosely-shaped object is not the canonical digest
PromptDigest({ digest: { header: { sessionCount: 1 }, skills: [], items: [] } })

// @ts-expect-error the header carries a canonical Harness, not arbitrary provider prose
PromptDigest({ digest: { ...digest, header: { ...digest.header, harness: 'google' } } })

// @ts-expect-error the chain kinds are a closed set
PromptDigest({ digest: { ...digest, items: [{ kind: 'paragraph', transcriptId: TRANSCRIPT_ID, timestamp: '2026-09-06T14:00:00Z', text: 'x' }] } })

// @ts-expect-error the link builder resolves an item to a string, never to nothing
PromptDigest({ digest, itemHref: () => undefined })
