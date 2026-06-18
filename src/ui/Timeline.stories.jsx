import { expect, userEvent, within, waitFor } from 'storybook/test'
import { FileSearch, AlertTriangle, Pencil } from 'lucide-react'
import Timeline from './Timeline.jsx'

/* timeline story. CSF3: a Playground driven by argTypes plus one named story per
   meaningful axis (roles + tints, every built-in tool renderer, the two render props,
   thinking, phases + checkpoints, a subagent thread, dense, empty, light). classes +
   tokens come from src/index.css via .storybook/preview.jsx; the theme toolbar flips
   data-theme. Playground + WithThinking carry play() interaction tests that assert on
   the aria-expanded attribute + the lazy-mounted body's existence (entrance bodies
   are absent from the tree until open — never an instant toBeVisible()). */

/* a trimmed copy of TranscriptApp's TURNS, reshaped to the flat TimelineItem stream:
   one user turn, an assistant turn with a read tool + thinking, a phase divider, an
   assistant turn with an edit diff + a failing bash, a subagent turn, a checkpoint. */
const items = [
  {
    id: 'u1',
    kind: 'turn',
    role: 'user',
    label: '1',
    time: '8m ago',
    longTime: 'jun 17, 2026 · 09:12',
    tokens: { in: 280, out: 0 },
    body: 'Port the transcript canvas into the shared package. Start by reading the existing renderer before extracting it.',
  },
  {
    id: 'a1',
    kind: 'turn',
    role: 'assistant',
    label: '1a',
    time: '8m ago',
    longTime: 'jun 17, 2026 · 09:12',
    tokens: { in: 1840, out: 920 },
    thinking: {
      words: 84,
      text:
        'The renderer lives under web/src/components/session-detail/v2/canvas. I should read TurnRow.tsx first to understand how role glyphs + tool calls compose before I move anything into packages/browser.',
    },
    body: 'Let me look at the current renderer before extracting it. I will read TurnRow.tsx and find where rendererFor is wired so the move preserves the per-tool dispatch.',
    tools: [
      {
        id: 't1a',
        kind: 'read',
        name: 'Read',
        preview: 'web/src/components/session-detail/v2/canvas/TurnRow.tsx',
        path: 'web/src/components/session-detail/v2/canvas/TurnRow.tsx',
        lines: '1–40',
        excerpt:
          'export function TurnRow({ turn, depth }: TurnRowProps) {\n  const Glyph = roleGlyph(turn.role)\n  return (\n    <div className="turn-row" data-depth={depth}>\n      <RoleGlyph as={Glyph} />\n      <Markdown source={turn.content} />\n    </div>\n  )\n}',
      },
    ],
  },
  {
    id: 'p1',
    kind: 'phase',
    phaseLabel: 'debugging',
    icon: AlertTriangle,
    range: 'turns 2–3 · 1 error',
  },
  {
    id: 'a2',
    kind: 'turn',
    role: 'assistant',
    label: '2a',
    time: '6m ago',
    longTime: 'jun 17, 2026 · 09:16',
    error: true,
    tokens: { in: 2600, out: 1320 },
    body: 'The index access is unguarded under strict mode. Adding a null-guard, then re-running the workspace typecheck.',
    tools: [
      {
        id: 't2a',
        kind: 'edit',
        name: 'Edit',
        preview: 'packages/browser/src/lib/tasks.ts',
        path: 'packages/browser/src/lib/tasks.ts',
        adds: 3,
        dels: 1,
        hunk: [
          { sign: 'ctx', a: '46', b: '46', t: '  const groups = groupByTask(turns)' },
          { sign: 'del', a: '47', b: '', t: '  const first = groups[0]' },
          { sign: 'add', a: '', b: '47', t: '  const first = groups[0]' },
          { sign: 'add', a: '', b: '48', t: '  if (!first || first.turns.length === 0) return null' },
          { sign: 'del', a: '48', b: '', t: '  return first.turns[0].index' },
        ],
      },
      {
        id: 't2b',
        kind: 'bash',
        name: 'Bash',
        preview: 'pnpm -r typecheck',
        command: 'pnpm -r typecheck',
        stdout:
          "packages/browser typecheck$ tsc -p tsconfig.json --noEmit\nsrc/lib/tasks.ts(48,9): error TS2532: Object is possibly 'undefined'.\nELIFECYCLE  Command failed with exit code 2.",
        duration: '4.1s',
        exit: 2,
      },
    ],
  },
  {
    id: 's1',
    kind: 'turn',
    role: 'assistant',
    label: '2d',
    depth: 1,
    subagent: 'docs-writer',
    time: '3m ago',
    longTime: 'jun 17, 2026 · 09:18',
    tokens: { in: 1700, out: 1140 },
    body: 'Spawned a subagent to document the props/callback/capability contract for the extracted package.',
    tools: [
      {
        id: 't3a',
        kind: 'task',
        name: 'Task',
        preview: 'docs-writer · document the props/callback contract',
        agent: 'docs-writer',
        status: 'completed',
        task: 'Document the props/callback/capability contract',
        owner: 'main',
        promptBody: 'Write the README contract section for <SessionDetail>: every prop, every host callback, and the capability flags that gate the action menu.',
        result: 'Drafted README.md contract section (78 lines). Documented 14 props, 3 callbacks, 4 capability flags.',
      },
    ],
  },
  {
    id: 'cp1',
    kind: 'checkpoint',
    hash: '9f3c1ad',
    msg: 'feat(canvas): port TurnRow + tool renderers',
    stat: { files: 7, adds: 312, dels: 24 },
  },
]

const meta = {
  title: 'components/Timeline',
  component: Timeline,
  tags: ['autodocs'],
  argTypes: {
    dense: { control: 'boolean' },
    ariaLabel: { control: 'text' },
    items: { control: false },
    renderTool: { control: false },
    renderBody: { control: false },
  },
  args: {
    items,
    dense: false,
    ariaLabel: 'conversation timeline',
  },
}
export default meta

export const Playground = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // a collapsed tool call: header present + collapsed, body absent from the tree.
    const readToggle = canvas.getByRole('button', { name: /Read/ })
    expect(readToggle).toHaveAttribute('aria-expanded', 'false')
    expect(canvas.queryByText(/export function TurnRow/)).toBeNull()

    // open it.
    await userEvent.click(readToggle)

    // it expands + its body lazy-mounts into the tree.
    await waitFor(() => {
      expect(readToggle).toHaveAttribute('aria-expanded', 'true')
    })
    expect(canvas.getByText(/export function TurnRow/)).toBeInTheDocument()

    // the ordered-list landmark carries its label.
    expect(canvas.getByRole('list', { name: /conversation timeline/i })).toBeInTheDocument()
  },
}

export const RolesAndTints = {
  args: {
    items: [
      { id: 'r1', kind: 'turn', role: 'user', label: '1', time: 'now', tokens: { in: 120, out: 0 }, body: 'one node per role to read the glyph + tint table.' },
      { id: 'r2', kind: 'turn', role: 'assistant', label: '1a', time: 'now', tokens: { in: 900, out: 320 }, body: 'assistant is the only amber node; tint never stands alone.' },
      { id: 'r3', kind: 'turn', role: 'subagent', depth: 1, subagent: 'docs-writer', label: '1b', time: 'now', tokens: { in: 400, out: 210 }, body: 'a subagent inset; the spine stays continuous.' },
      { id: 'r4', kind: 'turn', role: 'tool', label: '1c', time: 'now', body: 'a bare tool event.' },
      { id: 'r5', kind: 'turn', role: 'system', label: '1d', time: 'now', body: 'a system note.' },
    ],
  },
}

export const ToolRenderers = {
  args: {
    items: [
      {
        id: 'tr',
        kind: 'turn',
        role: 'assistant',
        label: '1a',
        time: 'now',
        tokens: { in: 4200, out: 1800 },
        body: 'one turn exercising every built-in tool renderer plus the reused diff.',
        tools: [
          { id: 'x-read', kind: 'read', name: 'Read', preview: 'src/lib/tasks.ts', path: 'src/lib/tasks.ts', lines: '1–20', excerpt: 'export const x = 1\nexport const y = 2' },
          { id: 'x-grep', kind: 'grep', name: 'Grep', preview: 'rendererFor · src · 4 matches', pattern: 'rendererFor', scope: 'src', glob: '*.ts', matches: 4, results: 'src/canvas/rendererFor.ts:12 export function rendererFor(kind)' },
          { id: 'x-edit', kind: 'edit', name: 'Edit', preview: 'src/lib/tasks.ts', path: 'src/lib/tasks.ts', adds: 2, dels: 1, hunk: [
            { sign: 'ctx', a: '1', b: '1', t: 'const a = 1' },
            { sign: 'del', a: '2', b: '', t: 'const b = 2' },
            { sign: 'add', a: '', b: '2', t: 'const b = 3' },
          ] },
          { id: 'x-bash', kind: 'bash', name: 'Bash', preview: 'pnpm test', command: 'pnpm test', stdout: '1 failing\nexit 1', duration: '2.3s', exit: 1 },
          { id: 'x-task', kind: 'task', name: 'Task', preview: 'docs-writer · write the contract', agent: 'docs-writer', status: 'completed', task: 'write the contract', owner: 'main', promptBody: 'document the props.', result: 'done. 78 lines.' },
          { id: 'x-fetch', kind: 'webfetch', name: 'WebFetch', preview: 'docs.peasant.dev/api', url: 'https://docs.peasant.dev/api', prompt: 'extract the auth flow', result: 'auth uses a bearer token in the Authorization header.' },
          { id: 'x-other', kind: 'mcp', name: 'mcp__server__call', preview: 'mcp__server__call', args: { a: 1, b: 'two' }, result: 'ok' },
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // open every tool head so every renderer mounts.
    for (const btn of canvas.getAllByRole('button')) {
      if (btn.getAttribute('aria-expanded') === 'false') await userEvent.click(btn)
    }
    await waitFor(() => {
      expect(canvas.getByText(/export const x/)).toBeInTheDocument()
    })
  },
}

export const CustomRenderTool = {
  args: {
    renderTool: (tool) => (
      <div className="tl-tool-body">
        <span className="mono">custom · {tool.kind} · {tool.preview}</span>
      </div>
    ),
  },
}

export const CustomRenderBody = {
  args: {
    renderBody: (item) => {
      const html = (item.body || '')
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/`([^`]+)`/g, '<code class="tl-inlinecode">$1</code>')
      return <div className="tl-body" dangerouslySetInnerHTML={{ __html: html }} />
    },
    items: items.map((it) =>
      it.id === 'a1' ? { ...it, body: 'Let me read **TurnRow.tsx** and find where `rendererFor` is wired.' } : it,
    ),
  },
}

export const WithThinking = {
  args: {
    items: [
      {
        id: 'wt',
        kind: 'turn',
        role: 'assistant',
        label: '1a',
        time: 'now',
        tokens: { in: 1840, out: 920 },
        body: 'a turn whose reasoning collapses to a summary line and opens on demand.',
        thinking: { words: 41, text: 'groups[0] is possibly undefined under noUncheckedIndexedAccess. Guard it and return null for the empty case.' },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // collapsed: toggle present + collapsed, reasoning text absent from the tree.
    const toggle = canvas.getByRole('button', { name: /thinking/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(canvas.queryByText(/noUncheckedIndexedAccess/)).toBeNull()

    // open it.
    await userEvent.click(toggle)

    // expanded: the reasoning lazy-mounts.
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })
    expect(canvas.getByText(/noUncheckedIndexedAccess/)).toBeInTheDocument()
  },
}

export const PhasesAndCheckpoints = {
  args: {
    items: [
      { id: 'pc-p1', kind: 'phase', phaseLabel: 'exploration', icon: FileSearch, range: 'turns 1–2' },
      { id: 'pc-a1', kind: 'turn', role: 'assistant', label: '1a', time: 'now', tokens: { in: 900, out: 300 }, body: 'reading the renderer.' },
      { id: 'pc-p2', kind: 'phase', phaseLabel: 'implementation', icon: Pencil, range: 'turns 3–4' },
      { id: 'pc-a2', kind: 'turn', role: 'assistant', label: '2a', time: 'now', tokens: { in: 1100, out: 500 }, body: 'committing the canvas port.' },
      { id: 'pc-cp', kind: 'checkpoint', hash: '9f3c1ad', msg: 'feat(canvas): port TurnRow + tool renderers', stat: { files: 7, adds: 312, dels: 24 } },
    ],
  },
}

export const SubagentThread = {
  args: {
    items: [
      { id: 'st-a1', kind: 'turn', role: 'assistant', label: '2c', time: 'now', tokens: { in: 1900, out: 980 }, body: 'spawning a subagent to document the contract.' },
      { id: 'st-s1', kind: 'turn', role: 'subagent', depth: 1, subagent: 'docs-writer', label: '2d', time: 'now', tokens: { in: 1700, out: 1140 }, body: 'a depth-1 subagent turn; the spine stays continuous through the inset.' },
      { id: 'st-a2', kind: 'turn', role: 'assistant', label: '2e', time: 'now', final: true, tokens: { in: 980, out: 720 }, body: 'returned to the main thread.' },
    ],
  },
}

export const Dense = {
  args: { dense: true },
}

export const Empty = {
  args: { items: [], ariaLabel: 'no turns' },
}

export const LightTheme = {
  globals: { theme: 'light', backgrounds: { value: 'light' } },
}
