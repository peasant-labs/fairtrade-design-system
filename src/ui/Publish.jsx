import { useId, useState } from 'react'
import {
  AlertTriangle,
  CircleCheck,
  CircleDashed,
  CircleFadingArrowUp,
  ExternalLink,
  GitPullRequest,
  ListX,
  Loader,
  MoreHorizontal,
  Plus,
  Repeat,
  RotateCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import Dialog from './Dialog.jsx'
import Checkbox from './Checkbox.jsx'
import Menu from './Menu.jsx'
import { SignInProviders } from './SignIn.jsx'
import CopyIconButton from './CopyIconButton.jsx'
import { RedactionReview } from './Redaction.jsx'
import './Publish.css'

/* Publish (.pub-*) — the parts of the one outward action. Publishing works like sharing a
   document: one popup shows what leaves the machine (the redaction check) and who can read it (the
   collectives), then publishes. Every part is controlled: state in, callbacks out. None of them
   fetches, caches, scans or publishes; the host owns transport, the scan cache and fail-closed
   behavior, and hands each part the state it is in.

     <PublishStateLabel state />   the transcript's publish state as an icon and words
     <PublishBar state onAction /> that label plus the one action for the state (publish, update
                                   or manage) and an optional overflow menu
     <AccessList items onRemove /> who can read it: one row per collective, each with a named
                                   remove button; the host marks rows pending in text
     <CollectivePicker ... />      search and suggestions for adding a collective; village reuses it
     <PublishDialog ... />         the popup itself, in every state the flow reaches

   Copy is lowercase chrome; collective names, session titles, urls and commands keep their case.
   No state rides on colour alone: every state pairs an icon with words. */

/* the publish state vocabulary (PUBLISH_STATES and its PublishState typedef) is declared after
   PublishBar, so this file's first doc block stays the label's. */

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`
/* a count the host did not give is left out rather than stated as zero */
const countOf = (count, one, many) => (typeof count === 'number' ? plural(count, one, many) : null)

const STATE_META = {
  'not-published': { icon: CircleDashed, text: () => 'not published', action: 'publish' },
  publishing: { icon: Loader, text: ({ collectives }) => (collectives ? `publishing to ${plural(collectives, 'collective', 'collectives')}` : 'publishing'), action: 'publish' },
  published: { icon: CircleCheck, text: ({ collectives }) => ['published', countOf(collectives, 'collective', 'collectives'), 'up to date'].filter(Boolean).join(' · '), action: 'manage' },
  'new-turns': { icon: CircleFadingArrowUp, text: ({ collectives, newTurns }) => ['published', countOf(collectives, 'collective', 'collectives'), countOf(newTurns, 'new turn', 'new turns') ?? 'new turns'].filter(Boolean).join(' · '), action: 'update' },
  'auto-publish': { icon: Repeat, text: ({ collective }) => (collective ? `auto-publish on · ${collective}` : 'auto-publish on'), action: 'manage' },
  'outside-lists': { icon: ListX, text: () => 'not published · outside your saved lists', action: 'publish' },
}

function stateMeta(state) {
  if (!Object.hasOwn(STATE_META, state)) {
    throw new TypeError(`PublishStateLabel: unknown publish state ${JSON.stringify(state)}; use one of ${PUBLISH_STATES.join(', ')}.`)
  }
  return STATE_META[state]
}

/**
 * PublishStateLabel — the transcript's publish state: an icon and its words.
 *
 * @param {object} props
 * @param {PublishState} props.state
 * @param {number} [props.collectives] - how many collectives can read it (published, new-turns, publishing); left out of the words when omitted.
 * @param {number} [props.newTurns] - turns recorded since the last publish (new-turns).
 * @param {string} [props.collective] - the collective(s) the project's auto-publish rule targets (auto-publish).
 * @param {string} [props.className]
 */
export function PublishStateLabel({ state, collectives, newTurns, collective, className = '', ...rest }) {
  const meta = stateMeta(state)
  const Icon = meta.icon
  const cls = ['pub-state', `pub-state-${state}`, className].filter(Boolean).join(' ')
  return (
    <span className={cls} data-state={state} {...rest}>
      <Icon className={state === 'publishing' ? 'pub-state-icon pub-spin' : 'pub-state-icon'} aria-hidden="true" />
      <span className="pub-state-text">{meta.text({ collectives, newTurns, collective })}</span>
    </span>
  )
}

/**
 * PublishBar — the status and the one action for it, for a transcript header row. The action is
 * publish (not published, outside the saved lists), update (new turns) or manage (published,
 * auto-publish on); while publishing it stays visible and busy.
 *
 * @param {object} props
 * @param {PublishState} props.state - a PublishStateLabel state.
 * @param {number} [props.collectives]
 * @param {number} [props.newTurns]
 * @param {string} [props.collective]
 * @param {() => void} [props.onAction] - the one button. omit it and no button renders.
 * @param {string} [props.actionLabel] - replaces the state's default label.
 * @param {import('./Menu.jsx').MenuItem[]} [props.moreItems] - an optional overflow menu after the button.
 * @param {string} [props.className]
 */
export function PublishBar({ state, collectives, newTurns, collective, onAction, actionLabel, moreItems, className = '', ...rest }) {
  const meta = stateMeta(state)
  const busy = state === 'publishing'
  const label = actionLabel ?? meta.action
  const cls = ['pub-bar', className].filter(Boolean).join(' ')
  return (
    <div className={cls} role="group" aria-label="publish" {...rest}>
      <span role="status" className="pub-bar-status">
        <PublishStateLabel state={state} collectives={collectives} newTurns={newTurns} collective={collective} />
      </span>
      {onAction && (
        <button
          type="button"
          className={'btn btn-sm ' + (label === 'manage' ? 'btn-secondary' : 'btn-primary') + ' pub-bar-action'}
          aria-haspopup="dialog"
          aria-busy={busy ? 'true' : undefined}
          aria-disabled={busy ? 'true' : undefined}
          onClick={() => { if (!busy) onAction() }}
        >
          {label}
        </button>
      )}
      {moreItems?.length ? <Menu icon={MoreHorizontal} ariaLabel="more" size="sm" align="end" items={moreItems} /> : null}
    </div>
  )
}

/**
 * A transcript's publish state. `auto-publish` states the rule for the project, not how this
 * transcript was published.
 * @typedef {'not-published'|'publishing'|'published'|'new-turns'|'auto-publish'|'outside-lists'} PublishState
 */
/** Every PublishState, in order. @type {ReadonlyArray<PublishState>} */
export const PUBLISH_STATES = Object.freeze(['not-published', 'publishing', 'published', 'new-turns', 'auto-publish', 'outside-lists'])

/**
 * @typedef {object} AccessItem
 * @property {string} id
 * @property {string} name - the collective's name, kept in its case.
 * @property {number} [members]
 * @property {string} [note] - why it is here ("suggested · repo acme/ingest-api is linked").
 * @property {'adding'|'approval'|'removal'} [pending] - a change the next publish or update makes:
 *           `adding` (joins on publish), `approval` (joins once its owner approves), `removal`
 *           (loses access on update). stated in words on the row.
 */

const PENDING_TEXT = {
  adding: 'adding',
  approval: 'adding · waits for approval',
  removal: 'removing · loses access when you update',
}

/**
 * AccessList — who can read the transcript: one row per collective with a named remove button.
 * A row pending removal says so and offers `keep` instead.
 *
 * @param {object} props
 * @param {AccessItem[]} props.items
 * @param {(id: string) => void} [props.onRemove] - the row's x; omit it for a read-only list.
 * @param {(id: string) => void} [props.onRestore] - `keep` on a row pending removal.
 * @param {import('react').ReactNode} [props.empty] - shown when no collective can read it.
 * @param {string} [props.label='who can read it']
 * @param {string} [props.className]
 */
export function AccessList({ items, onRemove, onRestore, empty = 'no collective can read it yet.', label = 'who can read it', className = '', ...rest }) {
  const cls = ['pub-access', className].filter(Boolean).join(' ')
  if (!items?.length) return <p className={['pub-access-empty', className].filter(Boolean).join(' ')}>{empty}</p>
  return (
    <ul className={cls} aria-label={label} {...rest}>
      {items.map((item) => {
        const removal = item.pending === 'removal'
        return (
          <li key={item.id} className={removal ? 'pub-access-row pub-access-removal' : 'pub-access-row'}>
            <Users className="pub-access-icon" aria-hidden="true" />
            <span className="pub-access-main">
              <span className="pub-access-name">{item.name}</span>
              {(item.note || item.pending) && (
                <span className="pub-access-note">
                  {[item.note, item.pending ? PENDING_TEXT[item.pending] : null].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            {item.members != null && <span className="pub-access-members tnum">{plural(item.members, 'member', 'members')}</span>}
            {removal && onRestore ? (
              <button type="button" className="btn btn-ghost btn-sm pub-access-keep" aria-label={`keep ${item.name}`} onClick={() => onRestore(item.id)}>keep</button>
            ) : onRemove && !removal ? (
              <button type="button" className="btn btn-ghost btn-sm btn-icon pub-access-remove" aria-label={`remove ${item.name}`} onClick={() => onRemove(item.id)}>
                <X aria-hidden="true" />
              </button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * CollectivePicker — search and suggestions for adding a collective. The host searches (village
 * knows the collectives) and passes the results as `suggestions`; the picker renders them and
 * reports the query and the choice.
 *
 * @param {object} props
 * @param {{ id: string, name: string, members?: number, note?: string }[]} props.suggestions
 * @param {(id: string) => void} props.onAdd
 * @param {string} [props.query] - controlled query; omit it to let the picker keep its own.
 * @param {(query: string) => void} [props.onQueryChange]
 * @param {string} [props.label='add a collective'] - the field's label.
 * @param {string} [props.placeholder='collective or github org']
 * @param {import('react').ReactNode} [props.empty] - shown for a query with no suggestions.
 * @param {string} [props.className]
 */
export function CollectivePicker({ suggestions, onAdd, query: queryProp, onQueryChange, label = 'add a collective', placeholder = 'collective or github org', empty = 'no collective matches that name.', className = '', ...rest }) {
  const [internal, setInternal] = useState('')
  const query = queryProp ?? internal
  const inputId = useId()
  const listId = `${inputId}-suggestions`
  const setQuery = (next) => {
    if (queryProp === undefined) setInternal(next)
    onQueryChange?.(next)
  }
  const cls = ['pub-picker', className].filter(Boolean).join(' ')
  return (
    <div className={cls} {...rest}>
      <label className="pub-picker-label" htmlFor={inputId}>{label}</label>
      <div className="input-ico pub-picker-field">
        <Search className="lucide" aria-hidden="true" />
        <input
          id={inputId}
          className="input is-input"
          type="search"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          aria-controls={listId}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {suggestions?.length ? (
        <ul className="pub-picker-list" id={listId} aria-label="suggested collectives">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id} className="pub-picker-row">
              <span className="pub-access-main">
                <span className="pub-access-name">{suggestion.name}</span>
                {suggestion.note && <span className="pub-access-note">{suggestion.note}</span>}
              </span>
              {suggestion.members != null && <span className="pub-access-members tnum">{plural(suggestion.members, 'member', 'members')}</span>}
              <button type="button" className="btn btn-secondary btn-sm pub-picker-add" aria-label={`add ${suggestion.name}`} onClick={() => onAdd(suggestion.id)}>
                <Plus aria-hidden="true" /> add
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim() ? (
        <p className="pub-picker-empty" id={listId}>{empty}</p>
      ) : null}
    </div>
  )
}

/* ── the popup ─────────────────────────────────────────────────────────────── */

/**
 * A state of the publish popup.
 * @typedef {'connect'|'waiting-github'|'checking'|'scan-failed'|'no-collective'|'ready'|'publishing'|'stopped'|'done'|'waits-approval'} PublishDialogState
 */
/** Every state the popup reaches, in the order a first publish meets them. @type {ReadonlyArray<PublishDialogState>} */
export const PUBLISH_DIALOG_STATES = Object.freeze(['connect', 'waiting-github', 'checking', 'scan-failed', 'no-collective', 'ready', 'publishing', 'stopped', 'done', 'waits-approval'])

function joinNames(names) {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function WhatLeaves({ state, scan, onRescan, readOnlyReview }) {
  const titleId = useId()
  const matches = scan?.matches ?? []
  const kept = matches.filter((match) => match.kept).length
  // the matches open by themselves when one will leave un-redacted; the toggle overrides that
  const [openChoice, setOpen] = useState(null)
  const open = openChoice ?? kept > 0
  const checking = state === 'checking'
  const failed = state === 'scan-failed'
  const unscanned = !Array.isArray(scan?.matches) && !checking && !failed
  return (
    <section className="pub-section" aria-labelledby={titleId}>
      <div className="pub-section-head">
        <h4 className="pub-section-title" id={titleId}>what leaves your machine</h4>
        {onRescan && (
          <button type="button" className="btn btn-ghost btn-sm pub-rescan" onClick={onRescan} disabled={checking}>
            <RotateCw aria-hidden="true" /> re-scan
          </button>
        )}
      </div>
      {checking ? (
        <p className="pub-line" role="status"><Loader className="pub-spin" aria-hidden="true" /> checking for sensitive content</p>
      ) : failed ? (
        <p className="pub-line pub-line-alert" role="alert">
          <AlertTriangle aria-hidden="true" /> {scan?.failure ?? 'the scan failed, so publish is off. re-scan to try again.'}
        </p>
      ) : unscanned ? (
        <p className="pub-line pub-line-alert">
          <AlertTriangle aria-hidden="true" /> not scanned yet, so publish is off.{onRescan ? ' re-scan to check it.' : ''}
        </p>
      ) : (
        <>
          <p className={kept ? 'pub-line pub-line-alert' : 'pub-line'}>
            {kept ? <AlertTriangle aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            <span>
              <span className="tnum">{matches.length}</span> {matches.length === 1 ? 'match' : 'matches'}
              {kept ? <> · <span className="tnum">{kept}</span> kept un-redacted, will be sent</> : matches.length ? ' · all redacted' : ' · nothing to redact'}
            </span>
            {matches.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm pub-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
                {open ? 'hide matches' : 'show matches'}
              </button>
            )}
          </p>
          {open && matches.length > 0 && (
            <RedactionReview readOnly={readOnlyReview} matches={matches} total={scan?.total ?? matches.length} availableLevels={['standard']} className="pub-review" />
          )}
        </>
      )}
    </section>
  )
}

/**
 * PublishDialog — the one publish popup, for a first publish (`mode="publish"`) and an update
 * (`mode="update"`). It shows what leaves the machine, who can read it, and the auto-publish
 * checkbox, then the done state with the village link. The host drives `state`; the popup never
 * advances on its own.
 *
 * States: `connect` (this computer is not signed in to village), `waiting-github` (after continue
 * with github), `checking` (the redaction check is running), `scan-failed` (publish is off,
 * re-scan stays on), `no-collective` (signed in, in no collective), `ready`, `publishing`,
 * `stopped` (a named step failed; village keeps what it had), `done`, `waits-approval` (done, and
 * a curated collective shows it once its owner approves).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose - cancel, the close button, Escape and the scrim.
 * @param {string} props.title - the session title, kept in its case.
 * @param {'publish'|'update'} [props.mode='publish']
 * @param {PublishDialogState} props.state - one of PUBLISH_DIALOG_STATES.
 * @param {{ matches?: object[], total?: number, failure?: string }} [props.scan] - the host's scan result. Until it carries a
 *        `matches` list, the popup says the transcript is not scanned and keeps publish off. A match with `kept: true` leaves un-redacted, and the
 *        popup says so and opens the matches.
 * @param {() => void} [props.onRescan]
 * @param {{ summary: string }} [props.changes] - update mode: what changed since the last publish.
 * @param {AccessItem[]} [props.access] - who can read it after this publish.
 * @param {(id: string) => void} [props.onRemove]
 * @param {(id: string) => void} [props.onRestore]
 * @param {object} [props.picker] - CollectivePicker props (suggestions, onAdd, query, onQueryChange).
 * @param {{ checked: boolean, onChange: (checked: boolean) => void, hint?: string }} [props.autoPublish]
 * @param {string} [props.accessSummary] - update mode: the access change in words ("adds ML Reading Group · removes nothing").
 * @param {string} [props.primaryLabel] - replaces the derived primary label.
 * @param {() => void} [props.onPublish]
 * @param {() => void} [props.onConnect] - `continue with github`.
 * @param {string} [props.joinHref] - `create or join one on village`.
 * @param {string} [props.stoppedAt] - the step that failed, in words ("setting who can read it").
 * @param {() => void} [props.onRetry]
 * @param {{ url: string, collectives: string[], pending?: string[], pullRequest?: { number: number, branch: string, href?: string } }} [props.done]
 */
export function PublishDialog({
  open,
  onClose,
  title,
  mode = 'publish',
  state,
  scan,
  onRescan,
  changes,
  access = [],
  onRemove,
  onRestore,
  picker,
  autoPublish,
  accessSummary,
  primaryLabel,
  onPublish,
  onConnect,
  joinHref,
  stoppedAt,
  onRetry,
  done,
}) {
  const labelId = useId()
  const sectionId = useId()
  if (!PUBLISH_DIALOG_STATES.includes(state)) {
    throw new TypeError(`PublishDialog: unknown state ${JSON.stringify(state)}; use one of ${PUBLISH_DIALOG_STATES.join(', ')}.`)
  }
  const verb = mode === 'update' ? 'update' : 'publish'
  const readers = access.filter((item) => item.pending !== 'removal')
  const finished = state === 'done' || state === 'waits-approval'
  const gate = state === 'connect' || state === 'waiting-github'
  const adds = access.filter((item) => item.pending === 'adding' || item.pending === 'approval').length
  const removes = access.filter((item) => item.pending === 'removal').length
  const derived = mode === 'update'
    ? ['update', adds ? `add ${plural(adds, 'collective', 'collectives')}` : null, removes ? `remove ${plural(removes, 'collective', 'collectives')}` : null].filter(Boolean).join(' and ')
    : readers.length ? `publish to ${plural(readers.length, 'collective', 'collectives')}` : 'publish'
  const blocked = state === 'checking' || state === 'scan-failed' || state === 'no-collective' || state === 'publishing' || readers.length === 0 || !Array.isArray(scan?.matches)
  // while publishing, cancel, the close button, Escape and the scrim all wait for the result
  const dismissible = state !== 'publishing'

  const heading = finished
    ? <>published to <span className="pub-title-content">{joinNames(done?.collectives ?? readers.map((item) => item.name))}</span></>
    : <>{verb} <span className="pub-title-content">“{title}”</span></>

  let footer
  if (finished) {
    footer = <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>done</button>
  } else if (gate) {
    footer = (
      <>
        <span className="pub-foot-note">nothing leaves your machine until you publish.</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>cancel</button>
      </>
    )
  } else {
    footer = (
      <>
        <span className="pub-foot-note">nothing leaves your machine until you {verb}.</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={state === 'publishing'}>cancel</button>
        {state === 'stopped' ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}><RotateCw aria-hidden="true" /> retry</button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm pub-primary"
            disabled={blocked}
            aria-busy={state === 'publishing' ? 'true' : undefined}
            onClick={onPublish}
          >
            {state === 'publishing' ? <Loader className="pub-spin" aria-hidden="true" /> : null}
            {primaryLabel ?? derived}
          </button>
        )}
      </>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} dismissible={dismissible} title={heading} labelId={labelId} size="wide" className="pub-dialog" footer={<div className="pub-foot">{footer}</div>}>
      {state === 'connect' && (
        <div className="pub-gate">
          <p className="pub-line">connect this computer to village once to publish.</p>
          <SignInProviders onSignIn={() => onConnect?.()} />
        </div>
      )}
      {state === 'waiting-github' && (
        <p className="pub-line" role="status"><Loader className="pub-spin" aria-hidden="true" /> waiting for github in your browser</p>
      )}

      {!gate && !finished && (
        <>
          {mode === 'update' && changes && (
            <section className="pub-section" aria-labelledby={`${sectionId}-changed`}>
              <h4 className="pub-section-title" id={`${sectionId}-changed`}>what changed</h4>
              <p className="pub-line">{changes.summary}</p>
            </section>
          )}
          <WhatLeaves state={state} scan={scan} onRescan={onRescan} readOnlyReview />

          <section className="pub-section" aria-labelledby={`${sectionId}-readers`}>
            <h4 className="pub-section-title" id={`${sectionId}-readers`}>who can read it</h4>
            {state === 'no-collective' ? (
              <p className="pub-line">
                you are not in a collective yet.{' '}
                {joinHref && <a className="link" href={joinHref}>create or join one on village <ExternalLink aria-hidden="true" /></a>}
              </p>
            ) : (
              <>
                <AccessList items={access} onRemove={state === 'publishing' ? undefined : onRemove} onRestore={onRestore} />
                {picker && state !== 'publishing' && <CollectivePicker {...picker} />}
                {mode === 'update' && <p className="pub-hint">removing a collective takes the transcript back from it.</p>}
              </>
            )}
            {autoPublish && state !== 'no-collective' && (
              <div className="pub-auto">
                <Checkbox checked={autoPublish.checked} onChange={(checked) => autoPublish.onChange(checked)} disabled={state === 'publishing'}>
                  publish this repo automatically on git push
                </Checkbox>
                <span className="pub-hint">{autoPublish.hint ?? 'same collectives · change it in settings'}</span>
              </div>
            )}
            {mode === 'update' && accessSummary && <p className="pub-line pub-delta">{accessSummary}</p>}
          </section>

          {state === 'publishing' && (
            <p className="pub-line" role="status"><Loader className="pub-spin" aria-hidden="true" /> {mode === 'update' ? 'updating' : `publishing to ${plural(readers.length, 'collective', 'collectives')}`}</p>
          )}
          {state === 'stopped' && (
            <p className="pub-line pub-line-alert" role="alert">
              <AlertTriangle aria-hidden="true" /> stopped while {stoppedAt ?? 'publishing'}. nothing changed on village.
            </p>
          )}
        </>
      )}

      {finished && done && (
        <div className="pub-done">
          <div className="pub-link-row">
            <a className="pub-link mono" href={done.url}>{done.url.replace(/^https?:\/\//, '')}</a>
            <CopyIconButton value={done.url} label="copy link" />
            <a className="btn btn-secondary btn-sm" href={done.url} target="_blank" rel="noreferrer">open <ExternalLink aria-hidden="true" /></a>
          </div>
          {state === 'waits-approval' && done.pending?.length ? (
            <p className="pub-line" role="status">{joinNames(done.pending)} {done.pending.length === 1 ? 'shows' : 'show'} it once {done.pending.length === 1 ? 'its owner approves' : 'their owners approve'}.</p>
          ) : null}
          {done.pullRequest && (
            <div className="pub-pr">
              <p className="pub-line">
                <GitPullRequest aria-hidden="true" />
                <span>
                  pull request {done.pullRequest.href ? <a className="link tnum" href={done.pullRequest.href}>#{done.pullRequest.number}</a> : <span className="tnum">#{done.pullRequest.number}</span>} is open for <code className="mono">{done.pullRequest.branch}</code>. comment <code className="mono">/peasant attach</code> on it to link this transcript.
                </span>
              </p>
              <CopyCommandButton value="/peasant attach" />
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}

/* a labelled copy button for a command the user pastes elsewhere. */
function CopyCommandButton({ value }) {
  const [copied, setCopied] = useState(false)
  if (typeof navigator === 'undefined' || !navigator.clipboard) return null
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value) } catch { return }
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
    >
      {copied ? 'copied' : <>copy <code className="mono">{value}</code></>}
    </button>
  )
}
