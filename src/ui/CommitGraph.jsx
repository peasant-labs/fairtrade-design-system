import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Star, GitMerge, ChevronDown } from 'lucide-react'
import { ProviderName } from './ProviderIcon.jsx'
import SessionLane from './graph/SessionLane.jsx'
import GhostGroup from './graph/GhostGroup.jsx'
import SessionOverflowDisclosure from './graph/SessionOverflowDisclosure.jsx'
import HighlightEdge from './graph/HighlightEdge.jsx'
import TouchedFileCluster from './graph/TouchedFileCluster.jsx'
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
 * @param {Array<{sessionId:string, title:string, harness?:import('@peasant-labs/schema').Harness}>} [props.sessionLanes] - the timeline's session spine gutter (the session spine gutter). Omit to keep the pre-timeline layout unchanged.
 * @param {string|null} [props.hoveredSessionId] - drives the SessionLane hover state + secondary highlight weight.
 * @param {string|null} [props.selectedSessionId] - drives the SessionLane selected state + primary highlight weight.
 * @param {(sessionId: string|null) => void} [props.onHoverSession]
 * @param {(sessionId: string) => void} [props.onSelectSession]
 * @param {import('./graph/codeMapState.js').TimelineHighlight} [props.highlightSelected] - `deriveTimelineHighlight(...).selected` commit ids to render at primary (amber) weight.
 * @param {import('./graph/codeMapState.js').TimelineHighlight} [props.highlightHovered] - `deriveTimelineHighlight(...).hovered` commit ids to render at secondary weight.
 * @param {Record<string, Array<{ghostHash:string, subject?:string, resolution:string, method:string, confidence:string}>>} [props.ghostGroupsByCommit] - keyed by the successor commit id; each renders a `GhostGroup` row directly beneath it.
 * @param {string[]|Set<string>} [props.expandedGhostGroups] - successor hashes with their ghost group open; controlled by the caller's `toggle-ghost-group` reducer state.
 * @param {(successorHash: string) => void} [props.onToggleGhostGroup]
 * @param {string[]|Set<string>} [props.expandedCommitSessions] - commit hashes with the `+N more` session disclosure open; controlled by the caller's `toggle-commit-sessions` reducer state.
 * @param {(commitHash: string) => void} [props.onToggleCommitSessions]
 * @param {Record<string, string[]>} [props.touchedFilesByCommit] - deterministically ordered file paths keyed by commit id.
 * @param {(file: string) => void} [props.onOpenTouchedFile]
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
  sessionLanes,
  hoveredSessionId = null,
  selectedSessionId = null,
  onHoverSession,
  onSelectSession,
  highlightSelected,
  highlightHovered,
  ghostGroupsByCommit,
  expandedGhostGroups,
  onToggleGhostGroup,
  expandedCommitSessions,
  onToggleCommitSessions,
  touchedFilesByCommit,
  onOpenTouchedFile,
  ...rest
}) {
  const expandedGhostSet = useMemo(() => new Set(expandedGhostGroups ?? []), [expandedGhostGroups])
  const expandedSessionSet = useMemo(() => new Set(expandedCommitSessions ?? []), [expandedCommitSessions])
  const primaryHighlighted = useMemo(() => new Set([...(highlightSelected?.commitHashes ?? []), ...(highlightSelected?.ghostHashes ?? [])]), [highlightSelected])
  const secondaryHighlighted = useMemo(() => new Set([...(highlightHovered?.commitHashes ?? []), ...(highlightHovered?.ghostHashes ?? [])]), [highlightHovered])
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

  const highlightCandidates = useMemo(() => {
    const commitIds = new Set(rows.map((row) => row.commit.id))
    const sessionIds = new Set((sessionLanes ?? []).map((session) => session.sessionId))
    const candidates = [
      ...(highlightSelected?.edges ?? []).map((edge) => ({ ...edge, weight: 'primary' })),
      ...(highlightHovered?.edges ?? []).map((edge) => ({ ...edge, weight: 'secondary' })),
    ]
    const seen = new Set()
    return candidates.flatMap((edge) => {
      if (edge.ghost) return []
      const key = `${edge.sessionId}:${edge.commitHash}`
      if (!commitIds.has(edge.commitHash) || !sessionIds.has(edge.sessionId) || seen.has(key)) return []
      seen.add(key)
      return [{
        ...edge,
        key,
        weight: /** @type {'primary'|'secondary'} */ (edge.weight),
      }]
    })
  }, [rows, sessionLanes, highlightSelected, highlightHovered])
  const rootRef = useRef(null)
  const [mountedHighlightEdges, setMountedHighlightEdges] = useState([])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || highlightCandidates.length === 0) {
      setMountedHighlightEdges([])
      return
    }
    const measure = () => {
      const history = root.querySelector('.cg-history')
      if (!history) return
      const historyBox = history.getBoundingClientRect()
      const sessions = new Map([...root.querySelectorAll('[data-timeline-session-id]')].map((element) => [element.getAttribute('data-timeline-session-id'), element]))
      const commits = new Map([...root.querySelectorAll('.cg-history-row[data-commit-hash]')].map((element) => [element.getAttribute('data-commit-hash'), element]))
      const measured = highlightCandidates.flatMap((edge) => {
        const sourceBox = sessions.get(edge.sessionId)?.getBoundingClientRect()
        const targetBox = commits.get(edge.commitHash)?.querySelector('.cg-dot')?.getBoundingClientRect()
        if (!sourceBox || !targetBox) return []
        return [{
          ...edge,
          geometry: {
            x1: sourceBox.left + sourceBox.width / 2 - historyBox.left,
            y1: sourceBox.bottom - historyBox.top,
            x2: targetBox.left + targetBox.width / 2 - historyBox.left,
            y2: targetBox.top + targetBox.height / 2 - historyBox.top,
          },
        }]
      })
      setMountedHighlightEdges(measured)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [highlightCandidates])

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
    <div ref={rootRef} className={cls} role="list" aria-label={label} {...rest}>
      {sessionLanes && sessionLanes.length > 0 && (
        <div className="cg-session-spine" role="group" aria-label="recorded sessions" style={{ gridTemplateColumns: `repeat(${sessionLanes.length}, minmax(0, 1fr))` }}>
          {sessionLanes.map((session) => (
            <SessionLane
              key={session.sessionId}
              sessionId={session.sessionId}
              title={session.title}
              harness={session.harness}
              hovered={hoveredSessionId === session.sessionId}
              selected={selectedSessionId === session.sessionId}
              onHover={onHoverSession}
              onSelect={onSelectSession}
              unresolvedGhosts={session.unresolvedGhosts}
              data-timeline-session-id={session.sessionId}
            />
          ))}
        </div>
      )}
      <div className="cg-history">
        {mountedHighlightEdges.length > 0 && (
          <svg
            className="cg-highlight-layer"
            aria-hidden="true"
          >
            {mountedHighlightEdges.map((edge) => (
              <HighlightEdge
                key={edge.key}
                weight={edge.weight}
                geometry={edge.geometry}
                data-session-id={edge.sessionId}
                data-commit-hash={edge.commitHash}
              />
            ))}
          </svg>
        )}
        {rows.map((row) => (
          <div key={row.commit.id} className="cg-history-row" data-commit-hash={row.commit.id}>
            <CommitRow
              row={row}
              width={width}
              selected={row.commit.id === selectedId}
              onNavigate={onNavigate}
              onSelect={onSelect}
              onOpenSession={onOpenSession}
              highlightWeight={primaryHighlighted.has(row.commit.id) ? 'primary' : secondaryHighlighted.has(row.commit.id) ? 'secondary' : null}
              expandedSessions={expandedSessionSet.has(row.commit.id)}
              onToggleSessions={onToggleCommitSessions}
              touchedFiles={touchedFilesByCommit?.[row.commit.id] ?? []}
              expandedFiles={expandedSessionSet.has(`files:${row.commit.id}`)}
              onOpenTouchedFile={onOpenTouchedFile}
            />
            {ghostGroupsByCommit?.[row.commit.id] && (
              <div className="cg-ghost-row" style={{ marginLeft: width }}>
                <GhostGroup
                  successorHash={row.commit.id}
                  ghosts={ghostGroupsByCommit[row.commit.id]}
                  expanded={expandedGhostSet.has(row.commit.id)}
                  onToggle={onToggleGhostGroup}
                />
              </div>
            )}
          </div>
        ))}
      </div>

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
function CommitRow({ row, width, selected, onNavigate, onSelect, onOpenSession, highlightWeight = null, expandedSessions = false, onToggleSessions, touchedFiles = [], expandedFiles = false, onOpenTouchedFile }) {
  const { commit, lane, joins, passLanes, laneUp, laneDown } = row
  const hasSession = Boolean(commit.session)

  const dotCls = [
    'cg-dot',
    hasSession ? 'cg-dot-filled' : 'cg-dot-hollow',
    selected && 'cg-dot-sel',
    // Hover/select highlight: stroke width-step floor (both motion
    // states) + an additive normal-motion-only glow, layered ON TOP of the
    // session/selection encoding above, never replacing it.
    highlightWeight && `cg-dot-highlight-${highlightWeight}`,
  ]
    .filter(Boolean)
    .join(' ')

  const inlineSessions = commit.sessionRefs?.slice(0, 2) ?? []
  const overflowSessions = commit.sessionRefs?.slice(2) ?? []

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
              to this dot. 90° square joins only, with no curves. */}
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
            {inlineSessions.map((session) => (
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
            {/* Inline up to 2 session chips, then a "+N more" disclosure, never a
                rolled-up count alone with no inline identity. */}
            {overflowSessions.length > 0 && (
              <SessionOverflowDisclosure
                commitHash={commit.id}
                overflow={overflowSessions}
                expanded={expandedSessions}
                onToggle={onToggleSessions ?? (() => {})}
                onSelect={(sessionId) => {
                  if (onNavigate) {
                    onNavigate({ type: 'open-session', sessionId, source: { kind: 'commit', commit: { id: commit.id, branch: commit.branch ?? null } } })
                  } else onOpenSession?.(sessionId)
                }}
              />
            )}
          </div>
        )}
        {touchedFiles.length > 0 && (
          <div className="cg-touched-files">
            <TouchedFileCluster
              commitHash={`files:${commit.id}`}
              files={touchedFiles}
              expanded={expandedFiles}
              onToggle={onToggleSessions ?? (() => {})}
              onOpenDiff={onOpenTouchedFile}
            />
          </div>
        )}
      </div>
    </div>
  )
}
