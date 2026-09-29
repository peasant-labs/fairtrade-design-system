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
  Switch,
  ProviderIcon,
  ProviderName,
  Chip,
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

const PUBLISH_STATE_TEXT = {
  'not-published': () => 'not published',
  published: (row) => `published · ${row.collectives} ${row.collectives === 1 ? 'collective' : 'collectives'}`,
  'new-turns': () => 'new turns',
  'auto-publish': (row) => `auto-publish on · ${row.collective}`,
}

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
export function HomeView({ renderState = (row) => <span className="iu-state-text">{PUBLISH_STATE_TEXT[row.state](row)}</span> }) {
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

      <div className="iu-page-search" role="search">
        <Input
          label="search transcripts"
          type="search"
          iconLeft={Search}
          placeholder="search titles, prompts, tool output"
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

      <DataTable caption="sessions on this computer" columns={columns} rows={rows} rowKey={(row) => row.id} />

      <div className="iu-page-foot">
        <span className="iu-page-count">showing <span className="tnum">{rows.length}</span> of <span className="tnum">{HOME_SUMMARY.total.toLocaleString('en-US')}</span></span>
        <Button variant="secondary" size="sm">load more</Button>
      </div>
    </div>
  )
}

function SettingControl({ row }) {
  const [value, setValue] = useState(row.value)
  if (row.kind === 'switch') {
    return <Switch id={`setting-${row.id}`} checked={value} onChange={setValue} />
  }
  if (row.kind === 'select') {
    return <Select aria-label={row.label} value={value} onChange={(event) => setValue(event.target.value)} options={row.options} disabled={row.options.length === 1} />
  }
  return <span className="iu-setting-value mono">{value}</span>
}

/** The settings section: every setting grouped, the summary line on top, and the files it saves to. */
export function SettingsView({ renderGroups }) {
  return (
    <div className="iu-page">
      <header className="iu-page-head">
        <h2 className="iu-page-title">settings</h2>
        <p className="iu-page-sub">changes save right away. anything tagged not in peasant config can only be changed on this page.</p>
      </header>
      <StatsStrip items={SETTINGS_SUMMARY} label="settings summary" />

      {renderGroups ? renderGroups(SETTINGS_GROUPS) : SETTINGS_GROUPS.map((group) => (
        <section key={group.id} className="iu-setting-group" aria-labelledby={`settings-${group.id}`}>
          <h3 className="iu-setting-group-title" id={`settings-${group.id}`}>{group.label}</h3>
          <ul className="iu-setting-rows">
            {group.rows.map((row) => (
              <li key={row.id} className="iu-setting-row">
                <span className="iu-setting-text">
                  {row.kind === 'switch'
                    ? <label className="iu-setting-label" htmlFor={`setting-${row.id}`}>{row.harness ? <ProviderName harness={row.harness} /> : row.label}</label>
                    : <span className="iu-setting-label">{row.label}</span>}
                  {row.help && <span className="iu-setting-help">{row.help}</span>}
                  {row.notInConfig && <Chip size="sm" className="iu-setting-tag">not in peasant config</Chip>}
                </span>
                <SettingControl row={row} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="iu-setting-group" aria-labelledby="settings-files">
        <h3 className="iu-setting-group-title" id="settings-files">files</h3>
        <ul className="iu-setting-rows">
          {SETTINGS_FILES.map((file) => (
            <li key={file.path} className="iu-setting-row">
              <span className="iu-setting-text">
                <span className="iu-setting-label">{file.label}</span>
                <code className="iu-setting-help mono">{file.path}</code>
              </span>
              <Button variant="secondary" size="sm" icon={Copy}>copy path</Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
