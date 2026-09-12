import { expect, userEvent, waitFor, within } from 'storybook/test'
import PromptDigest from './PromptDigest.jsx'

/* PromptDigest stories. CSF3: a Playground driven by meta.args plus one named story per
   meaningful state — the collapsed default chain, the collapsed-boundary chain, a chain with no
   commits yet, each remaining item kind on its own, a chain with no link builder, and the
   expanded states. classes + tokens come from src/index.css and the colocated PromptDigest.css
   via .storybook/preview.jsx; the theme toolbar flips data-theme.

   the fixtures are shaped the way Village sends them: chronological, with the header counting the
   complete chain, prompt ordinals running in chain order, and every chain skill named by a header
   entry. COLLAPSE IS DATA — CollapsedBoundaries is a chain whose later sessions are represented
   only by their boundary rows, each carrying the promptCount it stands in for.

   the default chain now shows session boundaries and prompt rows only: a skill or commit item is
   always present in the DOM (grouped under the prompt it followed) but stays inside that prompt's
   `hidden` details until its chevron opens it — Chain's play() asserts none of them are direct
   .pd-chain children. AUTHOR's avatarUrl is an inline SVG data uri so Storybook fetches nothing
   from the network. */

const TRANSCRIPT_A = '7b1e4d2a-9c3f-4e8b-a1d6-2f5c8e9a0b13'
const TRANSCRIPT_B = 'c4e51f08-6a2b-4d97-8f30-1b7de254a9c6'
const TRANSCRIPT_C = '1d9a7c35-8e42-4b60-9f18-3a5c7e20d4b8'

const SHA_ONE = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const SHA_TWO = 'b2c3d4e5f60718293a4b5c6d7e8f901234567890'
const SHA_THREE = 'c3d4e5f60718293a4b5c6d7e8f90123456789012'

/* six commits for ManyCommitsAndSkills, below — a distinct set so its fixture reads independently
   of the other stories' shas rather than reusing them out of context. reuses TRANSCRIPT_A /
   TRANSCRIPT_B for its two sessions, same as shortChain above. */
const SHA_M1 = '397fd614368965258146de26d14204237c8c7b97'
const SHA_M2 = '34f8440f0485ceed3ac019a835258e6c3f91a4d4'
const SHA_M3 = 'fddc8bebd574de8abba2a59dc5d12ddf1de092c4'
const SHA_M4 = 'bb98285f5dfbe5a9350450278e4900b7cba02613'
const SHA_M5 = '2d3f27762263abbc6acb87e7fd5e44efcacd2c33'
const SHA_M6 = 'f48008406775436a58df3fb191c4a9e93f9186b1'

/* a prompt long enough to show real wrapping under the two-line clamp, written in ordinary
   sentence case so a reviewer can see the author's own capitalisation survive the render. no
   character cut applies to it any more: the clamp is CSS-only, so this exact string is always the
   full text in the DOM, whether the row is collapsed or open. */
const LONG_PROMPT =
  'Add a GitHub check that posts the prompts behind a pull request, so a reviewer can see the intent as well as the diff, and keep it one sticky comment'

/* longer still, for ManyCommitsAndSkills below: three-plus lines at the story's rendered width, so
   the two-line clamp visibly truncates it rather than merely wrapping once. */
const MANY_LINE_PROMPT =
  'Refactor the ingest pipeline so the commit detector no longer polls the git log on a timer, and instead reacts to the same file-system watch events the session recorder already subscribes to, then update every call site that assumed the old polling cadence and add a regression test for the race between a fast commit and a slow flush.'

/* the writer of these prompts, supplied by the page — never part of the digest itself. the
   placeholder stands in for a photograph, so it stays neutral grey (the dark theme's --ink-3
   `#9a9488` on the silhouette's `#fdfcfa`, both plain literals inside the data uri, since a data
   uri cannot reference a CSS custom property) — never amber or gold, which is this system's
   scarce accent. */
const AUTHOR = {
  login: 'councilmember',
  avatarUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%239a9488'/%3E%3Ccircle cx='16' cy='13' r='6' fill='%23fdfcfa'/%3E%3Cpath d='M4 30c0-8 5-12 12-12s12 4 12 12' fill='%23fdfcfa'/%3E%3C/svg%3E",
}

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
    { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:41:00Z', text: SHA_ONE.slice(0, 7), commitSha: SHA_ONE, additions: 42, deletions: 7, filesChanged: 3 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T15:02:00Z', text: 'Detach has to restore each transcript’s prior visibility exactly.', turnIndex: 31, ordinal: 3 },
    // no counts on this commit: predates the schema field, so its detail line and the sum above
    // both omit it rather than showing it as a zero.
    { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T15:28:00Z', text: '', commitSha: SHA_TWO },
    { kind: 'session', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-07T09:14:00Z', text: 'session 2', promptCount: 2, commitCount: 1 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-07T09:16:00Z', text: 'Write the plan before touching any code.', turnIndex: 2, ordinal: 4 },
    { kind: 'skill', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-07T09:16:20Z', text: '/toolkit:write-plan', turnIndex: 3 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-07T10:02:00Z', text: 'Now fold the review findings back into the fixtures.', turnIndex: 22, ordinal: 5 },
    { kind: 'commit', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-07T10:44:00Z', text: '', commitSha: SHA_THREE, additions: 15, deletions: 2, filesChanged: 1 },
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

/* no commits at all: a session whose prompts have not yet produced a commit the harness could
   match to this pull request. the header's commit field stays a matched-of-total pair even when
   matched is zero — "0 of 3" — rather than folding the empty state into a dash; the session
   boundary states its own zero the same way. */
const noCommitsChain = {
  header: {
    sessionCount: 1,
    promptCount: 4,
    commitsCovered: 0,
    commitsTotal: 3,
    harness: 'claude-code',
    redactionLevel: 'standard',
    villageUrl: 'https://village.example/pulls/peasant-labs/village/116',
  },
  skills: [{ name: '/toolkit:brainstorm', invocationCount: 1 }],
  items: [
    { kind: 'session', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-09T10:00:00Z', text: 'session 1', promptCount: 4, commitCount: 0 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-09T10:02:00Z', text: 'Sketch the approach before touching any code.', turnIndex: 2, ordinal: 1 },
    { kind: 'skill', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-09T10:02:30Z', text: '/toolkit:brainstorm', turnIndex: 3 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-09T10:20:00Z', text: 'Talk through the tradeoffs before committing to one.', turnIndex: 9, ordinal: 2 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-09T10:41:00Z', text: 'Write up the plan so it is ready for review.', turnIndex: 14, ordinal: 3 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-09T11:02:00Z', text: 'Hold off on any commit until the plan is approved.', turnIndex: 19, ordinal: 4 },
  ],
}

/* a richer chain for ManyCommitsAndSkills, below: two sessions, several distinct skill
   invocations, and prompts with more than one commit apiece, so a reviewer can see how the
   grouped disclosure reads once a prompt did real, multi-step work. session 1: prompt 1 (two
   different skills, two commits), prompt 2 (three-plus lines of text so the clamp visibly
   truncates, one skill, no commit), prompt 3 (three commits). session 2: prompt 4 (one skill, one
   commit), prompt 5 (nothing). the header counts the full chain, matching the items below:
   commitsCovered is exactly the six commit items; commitsTotal is a few more, standing in for
   commits the harness could not match to a session. */
const manyCommitsAndSkillsChain = {
  header: {
    sessionCount: 2,
    promptCount: 5,
    commitsCovered: 6,
    commitsTotal: 9,
    harness: 'claude-code',
    redactionLevel: 'standard',
    villageUrl: 'https://village.example/pulls/peasant-labs/village/116',
  },
  skills: [
    { name: '/toolkit:brainstorm', invocationCount: 2 },
    { name: 'context7', invocationCount: 1 },
    { name: '/toolkit:write-plan', invocationCount: 1 },
  ],
  items: [
    { kind: 'session', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T09:00:00Z', text: 'session 1', promptCount: 3, commitCount: 5 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T09:02:00Z', text: 'Wire the redaction settings into the prompt digest before landing the review UI.', turnIndex: 4, ordinal: 1 },
    { kind: 'skill', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T09:02:20Z', text: '/toolkit:brainstorm', turnIndex: 5 },
    { kind: 'skill', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T09:04:00Z', text: 'context7', turnIndex: 6 },
    { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T09:20:00Z', text: '', commitSha: SHA_M1, additions: 18, deletions: 4, filesChanged: 2 },
    { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T09:24:00Z', text: '', commitSha: SHA_M2, additions: 9, deletions: 1, filesChanged: 1 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T09:40:00Z', text: MANY_LINE_PROMPT, turnIndex: 19, ordinal: 2 },
    { kind: 'skill', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T09:40:30Z', text: '/toolkit:write-plan', turnIndex: 20 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T10:10:00Z', text: 'Land the three follow-up commits for the ingest refactor in small reviewable steps.', turnIndex: 34, ordinal: 3 },
    { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T10:22:00Z', text: '', commitSha: SHA_M3, additions: 120, deletions: 30, filesChanged: 6 },
    { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T10:31:00Z', text: '', commitSha: SHA_M4, additions: 45, deletions: 10, filesChanged: 3 },
    // no counts on this one: shows the per-commit suffix omission, and the sum above (prompt 3,
    // the largest here) totals only the two commits that do carry counts.
    { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-10T10:47:00Z', text: '', commitSha: SHA_M5 },
    { kind: 'session', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-11T08:30:00Z', text: 'session 2', promptCount: 2, commitCount: 1 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-11T08:32:00Z', text: 'Add the regression test for the race between a fast commit and a slow flush.', turnIndex: 6, ordinal: 4 },
    { kind: 'skill', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-11T08:32:20Z', text: '/toolkit:brainstorm', turnIndex: 7 },
    { kind: 'commit', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-11T08:55:00Z', text: '', commitSha: SHA_M6, additions: 6, deletions: 2, filesChanged: 1 },
    { kind: 'prompt', transcriptId: TRANSCRIPT_B, timestamp: '2026-09-11T09:10:00Z', text: 'Nothing else changed here.', turnIndex: 15, ordinal: 5 },
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
  args: { digest: shortChain, author: AUTHOR },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // the default chain shows session boundaries and prompt rows only: no skill or commit item
    // gets a top-level row of its own any more
    await expect(canvasElement.querySelectorAll('.pd-chain > .pd-row-skill, .pd-chain > .pd-row-commit')).toHaveLength(0)

    // a prompt's full text is in the DOM once, in the row itself, clamped to two lines by CSS
    // alone with no character cut: opening the row's disclosure unclamps this same node in place
    // rather than repeating the text a second time below
    const promptNodes = canvas.getAllByText(LONG_PROMPT)
    await expect(promptNodes).toHaveLength(1)
    const preview = promptNodes[0]
    await expect(preview).toHaveClass('pd-prompt-clamp')
    await expect(preview.closest('a')).toHaveAttribute(
      'href',
      `https://village.example/transcripts/${TRANSCRIPT_A}?turn=4`,
    )

    // every prompt row leads with the author's avatar, not the generic glyph, and carries a
    // collapsed disclosure chevron
    await expect(canvas.getAllByRole('img', { name: AUTHOR.login })).toHaveLength(5)
    const toggles = canvas.getAllByRole('button', { name: /^details for prompt \d$/ })
    await expect(toggles).toHaveLength(5)
    for (const toggle of toggles) await expect(toggle).toHaveAttribute('aria-expanded', 'false')

    // the slash-prefixed invocation survives exactly as recorded, in the header skills row AND in
    // the chain (so the name is queried as a pair, never as a unique node); it is grouped under
    // the prompt it followed, not rendered as its own chain row
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

    // a session boundary links to its transcript on Village
    const boundary = canvas.getByText('session 2')
    await expect(boundary.closest('a')).toHaveAttribute(
      'href',
      `https://village.example/transcripts/${TRANSCRIPT_B}`,
    )

    // prompt 2's attached commit carries counts: the row shows the at-a-glance sum before the
    // chevron even while the row is still collapsed (not inside the hidden details block). the
    // same +42 −7 text also sits in the collapsed .pd-details per-commit line, which stays in the
    // DOM while hidden, so the sum cell is queried directly rather than by a global text match.
    const promptTwoRow = canvas.getByRole('button', { name: 'details for prompt 2' }).closest('.pd-row-prompt')
    const promptTwoSum = promptTwoRow.querySelector('.pd-prompt-row .pd-change-counts')
    await expect(promptTwoSum).not.toBeNull()
    await expect(within(promptTwoSum).getByText('+42')).toBeInTheDocument()
    await expect(within(promptTwoSum).getByText('−7')).toBeInTheDocument()

    // prompt 3's attached commit carries no counts: no sum cell renders at all
    const promptThreeRow = canvas.getByRole('button', { name: 'details for prompt 3' }).closest('.pd-row-prompt')
    await expect(promptThreeRow.querySelector('.pd-change-counts')).toBeNull()
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

export const WithoutCommits = {
  name: 'without commits',
  args: { digest: noCommitsChain },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // a session need not have produced a commit yet: no commit rows render (open or closed), and
    // the header states its commit field as matched of the PR's total rather than folding the
    // empty state into a dash
    await expect(canvasElement.querySelectorAll('.pd-row-commit')).toHaveLength(0)
    const commitsCount = within(canvasElement.querySelector('.pd-head')).getByText('commits').closest('.pd-count')
    await expect(commitsCount).toHaveTextContent('0 of 3')

    // the session boundary states the same zero, on its own row
    const boundary = canvas.getByText('session 1').closest('.pd-row')
    await expect(boundary).toHaveTextContent('0 commits')
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // one collapsed row: no skills, no commits, no author — the generic glyph and a closed chevron
    await expect(canvas.getByRole('button', { name: 'details for prompt 1' })).toHaveAttribute('aria-expanded', 'false')
    await expect(canvasElement.querySelector('.pd-details')).not.toBeVisible()
  },
}

export const ExpandedWithSkill = {
  name: 'expanded with skill',
  args: {
    digest: single(
      {},
      [
        { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:02:00Z', text: 'Wire the brainstorm skill into the plan before writing any code.', turnIndex: 4, ordinal: 1 },
        { kind: 'skill', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:02:30Z', text: '/toolkit:brainstorm', turnIndex: 5 },
      ],
      [{ name: '/toolkit:brainstorm', invocationCount: 1 }],
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: 'details for prompt 1' })
    const details = canvasElement.querySelector('.pd-details')
    await expect(details).not.toBeVisible()

    await userEvent.click(toggle)

    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'true'))
    await expect(details).toBeVisible()
    const marker = within(details).getByText('/toolkit:brainstorm')
    await expect(marker.closest('a')).toHaveAttribute(
      'href',
      `https://village.example/transcripts/${TRANSCRIPT_A}?turn=5`,
    )
  },
}

export const ExpandedWithCommit = {
  name: 'expanded with commit',
  args: {
    digest: single({ commitsCovered: 1, commitsTotal: 1 }, [
      { kind: 'prompt', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:02:00Z', text: 'Land the fix and keep the commit small.', turnIndex: 4, ordinal: 1 },
      { kind: 'commit', transcriptId: TRANSCRIPT_A, timestamp: '2026-09-06T14:41:00Z', text: '', commitSha: SHA_ONE, additions: 24, deletions: 5, filesChanged: 2 },
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: 'details for prompt 1' })
    const details = canvasElement.querySelector('.pd-details')
    await expect(details).not.toBeVisible()

    await userEvent.click(toggle)

    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'true'))
    await expect(details).toBeVisible()
    const sha = within(details).getByText(SHA_ONE.slice(0, 7))
    await expect(sha.closest('a')).toHaveAttribute(
      'href',
      `https://github.com/peasant-labs/village/commit/${SHA_ONE}`,
    )
  },
}

export const Expanded = {
  name: 'expanded',
  args: { digest: shortChain, author: AUTHOR },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: 'details for prompt 1' })

    await userEvent.click(toggle)

    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'true'))
    const row = toggle.closest('.pd-row-prompt')

    // the prompt's text unclamps in place — same node, no second copy below it
    const preview = within(row).getByText(LONG_PROMPT)
    await expect(preview).not.toHaveClass('pd-prompt-clamp')

    const details = row.querySelector('.pd-details')
    await expect(details).toBeVisible()
    await expect(within(details).getByText('/toolkit:brainstorm')).toBeInTheDocument()

    // opening one row leaves the rest closed
    await expect(canvasElement.querySelectorAll('.pd-row-open')).toHaveLength(1)
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
    const preview = canvas.getAllByText(LONG_PROMPT).find((node) => node.classList.contains('pd-prompt-clamp'))
    await expect(preview.closest('a')).toBeNull()
  },
}

/* the richer walkthrough: two sessions, several distinct skill invocations, and prompts carrying
   more than one commit, opened on load so the grouped disclosure is visible without an extra
   click. see manyCommitsAndSkillsChain above for the exact shape. */
export const ManyCommitsAndSkills = {
  name: 'many commits and skills',
  parameters: {
    docs: {
      description: {
        story:
          "prompt 3 carries the largest at-a-glance sum of the three counted prompts; its third commit carries no counts, so its detail line and the sum both omit it rather than showing a zero.",
      },
    },
  },
  args: { digest: manyCommitsAndSkillsChain, author: AUTHOR },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggleOne = canvas.getByRole('button', { name: 'details for prompt 1' })
    const toggleThree = canvas.getByRole('button', { name: 'details for prompt 3' })

    await userEvent.click(toggleOne)
    await userEvent.click(toggleThree)

    await waitFor(() => expect(toggleOne).toHaveAttribute('aria-expanded', 'true'))
    await waitFor(() => expect(toggleThree).toHaveAttribute('aria-expanded', 'true'))

    // prompt 1's two commits and two skills are visible under its open disclosure
    const rowOne = toggleOne.closest('.pd-row-prompt')
    await expect(within(rowOne).getAllByText(/^[0-9a-f]{7}$/)).toHaveLength(2)
    await expect(within(rowOne).getByText('/toolkit:brainstorm')).toBeInTheDocument()
    await expect(within(rowOne).getByText('context7')).toBeInTheDocument()

    // prompt 3's three commits are visible under its open disclosure
    const rowThree = toggleThree.closest('.pd-row-prompt')
    await expect(within(rowThree).getAllByText(/^[0-9a-f]{7}$/)).toHaveLength(3)

    // prompt 1's two commits each show their own +A −D and file count inside the open details
    const detailsOne = rowOne.querySelector('.pd-details')
    await expect(within(detailsOne).getByText('+18')).toBeInTheDocument()
    await expect(within(detailsOne).getByText('−4')).toBeInTheDocument()
    await expect(within(detailsOne).getByText('2 files')).toBeInTheDocument()
    await expect(within(detailsOne).getByText('+9')).toBeInTheDocument()
    await expect(within(detailsOne).getByText('−1')).toBeInTheDocument()
    await expect(within(detailsOne).getByText('1 file')).toBeInTheDocument()

    // prompt 3's first two commits show counts and file counts; the third carries none, so its
    // detail line stays a bare sha with no +A −D or file-count suffix at all
    const detailsThree = rowThree.querySelector('.pd-details')
    await expect(within(detailsThree).getByText('+120')).toBeInTheDocument()
    await expect(within(detailsThree).getByText('−30')).toBeInTheDocument()
    await expect(within(detailsThree).getByText('6 files')).toBeInTheDocument()
    await expect(within(detailsThree).getByText('+45')).toBeInTheDocument()
    await expect(within(detailsThree).getByText('−10')).toBeInTheDocument()
    await expect(within(detailsThree).getByText('3 files')).toBeInTheDocument()
    const uncountedRow = within(detailsThree).getByText(SHA_M5.slice(0, 7)).closest('.pd-row')
    await expect(uncountedRow.querySelector('.pd-change-counts')).toBeNull()
    await expect(uncountedRow.querySelector('.pd-commit-files')).toBeNull()

    // prompt 3 carries the largest at-a-glance sum (the omitted third commit is left out of it,
    // not treated as a zero), visible on the collapsed row itself. scoped to the sum cell itself,
    // not a global text match, since the open .pd-details holds its own per-commit +A −D text.
    const rowThreeSum = rowThree.querySelector('.pd-prompt-row .pd-change-counts')
    await expect(rowThreeSum).not.toBeNull()
    await expect(within(rowThreeSum).getByText('+165')).toBeInTheDocument()
    await expect(within(rowThreeSum).getByText('−40')).toBeInTheDocument()

    // prompt 2 stays closed and its long text is still clamped to two lines
    const promptTwoPreview = canvas.getByText(MANY_LINE_PROMPT)
    await expect(promptTwoPreview).toHaveClass('pd-prompt-clamp')
  },
}
