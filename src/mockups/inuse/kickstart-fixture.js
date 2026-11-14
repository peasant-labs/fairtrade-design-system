/* Demo data for the local app's setup wizard (the in-use graph demo, `?app=graph&view=kickstart`).
   Dummy values only. The stop titles are peasant's ten kickstart stops, so the step rail is shown
   at the length it really has. The forest is already grouped, the way the server sends it: each
   row carries its kind, its tri-state, its lock and its count, and the tree draws them as given.
   Recorded text (repository names, branch names, session titles) keeps its case. */

export const KICKSTART_STOPS = Object.freeze([
  { id: 'connection', label: 'peasant online', shortLabel: 'online' },
  { id: 'selection', label: 'choose sessions to import', shortLabel: 'sessions' },
  { id: 'auto-ingest', label: 'auto-ingest new branches', shortLabel: 'auto ingest' },
  { id: 'publication', label: 'publication', shortLabel: 'publish' },
  { id: 'privacy', label: 'privacy', shortLabel: 'privacy' },
  { id: 'license', label: 'content license', shortLabel: 'license' },
  { id: 'sharing', label: 'sharing', shortLabel: 'sharing' },
  { id: 'retention', label: 'claude retention', shortLabel: 'retention' },
  { id: 'review', label: 'review', shortLabel: 'review' },
  { id: 'ingest', label: 'ingest', shortLabel: 'ingest' },
])

/** The stop the demo opens on: the selection stop. */
export const KICKSTART_SELECTION_STOP = 'selection'

/* The server-grouped forest. A project with branches counts its branches; a project with no
   branch information counts its sessions; a branch counts its sessions; a session counts the
   sessions it started, which are not rows here. */
export const KICKSTART_FOREST = Object.freeze([
  { id: 'project-peasant', parentId: '', kind: 'project', state: 'some', label: 'peasant-labs/peasant', childCount: 3 },
  { id: 'branch-develop', parentId: 'project-peasant', kind: 'branch', state: 'some', label: 'develop', childCount: 4 },
  { id: 'session-scan', parentId: 'branch-develop', kind: 'session', state: 'all', label: 'Wire the scan progress bar', harness: 'claude-code' },
  { id: 'session-retention', parentId: 'branch-develop', kind: 'session', state: 'none', label: 'Fix the retention copy', harness: 'opencode' },
  { id: 'session-rebase', parentId: 'branch-develop', kind: 'session', state: 'none', label: 'Rebase the selection page', harness: 'claude-code', childCount: 2, locked: true },
  { id: 'session-config', parentId: 'branch-develop', kind: 'session', state: 'none', label: 'Explain why ~/.config/peasant/kickstart.toml is ignored when the daemon starts before the first scan', harness: 'cursor' },
  { id: 'branch-kickstart', parentId: 'project-peasant', kind: 'branch', state: 'none', label: 'feat/kickstart', childCount: 1 },
  { id: 'session-stops', parentId: 'branch-kickstart', kind: 'session', state: 'none', label: 'Draft the ten wizard stops', harness: 'claude-code' },
  { id: 'branch-retention', parentId: 'project-peasant', kind: 'branch', state: 'all', label: 'fix/retention-copy', childCount: 2 },
  { id: 'session-copy', parentId: 'branch-retention', kind: 'session', state: 'all', label: 'Reword the claude retention stop', harness: 'codex' },
  { id: 'session-copy-tests', parentId: 'branch-retention', kind: 'session', state: 'all', label: 'Pin the retention copy in fixtures', harness: 'codex' },
  { id: 'project-notes', parentId: '', kind: 'project', state: 'none', label: 'notes', childCount: 3 },
  { id: 'session-reading', parentId: 'project-notes', kind: 'session', state: 'none', label: 'Summarise the reading list', harness: 'gemini-cli' },
  { id: 'session-outline', parentId: 'project-notes', kind: 'session', state: 'none', label: 'Outline the talk', harness: 'claude-code' },
  { id: 'session-glossary', parentId: 'project-notes', kind: 'session', state: 'none', label: 'Build a glossary', harness: 'opencode' },
])

/* Project and branch summaries stay typed lines. All session details below are invented examples,
   not reads from a developer's machine. */
const SUMMARY = (lines) => Object.freeze(lines.map(([label, text]) => Object.freeze({ kind: 'summary', label, text })))

export const KICKSTART_PREVIEWS = Object.freeze({
  'project-peasant': SUMMARY([['repository', 'peasant-labs/peasant'], ['branches', '3'], ['sessions', '7'], ['last session', '2 hours ago']]),
  'branch-develop': SUMMARY([['branch', 'develop'], ['sessions', '4'], ['last session', '2 hours ago']]),
  'branch-kickstart': SUMMARY([['branch', 'feat/kickstart'], ['sessions', '1'], ['last session', 'yesterday']]),
  'branch-retention': SUMMARY([['branch', 'fix/retention-copy'], ['sessions', '2'], ['last session', '3 days ago']]),
  'project-notes': SUMMARY([['folder', '~/notes'], ['sessions', '3'], ['last session', 'last week']]),
})

/** A complete synthetic wire detail, consumed by the same adapter as an actual session. */
function detail(id, harness, user, assistant) {
  return {
    id, harness,
    startTime: '2026-11-12T09:00:00Z', endTime: '2026-11-12T09:04:00Z',
    durationMins: 4, totalTokens: 120, tokensIn: 60, tokensOut: 60, turnCount: 2, toolCallCount: 0,
    turns: [
      { index: 0, role: 'user', entryType: 'text', content: user, timestamp: '2026-11-12T09:00:00Z', depth: 0 },
      { index: 1, role: 'assistant', entryType: 'text', content: assistant, timestamp: '2026-11-12T09:01:00Z', depth: 0 },
    ],
  }
}

export const KICKSTART_SESSION_DETAILS = Object.freeze({
  'session-scan': detail('session-scan', 'claude-code', 'The scan runs for a minute with no feedback. Show its progress on the selection stop.', 'I will draw a progress bar with the done and total counts.'),
  'session-retention': detail('session-retention', 'opencode', 'The retention stop says "forever" but the local setting has a 30 day default. Fix the copy.', 'I will name the setting and its default.\n\n```ts\nexport const retentionDays = 30\nexport function retentionLabel(days: number) {\n  return `kept for ${days} days`\n}\n```\n\n![example image](https://preview.invalid/SECRET-synthetic-preview-only)'),
  'session-rebase': detail('session-rebase', 'claude-code', 'Rebase the selection page onto the new tree component.', 'Two helper sessions will run checks while I move the page.'),
  'session-config': detail('session-config', 'cursor', 'Why is the setup file ignored when the daemon starts before the first scan?', 'The daemon reads the file once at start. I will check the scan state.'),
  'session-stops': detail('session-stops', 'claude-code', 'Draft the ten wizard stops from the terminal flow.', 'Here are the stops in order, each with its question and its default.'),
  'session-copy': detail('session-copy', 'codex', 'Reword the retention stop so it names the 30 day default.', 'I will update the help text and leave the field label alone.'),
  'session-copy-tests': detail('session-copy-tests', 'codex', 'Pin the retention copy in the wizard fixtures.', 'I will add a fixture for the displayed default.'),
  'session-reading': detail('session-reading', 'gemini-cli', 'Summarise the reading list in five lines.', 'I will group the papers by topic.'),
  'session-outline': detail('session-outline', 'claude-code', 'Outline a twenty minute talk on transcript sharing.', 'I will begin with the reader and the consent boundary.'),
  'session-glossary': detail('session-glossary', 'opencode', 'Build a glossary of the terms in these notes.', 'I will keep the definitions short and link related terms.'),
})
