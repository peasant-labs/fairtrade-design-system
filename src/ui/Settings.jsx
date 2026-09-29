import { Children, useEffect, useId, useRef, useState } from 'react'
import { ChevronRight, CircleCheck, CircleX, Loader, Pencil } from 'lucide-react'
import Switch from './Switch.jsx'
import Chip from './Chip.jsx'
import './Settings.css'

/* Settings (.srow-*) — a settings page that saves per field, the way GitHub's does. A switch, a
   select or a checkbox applies the moment it changes; a text value stays read-only until the user
   presses `edit`, then saves with `save` or Enter and backs out with `cancel` or Escape. Each row
   holds no network code: the host passes `onCommit(next)`, an async function that performs the
   one write, and the row shows where that write is.

     idle     nothing to report
     pending  the write is in flight: a spinner and "saving"
     settled  the write landed: a check and "saved"
     failed   the write failed: the previous value comes back, and the error is announced in a
              role="alert" element beside the control

   Every state is an icon plus a word in a polite live region, so it is heard and never carried
   by colour alone. <SettingGroup> is a native <details> whose summary names the group and counts
   its rows. The `tag` prop puts the host's note ("not in peasant config") on the existing Chip. */

export const SETTING_ROW_STATES = Object.freeze(['idle', 'pending', 'settled', 'failed'])

const STATUS = {
  pending: { icon: Loader, word: 'saving' },
  settled: { icon: CircleCheck, word: 'saved' },
  failed: { icon: CircleX, word: 'not saved' },
}

function errorText(error) {
  if (!error) return 'the change could not be saved.'
  if (typeof error === 'string') return error
  return error.message || 'the change could not be saved.'
}

/**
 * one write, with the row's status around it: optimistic value, pending, then settled or failed
 * with the previous value restored.
 */
function useCommit(value, onCommit) {
  const [shown, setShown] = useState(value)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])
  useEffect(() => { setShown(value) }, [value])

  const commit = async (next) => {
    const previous = shown
    setShown(next)
    setStatus('pending')
    setError(null)
    try {
      await onCommit?.(next)
      if (!alive.current) return true
      setStatus('settled')
      return true
    } catch (failure) {
      if (!alive.current) return false
      setShown(previous)
      setStatus('failed')
      setError(errorText(failure))
      return false
    }
  }
  return { shown, status, error, commit }
}

/* a switch already swaps its own marker to a spinner while busy, so its pending mark is the word. */
function StatusMark({ status, wordOnly = false }) {
  const meta = STATUS[status]
  return (
    <span className={`srow-status srow-status-${status}`} aria-live="polite">
      {meta && (
        <>
          {!wordOnly && <meta.icon className={status === 'pending' ? 'srow-status-icon srow-spin' : 'srow-status-icon'} aria-hidden="true" />}
          <span>{meta.word}</span>
        </>
      )}
    </span>
  )
}

function TextControl({ id, label, shown, status, commit, disabled }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(shown)
  const fieldRef = useRef(null)
  const editRef = useRef(null)
  useEffect(() => { if (editing) fieldRef.current?.focus() }, [editing])

  const open = () => { setDraft(shown); setEditing(true) }
  const close = () => { setEditing(false); requestAnimationFrame(() => editRef.current?.focus()) }
  const save = async () => {
    if (draft === shown) { close(); return }
    await commit(draft)
    close()
  }

  if (!editing) {
    return (
      <span className="srow-text">
        <span className="srow-text-value" id={`${id}-value`}>{shown}</span>
        <button type="button" ref={editRef} className="btn btn-secondary btn-sm srow-edit" aria-label={`edit ${label}`} aria-describedby={`${id}-value`} onClick={open} disabled={disabled || status === 'pending'}>
          <Pencil aria-hidden="true" /> edit
        </button>
      </span>
    )
  }
  return (
    <span className="srow-text srow-text-editing">
      <input
        ref={fieldRef}
        id={id}
        className="input is-input srow-input"
        value={draft}
        aria-label={label}
        disabled={status === 'pending'}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); save() }
          else if (event.key === 'Escape') { event.preventDefault(); close() }
        }}
      />
      <button type="button" className="btn btn-primary btn-sm srow-save" onClick={save} disabled={status === 'pending'}>save</button>
      <button type="button" className="btn btn-ghost btn-sm srow-cancel" onClick={close} disabled={status === 'pending'}>cancel</button>
    </span>
  )
}

/**
 * SettingRow — one setting: a label, optional help, and one control that saves on its own.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.label - the setting's name (lowercase chrome). a text
 *        control needs a string, since its edit button is named after it.
 * @param {import('react').ReactNode} [props.help] - one line of help under the label.
 * @param {'switch'|'select'|'checkbox'|'text'} props.control
 * @param {boolean|string} props.value - the saved value.
 * @param {{ value: string, label: string }[]} [props.options] - select only.
 * @param {(next: boolean|string) => Promise<void>|void} props.onCommit - the one write; reject to fail.
 * @param {string} [props.tag] - a note on the row, shown on a Chip ("not in peasant config").
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 */
export function SettingRow({ label, help, control, value, options = [], onCommit, tag, disabled = false, className = '', ...rest }) {
  const id = useId()
  const { shown, status, error, commit } = useCommit(value, onCommit)
  const busy = status === 'pending'
  const labelId = `${id}-label`
  const helpId = help ? `${id}-help` : undefined

  let controlNode
  if (control === 'switch') {
    controlNode = <Switch id={id} checked={Boolean(shown)} busy={busy} disabled={disabled} onChange={(next) => commit(next)} />
  } else if (control === 'checkbox') {
    controlNode = (
      <label className="check srow-check">
        <input type="checkbox" className="check-box" id={id} checked={Boolean(shown)} disabled={disabled || busy} aria-labelledby={labelId} aria-describedby={helpId} onChange={(event) => commit(event.target.checked)} />
      </label>
    )
  } else if (control === 'select') {
    controlNode = (
      <span className="select-wrap srow-select">
        <select className="select" id={id} value={String(shown)} disabled={disabled || busy} aria-labelledby={labelId} aria-describedby={helpId} onChange={(event) => commit(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </span>
    )
  } else if (control === 'text') {
    controlNode = <TextControl id={id} label={label} shown={String(shown ?? '')} status={status} commit={commit} disabled={disabled} />
  } else {
    throw new TypeError(`SettingRow: unknown control ${JSON.stringify(control)}; use switch, select, checkbox or text.`)
  }

  const cls = ['srow', `srow-${status}`, className].filter(Boolean).join(' ')
  return (
    <div className={cls} data-status={status} {...rest}>
      <div className="srow-text-col">
        <span className="srow-label-line">
          {control === 'text'
            ? <span className="srow-label" id={labelId}>{label}</span>
            : <label className="srow-label" id={labelId} htmlFor={id}>{label}</label>}
          {tag && <Chip size="sm" className="srow-tag">{tag}</Chip>}
        </span>
        {help && <span className="srow-help" id={helpId}>{help}</span>}
        {status === 'failed' && <span className="srow-error" role="alert">{error}</span>}
      </div>
      <div className="srow-control">
        {controlNode}
        <StatusMark status={status} wordOnly={control === 'switch' && status === 'pending'} />
      </div>
    </div>
  )
}

/**
 * SettingGroup — a collapsible group of setting rows: a native <details> whose summary names the
 * group and counts its rows. The host sets which groups start open.
 *
 * @param {object} props
 * @param {string} props.label - the group's name (lowercase chrome).
 * @param {boolean} [props.defaultOpen=false]
 * @param {number|null} [props.count] - the count shown in the summary; defaults to the children.
 *        null shows no count (a group of actions rather than settings).
 * @param {[string, string]} [props.noun=['setting', 'settings']] - what the count counts.
 * @param {import('react').ReactNode} [props.description] - one line under the summary when open.
 * @param {import('react').ReactNode} props.children - the rows.
 * @param {string} [props.className]
 */
export function SettingGroup({ label, defaultOpen = false, count, noun = ['setting', 'settings'], description, children, className = '', ...rest }) {
  const rows = count === undefined ? Children.toArray(children).length : count
  const cls = ['srow-group', className].filter(Boolean).join(' ')
  return (
    <details className={cls} open={defaultOpen || undefined} {...rest}>
      <summary className="srow-summary">
        <ChevronRight className="srow-caret" aria-hidden="true" />
        <span className="srow-summary-label">{label}</span>{' '}
        {rows !== null && <span className="srow-summary-count tnum">{rows} {rows === 1 ? noun[0] : noun[1]}</span>}
      </summary>
      {description && <p className="srow-group-description">{description}</p>}
      <div className="srow-rows">{children}</div>
    </details>
  )
}
