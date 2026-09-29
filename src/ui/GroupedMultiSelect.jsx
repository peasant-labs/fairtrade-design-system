import { useCallback, useId, useMemo, useState } from 'react'
import { Check, Minus, ChevronRight, Search } from 'lucide-react'
import { matchesQuery } from './match-query.js'
import './GroupedMultiSelect.css'

/* GroupedMultiSelect — a project-grouped tri-state multi-select tree, modelled on peasant's
   SessionPicker (project rows as the primary unit, a "customize" drill-in to the session sublist)
   and village's contribute panel (sticky select-all + running token tally toolbar).

   shape:
     ┌ toolbar ───────────────────────────────────── sticky ┐
     │ [☑] select all      N selected · 12.3k tokens         │
     ├──────────────────────────────────────────────────────┤
     │ [☑] ingest-pipeline      4 · 8.1k tokens          [v] │   ← group row
     │     [☑] parse raw events           42 turns  2.0k     │   ← item rows (when open)
     │     [☐] backfill historical        18 turns  1.1k     │
     │ [~] auth-service         3 · 4.2k tokens          [>] │   ← partial group
     └──────────────────────────────────────────────────────┘

   tri-state is icon-SHAPED, never colour-only (neuroinclusive / WCAG 1.4.1): a drawn check when
   all selected, a dash `[~]` when some, an empty box when none. the same three glyphs are used at
   group and item level (items are binary, so only check / empty).

   selection state is a Set of item ids, owned by the caller (controlled) or internal (uncontrolled
   via defaultValue). all classes are namespaced gms-; every dimension/colour is a token from
   src/index.css — no hardcoded hex or px. chrome is lowercase; user content (group/item labels) is
   rendered verbatim, never lowercased. */

/**
 * @typedef {Object} GMSItem
 * @property {string} id                      unique selection id (what lands in the value Set).
 * @property {import('react').ReactNode} label  the item title — user content, rendered verbatim.
 * @property {import('react').ReactNode} [meta]  one-line secondary metadata (e.g. "42 turns · jun 3").
 * @property {number} [tokens]                token count for the running tally; defaults to 0.
 * @property {string} [searchText]            the text a search matches; defaults to a string `label`.
 */

/**
 * @typedef {Object} GMSGroup
 * @property {string} id                      unique group id.
 * @property {import('react').ReactNode} label  the group title — user content, rendered verbatim.
 * @property {GMSItem[]} items                the group's selectable items.
 */

/**
 * @typedef {Object} GroupedMultiSelectProps
 * @property {GMSGroup[]} groups              the project-grouped tree to render.
 * @property {Set<string>} [value]            controlled set of selected item ids; pair with onChange.
 * @property {Set<string>} [defaultValue]     initial selection for uncontrolled use.
 * @property {(next: Set<string>) => void} [onChange]  called with the next selection Set on any toggle.
 * @property {string} [tokenLabel='tokens']   noun for the tally (chrome, lowercased in display).
 * @property {string[]} [defaultOpen]         ids of groups expanded on first render (uncontrolled).
 * @property {string} [ariaLabel]             accessible name for the tree container.
 * @property {boolean} [searchable=false]     adds a search field and a clear button: the search
 *           filters items (by `searchText`, else a string `label`), hides groups left empty,
 *           opens the groups that match, and select all / clear act on the visible items only.
 * @property {string} [searchLabel='search']  the search field's label.
 */

/* compact numeric formatter for the token tallies: 8120 -> "8.1k", 1_200_000 -> "1.2m". keeps the
   numbers narrow so the tabular columns line up regardless of magnitude. */
function formatTokens(n) {
  if (n == null) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

/* the tri-state box: a bordered square whose GLYPH carries the state (not colour) —
   all -> Check, some -> Minus (the [~] partial), none -> empty. `state` is 'all' | 'some' | 'none'. */
function TriBox({ state }) {
  return (
    <span className="gms-box" data-state={state} aria-hidden="true">
      {state === 'all' && <Check className="gms-box-glyph" strokeWidth={3} />}
      {state === 'some' && <Minus className="gms-box-glyph" strokeWidth={3} />}
    </span>
  )
}

/**
 * A grouped tri-state multi-select tree. See GroupedMultiSelectProps.
 * @param {GroupedMultiSelectProps} props
 */
export default function GroupedMultiSelect({
  groups = [],
  value,
  defaultValue,
  onChange,
  tokenLabel = 'tokens',
  defaultOpen = [],
  ariaLabel = 'grouped multi-select',
  searchable = false,
  searchLabel = 'search',
}) {
  const isControlled = value !== undefined
  const [query, setQuery] = useState('')
  const searchId = useId()
  const searching = searchable && query.trim() !== ''
  const itemText = (item) => item.searchText ?? (typeof item.label === 'string' ? item.label : '')
  const visibleGroups = useMemo(
    () => (searching
      ? groups.map((g) => ({ ...g, items: g.items.filter((it) => matchesQuery(itemText(it), query)) })).filter((g) => g.items.length > 0)
      : groups),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, query, searching],
  )
  const [internal, setInternal] = useState(() => new Set(defaultValue ?? []))
  const selected = isControlled ? value : internal

  const [open, setOpen] = useState(() => new Set(defaultOpen))

  const commit = useCallback(
    (next) => {
      if (!isControlled) setInternal(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )

  // every VISIBLE selectable id — the target of the toolbar select-all and clear. without a search
  // this is every item; with one, only the items the search shows.
  const allIds = useMemo(
    () => visibleGroups.flatMap((g) => g.items.map((it) => it.id)),
    [visibleGroups],
  )

  // running tallies: selected item count + summed tokens of the selected set.
  const { selectedCount, selectedTokens } = useMemo(() => {
    let count = 0
    let tokens = 0
    for (const g of groups) {
      for (const it of g.items) {
        if (selected.has(it.id)) {
          count += 1
          tokens += it.tokens ?? 0
        }
      }
    }
    return { selectedCount: count, selectedTokens: tokens }
  }, [groups, selected])

  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const noneSelected = !allIds.some((id) => selected.has(id))
  const toolbarState = allSelected ? 'all' : noneSelected ? 'none' : 'some'

  const toggleItem = useCallback(
    (id) => {
      const next = new Set(selected)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      commit(next)
    },
    [selected, commit],
  )

  // toggling a group cascades to all its items (peasant's setProject): if every item is already
  // selected we clear the group, otherwise we add all of them.
  const toggleGroup = useCallback(
    (group) => {
      const ids = group.items.map((it) => it.id)
      const allOn = ids.length > 0 && ids.every((id) => selected.has(id))
      const next = new Set(selected)
      for (const id of ids) {
        if (allOn) next.delete(id)
        else next.add(id)
      }
      commit(next)
    },
    [selected, commit],
  )

  // select all / deselect all over the visible ids, keeping any selection the search hides.
  const toggleSelectAll = useCallback(() => {
    if (!searching) {
      commit(allSelected ? new Set() : new Set(allIds))
      return
    }
    const next = new Set(selected)
    for (const id of allIds) allSelected ? next.delete(id) : next.add(id)
    commit(next)
  }, [allSelected, allIds, commit, selected, searching])

  const clearVisible = useCallback(() => {
    const next = new Set(selected)
    for (const id of allIds) next.delete(id)
    commit(next)
  }, [allIds, commit, selected])

  const toggleOpen = useCallback((id) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="gms" role="group" aria-label={ariaLabel}>
      {searchable && (
        <div className="gms-search">
          <label className="gms-search-label" htmlFor={searchId}>{searchLabel}</label>
          <div className="input-ico">
            <Search className="lucide" aria-hidden="true" />
            <input id={searchId} className="input is-input" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      )}
      {/* sticky toolbar — select-all tri-box + the running selected/token tally (tabular) */}
      <div className="gms-toolbar">
        <button
          type="button"
          className="gms-selectall"
          onClick={toggleSelectAll}
          disabled={allIds.length === 0}
          aria-pressed={allSelected}
        >
          <TriBox state={toolbarState} />
          <span className="gms-selectall-text">select all</span>
        </button>
        {searchable && (
          <button type="button" className="gms-clear" onClick={clearVisible} disabled={noneSelected}>clear</button>
        )}
        <span className="gms-tally" aria-live="polite">
          <span className="gms-tally-count gms-num">{selectedCount}</span>
          <span className="gms-tally-sep"> selected</span>
          <span className="gms-tally-dot" aria-hidden="true">·</span>
          <span className="gms-tally-tokens gms-num">{formatTokens(selectedTokens)}</span>
          <span className="gms-tally-unit"> {tokenLabel}</span>
        </span>
      </div>

      {/* group list */}
      {searching && visibleGroups.length === 0 && <p className="gms-empty">nothing matches “{query.trim()}”.</p>}
      <ul className="gms-groups">
        {visibleGroups.map((group) => {
          const ids = group.items.map((it) => it.id)
          const selInGroup = ids.filter((id) => selected.has(id)).length
          const groupState =
            ids.length > 0 && selInGroup === ids.length
              ? 'all'
              : selInGroup > 0
                ? 'some'
                : 'none'
          const groupTokens = group.items.reduce((sum, it) => sum + (it.tokens ?? 0), 0)
          const isOpen = searching || open.has(group.id)
          const panelId = `gms-${group.id}-items`

          return (
            <li key={group.id} className="gms-group" data-selected={groupState !== 'none' || undefined}>
              <div className="gms-group-row">
                {/* the group tri-state checkbox: cascades to every item in the group */}
                <button
                  type="button"
                  className="gms-toggle"
                  onClick={() => toggleGroup(group)}
                  aria-pressed={groupState === 'all'}
                  aria-label={`select group, ${selInGroup} of ${ids.length} selected`}
                >
                  <TriBox state={groupState} />
                </button>

                {/* the collapse toggle doubles as the group's label/tally surface */}
                <button
                  type="button"
                  className="gms-group-disclosure"
                  onClick={() => toggleOpen(group.id)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  <ChevronRight
                    className="gms-caret"
                    data-open={isOpen || undefined}
                    aria-hidden="true"
                  />
                  <span className="gms-group-label">{group.label}</span>
                  <span className="gms-group-meta">
                    <span className="gms-group-count gms-num">{ids.length}</span>
                    <span className="gms-group-dot" aria-hidden="true">·</span>
                    <span className="gms-group-tokens gms-num">{formatTokens(groupTokens)}</span>
                    <span className="gms-group-unit"> {tokenLabel}</span>
                  </span>
                </button>
              </div>

              {/* item sublist — revealed by the disclosure (peasant's "customize" drill-in) */}
              {isOpen && (
                <ul className="gms-items" id={panelId}>
                  {group.items.map((item) => {
                    const itemSel = selected.has(item.id)
                    return (
                      <li key={item.id} className="gms-item" data-selected={itemSel || undefined}>
                        <button
                          type="button"
                          className="gms-item-row"
                          onClick={() => toggleItem(item.id)}
                          aria-pressed={itemSel}
                        >
                          <TriBox state={itemSel ? 'all' : 'none'} />
                          <span className="gms-item-label">{item.label}</span>
                          {item.meta != null && (
                            <span className="gms-item-meta">{item.meta}</span>
                          )}
                          <span className="gms-item-tokens gms-num">
                            {formatTokens(item.tokens ?? 0)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
