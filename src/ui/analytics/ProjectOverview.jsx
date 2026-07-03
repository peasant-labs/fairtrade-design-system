/* ProjectOverview — the configurable analytics dashboard for a project or
   collective. Accepts an AnalyticsOverviewPayload (raw session records the
   surface computes itself, or a pre-computed ProjectAnalytics bundle), renders
   the KPI tiles + chart grid + contributor table, and paints entirely from
   fairtrade tokens (`.gan-*` selectors, analytics.css). No routes, brand
   strings, fetching or app coupling: data comes through the payload, identity
   rendering is host-owned, and every section can be hidden through the typed
   section keys in types.js. */

import { useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  CircleCheck,
  GitCommitHorizontal,
  Hash,
  PieChart,
  SlidersHorizontal,
  Timer,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import ChartBar from '../ChartBar.jsx'
import ChartLine from '../ChartLine.jsx'
import ChartCard from './ChartCard.jsx'
import ContributorTable from './ContributorTable.jsx'
import { computeProjectAnalytics } from './metrics.js'
import {
  formatDuration,
  formatNumber,
  formatNumberPair,
  formatRate,
  formatTokenPair,
  formatTokens,
  shortWeek,
} from './format.js'
import { PROJECT_OVERVIEW_SECTION_DEFS, PROJECT_OVERVIEW_SECTION_KEYS } from './types.js'

/** @typedef {import('./types.js').AnalyticsOverviewPayload} AnalyticsOverviewPayload */
/** @typedef {import('./types.js').ProjectOverviewSectionKey} ProjectOverviewSectionKey */
/** @typedef {import('./types.js').ProjectOverviewSections} ProjectOverviewSections */
/** @typedef {import('./types.js').ContributorBreakdown} ContributorBreakdown */
/** @typedef {import('./types.js').ProjectAnalytics} ProjectAnalytics */

const ALL_ON = Object.fromEntries(PROJECT_OVERVIEW_SECTION_KEYS.map((key) => [key, true]))

const OUTCOME_SEGMENTS = [
  { key: 'resolved', label: 'resolved', token: 'var(--olive)' },
  { key: 'partial', label: 'partial', token: 'var(--amber)' },
  { key: 'failed', label: 'failed', token: 'var(--clay)' },
  { key: 'unknown', label: 'unknown', token: 'var(--ink-3)' },
]

const NO_SESSIONS = []

/**
 * @param {Object} props
 * @param {AnalyticsOverviewPayload} props.payload Cooked data payload — raw
 *   `sessions` (the surface computes the metrics) or a pre-computed
 *   `analytics` bundle; `analytics` wins if both are given.
 * @param {string} [props.title] Heading above the grid. Omit for a chrome-less embed.
 * @param {import('react').ReactNode} [props.subtitle] Sub-heading under the
 *   title; defaults to an auto-generated project/contributor/session summary.
 * @param {ProjectOverviewSections} [props.sections] Host-level show/hide per
 *   section. Unset keys default to ON; a host-hidden section cannot be
 *   re-enabled by the built-in toggle.
 * @param {boolean} [props.showSectionToggle] Show the built-in visible-section
 *   chip row. Default true.
 * @param {number} [props.contributorLimit] Cap rows in the contributor table.
 * @param {(row: ContributorBreakdown) => import('react').ReactNode} [props.renderContributor]
 *   Host-owned renderer for the contributor cell (name/avatar/link).
 * @param {number} [props.chartHeight] Height (px) of each chart's plotting
 *   area. Default 200.
 * @param {import('react').ReactNode} [props.footnote] Optional prose rendered
 *   at the end of the scroll region (`.gan-foot`) — page-level commentary the
 *   host wants to travel with the dashboard.
 * @param {string} [props.className]
 */
export default function ProjectOverview({
  payload,
  title,
  subtitle,
  sections,
  showSectionToggle = true,
  contributorLimit,
  renderContributor,
  chartHeight = 200,
  footnote,
  className,
}) {
  const inputSessions = payload?.sessions ?? NO_SESSIONS
  const analyticsProp = payload?.analytics
  const [userSections, setUserSections] = useState(() => ALL_ON)
  // Which series the "weekly active contributors" card plots. This is IN
  // ADDITION to the always-visible "new contributors per week" card below —
  // the dashboard shows both: the toggle lets this card's own view switch to
  // the new-contributor series without leaving it, while the standalone card
  // stays on screen as a permanent, non-toggled view of the same metric.
  const [weeklyView, setWeeklyView] = useState('active')

  const baseSections = useMemo(() => ({ ...ALL_ON, ...sections }), [sections])

  const show = useMemo(
    () =>
      Object.fromEntries(
        PROJECT_OVERVIEW_SECTION_KEYS.map((key) => [key, baseSections[key] && userSections[key]]),
      ),
    [baseSections, userSections],
  )

  const data = useMemo(
    () => analyticsProp ?? computeProjectAnalytics(inputSessions),
    [analyticsProp, inputSessions],
  )

  const defaultSubtitle = useMemo(
    () => overviewSubtitle(inputSessions, data),
    [data, inputSessions],
  )

  const visibleSubtitle = subtitle ?? defaultSubtitle
  const outcomeTotal = data.outcomeDistribution.total
  const totalCommits = data.perContributorBreakdown.reduce(
    (sum, row) => sum + row.totalCommits,
    0,
  )
  // A host that hides the new-contributor section also removes the "new"
  // option from the toggle — a host-hidden section stays un-selectable, same
  // rule as the visible-section chips below.
  const effectiveWeeklyView = show.newContributorVelocity ? weeklyView : 'active'

  const setSection = (key) => {
    setUserSections((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <div className={['gan-root', className].filter(Boolean).join(' ')}>
      {title != null || visibleSubtitle != null || showSectionToggle ? (
        <div className="gan-head">
          <div className="gan-head-titles">
            {title != null ? <h2 className="gan-h2">{title}</h2> : null}
            {visibleSubtitle != null ? <div className="gan-sub">{visibleSubtitle}</div> : null}
          </div>
          {showSectionToggle ? (
            <SectionToggle
              baseSections={baseSections}
              sections={show}
              userSections={userSections}
              onToggle={setSection}
            />
          ) : null}
        </div>
      ) : null}

      <div className="gan-scroll">
        {show.summary ? (
          <div className="gan-kpis" role="list" aria-label="headline metrics">
            <StatTile
              icon={Activity}
              label="sessions"
              value={formatNumber(data.totalSessions)}
              hint="recorded"
            />
            <StatTile
              icon={Users}
              label="contributors"
              value={formatNumber(data.totalContributors)}
              hint={contributorHint(data.perContributorBreakdown)}
            />
            <StatTile
              icon={TrendingUp}
              label="returning rate"
              value={formatRate(data.returningContributorRate.rate)}
              hint={`${formatNumber(data.returningContributorRate.returning)} of ${formatNumber(data.returningContributorRate.total)}`}
            />
            <StatTile
              icon={GitCommitHorizontal}
              label="session → commit"
              value={formatRate(data.sessionToCommitRate.rate)}
              hint={`${formatNumber(data.sessionToCommitRate.withCommit)} of ${formatNumber(data.sessionToCommitRate.total)}`}
            />
            <StatTile
              icon={CircleCheck}
              label="longest streak"
              value={`${formatNumber(data.longestStreak.weeks)} wk`}
              hint={
                data.longestStreak.startWeek == null
                  ? undefined
                  : `from ${data.longestStreak.startWeek}`
              }
            />
            <StatTile
              icon={Hash}
              label="projects"
              value={formatNumber(data.totalProjects)}
              hint={projectHint(inputSessions, data.totalProjects)}
            />
          </div>
        ) : null}

        <div className="gan-grid">
          {show.sessionsPerWeek ? (
            <ChartCard
              icon={BarChart3}
              title="sessions per week"
              subtitle="agent sessions bucketed by iso week"
              aside={`${formatNumber(data.totalSessions)} total`}
            >
              <ChartBar
                data={chartRows(weekPoints(data.sessionsPerWeek, 'count'))}
                xKey="label"
                series={[{ key: 'value', name: 'sessions', color: 'amber' }]}
                height={chartHeight}
                valueFormatter={formatNumber}
              />
            </ChartCard>
          ) : null}

          {show.weeklyActiveContributors ? (
            <ChartCard
              icon={Users}
              title="weekly active contributors"
              subtitle={
                effectiveWeeklyView === 'new'
                  ? 'first-ever appearance per week'
                  : 'distinct contributors active each week'
              }
              aside={
                effectiveWeeklyView === 'new'
                  ? `${formatNumber(sumValues(weekPoints(data.newContributorVelocity, 'newContributors')))} new`
                  : `${formatNumber(sumValues(weekPoints(data.weeklyActiveContributors, 'contributors')))} active`
              }
            >
              <WeeklyMetricToggle
                view={effectiveWeeklyView}
                canShowNew={Boolean(show.newContributorVelocity)}
                onChange={setWeeklyView}
              />
              {effectiveWeeklyView === 'new' ? (
                <ChartLine
                  data={chartRows(weekPoints(data.newContributorVelocity, 'newContributors'))}
                  xKey="label"
                  series={[{ key: 'value', name: 'new contributors', color: 'olive', area: true }]}
                  height={chartHeight}
                  valueFormatter={formatNumber}
                />
              ) : (
                <ChartLine
                  data={chartRows(weekPoints(data.weeklyActiveContributors, 'contributors'))}
                  xKey="label"
                  series={[{ key: 'value', name: 'active contributors', color: 'teal', area: true }]}
                  height={chartHeight}
                  valueFormatter={formatNumber}
                />
              )}
            </ChartCard>
          ) : null}

          {show.newContributorVelocity ? (
            <ChartCard
              icon={UserPlus}
              title="new contributors per week"
              subtitle="acquisition signal · first appearance"
              aside={`${formatNumber(sumValues(weekPoints(data.newContributorVelocity, 'newContributors')))} new`}
            >
              <ChartBar
                data={chartRows(weekPoints(data.newContributorVelocity, 'newContributors'))}
                xKey="label"
                series={[{ key: 'value', name: 'new contributors', color: 'olive' }]}
                height={chartHeight}
                valueFormatter={formatNumber}
              />
            </ChartCard>
          ) : null}

          {show.avgDurationPerActiveWeek ? (
            <ChartCard
              icon={Timer}
              title="avg duration per active week"
              subtitle="minutes"
              aside={`${formatDuration(avgValue(weekPoints(data.avgDurationPerActiveWeek, 'avgDurationMins')))} avg`}
            >
              <ChartLine
                data={chartRows(weekPoints(data.avgDurationPerActiveWeek, 'avgDurationMins'))}
                xKey="label"
                series={[{ key: 'value', name: 'minutes', color: 'amber' }]}
                height={chartHeight}
                valueFormatter={formatNumber}
              />
            </ChartCard>
          ) : null}

          {show.outcomeDistribution ? (
            <ChartCard
              icon={PieChart}
              title="outcome distribution"
              subtitle="share of session outcomes"
              aside={`${formatNumber(outcomeTotal)} total`}
            >
              <OutcomeDonut data={data.outcomeDistribution} />
            </ChartCard>
          ) : null}

          {show.sessionStats ? (
            <ChartCard icon={Activity} title="typical vs. tail" subtitle="median · p90" aside="per session">
              <TypicalStats data={data.sessionStats} />
            </ChartCard>
          ) : null}
        </div>

        {show.contributorTable ? (
          <ChartCard
            icon={Users}
            title="contributors"
            subtitle="rolled up · sorted by session volume"
            aside={`${formatNumber(data.perContributorBreakdown.length)} people`}
            className="gan-tablecard"
          >
            <ContributorTable
              rows={data.perContributorBreakdown}
              limit={contributorLimit}
              renderContributor={renderContributor}
            />
            <div className="gan-table-foot">
              <span className="metaitem">
                <Hash aria-hidden="true" /> totals <b>{formatNumber(data.totalSessions)}</b> sessions
              </span>
              <span className="metaitem">
                <Hash aria-hidden="true" /> <b>{formatTokens(totalTokens(data.perContributorBreakdown))}</b> tokens
              </span>
              <span className="metaitem">
                <GitCommitHorizontal aria-hidden="true" /> <b>{formatNumber(totalCommits)}</b> commits
              </span>
            </div>
          </ChartCard>
        ) : null}

        {footnote != null ? <p className="gan-foot">{footnote}</p> : null}
      </div>
    </div>
  )
}

function SectionToggle({ baseSections, sections, userSections, onToggle }) {
  const visible = PROJECT_OVERVIEW_SECTION_DEFS.filter((section) => sections[section.key]).length

  return (
    <div className="gan-toggle" role="group" aria-label="visible sections">
      <span className="gan-toggle-lab">
        <SlidersHorizontal className="lucide" aria-hidden="true" /> sections
        <b className="tnum">
          {visible}/{PROJECT_OVERVIEW_SECTION_DEFS.length}
        </b>
      </span>
      <div className="gan-toggle-chips">
        {PROJECT_OVERVIEW_SECTION_DEFS.map((section) => {
          const hostEnabled = baseSections[section.key]
          const pressed = hostEnabled && userSections[section.key]
          return (
            <button
              key={section.key}
              type="button"
              className={['gan-seg', pressed && 'is-on'].filter(Boolean).join(' ')}
              // "active"/"new" here collide, by visible text, with the
              // weekly-active-contributors card's own active|new view toggle
              // (WeeklyMetricToggle) — a DIFFERENT control (switches that one
              // card's plotted series; this chip shows/hides a whole section).
              // Disambiguate the ACCESSIBLE name with a "section" suffix
              // (applied to every chip, not just the colliding two, so the
              // rule is uniform) while the visible label stays exactly the
              // section name.
              aria-label={`${section.label} section`}
              aria-pressed={pressed}
              disabled={!hostEnabled}
              onClick={() => onToggle(section.key)}
            >
              {section.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* Two-state segmented control switching the "weekly active contributors" card
   between the active-contributor series and the new-contributor series.
   Rendered at the top of the card body (above the plot, per the demo), with
   the card's aside staying the summary figure. Distinct markup/class from the
   visible-section chips (`.gan-mini` inside `.gan-card-toolbar`, not
   `.gan-seg`) — this toggle selects WHICH DATA a single card plots; the
   section chips select WHICH CARDS render at all. A host-hidden "new
   contributors" section (canShowNew=false) disables the "new" option the same
   way a host-hidden section chip stays un-selectable. */
function WeeklyMetricToggle({ view, canShowNew, onChange }) {
  return (
    <div className="gan-card-toolbar" role="group" aria-label="series">
      <button
        type="button"
        className={['gan-mini', view === 'active' && 'is-on'].filter(Boolean).join(' ')}
        aria-pressed={view === 'active'}
        onClick={() => onChange('active')}
      >
        active
      </button>
      <button
        type="button"
        className={['gan-mini', view === 'new' && 'is-on'].filter(Boolean).join(' ')}
        aria-pressed={view === 'new'}
        disabled={!canShowNew}
        onClick={() => onChange('new')}
      >
        new
      </button>
    </div>
  )
}

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="gan-tile" role="listitem">
      <span className="gan-tile-lab">
        <Icon className="lucide" aria-hidden="true" /> {label}
      </span>
      <span className="gan-tile-val tnum">{value}</span>
      {hint != null ? <span className="gan-tile-hint">{hint}</span> : null}
    </div>
  )
}

/* Adapt weekly metric rows into the row shape ChartBar/ChartLine expect. */
function chartRows(points) {
  return points.map((point) => ({ label: point.label, value: point.value }))
}

/* Donut with the demo's hover model: hovering (or focusing) a slice dims the
   others and swaps the center number/label to that slice; legend rows
   hover-sync with their slice. Ring geometry mirrors the demo's path arcs
   (outer 78 / inner 49, small radian gap between slices, hairline seam). */
function OutcomeDonut({ data }) {
  const [hot, setHot] = useState(null)
  const total = data.total
  if (total === 0) {
    return <div className="gan-donut-empty">no outcome data.</div>
  }

  const slices = OUTCOME_SEGMENTS
    .map((segment) => ({ ...segment, value: data[segment.key] }))
    .filter((slice) => slice.value > 0)

  const cx = 90
  const cy = 90
  const rOuter = 78
  const rInner = 49
  const gap = 0.045 // radians of padding between slices

  let acc = -Math.PI / 2
  const arcs = slices.map((slice) => {
    const frac = slice.value / total
    const start = acc + gap / 2
    const end = acc + frac * Math.PI * 2 - gap / 2
    acc += frac * Math.PI * 2
    const large = end - start > Math.PI ? 1 : 0
    const point = (r, angle) => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
    const [x1, y1] = point(rOuter, start)
    const [x2, y2] = point(rOuter, end)
    const [x3, y3] = point(rInner, end)
    const [x4, y4] = point(rInner, start)
    const d = `M${x1} ${y1} A${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`
    return { ...slice, d, frac }
  })

  return (
    <div className="gan-donut">
      <svg
        className="gan-donut-svg"
        viewBox="0 0 180 180"
        role="img"
        aria-label={`outcome distribution across ${formatNumber(total)} sessions`}
      >
        {arcs.map((arc, i) => (
          <path
            key={arc.key}
            d={arc.d}
            fill={arc.token}
            stroke="var(--surface)"
            strokeWidth="1.5"
            opacity={hot == null || hot === i ? 1 : 0.4}
            className="gan-slice"
            tabIndex={0}
            role="img"
            aria-label={`${arc.label}, ${formatNumber(arc.value)} sessions, ${formatRate(arc.frac)}`}
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot((h) => (h === i ? null : h))}
            onFocus={() => setHot(i)}
            onBlur={() => setHot((h) => (h === i ? null : h))}
          />
        ))}
        <text x="90" y="84" className="gan-donut-num tnum" textAnchor="middle">
          {hot != null ? formatNumber(slices[hot].value) : formatNumber(total)}
        </text>
        <text x="90" y="104" className="gan-donut-lab" textAnchor="middle">
          {hot != null ? slices[hot].label : 'sessions'}
        </text>
      </svg>
      <ul className="gan-legend">
        {OUTCOME_SEGMENTS.map((segment) => {
          const value = data[segment.key]
          const pct = total === 0 ? 0 : value / total
          const idx = slices.findIndex((slice) => slice.key === segment.key)
          return (
            <li
              key={segment.key}
              className={['gan-legend-row', hot === idx && idx >= 0 && 'is-hot'].filter(Boolean).join(' ')}
              onMouseEnter={() => idx >= 0 && setHot(idx)}
              onMouseLeave={() => setHot(null)}
            >
              <span className="gan-legend-sw" style={{ background: segment.token }} aria-hidden="true" />
              <span className="gan-legend-nm">{segment.label}</span>
              <span className="gan-legend-v tnum">{formatNumber(value)}</span>
              <span className="gan-legend-pct tnum">{formatRate(pct)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TypicalStats({ data }) {
  // Numeric pairs render with MATCHED precision (identical-precision rule:
  // "8.0 · 19.2", never "8 · 19.2"); token pairs also share one unit.
  const [tokensMedian, tokensP90] = formatTokenPair(data.totalTokens.median, data.totalTokens.p90)
  const [turnsMedian, turnsP90] = formatNumberPair(data.turnCount.median, data.turnCount.p90)
  const [toolsMedian, toolsP90] = formatNumberPair(data.toolCallCount.median, data.toolCallCount.p90)
  return (
    <div className="gan-typical">
      <StatRow
        label="duration"
        median={formatDuration(data.durationMins.median)}
        p90={formatDuration(data.durationMins.p90)}
      />
      <StatRow label="tokens" median={tokensMedian} p90={tokensP90} />
      <StatRow label="turns" median={turnsMedian} p90={turnsP90} />
      <StatRow label="tool calls" median={toolsMedian} p90={toolsP90} />
    </div>
  )
}

function StatRow({ label, median, p90 }) {
  return (
    <div className="gan-typrow">
      <span className="gan-typlab">{label}</span>
      <span className="gan-typvals">
        <span className="gan-typmed tnum">{median}</span>
        <span className="gan-typsep" aria-hidden="true">·</span>
        <span className="gan-typp90 tnum">{p90}</span>
      </span>
    </div>
  )
}

function overviewSubtitle(sessions, data) {
  return [
    projectHint(sessions, data.totalProjects),
    `${formatNumber(data.totalContributors)} ${plural(data.totalContributors, 'contributor', 'contributors')}`,
    `${formatNumber(data.totalSessions)} ${plural(data.totalSessions, 'session', 'sessions')} across ${formatNumber(data.sessionsPerWeek.length)} ${plural(data.sessionsPerWeek.length, 'week', 'weeks')}`,
  ].join(' · ')
}

function projectHint(sessions, totalProjects) {
  const projects = [...new Set(sessions.map((session) => session.projectKey).filter(Boolean))].sort()
  if (projects.length === 0) {
    return totalProjects === 0
      ? 'no projects'
      : `${formatNumber(totalProjects)} ${plural(totalProjects, 'project', 'projects')}`
  }
  if (projects.length === 1) return projects[0]
  if (projects.length <= 3) return projects.join(', ')
  return `${formatNumber(projects.length)} projects`
}

function contributorHint(rows) {
  if (rows.length === 0) return 'none'
  const names = rows.slice(0, 3).map((row) => row.contributorId)
  return rows.length > 3 ? `${names.join(', ')} +${rows.length - 3}` : names.join(', ')
}

function plural(count, one, many) {
  return count === 1 ? one : many
}

function weekPoints(rows, valueKey) {
  return rows.map((row) => ({
    key: row.week,
    label: shortWeek(row.week),
    value: numeric(row[valueKey]),
  }))
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function sumValues(points) {
  return points.reduce((sum, point) => sum + point.value, 0)
}

function avgValue(points) {
  if (points.length === 0) return null
  return sumValues(points) / points.length
}

function totalTokens(rows) {
  return rows.reduce((sum, row) => sum + row.totalTokens, 0)
}
