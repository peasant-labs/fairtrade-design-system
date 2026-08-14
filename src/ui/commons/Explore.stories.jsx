import Explore from './Explore.jsx'

/* The commons Explore surface: search + faceted rail + transcript results with a
   numbered pager. These stories exercise the browse view. The Paged story sets a
   payload whose total exceeds the page size so the pagination control renders —
   the pager reflects the user's requested page (navigation intent); the response
   payload's page is descriptive metadata that only seeds the initial page. */

const owners = {
  alice: { githubUsername: 'alice-dev', displayName: 'Alice Developer', avatarUrl: null },
  charlie: { githubUsername: 'charlie-ml', displayName: 'Charlie ML', avatarUrl: null },
  bob: { githubUsername: 'bob-ai', displayName: 'Bob AI', avatarUrl: null },
}

const transcript = (id, title, provider, modelName, owner, projectName, tags) => ({
  id,
  title,
  visibility: 'public',
  modelProvider: provider,
  modelName,
  harnessVersion: '2026.06',
  sessionStart: '2026-06-15T00:00:00Z',
  sessionEnd: '2026-06-15T01:20:00Z',
  turnCount: 96,
  tokenCount: 214800,
  toolCallCount: 24,
  durationMs: 4200000,
  gitBranch: 'main',
  projectName,
  tags: tags.map((name) => ({ id: name, name })),
  owner,
})

const pagedRows = [
  transcript('d41a8e', 'building a rest api from scratch', 'claude-code', 'Claude Opus 4.5', owners.alice, 'go-rest-api', ['greenfield', 'claude-code']),
  transcript('7c2b90', 'debugging auth middleware with claude code', 'claude-code', 'Claude Sonnet 4.5', owners.alice, 'village', ['debugging', 'claude-code']),
  transcript('b9f33c', 'refactoring database queries with gemini', 'gemini-cli', 'Gemini 2.5 Pro', owners.charlie, 'api-server', ['refactoring', 'gemini-cli']),
  transcript('e2107a', 'greenfield react app setup', 'opencode', 'OpenCode', owners.bob, 'frontend-app', ['greenfield', 'iterative-refinement']),
]

const pagedPayload = {
  transcripts: { transcripts: pagedRows, total: 24, page: 1, limit: 4 },
  collectives: [
    { id: 'ai-research-team', name: 'AI Research Team', description: 'Sharing transcripts related to AI research', linkedGithubOrg: 'anthropic-labs', memberCount: 12, transcriptCount: 48 },
  ],
  popularTags: [
    { id: 'claude-code', name: 'claude-code', usageCount: 41 },
    { id: 'debugging', name: 'debugging', usageCount: 33 },
    { id: 'gemini-cli', name: 'gemini-cli', usageCount: 28 },
    { id: 'refactoring', name: 'refactoring', usageCount: 24 },
  ],
}

const Surface = (Story) => (
  <div style={{ width: 1024, maxWidth: '100%' }}>
    <Story />
  </div>
)

const meta = {
  title: 'commons/Explore',
  component: Explore,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [Surface],
}
export default meta

/* Built-in fallback dataset (single page, no pager). */
export const Browse = {}

/* A multi-page dataset: the numbered pager renders and reflects the requested
   page. Later stale response metadata cannot rewrite a newer requested page. */
export const Paged = {
  args: { data: pagedPayload },
}
