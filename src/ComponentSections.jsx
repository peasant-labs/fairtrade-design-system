import { useState } from 'react'
import { BadgeCheck, Clock, Check, X, Info, Boxes, ShieldCheck, KeyRound, Workflow } from 'lucide-react'
import DataTable from './ui/DataTable.jsx'
import Pagination from './ui/Pagination.jsx'
import Accordion from './ui/Accordion.jsx'

/* live showcase sections for the three new tier-2 components, interleaved into the
   "components" group of the page (App.jsx) like Cards(). each follows the existing
   band/specimen conventions and drives its component with mock data so the example is
   actually usable. none contains an <h1> (the page keeps exactly one, in the intro). */

export function DataTableSection() {
  const [selected, setSelected] = useState(['t-204'])

  const columns = [
    { key: 'agent', label: 'agent', sortable: true },
    { key: 'title', label: 'title', sortable: true },
    { key: 'date', label: 'date', sortable: true },
    { key: 'turns', label: 'turns', sortable: true, align: 'right' },
    {
      key: 'status',
      label: 'status',
      sortable: true,
      render: (v) => (
        <span className="metaitem">
          {v === 'verified' ? <BadgeCheck size={14} /> : <Clock size={14} />} {v}
        </span>
      ),
    },
  ]

  const rows = [
    { id: 't-204', agent: 'claude-code', title: 'refactor ingest pipeline to stream', date: '2026-06-12', turns: 18, status: 'verified' },
    { id: 't-205', agent: 'gemini-cli', title: 'tune redaction rules', date: '2026-06-11', turns: 9, status: 'review' },
    { id: 't-206', agent: 'claude-code', title: 'add fts5 search index', date: '2026-06-10', turns: 24, status: 'verified' },
    { id: 't-207', agent: 'codex-cli', title: 'desert archivists onboarding', date: '2026-06-09', turns: 6, status: 'review' },
  ]

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
        <div className="specimen-bar"><span className="specimen-cap">example · {selected.length} selected</span></div>
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
