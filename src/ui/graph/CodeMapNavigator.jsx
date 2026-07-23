import { useMemo, useRef, useState } from 'react'
import { ChevronRight, FileCode, Folder, Map as MapIcon, Search } from 'lucide-react'
import { createCodeMapState, deriveCodeMapView } from './codeMapState.js'

/**
 * CodeMapNavigator presents the code tree as a readable, keyboard-operable
 * starting point. Hosts keep selection, expansion, focus, and filter state so
 * a transition to the spatial canvas and back is lossless.
 *
 * @param {object} props
 * @param {import('./types.js').CodeMapPayload} props.payload
 * @param {'project'|'package'|'file'} [props.grain='package']
 * @param {Iterable<string>} [props.expandedIds]
 * @param {(ids:string[])=>void} [props.onExpandedIdsChange]
 * @param {string|null} [props.selectedId]
 * @param {(id:string|null, node:import('./types.js').MapNodePayload|null)=>void} [props.onSelect]
 * @param {string|null} [props.focusedId]
 * @param {(id:string|null)=>void} [props.onFocusChange]
 * @param {string} [props.filter='']
 * @param {(filter:string)=>void} [props.onFilterChange]
 * @param {(id:string)=>void} [props.onOpenMap]
 * @param {(action:import('./codeMapState.js').CodeMapAction)=>void} [props.onStateAction]
 * @param {string} [props.ariaLabel='code map navigator']
 */
export default function CodeMapNavigator({
  payload,
  grain = 'package',
  expandedIds,
  onExpandedIdsChange,
  selectedId = null,
  onSelect,
  focusedId,
  onFocusChange,
  filter = '',
  onFilterChange,
  onOpenMap,
  onStateAction,
  ariaLabel = 'code map navigator',
}) {
  const [internalExpanded, setInternalExpanded] = useState(() => new Set())
  const [internalFocus, setInternalFocus] = useState(null)
  const expanded = expandedIds === undefined ? internalExpanded : new Set(expandedIds)
  const effectiveFocus = focusedId === undefined ? internalFocus : focusedId
  const refs = useRef(new Map())

  const view = useMemo(() => deriveCodeMapView(payload, createCodeMapState({
    grain,
    expandedIds: Array.from(expanded),
    selectedId,
    navigatorFocusedId: effectiveFocus,
    navigatorFilter: filter,
  })), [payload, grain, expandedIdsKey(expanded), selectedId, effectiveFocus, filter])
  const visible = view.rows
  const visibleFocus = view.focusedId
  const selected = view.selected
  const selectedRow = selected ? visible.find((row) => row.node.id === selected.id) : null
  const selectedCanExpand = !!selectedRow?.canExpand && !selectedRow.forcedOpen

  function updateExpanded(next) {
    if (expandedIds === undefined) setInternalExpanded(next)
    onStateAction?.({ type: 'set-expanded', ids: Array.from(next) })
    onExpandedIdsChange?.(Array.from(next))
  }

  function toggle(id) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    updateExpanded(next)
  }

  function publishFocus(id) {
    if (focusedId === undefined) setInternalFocus(id)
    onStateAction?.({ type: 'focus', id })
    onFocusChange?.(id)
    refs.current.get(id)?.focus()
  }

  function select(node) {
    if (focusedId === undefined) setInternalFocus(node.id)
    refs.current.get(node.id)?.focus()
    onStateAction?.({ type: 'select', id: node.id })
    onFocusChange?.(node.id)
    onSelect?.(node.id, node)
  }

  function onTreeKeyDown(event, rowIndex) {
    const row = visible[rowIndex]
    if (!row) return
    const { node } = row
    let nextId = null
    if (event.key === 'ArrowDown') nextId = visible[Math.min(rowIndex + 1, visible.length - 1)]?.node.id
    else if (event.key === 'ArrowUp') nextId = visible[Math.max(rowIndex - 1, 0)]?.node.id
    else if (event.key === 'Home') nextId = visible[0]?.node.id
    else if (event.key === 'End') nextId = visible[visible.length - 1]?.node.id
    else if (event.key === 'ArrowRight' && (row.canExpand || row.forcedOpen)) {
      if (row.forcedOpen || row.expanded) nextId = row.childIds[0] ?? null
      else if (!expanded.has(node.id)) toggle(node.id)
    } else if (event.key === 'ArrowLeft') {
      if (!row.forcedOpen && row.canExpand && row.expanded) toggle(node.id)
      else nextId = row.parentId
    } else if (event.key === 'Enter' || event.key === ' ') {
      select(node)
      event.preventDefault()
      return
    } else {
      return
    }
    event.preventDefault()
    if (nextId) publishFocus(nextId)
  }

  return (
    <section className="gmp-navigator" aria-label={ariaLabel}>
      <header className="gmp-navigator-head">
        <div>
          <p className="gmp-navigator-kicker">browse the codebase</p>
          <p className="gmp-navigator-note">
            choose an area for its recorded work, then open the spatial map when relationships matter
          </p>
        </div>
        <label className="gmp-navigator-search">
          <Search aria-hidden="true" />
          <span className="mc-sr">filter code areas</span>
          <input
            value={filter}
            onChange={(event) => {
              onStateAction?.({ type: 'set-filter', filter: event.target.value })
              onFilterChange?.(event.target.value)
            }}
            placeholder="filter paths"
          />
        </label>
      </header>

      {view.staleSelectedId ? (
        <p className="gmp-navigator-missing" role="status">
          the selected code area is not present in this map.{' '}
          <button type="button" onClick={() => {
            onStateAction?.({ type: 'clear-selection' })
            onSelect?.(null, null)
          }}>clear selection</button>
        </p>
      ) : null}

      <div className="gmp-navigator-body">
        <div
          role="tree"
          aria-label="code areas"
          className="gmp-navigator-tree"
          data-grain={grain}
        >
          {visible.length === 0 ? (
            <p className="gmp-navigator-empty" role="status">no code areas match this filter</p>
          ) : visible.map((row, index) => {
            const hasChildren = row.canExpand || row.forcedOpen
            const isExpanded = row.expanded
            const tabbable = visibleFocus === row.node.id
            return <NavigatorRow
              key={row.node.id}
              row={row}
              hasChildren={hasChildren}
              isExpanded={isExpanded}
              selected={selectedId === row.node.id}
              tabbable={tabbable}
              setRef={(element) => {
                if (element) refs.current.set(row.node.id, element)
                else refs.current.delete(row.node.id)
              }}
              onFocus={() => {
                if (focusedId === undefined) setInternalFocus(row.node.id)
              }}
              onSelect={() => select(row.node)}
              onToggle={() => {
                if (!row.forcedOpen) toggle(row.node.id)
              }}
              onKeyDown={(event) => onTreeKeyDown(event, index)}
            />
          })}
        </div>

        <aside className="gmp-navigator-actions" aria-label="selected code area">
          {selected ? (
            <>
              <p className="gmp-navigator-selected">{selected.name || selected.id}</p>
              <p className="gmp-navigator-selected-path">{selected.id}</p>
              {selectedCanExpand ? (
                <button type="button" className="gmp-navigator-action" onClick={() => toggle(selected.id)}>
                  <ChevronRight aria-hidden="true" />
                  {expanded.has(selected.id) ? 'hide children' : 'show children'}
                </button>
              ) : null}
              <button type="button" className="gmp-navigator-action gmp-navigator-action--primary" onClick={() => {
                onStateAction?.({ type: 'open-in-map', id: selected.id })
                onOpenMap?.(selected.id)
              }}>
                <MapIcon aria-hidden="true" /> open in map
              </button>
            </>
          ) : (
            <p className="gmp-navigator-empty">select an area to see its recorded work and map context</p>
          )}
        </aside>
      </div>
    </section>
  )
}

function NavigatorRow({ row, hasChildren, isExpanded, selected, tabbable, setRef, onFocus, onSelect, onToggle, onKeyDown }) {
  return (
    <div
      role="none"
      className="gmp-navigator-row-wrap"
      data-selected={selected}
      style={{ '--gmp-tree-depth': row.depth }}
    >
      {hasChildren ? (
        <button
          type="button"
          className="gmp-navigator-disclosure"
          tabIndex={-1}
          aria-label={`${isExpanded ? 'hide' : 'show'} children for ${row.node.name || row.node.id}`}
          aria-expanded={isExpanded}
          aria-disabled={row.forcedOpen ? 'true' : undefined}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            if (!row.forcedOpen) onToggle()
          }}
        >
          <ChevronRight className="gmp-navigator-chevron" aria-hidden="true" />
        </button>
      ) : <span className="gmp-navigator-disclosure-placeholder" aria-hidden="true" />}
      <div
        ref={setRef}
        role="treeitem"
        aria-level={row.depth + 1}
        aria-selected={selected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        tabIndex={tabbable ? 0 : -1}
        className="gmp-navigator-row"
        onFocus={onFocus}
        onClick={onSelect}
        onDoubleClick={() => {
          if (hasChildren && !row.forcedOpen) onToggle()
        }}
        onKeyDown={onKeyDown}
      >
        {row.node.kind === 'file' ? <FileCode aria-hidden="true" /> : <Folder aria-hidden="true" />}
        <span className="gmp-navigator-path">{row.node.name || row.node.id}</span>
        <span className="gmp-navigator-meta">
          <span>{formatCount(row.node.loc ?? 0)} lines</span>
          <span>{formatCoverage(row.node.recordedFiles, row.node.totalFiles)}</span>
        </span>
      </div>
    </div>
  )
}

function expandedIdsKey(ids) {
  return Array.from(ids).sort().join('\u0000')
}

function formatCount(value) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
}

function formatCoverage(recorded, total) {
  const denominator = Number(total) || 0
  if (denominator <= 0) return 'no coverage data'
  return `${Math.round(((Number(recorded) || 0) / denominator) * 100)}% recorded`
}
