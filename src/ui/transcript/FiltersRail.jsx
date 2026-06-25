import { useState } from 'react'
import {
  ChevronDown, ChevronRight, AlertTriangle, RefreshCw, RotateCcw,
  Pencil, Terminal, BookOpen, Search, Globe, ListChecks, Wrench,
  ArrowUpToLine, ArrowDownToLine,
} from 'lucide-react'
import { TOOL_GROUPS } from './view-model.js'
import FilterSection from './FilterSection.jsx'
import CheckRow from './CheckRow.jsx'
import ViewSwitch from './ViewSwitch.jsx'

/* FiltersRail — the right rail's filter surface, lifted verbatim from the canonical mockup
   (src/mockups/inuse/TranscriptApp.jsx:1801). DUMB: it renders the cooked filter STATE
   (`TranscriptFilters`) the composite owns and reports every change through ONE
   `onFiltersChange(next)` callback — no per-field setter scatter. Counts come cooked off the
   view model (`counts.categories` derived from the turns; `counts.toolGroups` from
   `vm.filterIndex.toolGroupCounts`); the checkpoint selector renders from the cooked
   `session.git.commits` (render-when-present). The section disclosure + checkpoint-popover
   open states are local UI, kept internal exactly as in the mockup. Exported as
   `TranscriptFiltersRail`. */

/** @typedef {import('./state-capabilities.js').TranscriptFilters} TranscriptFilters */
/** @typedef {import('./view-model.js').ToolGroup} ToolGroup */
/** @typedef {import('./view-model.js').CommitVM} CommitVM */

/* tool-group label + glyph — PRESENTATION metadata keyed by the cooked ToolGroup id (counts
   are data, sourced from the VM). Ordered by the canonical TOOL_GROUPS array. */
const TOOL_GROUP_META = {
  edits: { label: 'file edits', icon: Pencil },
  bash: { label: 'bash', icon: Terminal },
  read: { label: 'read', icon: BookOpen },
  search: { label: 'search', icon: Search },
  fetch: { label: 'fetch', icon: Globe },
  tasks: { label: 'tasks', icon: ListChecks },
  other: { label: 'other', icon: Wrench },
}

/**
 * @param {object} props
 * @param {import('./state-capabilities.js').TranscriptTab} props.tab
 * @param {TranscriptFilters} props.filters
 * @param {(next: TranscriptFilters) => void} [props.onFiltersChange]
 * @param {{ categories: { prompts: number, responses: number, thinking: number, toolcalls: number }, toolGroups: Partial<Record<ToolGroup, number>> }} [props.counts]
 * @param {CommitVM[]} [props.checkpoints]    cooked session commits → the checkpoint selector (render-when-present)
 * @param {number} [props.filtersActive]
 * @param {Function} [props.onClear]
 * @param {Function} [props.onJumpStart]
 * @param {Function} [props.onJumpLatest]
 */
/* a self-sufficient default so the rail renders standalone (the composite always passes a
   cooked TranscriptFilters; this is the unmanaged fallback). */
const DEFAULT_FILTERS = {
  categories: { prompts: true, responses: true, thinking: true, toolcalls: true },
  toolGroups: {},
  tags: { errors: false, retries: false, revert: false },
  views: { hidden: true, expandAll: false, compact: false },
  checkpoint: 'all',
}

export default function FiltersRail({
  tab,
  filters = DEFAULT_FILTERS,
  onFiltersChange = () => {},
  counts = { categories: { prompts: 0, responses: 0, thinking: 0, toolcalls: 0 }, toolGroups: {} },
  checkpoints = [],
  filtersActive = 0,
  onClear = () => {},
  onJumpStart = () => {},
  onJumpLatest = () => {},
}) {
  const [toolGroupsOpen, setToolGroupsOpen] = useState(true)
  const [checkpointOpen, setCheckpointOpen] = useState(false)

  const { categories, toolGroups, tags, views, checkpoint } = filters
  const patchCategories = (patch) => onFiltersChange({ ...filters, categories: { ...categories, ...patch } })
  const patchTags = (patch) => onFiltersChange({ ...filters, tags: { ...tags, ...patch } })
  const patchViews = (patch) => onFiltersChange({ ...filters, views: { ...views, ...patch } })
  const toggleToolGroup = (id) => onFiltersChange({ ...filters, toolGroups: { ...toolGroups, [id]: !toolGroups[id] } })
  const setCheckpoint = (cp) => onFiltersChange({ ...filters, checkpoint: cp })

  if (tab !== 'trace' && tab !== 'highlights') {
    return <div className="txn-filter-ph">filters are not available for this view yet.</div>
  }

  if (tab === 'highlights') {
    return (
      <div className="txn-filters">
        <FilterSection title="outcome">
          <CheckRow checked={tags.errors} onChange={() => patchTags({ errors: !tags.errors })}>errors</CheckRow>
          <CheckRow checked={tags.retries} onChange={() => patchTags({ retries: !tags.retries })}>retries</CheckRow>
          <CheckRow checked={tags.revert} onChange={() => patchTags({ revert: !tags.revert })}>re-edit</CheckRow>
        </FilterSection>
      </div>
    )
  }

  return (
    <div className="txn-filters">
      <div className="txn-filters-top">
        <span className="txn-filters-cap">categories</span>
        {filtersActive > 0 && (
          <button type="button" className="txn-clear" onClick={onClear}>clear ({filtersActive})</button>
        )}
      </div>

      <div className="txn-catlist">
        <CheckRow checked={categories.prompts} onChange={() => patchCategories({ prompts: !categories.prompts })} count={counts.categories.prompts}>prompts</CheckRow>
        <CheckRow checked={categories.responses} onChange={() => patchCategories({ responses: !categories.responses })} count={counts.categories.responses}>responses</CheckRow>
        <CheckRow checked={categories.thinking} onChange={() => patchCategories({ thinking: !categories.thinking })} count={counts.categories.thinking}>thinking</CheckRow>
        <div className="txn-toolcat">
          <CheckRow checked={categories.toolcalls} onChange={() => patchCategories({ toolcalls: !categories.toolcalls })} count={counts.categories.toolcalls}>
            <button type="button" className="txn-toolcat-toggle" aria-expanded={toolGroupsOpen} onClick={(e) => { e.preventDefault(); setToolGroupsOpen((o) => !o) }}>
              tool calls {toolGroupsOpen ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
            </button>
          </CheckRow>
          {toolGroupsOpen && (
            <div className="txn-toolgroups">
              {TOOL_GROUPS.map((id) => {
                const meta = TOOL_GROUP_META[id]
                const Icon = meta.icon
                const count = counts.toolGroups[id] ?? 0
                return (
                  <label key={id} className="txn-checkrow txn-subcheck">
                    <input type="checkbox" className="check-box" checked={toolGroups[id] ?? true} disabled={count === 0} onChange={() => toggleToolGroup(id)} />
                    <span className="txn-cr-label"><Icon size={13} aria-hidden="true" /> {meta.label}</span>
                    <span className="txn-cr-count tnum">{count}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="txn-filter-divider" />
      <span className="txn-filters-cap">semantic tags</span>
      <div className="txn-catlist">
        <CheckRow checked={tags.errors} onChange={() => patchTags({ errors: !tags.errors })}>
          <AlertTriangle size={13} aria-hidden="true" className="txn-tag-err" /> errors
        </CheckRow>
        <CheckRow checked={tags.retries} onChange={() => patchTags({ retries: !tags.retries })}>
          <RefreshCw size={13} aria-hidden="true" /> retries
        </CheckRow>
        <CheckRow checked={tags.revert} onChange={() => patchTags({ revert: !tags.revert })}>
          <RotateCcw size={13} aria-hidden="true" /> re-edit
        </CheckRow>
      </div>

      {checkpoints.length > 0 && (
        <>
          <div className="txn-filter-divider" />
          <span className="txn-filters-cap">checkpoints</span>
          <div className="txn-cp-select">
            <button type="button" className="select txn-cp-trigger" aria-expanded={checkpointOpen} aria-haspopup="listbox" onClick={() => setCheckpointOpen((o) => !o)}>
              <span className="mono">
                {checkpoint === 'all'
                  ? `all checkpoints (${checkpoints.length})`
                  : (() => {
                      const sel = checkpoints.find((c) => c.hash === checkpoint || c.shortHash === checkpoint)
                      return sel ? `${sel.shortHash} · ${sel.message}` : checkpoint
                    })()}
              </span>
              <ChevronDown size={13} aria-hidden="true" />
            </button>
            {checkpointOpen && (
              <div className="menu-pop txn-cp-pop" role="listbox">
                <button type="button" role="option" aria-selected={checkpoint === 'all'} className="txn-cp-opt" onClick={() => { setCheckpoint('all'); setCheckpointOpen(false) }}>all checkpoints ({checkpoints.length})</button>
                {checkpoints.map((c) => (
                  <button key={c.hash} type="button" role="option" aria-selected={checkpoint === c.shortHash} className="txn-cp-opt" onClick={() => { setCheckpoint(c.shortHash); setCheckpointOpen(false) }}>
                    <span className="mono txn-cp-hash">{c.shortHash}</span>
                    <span className="txn-cp-detail">{c.message}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="txn-filter-divider" />
      <span className="txn-filters-cap">view options</span>
      <div className="txn-views">
        <ViewSwitch label="show hidden indicators" on={views.hidden} onToggle={() => patchViews({ hidden: !views.hidden })} />
        <ViewSwitch label="expand all tool calls" on={views.expandAll} onToggle={() => patchViews({ expandAll: !views.expandAll })} />
        <ViewSwitch label="compact mode" on={views.compact} onToggle={() => patchViews({ compact: !views.compact })} />
      </div>

      <div className="txn-filter-divider" />
      <span className="txn-filters-cap">jump to</span>
      <div className="txn-jumprow">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onJumpStart}><ArrowUpToLine size={14} aria-hidden="true" /> start</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onJumpLatest}><ArrowDownToLine size={14} aria-hidden="true" /> latest</button>
      </div>
    </div>
  )
}
