import { useMemo } from 'react'
import { Box, GitMerge } from 'lucide-react'
import CommitGraph from '../CommitGraph.jsx'
import { ProviderName } from '../ProviderIcon.jsx'
import { buildChangesGraph } from './changeGraph.js'

/* Changes — the lifted "lines of work" git-graph surface (peasant's /api/v1/review),
   lifted verbatim from the demo GraphMap.jsx ChangesView and parameterised: it takes
   the cooked ChangesPayload and derives, INSIDE this shared component (buildChangesGraph),
   the lane geometry the kit <CommitGraph> draws. The demo and every consuming app render
   byte-identically from the same payload — the basis of the side-by-side fidelity gate.

   The single sanctioned accent is amber (scarce, the selected row); a recorded session is a
   FILLED square dot + a sparkle (never colour alone); lane weight/dash tells lanes apart, not
   hue. tokens only, square, hairline, lowercase chrome, both themes free. */

/**
 * @param {object} props
 * @param {import('./types.js').ChangesPayload} props.payload  the cooked changes payload (adapter output)
 * @param {string} [props.projectLabel]  the head label (e.g. "peasant-labs/peasant"); host-supplied (not a payload field)
 * @param {string} [props.selectedId]  id of the active commit/tip row (the scarce amber treatment)
 * @param {(action: import('./timelineNavigation.js').TimelineNavigationAction) => void} [props.onNavigate] canonical semantic action callback; when present, legacy callbacks do not fire
 * @param {(commit: import('./changeGraph.js').CommitGraphRow) => void} [props.onSelectChange]  deprecated legacy row callback; use onNavigate.
 * @param {() => void} [props.onOpenMap]  deprecated legacy map callback; use onNavigate.
 * @param {boolean} [props.hasMore]  more history exists below the window (→ "show older")
 * @param {() => void} [props.onShowOlder]  deprecated legacy pagination callback; use onNavigate.
 * @param {(sessionId: string) => void} [props.onOpenSession] deprecated legacy session callback; use onNavigate.
 * @param {number} [props.nowMs]  pins relative-time humanisation (default Date.now()); the harness fixes it for byte-stable captures
 */
export default function Changes({
  payload,
  projectLabel,
  selectedId,
  onNavigate,
  onSelectChange,
  onOpenMap,
  hasMore = false,
  onShowOlder,
  onOpenSession,
  nowMs,
}) {
  const now = nowMs ?? Date.now()
  const graph = useMemo(() => buildChangesGraph(payload, { nowMs: now }), [payload, now])
  const { commits, reverted, unlinkedSessions, outsideWindowSessions, openCount, mergedCount } = graph
  const defaultBranch = payload.defaultBranch

  return (
    <div className="gmp-root gmp-changes-root">
      <div className="gmp-changes-head">
        <div>
          {projectLabel && <span className="label">lines of work · {projectLabel}</span>}
          <div className="gmp-changes-sub mono">
            {defaultBranch ? `default branch ${defaultBranch} · ` : ''}
            {openCount} open · {mergedCount} merged
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (onNavigate) onNavigate({ type: 'open-map' })
            else onOpenMap?.()
          }}
        >
          <Box size={14} aria-hidden="true" /> open the map
        </button>
      </div>

      <div className="gmp-changes-body">
        {/* the kit CommitGraph (square dots, 90° elbows, filled = recorded session + sparkle);
            selecting a commit opens its change detail. */}
        <CommitGraph
          className="gmp-cg"
          commits={commits}
          selectedId={selectedId}
          label="default-branch commit history"
          onNavigate={onNavigate}
          onSelect={(c) => onSelectChange?.(c)}
          onOpenSession={onOpenSession}
          hasMore={hasMore}
          onShowOlder={onShowOlder}
        />

        {unlinkedSessions.length > 0 && (
          <section className="gmp-unlinked-sessions" aria-labelledby="gmp-unlinked-sessions-heading">
            <h2 id="gmp-unlinked-sessions-heading" className="sb-head gmp-unlinked-sessions-head">
              sessions not linked to a commit
            </h2>
            <div className="gmp-unlinked-sessions-list">
              {unlinkedSessions.map((session) => (
                <button
                  key={session.sessionId}
                  type="button"
                  className="gmp-unlinked-session"
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate({
                        type: 'open-session',
                        sessionId: session.sessionId,
                        source: { kind: 'unlinked' },
                      })
                    } else onOpenSession?.(session.sessionId)
                  }}
                >
                  <ProviderName harness={session.harness} />
                  <span>{session.title || session.sessionId}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {outsideWindowSessions.length > 0 && (
          <section className="gmp-unlinked-sessions" aria-labelledby="gmp-outside-window-sessions-heading">
            <h2 id="gmp-outside-window-sessions-heading" className="sb-head gmp-unlinked-sessions-head">
              sessions linked outside this visible commit window
            </h2>
            <div className="gmp-unlinked-sessions-list">
              {outsideWindowSessions.map((session) => (
                <button
                  key={session.sessionId}
                  type="button"
                  className="gmp-unlinked-session"
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate({
                        type: 'open-session',
                        sessionId: session.sessionId,
                        source: { kind: 'outside-window' },
                      })
                    } else onOpenSession?.(session.sessionId)
                  }}
                >
                  <ProviderName harness={session.harness} />
                  <span>{session.title || session.sessionId}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* already-merged + reverted lines of work, listed under the graph. */}
        {reverted.length > 0 && (
          <div className="gmp-merged-sec">
            <div className="sb-head gmp-merged-head">already merged in</div>
            <div className="gmp-merged-list">
              {reverted.map((r) => (
                <button
                  key={r.branch}
                  type="button"
                  className="gmp-merged-chip gmp-merged-revert"
                  onClick={() => {
                    const change = /** @type {any} */ ({ id: `revert:${r.branch}`, branch: r.branch })
                    if (onNavigate) {
                      onNavigate({ type: 'open-change', change: { id: change.id, branch: change.branch } })
                    } else onSelectChange?.(change)
                  }}
                >
                  <GitMerge size={13} aria-hidden="true" /> reverted · {r.branch} · then undone · {r.when}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* legend — the kit's filled = has-session semantics. the .cg-dot marker is sized inline
            (the kit sizes it via absolute lane geometry, which doesn't apply here); its
            position/centering is reset in lib-graph.css (.gmp-changes-legend .cg-dot). */}
        <div className="gmp-changes-legend">
          <span className="gmp-legend-item">
            <span className="cg-dot cg-dot-filled" style={{ width: 9, height: 9 }} aria-hidden="true" /> commit with a recorded session
          </span>
          <span className="gmp-legend-item">
            <span className="cg-dot cg-dot-hollow" style={{ width: 9, height: 9 }} aria-hidden="true" /> no session captured
          </span>
          <span className="gmp-legend-item gmp-legend-dim">a filled dot also flies a sparkle · select a commit to open it</span>
        </div>
      </div>
    </div>
  )
}
