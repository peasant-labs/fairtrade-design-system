import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'

/* date-range (.dr-*): a NEW tier-2 control. a trigger button (reuses the .btn chassis)
   plus a floating panel (reuses the .pop-card / .menu-pop surface conventions) holding a
   preset rail and two month grids. only the calendar grid + day cells are new css; every
   colour, border, radius and focus-ring comes from the existing tokens. amber stays scarce:
   the two selected endpoints + the active preset border are the only saturated-amber marks,
   today is a hairline ring, and the range interior is a quiet color-mix wash. all chrome is
   lowercase; the date values themselves keep the system's lowercase month names but are never
   force-lowercased beyond that. keyboard: a roving-tabindex grid (arrows / home / end / pageup
   / pagedown / shift+pageup-down / enter-space), Esc returns focus to the trigger like Menu. */

/* ----- pure date helpers (operate on ISO yyyy-mm-dd strings, locale-stable, no tz drift) ----- */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MONTHS_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] // monday-first labels, rotated by weekStartsOn

const pad = (n) => String(n).padStart(2, '0')

// build an ISO yyyy-mm-dd from numeric parts (no Date object -> no timezone shift)
function iso(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}` }

// parse an ISO yyyy-mm-dd into {y,m,d}; m is 0-based. returns null for empty/invalid.
function parseISO(s) {
  if (!s || typeof s !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return { y: +m[1], m: +m[2] - 1, d: +m[3] }
}

// today's ISO at call time, read from the local clock (never hardcoded).
function todayISO() {
  const n = new Date()
  return iso(n.getFullYear(), n.getMonth(), n.getDate())
}

// days in a 0-based month
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }

// 0..6 weekday for the 1st of a month, then rotated so `weekStartsOn` maps to column 0.
function leadingBlanks(y, m, weekStartsOn) {
  const dow = new Date(y, m, 1).getDay() // 0=sun
  return (dow - weekStartsOn + 7) % 7
}

// step an ISO date by `days` (can cross month/year), returning a new ISO string.
function addDays(isoStr, days) {
  const p = parseISO(isoStr)
  if (!p) return isoStr
  const dt = new Date(p.y, p.m, p.d + days)
  return iso(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

// step a {y,m} cursor by whole months
function addMonths(cur, months) {
  const total = cur.y * 12 + cur.m + months
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 }
}

// lexicographic compare works for zero-padded ISO; returns <0 / 0 / >0
function cmpISO(a, b) { return a < b ? -1 : a > b ? 1 : 0 }

function isBetween(d, lo, hi) { return cmpISO(d, lo) >= 0 && cmpISO(d, hi) <= 0 }

// clamp an ISO date to [min,max] when those bounds are set
function inBounds(d, min, max) {
  if (min && cmpISO(d, min) < 0) return false
  if (max && cmpISO(d, max) > 0) return false
  return true
}

/* ----- formatting ----- */

/**
 * formatRange({from,to}) -> a lowercase, tabular display string.
 *   {from:'2026-06-01', to:'2026-06-14'} -> "jun 1 – jun 14, 2026"
 *   same month is collapsed; a single day drops the dash; an open value returns "".
 * @param {{from:string|null,to:string|null}} value
 * @param {{long?:boolean}} [opts]  long=true spells the month ("june" not "jun")
 */
export function formatRange(value, opts = {}) {
  const { from, to } = value || {}
  const names = opts.long ? MONTHS : MONTHS_ABBR
  const a = parseISO(from)
  const b = parseISO(to)
  if (!a && !b) return ''
  if (a && !b) return `${names[a.m]} ${a.d}, ${a.y}`
  if (!a && b) return `${names[b.m]} ${b.d}, ${b.y}`
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `${names[a.m]} ${a.d}, ${a.y}`
  if (a.y === b.y && a.m === b.m) return `${names[a.m]} ${a.d} – ${b.d}, ${a.y}`
  if (a.y === b.y) return `${names[a.m]} ${a.d} – ${names[b.m]} ${b.d}, ${a.y}`
  return `${names[a.m]} ${a.d}, ${a.y} – ${names[b.m]} ${b.d}, ${b.y}`
}

// a fully-spelled, screen-reader name for a single day ("14 june 2026")
function spellDay(isoStr) {
  const p = parseISO(isoStr)
  if (!p) return ''
  return `${p.d} ${MONTHS[p.m]} ${p.y}`
}

// a fully-spelled span for the live region / trigger aria-label
function spellRange(value) {
  const { from, to } = value || {}
  if (!from && !to) return 'no dates'
  if (from && !to) return `from ${spellDay(from)}`
  if (from && to && from === to) return spellDay(from)
  return `${spellDay(from)} to ${spellDay(to)}`
}

/* ----- default presets (computed relative to "now" at call time, never hardcoded) ----- */

function startOfMonth(isoStr) { const p = parseISO(isoStr); return iso(p.y, p.m, 1) }
function endOfMonth(isoStr) { const p = parseISO(isoStr); return iso(p.y, p.m, daysInMonth(p.y, p.m)) }

/**
 * DATE_PRESETS - the default quick-range list. each `range()` is evaluated at open time
 * against today's local date, so "last 7 days" always tracks the real calendar.
 */
export const DATE_PRESETS = [
  { id: 'today', label: 'today', range: () => { const t = todayISO(); return { from: t, to: t } } },
  { id: 'yesterday', label: 'yesterday', range: () => { const y = addDays(todayISO(), -1); return { from: y, to: y } } },
  { id: 'last-7', label: 'last 7 days', range: () => { const t = todayISO(); return { from: addDays(t, -6), to: t } } },
  { id: 'last-30', label: 'last 30 days', range: () => { const t = todayISO(); return { from: addDays(t, -29), to: t } } },
  { id: 'this-month', label: 'this month', range: () => { const t = todayISO(); return { from: startOfMonth(t), to: endOfMonth(t) } } },
  { id: 'last-month', label: 'last month', range: () => { const p = parseISO(todayISO()); const prev = addMonths(p, -1); const s = iso(prev.y, prev.m, 1); return { from: s, to: endOfMonth(s) } } },
  { id: 'last-90', label: 'last 90 days', range: () => { const t = todayISO(); return { from: addDays(t, -89), to: t } } },
  { id: 'ytd', label: 'year to date', range: () => { const p = parseISO(todayISO()); return { from: iso(p.y, 0, 1), to: todayISO() } } },
]

// span length in whole days, inclusive, for the live readout
function spanDays(value) {
  const a = parseISO(value?.from)
  const b = parseISO(value?.to)
  if (!a || !b) return 0
  const ms = new Date(b.y, b.m, b.d) - new Date(a.y, a.m, a.d)
  return Math.round(ms / 86400000) + 1
}

/* ----- the bare two-grid picker (no trigger): DateRangeCalendar ----- */

/**
 * @typedef {Object} CalendarProps
 * @property {{from:string|null,to:string|null}} [value]         controlled ISO range
 * @property {{from:string|null,to:string|null}} [defaultValue]  uncontrolled seed
 * @property {(v:{from:string|null,to:string|null}) => void} [onChange]       fires on a committed range
 * @property {(v:{from:string|null,to:string|null}) => void} [onDraftChange]  fires on each in-grid change before commit
 * @property {string} [min]   ISO lower bound (inclusive); out-of-range days are aria-disabled
 * @property {string} [max]   ISO upper bound (inclusive)
 * @property {1|2} [numberOfMonths]  months shown side by side (collapses to 1 under ~560px via container query)
 * @property {0|1|2|3|4|5|6} [weekStartsOn]  first column weekday (1 = monday, ISO default)
 * @property {string} [className]  extra classes on the .dr-cal wrapper (e.g. "is-static" for embeds)
 * @property {(focusedISO:string) => void} [onAutoFocus]  internal: notified when the grid focuses a day
 * @property {boolean} [autoFocus]  move DOM focus into the focused day on mount
 */
export function DateRangeCalendar({
  value,
  defaultValue = { from: null, to: null },
  onChange,
  onDraftChange,
  min,
  max,
  numberOfMonths = 2,
  weekStartsOn = 1,
  className = '',
  autoFocus = false,
  gridLabelId,
}) {
  const controlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue)
  const range = controlled ? value : internal

  // the month the left grid shows; seeded from the current `from`, else today.
  const seedCursor = () => {
    const anchor = parseISO(range?.from) || parseISO(todayISO())
    return { y: anchor.y, m: anchor.m }
  }
  const [cursor, setCursor] = useState(seedCursor)

  // the day that currently owns tabIndex=0 (the roving focus). seeded to from/today.
  const [focusISO, setFocusISO] = useState(() => range?.from || todayISO())
  // a hovered/keyboard preview endpoint while only `from` is chosen
  const [preview, setPreview] = useState(null)

  const dayRefs = useRef(new Map())
  const wantFocus = useRef(autoFocus)

  // keep the displayed month in view when a controlled `from` jumps
  useEffect(() => {
    const f = parseISO(range?.from)
    if (f) setCursor((c) => (c.y === f.y && c.m === f.m ? c : { y: f.y, m: f.m }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from])

  const today = todayISO()
  const months = useMemo(() => {
    const out = []
    for (let i = 0; i < numberOfMonths; i++) out.push(addMonths(cursor, i))
    return out
  }, [cursor, numberOfMonths])

  const commit = (next) => {
    if (!controlled) setInternal(next)
    onChange?.(next)
  }

  // a click / Enter on a day: anchor or close the range.
  const pickDay = (d) => {
    if (!inBounds(d, min, max)) return
    const hasFrom = !!range?.from
    const hasTo = !!range?.to
    if (!hasFrom || hasTo) {
      // start (or re-start) a new range: set `from`, clear `to`.
      const next = { from: d, to: null }
      if (!controlled) setInternal(next)
      onDraftChange?.(next)
      setPreview(null)
      return
    }
    // we have a `from` and no `to`: this click sets the other end.
    if (cmpISO(d, range.from) < 0) {
      // earlier than `from` -> re-anchor, no error state
      const next = { from: d, to: null }
      if (!controlled) setInternal(next)
      onDraftChange?.(next)
      setPreview(null)
      return
    }
    const next = { from: range.from, to: d }
    setPreview(null)
    commit(next)
  }

  const hoverDay = (d) => {
    if (range?.from && !range?.to && inBounds(d, min, max)) {
      setPreview(d)
      onDraftChange?.({ from: range.from, to: cmpISO(d, range.from) >= 0 ? d : range.from })
    }
  }

  // move the roving focus to an ISO day, scrolling the months if it falls outside view.
  const moveFocus = useCallback((nextISO) => {
    const p = parseISO(nextISO)
    if (!p) return
    setFocusISO(nextISO)
    setCursor((c) => {
      const lastShown = addMonths(c, numberOfMonths - 1)
      const before = p.y < c.y || (p.y === c.y && p.m < c.m)
      const after = p.y > lastShown.y || (p.y === lastShown.y && p.m > lastShown.m)
      if (before) return { y: p.y, m: p.m }
      if (after) return addMonths({ y: p.y, m: p.m }, -(numberOfMonths - 1))
      return c
    })
    wantFocus.current = true
  }, [numberOfMonths])

  // after a focus move, place real DOM focus on the now-tabbable day
  useEffect(() => {
    if (!wantFocus.current) return
    const el = dayRefs.current.get(focusISO)
    if (el) { el.focus(); wantFocus.current = false }
  })

  // mount auto-focus (used when the popover opens)
  useEffect(() => {
    if (autoFocus) { wantFocus.current = true; const el = dayRefs.current.get(focusISO); if (el) { el.focus(); wantFocus.current = false } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])

  // skip aria-disabled (out-of-bounds) days when arrowing
  const stepWithin = (start, delta) => {
    let d = start
    for (let guard = 0; guard < 400; guard++) {
      d = addDays(d, delta)
      if (inBounds(d, min, max)) return d
      // if we have walked out of both bounds entirely, stop at the start
      if (delta > 0 && max && cmpISO(d, max) > 0) return start
      if (delta < 0 && min && cmpISO(d, min) < 0) return start
    }
    return start
  }

  const onGridKey = (e) => {
    const cur = focusISO
    let next = null
    switch (e.key) {
      case 'ArrowLeft': next = stepWithin(cur, -1); break
      case 'ArrowRight': next = stepWithin(cur, 1); break
      case 'ArrowUp': next = stepWithin(cur, -7); break
      case 'ArrowDown': next = stepWithin(cur, 7); break
      case 'Home': { const p = parseISO(cur); const dow = (new Date(p.y, p.m, p.d).getDay() - weekStartsOn + 7) % 7; const tgt = addDays(cur, -dow); next = inBounds(tgt, min, max) ? tgt : stepWithin(tgt, 1); break }
      case 'End': { const p = parseISO(cur); const dow = (new Date(p.y, p.m, p.d).getDay() - weekStartsOn + 7) % 7; const tgt = addDays(cur, 6 - dow); next = inBounds(tgt, min, max) ? tgt : stepWithin(tgt, -1); break }
      case 'PageUp': { const p = parseISO(cur); const m = addMonths(p, e.shiftKey ? -12 : -1); const dd = Math.min(p.d, daysInMonth(m.y, m.m)); next = iso(m.y, m.m, dd); if (!inBounds(next, min, max)) next = min || next; break }
      case 'PageDown': { const p = parseISO(cur); const m = addMonths(p, e.shiftKey ? 12 : 1); const dd = Math.min(p.d, daysInMonth(m.y, m.m)); next = iso(m.y, m.m, dd); if (!inBounds(next, min, max)) next = max || next; break }
      case 'Enter':
      case ' ':
        e.preventDefault()
        pickDay(cur)
        return
      default:
        return
    }
    if (next) { e.preventDefault(); moveFocus(next) }
  }

  // the resolved span used for the (optional) preview band while picking
  const previewEnd = range?.from && !range?.to && preview && cmpISO(preview, range.from) >= 0 ? preview : null

  const dowLabels = useMemo(() => {
    const out = []
    for (let i = 0; i < 7; i++) out.push(WEEKDAYS[(weekStartsOn - 1 + i + 7) % 7])
    return out
  }, [weekStartsOn])

  const renderMonth = (cm, idx) => {
    const { y, m } = cm
    const total = daysInMonth(y, m)
    const blanks = leadingBlanks(y, m, weekStartsOn)
    const cells = []
    for (let i = 0; i < blanks; i++) cells.push(null)
    for (let d = 1; d <= total; d++) cells.push(d)
    // pad to whole weeks so each row has 7 cells
    while (cells.length % 7 !== 0) cells.push(null)
    const rows = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

    const monthLabelId = `${gridLabelId || 'dr'}-m${idx}`
    return (
      <div className="dr-month" key={`${y}-${m}`}>
        <div className="dr-mhead">
          {idx === 0 ? (
            <button type="button" className="dr-nav" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="previous month"
              disabled={!!min && cmpISO(iso(y, m, 1), startOfMonth(min)) <= 0}>
              <ChevronLeft aria-hidden="true" />
            </button>
          ) : <span className="dr-nav" aria-hidden="true" style={{ visibility: 'hidden' }} />}
          <span className="dr-mtitle" id={monthLabelId}>{MONTHS[m]} {y}</span>
          {idx === months.length - 1 ? (
            <button type="button" className="dr-nav" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="next month"
              disabled={!!max && cmpISO(iso(y, m, total), endOfMonth(max)) >= 0}>
              <ChevronRight aria-hidden="true" />
            </button>
          ) : <span className="dr-nav" aria-hidden="true" style={{ visibility: 'hidden' }} />}
        </div>
        <div className="dr-grid" role="grid" aria-labelledby={monthLabelId}>
          <div className="dr-wdrow" role="row">
            {dowLabels.map((w) => <span key={w} className="dr-wd" role="columnheader" aria-hidden="true">{w}</span>)}
          </div>
          {rows.map((week, wi) => (
            <div className="dr-week" role="row" key={wi}>
              {week.map((d, di) => {
                if (d == null) return <span key={di} className="dr-day dr-out" role="gridcell" aria-hidden="true" />
                const cellISO = iso(y, m, d)
                const disabled = !inBounds(cellISO, min, max)
                const isFrom = range?.from === cellISO
                const isTo = range?.to === cellISO
                const isEdge = isFrom || isTo
                const inRange = range?.from && range?.to && isBetween(cellISO, range.from, range.to)
                const inPreview = !inRange && previewEnd && isBetween(cellISO, range.from, previewEnd)
                const isToday = cellISO === today
                const isTab = cellISO === focusISO
                const cls = ['dr-day']
                if (isEdge) cls.push('dr-edge')
                else if (inRange) cls.push('dr-in-range')
                else if (inPreview) cls.push('dr-preview')
                if (isToday) cls.push('dr-today')
                return (
                  <div className="dr-cell" role="gridcell" key={di} aria-selected={isEdge ? 'true' : undefined}>
                    <button
                      type="button"
                      className={cls.join(' ')}
                      ref={(el) => { if (el) dayRefs.current.set(cellISO, el); else dayRefs.current.delete(cellISO) }}
                      tabIndex={isTab ? 0 : -1}
                      aria-label={spellDay(cellISO)}
                      aria-disabled={disabled ? 'true' : undefined}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => !disabled && pickDay(cellISO)}
                      onFocus={() => setFocusISO(cellISO)}
                      onMouseEnter={() => !disabled && hoverDay(cellISO)}
                    >
                      {d}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={['dr-cal', className].filter(Boolean).join(' ')}>
      <div className="dr-grids" onKeyDown={onGridKey} onMouseLeave={() => setPreview(null)}>
        {months.map(renderMonth)}
      </div>
    </div>
  )
}

/* ----- the full trigger + popover control: DateRange ----- */

// does the live value exactly equal a preset's resolved range?
function matchesPreset(value, preset) {
  if (!value?.from || !value?.to) return false
  const r = preset.range()
  return r.from === value.from && r.to === value.to
}

/**
 * @typedef {Object} DateRangeProps
 * @property {{from:string|null,to:string|null}} [value]         controlled ISO range
 * @property {{from:string|null,to:string|null}} [defaultValue]  uncontrolled seed
 * @property {(v:{from:string|null,to:string|null}) => void} [onChange]       fires only on a committed range / preset / clear
 * @property {(v:{from:string|null,to:string|null}) => void} [onDraftChange]  fires on each in-popover change before commit
 * @property {{id:string,label:string,range:() => ({from:string,to:string})}[]} [presets]  quick ranges; [] hides the rail
 * @property {string} [min]  ISO lower bound (inclusive)
 * @property {string} [max]  ISO upper bound (inclusive)
 * @property {1|2} [numberOfMonths]  desktop month count (auto-collapses to 1 under ~560px)
 * @property {0|1|2|3|4|5|6} [weekStartsOn]  first column weekday (1 = monday)
 * @property {string} [placeholder]  trigger label when empty (lowercase chrome)
 * @property {string} [label]  optional .label rendered above (form use)
 * @property {'start'|'end'} [align]  which trigger edge the popover aligns to
 * @property {'md'|'sm'} [size]  trigger height (36 / 28px)
 * @property {boolean} [disabled]
 * @property {boolean} [clearable]  show a clear (X) action in the footer when a range is set
 * @property {string} [id]  trigger id; popover id derives `${id}-pop`
 */
export default function DateRange({
  value,
  defaultValue = { from: null, to: null },
  onChange,
  onDraftChange,
  presets = DATE_PRESETS,
  min,
  max,
  numberOfMonths = 2,
  weekStartsOn = 1,
  placeholder = 'any dates',
  label,
  align = 'start',
  size = 'md',
  disabled = false,
  clearable = true,
  id,
}) {
  const autoId = useId()
  const triggerId = id || `dr-${autoId}`
  const popId = `${triggerId}-pop`
  const labelId = `${triggerId}-label`

  const controlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue)
  const live = controlled ? value : internal

  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const triggerRef = useRef(null)
  const popRef = useRef(null)

  const setValue = (next, fireCommit) => {
    if (!controlled) setInternal(next)
    if (fireCommit) onChange?.(next)
    else onDraftChange?.(next)
  }

  const openPanel = () => { if (!disabled) setOpen(true) }
  const close = (returnFocus) => {
    setOpen(false)
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  // outside-click + Esc (Esc returns focus to the trigger, exactly like Popover/Menu)
  useEffect(() => {
    if (!open) return
    const onDocDown = (e) => { if (anchorRef.current && !anchorRef.current.contains(e.target)) close(false) }
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(true) } }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /* keep the popover inside the viewport: the two-month grid can be wider than the room to the right of
     the trigger, so it would spill off the page edge. on open + resize, shift it horizontally by its
     overflow. we move it with margin (not transform) so it never fights the menuIn slide-in, and .dr-pop's
     max-width already caps it at the viewport width, so a horizontal shift always makes it fit. */
  useLayoutEffect(() => {
    const pop = popRef.current
    if (!pop) return
    if (!open) { pop.style.marginLeft = ''; pop.style.marginRight = ''; return }
    const place = () => {
      pop.style.marginLeft = ''
      pop.style.marginRight = ''
      const gutter = 8
      const r = pop.getBoundingClientRect()
      const overRight = r.right - (window.innerWidth - gutter)
      const overLeft = gutter - r.left
      if (overRight > 0) pop.style.marginLeft = `${-Math.round(overRight)}px`
      else if (overLeft > 0) pop.style.marginRight = `${-Math.round(overLeft)}px`
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  const onTriggerKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!open) { e.preventDefault(); openPanel() }
    }
  }

  // the grid commits (sets `to`) -> reflect into our value but keep the panel open for adjustment
  const onCalChange = (next) => { setValue(next, true) }
  const onCalDraft = (next) => { setValue(next, false) }

  const choosePreset = (preset) => {
    const r = preset.range()
    setValue(r, true)
    close(true)
  }

  const clear = () => { setValue({ from: null, to: null }, true) }

  const empty = !live?.from && !live?.to
  const display = empty ? placeholder : formatRange(live)
  const triggerName = empty ? placeholder : `dates: ${spellRange(live)}`
  const days = spanDays(live)
  const readout = empty
    ? 'no range selected'
    : live.from && !live.to
      ? `from ${formatRange({ from: live.from, to: null })}`
      : `${formatRange(live)} (${days} ${days === 1 ? 'day' : 'days'})`

  const hasPresets = presets && presets.length > 0

  return (
    <div className="dr-field">
      {label && <label className="label" id={labelId} htmlFor={triggerId}>{label}</label>}
      <div className="dr-anchor" ref={anchorRef}>
        <button
          ref={triggerRef}
          type="button"
          id={triggerId}
          className={['btn', 'btn-secondary', 'dr-trigger', size === 'sm' ? 'btn-sm' : ''].filter(Boolean).join(' ')}
          aria-haspopup="dialog"
          aria-expanded={open ? 'true' : 'false'}
          aria-controls={popId}
          aria-label={triggerName}
          aria-labelledby={label ? `${labelId} ${triggerId}` : undefined}
          disabled={disabled}
          onClick={() => (open ? close(true) : openPanel())}
          onKeyDown={onTriggerKey}
        >
          <Calendar className="dr-ico" aria-hidden="true" />
          <span className={empty ? 'dr-value dr-empty' : 'dr-value'}>{display}</span>
          <ChevronDown className="dr-caret" aria-hidden="true" />
        </button>

        <div
          ref={popRef}
          className={['dr-pop', align === 'end' ? 'dr-end' : ''].filter(Boolean).join(' ')}
          id={popId}
          role="dialog"
          aria-label="choose a date range"
          hidden={!open}
        >
          {hasPresets && (
            <div className="dr-presets" role="group" aria-label="quick ranges">
              {presets.map((p) => {
                const active = matchesPreset(live, p)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="dr-preset"
                    aria-pressed={active ? 'true' : 'false'}
                    onClick={() => choosePreset(p)}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          )}

          <div className="dr-body">
            {open && (
              <DateRangeCalendar
                value={live}
                onChange={onCalChange}
                onDraftChange={onCalDraft}
                min={min}
                max={max}
                numberOfMonths={numberOfMonths}
                weekStartsOn={weekStartsOn}
                autoFocus
                gridLabelId={popId}
              />
            )}
            <div className="dr-foot">
              <span className="dr-readout">{readout}</span>
              <div className="dr-foot-actions">
                {clearable && !empty && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={clear}>
                    <X className="dr-ico" aria-hidden="true" /> clear
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={() => close(true)}>apply</button>
              </div>
            </div>
          </div>

          {/* polite live region: announces the resolved span on every change */}
          <span className="dr-live" aria-live="polite">{open ? readout : ''}</span>
        </div>
      </div>
    </div>
  )
}
