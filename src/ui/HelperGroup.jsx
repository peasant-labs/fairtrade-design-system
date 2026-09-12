import { Fragment, useId, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, Unlink } from 'lucide-react'
import BrandMark from './BrandMark.jsx'
import Checkbox from './Checkbox.jsx'

/**
 * HelperGroup - a collapsed count of saved threads whose members read as
 * ordinary list rows.
 *
 * Presentation only: the host passes the complete authorized member set for the
 * exact scope. No wire decoding, membership inference, fetching, paging, or
 * selection storage occurs here. renderMember receives the original row,
 * including its route-specific data.
 *
 * The control is the session-group disclosure the product already uses for
 * grouped rows: a full-width button with a leading chevron, the count in
 * tabular mono, and show/hide on the trailing edge. It is indented under the
 * owner row it hangs from, and its member rows appear ONLY while it is open,
 * separated from the control by a top rule. Each member uses the same row
 * anatomy as the row it hangs under, so a folded member and a visible one are
 * recognizably the same thing.
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
 */
export default function HelperGroup(props) {
  // A changed query token cannot inherit an uncontrolled disclosure from an old query.
  return <HelperGroupDisclosure key={`${props.groupId}:${props.memberScope}`} {...props} />
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

function HelperGroupDisclosure({
  groupId, memberScope, helperThreadCount, members = [], renderMember, getMemberKey,
  expanded, onExpandedChange, scopeExpired = false, onRefreshList, isMemberSelected,
}) {
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

  return (
    <div className="helper-group" data-group-id={groupId}>
      <button type="button" className="helper-group-trigger" id={`${id}-trigger`}
        aria-expanded={open} aria-controls={`${id}-body`} onClick={toggle}>
        {open
          ? <ChevronDown className="helper-group-chevron" aria-hidden="true" />
          : <ChevronRight className="helper-group-chevron" aria-hidden="true" />}
        <span className="helper-group-count" data-testid="helper-group-label">
          {helperThreadGroupSelectionLabel(helperThreadCount, selectedCount)}
        </span>
        <span className="helper-group-spacer" aria-hidden="true" />
        <span className="helper-group-show">{open ? 'hide' : 'show'}</span>
      </button>
      {/* The members exist only while the control is open, exactly like the
          session-group rows below a list: a folded row cannot be mistaken for a
          visible one, and nothing hidden holds the page's height. */}
      {open && (
        <div id={`${id}-body`} className="helper-group-body">
          {scopeExpired ? (
            <div className="helper-group-notice">
              <p>the saved helper query expired. no broader results were loaded. refresh the originating list to restore its filters.</p>
              {onRefreshList && <button type="button" className="helper-group-action" onClick={onRefreshList}>
                <RefreshCw aria-hidden="true" /> refresh list
              </button>}
            </div>
          ) : members.length ? <ul className="helper-group-members">
            {members.map((row) => <li key={getMemberKey(row)}>{renderMember(row)}</li>)}
          </ul> : <p className="helper-group-notice">no saved helpers match the current query and access.</p>}
        </div>
      )}
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
 * Retains an ordinary row unchanged above its immediate helper groups. For a
 * helper-only result supply ownerStatus instead of owner; no fake title or owner
 * action is rendered. Keep distinct unresolved containers keyed by backend group ID.
 * @param {object} props
 * @param {import('react').ReactNode} [props.owner]
 * @param {string} [props.ownerStatus]
 * @param {import('react').ReactNode} props.children - immediate HelperGroup children
 */
export function HelperGroupListItem({ owner, ownerStatus, children }) {
  if (owner == null && !Object.hasOwn(OWNER_COPY, ownerStatus)) {
    throw new Error('HelperGroupListItem render failed: owner context has no supported status; no owner can be safely displayed. Pass the authorized context ownerStatus from the grouped list.')
  }
  return <div className="helper-group-item">
    {owner ?? <p className="helper-group-context"><Unlink aria-hidden="true" />{OWNER_COPY[ownerStatus]}</p>}
    <div className="helper-group-nested">{children}</div>
  </div>
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
 * @param {(id: string, selected: boolean) => void} [props.onSelect]
 * @param {import('react').ReactNode} [props.children]
 */
export function HelperThreadRow({ id, title, provider, inputSubmissionCount, turnCount,
  href, onOpen, selected = false, selectionDisabled = false, onSelect, children }) {
  const facts = []
  if (provider) facts.push({ key: 'provider', node: <span className="helper-thread-provider"><BrandMark name={provider} />{provider}</span> })
  facts.push({ key: 'inputs', node: <span>{inputSubmissionCount === undefined
    ? 'unknown input submissions'
    : `${inputSubmissionCount} input submission${inputSubmissionCount === 1 ? '' : 's'}`}</span> })
  facts.push({ key: 'turns', node: <span>{turnCount === undefined
    ? 'unknown turns'
    : `${turnCount} turn${turnCount === 1 ? '' : 's'}`}</span> })
  return <div className="helper-thread-row" data-thread-id={id}>
    <div className="helper-thread-main">
      {onSelect && <Checkbox checked={selected} disabled={selectionDisabled}
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
      </div>
    </div>
    {children}
  </div>
}
