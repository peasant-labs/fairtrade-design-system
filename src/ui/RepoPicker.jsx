import { useEffect, useId, useMemo, useState } from 'react'
import { Building2, Lock, Search } from 'lucide-react'
import Dialog from './Dialog.jsx'
import { Avatar } from './Avatar.jsx'
import { matchesQuery } from './match-query.js'
import './RepoPicker.css'

/* RepoPicker (.rpk-*) — a popup for picking many repositories at once from a long list: a search
   field, `select all` and `clear` (both act on the repositories the search shows), a running
   count ("3 of 14 selected"), and a heading per owner that carries the owner's identity, an
   organisation icon or a user's avatar plus the word, since that distinction is what the user is
   choosing between. `save` reports only the difference from the starting selection as
   `{ add, remove }`; the host performs the write. Repository names keep their case. */

/**
 * @typedef {object} RepoPickerOwner
 * @property {string} id
 * @property {string} login - the owner's GitHub login.
 * @property {'org'|'user'} kind
 * @property {string} [avatarUrl] - a user's photo; an organisation shows the organisation icon.
 * @property {{ id: string, name: string, private?: boolean, note?: string }[]} repos
 */

function saveLabel(add, remove) {
  if (!add && !remove) return 'save'
  const parts = []
  if (add) parts.push(`link ${add} ${add === 1 ? 'repository' : 'repositories'}`)
  if (remove) parts.push(`unlink ${remove}`)
  return `save: ${parts.join(', ')}`
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {RepoPickerOwner[]} props.owners
 * @param {string[]} [props.initialSelected] - the repositories linked when the popup opens.
 * @param {(diff: { add: string[], remove: string[] }) => void} props.onSave
 * @param {string} [props.title='link repositories']
 * @param {import('react').ReactNode} [props.description] - one line under the title.
 * @param {boolean} [props.saving=false] - the host's write is in flight.
 * @param {string} [props.error] - the host's write failed; shown in a role="alert" line.
 */
export default function RepoPicker({ open, onClose, owners, initialSelected = [], onSave, title = 'link repositories', description, saving = false, error }) {
  const baseId = useId()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set(initialSelected))
  const start = useMemo(() => new Set(initialSelected), [initialSelected])
  // each opening starts from the linked set and an empty search
  useEffect(() => {
    if (!open) return
    setSelected(new Set(initialSelected))
    setQuery('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const all = useMemo(() => owners.flatMap((owner) => owner.repos), [owners])
  const visibleOwners = owners
    .map((owner) => ({ ...owner, repos: owner.repos.filter((repo) => matchesQuery(repo.name, query)) }))
    .filter((owner) => owner.repos.length > 0)
  const visible = visibleOwners.flatMap((owner) => owner.repos)
  const add = all.filter((repo) => selected.has(repo.id) && !start.has(repo.id)).map((repo) => repo.id)
  const remove = all.filter((repo) => !selected.has(repo.id) && start.has(repo.id)).map((repo) => repo.id)

  const setMany = (ids, on) => setSelected((prev) => {
    const next = new Set(prev)
    for (const id of ids) on ? next.add(id) : next.delete(id)
    return next
  })
  const toggle = (id) => setMany([id], !selected.has(id))
  const status = (id) => {
    const on = selected.has(id)
    if (on && start.has(id)) return 'linked'
    if (on) return 'to link'
    if (start.has(id)) return 'to unlink'
    return null
  }

  const footer = (
    <div className="rpk-foot">
      {error && <span className="rpk-error" role="alert">{error}</span>}
      <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>cancel</button>
      <button type="button" className="btn btn-primary btn-sm" disabled={saving || (!add.length && !remove.length)} aria-busy={saving ? 'true' : undefined} onClick={() => onSave({ add, remove })}>
        {saveLabel(add.length, remove.length)}
      </button>
    </div>
  )

  return (
    <Dialog open={open} onClose={onClose} title={title} labelId={`${baseId}-title`} size="wide" className="rpk-dialog" footer={footer}>
      {description && <p className="rpk-description">{description}</p>}
      <div className="rpk-search">
        <label className="rpk-label" htmlFor={`${baseId}-search`}>search repos</label>
        <div className="input-ico">
          <Search className="lucide" aria-hidden="true" />
          <input id={`${baseId}-search`} className="input is-input" type="search" autoComplete="off" placeholder="type a repo name" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>
      <div className="rpk-toolbar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMany(visible.map((repo) => repo.id), true)} disabled={!visible.length}>select all</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMany(visible.map((repo) => repo.id), false)} disabled={!visible.length}>clear</button>
        <span className="rpk-count" aria-live="polite"><span className="tnum">{selected.size}</span> of <span className="tnum">{all.length}</span> selected</span>
      </div>
      {visibleOwners.length === 0 ? (
        <p className="rpk-empty">no repository matches “{query.trim()}”.</p>
      ) : (
        <div className="rpk-owners">
          {visibleOwners.map((owner) => (
            <section key={owner.id} className="rpk-owner" aria-labelledby={`${baseId}-${owner.id}`}>
              <h4 className="rpk-owner-head" id={`${baseId}-${owner.id}`}>
                {owner.kind === 'org'
                  ? <Building2 className="rpk-owner-icon" aria-hidden="true" />
                  : <Avatar name={owner.login} src={owner.avatarUrl} className="rpk-owner-avatar" aria-hidden="true" />}
                <span className="rpk-owner-login">{owner.login}</span>{' '}
                <span className="rpk-owner-kind">{owner.kind === 'org' ? 'organisation' : 'personal'}</span>
              </h4>
              <ul className="rpk-repos">
                {owner.repos.map((repo) => {
                  const note = status(repo.id)
                  return (
                    <li key={repo.id} className="rpk-repo">
                      <label className="check rpk-repo-row">
                        <input type="checkbox" className="check-box" checked={selected.has(repo.id)} onChange={() => toggle(repo.id)} disabled={saving} />
                        <span className="rpk-repo-name">{repo.name}</span>
                        {repo.private && <span className="rpk-tag"><Lock aria-hidden="true" /> private</span>}
                        {repo.note && <span className="rpk-note">{repo.note}</span>}
                        {note && <span className={`rpk-state rpk-state-${note.replace(/ /g, '-')}`}>{note}</span>}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Dialog>
  )
}
