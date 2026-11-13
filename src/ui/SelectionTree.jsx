import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import BrandMark from './BrandMark.jsx'
import Checkbox from './Checkbox.jsx'
import { formatInteger } from './format.js'
import {
  childCountNoun,
  parseNodeKind,
  parseNodeState,
  SelectionNodeKind,
  SelectionNodeState,
} from './selection-tree-values.js'
import { useMeasuredRail } from './tree-rail.js'
import './SelectionTree.css'

/**
 * One server-grouped node. Grouping has already happened. This component does
 * not regroup, and it does not roll `state` up from children.
 *
 * @typedef {Object} SelectionTreeNode
 * @property {string} id node id. Session ids are what a toggle reports.
 * @property {string} [parentId] parent node id. Empty or omitted for a root.
 * @property {string | import('./selection-tree-values.js').SelectionNodeKind} kind
 * @property {string | import('./selection-tree-values.js').SelectionNodeState} state host-supplied tri-state. Drawn as given.
 * @property {string} label user content. Rendered with its case unchanged.
 * @property {string} [sessionId] session identity; for session rows the server sets it equal to id, which is reported.
 * @property {string} [harness] provider name, shown as given when present.
 * @property {number} [childCount] displayed as given. Not counted from children. The noun after it
 *   names the kind of the row's child rows: "project: 6 branches", "branch: 1 session", and
 *   "session: 2 child sessions" for the sessions a session started.
 * @property {boolean} [locked] disables this row's checkbox and is announced.
 */

/**
 * Selection contract.
 *
 * `onSelectionChange` receives the complete array of selected session-node ids
 * after the toggle. It is never a delta, and it never includes a project, group,
 * or branch id. Those rows are how the host presents a group; the host acts on
 * session ids.
 *
 * Toggling a row adds or removes every unlocked session id in its subtree,
 * including its own id when the row is a session. Direction follows that row's
 * host-supplied `state`: `all` removes the ids, `none` or `some` adds them.
 * A locked row does not toggle. A locked descendant is left as the host last
 * set it, and its own descendants are not reached through the locked row.
 *
 * The array is tree order: roots in input order, then each node's children in
 * input order. Session ids that are selected but are not in this forest stay
 * at the end, in their previous order, so a toggle does not drop them.
 *
 * `value` is that same set (a Set or an array). Checkbox glyphs
 * still come only from each node's `state`. A parent whose children are all
 * selected still draws `none` when the host says `none`.
 *
 * There is no paging prop, no cursor, and no stored copy of the forest.
 *
 * Preview contract.
 *
 * With `onPreview`, a row has three controls and each does one thing: the caret folds, the
 * checkbox selects, and the title previews. The title is its own button, outside the checkbox's
 * label, so a title click never changes the selection and a checkbox click never previews. The
 * title button reports the row's node id (a project, branch, group or session id) to
 * `onPreview`, for every row kind, locked rows included. The host owns which row is previewed and
 * passes it back as `previewId`; that row's title carries `aria-pressed="true"` and the row is
 * marked with the selection inset as well as a fill, so the mark is not colour alone. Without
 * `onPreview` the title stays inside the checkbox label and a click on it toggles the row, as
 * before the preview contract.
 *
 * @typedef {Object} SelectionTreeProps
 * @property {readonly SelectionTreeNode[]} [nodes]
 * @property {ReadonlySet<string> | readonly string[]} value
 * @property {(ids: readonly string[]) => void} [onSelectionChange]
 * @property {(nodeId: string) => void} [onPreview] called with a row's node id when its title is
 *   activated. Turns each title into a preview button.
 * @property {string | null} [previewId] the node id the host is previewing, or null for none.
 *   Read only with `onPreview`.
 * @property {string} [ariaLabel]
 */

/**
 * A server-grouped selection forest. See SelectionTreeProps for the id contract.
 * Replaces GroupedMultiSelect for hosts migrating to server-grouped state.
 * Keep the nodes array reference stable between forest changes to avoid reparsing.
 * @param {SelectionTreeProps} props
 */
export default function SelectionTree({
  nodes = [],
  value,
  onSelectionChange,
  onPreview,
  previewId = null,
  ariaLabel = 'sessions',
}) {
  if (!Array.isArray(nodes)) throw new TypeError('SelectionTree: nodes must be an array of server-grouped nodes; pass an empty array while loading.')
  const prepared = useMemo(() => prepareForest(nodes), [nodes])
  const [collapsed, setCollapsed] = useState(() => new Set())
  const selected = idsFromValue(value)

  const toggle = useCallback((nodeId) => {
    const node = prepared.byId.get(nodeId)
    if (!node || node.locked) return
    const current = new Set(selected)
    const actionable = actionableSessionIds(node, prepared.byParent)
    const selecting = node.state !== SelectionNodeState.All
    for (const id of actionable) {
      if (selecting) current.add(id)
      else current.delete(id)
    }
    const next = reportSelection(current, prepared.roots, prepared.byParent, selected)
    onSelectionChange?.(next)
  }, [onSelectionChange, prepared, selected])

  const toggleCollapsed = useCallback((nodeId) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }, [])

  // One measured connector traces the mounted rows' checkboxes, the rail fairtrade's helper tree
  // draws too. Folding unmounts a row's children, so they drop out of the rail; every render may
  // have moved a row, so every render re-measures.
  const rail = useMeasuredRail()
  const { scheduleMeasure } = rail
  useEffect(() => { scheduleMeasure() })
  const preview = typeof onPreview === 'function' ? onPreview : null

  const notice = diagnosticText(prepared.unknownKind, prepared.unknownState, prepared.unreadable, prepared.unreachable, prepared.duplicates)

  return (
    <div
      className="st"
      role="group"
      aria-label={ariaLabel}
      data-unknown-kind={prepared.unknownKind}
      data-unknown-state={prepared.unknownState}
      data-previewable={preview ? 'true' : undefined}
    >
      <div className="st-body" ref={rail.containerRef}>
        {/* The connector only paints. It sits above the row fills (hover, preview) and below the
            row's controls, and it takes no pointer events. */}
        <svg className="st-rail" aria-hidden="true" data-anchor-count={rail.anchorCount}>
          {rail.railPath && <path className="st-rail__path" d={rail.railPath}
            shapeRendering="crispEdges" strokeLinecap="square" />}
        </svg>
        <ul className="st-nodes">
          {prepared.roots.map((node) => (
            <SelectionNode
              key={node.id}
              node={node}
              depth={0}
              byParent={prepared.byParent}
              collapsed={collapsed}
              onToggle={toggle}
              onCollapse={toggleCollapsed}
              onPreview={preview}
              previewId={previewId}
              register={rail.register}
              unregister={rail.unregister}
            />
          ))}
        </ul>
      </div>
      {notice && (
        <p className="st-diagnostic" role="status">{notice}</p>
      )}
    </div>
  )
}

/**
 * @param {Object} props
 * @param {PreparedNode} props.node
 * @param {number} props.depth
 * @param {ReadonlyMap<string, readonly PreparedNode[]>} props.byParent
 * @param {ReadonlySet<string>} props.collapsed
 * @param {(id: string) => void} props.onToggle
 * @param {(id: string) => void} props.onCollapse
 * @param {((id: string) => void) | null} props.onPreview
 * @param {string | null} props.previewId
 * @param {(element: Element, depth: number) => void} props.register
 * @param {(element: Element) => void} props.unregister
 */
function SelectionNode({ node, depth, byParent, collapsed, onToggle, onCollapse, onPreview, previewId, register, unregister }) {
  const children = byParent.get(node.id) ?? []
  const branch = children.length > 0
  const open = branch && !collapsed.has(node.id)
  const panelId = useId()
  const indent = { paddingInlineStart: `calc(var(--sp-4) * ${depth})` }
  const previewed = onPreview !== null && previewId === node.id
  const hasCount = typeof node.childCount === 'number' && Number.isFinite(node.childCount)
  // The row registers with the tree's rail while it is mounted; its checkbox is the anchor.
  const rowRef = useCallback((element) => {
    if (!element) return undefined
    register(element, depth)
    return () => unregister(element)
  }, [register, unregister, depth])
  const checkboxName = node.locked ? `${node.label}, locked` : node.label
  const checkboxProps = {
    checked: node.state === SelectionNodeState.All,
    indeterminate: node.state === SelectionNodeState.Some,
    disabled: node.locked,
    'aria-checked': node.state === SelectionNodeState.Some ? 'mixed' : node.state === SelectionNodeState.All ? 'true' : 'false',
    'aria-label': checkboxName,
    onChange: () => onToggle(node.id),
  }

  return (
    <li
      className="st-node"
      data-node-id={node.id}
      data-kind={node.kind.wire}
      data-state={node.state.wire}
      data-locked={node.locked ? 'true' : undefined}
      data-depth={depth}
    >
      <div className="st-row" style={indent} ref={rowRef} data-previewed={previewed ? 'true' : undefined}>
        {branch ? (
          <button
            type="button"
            className="st-disclosure"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? 'hide' : 'show'} ${node.label}`}
            onClick={() => onCollapse(node.id)}
          >
            <ChevronRight className="st-caret" data-open={open || undefined} aria-hidden="true" />
          </button>
        ) : (
          <span className="st-disclosure st-disclosure-spacer" aria-hidden="true" />
        )}
        {onPreview ? (
          <>
            <Checkbox labelClassName="st-hit st-hit-box" {...checkboxProps} />
            <button
              type="button"
              className="st-title"
              aria-pressed={previewed}
              aria-label={`preview ${node.label}`}
              onClick={() => onPreview(node.id)}
            >
              <span className="st-label">{node.label}</span>
            </button>
          </>
        ) : (
          <Checkbox labelClassName="st-hit" {...checkboxProps}><span className="st-label">{node.label}</span></Checkbox>
        )}
        <span className="st-facts">
          <span className="st-tally">
            <span className="st-kind">{node.kind.label}</span>
            {hasCount && (
              <>
                {': '}
                <span className="st-count">
                  <span className="st-num">{formatInteger(node.childCount)}</span>
                  <span className="st-count-label"> {childCountNoun(node.childCount, node.kind, children.map((child) => child.kind))}</span>
                </span>
              </>
            )}
          </span>
          {node.locked && <span className="st-locked">locked</span>}
          {node.harness && (
            <span className="st-harness">
              <BrandMark name={node.harness} />
              <span className="st-harness-name">{node.harness}</span>
            </span>
          )}
        </span>
      </div>
      {open && (
        <ul className="st-children" id={panelId}>
          {children.map((child) => (
            <SelectionNode
              key={child.id}
              node={child}
              depth={depth + 1}
              byParent={byParent}
              collapsed={collapsed}
              onToggle={onToggle}
              onCollapse={onCollapse}
              onPreview={onPreview}
              previewId={previewId}
              register={register}
              unregister={unregister}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * @typedef {Object} PreparedNode
 * @property {string} id
 * @property {string} [parentId]
 * @property {import('./selection-tree-values.js').SelectionNodeKind} kind
 * @property {import('./selection-tree-values.js').SelectionNodeState} state
 * @property {string} label
 * @property {string} [sessionId]
 * @property {string} [harness]
 * @property {number} [childCount]
 * @property {boolean} locked
 */

/**
 * @param {readonly SelectionTreeNode[]} nodes
 */
function prepareForest(nodes) {
  /** @type {PreparedNode[]} */
  const parsed = []
  const dropped = new Set()
  let unknownKind = 0
  let unknownState = 0
  let unreadable = 0
  let duplicates = 0
  const seenIds = new Set()

  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || node.id === '') {
      unreadable += 1
      continue
    }
    if (seenIds.has(node.id)) {
      duplicates += dropped.has(node.id) ? 1 : 2
      dropped.add(node.id)
      continue
    }
    seenIds.add(node.id)
    let kind
    try {
      kind = parseNodeKind(node.kind)
    } catch {
      unknownKind += 1
      dropped.add(node.id)
      continue
    }
    let state
    try {
      state = parseNodeState(node.state)
    } catch {
      unknownState += 1
      dropped.add(node.id)
      continue
    }
    parsed.push({
      id: node.id,
      parentId: typeof node.parentId === 'string' && node.parentId !== '' ? node.parentId : undefined,
      kind,
      state,
      label: typeof node.label === 'string' ? node.label : '',
      sessionId: typeof node.sessionId === 'string' ? node.sessionId : undefined,
      harness: typeof node.harness === 'string' && node.harness !== '' ? node.harness : undefined,
      childCount: typeof node.childCount === 'number' ? node.childCount : undefined,
      locked: node.locked === true,
    })
  }

  let changed = true
  while (changed) {
    changed = false
    for (const node of parsed) {
      if (dropped.has(node.id) || !node.parentId || !dropped.has(node.parentId)) continue
      dropped.add(node.id)
      changed = true
    }
  }

  const candidates = parsed.filter((node) => !dropped.has(node.id))
  /** @type {Map<string, PreparedNode[]>} */
  const byParent = new Map()
  /** @type {PreparedNode[]} */
  const roots = []
  for (const node of candidates) {
    const parent = node.parentId
    if (!parent) {
      roots.push(node)
      continue
    }
    const list = byParent.get(parent) ?? []
    list.push(node)
    byParent.set(parent, list)
  }

  const reached = new Set()
  const pending = [...roots]
  while (pending.length) {
    const node = pending.pop()
    if (reached.has(node.id)) continue
    reached.add(node.id)
    pending.push(...(byParent.get(node.id) ?? []))
  }
  const visible = candidates.filter((node) => reached.has(node.id))

  return {
    visible,
    roots,
    byId: new Map(visible.map((node) => [node.id, node])),
    byParent,
    unknownKind,
    unknownState,
    unreadable,
    unreachable: candidates.length - visible.length,
    duplicates,
  }
}

/**
 * @param {PreparedNode} node
 * @param {ReadonlyMap<string, readonly PreparedNode[]>} byParent
 * @returns {string[]}
 */
function actionableSessionIds(node, byParent) {
  /** @type {string[]} */
  const ids = []
  const walk = (/** @type {PreparedNode} */ current) => {
    if (current.locked) return
    if (current.kind === SelectionNodeKind.Session) ids.push(current.id)
    for (const child of byParent.get(current.id) ?? []) walk(child)
  }
  walk(node)
  return ids
}

/**
 * @param {ReadonlySet<string>} next
 * @param {readonly PreparedNode[]} roots
 * @param {ReadonlyMap<string, readonly PreparedNode[]>} byParent
 * @param {readonly string[]} previous
 * @returns {string[]}
 */
function reportSelection(next, roots, byParent, previous) {
  /** @type {string[]} */
  const ordered = []
  const seen = new Set()
  const walk = (/** @type {readonly PreparedNode[]} */ list) => {
    for (const node of list) {
      if (node.kind === SelectionNodeKind.Session && next.has(node.id) && !seen.has(node.id)) {
        ordered.push(node.id)
        seen.add(node.id)
      }
      walk(byParent.get(node.id) ?? [])
    }
  }
  walk(roots)
  for (const id of previous) {
    if (next.has(id) && !seen.has(id)) {
      ordered.push(id)
      seen.add(id)
    }
  }
  return ordered
}

/**
 * @param {ReadonlySet<string> | readonly string[]} value
 * @returns {readonly string[]}
 */
function idsFromValue(value) {
  if (value instanceof Set) return [...value]
  if (Array.isArray(value)) return [...value]
  throw new TypeError(
    'SelectionTree failed in src/ui/SelectionTree.jsx: value must be a Set or an array of session-node ids, ' +
      `received ${value === null ? 'null' : typeof value}. ` +
      'Pass the full set last reported by onSelectionChange. ' +
      'Do not pass a paging cursor or a second tree.',
  )
}

/**
 * @param {number} unknownKind
 * @param {number} unknownState
 * @param {number} unreadable
 * @param {number} unreachable
 * @param {number} duplicates
 * @returns {string}
 */
function diagnosticText(unknownKind, unknownState, unreadable, unreachable, duplicates) {
  /** @type {string[]} */
  const parts = []
  if (unknownKind > 0) parts.push(`${formatInteger(unknownKind)} ${rows(unknownKind)} hidden: unknown kind`)
  if (unknownState > 0) parts.push(`${formatInteger(unknownState)} ${rows(unknownState)} hidden: unknown state`)
  if (unreadable > 0) parts.push(`${formatInteger(unreadable)} ${rows(unreadable)} hidden: missing id`)
  if (unreachable > 0) parts.push(`${formatInteger(unreachable)} ${rows(unreachable)} hidden: missing parent or cycle`)
  if (duplicates > 0) parts.push(`${formatInteger(duplicates)} duplicate ${rows(duplicates)} hidden`)
  return parts.join('. ')
}

/**
 * @param {number} count
 * @returns {string}
 */
function rows(count) {
  return count === 1 ? 'row' : 'rows'
}
