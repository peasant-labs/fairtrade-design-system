/* Demo data for the village (commons) pages of the in-use demo. Dummy values that match the
   wireframes' copy: the collectives, handles, repositories and transcripts are invented. Recorded
   text keeps its case. */

export const VIEWER = Object.freeze({ handle: '@alice-dev', login: 'alice-dev', name: 'Alice Developer' })

export const MY_COLLECTIVES = Object.freeze([
  { id: 'platform', name: 'Acme Platform', role: 'owner', members: 12, transcripts: 248, org: 'acme', repos: '2 of 14 repos', joining: 'open' },
  { id: 'company', name: 'Acme Company', role: 'member', members: 87, transcripts: 1904, org: 'acme', repos: null, joining: 'verified only' },
  { id: 'ml', name: 'ML Reading Group', role: 'contributor', members: 21, transcripts: 54, org: null, repos: null, joining: 'curated' },
])

export const HOME_STATS = Object.freeze([
  { value: 38, label: 'transcripts' },
  { value: 3, label: 'collectives' },
  { value: 9, label: 'pull requests' },
  { value: '19.1M', label: 'tokens' },
  { value: '31h', label: 'recorded' },
])

/* your transcripts: who can read each one, and the pull requests it is linked to. */
export const MY_TRANSCRIPTS = Object.freeze([
  { id: '3f9c0a17', title: 'Fix flaky ingest test', harness: 'claude-code', project: 'ingest-api', branch: 'fix/flaky-ingest', sharedWith: ['Acme Platform', 'Acme Company'], pullRequests: ['#42', '#45', '#51', '#60'], when: '12m ago' },
  { id: 'c41a9f20', title: 'Guard empty turns in the digest', harness: 'claude-code', project: 'ingest-api', branch: 'fix/flaky-ingest', sharedWith: ['Acme Platform', 'Acme Company'], pullRequests: ['#42'], when: '2h ago' },
  { id: '5d82a4b0', title: 'Paginate the collectives list', harness: 'codex', project: 'web', branch: 'feat/paginate', sharedWith: ['Acme Platform'], pullRequests: ['#31', '#33'], when: 'yesterday' },
  { id: '91be07c4', title: 'Migrate retry queue to worker', harness: 'opencode', project: 'worker', branch: 'develop', sharedWith: ['Acme Platform'], pullRequests: [], when: '2d ago' },
  { id: '2a6e81d3', title: 'Reproduce the tokenizer benchmark', harness: 'claude-code', project: 'ml-notes', branch: 'main', sharedWith: ['ML Reading Group'], waiting: true, pullRequests: [], when: '3d ago' },
  { id: 'b4d9e310', title: 'Refactoring database queries', harness: 'gemini-cli', project: 'ingest-api', branch: 'develop', sharedWith: ['Acme Platform'], pullRequests: ['#36', '#38', '#40'], when: 'last week' },
])

export const COLLECTIVE = Object.freeze({
  id: 'platform',
  name: 'Acme Platform',
  purpose: 'Transcripts behind the ingest and web services.',
  role: 'owner',
  whoCanRead: 'members of Acme Platform can read every transcript published here.',
  whoCanPublish: 'anyone can join and publish. transcripts are approved automatically.',
  yourRole: 'owner: you manage settings and members.',
  mode: 'open',
  access: 'members_only',
  memberLeaves: 'user_choice',
  stats: [
    { value: 248, label: 'transcripts' },
    { value: 12, label: 'members' },
    { value: '124M', label: 'tokens' },
    { value: 31, label: 'pull requests linked' },
  ],
  org: { login: 'acme', linked: 2, total: 14 },
  transcriptCount: 248,
  memberBreakdown: '1 owner · 7 members · 4 contributors',
  transcripts: [
    { id: '3f9c0a17', title: 'Fix flaky ingest test', harness: 'claude-code', turns: 37, author: '@alice-dev', pullRequests: ['#42', '#45', '#51', '#60'], repo: 'acme/ingest-api', when: '12m ago' },
    { id: 'c41a9f20', title: 'Guard empty turns in the digest', harness: 'claude-code', turns: 22, author: '@alice-dev', pullRequests: ['#42'], repo: 'acme/ingest-api', when: '2h ago' },
    { id: '5d82a4b0', title: 'Paginate the collectives list', harness: 'codex', turns: 51, author: '@alice-dev', pullRequests: ['#31', '#33'], repo: 'acme/web', when: 'yesterday' },
    { id: '91be07c4', title: 'Migrate retry queue to worker', harness: 'opencode', turns: 64, author: '@bob-ai', pullRequests: [], repo: null, when: '2d ago' },
    { id: 'b4d9e310', title: 'Refactoring database queries', harness: 'gemini-cli', turns: 91, author: '@carol-ml', pullRequests: ['#36', '#38', '#40'], repo: 'acme/ingest-api', when: 'last week' },
  ],
  members: [
    { handle: '@alice-dev', name: 'Alice Developer', role: 'owner' },
    { handle: '@bob-ai', name: 'Bob Ainsley', role: 'member' },
    { handle: '@carol-ml', name: 'Carol Mendes', role: 'member' },
    { handle: '@dan-ops', name: 'Dan Okafor', role: 'contributor' },
    { handle: '@erin-web', name: 'Erin Walsh', role: 'member' },
    { handle: '@farid-k', name: 'Farid Karimi', role: 'contributor' },
  ],
  memberCount: 12,
})

/* the collective settings choices. data access offers no `public`: this overhaul is collectives
   only, and the public commons is hidden from the ui. */
export const WHO_CAN_PUBLISH = Object.freeze([
  { value: 'open', label: 'open', help: 'anyone can join and publish. transcripts are approved automatically.' },
  { value: 'verified_only', label: 'verified only', help: 'only members of the acme github org can join and publish.' },
  { value: 'curated', label: 'curated', help: 'you approve each transcript before it appears.' },
])
export const WHO_CAN_READ = Object.freeze([
  { value: 'members_only', label: 'members only' },
  { value: 'contributors', label: 'members and contributors' },
])

/* the repositories the acme org and the viewer own, for the repo picker. */
export const REPO_OWNERS = Object.freeze([
  {
    id: 'acme',
    login: 'acme',
    kind: 'org',
    repos: [
      { id: 'acme/ingest-api', name: 'acme/ingest-api', private: true },
      { id: 'acme/web', name: 'acme/web' },
      { id: 'acme/worker', name: 'acme/worker', note: '3 members publish from it' },
      { id: 'acme/cli', name: 'acme/cli', note: '1 member publishes from it' },
      { id: 'acme/infra', name: 'acme/infra', private: true },
      { id: 'acme/docs', name: 'acme/docs' },
      { id: 'acme/billing', name: 'acme/billing', private: true },
      { id: 'acme/auth', name: 'acme/auth' },
      { id: 'acme/mobile', name: 'acme/mobile' },
      { id: 'acme/design-tokens', name: 'acme/design-tokens' },
      { id: 'acme/status-page', name: 'acme/status-page' },
      { id: 'acme/sdk-js', name: 'acme/sdk-js' },
      { id: 'acme/sdk-go', name: 'acme/sdk-go' },
      { id: 'acme/terraform', name: 'acme/terraform', private: true },
    ],
  },
])
export const LINKED_REPOS = Object.freeze(['acme/ingest-api', 'acme/web'])

/* the village transcript page: the pull requests it is attached to. */
export const TRANSCRIPT_PULL_REQUESTS = Object.freeze([
  { id: 'pr42', repo: 'acme/ingest-api', number: 42, state: 'attached', traced: '2 of 4 commits traced' },
  { id: 'pr45', repo: 'acme/ingest-api', number: 45, state: 'attached', traced: '1 of 2 commits traced' },
  { id: 'pr31', repo: 'acme/web', number: 31, state: 'detached', traced: null },
  { id: 'pr51', repo: 'acme/ingest-api', number: 51, state: 'attached', traced: '1 of 1 commits traced' },
  { id: 'pr60', repo: 'acme/ingest-api', number: 60, state: 'attached', traced: '3 of 5 commits traced' },
])
