import { useMemo, useState } from 'react'
import { Star, GitMerge, ChevronDown } from 'lucide-react'
import { ProviderName } from './ProviderIcon.jsx'
import './CommitGraph.css'

/* CommitGraph — a source-control history rendered as a commit graph, ported in intent from
   peasant's ChangeGraph. Time flows down (newest first). The left SVG gutter draws vertical
   lane lines plus 90° elbow connectors for forks and merges; the right side is a column of
   button rows carrying the commit message (user content, case preserved) and meta.

   DESIGN_SYSTEM (fairtrade): square everything — orthogonal 90° elbows only, no curves, no
   per-lane HUE. Lanes are told apart by INK WEIGHT and dash pattern, never colour: lane 0 +
   commit edges stroke var(--rule-strong); branch lanes stroke var(--rule); merge stubs are
   dashed var(--rule). A commit node is a square dot — FILLED (amber when selected, else ink)
   if a recorded session is behind it, HOLLOW (border only) otherwise — and a session also flies
   a tiny sparkle so the signal never rides on fill alone. The single sanctioned accent is amber,
   scarce, for the active/selected row. tokens only, hairline, mono, calm. */

// --- Lane geometry (px; kept here, not in CSS, because the SVG needs the raw numbers) -------

const LANE_W = 14 // horizontal pitch between lanes
const GUTTER_PAD = 9 // left inset of lane 0
const GUTTER_TAIL = 7 // breathing room after the last lane before the content column
const DOT = 9 // commit dot side
const DASH = '3 3'

const laneX = (lane) => GUTTER_PAD + lane * LANE_W
const gutterWidth = (laneCount) => laneX(Math.max(laneCount - 1, 0)) + GUTTER_TAIL

/**
 * @typedef {object} Commit
 * @property {string} id - stable key (e.g. short hash)
 * @property {number} lane - 0 = main line; >0 = a branch lane
 * @property {string[]} [parents] - parent commit ids (>1 = a merge commit)
 * @property {string} message - the commit subject (USER CONTENT — case preserved)
 * @property {string} [branch] - branch name for the chip (USER CONTENT — case preserved)
 * @property {boolean} [session] - a recorded AI session sits behind this commit (-> filled + sparkle)
 * @property {import('./graph/types.js').TimelineSessionPayload[]} [sessionRefs] - named sessions bound to this commit
 * @property {boolean} [merged] - this commit merged a branch back in (-> merged chip)
 * @property {boolean} [tip] - this commit is a branch tip (-> small tip affordance)
 * @property {string} [time] - relative time label (e.g. "8m ago") — already humanised by the caller
 */

/**
 * CommitGraph — render `commits` (newest first) as a lane gutter + a column of selectable rows.
 *
 * @param {object} props
 * @param {Commit[]} props.commits - the history, newest first; lane 0 is the main line.
 * @param {string} [props.selectedId] - id of the active/selected row (the scarce amber treatment).
 * @param {(action: import('./graph/timelineNavigation.js').TimelineNavigationAction) => void} [props.onNavigate] - canonical semantic action callback; when present, legacy callbacks do not fire.
 * @param {(commit: Commit) => void} [props.onSelect] - deprecated legacy row callback; use onNavigate.
 * @param {(sessionId: string) => void} [props.onOpenSession] - deprecated legacy session callback; use onNavigate.
 * @param {boolean} [props.hasMore=false] - more history exists below the window -> show the "show older" ghost.
 * @param {() => void} [props.onShowOlder] - deprecated legacy pagination callback; use onNavigate.
 * @param {string} [props.label='commit history'] - accessible name for the list (lowercase chrome).
 * @param {string} [props.className] - extra classes appended to the root.
 */
export default function CommitGraph({
  commits = [],
  selectedId,
  onNavigate,
  onSelect,
  onOpenSession,
  hasMore = false,
  onShowOlder,
  label = 'commit history',
  className = '',
  ...rest
}) {
  // Lane count drives the gutter width; one extra lane of room past the highest index.
  const laneCount = useMemo(
    () => commits.reduce((max, c) => Math.max(max, (c.lane ?? 0) + 1), 1),
    [commits],
  )

  // Per-row connector plan. The graph is implicit in `lane` + `parents`: a row whose parent
  // lives on a different lane elbows out of that parent's lane (a fork below it, a merge above
  // it). We resolve each parent's lane once so the gutter can draw the 90° joins.
  const rows = useMemo(() => {
    const laneById = new Map(commits.map((c) => [c.id, c.lane ?? 0]))
    // Which lanes are "live" (have a vertical passing THROUGH this band)? A lane is live from
    // its first appearance to its last, so a fork/merge into lane 0 still shows lane 0 running.
    const firstSeen = new Map()
    const lastSeen = new Map()
    commits.forEach((c, i) => {
      const lane = c.lane ?? 0
      if (!firstSeen.has(lane)) firstSeen.set(lane, i)
      lastSeen.set(lane, i)
    })

    return commits.map((c, i) => {
      const lane = c.lane ?? 0
      const parents = c.parents ?? []
      // Connectors to parents on OTHER lanes (the elbows). Same-lane parents are just the
      // straight vertical drawn by the pass-through logic, so they need no elbow.
      const joins = parents
        .map((pid) => laneById.get(pid))
        .filter((pl) => pl !== undefined && pl !== lane)
        .map((pl) => ({ from: lane, to: pl }))

      // Lanes (other than this row's) that have a vertical running through this band.
      const passLanes = []
      for (const [l, first] of firstSeen) {
        if (l === lane) continue
        if (i >= first && i <= lastSeen.get(l)) passLanes.push(l)
      }

      const lastIdx = lastSeen.get(lane)
      const firstIdx = firstSeen.get(lane)
      return {
        commit: c,
        lane,
        joins,
        passLanes,
        laneUp: i > firstIdx, // vertical above the dot (an earlier commit shares this lane)
        laneDown: i < lastIdx, // vertical below the dot (a later commit shares this lane)
      }
    })
  }, [commits])

  const width = gutterWidth(laneCount)
  const cls = ['cg', className].filter(Boolean).join(' ')

  if (commits.length === 0) {
    return (
      <div className={cls} {...rest}>
        <p className="cg-empty">no commits to show.</p>
      </div>
    )
  }

  return (
    <div className={cls} role="list" aria-label={label} {...rest}>
      {rows.map((row) => (
        <CommitRow
          key={row.commit.id}
          row={row}
          width={width}
          selected={row.commit.id === selectedId}
          onNavigate={onNavigate}
          onSelect={onSelect}
          onOpenSession={onOpenSession}
        />
      ))}

      {hasMore && (
        <div className="cg-older-band">
          <span className="cg-gutter cg-gutter-older" style={{ width }} aria-hidden="true">
            <svg className="cg-svg" width={width} height="100%" preserveAspectRatio="none">
              <line
                className="cg-stroke-lane0"
                x1={laneX(0)}
                y1="0"
                x2={laneX(0)}
                y2="60%"
                strokeDasharray={DASH}
              />
            </svg>
          </span>
          <button
            type="button"
            className="cg-older"
            onClick={() => {
              if (onNavigate) onNavigate({ type: 'show-older' })
              else onShowOlder?.()
            }}
          >
            <ChevronDown className="cg-older-ic" aria-hidden="true" />
            show older
          </button>
        </div>
      )}
    </div>
  )
}

/** One commit: the lane gutter (SVG strokes + the HTML square dot) and the button row. */
function CommitRow({ row, width, selected, onNavigate, onSelect, onOpenSession }) {
  const { commit, lane, joins, passLanes, laneUp, laneDown } = row
  const hasSession = Boolean(commit.session)

  const dotCls = [
    'cg-dot',
    hasSession ? 'cg-dot-filled' : 'cg-dot-hollow',
    selected && 'cg-dot-sel',
  ]
    .filter(Boolean)
    .join(' ')

  const rowCls = ['cg-row', selected && 'cg-row-sel'].filter(Boolean).join(' ')

  return (
    <div className="cg-band" role="listitem">
      {/* Lane gutter: SVG draws lines only; the dot is an HTML square positioned over lane X. */}
      <span className="cg-gutter" style={{ width }} aria-hidden="true">
        <svg className="cg-svg" width={width} height="100%" preserveAspectRatio="none">
          {/* This lane's own vertical, split around the dot so up/down can be absent at a tip. */}
          {laneUp && (
            <line className="cg-stroke-self" x1={laneX(lane)} y1="0" x2={laneX(lane)} y2="50%" />
          )}
          {laneDown && (
            <line
              className="cg-stroke-self"
              x1={laneX(lane)}
              y1="50%"
              x2={laneX(lane)}
              y2="100%"
            />
          )}

          {/* Pass-through verticals for other live lanes (branch lanes -> lighter weight). */}
          {passLanes.map((l) => (
            <line
              key={l}
              className={l === 0 ? 'cg-stroke-lane0' : 'cg-stroke-branch'}
              x1={laneX(l)}
              y1="0"
              x2={laneX(l)}
              y2="100%"
            />
          ))}

          {/* Elbows to parents on other lanes: down the parent lane to mid-band, then across
              to this dot. 90° square joins only — no curves. */}
          {joins.map((j, k) => (
            <g key={k} className="cg-elbow">
              <line
                className="cg-stroke-branch"
                x1={laneX(j.to)}
                y1="50%"
                x2={laneX(j.to)}
                y2="100%"
              />
              <line
                className="cg-stroke-branch"
                x1={laneX(j.to)}
                y1="50%"
                x2={laneX(j.from)}
                y2="50%"
              />
            </g>
          ))}
        </svg>

        {/* The square commit dot. Filled (a session is behind it) vs hollow (plain commit). */}
        <span
          className={dotCls}
          style={{ left: laneX(lane), width: DOT, height: DOT }}
          data-has-session={hasSession || undefined}
        />
        {/* Redundant, non-colour session signal: a tiny 5-point star pinned to the dot
            (a 4-point sparkle read as a plus at this size). */}
        {hasSession && (
          <Star className="cg-spark" style={{ left: laneX(lane) }} aria-hidden="true" />
        )}
      </span>

      <div className="cg-content">
        <button
          type="button"
          className={rowCls}
          onClick={() => {
            if (onNavigate) {
              onNavigate({
                type: 'open-change',
                change: { id: commit.id, branch: commit.branch ?? null },
              })
            } else onSelect?.(commit)
          }}
        >
          <span className="cg-msg" title={commit.message}>
            {commit.message}
          </span>

          <span className="cg-meta">
            {commit.merged && (
              <span className="cg-merged">
                <GitMerge className="cg-merged-ic" aria-hidden="true" />
                merged
              </span>
            )}
            {commit.tip && <span className="cg-tip">tip</span>}
            {commit.branch && <span className="cg-branch">{commit.branch}</span>}
            {hasSession && <span className="cg-sr">session</span>}
            {commit.time && <span className="cg-time tnum">{commit.time}</span>}
          </span>
        </button>

        {commit.sessionRefs?.length > 0 && (
          <div className="cg-sessions" role="group" aria-label={`sessions linked to ${commit.message}`}>
            {commit.sessionRefs.map((session) => (
              <button
                key={session.sessionId}
                type="button"
                className="cg-session"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate({
                      type: 'open-session',
                      sessionId: session.sessionId,
                      source: {
                        kind: 'commit',
                        commit: { id: commit.id, branch: commit.branch ?? null },
                      },
                    })
                  } else onOpenSession?.(session.sessionId)
                }}
              >
                <ProviderName harness={session.harness} />
                <span className="cg-session-title">{session.title || session.sessionId}</span>
                {session.startMs != null && (
                  <time className="cg-session-time tnum" dateTime={new Date(session.startMs).toISOString()}>
                    {new Date(session.startMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase()}
                  </time>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
