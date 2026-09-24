import { createContext, Fragment, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { RefreshCw, Unlink } from 'lucide-react'
import BrandMark from './BrandMark.jsx'
import Checkbox from './Checkbox.jsx'
import SessionGroupDisclosure from './SessionGroupDisclosure.jsx'

/**
 * HelperGroup - a count chip inside one owner-anchored tree of saved threads.
 *
 * Presentation only: the host passes the complete authorized member set for the
 * exact scope. No wire decoding, membership inference, fetching, paging, or
 * selection storage occurs here. renderMember receives the original row,
 * including its route-specific data.
 *
 * A helper tree is the ordinary row a host retained (`HelperGroupListItem`'s
 * `owner`), the immediate groups that hang off it (`HelperGroup`), and the
 * member rows those groups hold. The count chip sits ONE indent step inside the
 * tree, between the owner row and the members it discloses, and carries no
 * checkbox of its own. Members render only while the chip is open, each as a
 * row like the owner's: title, middot facts, an individual checkbox, and
 * host-authorized navigation.
 *
 * One continuous connector traces the centre of every MOUNTED row checkbox:
 * verticals run in the parent's column, one square step lands on the deeper
 * row's line, and one column is kept per depth, so a row the host never mounted
 * is never traced. The connector is measured, never authored: mount,
 * expand/collapse, a row that gains or loses its checkbox, and a resize all
 * re-measure it.
 *
 * @param {object} props
 * @param {string} props.groupId
 * @param {string} props.memberScope - exact scope token the members belong to;
 *   a changed scope resets uncontrolled disclosure, never inherits it
 * @param {number} props.helperThreadCount - saved threads, never review/message totals
 * @param {unknown[]} [props.members]
 * @param {(row: any) => import('react').ReactNode} props.renderMember
 * @param {(row: any) => string} props.getMemberKey - stable local/public transcript ID
 * @param {boolean} [props.expanded] - controlled disclosure for host Back restoration
 * @param {(expanded: boolean) => void} [props.onExpandedChange]
 * @param {boolean} [props.scopeExpired] - fail-closed: hides members, offers only
 *   an originating-list refresh, never loads anything broader
 * @param {() => void} [props.onRefreshList] - refresh the originating query,
 *   never an all-members fallback
 * @param {(row: any) => boolean} [props.isMemberSelected] - host-owned selection
 *   predicate; supply it whenever renderMember draws per-member checkboxes, so
 *   the CLOSED control can state a selection the viewer cannot see
 * @param {import('react').ReactNode} [props.memberFooter] - host-rendered slot
 *   placed immediately after the member rows (or the empty notice) inside the
 *   open body: THE canonical position for host paging controls ("page X of Y",
 *   previous/next). Paging fetch, page/limit state, and the server counts stay
 *   host-owned; the group never fetches, stores a page, or reads a scope token,
 *   and renders the slot only while it is open and not scope-expired.
 */
export default function HelperGroup(props) {
  // A changed query token cannot inherit an uncontrolled disclosure from an old query.
  return <HelperGroupDisclosure key={`${props.groupId}:${props.memberScope}`} {...props} />
}

/**
 * Depth and rail hooks shared by every row and group inside ONE helper tree.
 *
 * `depth` is the row's indent column (the owner row is 0, its members 1, a
 * member's own members 2, and so on). `register`/`unregister` hand the tree the
 * mounted rows it traces; `scheduleMeasure` coalesces a re-measure into the
 * next frame. A row outside any tree sees no context and renders exactly as an
 * ordinary row.
 */
const HelperTreeContext = createContext(null)

/** How far the connector reaches past its first and last anchor, in measured px. */
const RAIL_CAP = 6

/**
 * Composes ONE continuous path through the ordered checkbox anchors. Between
 * adjacent rows the lone horizontal step sits at the DEEPER row's y (always an
 * indentation gutter, never across a row's title), and the vertical changes
 * column exactly once, so at any y there is exactly one vertical segment. The
 * path opens and closes with a single cap collinear with the first/last
 * segment.
 */
function buildRailPath(anchors) {
  if (anchors.length === 0) return ''
  const first = anchors[0]
  const parts = [`M ${first.x} ${first.y - RAIL_CAP}`, `L ${first.x} ${first.y}`]
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1]
    const cur = anchors[i]
    if (cur.x === prev.x) {
      parts.push(`L ${cur.x} ${cur.y}`)
    } else if (cur.depth > prev.depth) {
      // Descending: fall at the parent column to the child row, then step in.
      parts.push(`L ${prev.x} ${cur.y}`, `L ${cur.x} ${cur.y}`)
    } else {
      // Ascending: step out at the deeper (previous) row, then fall to the row.
      parts.push(`L ${cur.x} ${prev.y}`, `L ${cur.x} ${cur.y}`)
    }
  }
  const last = anchors[anchors.length - 1]
  parts.push(`L ${last.x} ${last.y + RAIL_CAP}`)
  return parts.join(' ')
}

/**
 * The count a closed helper control states.
 *
 * Singular at one, the way every other session-group count in the product is
 * stated ("1 helper thread", never "1 helper threads").
 */
function helperThreadGroupLabel(count) {
  return `${count} helper thread${count === 1 ? '' : 's'}`
}

/**
 * The same count, plus how many of the rows the control HIDES are selected.
 *
 * A group starts CLOSED, so a selection made inside it would otherwise be
 * invisible: a viewer could pick members out, close the control, and still be
 * holding a selection made entirely of rows that are off screen. Stating the
 * count on the closed control means a selection is never silent. A selected
 * count of zero reads as the bare label; a "0 selected" hanging off every fold
 * in a long list is noise.
 */
function helperThreadGroupSelectionLabel(count, selectedCount) {
  const label = helperThreadGroupLabel(count)
  return selectedCount > 0 ? `${label}, ${selectedCount} selected` : label
}

/**
 * The canonical helper-tree selection policy.
 *
 * A helper tree is one owner row plus the helper member rows disclosed under it.
 * The owner checkbox is the tree's select-all control, and it cycles between the
 * two states of the same tree:
 *
 *     manual (the host's configured and hand-picked rows)  <->  all (owner + every member)
 *
 * The owner's untick position is the MANUAL state, not a third "none" step.
 * Pressing a partial or cleanly checked owner selects the whole tree, and pressing
 * it again restores exactly the manual selection the viewer built by hand instead
 * of discarding it. That is why the tree's keyboard select-all ring is not mirrored
 * here: the ring has a dedicated third press to clear the tree, while one checkbox
 * per row has no such press, and the user's ruling is that an owner untick restores
 * the manual picks rather than clearing a row the viewer chose.
 *
 * A member checkbox edits only that member. It never widens to the owner or to a
 * sibling, it writes the manual side, and it ends any all-selection, so the owner's
 * rollup is derived from what is DISPLAYED and a manual member pick survives every
 * later owner press.
 *
 * The owner checkbox states the ROLLUP of the whole tree: `checked` when the owner
 * and every member are selected, `unchecked` when none of them are, and `partial`
 * (indeterminate) when they are mixed.
 *
 * Selection STATE stays host-owned. Call useHelperSelection in the component that
 * owns the selection, and pass its isSelected/onSelect to the rows (the owner row
 * also reads ownerState); the components never store selection. The policy itself
 * is pure: helperOwnerToggle and helperMemberToggle are reducers a host, a test, or
 * a fixture can drive without a mounted component. See HELPER-GROUPS.md.
 */

/** The owner checkbox states a helper tree reports. */
export const HELPER_OWNER_STATE = {
  CHECKED: 'checked',
  UNCHECKED: 'unchecked',
  PARTIAL: 'partial',
}

/**
 * Roll one owner row and its helper members up into the owner checkbox state.
 * The owner's own row is part of the rollup, so a tree whose owner is selected
 * but whose members are not states `partial`, never a clean `checked`.
 * @param {string|undefined|null} ownerId
 * @param {Array<string|undefined|null>} memberIds
 * @param {(id: string) => boolean} isSelected
 * @returns {'checked'|'unchecked'|'partial'}
 */
export function helperOwnerState(ownerId, memberIds, isSelected) {
  const ids = [ownerId, ...memberIds].filter((id) => id !== undefined && id !== null)
  if (ids.length === 0) return HELPER_OWNER_STATE.UNCHECKED
  const selected = ids.filter((id) => isSelected(id)).length
  if (selected === 0) return HELPER_OWNER_STATE.UNCHECKED
  if (selected === ids.length) return HELPER_OWNER_STATE.CHECKED
  return HELPER_OWNER_STATE.PARTIAL
}

/**
 * The selection state of one helper tree: the DISPLAYED selection is the whole
 * tree while the select-all override is active, and the manual set otherwise.
 * Selection STATE stays host-owned; this is the value useHelperSelection stores.
 * @typedef {object} HelperSelectionState
 * @property {boolean} allActive - true while the select-all override is engaged
 * @property {Set<string>} manual - the configured and hand-picked selection
 */

/**
 * The ids a tree currently DISPLAYS, owner first then members, or the manual set
 * while the override is off. Ids are de-duplicated, and a missing owner (a
 * helper-only result) is dropped.
 * @param {HelperSelectionState} state
 * @param {string|undefined|null} ownerId
 * @param {Array<string|undefined|null>} memberIds
 * @returns {string[]}
 */
export function helperSelectionIds(state, ownerId, memberIds) {
  const ids = state.allActive ? [ownerId, ...memberIds] : [...state.manual]
  return [...new Set(ids)].filter((id) => id !== undefined && id !== null)
}

/**
 * Toggle the owner checkbox: engage the all-selection from the manual side, or
 * restore the manual selection from the all side. The manual set is never touched,
 * so a manual member pick survives the cycle.
 * @param {HelperSelectionState} state
 * @returns {HelperSelectionState}
 */
export function helperOwnerToggle(state) {
  return { allActive: !state.allActive, manual: state.manual }
}

/**
 * Toggle one member checkbox. The write lands on the manual side and ends any
 * all-selection: while the override is active the base is the DISPLAYED
 * all-selection, so unticking one member keeps every other row selected and the
 * next owner press restores all-but-that-member.
 * @param {HelperSelectionState} state
 * @param {string|undefined|null} ownerId
 * @param {Array<string|undefined|null>} memberIds
 * @param {string} memberId
 * @param {boolean} checked
 * @returns {HelperSelectionState}
 */
export function helperMemberToggle(state, ownerId, memberIds, memberId, checked) {
  const base = state.allActive
    ? new Set([ownerId, ...memberIds].filter((id) => id !== undefined && id !== null))
    : new Set(state.manual)
  if (checked) base.add(memberId)
  else base.delete(memberId)
  return { allActive: false, manual: base }
}

/**
 * Hold the canonical helper-tree selection for one owner. The selection lives in
 * the calling host, never in the components.
 *
 * A changed owner or member set is a different tree, so the hook resets to that
 * tree's configured selection instead of carrying a pick across a scenario switch.
 * @param {object} [config]
 * @param {string} [config.ownerId] the tree's owner row id; omit for a
 *   helper-only result, where every member selects on its own
 * @param {string[]} [config.memberIds] every helper member under that owner
 * @param {string[]} [config.initialSelectedIds] the configured manual selection
 * @returns {{selectedIds: string[], isSelected: (id: string) => boolean,
 *   ownerState: 'checked'|'unchecked'|'partial',
 *   onSelect: (id: string, checked: boolean) => void}}
 */
export function useHelperSelection({ ownerId, memberIds = [], initialSelectedIds = [] } = {}) {
  const selectionKey = `${ownerId ?? ''}\u0000${memberIds.join('\u0000')}`
  const [state, setState] = useState(() => ({ allActive: false, manual: new Set(initialSelectedIds) }))
  const [key, setKey] = useState(selectionKey)
  // Adjusting state during render when the tree changes is React's documented
  // pattern: the reset commits with the same render as the new owner and members,
  // so the previous tree's selection is never painted against the new one.
  if (key !== selectionKey) {
    setKey(selectionKey)
    setState({ allActive: false, manual: new Set(initialSelectedIds) })
  }
  const selectedIds = helperSelectionIds(state, ownerId, memberIds)
  const isSelected = useCallback((id) => selectedIds.includes(id), [selectedIds])
  const ownerState = helperOwnerState(ownerId, memberIds, isSelected)
  const onSelect = useCallback((id, checked) => {
    setState((previous) => id === ownerId
      ? helperOwnerToggle(previous)
      : helperMemberToggle(previous, ownerId, memberIds, id, checked))
  }, [ownerId, memberIds])
  return { selectedIds, isSelected, ownerState, onSelect }
}

function HelperGroupDisclosure({
  groupId, memberScope, helperThreadCount, members = [], renderMember, getMemberKey,
  expanded, onExpandedChange, scopeExpired = false, onRefreshList, isMemberSelected, memberFooter,
}) {
  const tree = useContext(HelperTreeContext)
  const id = useId()
  const [localExpanded, setLocalExpanded] = useState(false)
  const open = expanded ?? localExpanded
  // The control counts the rows it actually holds, never a selection from
  // another group: a viewer reading this fold must be told exactly what is
  // hidden behind it.
  const selectedCount = isMemberSelected === undefined
    ? 0
    : members.filter((row) => isMemberSelected(row)).length

  const toggle = () => {
    const next = !open
    if (expanded === undefined) setLocalExpanded(next)
    onExpandedChange?.(next)
  }

  // Revealing or hiding rows changes which anchors the tree traces, so every
  // render schedules a re-measure. The group knows nothing about the rail; it
  // only tells the tree that its anchors may have moved.
  useEffect(() => { tree?.scheduleMeasure() })

  // Members sit one indent column deeper than the row this group hangs under.
  // A member that itself owns helpers renders those groups in its own children,
  // where that group reads THIS depth and deepens again.
  const deeper = useMemo(() => tree === null ? null : {
    depth: tree.depth + 1,
    register: tree.register,
    unregister: tree.unregister,
    scheduleMeasure: tree.scheduleMeasure,
  }, [tree])

  return (
    <div className="helper-group helper-tree-children" data-group-id={groupId}>
      <SessionGroupDisclosure
        label={helperThreadGroupSelectionLabel(helperThreadCount, selectedCount)}
        collapsedLabel={helperThreadGroupSelectionLabel(helperThreadCount, selectedCount)}
        expanded={open}
        onToggle={toggle}
        rowsID={`${id}-body`}
        testID="helper-group"
        bare
      >
        {/* The members exist only while the control is open, exactly like the
            session-group rows below a list: a folded row cannot be mistaken for a
            visible one, and nothing hidden holds the page's height. */}
        <HelperTreeContext.Provider value={deeper}>
          <div id={`${id}-body`} className="helper-group-body">
            {scopeExpired ? (
              <div className="helper-group-notice">
                <p>the saved helper query expired. no broader results were loaded. refresh the originating list to restore its filters.</p>
                {onRefreshList && <button type="button" className="helper-group-action" onClick={onRefreshList}>
                  <RefreshCw aria-hidden="true" /> refresh list
                </button>}
              </div>
            ) : <>
              {members.length ? <ul className="helper-group-members">
                {members.map((row) => <li key={getMemberKey(row)} className="helper-tree-row">{renderMember(row)}</li>)}
              </ul> : <p className="helper-group-notice">no saved helpers match the current query and access.</p>}
              {/* The canonical host slot for paging controls: immediately after
                  the rows it pages (or the empty notice), inside the open body.
                  A folded or scope-expired group shows it exactly as often as it
                  shows rows, so controls never page a list the viewer cannot
                  see. The group only places the host's content; page state,
                  fetch, and the server total are the host's. */}
              {memberFooter ? <div className="helper-group-footer" data-helper-group-footer>{memberFooter}</div> : null}
            </>}
          </div>
        </HelperTreeContext.Provider>
      </SessionGroupDisclosure>
    </div>
  )
}

const OWNER_COPY = {
  resolved: 'owner is outside this result',
  general_link_only: 'owner is outside this result',
  known_unavailable: 'owner is unavailable',
  inaccessible: 'owner is not accessible',
  unknown: 'owner is unknown',
  conflicting: 'owner evidence conflicts',
}

/**
 * One owner-anchored helper tree: an ordinary row (or an explicit unavailable
 * context) above its immediate helper groups, traced by ONE measured connector.
 *
 * The tree owns the connector, not the rows: every mounted row registers its
 * element here, the tree measures the centre of each mounted row checkbox after
 * each change and on resize, and the single path is drawn behind the rows. The
 * connector is a selection aid only - it carries no meaning that the rows and
 * their checkboxes do not already carry.
 *
 * For a helper-only result supply ownerStatus instead of owner; no fake title
 * or owner action is rendered. Keep distinct unresolved containers keyed by
 * backend group ID.
 * @param {object} props
 * @param {import('react').ReactNode} [props.owner]
 * @param {string} [props.ownerStatus]
 * @param {import('react').ReactNode} props.children - immediate HelperGroup children
 */
export function HelperGroupListItem({ owner, ownerStatus, children }) {
  if (owner == null && !Object.hasOwn(OWNER_COPY, ownerStatus)) {
    throw new Error('HelperGroupListItem render failed: owner context has no supported status; no owner can be safely displayed. Pass the authorized context ownerStatus from the grouped list.')
  }
  const treeRef = useRef(null)
  const rowsRef = useRef(new Map())
  const frameRef = useRef(0)
  const timerRef = useRef(0)
  const [railPath, setRailPath] = useState('')
  const [anchorCount, setAnchorCount] = useState(0)

  const register = useCallback((element, depth) => { rowsRef.current.set(element, depth) }, [])
  const unregister = useCallback((element) => { rowsRef.current.delete(element) }, [])

  const measure = useCallback(() => {
    const container = treeRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const anchors = []
    for (const [element, depth] of rowsRef.current) {
      // A row that unmounted left its registration behind; drop it rather than
      // trace a node that is no longer on the page.
      if (!element.isConnected || !container.contains(element)) {
        rowsRef.current.delete(element)
        continue
      }
      const input = element.querySelector('input[type="checkbox"]')
      if (!input) continue // no checkbox, no anchor
      const rect = input.getBoundingClientRect()
      anchors.push({
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top,
        depth,
      })
    }
    if (anchors.length === 0) {
      setRailPath('')
      setAnchorCount(0)
      return
    }
    // Anchors arrive in registration order, which is mount order; the path is
    // traced top to bottom, so order them by where they actually sit.
    anchors.sort((a, b) => a.y - b.y)
    // Snap each depth to ONE column (its median x) so every vertical at a
    // given depth is exactly aligned - provably a single line per column.
    const byDepth = new Map()
    for (const anchor of anchors) {
      const xs = byDepth.get(anchor.depth) ?? []
      xs.push(anchor.x)
      byDepth.set(anchor.depth, xs)
    }
    for (const [depth, xs] of byDepth) {
      const sorted = xs.slice().sort((a, b) => a - b)
      const column = sorted[Math.floor(sorted.length / 2)]
      for (const anchor of anchors) if (anchor.depth === depth) anchor.x = column
    }
    setRailPath(buildRailPath(anchors))
    setAnchorCount(anchors.length)
  }, [])

  const scheduleMeasure = useCallback(() => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRef.current)
    if (typeof clearTimeout === 'function') clearTimeout(timerRef.current)
    if (typeof requestAnimationFrame === 'function') {
      frameRef.current = requestAnimationFrame(measure)
      // A throttled tab (backgrounded, or one of several stories polled at once)
      // can starve rAF, which would leave the rail unmeasured; one bounded
      // timeout guarantees the connector is drawn either way. Measuring twice is
      // harmless: the path is derived from where the rows actually sit.
      timerRef.current = setTimeout(measure, 250)
    } else {
      measure()
    }
  }, [measure])

  const tree = useMemo(() => ({ depth: 0, register, unregister, scheduleMeasure }),
    [register, unregister, scheduleMeasure])

  useEffect(() => {
    scheduleMeasure()
    const container = treeRef.current
    const observer = typeof ResizeObserver !== 'undefined' && container ? new ResizeObserver(scheduleMeasure) : null
    observer?.observe(container)
    window.addEventListener('resize', scheduleMeasure)
    return () => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRef.current)
      if (typeof clearTimeout === 'function') clearTimeout(timerRef.current)
      observer?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [scheduleMeasure])

  return (
    <div className="helper-group-item helper-tree" ref={treeRef} data-helper-tree>
      <HelperTreeContext.Provider value={tree}>
        {/* The connector layer only paints; the rows sit above it, so every
            control sits on the rail. */}
        <svg className="helper-tree-rail" aria-hidden="true" data-anchor-count={anchorCount}>
          {railPath && <path className="helper-tree-rail__path" d={railPath}
            shapeRendering="crispEdges" strokeLinecap="square" />}
        </svg>
        <div className="helper-tree-rows">
          <div className="helper-tree-row">
            {owner ?? <p className="helper-group-context"><Unlink aria-hidden="true" />{OWNER_COPY[ownerStatus]}</p>}
          </div>
          {children}
        </div>
      </HelperTreeContext.Provider>
    </div>
  )
}

/**
 * One helper member drawn as the ordinary list row it is: title, a facts line
 * with middot separators, an optional individual checkbox, and host-authorized
 * navigation. Display-only when selection and navigation are both absent. The
 * two optional behaviors are individual-only: a per-thread checkbox and
 * host-authorized open navigation. No aggregate selection, no self-built links,
 * no per-row disclosure. Hosts map scalar display props from their typed row and
 * preserve route-specific status/usage/ordinary-child exits in children. These
 * are UI props, not another wire DTO.
 *
 * Inside a helper tree the row registers itself so the tree can trace its
 * checkbox; outside one it renders exactly as before. Because a host can turn
 * selection off after mount, every render schedules a re-measure - the checkbox
 * may have appeared or gone.
 *
 * Facts that have no measured value state that honestly ("unknown input
 * submissions"), and a count of one singularizes: a row never claims "1 input
 * submissions" or "1 turns". The separator falls BETWEEN facts that survive, so
 * a row cannot open or end its facts line with a stray middot.
 * @param {object} props
 * @param {string} props.id - individual transcript identity, never a group ID
 * @param {string} props.title - verbatim user content
 * @param {string} [props.provider]
 * @param {number} [props.inputSubmissionCount]
 * @param {number} [props.turnCount]
 * @param {string} [props.href] - host-created authorized route
 * @param {(id: string, event: import('react').MouseEvent) => void} [props.onOpen]
 * @param {boolean} [props.selected]
 * @param {boolean} [props.selectionDisabled]
 * @param {boolean} [props.indeterminate] - mixed state for a row that rolls
 *   helper members up (the tree owner); ignored without `onSelect`
 * @param {(id: string, selected: boolean) => void} [props.onSelect]
 * @param {import('react').ReactNode} [props.children]
 */
export function HelperThreadRow({ id, title, provider, inputSubmissionCount, turnCount,
  href, onOpen, selected = false, selectionDisabled = false, indeterminate = false, onSelect, children }) {
  const tree = useContext(HelperTreeContext)
  const setRowElement = useCallback((element) => {
    if (!tree || !element) return
    tree.register(element, tree.depth)
    return () => tree.unregister(element)
  }, [tree])
  useEffect(() => { tree?.scheduleMeasure() })
  const facts = []
  if (provider) facts.push({ key: 'provider', node: <span className="helper-thread-provider"><BrandMark name={provider} />{provider}</span> })
  facts.push({ key: 'inputs', node: <span>{inputSubmissionCount === undefined
    ? 'unknown input submissions'
    : `${inputSubmissionCount} input submission${inputSubmissionCount === 1 ? '' : 's'}`}</span> })
  facts.push({ key: 'turns', node: <span>{turnCount === undefined
    ? 'unknown turns'
    : `${turnCount} turn${turnCount === 1 ? '' : 's'}`}</span> })
  return <div ref={setRowElement} className="helper-thread-row" data-thread-id={id}>
    <div className="helper-thread-main">
      {onSelect && <Checkbox checked={selected} indeterminate={indeterminate} disabled={selectionDisabled}
        aria-label={`select ${title} (${id})`} onChange={(checked) => onSelect(id, checked)} />}
      <div className="helper-thread-column">
        <div className="helper-thread-head">
          {href ? <a className="helper-thread-open" href={href} onClick={(event) => onOpen?.(id, event)}>{title}</a>
            : onOpen ? <button type="button" className="helper-thread-open" onClick={(event) => onOpen(id, event)}>{title}</button>
              : <span className="helper-thread-title">{title}</span>}
        </div>
        <div className="helper-thread-facts">
          {facts.map(({ key, node }, index) => <Fragment key={key}>
            {index > 0 && <span className="helper-thread-sep" aria-hidden="true">&middot;</span>}
            {node}
          </Fragment>)}
        </div>
        {/* Host-supplied row content lives INSIDE the content column, not across
            the row: anything that started at the row's left edge would run under
            the connector's column and outdent from the title it belongs to. */}
        {children}
      </div>
    </div>
  </div>
}
