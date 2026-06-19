import { useState, useMemo, useCallback } from 'react'
import { BadgeCheck, Clock, Check, X, Info, Boxes, ShieldCheck, KeyRound, Workflow, AlertTriangle } from 'lucide-react'
import DataTable from './ui/DataTable.jsx'
import Pagination from './ui/Pagination.jsx'
import Accordion from './ui/Accordion.jsx'
import Timeline from './ui/Timeline.jsx'
import { Steps } from './ui/Breadcrumb.jsx'
import ToastProvider, { useToast } from './ui/ToastHost.jsx'
import DateRange, { DateRangeCalendar } from './ui/DateRange.jsx'

/* live showcase sections for the three new tier-2 components, interleaved into the
   "components" group of the page (App.jsx) like Cards(). each follows the existing
   band/specimen conventions and drives its component with mock data so the example is
   actually usable. none contains an <h1> (the page keeps exactly one, in the intro). */

export function DataTableSection() {
  const [selected, setSelected] = useState(['t-204'])

  /* columns + rows MUST be stable references: an unmemoized `data`/`columns` array makes
     TanStack Table re-derive its row model every render and re-fire onRowSelectionChange,
     which calls back into setSelected -> re-render -> new array -> loop. that infinite loop
     is what froze the whole page on a checkbox click. memoize them (and the cell renderer). */
  const renderStatus = useCallback(
    (v) => (
      <span className="metaitem">
        {v === 'verified' ? <BadgeCheck size={14} /> : <Clock size={14} />} {v}
      </span>
    ),
    [],
  )

  const columns = useMemo(
    () => [
      { key: 'agent', label: 'agent', sortable: true },
      { key: 'title', label: 'title', sortable: true },
      { key: 'date', label: 'date', sortable: true },
      { key: 'turns', label: 'turns', sortable: true, align: 'right' },
      { key: 'status', label: 'status', sortable: true, render: renderStatus },
    ],
    [renderStatus],
  )

  const rows = useMemo(
    () => [
      { id: 't-204', agent: 'claude-code', title: 'refactor ingest pipeline to stream', date: '2026-06-12', turns: 18, status: 'verified' },
      { id: 't-205', agent: 'gemini-cli', title: 'tune redaction rules', date: '2026-06-11', turns: 9, status: 'review' },
      { id: 't-206', agent: 'claude-code', title: 'add fts5 search index', date: '2026-06-10', turns: 24, status: 'verified' },
      { id: 't-207', agent: 'codex-cli', title: 'desert archivists onboarding', date: '2026-06-09', turns: 6, status: 'review' },
    ],
    [],
  )

  const propCols = [
    { key: 'prop', label: 'prop' },
    { key: 'type', label: 'type' },
    { key: 'def', label: 'default' },
    { key: 'note', label: 'note' },
  ]
  const propRows = [
    { prop: 'columns', type: '{ key, label, sortable?, align?, render? }[]', def: '-', note: 'column defs; align right gets tabular nums' },
    { prop: 'rows', type: 'object[]', def: '-', note: 'row records, read by column key' },
    { prop: 'selectable', type: 'boolean', def: 'false', note: 'render the select-all + per-row checkboxes' },
    { prop: 'defaultSort / sort', type: '{ key, dir } | null', def: 'null', note: 'uncontrolled seed / controlled sort' },
    { prop: 'defaultSelectedKeys / selectedKeys', type: '(string|number)[]', def: '[]', note: 'uncontrolled seed / controlled selection' },
    { prop: 'onSortChange', type: '(next) => void', def: '-', note: 'fires on header click (asc/desc/none)' },
    { prop: 'onSelectionChange', type: '(keys) => void', def: '-', note: 'fires on any checkbox toggle' },
    { prop: 'rowKey', type: '(row, i) => key', def: 'row.id ?? i', note: 'stable per-row key' },
  ]

  return (
    <section className="band" id="data-table">
      <h2 className="label">data table</h2>
      <div className="sub">sortable, selectable rows for dense lists</div>
      <p className="prose">a data table is the scannable form for many transcripts or collectives at once. click a column header to sort it (asc, desc, then back to source order); the header checkbox selects every row, each row carries its own, and the selection is reported back to the caller. it is a real &lt;table&gt; with scope, aria-sort, and the existing checkbox control.</p>

      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example ({selected.length} selected)</span></div>
        <div className="specimen-body">
          <DataTable
            columns={columns}
            rows={rows}
            selectable
            caption="recent transcripts"
            defaultSort={{ key: 'date', dir: 'desc' }}
            selectedKeys={selected}
            onSelectionChange={setSelected}
          />
        </div>
      </div>

      <span className="label">props</span>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead>
            <tr>{propCols.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {propRows.map((r) => (
              <tr key={r.prop}>
                <td className="dt-name">{r.prop}</td>
                <td className="dt-val">{r.type}</td>
                <td className="dt-val">{r.def}</td>
                <td className="dt-role">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cmp">
        <div className="cmp-card cmp-do"><div className="cmp-tag"><Check size={14} /> do</div><div className="cmp-body"><p>make only the columns that have a meaningful order sortable, and right-align numeric columns as tabular nums.</p></div><div className="cmp-note">sort cycles asc to desc to none so the source order is always recoverable.</div></div>
        <div className="cmp-card cmp-dont"><div className="cmp-tag"><X size={14} /> don't</div><div className="cmp-body"><p>mark a selected row with colour alone or hide the per-row checkbox.</p></div><div className="cmp-note">the checkbox is the canonical, programmatic state; the highlight only echoes it.</div></div>
      </div>

      <div className="callout"><BadgeCheck size={16} /><div>headers use scope=col and aria-sort; the sort control is a real button (enter/space, tab-reachable); the select-all checkbox carries an indeterminate state when only some rows are picked; status pairs an icon with a label, never colour alone.</div></div>
    </section>
  )
}

export function PaginationSection() {
  const [few, setFew] = useState(2)
  const [many, setMany] = useState(7)
  const pageSize = 10
  const totalItems = 184

  return (
    <section className="band" id="pagination">
      <h2 className="label">pagination</h2>
      <div className="sub">numbered page navigation with ellipsis truncation</div>
      <p className="prose">numbered pagination is the richer sibling of the simple prev/next pager: real page-number buttons, collapsed runs marked with an ellipsis, and prev/next controls that disable at the ends. the current page is the single amber mark, doubled by aria-current so it never rides on colour alone. digits are tabular so the row never reflows as you page.</p>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="bs-grid">
            <div className="bs-cell">
              <span className="bs-cap">short range, every page shown</span>
              <Pagination page={few} total={5} onChange={setFew} />
            </div>
            <div className="bs-cell">
              <span className="bs-cap">long range, truncated with ellipses</span>
              <Pagination page={many} total={24} onChange={setMany} />
            </div>
            <div className="bs-cell">
              <span className="bs-cap">derived from {totalItems} items / {pageSize} per page</span>
              <Pagination defaultPage={1} totalItems={totalItems} pageSize={pageSize} />
            </div>
          </div>
        </div>
      </div>
      <div className="cmp">
        <div className="cmp-card cmp-do"><div className="cmp-tag"><Check size={14} /> do</div><div className="cmp-body"><p>mark the current page with amber and aria-current, and keep first / last anchored.</p></div><div className="cmp-note">tabular digits hold the row steady as the page changes.</div></div>
        <div className="cmp-card cmp-dont"><div className="cmp-tag"><X size={14} /> don't</div><div className="cmp-body"><p>render every page when there are dozens, or hide a single page behind an ellipsis.</p></div><div className="cmp-note">truncate runs, but show the pages adjacent to a gap.</div></div>
      </div>
      <div className="callout"><BadgeCheck size={16} /><div>each page is a real button with a &gt;=24px target and a 3px focus ring; prev / next disable at the ends, and the ellipsis is decorative (aria-hidden).</div></div>
    </section>
  )
}

export function AccordionSection() {
  const items = [
    {
      id: 'providers',
      title: 'connected providers',
      icon: Boxes,
      content: (
        <>
          <p>each provider is linked once, then every transcript it produces inherits the same identity, redaction policy, and retention window. claude-code, gemini-cli and codex are wired in by default.</p>
          <ul className="bullets">
            <li>one identity across every provider</li>
            <li>policy inherited, not re-declared per tool</li>
          </ul>
        </>
      ),
    },
    {
      id: 'redaction',
      title: 'redaction rules',
      icon: ShieldCheck,
      content: (
        <p>secrets, tokens and paths are matched against a shared ruleset before a session is ever written to disk. review is required before a redacted transcript can be shared to a collective.</p>
      ),
    },
    {
      id: 'access',
      title: 'access & keys',
      icon: KeyRound,
      content: (
        <p>scoped keys are issued per surface and rotate on a fixed window. a revoked key stops new sessions immediately; existing transcripts keep their original attribution.</p>
      ),
    },
    {
      id: 'pipeline',
      title: 'ingest pipeline',
      icon: Workflow,
      content: (
        <p>sessions stream in at constant memory, get stamped with provider and duration, then indexed for search. the whole path is observable end to end.</p>
      ),
    },
  ]

  return (
    <section className="band" id="accordion">
      <h2 className="label">accordion</h2>
      <div className="sub">collapsible panels for dense, optional detail</div>
      <p className="prose">an accordion folds long-form or secondary detail into a tidy stack of hairline panels. one panel opens at a time by default so the surface stays calm; pass allowMultiple when several sections are read together. each header is a real button, so the keyboard and screen readers get the open state for free.</p>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <Accordion items={items} defaultOpen="providers" aria-label="identity settings" />
        </div>
      </div>
      <div className="cmp">
        <div className="cmp-card cmp-do">
          <div className="cmp-tag"><Check size={14} /> do</div>
          <div className="cmp-body"><p>use an accordion for optional, scannable detail where one topic is read at a time.</p></div>
          <div className="cmp-note">each header states its topic in plain words; the chevron and open state carry the cue.</div>
        </div>
        <div className="cmp-card cmp-dont">
          <div className="cmp-tag"><X size={14} /> don't</div>
          <div className="cmp-body"><p>hide primary actions or required form fields inside a collapsed panel.</p></div>
          <div className="cmp-note">anything a person must see to proceed belongs on the surface, not folded away.</div>
        </div>
      </div>
      <div className="callout"><Info size={16} /><div>headers are buttons with aria-expanded controlling a labelled region; up/down/home/end roam the headers, enter or space toggles, and the chevron rotation is disabled under reduced-motion.</div></div>
    </section>
  )
}

/* ============================ tier-2 (2026-06-17) ============================ */
/* three new live-component sections: timeline, toast host, date range. each drives
   the real src/ui component and follows the band/specimen/anatomy/cmp/callout rhythm. */

/* a trimmed, TranscriptApp-shaped mixed stream for the live timeline specimen: one
   user turn, an assistant turn with an OPEN read tool + thinking, a phase divider, an
   assistant turn with an edit diff + a failing bash, a subagent turn at depth 1, and a
   checkpoint. chrome stays lowercase; the transcript bodies + code keep their case. */
const TIMELINE_ITEMS = [
  {
    id: 'u1', kind: 'turn', role: 'user', label: '1', time: '8m ago', longTime: 'jun 17, 2026 at 09:12',
    tokens: { in: 280, out: 0 },
    body: 'Port the transcript canvas into the shared package. Start by reading the existing renderer before extracting it.',
  },
  {
    id: 'a1', kind: 'turn', role: 'assistant', label: '1a', time: '8m ago', longTime: 'jun 17, 2026 at 09:12',
    tokens: { in: 1840, out: 920 },
    thinking: { words: 84, text: 'The renderer lives under web/src/components/session-detail/v2/canvas. I should read TurnRow.tsx first to understand how role glyphs + tool calls compose before I move anything into packages/browser.' },
    body: 'Let me look at the current renderer before extracting it. I will read TurnRow.tsx and find where rendererFor is wired so the move preserves the per-tool dispatch.',
    tools: [
      { id: 't1a', kind: 'read', name: 'Read', preview: 'web/src/components/session-detail/v2/canvas/TurnRow.tsx', path: 'web/src/components/session-detail/v2/canvas/TurnRow.tsx', lines: '1–40', excerpt: 'export function TurnRow({ turn, depth }: TurnRowProps) {\n  const Glyph = roleGlyph(turn.role)\n  return (\n    <div className="turn-row" data-depth={depth}>\n      <RoleGlyph as={Glyph} />\n      <Markdown source={turn.content} />\n    </div>\n  )\n}' },
    ],
  },
  { id: 'p1', kind: 'phase', phaseLabel: 'debugging', icon: AlertTriangle, range: 'turns 2–3, 1 error' },
  {
    id: 'a2', kind: 'turn', role: 'assistant', label: '2a', time: '6m ago', longTime: 'jun 17, 2026 at 09:16',
    error: true, tokens: { in: 2600, out: 1320 },
    body: 'The index access is unguarded under strict mode. Adding a null-guard, then re-running the workspace typecheck.',
    tools: [
      { id: 't2a', kind: 'edit', name: 'Edit', preview: 'packages/browser/src/lib/tasks.ts', path: 'packages/browser/src/lib/tasks.ts', adds: 3, dels: 1, hunk: [
        { sign: 'ctx', a: '46', b: '46', t: '  const groups = groupByTask(turns)' },
        { sign: 'del', a: '47', b: '', t: '  const first = groups[0]' },
        { sign: 'add', a: '', b: '47', t: '  const first = groups[0]' },
        { sign: 'add', a: '', b: '48', t: '  if (!first || first.turns.length === 0) return null' },
        { sign: 'del', a: '48', b: '', t: '  return first.turns[0].index' },
      ] },
      { id: 't2b', kind: 'bash', name: 'Bash', preview: 'pnpm -r typecheck', command: 'pnpm -r typecheck', stdout: "src/lib/tasks.ts(48,9): error TS2532: Object is possibly 'undefined'.\nELIFECYCLE  Command failed with exit code 2.", duration: '4.1s', exit: 2 },
    ],
  },
  {
    id: 's1', kind: 'turn', role: 'assistant', label: '2d', depth: 1, subagent: 'docs-writer', time: '3m ago', longTime: 'jun 17, 2026 at 09:18',
    tokens: { in: 1700, out: 1140 },
    body: 'Spawned a subagent to document the props/callback/capability contract for the extracted package.',
    tools: [
      { id: 't3a', kind: 'task', name: 'Task', preview: 'docs-writer document the props/callback contract', agent: 'docs-writer', status: 'completed', task: 'Document the props/callback/capability contract', owner: 'main', promptBody: 'Write the README contract section for <SessionDetail>: every prop, every host callback, and the capability flags that gate the action menu.', result: 'Drafted README.md contract section (78 lines). Documented 14 props, 3 callbacks, 4 capability flags.' },
    ],
  },
  { id: 'cp1', kind: 'checkpoint', hash: '9f3c1ad', msg: 'feat(canvas): port TurnRow + tool renderers', stat: { files: 7, adds: 312, dels: 24 } },
]

export function TimelineSection() {
  return (
    <section className="band" id="timeline">
      <h2 className="label">timeline</h2>
      <div className="sub">a vertical spine for a whole session: phases, role turns, tool calls, subagents and checkpoints, read top to bottom</div>
      <p className="prose">a timeline is the vertical sibling of the horizontal step wizard. the step wizard marks progress through a short fixed flow; the timeline strings an open-ended, mixed event stream down one continuous spine. role is carried by a glyph and a label, tool calls and thinking collapse to a summary line and open on demand, the spine stays unbroken even through a subagent inset, and a checkpoint ties the prose back to a commit. for a short linear flow (choose to label to redact) reach for the step wizard instead; the timeline is for the open-ended session.</p>

      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">the horizontal sibling: a step wizard for a short fixed flow</span></div>
        <div className="specimen-body">
          <Steps steps={[
            { label: 'choose', status: 'done' },
            { label: 'label', status: 'done' },
            { label: 'redact', status: 'cur' },
            { label: 'submit' },
          ]} />
        </div>
      </div>

      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">the vertical timeline: an open-ended session, read top to bottom</span></div>
        <div className="specimen-body">
          <Timeline items={TIMELINE_ITEMS} ariaLabel="session timeline" />
        </div>
      </div>

      <div className="anatomy">
        <div className="anatomy-legend">
          <span className="anatomy-item"><span className="anatomy-num">1</span> the continuous spine</span>
          <span className="anatomy-item"><span className="anatomy-num">2</span> role dot + glyph (tint never alone)</span>
          <span className="anatomy-item"><span className="anatomy-num">3</span> turn head: glyph, label, tabular turn number and time</span>
          <span className="anatomy-item"><span className="anatomy-num">4</span> body in the reading face, original case</span>
          <span className="anatomy-item"><span className="anatomy-num">5</span> collapsible thinking block</span>
          <span className="anatomy-item"><span className="anatomy-num">6</span> collapsible tool call, type-dispatched</span>
          <span className="anatomy-item"><span className="anatomy-num">7</span> the reused diff renderer</span>
          <span className="anatomy-item"><span className="anatomy-num">8</span> subagent inset, the spine staying continuous</span>
          <span className="anatomy-item"><span className="anatomy-num">9</span> phase divider with range</span>
          <span className="anatomy-item"><span className="anatomy-num">10</span> checkpoint marker</span>
        </div>
      </div>

      <div className="cmp">
        <div className="cmp-card cmp-do">
          <div className="cmp-tag"><Check size={14} /> do</div>
          <div className="cmp-body"><p>lead each node with a glyph and a label, and keep the spine continuous through nesting.</p></div>
          <div className="cmp-note">depth rides on an inset and the subagent label together, never indentation alone.</div>
        </div>
        <div className="cmp-card cmp-dont">
          <div className="cmp-tag"><X size={14} /> don't</div>
          <div className="cmp-body"><p>break the spine into separate nested lists per subagent, lean on tint alone for role, or lowercase the transcript body.</p></div>
          <div className="cmp-note">chrome is lowercase; the transcript content and code keep their original case.</div>
        </div>
      </div>

      <div className="callout"><Info size={16} /><div>the ordered list reads in visual order; subagent depth is conveyed by an inset and the subagent label, not indentation alone; every collapse is a real aria-expanded button whose body mounts on open; turn numbers, durations and tokens are tabular; the spine and dots are decorative and aria-hidden, so they never enter the reading order.</div></div>
    </section>
  )
}

export function ToastSection() {
  const propRows = [
    { prop: 'placement', type: "'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center' | 'top-center'", def: "'bottom-right'", note: 'corner the host pins to and the edge toasts enter from' },
    { prop: 'max', type: 'number', def: '4', note: 'cap on visible toasts; the oldest drops from the front (fifo)' },
    { prop: 'duration', type: 'number', def: '5000', note: 'default auto-dismiss in ms; 0 or Infinity is sticky' },
    { prop: 'gap', type: 'number', def: '-', note: 'optional px override of the stack gap (defaults to --sp-3)' },
    { prop: 'inline', type: 'boolean', def: 'false', note: 'pin absolutely inside a relative container instead of the viewport' },
    { prop: 'toast.ok(msg, opts?)', type: '(string, opts) => id', def: '-', note: 'success tone: olive circle-check, role=status' },
    { prop: 'toast.err(msg, opts?)', type: '(string, opts) => id', def: '-', note: 'error tone: clay circle-x, role=alert' },
    { prop: 'toast.show(opts)', type: '(opts) => id', def: '-', note: 'full control; title, variant, icon, duration, closeLabel, id' },
    { prop: 'toast.dismiss(id)', type: '(id) => void', def: '-', note: 'remove one immediately (runs the exit transition)' },
    { prop: 'toast.dismissAll()', type: '() => void', def: '-', note: 'clear the whole stack' },
    { prop: 'toast.update(id, opts)', type: '(id, opts) => void', def: '-', note: 'patch a live toast, e.g. promote a pending one to ok/err' },
  ]

  return (
    <section className="band" id="toast">
      <h2 className="label">toast host</h2>
      <div className="sub">stacked, self-dismissing notifications</div>
      <p className="prose">a toast host is an imperative layer over the toast surface. call toast.ok or toast.err from anywhere inside the provider and a notification stacks into a fixed corner, then dismisses itself after a few seconds. the timer pauses while a toast is hovered or focused so a slow reader is never timed out mid-read. success is olive, error is clay, each led by an icon and a lowercase title, never colour alone, and amber is kept out so the accent stays scarce.</p>

      <div className="specimen" style={{ position: 'relative' }}>
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={{ position: 'relative', minHeight: 220 }}>
          <ToastProvider placement="bottom-right" inline>
            <ToastBar />
          </ToastProvider>
        </div>
      </div>

      <span className="label">props</span>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead>
            <tr><th scope="col">prop</th><th scope="col">type</th><th scope="col">default</th><th scope="col">note</th></tr>
          </thead>
          <tbody>
            {propRows.map((r) => (
              <tr key={r.prop}>
                <td className="dt-name">{r.prop}</td>
                <td className="dt-val">{r.type}</td>
                <td className="dt-val">{r.def}</td>
                <td className="dt-role">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cmp">
        <div className="cmp-card cmp-do">
          <div className="cmp-tag"><Check size={14} /> do</div>
          <div className="cmp-body"><p>let toasts auto-dismiss, but pause the timer while a toast is hovered or focused, and keep success and error distinct by icon and title.</p></div>
          <div className="cmp-note">tone never rides on colour alone; the glyph and the label carry it.</div>
        </div>
        <div className="cmp-card cmp-dont">
          <div className="cmp-tag"><X size={14} /> don't</div>
          <div className="cmp-body"><p>queue more than a handful at once, or use a toast for an error the user must act on.</p></div>
          <div className="cmp-note">a blocking error belongs in an inline panel or a dialog, not a transient toast.</div>
        </div>
      </div>

      <div className="callout"><ShieldCheck size={16} /><div>the host is one polite live region created up front; success rides it as role=status, an error adds role=alert so it speaks at once. each toast pairs a circle-check or circle-x glyph with a lowercase title, never colour alone, and amber is kept out so the accent stays scarce. the dismiss button is a real 24px target with the global focus ring; the auto-dismiss timer pauses while a toast is hovered or focused, and enter and exit motion is dropped entirely under reduced-motion.</div></div>
    </section>
  )
}

function ToastBar() {
  const toast = useToast()
  return (
    <div className="btn-row">
      <button type="button" className="btn btn-primary" onClick={() => toast.ok('shared to the claude-code collective.', { title: 'transcript published' })}>
        publish
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => toast.err('2 names still exposed in the gemini-cli session.', { title: 'redaction failed' })}>
        retry
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => {
        toast.ok('first transcript queued.', { title: 'queued' })
        toast.ok('second transcript queued.', { title: 'queued' })
        toast.ok('third transcript queued.', { title: 'queued' })
      }}>
        stack 3
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => toast.dismissAll()}>
        dismiss all
      </button>
    </div>
  )
}

export function DateRangeSection() {
  const [value, setValue] = useState({ from: '2026-06-01', to: '2026-06-14' })

  const propCols = [
    { key: 'prop', label: 'prop' },
    { key: 'type', label: 'type' },
    { key: 'def', label: 'default' },
    { key: 'note', label: 'note' },
  ]
  const propRows = [
    { prop: 'value / defaultValue', type: '{ from, to }', def: '{from:null,to:null}', note: 'controlled / seed; iso yyyy-mm-dd strings, never date objects' },
    { prop: 'onChange / onDraftChange', type: '(value) => void', def: '-', note: 'committed range or preset / each in-popover click before commit' },
    { prop: 'presets', type: '{ id, label, range }[]', def: 'DATE_PRESETS', note: 'quick ranges down the rail; pass [] to hide it' },
    { prop: 'numberOfMonths', type: '1 | 2', def: '2', note: 'auto-collapses to 1 under ~560px via a container query' },
    { prop: 'weekStartsOn', type: '0..6', def: '1', note: 'monday-first by default, matching the iso week anchor' },
    { prop: 'min / max', type: 'string', def: '-', note: 'iso bounds; out-of-range days are aria-disabled and skipped by the arrows' },
  ]

  return (
    <section className="band" id="date-range">
      <h2 className="label">date range</h2>
      <div className="sub">a trigger plus a two-month grid for picking a span</div>
      <p className="prose">a date range is one trigger that reads like a field and one panel that holds the work: a rail of quick ranges for the cases people ask for ninety percent of the time, and two month grids for the exact span. dates cross the boundary as iso strings, so the value stays tabular, serializable, and stable across locales. the two endpoints are the only amber-filled cells; today is a hairline ring; the run between the ends is a quiet wash, never a saturated fill.</p>

      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">date-range / interactive</span></div>
        <div className="specimen-body">
          {/* a filter toolbar: every control sits on the same --control-h (36px) line so the
              row reads as one intentional bar, not three ragged heights. the sm trigger size
              is a documented prop (see the table below); mixing it into a filter row made one
              control look broken, so the live demo of size="sm" lives in its own row. */}
          <div className="btn-row">
            <DateRange value={value} onChange={setValue} />
            <DateRange defaultValue={{ from: '2026-06-03', to: '2026-06-03' }} />
            <button type="button" className="btn btn-secondary">filter</button>
          </div>
          <div className="btn-row" style={{ marginTop: 'var(--sp-3)' }}>
            <span className="label">small</span>
            <DateRange defaultValue={{ from: '2026-06-03', to: '2026-06-03' }} size="sm" />
          </div>
        </div>
      </div>

      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">calendar / static</span></div>
        <div className="specimen-body">
          <DateRangeCalendar className="is-static" defaultValue={{ from: '2026-06-04', to: '2026-06-18' }} />
        </div>
      </div>

      <span className="label">anatomy</span>
      <div className="anatomy">
        <div className="anatomy-legend">
          <span className="anatomy-item"><span className="anatomy-num tnum">1</span> trigger: calendar icon, the tabular value, a caret that rotates open</span>
          <span className="anatomy-item"><span className="anatomy-num tnum">2</span> preset rail: quick ranges as aria-pressed toggles down the left edge</span>
          <span className="anatomy-item"><span className="anatomy-num tnum">3</span> month header: prev / next chevrons flanking a month-year caption</span>
          <span className="anatomy-item"><span className="anatomy-num tnum">4</span> day grid: a roving-tabindex grid, 32px cells, monday-first columns</span>
          <span className="anatomy-item"><span className="anatomy-num tnum">5</span> selected endpoints: the two amber-filled cells, bold and aria-selected</span>
          <span className="anatomy-item"><span className="anatomy-num tnum">6</span> range band: a quiet color-mix wash so the span reads as one run</span>
          <span className="anatomy-item"><span className="anatomy-num tnum">7</span> footer: the resolved readout plus clear and apply</span>
        </div>
      </div>

      <span className="label">props</span>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead>
            <tr>{propCols.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {propRows.map((r) => (
              <tr key={r.prop}>
                <td className="dt-name">{r.prop}</td>
                <td className="dt-val">{r.type}</td>
                <td className="dt-val">{r.def}</td>
                <td className="dt-role">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cmp">
        <div className="cmp-card cmp-do">
          <div className="cmp-tag"><Check size={14} /> do</div>
          <div className="cmp-body"><p>anchor the calendar with presets for the 90 percent cases, and keep the exact grid one click away for the rest.</p></div>
          <div className="cmp-note">the active preset is announced by aria-pressed, not by its amber border alone.</div>
        </div>
        <div className="cmp-card cmp-dont">
          <div className="cmp-tag"><X size={14} /> don't</div>
          <div className="cmp-body"><p>fill the range days with saturated amber.</p></div>
          <div className="cmp-note">reserve amber for the two endpoints; the interior is a quiet wash and today is a hairline ring.</div>
        </div>
      </div>

      <div className="callout"><Info size={16} /><div>each month is a role=grid with a roving tabindex: arrows move by day or week, home and end jump within the week, page up and page down change the month, and shift adds a year. every day carries its full date as an aria-label, out-of-bounds days are aria-disabled and skipped by the arrows, the endpoints are aria-selected, and a polite live region spells the resolved span on every change so colour is never the only cue.</div></div>
    </section>
  )
}

