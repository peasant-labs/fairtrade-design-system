/* Demo digest for a pull request page (acme/ingest-api #42): two transcripts behind 3 of 4
   commits. The first carries its prompts; the second arrives collapsed, its boundary standing in
   for its ten prompts. Dummy data shaped exactly as the schema PromptDigest. */

const FIX = '3f9c0a17-2b64-4e1d-9a53-8c0e21a4b7d2'
const GUARD = 'c41a9f20-6d3e-4b18-8f07-5e2a91c3d460'

export const PR_DIGEST = Object.freeze({
  header: {
    sessionCount: 2,
    promptCount: 14,
    commitsCovered: 3,
    commitsTotal: 4,
    harness: 'claude-code',
    redactionLevel: 'standard',
    villageUrl: 'https://village.peasantlabs.org/pulls/acme/ingest-api/42',
  },
  skills: [{ name: '/toolkit:write-plan', invocationCount: 1 }],
  items: [
    { kind: 'session', transcriptId: FIX, timestamp: '2026-09-28T10:00:00Z', text: 'Fix flaky ingest test', promptCount: 4, commitCount: 2 },
    { kind: 'prompt', transcriptId: FIX, timestamp: '2026-09-28T10:00:10Z', text: 'the ingest test flakes on CI about 1 in 5 runs', turnIndex: 1, ordinal: 1 },
    { kind: 'prompt', transcriptId: FIX, timestamp: '2026-09-28T10:06:00Z', text: 'check the retry backoff', turnIndex: 4, ordinal: 2 },
    { kind: 'skill', transcriptId: FIX, timestamp: '2026-09-28T10:06:30Z', text: '/toolkit:write-plan', turnIndex: 5 },
    { kind: 'prompt', transcriptId: FIX, timestamp: '2026-09-28T10:14:00Z', text: 'run it 50 times locally', turnIndex: 10, ordinal: 3 },
    { kind: 'prompt', transcriptId: FIX, timestamp: '2026-09-28T10:38:00Z', text: 'ok commit it', turnIndex: 33, ordinal: 4 },
    { kind: 'commit', transcriptId: FIX, timestamp: '2026-09-28T10:40:00Z', text: 'fix retry backoff in the ingest test', commitSha: '9f3c2ab41d7e08c5a6b2f9e0d3c7a1b4e5f60718', additions: 18, deletions: 6, filesChanged: 2 },
    { kind: 'commit', transcriptId: FIX, timestamp: '2026-09-28T10:42:00Z', text: 'wait for the queue to drain before asserting', commitSha: '1b7e0d4c9a2f36e18b5d7c0a4e9f2b3d6c8a1e05', additions: 9, deletions: 2, filesChanged: 1 },
    { kind: 'session', transcriptId: GUARD, timestamp: '2026-09-28T12:00:00Z', text: 'Guard empty turns in the digest', promptCount: 10, commitCount: 1 },
    { kind: 'commit', transcriptId: GUARD, timestamp: '2026-09-28T12:40:00Z', text: '', commitSha: 'c41a9f2e7b3d05c8a61f9e2d4b7c0a3e5f8d1b62' },
  ],
})

/* the page links each chain item into village or GitHub; the demo stands in for those routes. */
export function prDigestHref(item) {
  if (item.kind === 'commit') return `https://github.com/acme/ingest-api/commit/${item.commitSha}`
  if (item.turnIndex == null) return `https://village.peasantlabs.org/transcripts/${item.transcriptId}`
  return `https://village.peasantlabs.org/transcripts/${item.transcriptId}#turn-${item.turnIndex}`
}
