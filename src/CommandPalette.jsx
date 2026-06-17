import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, SearchX, Hash, ArrowUp, SunMoon } from 'lucide-react'

/* the real, interactive command palette behind the nav "search ⌘k" control.
   opens on ⌘k / ctrl-k or a click on the search pill; filters sections + actions, jumps to
   them with a smooth scroll, and is fully keyboard-driven (arrows / enter / esc). reuses the
   .cp-* styling from the command-palette specimen so the live tool matches the documented one. */
const prefersReduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function CommandPalette({ open, onClose, onTheme, sections }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const match = (label) => label.toLowerCase().includes(needle)
    const actions = [
      { id: '__top', label: 'back to top', kind: 'action', Icon: ArrowUp },
      { id: '__theme', label: 'toggle theme', kind: 'action', Icon: SunMoon },
    ].filter((a) => match(a.label))
    const secs = sections.filter((s) => match(s.label)).map((s) => ({ ...s, kind: 'section', Icon: Hash }))
    return [
      { group: 'actions', items: actions },
      { group: 'jump to a section', items: secs },
    ].filter((g) => g.items.length)
  }, [q, sections])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
      const t = setTimeout(() => inputRef.current?.focus(), 20)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (sel > flat.length - 1) setSel(flat.length ? flat.length - 1 : 0)
  }, [flat.length, sel])

  if (!open) return null

  const run = (it) => {
    onClose()
    const behavior = prefersReduced() ? 'auto' : 'smooth'
    if (it.id === '__top') return window.scrollTo({ top: 0, behavior })
    if (it.id === '__theme') return onTheme()
    const el = document.getElementById(it.id)
    if (el) {
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 56
      const top = el.getBoundingClientRect().top + window.scrollY - navH - 12
      window.scrollTo({ top, behavior })
    }
  }

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[sel]) run(flat[sel]) }
  }

  let idx = -1
  return (
    <div
      className="cmdk"
      onMouseDown={(e) => { if (e.target.classList.contains('cp-scrim') || e.target.classList.contains('cmdk')) onClose() }}
    >
      <div className="cp-scrim" />
      <div className="cp-panel" role="dialog" aria-modal="true" aria-label="command palette">
        <div className="cp-search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="search sections and actions"
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0) }}
            onKeyDown={onKey}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={flat[sel] ? `cmdk-opt-${sel}` : undefined}
            aria-label="search sections and actions"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="cp-results" id="cmdk-list" role="listbox" aria-label="results">
          {flat.length === 0 ? (
            <div className="cp-empty">
              <SearchX size={20} aria-hidden="true" />
              <div className="cp-empty-t">no matches for "{q}"</div>
              <div className="cp-empty-d">try a section name like color, states or overlays</div>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.group}>
                <div className="cp-group">{g.group}</div>
                {g.items.map((it) => {
                  idx += 1
                  const i = idx
                  const selected = i === sel
                  const Icon = it.Icon
                  return (
                    <div
                      key={it.id}
                      id={`cmdk-opt-${i}`}
                      className="cp-row"
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => setSel(i)}
                      onClick={() => run(it)}
                    >
                      <span className="cp-mark">{selected ? '>' : ''}</span>
                      <Icon size={16} aria-hidden="true" />
                      <span className="cp-label">{it.label}</span>
                      <span className="cp-meta">{it.kind}</span>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="cp-foot">
          <span className="cp-count" aria-live="polite">{flat.length} result{flat.length === 1 ? '' : 's'}</span>
          <span className="cp-keys">
            <span><span className="kbd">↑</span><span className="kbd">↓</span> move</span>
            <span><span className="kbd">↵</span> open</span>
            <span><span className="kbd">esc</span> close</span>
          </span>
        </div>
      </div>
    </div>
  )
}
