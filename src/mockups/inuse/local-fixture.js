/* Demo data for the local app's home and settings sections (the in-use graph demo). Dummy values
   only: the session titles, projects and collectives are invented for the demo and match the
   wireframes' copy. Recorded text (titles, branch names, collective names) keeps its case. */

export const HOME_SUMMARY = Object.freeze({
  published: 38,
  total: 1284,
  stats: [
    { value: 1284, label: 'sessions' },
    { value: 7, label: 'projects' },
    { value: 38, label: 'published' },
    { value: 23, label: 'this week' },
    { label: 'longest streak', value: '3 wk', order: 'label-first' },
    { label: 'median session', value: '34m', order: 'label-first' },
  ],
  weekly: [13, 19, 10, 23, 18, 28, 20, 25],
})

/* publish state vocabulary shown in the list; the publish state label component renders these
   once it lands, until then the list shows the same words as text. */
export const HOME_SESSIONS = Object.freeze([
  { id: '6a46bcd8', title: 'Fix flaky ingest test', harness: 'claude-code', tokens: '1.2M', project: 'ingest-api', branch: 'fix/flaky-ingest', turns: 37, duration: '42m', when: '12m ago', state: 'not-published' },
  { id: '0c3f9e21', title: 'Guard empty turns in the digest', harness: 'claude-code', tokens: '402k', project: 'ingest-api', branch: 'fix/flaky-ingest', turns: 22, duration: '18m', when: '2h ago', state: 'published', collectives: 2 },
  { id: '5d82a4b0', title: 'Paginate the collectives list', harness: 'codex', tokens: '890k', project: 'web', branch: 'feat/paginate', turns: 51, duration: '1h 06m', when: 'yesterday', state: 'new-turns', collectives: 1 },
  { id: '91be07c4', title: 'Migrate retry queue to worker', harness: 'opencode', tokens: '1.4M', project: 'worker', branch: 'develop', turns: 64, duration: '1h 31m', when: '2d ago', state: 'auto-publish', collective: 'Acme Platform' },
  { id: '3e1f6d92', title: 'Tidy zsh prompt', harness: 'claude-code', tokens: '88k', project: 'dotfiles', branch: 'main', turns: 9, duration: '6m', when: '3d ago', state: 'not-published' },
  { id: '7f20c8e5', title: '“why does the ingest test time out on CI”', untitled: true, harness: 'cursor', tokens: '190k', project: 'ingest-api', branch: 'develop', turns: 14, duration: '11m', when: '4d ago', state: 'not-published' },
  { id: 'b4d9e310', title: 'Refactoring database queries', harness: 'gemini-cli', tokens: '2.2M', project: 'ingest-api', branch: 'develop', turns: 91, duration: '2h 12m', when: 'last week', state: 'published', collectives: 1 },
])

export const HOME_FILTERS = Object.freeze([
  { id: 'all', label: 'all', count: 1284 },
  { id: 'not-published', label: 'not published', count: 1246 },
  { id: 'published', label: 'published', count: 38 },
  { id: 'auto', label: 'auto', count: 12 },
])

export const HOME_PROJECTS = Object.freeze(['ingest-api', 'web', 'worker', 'dotfiles', 'ml-notes', 'cli', 'infra'])

/* the local settings page, as groups of rows. `configKey` names the key in config.yaml;
   `notInConfig` marks a setting the terminal `peasant config` screen does not show. */
export const SETTINGS_SUMMARY = Object.freeze([
  { label: 'connected as', value: '@alice-dev', order: 'label-first' },
  { label: 'auto-publish on for', value: '2 folders', order: 'label-first' },
  { label: 'redaction', value: 'standard', order: 'label-first' },
])

export const SETTINGS_GROUPS = Object.freeze([
  {
    id: 'village',
    label: 'village',
    open: true,
    rows: [
      { id: 'village-account', kind: 'readonly', label: 'connected as', value: '@alice-dev', help: 'signed in with github on village.peasantlabs.org', notInConfig: true, action: 'disconnect' },
      { id: 'village-plan', kind: 'select', label: 'publishing plan', help: 'picked at setup. it never publishes on its own.', value: 'keep-local', options: [{ value: 'keep-local', label: 'keep local' }, { value: 'publish-later', label: 'publish later' }] },
    ],
  },
  {
    id: 'auto-publish',
    label: 'auto-publish',
    open: true,
    description: 'these folders publish redacted on git push. you agree once.',
    rows: [
      { id: 'auto-acme-work', kind: 'switch', label: '~/work/acme/**', help: 'publishes to Acme Platform on git push. active.', value: true, notInConfig: true },
      { id: 'auto-acme-repos', kind: 'switch', label: 'github.com:acme/*', help: 'publishes to Acme Company. blocked: acme/worker already has its own pre-push hook, and peasant never overwrites one.', value: true, notInConfig: true },
      { id: 'auto-personal', kind: 'switch', label: '~/personal/**', help: 'never publishes.', value: false, notInConfig: true },
    ],
  },
  {
    id: 'redaction',
    label: 'redaction',
    open: true,
    rows: [
      { id: 'redaction-level', kind: 'select', label: 'level', help: 'hides CREDENTIAL, PII, PATH and INTERNAL. applies to every publish, by hand or automatic.', value: 'standard', options: [{ value: 'standard', label: 'standard' }] },
    ],
  },
  {
    id: 'projects',
    label: 'projects',
    open: true,
    rows: [
      { id: 'projects-scope', kind: 'select', label: 'record sessions from', help: '7 projects, 2 branches, 1 session left out. this only filters lists and search; recorded sessions stay until you run peasant prune.', value: 'selected', options: [{ value: 'all', label: 'all projects' }, { value: 'selected', label: 'selected projects' }] },
      { id: 'projects-branches', kind: 'switch', label: 'include new branches automatically', help: 'only in projects you selected in full.', value: true },
      { id: 'projects-track', kind: 'switch', label: 'track new projects automatically', value: false, notInConfig: true },
    ],
  },
  {
    id: 'sources',
    label: 'sources',
    open: false,
    rows: [
      { id: 'sources-claude-code', kind: 'switch', harness: 'claude-code', label: 'claude code', help: '~/.claude/projects', configKey: 'sources.claude-code', value: true, notInConfig: true },
      { id: 'sources-opencode', kind: 'switch', harness: 'opencode', label: 'opencode', help: '~/.local/share/opencode', configKey: 'sources.opencode', value: true, notInConfig: true },
      { id: 'sources-codex', kind: 'switch', harness: 'codex', label: 'codex', help: '~/.codex/sessions', configKey: 'sources.codex', value: true, notInConfig: true },
      { id: 'sources-cursor', kind: 'switch', harness: 'cursor', label: 'cursor', help: '~/.cursor/projects', configKey: 'sources.cursor', value: true, notInConfig: true },
      { id: 'sources-strike', kind: 'switch', harness: 'strike', label: 'strike', help: '~/.strike/sessions', configKey: 'sources.strike', value: true, notInConfig: true },
      { id: 'sources-pi', kind: 'switch', harness: 'pi', label: 'pi', help: '~/.pi/agent/sessions', configKey: 'sources.pi', value: true, notInConfig: true },
    ],
  },
  {
    id: 'advanced',
    label: 'advanced',
    open: false,
    rows: [
      { id: 'advanced-email', kind: 'text', label: 'your email', value: 'alice@acme.dev', configKey: 'user.email', notInConfig: true },
      { id: 'advanced-village-url', kind: 'text', label: 'village address', value: 'api.village.peasantlabs.org', configKey: 'village.url', notInConfig: true },
      { id: 'advanced-theme', kind: 'select', label: 'terminal theme', value: 'dark', configKey: 'display.theme', notInConfig: true, options: [{ value: 'dark', label: 'dark' }, { value: 'light', label: 'light' }] },
    ],
  },
])

export const SETTINGS_FILES = Object.freeze([
  { label: 'settings', path: '~/.config/peasant/config.yaml' },
  { label: 'claude code retention', path: '~/.claude/settings.json' },
])
