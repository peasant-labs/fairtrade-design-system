import { useState } from 'react'
import { Check, X, Clock, UserPlus, Inbox, ListChecks } from 'lucide-react'
import './ModerationQueue.css'

/* approval / moderation surfaces, modeled on village's PendingApprovalBar + the collective-hub
   pending-shares / pending-member-requests panels. two exports:

     ApprovalBar     a sticky top bar for reviewing ONE pending item (e.g. "pending share to
                     {collective}"), approve (olive, check) / reject (clay, x). resolves in place.
     ModerationQueue a panel listing many pending items; each row resolves OPTIMISTICALLY to an
                     approved/rejected pill (olive/clay + icon) and is struck/dimmed, never removed.

   neuroinclusive throughout: approve/reject are NEVER colour-only — every action and resolved state
   pairs an icon WITH the word ("approve"/"approved", "reject"/"rejected"), WCAG 1.4.1. chrome +
   labels are lowercase mono; user content (handles, titles, details) keeps its own case. lucide
   icons are aria-hidden — the adjacent word carries the meaning. classes are namespaced `mod-`;
   all styling lives in ModerationQueue.css (tokens only, radius 0, focus-visible, motion opt-in). */

const STATUS = { approved: 'approved', rejected: 'rejected' }

/**
 * ApprovalBar — a sticky top bar for reviewing a single pending item. Once acted on it collapses
 * to a one-line resolved acknowledgement (icon + word) rather than disappearing outright.
 * @typedef {Object} ApprovalBarProps
 * @property {React.ReactNode} subject  the thing under review, e.g. "pending share to {collective}";
 *                                      the collective/title inside is USER CONTENT (case preserved).
 * @property {() => void} [onApprove]   called when approve is clicked (after the optimistic resolve).
 * @property {() => void} [onReject]    called when reject is clicked (after the optimistic resolve).
 * @property {string} [approveLabel='approve'] lowercase label for the approve action.
 * @property {string} [rejectLabel='reject']   lowercase label for the reject action.
 * @property {string} [className]       extra classes appended to the .mod-bar root.
 */

/**
 * @param {ApprovalBarProps} props
 */
export function ApprovalBar({
  subject,
  onApprove,
  onReject,
  approveLabel = 'approve',
  rejectLabel = 'reject',
  className,
}) {
  const [resolved, setResolved] = useState(null)

  function resolve(status, cb) {
    setResolved(status)
    cb?.()
  }

  const cls = ['mod-bar', resolved && 'is-resolved', className].filter(Boolean).join(' ')

  return (
    <div className={cls} role="region" aria-label="pending review">
      <div className="mod-bar-inner">
        <span className="mod-bar-subject">
          <Clock className="mod-bar-clock" aria-hidden="true" />
          <span className="mod-bar-text">{subject}</span>
        </span>

        {resolved ? (
          <span
            className={`mod-resolved mod-resolved-${resolved}`}
            role="status"
            aria-live="polite"
          >
            {resolved === STATUS.approved ? (
              <Check aria-hidden="true" />
            ) : (
              <X aria-hidden="true" />
            )}
            {resolved}
          </span>
        ) : (
          <span className="mod-bar-actions">
            <button
              type="button"
              className="mod-act mod-act-approve"
              onClick={() => resolve(STATUS.approved, onApprove)}
            >
              <Check aria-hidden="true" />
              {approveLabel}
            </button>
            <button
              type="button"
              className="mod-act mod-act-reject"
              onClick={() => resolve(STATUS.rejected, onReject)}
            >
              <X aria-hidden="true" />
              {rejectLabel}
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * ModerationQueue — a panel listing pending items (member requests OR shares). Each row shows who +
 * detail + relative time, with approve/reject buttons. Acting on a row resolves it OPTIMISTICALLY in
 * place: the buttons swap for an approved/rejected pill (olive/clay + icon) and the row is struck +
 * dimmed, never removed — so the reviewer keeps an audit trail of what they just decided. When no
 * items remain pending an empty state is shown.
 * @typedef {Object} QueueItem
 * @property {string} id                stable key.
 * @property {'member'|'share'} [kind]  picks the leading icon (user-plus / inbox). defaults to share.
 * @property {React.ReactNode} who       the actor — a handle/name. USER CONTENT (case preserved).
 * @property {React.ReactNode} [detail]  the secondary line (org, title, …). USER CONTENT.
 * @property {React.ReactNode} [when]    relative time, e.g. "2h ago". rendered tabular + lowercased.
 *
 * @typedef {Object} ModerationQueueProps
 * @property {React.ReactNode} [title='pending review'] the panel header label (lowercase chrome).
 * @property {QueueItem[]} [items=[]]   the pending items.
 * @property {(item: QueueItem) => void} [onApprove] called with the item when approved.
 * @property {(item: QueueItem) => void} [onReject]  called with the item when rejected.
 * @property {React.ReactNode} [emptyLabel='nothing pending'] message for the empty state.
 * @property {string} [className]       extra classes appended to the .mod-queue root.
 */

/**
 * @param {ModerationQueueProps} props
 */
export function ModerationQueue({
  title = 'pending review',
  items = [],
  onApprove,
  onReject,
  emptyLabel = 'nothing pending',
  className,
}) {
  // optimistic, in-place resolution keyed by item id: { [id]: 'approved' | 'rejected' }.
  const [resolved, setResolved] = useState({})

  function resolve(item, status, cb) {
    setResolved((prev) => ({ ...prev, [item.id]: status }))
    cb?.(item)
  }

  const pendingCount = items.filter((it) => !resolved[it.id]).length
  const cls = ['mod-queue', className].filter(Boolean).join(' ')

  return (
    <section className={cls} aria-label={typeof title === 'string' ? title : 'pending review'}>
      <header className="mod-queue-head">
        {/* a queue glyph (list-checks), NOT a person — the header marks the review
            list itself; per-row person/inbox glyphs carry who/what each item is. */}
        <ListChecks className="mod-queue-ico" aria-hidden="true" />
        <span className="mod-queue-title">{title}</span>
        <span className="mod-queue-count tnum" aria-label={`${pendingCount} pending`}>
          {pendingCount}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="mod-empty">
          <span className="mod-empty-ico" aria-hidden="true">
            <Inbox />
          </span>
          <p className="mod-empty-msg">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="mod-list">
          {items.map((item) => {
            const status = resolved[item.id]
            const RowIcon = item.kind === 'member' ? UserPlus : Inbox
            const rowCls = ['mod-row', status && 'is-resolved', status && `is-${status}`]
              .filter(Boolean)
              .join(' ')
            return (
              <li key={item.id} className={rowCls}>
                <span className="mod-row-ico" aria-hidden="true">
                  <RowIcon />
                </span>
                <div className="mod-row-body">
                  <span className="mod-row-who">{item.who}</span>
                  {item.detail != null && (
                    <span className="mod-row-detail">{item.detail}</span>
                  )}
                </div>
                {item.when != null && (
                  <time className="mod-row-when tnum">{item.when}</time>
                )}

                {status ? (
                  <span
                    className={`mod-resolved mod-resolved-${status}`}
                    role="status"
                    aria-live="polite"
                  >
                    {status === STATUS.approved ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <X aria-hidden="true" />
                    )}
                    {status}
                  </span>
                ) : (
                  <span className="mod-row-actions">
                    <button
                      type="button"
                      className="mod-act mod-act-approve"
                      onClick={() => resolve(item, STATUS.approved, onApprove)}
                    >
                      <Check aria-hidden="true" />
                      approve
                    </button>
                    <button
                      type="button"
                      className="mod-act mod-act-reject"
                      onClick={() => resolve(item, STATUS.rejected, onReject)}
                    >
                      <X aria-hidden="true" />
                      reject
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default ModerationQueue
