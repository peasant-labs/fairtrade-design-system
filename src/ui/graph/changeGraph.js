// @ts-check
/* changeGraph — derive the kit CommitGraph dataset from a ChangesPayload.
   ────────────────────────────────────────────────────────────────────────────
   The lifted <Changes> surface owns its own rendering: it takes the raw
   ChangesPayload (the adapter's output) and derives, INSIDE the shared component,
   the lane/parent geometry the kit <CommitGraph> draws. This relocates the
   lane-layout logic that previously lived app-side (peasant's changeGraphLayout)
   into the package, so the demo and every consuming app render byte-identically
   from the same payload — the whole point of the side-by-side fidelity gate.

   The git-graph idiom (ported from the app layout): time flows down, lane 0 is
   the default branch's recent commits, each OPEN change forks onto its own lane
   at its merge-base (baseHash) and sits at its tip time, and a MERGED change
   attaches at its merge commit (mergeCommitHash) as a join into lane 0. Reverted
   changes are surfaced separately (the demo lists them under the graph).

   Fully deterministic: shuffling `changes` yields an identical graph; the only
   external input is `nowMs` (for humanising the relative time labels), which the
   harness pins so captures are byte-stable. */

/** @typedef {import('./types.js').ChangesPayload} ChangesPayload */
/** @typedef {import('./types.js').ChangeSummaryPayload} ChangeSummaryPayload */
/** @typedef {import('./types.js').CommitRefPayload} CommitRefPayload */

/**
 * One row in the kit CommitGraph dataset (mirrors the `Commit` shape documented
 * on src/ui/CommitGraph.jsx). Time order = array order (newest first); the graph
 * is implicit in `lane` + `parents`.
 *
 * @typedef {object} CommitGraphRow
 * @property {string} id                stable key (commit hash, or `tip:<branch>` for an open tip)
 * @property {number} lane              0 = the default-branch line; >0 = a branch lane
 * @property {string[]} [parents]       parent row ids (>1 ⇒ a merge)
 * @property {string} message           the commit subject / branch label (USER CONTENT — case preserved)
 * @property {string} [branch]          branch name chip (USER CONTENT — case preserved)
 * @property {boolean} [session]        a recorded session sits behind this commit (→ filled dot + sparkle)
 * @property {import('./types.js').TimelineSessionPayload[]} [sessionRefs] named sessions bound to this commit
 * @property {boolean} [merged]         this commit merged a branch back in (→ merged chip)
 * @property {boolean} [tip]            this row is an open branch tip (→ tip affordance)
 * @property {string} [time]            humanised relative time (e.g. "5h ago")
 */

/**
 * A reverted line of work, surfaced under the graph (the demo's "reverted" chip).
 * @typedef {object} RevertedChange
 * @property {string} branch
 * @property {number | null} [mergedAtMs]
 * @property {string} [when]            humanised relative time of the merge
 */

/**
 * The derived Changes view model: the CommitGraph dataset + the reverted list +
 * the head counts the surface caption shows.
 *
 * @typedef {object} ChangesGraph
 * @property {CommitGraphRow[]} commits   newest first; lane 0 is the default branch
 * @property {RevertedChange[]} reverted  merged-then-reverted changes (listed under the graph)
 * @property {number} openCount           number of open changes
 * @property {number} mergedCount         number of merged changes
 * @property {import('./types.js').TimelineSessionPayload[]} unlinkedSessions sessions not linked to a commit in this timeline window
 * @property {import('./types.js').TimelineSessionPayload[]} outsideWindowSessions sessions linked to a commit outside the displayed default-branch window
 */

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/**
 * Humanise an absolute epoch-ms time into a short relative label ("5h ago",
 * "3d ago", "1wk ago"). Pure: depends only on (timeMs, nowMs). Returns '' when
 * the time is missing so the kit simply omits the label.
 *
 * @param {number | null | undefined} timeMs
 * @param {number} nowMs
 * @returns {string}
 */
export function humanizeAge(timeMs, nowMs) {
  if (timeMs == null) return ''
  const d = Math.max(0, nowMs - timeMs)
  if (d < HOUR) return `${Math.max(1, Math.floor(d / MIN))}m ago`
  if (d < DAY) return `${Math.floor(d / HOUR)}h ago`
  if (d < WEEK) return `${Math.floor(d / DAY)}d ago`
  return `${Math.floor(d / WEEK)}wk ago`
}

/**
 * Derive the CommitGraph dataset (+ reverted list + counts) from a ChangesPayload.
 *
 * Lane assignment is deterministic: open changes sort by tip time (newest first,
 * branch name as a tiebreak) and take lanes 1..N in that order. Each open change
 * contributes a tip row inserted just above the first recent commit at/older than
 * its tip time; its `parents` point at its merge-base (baseHash) when that commit
 * is in the window. Merged changes flip `merged` on their merge commit and add the
 * (synthetic) branch tip as a second parent so the kit draws the join elbow.
 *
 * @param {ChangesPayload} payload
 * @param {{ nowMs: number }} opts  `nowMs` pins relative-time humanisation (determinism)
 * @returns {ChangesGraph}
 */
export function buildChangesGraph(payload, { nowMs }) {
  const recent = payload.recentCommits ?? []
  const changes = payload.changes ?? []
  const defaultBranch = payload.defaultBranch
  const sessions = payload.sessions ?? []
  const sessionById = new Map(sessions.map((session) => [session.sessionId, session]))
  const linkedSessionIds = new Set(recent.flatMap((commit) => commit.sessionIds ?? []))

  const open = changes
    .filter((c) => !c.merged)
    .slice()
    .sort((a, b) => tipKey(b) - tipKey(a) || a.branch.localeCompare(b.branch))
  const merged = changes.filter((c) => c.merged && !c.reverted)
  const reverted = changes.filter((c) => c.merged && c.reverted)

  // Merge commits: mergeCommitHash → the merged change attaching there.
  const mergeByHash = new Map(
    merged.filter((m) => m.mergeCommitHash).map((m) => [/** @type {string} */ (m.mergeCommitHash), m]),
  )
  // Open-change lane plan: lane index + the merge-base (fork) hash + tip time.
  const lanePlan = open.map((change, i) => ({
    change,
    lane: i + 1,
    baseHash: change.baseHash,
    tipMs: change.tipCommitMs ?? null,
  }))

  /** @type {CommitGraphRow[]} */
  const commits = []

  // Walk recent commits (newest first), inserting each open tip just above the
  // first commit at/older than its tip time (so it sits in correct time order).
  /** @type {Set<number>} */
  const insertedTips = new Set()
  /** @param {number | null} boundaryMs */
  const insertTipsBefore = (boundaryMs) => {
    for (const p of lanePlan) {
      if (insertedTips.has(p.lane)) continue
      const tipMs = p.tipMs
      // undated tips pin to the very top (boundaryMs === null marks the top sentinel)
      const due = tipMs == null ? boundaryMs === null : boundaryMs !== null && tipMs >= boundaryMs
      if (!due) continue
      insertedTips.add(p.lane)
      const c = p.change
      commits.push({
        id: `tip:${c.branch}`,
        lane: p.lane,
        parents: p.baseHash ? [p.baseHash] : [],
        message: c.branch,
        branch: c.branch,
        session: (c.sessionCount ?? 0) > 0,
        tip: true,
        time: humanizeAge(p.tipMs, nowMs),
      })
    }
  }

  // top sentinel: undated tips (no tipCommitMs) sit above every commit
  insertTipsBefore(null)

  recent.forEach((rc, i) => {
    insertTipsBefore(rc.timeMs ?? Number.NEGATIVE_INFINITY)
    const next = recent[i + 1]
    /** @type {string[]} */
    const parents = next ? [next.hash] : []
    const mergedChange = mergeByHash.get(rc.hash)
    if (mergedChange) parents.push(`tip:${mergedChange.branch}`)
    commits.push({
      id: rc.hash,
      lane: 0,
      parents,
      message: rc.subject,
      branch: defaultBranch,
      session: rc.hasSession,
      sessionRefs: (rc.sessionIds ?? []).flatMap((id) => {
        const session = sessionById.get(id)
        return session ? [session] : []
      }),
      merged: mergedChange ? true : undefined,
      time: humanizeAge(rc.timeMs, nowMs),
    })
  })

  // Any tips not yet placed (tip time older than every recent commit) append last.
  insertTipsBefore(Number.NEGATIVE_INFINITY)

  /** @type {RevertedChange[]} */
  const revertedRows = reverted.map((r) => ({
    branch: r.branch,
    mergedAtMs: r.mergedAtMs ?? null,
    when: humanizeAge(r.mergedAtMs, nowMs),
  }))

  const outsideWindowSessions = sessions.filter((session) => session.hasCommitBinding === true
    && !linkedSessionIds.has(session.sessionId))
  return {
    commits,
    reverted: revertedRows,
    openCount: open.length,
    mergedCount: merged.length + reverted.length,
    unlinkedSessions: sessions.filter((session) => session.hasCommitBinding === false
      || (session.hasCommitBinding === undefined && !linkedSessionIds.has(session.sessionId))),
    outsideWindowSessions,
  }
}

/** @param {ChangeSummaryPayload} c @returns {number} tip-time sort key (undated = newest) */
function tipKey(c) {
  return c.tipCommitMs ?? Number.POSITIVE_INFINITY
}
