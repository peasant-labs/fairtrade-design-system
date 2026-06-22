import { expect, within, userEvent, waitFor } from 'storybook/test'
import ToolCall from './ToolRenderers.jsx'
import { frame } from './story-frame.jsx'

/* ToolRenderers story. CSF3, title 'in use/ToolRenderers'. one <ToolCall> dispatches on
   tool.kind to eight body renderers; the args below are realistic peasant transcript
   calls (a Go ingest stream, `go test -race`, a `func New` grep, a doc-writer subagent…).

   - AllTools: one of every kind, collapsed — the row chrome (icon + name + arg preview +
     duration + ok/error word) reads at a glance.
   - Expanded: each kind opened, showing its body (read excerpt, edit diff, write preview,
     bash stdout+exit, grep matches, task spawn, webfetch snippet, default JSON args).
   - BashError: a failing `go test` — exit 1, status "error", the failure in clay + the word.

   the theme toolbar flips data-theme; classes + tokens come from src/index.css, the trx-*
   rules from ToolRenderers.css. */

// ── the eight realistic tool calls ──────────────────────────────────────────
const readCall = {
  kind: 'read',
  name: 'Read',
  duration: 40,
  status: 'ok',
  args: {
    file: 'packages/ingest/stream.go:1-6',
    excerpt: [
      'package ingest',
      '',
      'import (',
      '\t"bufio"',
      '\t"context"',
      ')',
    ].join('\n'),
  },
}

const editCall = {
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

const writeCall = {
  kind: 'write',
  name: 'Write',
  duration: 18,
  status: 'ok',
  args: {
    file: 'packages/ingest/stream_test.go',
    content: [
      'package ingest',
      '',
      'import "testing"',
      '',
      'func TestParseStream(t *testing.T) {',
      '\tif _, err := parseStream(nil); err == nil {',
      '\t\tt.Fatal("want error on nil reader")',
      '\t}',
      '}',
    ].join('\n'),
  },
}

const bashCall = {
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

const grepCall = {
  kind: 'grep',
  name: 'Grep',
  duration: 60,
  status: 'ok',
  args: {
    pattern: 'func New',
    path: 'packages/',
    matches: [
      { file: 'packages/ingest/stream.go', line: 22, text: 'func NewReader(r io.Reader) *Reader {' },
      { file: 'packages/store/store.go', line: 9, text: 'func NewStore(path string) (*Store, error) {' },
      { file: 'packages/api/server.go', line: 41, text: 'func NewServer(s *store.Store) *Server {' },
    ],
  },
}

const taskCall = {
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

const webfetchCall = {
  kind: 'webfetch',
  name: 'WebFetch',
  duration: 640,
  status: 'ok',
  args: {
    url: 'https://pkg.go.dev/bufio',
    title: 'bufio package - bufio - Go Packages',
    snippet:
      'Package bufio implements buffered I/O. It wraps an io.Reader or io.Writer object, creating another object (Reader or Writer) that also implements the interface but provides buffering and some help for textual I/O.',
  },
}

const defaultCall = {
  kind: 'todowrite',
  name: 'TodoWrite',
  duration: 5,
  status: 'ok',
  args: {
    todos: [
      { content: 'port the streaming reader', status: 'completed' },
      { content: 'add the race test', status: 'in_progress' },
    ],
  },
}

const allCalls = [
  readCall,
  editCall,
  writeCall,
  bashCall,
  grepCall,
  taskCall,
  webfetchCall,
  defaultCall,
]

const meta = {
  title: 'in use/ToolRenderers',
  component: ToolCall,
  tags: ['autodocs'],
  decorators: frame('wide'),
  argTypes: {
    tool: { control: false },
    defaultOpen: { control: 'boolean' },
  },
}
export default meta

// ── AllTools: one of every kind, collapsed ───────────────────────────────────
export const AllTools = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {allCalls.map((tool, i) => (
        <ToolCall key={i} tool={tool} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // every row is a real toggle button, collapsed by default.
    const rows = canvas.getAllByRole('button', { expanded: false })
    expect(rows).toHaveLength(8)

    // the collapsed chrome shows the tool name + arg preview + an "ok" status word.
    expect(canvas.getByText('Bash')).toBeInTheDocument()
    expect(canvas.getByText('go test -race ./...')).toBeInTheDocument()
    expect(canvas.getAllByText('ok').length).toBeGreaterThan(0)

    // activating a collapsed row reveals its body (real open/closed state).
    const bashRow = canvas.getByRole('button', { name: /Bash/ })
    await userEvent.click(bashRow)
    await waitFor(() => expect(bashRow).toHaveAttribute('aria-expanded', 'true'))
    expect(canvas.getByText(/8\.213s/)).toBeInTheDocument()
  },
}

// ── Expanded: each kind opened, showing its body ─────────────────────────────
export const Expanded = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {allCalls.map((tool, i) => (
        <ToolCall key={i} tool={tool} defaultOpen />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // read: the numbered excerpt keeps its case (code content is never lowercased).
    expect(canvas.getByText('package ingest')).toBeInTheDocument()

    // edit: the unified diff shows the new streaming line.
    expect(canvas.getByText(/parseStream\(bufio\.NewReader/)).toBeInTheDocument()

    // grep: a match locator reads file:line, the matched code keeps its case.
    expect(canvas.getByText(/func NewReader/)).toBeInTheDocument()

    // task: the subagent name + nested task line (it appears in both the row preview and the body).
    expect(canvas.getAllByText('doc-writer').length).toBeGreaterThan(0)

    // webfetch: the fetched title renders.
    expect(canvas.getByText(/bufio package/)).toBeInTheDocument()
  },
}

// ── BashError: a failing test run — exit 1, status error, failure in clay + word ──
export const BashError = {
  args: {
    defaultOpen: true,
    tool: {
      kind: 'bash',
      name: 'Bash',
      duration: 6200,
      status: 'error',
      args: {
        command: 'go test -race ./packages/ingest/...',
        output:
          '--- FAIL: TestParseStream (0.00s)\n    stream_test.go:7: want error on nil reader\nFAIL\nFAIL\tgithub.com/peasant/ingest\t0.182s',
        exitCode: 1,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // the row status is the word "error", not color alone.
    expect(canvas.getByText('error')).toBeInTheDocument()

    // the exit line shows code 1 + the word "failed".
    expect(canvas.getByText('1')).toBeInTheDocument()
    expect(canvas.getByText('failed')).toBeInTheDocument()
    expect(canvas.getByText(/--- FAIL: TestParseStream/)).toBeInTheDocument()
  },
}

// ── single-kind stories (autodocs friendliness) ──────────────────────────────
export const Read = { args: { tool: readCall, defaultOpen: true } }
export const Edit = { args: { tool: editCall, defaultOpen: true } }
export const Default = { args: { tool: defaultCall, defaultOpen: true } }

export const LightTheme = {
  render: AllTools.render,
  globals: { theme: 'light', backgrounds: { value: 'light' } },
}
