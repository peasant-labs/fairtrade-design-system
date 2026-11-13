/* Demo data for the local app's setup wizard (the in-use graph demo, `?app=graph&view=kickstart`).
   Dummy values only. The stop titles are peasant's ten kickstart stops, so the step rail is shown
   at the length it really has. The forest is already grouped, the way the server sends it: each
   row carries its kind, its tri-state, its lock and its count, and the tree draws them as given.
   Recorded text (repository names, branch names, session titles) keeps its case. */

export const KICKSTART_STOPS = Object.freeze([
  { id: 'connection', label: 'peasant online' },
  { id: 'selection', label: 'choose sessions to import' },
  { id: 'auto-ingest', label: 'auto-ingest new branches' },
  { id: 'publication', label: 'publication' },
  { id: 'privacy', label: 'privacy' },
  { id: 'license', label: 'content license' },
  { id: 'sharing', label: 'sharing' },
  { id: 'retention', label: 'claude retention' },
  { id: 'review', label: 'review' },
  { id: 'ingest', label: 'ingest' },
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

/* What the server reads for a preview: typed lines. A project or branch row reads its repository
   summary; a session row reads the start of the session. `kind` is the line's role. */
const SUMMARY = (lines) => Object.freeze(lines.map(([label, text]) => Object.freeze({ kind: 'summary', label, text })))
const TURNS = (lines) => Object.freeze(lines.map(([label, text]) => Object.freeze({ kind: 'turn', label, text })))

export const KICKSTART_PREVIEWS = Object.freeze({
  'project-peasant': SUMMARY([['repository', 'peasant-labs/peasant'], ['branches', '3'], ['sessions', '7'], ['last session', '2 hours ago']]),
  'branch-develop': SUMMARY([['branch', 'develop'], ['sessions', '4'], ['last session', '2 hours ago']]),
  'branch-kickstart': SUMMARY([['branch', 'feat/kickstart'], ['sessions', '1'], ['last session', 'yesterday']]),
  'branch-retention': SUMMARY([['branch', 'fix/retention-copy'], ['sessions', '2'], ['last session', '3 days ago']]),
  'project-notes': SUMMARY([['folder', '~/notes'], ['sessions', '3'], ['last session', 'last week']]),
  'session-scan': TURNS([['user', 'The scan runs for a minute with no feedback. Show its progress on the selection stop.'], ['assistant', 'I will read the scan job state from the session and draw a progress bar with the done and total counts.']]),
  'session-retention': TURNS([['user', 'The retention stop says "forever" but claude deletes local transcripts after 30 days. Fix the copy.'], ['assistant', 'The stop should name the setting and its default. I will change the help text and keep the field label.']]),
  'session-rebase': TURNS([['user', 'Rebase the selection page onto the new tree component.'], ['assistant', 'Two helper sessions will run the type check and the journey while I move the page.']]),
  'session-config': TURNS([['user', 'Why is ~/.config/peasant/kickstart.toml ignored when the daemon starts before the first scan?'], ['assistant', 'The daemon reads the file once at start. A scan that has not run yet has nothing to apply it to.']]),
  'session-stops': TURNS([['user', 'Draft the ten wizard stops from the terminal flow.'], ['assistant', 'Here are the stops in order, each with its question and its default.']]),
  'session-copy': TURNS([['user', 'Reword the claude retention stop so it names the 30 day default.']]),
  'session-copy-tests': TURNS([['user', 'Pin the retention copy in the wizard fixtures.']]),
  'session-reading': TURNS([['user', 'Summarise the reading list in five lines.']]),
  'session-outline': TURNS([['user', 'Outline a twenty minute talk on transcript sharing.']]),
  'session-glossary': TURNS([['user', 'Build a glossary of the terms in these notes.']]),
})
