import { useState } from 'react'
import { DiffView, ToolCallRenderer as ToolCall, CommitGraph } from '../ui'

/* 74-codediff: doc band for the code-reading composites — DiffView (unified + redaction),
   ToolCall (the per-kind tool renderers) and CommitGraph (multi-lane history). each specimen
   copies its component's primary story data verbatim so it renders the working example; the
   chrome is all-lowercase but the code, commands, diffs and commit messages keep their case.
   each specimen-body scrolls horizontally so wide code can't overflow the page at 360px. */

// ── DiffView · Default: the story's 2-hunk Go diff ──────────────────────────
// hunk 1 — add a null-guard before dereferencing the looked-up session.
// hunk 2 — replace a buffered ReadAll loader with a streaming read.
const GO_HUNKS = [
  {
    header: '-18,7 +18,10 @@ func (h *Handler) Session(w http.ResponseWriter, r *http.Request) {',
    lines: [
      { type: 'ctx', oldNo: 18, newNo: 18, text: '\tid := chi.URLParam(r, "id")' },
      { type: 'ctx', oldNo: 19, newNo: 19, text: '\tsess := h.store.Lookup(id)' },
      { type: 'del', oldNo: 20, text: '\treturn sess.Render(w)' },
      { type: 'add', newNo: 20, text: '\tif sess == nil {' },
      { type: 'add', newNo: 21, text: '\t\thttp.Error(w, "not found", http.StatusNotFound)' },
      { type: 'add', newNo: 22, text: '\t\treturn nil' },
      { type: 'add', newNo: 23, text: '\t}' },
      { type: 'add', newNo: 24, text: '\treturn sess.Render(w)' },
      { type: 'ctx', oldNo: 21, newNo: 25, text: '}' },
    ],
  },
  {
    header: '-41,8 +44,9 @@ func loadTranscript(path string) (*Transcript, error) {',
    lines: [
      { type: 'ctx', oldNo: 41, newNo: 44, text: '\tf, err := os.Open(path)' },
      { type: 'ctx', oldNo: 42, newNo: 45, text: '\tif err != nil {' },
      { type: 'ctx', oldNo: 43, newNo: 46, text: '\t\treturn nil, err' },
      { type: 'ctx', oldNo: 44, newNo: 47, text: '\t}' },
      { type: 'del', oldNo: 45, text: '\tbuf, err := io.ReadAll(f)' },
      { type: 'del', oldNo: 46, text: '\treturn parse(buf)' },
      { type: 'add', newNo: 48, text: '\tdefer f.Close()' },
      { type: 'add', newNo: 49, text: '\treturn parseStream(bufio.NewReader(f))' },
      { type: 'ctx', oldNo: 47, newNo: 50, text: '}' },
    ],
  },
]

// ── DiffView · Redaction: the story's 3 matches → placeholders ───────────────
const REDACTION_MATCHES = [
  {
    id: 'r1',
    category: 'api-key',
    confidence: 0.98,
    oldNo: 12,
    newNo: 12,
    original: 'const STRIPE_KEY = "sk_live_4eC39HqLyjWDarjtT1zdp7dc"',
    replacement: 'const STRIPE_KEY = "sk_live_••••••••••••••••••••dc"',
  },
  {
    id: 'r2',
    category: 'email',
    confidence: 0.91,
    oldNo: 27,
    newNo: 27,
    original: '// reported by vitor.hw@outlook.com on the 0.4 rollout',
    replacement: '// reported by ‹redacted-email› on the 0.4 rollout',
  },
  {
    id: 'r3',
    category: 'bearer-token',
    confidence: 0.64,
    oldNo: 53,
    newNo: 53,
    original: '\tAuthorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc"',
    replacement: '\tAuthorization: "Bearer ‹redacted-token›"',
  },
]

// ── ToolCall: four realistic tool calls (read, edit, bash, task) ─────────────
const READ_CALL = {
  kind: 'read',
  name: 'Read',
  duration: 40,
  status: 'ok',
  args: {
    file: 'packages/ingest/stream.go:1-6',
    excerpt: ['package ingest', '', 'import (', '\t"bufio"', '\t"context"', ')'].join('\n'),
  },
}

const EDIT_CALL = {
  kind: 'edit',
  name: 'Edit',
  duration: 120,
  status: 'ok',
  args: {
    file: 'packages/ingest/stream.go',
    old: 'buf, err := io.ReadAll(f)\nreturn parse(buf)',
    new: 'defer f.Close()\nreturn parseStream(bufio.NewReader(f))',
  },
}

const BASH_CALL = {
  kind: 'bash',
  name: 'Bash',
  duration: 8400,
  status: 'ok',
  args: {
    command: 'go test -race ./...',
    output: 'ok  \tgithub.com/peasant/ingest\t8.213s\nok  \tgithub.com/peasant/store\t1.044s',
    exitCode: 0,
  },
}

const TASK_CALL = {
  kind: 'task',
  name: 'Task',
  duration: 21000,
  status: 'ok',
  args: {
    subagent: 'doc-writer',
    taskStatus: 'done',
    description: 'document the ingest stream package',
    prompt:
      'Read packages/ingest/stream.go and write a package doc comment describing the streaming reader contract and back-pressure behaviour.',
  },
}

const TOOL_CALLS = [READ_CALL, EDIT_CALL, BASH_CALL, TASK_CALL]

// ── CommitGraph · Default: the story's multi-lane history (newest first) ─────
// a feature branch (lane 1) forks off the main line (lane 0) at c8 and folds back at the
// merge commit c2. messages + branch names are user content — their case is preserved.
const HISTORY = [
  { id: 'c1', lane: 0, parents: ['c2'], message: 'Bump pipeline schema to v3', branch: 'main', time: '4m ago' },
  { id: 'c2', lane: 0, parents: ['c3', 'c4'], message: 'Merge branch feat/ingest-loader', branch: 'main', merged: true, session: true, time: '22m ago' },
  { id: 'c4', lane: 1, parents: ['c5'], message: 'fix null-guard in typecheck', branch: 'feat/ingest-loader', tip: true, session: true, time: '38m ago' },
  { id: 'c5', lane: 1, parents: ['c6'], message: 'add sqlite pending store', branch: 'feat/ingest-loader', session: true, time: '1h ago' },
  { id: 'c6', lane: 1, parents: ['c8'], message: 'stream the ingest loader', branch: 'feat/ingest-loader', time: '2h ago' },
  { id: 'c3', lane: 0, parents: ['c8'], message: 'Tidy config defaults on main', branch: 'main', time: '3h ago' },
  { id: 'c8', lane: 0, parents: ['c9'], message: 'Extract the ingest interface', branch: 'main', session: true, time: '5h ago' },
  { id: 'c9', lane: 0, parents: ['c10'], message: 'Wire the worker queue', branch: 'main', time: 'yesterday' },
  { id: 'c10', lane: 0, parents: [], message: 'Initial commit', branch: 'main', time: '2d ago' },
]

/* selecting a row lights the scarce amber active treatment — same stateful wrapper the
   CommitGraph story uses, so the specimen behaves like the working example. */
function CommitGraphDemo() {
  const [selectedId, setSelectedId] = useState('c4')
  return (
    <CommitGraph
      commits={HISTORY}
      selectedId={selectedId}
      onSelect={(c) => setSelectedId(c.id)}
      hasMore
      onShowOlder={() => {}}
    />
  )
}

/* every specimen-body wraps wide code so it scrolls instead of overflowing the page at 360px. */
const scrollBody = { overflow: 'auto', maxWidth: '100%' }
const subHead = { marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }

export function CodeDiffSection() {
  return (
    <section className="band" id="ds-codediff">
      <h2 className="label">code &amp; diffs</h2>
      <div className="sub">the surfaces where the work itself shows up</div>
      <p className="prose">a recorded session ends in code: lines changed, tools run, commits made. these three composites carry that payload at reading size and never lowercase it. a diff frames a change as before&rarr;after with a churn tally; the same chassis runs the redaction pass, swapping a secret for a placeholder while you keep or revert each match. tool calls collapse to a status line and open to their body. a commit graph threads the lanes so a branch reads at a glance. code, commands, hashes and commit messages stay verbatim. only the chrome is lowercase.</p>

      <h3 className="label" style={subHead}>diffview: unified diff</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={scrollBody}>
          <DiffView file="internal/server/handler.go" variant="default" hunks={GO_HUNKS} />
        </div>
      </div>

      <h3 className="label" style={subHead}>diffview: redaction pass</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={scrollBody}>
          <DiffView file="config/secrets.go" variant="redaction" matches={REDACTION_MATCHES} />
        </div>
      </div>

      <h3 className="label" style={subHead}>toolcall: read, edit, bash, task</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={scrollBody}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {TOOL_CALLS.map((tool) => (
              <ToolCall key={tool.kind} tool={tool} defaultOpen />
            ))}
          </div>
        </div>
      </div>

      <h3 className="label" style={subHead}>commitgraph: multi-lane history</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={scrollBody}>
          <CommitGraphDemo />
        </div>
      </div>
    </section>
  )
}
