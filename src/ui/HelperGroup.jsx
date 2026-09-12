import { useId, useState } from 'react'
import { ChevronDown, CornerDownRight, RefreshCw, ShieldCheck, Unlink } from 'lucide-react'
import BrandMark from './BrandMark.jsx'
import Checkbox from './Checkbox.jsx'

/**
 * HelperGroup - collapsed saved-thread disclosure rendering its members as
 * subagent-inset rows.
 *
 * Presentation only: the host passes the complete authorized member set for the
 * exact scope. No wire decoding, membership inference, fetching, paging, or
 * selection aggregation occurs here. renderMember receives the original row,
 * including its route-specific data.
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
 */
export default function HelperGroup(props) {
  // A changed query token cannot inherit an uncontrolled disclosure from an old query.
  return <HelperGroupDisclosure key={`${props.groupId}:${props.memberScope}`} {...props} />
}

function HelperGroupDisclosure({
  groupId, memberScope, helperThreadCount, members = [], renderMember, getMemberKey,
  expanded, onExpandedChange, scopeExpired = false, onRefreshList,
}) {
  const id = useId()
  const [localExpanded, setLocalExpanded] = useState(false)
  const open = expanded ?? localExpanded

  const toggle = () => {
    const next = !open
    if (expanded === undefined) setLocalExpanded(next)
    onExpandedChange?.(next)
  }

  return (
    <section className="helper-group" data-group-id={groupId}>
      <button type="button" className="helper-group-trigger" id={`${id}-trigger`}
        aria-expanded={open} aria-controls={`${id}-body`} onClick={toggle}>
        <ShieldCheck aria-hidden="true" />
        <span>guardian reviews</span>
        <span className="helper-group-count">{helperThreadCount} saved helper threads</span>
        <ChevronDown className="helper-group-chevron" aria-hidden="true" />
      </button>
      <div id={`${id}-body`} role="region" aria-labelledby={`${id}-trigger`} hidden={!open}>
        <div className="helper-group-body">
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
      </div>
    </section>
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
 * One helper member as a subagent-inset row: indented with the CornerDownRight
 * marker, inline in the group. Display-only when selection and navigation are
 * both absent. The two optional behaviors are individual-only: a per-thread
 * checkbox and host-authorized open navigation. No aggregate selection, no
 * self-built links, no per-row disclosure. Hosts map scalar display props from
 * their typed row and preserve route-specific status/usage/ordinary-child exits
 * in children. These are UI props, not another wire DTO.
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
  return <div className="helper-thread-row" data-thread-id={id}>
    <div className="helper-thread-main">
      {onSelect && <Checkbox checked={selected} disabled={selectionDisabled}
        aria-label={`select ${title} (${id})`} onChange={(checked) => onSelect(id, checked)} />}
      <CornerDownRight className="helper-thread-marker" aria-hidden="true" />
      {href ? <a className="helper-thread-open" href={href} onClick={(event) => onOpen?.(id, event)}>{title}</a>
        : onOpen ? <button type="button" className="helper-thread-open" onClick={(event) => onOpen(id, event)}>{title}</button>
          : <span className="helper-thread-title">{title}</span>}
    </div>
    <div className="helper-thread-meta">
      {provider && <span className="helper-thread-provider"><BrandMark name={provider} />{provider}</span>}
      <span>{inputSubmissionCount === undefined ? 'unknown' : inputSubmissionCount} input submissions</span>
      <span>{turnCount === undefined ? 'unknown' : turnCount} turns</span>
    </div>
    {children}
  </div>
}
