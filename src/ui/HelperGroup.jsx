import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, ShieldCheck, Unlink } from 'lucide-react'
import BrandMark from './BrandMark.jsx'
import Checkbox from './Checkbox.jsx'

/**
 * Presentation only: pass the exact authorized member page from the host. No
 * wire decoding, membership inference, fetching, or selection aggregation occurs
 * here. renderMember receives the original row, including its route-specific data.
 *
 * @param {object} props
 * @param {string} props.groupId
 * @param {string} props.memberScope
 * @param {number} props.helperThreadCount - saved threads, never review/message totals
 * @param {unknown[]} [props.members]
 * @param {(row: any) => import('react').ReactNode} props.renderMember
 * @param {(row: any) => string} props.getMemberKey - stable local/public transcript ID
 * @param {number} [props.page]
 * @param {number} [props.limit]
 * @param {number} [props.total] - current authorized member total, not loaded page length
 * @param {'idle'|'loading'|'ready'|'error'|'scope_expired'} [props.status]
 * @param {boolean} [props.expanded] - controlled disclosure for host Back restoration
 * @param {(expanded: boolean) => void} [props.onExpandedChange]
 * @param {(request: {groupId: string, memberScope: string, page: number, limit: number}) => void} props.onRequestPage
 * @param {() => void} props.onRefreshList - refresh the originating query, never an all-members fallback
 */
export default function HelperGroup(props) {
  // A changed query token cannot inherit an uncontrolled disclosure from an old query.
  return <HelperGroupDisclosure key={`${props.groupId}:${props.memberScope}`} {...props} />
}

function HelperGroupDisclosure({
  groupId, memberScope, helperThreadCount, members = [], renderMember, getMemberKey,
  page = 1, limit = 20, total = helperThreadCount, status = 'idle',
  expanded, onExpandedChange, onRequestPage, onRefreshList,
}) {
  const id = useId()
  const [localExpanded, setLocalExpanded] = useState(false)
  const open = expanded ?? localExpanded
  const pageHeading = useRef(null)
  const requestedPage = useRef(null)
  const busy = status === 'loading'
  const ready = status === 'ready'
  const pages = Math.max(1, Math.ceil(total / limit))

  useEffect(() => {
    if (open && ready && requestedPage.current === page) {
      pageHeading.current?.focus()
      requestedPage.current = null
    }
  }, [open, ready, page])

  const request = (next, focus = false) => {
    if (focus) requestedPage.current = next
    onRequestPage({ groupId, memberScope, page: next, limit })
  }
  const toggle = () => {
    const next = !open
    if (expanded === undefined) setLocalExpanded(next)
    onExpandedChange?.(next)
    if (next && status === 'idle') request(page)
    if (!next) requestedPage.current = null
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
        <div className="helper-group-body" aria-busy={busy}>
          <div className="helper-group-status" role="status">
            {busy && 'loading saved helper threads'}
            {status === 'idle' && 'expand to load saved helper threads'}
            {ready && `${total} saved helper threads in this result`}
          </div>
          {status === 'scope_expired' ? (
            <div className="helper-group-notice">
              <p>the saved helper query expired during member loading. no broader results were loaded. refresh the originating list to restore its filters.</p>
              <button type="button" className="helper-group-action" onClick={onRefreshList}>
                <RefreshCw aria-hidden="true" /> refresh list
              </button>
            </div>
          ) : status === 'error' ? (
            <div className="helper-group-notice">
              <p>helper members could not be loaded for this query. no selection changed. retry this page, or refresh the list if access has changed.</p>
              <button type="button" className="helper-group-action" onClick={() => request(page)}>
                <RefreshCw aria-hidden="true" /> retry page
              </button>
            </div>
          ) : null}
          {ready && <>
            <p className="helper-group-page-heading" ref={pageHeading} tabIndex={-1}>
              helper threads, page {page} of {pages}
            </p>
            {members.length ? <ul className="helper-group-members">
              {members.map((row) => <li key={getMemberKey(row)}>{renderMember(row)}</li>)}
            </ul> : <p className="helper-group-notice">no saved helpers match the current query and access.</p>}
          </>}
          {(ready || busy) && <nav className="helper-group-pagination" aria-label="helper thread pages">
            <button type="button" className="helper-group-action" aria-disabled={busy || page <= 1}
              onClick={() => { if (!busy && page > 1) request(page - 1, true) }}>
              <ChevronLeft aria-hidden="true" /> previous helpers
            </button>
            <button type="button" className="helper-group-action" aria-disabled={busy || page >= pages}
              onClick={() => { if (!busy && page < pages) request(page + 1, true) }}>
              next helpers <ChevronRight aria-hidden="true" />
            </button>
          </nav>}
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
 * Individual presentation row. Hosts map scalar display props from their typed row,
 * preserve route-specific status/usage/ordinary-child exits in children, and supply
 * authorized navigation/eligibility. These are UI props, not another wire DTO.
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
  const content = <><ExternalLink aria-hidden="true" /><span>{title}</span></>
  return <div className="helper-thread-row" data-thread-id={id}>
    <div className="helper-thread-main">
      {onSelect && <Checkbox checked={selected} disabled={selectionDisabled}
        aria-label={`select ${title} (${id})`} onChange={(checked) => onSelect(id, checked)} />}
      {href ? <a className="helper-thread-open" href={href} onClick={(event) => onOpen?.(id, event)}>{content}</a>
        : onOpen ? <button type="button" className="helper-thread-open" onClick={(event) => onOpen(id, event)}>{content}</button>
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
