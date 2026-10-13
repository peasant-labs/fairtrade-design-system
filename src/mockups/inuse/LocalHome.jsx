import { useMemo, useState } from 'react'
import { Search, Copy } from 'lucide-react'
import {
  Button,
  DataTable,
  Input,
  Select,
  Segmented,
  Sparkline,
  StatsStrip,
  ProviderIcon,
  ProviderName,
  PublishStateLabel,
  SettingGroup,
  SettingRow,
  SettingStatus,
} from '../../ui'
import {
  HOME_SUMMARY,
  HOME_SESSIONS,
  HOME_FILTERS,
  HOME_PROJECTS,
  SETTINGS_SUMMARY,
  SETTINGS_GROUPS,
  SETTINGS_FILES,
} from './local-fixture.js'

/* The local app's home and settings sections for the in-use graph demo, built from existing
   library parts: a stats strip, a search field, the session list, and the settings groups. Every
   value is demo data (local-fixture.js); nothing here fetches. */

/* a row's publish state, drawn by the shared publish state label */
const renderPublishState = (row) => (
  <PublishStateLabel state={row.state} collectives={row.collectives} newTurns={row.newTurns ?? 6} collective={row.collective} />
)

function matchesFilter(row, filter) {
  if (filter === 'all') return true
  if (filter === 'not-published') return row.state === 'not-published'
  if (filter === 'published') return row.state === 'published' || row.state === 'new-turns'
  return row.state === 'auto-publish'
}

/* the session list's columns: title and harness lead, the numbers are right-aligned tabular. */
function sessionColumns(renderState) {
  return [
    {
      key: 'title',
      label: 'session',
      width: '18rem',
      render: (_, row) => (
        <span className="iu-session">
          <ProviderIcon harness={row.harness} accent />
          <span className="iu-session-text">
            <a className="iu-session-title" href={`#session-${row.id}`}>{row.title}</a>
            <span className="iu-session-sub">{row.untitled ? 'untitled · ' : ''}{String(row.harness).replace(/-/g, ' ')} · <span className="tnum">{row.tokens}</span> tokens</span>
          </span>
        </span>
      ),
    },
    { key: 'project', label: 'project · branch', render: (_, row) => <span className="iu-session-where"><span>{row.project}</span><span className="iu-session-sub mono">{row.branch}</span></span> },
    { key: 'turns', label: 'turns', align: 'right' },
    { key: 'duration', label: 'duration', align: 'right' },
    { key: 'when', label: 'when' },
    { key: 'state', label: 'publish state', render: (_, row) => renderState(row) },
  ]
}

/**
 * The home section: how many sessions are published, a one-line summary with the weekly trend,
 * the search field and the session list. `renderState` draws a row's publish state.
 */
export function HomeView({ renderState = renderPublishState, offline = false }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [project, setProject] = useState('all')
  const rows = useMemo(() => HOME_SESSIONS.filter((row) =>
    matchesFilter(row, filter)
    && (project === 'all' || row.project === project)
    && (!query.trim() || row.title.toLowerCase().includes(query.trim().toLowerCase()))), [query, filter, project])
  const columns = useMemo(() => sessionColumns(renderState), [renderState])

  return (
    <div className="iu-page">
      <header className="iu-page-head">
        <h2 className="iu-page-title">your sessions</h2>
        <p className="iu-page-sub"><span className="tnum">{HOME_SUMMARY.published}</span> of <span className="tnum">{HOME_SUMMARY.total.toLocaleString('en-US')}</span> published. the rest stay on this machine.</p>
      </header>
      {offline && <p className="iu-page-tip" role="status">stale data: last loaded <time className="tnum">14:32:05</time>. start peasant to search or filter.</p>}

      <div className="iu-page-summary">
        <StatsStrip items={HOME_SUMMARY.stats} label="your sessions in numbers" />
        <span className="iu-page-trend">
          <span className="iu-page-trend-label">sessions per week</span>
          <Sparkline type="bar" data={HOME_SUMMARY.weekly} color="teal" width={96} height={28} label="sessions per week, last 8 weeks: 13 to 25" />
        </span>
      </div>

      <p className="iu-page-tip">
        publish automatically: tick the auto-publish box the next time you publish, or run <code className="mono">/peasant auto</code> in <ProviderName harness="claude-code" />.
      </p>

      <fieldset className="iu-page-controls" aria-label="session search and filters" disabled={offline}>
      <div className="iu-page-search" role="search">
        <Input
          label="search sessions"
          type="search"
          iconLeft={Search}
          placeholder="search session titles"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="iu-page-toolbar">
        <Segmented
          label="publish state"
          value={filter}
          onChange={setFilter}
          options={HOME_FILTERS.map((option) => ({ value: option.id, label: <>{option.label} <span className="tnum">{option.count.toLocaleString('en-US')}</span></> }))}
        />
        <Select
          aria-label="project"
          value={project}
          onChange={(event) => setProject(event.target.value)}
          options={[{ value: 'all', label: 'all projects' }, ...HOME_PROJECTS.map((name) => ({ value: name, label: name }))]}
        />
      </div>
      </fieldset>

      {/* Loading more extends the cumulative window, rather than navigating pages. */}
      <fieldset className="iu-page-controls" aria-label="session table" disabled={offline}>
      <DataTable caption="sessions on this computer" columns={columns} rows={rows} rowKey={(row) => row.id} rowCount={HOME_SUMMARY.total} pagination={{ pageIndex: 0, pageSize: HOME_SUMMARY.total }} />

      <div className="iu-page-foot">
        <Button variant="secondary" size="sm">load more</Button>
      </div>
      </fieldset>
    </div>
  )
}

const demoWrite = () => new Promise((resolve) => setTimeout(resolve, 700))

/* one demo row: an instant-apply control saved per field, or a value with its one action */
function DemoSettingRow({ row }) {
  const tag = row.notInConfig ? 'not in peasant config' : undefined
  if (row.kind === 'readonly') {
    return (
      <div className="srow">
        <span className="srow-text-col">
          <span className="srow-label-line"><span className="srow-label">{row.label} {row.value}</span></span>
          {row.help && <span className="srow-help">{row.help}</span>}
        </span>
        {row.action && <Button variant="secondary" size="sm">{row.action}</Button>}
      </div>
    )
  }
  // a source is a provider: its row leads with the provider's mark
  const label = row.harness ? <ProviderName harness={row.harness} /> : row.label
  return (
    <SettingRow
      label={label}
      help={row.harness ? `${row.help} · ${row.configKey}` : row.help}
      control={row.kind}
      value={row.value}
      options={row.options}
      tag={tag}
      disabled={row.kind === 'select' && row.options?.length === 1}
      onCommit={demoWrite}
    />
  )
}

/** The settings section: every setting grouped, the summary line on top, and the files it saves to. */
export function SettingsView() {
  return (
    <SettingStatus><div className="iu-page">
      <header className="iu-page-head">
        <h2 className="iu-page-title">settings</h2>
        <p className="iu-page-sub">changes save right away. anything tagged not in peasant config can only be changed on this page.</p>
      </header>
      <StatsStrip items={SETTINGS_SUMMARY} label="settings summary" />

      {SETTINGS_GROUPS.map((group) => (
        <SettingGroup key={group.id} label={group.label} defaultOpen={group.open} description={group.description}>
          {group.rows.map((row) => <DemoSettingRow key={row.id} row={row} />)}
        </SettingGroup>
      ))}

      <SettingGroup label="files" defaultOpen count={SETTINGS_FILES.length} description="where settings are saved.">
        {SETTINGS_FILES.map((file) => (
          <div key={file.path} className="srow">
            <span className="srow-text-col">
              <span className="srow-label">{file.label}</span>
              <code className="srow-help mono">{file.path}</code>
            </span>
            <Button variant="secondary" size="sm" icon={Copy}>copy path</Button>
          </div>
        ))}
      </SettingGroup>
    </div></SettingStatus>
  )
}
