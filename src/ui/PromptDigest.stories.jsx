import { expect, within } from 'storybook/test'
import PromptDigest from './PromptDigest.jsx'

/* PromptDigest stories. CSF3: a Playground driven by meta.args plus one named story per
   meaningful state — the short chain, the collapsed-boundary chain, each item kind on its own,
   and the chain with no link builder. classes + tokens come from src/index.css and the colocated
   PromptDigest.css via .storybook/preview.jsx; the theme toolbar flips data-theme.

   the fixtures are shaped the way Village sends them: chronological, with the header counting the
   complete chain, prompt ordinals running in chain order, and every chain skill named by a header
   entry. COLLAPSE IS DATA — CollapsedBoundaries is a chain whose later sessions are represented
   only by their boundary rows, each carrying the promptCount it stands in for. */

const TRANSCRIPT_A = '7b1e4d2a-9c3f-4e8b-a1d6-2f5c8e9a0b13'
const TRANSCRIPT_B = 'c4e51f08-6a2b-4d97-8f30-1b7de254a9c6'
const TRANSCRIPT_C = '1d9a7c35-8e42-4b60-9f18-3a5c7e20d4b8'

const SHA_ONE = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const SHA_TWO = 'b2c3d4e5f60718293a4b5c6d7e8f901234567890'
const SHA_THREE = 'c3d4e5f60718293a4b5c6d7e8f90123456789012'

/* a prompt long enough to exercise the 120-character cut, written in ordinary sentence case so a
   reviewer can see the author's own capitalisation survive the render. */
const LONG_PROMPT =
  'Add a GitHub check that posts the prompts behind a pull request, so a reviewer can see the intent as well as the diff, and keep it one sticky comment'

const CUT_PROMPT = `${LONG_PROMPT.slice(0, 120)}…`

/* the consumer owns the routes. Village would build these from the attachment's owner/name and
   its own viewer paths; the stories stand in for that. */
const itemHref = (item) => {
  if (item.kind === 'commit') return `https://github.com/peasant-labs/village/commit/${item.commitSha}`
  if (item.turnIndex == null) return `https://village.example/transcripts/${item.transcriptId}`
  return `https://village.example/transcripts/${item.transcriptId}?turn=${item.turnIndex}`
}

const shortChain = {
  header: {
    sessionCount: 2,
    promptCount: 5,
    commitsCovered: 3,
    commitsTotal: 3,
    harness: 'claude-code',
    redactionLevel: 'standard',
    villageUrl: 'https://village.example/pulls/peasant-labs/village/116',
  },
  skills: [
    { name: '/toolkit:brainstorm', invocationCount: 1 },
    { name: '/toolkit:write-plan', invocationCount: 1 },
    { name: 'context7', invocationCount: 2 },
  ],
  items: [
    { kind: 'session', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:00:00Z', text: 'session 1', promptCount: 3, commitCount: 2 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:02:00Z', text: LONG_PROMPT, turnIndex: 4, ordinal: 1 },
    { kind: 'skill', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:02:30Z', text: '/toolkit:brainstorm', turnIndex: 5 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:19:00Z', text: 'It should reuse the share path rather than adding a second upload route.', turnIndex: 18, ordinal: 2 },
    { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:41:00Z', text: SHA_ONE.slice(0, 7), commitSha: SHA_ONE },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T15:02:00Z', text: 'Detach has to restore each transcript’s prior visibility exactly.', turnIndex: 31, ordinal: 3 },
    { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T15:28:00Z', text: '', commitSha: SHA_TWO },
    { kind: 'session', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-07T09:14:00Z', text: 'session 2', promptCount: 2, commitCount: 1 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-07T09:16:00Z', text: 'Write the plan before touching any code.', turnIndex: 2, ordinal: 4 },
    { kind: 'skill', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-07T09:16:20Z', text: '/toolkit:write-plan', turnIndex: 3 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-07T10:02:00Z', text: 'Now fold the review findings back into the fixtures.', turnIndex: 22, ordinal: 5 },
    { kind: 'commit', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-07T10:44:00Z', text: '', commitSha: SHA_THREE },
  ],
}

/* the collapsed state: the first session still shows its prompts, while the later two contribute
   only a boundary row each, stating the run of prompts that row stands in for. the commit anchors
   stay, because they are what ties the chain to the pull request. the header counts the chain as
   sent, which is what makes a boundary row the reviewer's way back to the rest. */
const collapsedChain = {
  header: {
    sessionCount: 3,
    promptCount: 2,
    commitsCovered: 2,
    commitsTotal: 9,
    harness: 'claude-code',
    redactionLevel: 'standard',
    villageUrl: 'https://village.example/pulls/peasant-labs/village/116',
  },
  skills: [{ name: '/toolkit:brainstorm', invocationCount: 1 }],
  items: [
    { kind: 'session', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:00:00Z', text: 'session 1', promptCount: 12, commitCount: 4 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:02:00Z', text: LONG_PROMPT, turnIndex: 4, ordinal: 1 },
    { kind: 'skill', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:02:30Z', text: '/toolkit:brainstorm', turnIndex: 5 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:19:00Z', text: 'It should reuse the share path rather than adding a second upload route.', turnIndex: 18, ordinal: 2 },
    { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T15:28:00Z', text: '', commitSha: SHA_ONE },
    { kind: 'session', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-07T09:14:00Z', text: 'session 2', promptCount: 9, commitCount: 3 },
    { kind: 'session', transcriptId: TRANSCRIPT_C, timestamp: '2026-09-08T11:05:00Z', text: 'session 3', promptCount: 6, commitCount: 2 },
    { kind: 'commit', transcriptId: TRANSCRIPT_C, timestamp: '2026-09-08T12:30:00Z', text: '', commitSha: SHA_TWO },
  ],
}

/* one item kind on its own. the header describes exactly the chain below it, so the counts read
   as zero for the kinds this fixture does not carry. */
const single = (header, items, skills = []) => ({
  header: {
    sessionCount: 0,
    promptCount: 0,
    commitsCovered: 0,
    commitsTotal: 0,
    harness: 'claude-code',
    redactionLevel: 'standard',
    villageUrl: 'https://village.example/pulls/peasant-labs/village/116',
    ...header,
  },
  skills,
  items,
})

const meta = {
  title: 'components/PromptDigest',
  component: PromptDigest,
  tags: ['autodocs'],
  argTypes: {
    digest: { control: 'object' },
    className: { control: 'text' },
  },
  args: { digest: shortChain, itemHref },
}
export default meta

export const Playground = {}

export const Chain = {
  name: 'chain',
  args: { digest: shortChain },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // a prompt shows its first line cut at 120 characters, in the author's own case
    await expect(canvas.getByText(CUT_PROMPT)).toBeInTheDocument()

    // the slash-prefixed invocation survives exactly as recorded, in the skills row AND in the
    // chain (so the name is queried as a pair, never as a unique node), and the chain marker
    // links to the same turn as the prompt it followed
    const invocations = canvas.getAllByText('/toolkit:brainstorm')
    await expect(invocations).toHaveLength(2)
    const marker = invocations.find((node) => node.closest('.pd-row-skill'))
    await expect(marker.closest('a')).toHaveAttribute(
      'href',
      `https://village.example/transcripts/${TRANSCRIPT_A}?turn=5`,
    )

    // a commit anchor shows the abbreviated sha ONCE and leaves for GitHub: the wire's redundant
    // `text`, which the schema's own fixtures set to that same abbreviated sha, is not rendered too
    const shas = canvas.getAllByText(SHA_ONE.slice(0, 7))
    await expect(shas).toHaveLength(1)
    await expect(shas[0].closest('a')).toHaveAttribute(
      'href',
      `https://github.com/peasant-labs/village/commit/${SHA_ONE}`,
    )

    // a prompt links into the shared viewer at its turn
    const prompt = canvas.getByText(CUT_PROMPT)
    await expect(prompt.closest('a')).toHaveAttribute(
      'href',
      `https://village.example/transcripts/${TRANSCRIPT_A}?turn=4`,
    )

    // a session boundary links to its transcript on Village
    const boundary = canvas.getByText('session 2')
    await expect(boundary.closest('a')).toHaveAttribute(
      'href',
      `https://village.example/transcripts/${TRANSCRIPT_B}`,
    )
  },
}

export const CollapsedBoundaries = {
  name: 'collapsed boundaries',
  args: { digest: collapsedChain },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // every session keeps a visible boundary, including the ones standing in for a run of prompts
    await expect(canvas.getByText('session 1')).toBeInTheDocument()
    const sessionTwo = canvas.getByText('session 2').closest('.pd-row')
    const sessionThree = canvas.getByText('session 3').closest('.pd-row')

    // a collapsed boundary states the run of prompts it stands in for, on its own row
    await expect(within(sessionTwo).getByText('9')).toBeInTheDocument()
    await expect(within(sessionThree).getByText('6')).toBeInTheDocument()

    // and those sessions contribute no prompt rows: only session 1's two prompts are in the chain
    await expect(canvasElement.querySelectorAll('.pd-row-prompt')).toHaveLength(2)
  },
}

export const SessionBoundary = {
  name: 'session boundary',
  args: {
    digest: single({ sessionCount: 1 }, [
      { kind: 'session', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:00:00Z', text: 'session 1', promptCount: 9, commitCount: 3 },
    ]),
  },
}

export const Prompt = {
  name: 'prompt',
  args: {
    digest: single({ promptCount: 1 }, [
      { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:02:00Z', text: LONG_PROMPT, turnIndex: 4, ordinal: 1 },
    ]),
  },
}

export const SkillMarker = {
  name: 'skill marker',
  args: {
    digest: single(
      {},
      [{ kind: 'skill', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:02:30Z', text: '/toolkit:brainstorm', turnIndex: 5 }],
      [{ name: '/toolkit:brainstorm', invocationCount: 1 }],
    ),
  },
}

export const CommitAnchor = {
  name: 'commit anchor',
  args: {
    digest: single({ commitsCovered: 1, commitsTotal: 1 }, [
      { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:41:00Z', text: '', commitSha: SHA_ONE },
    ]),
  },
}

/* no link builder: a consumer without routes yet still gets a readable chain. this one uses
   `render` rather than `args: { itemHref: undefined }` — an explicit undefined in story args does
   not reliably override a value already set in meta.args, so the omission is made structural. */
export const WithoutLinks = {
  name: 'without links',
  render: () => <PromptDigest digest={shortChain} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(CUT_PROMPT).closest('a')).toBeNull()
  },
}
