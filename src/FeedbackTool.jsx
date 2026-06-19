import { useEffect, useRef, useState } from 'react'
import { MessageSquarePlus, Crosshair, X, Check } from 'lucide-react'
import { useToast } from './ui/ToastHost.jsx'

/* in-page feedback tool (a dev iteration aid; comments append to feedback.md through the
   vite /feedback middleware, and feedback.md is gitignored). one flow, no panels:

     press "comment" (or the c shortcut) -> the dom picker arms
     click any element            -> the note popup opens on the right, focused
     write, then cmd/ctrl + enter -> it appends to feedback.md and re-arms for the next one
     esc                          -> backs out one step (cancel the note, then disarm)

   the picker stays armed after a save so a review sweep is a quick click-write-save loop.
   disabled entirely with ?fb=off (the validation gate runs that way). */

const isHttp = /^https?:$/.test(location.protocol)

/* ---- target description: a stable-ish css selector + the owning section + a text snippet,
   built only when an element is picked (never while idle) ---- */
function selectorFor(el) {
  if (el.id) return '#' + el.id
  const parts = []
  let node = el,
    guard = 0
  while (node && node.nodeType === 1 && node !== document.body && guard++ < 6) {
    let part = node.tagName.toLowerCase()
    if (node.classList.length) part += '.' + Array.prototype.slice.call(node.classList, 0, 3).join('.')
    const parent = node.parentElement
    if (parent) {
      const same = Array.prototype.filter.call(parent.children, (c) => c.tagName === node.tagName)
      if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')'
    }
    parts.unshift(part)
    if (node.id) {
      parts[0] = '#' + node.id
      break
    }
    node = parent
  }
  return parts.join(' > ')
}
function sectionOf(el) {
  let p = el
  while (p && p !== document.body) {
    if (p.matches && p.matches('section.band')) {
      const l = p.querySelector(':scope > .label')
      return l ? l.textContent.trim() : ''
    }
    if (p.matches && p.matches('.group')) {
      const h = p.querySelector('h2')
      return h ? h.textContent.trim() : ''
    }
    p = p.parentElement
  }
  return ''
}
// a cheap label for the hover tag: tag + id + first classes, NO textContent. the hover path runs on
// every mouse move, so it must never touch textContent (a big container's textContent is megabytes and
// the regex over it froze the page); the full describe (with text) runs only once, on save.
function labelFor(el) {
  const cls = el.classList.length ? '.' + Array.prototype.join.call(el.classList, '.') : ''
  return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls
}
function describe(el) {
  return {
    selector: selectorFor(el),
    label: labelFor(el),
    section: sectionOf(el),
    // slice BEFORE the regex so even a huge container is cheap (was running \s+ over the whole subtree)
    text: (el.textContent || '').slice(0, 200).replace(/\s+/g, ' ').trim().slice(0, 70),
  }
}
function stamp() {
  const d = new Date(),
    p = (n) => (n < 10 ? '0' : '') + n
  return (
    d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
  )
}
function mdOf(e) {
  let s = '## ' + (e.section || 'page') + '  (' + e.ts + ', ' + e.theme + ')\n'
  s += '**target:** `' + e.selector + '`\n'
  if (e.text) s += '**text:** ' + e.text + '\n'
  s += '**comment:** ' + e.comment + '\n\n---\n'
  return s
}

export default function FeedbackTool() {
  const notify = useToast()
  const [armed, setArmed] = useState(false)
  // null when idle; { desc, top } positions the right-side note popup over the picked node
  const [compose, setCompose] = useState(null)
  const tagRef = useRef(null) // the hover label
  const taRef = useRef(null) // the note textarea
  const targetRef = useRef(null) // the picked element, kept out of state so it never re-renders

  // re-arm the picker and clear the open note (used by save, cancel and esc)
  function endCompose() {
    setCompose(null)
    targetRef.current = null
    setArmed(true)
  }

  function saveComment() {
    const v = (taRef.current?.value || '').trim()
    if (!v) {
      taRef.current?.focus()
      return
    }
    const el = targetRef.current
    if (!el) {
      endCompose()
      return
    }
    if (!isHttp) {
      notify.err('open the page through pnpm dev to write feedback.md.', { title: "can't save on file://" })
      return
    }
    const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
    const d = describe(el)
    const entry = { selector: d.selector, section: d.section, text: d.text, comment: v, theme, ts: stamp() }
    fetch('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: mdOf(entry) }),
    })
      .then((r) => {
        if (!r || !r.ok) throw 0
        notify.ok('appended to feedback.md.', { title: 'saved' })
        endCompose() // re-arm so the next element is one click away; the note text is gone only on success
      })
      .catch(() => notify.err('the dev server is not writing - run pnpm dev.', { title: "couldn't save" }))
  }

  // shortcuts: c toggles the picker (when not typing); esc backs out one step; cmd/ctrl+enter
  // (bound on the textarea) saves. rebinds on armed/compose change so it reads current state.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (compose) {
          e.preventDefault()
          endCompose()
        } else if (armed) setArmed(false)
        return
      }
      if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey && !compose) {
        const ae = document.activeElement
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return
        e.preventDefault()
        setArmed((a) => !a)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armed, compose])

  // picker: hover highlights an element, click selects it. listeners live only while armed,
  // captured so a click selects instead of activating the underlying control. the tool's own
  // chrome carries data-fb and is skipped; so are page-sized wrappers.
  useEffect(() => {
    if (!armed) return
    document.body.classList.add('fbk-arming')
    // cheap structural rejects — NO layout read, so this is safe to run on every mousemove.
    const badCheap = (el) => {
      if (!el || el.nodeType !== 1) return true
      const t = el.tagName
      if (t === 'HTML' || t === 'BODY' || el.id === 'root') return true
      if (el.classList && el.classList.contains('pds-root')) return true
      return false
    }
    // the page-sized-wrapper reject NEEDS a rect, and getBoundingClientRect() forces a synchronous
    // reflow - so it runs ONLY on click (once), never on hover. the hover path stays layout-free.
    const tooBig = (r) => r.width >= innerWidth * 0.97 && r.height >= innerHeight * 0.92
    const badTarget = (el) => badCheap(el) || tooBig(el.getBoundingClientRect())
    // hover state, kept in refs (never in react state, so a hover never re-renders). `outlined` is the
    // element currently wearing the highlight outline; `hoverEl` is the last element we evaluated;
    // px/py are the last pointer coords used to place the label.
    let rafId = 0, pending = null, hoverEl = null, outlined = null, px = 0, py = 0
    const clearHover = () => {
      if (outlined) { outlined.classList.remove('fbk-target'); outlined = null }
      hoverEl = null
      pending = null // cancel any queued paint so it can't re-apply the outline after we clear
      if (tagRef.current) tagRef.current.style.display = 'none'
    }
    // THE FREEZE FIX. the previous overlay was a fixed box positioned over the hovered element, which
    // meant reading el.getBoundingClientRect() every frame - a SYNCHRONOUS reflow. on this page (a 30fps
    // ascii redraw mutating <pre> textContent, plus a scroll-spy that re-renders the whole tree) layout
    // is perpetually dirty, so each read relayouts the entire document; sweeping a real pointer fires
    // 100s of moves/sec and the main thread never catches up -> the page freezes. the highlight is now an
    // OUTLINE on the element itself (outline doesn't affect layout, so it needs no measurement and forces
    // no reflow) and the label is placed from the pointer coords. result: the hover path does ZERO layout
    // reads and ZERO geometry writes. rAF-throttled, and element-deduped so same-element moves are a
    // single ref compare.
    const paint = () => {
      rafId = 0
      const el = pending
      pending = null
      if (!el) return
      const tag = tagRef.current
      if (tag) {
        // build the label BEFORE adding our class, or labelFor would capture 'fbk-target' in the tag
        const section = sectionOf(el)
        tag.textContent = (section ? section + ' / ' : '') + labelFor(el)
        tag.style.left = Math.max(2, Math.min(px + 12, innerWidth - 220)) + 'px'
        tag.style.top = Math.max(2, py - 24) + 'px'
        tag.style.display = 'block'
      }
      if (outlined && outlined !== el) outlined.classList.remove('fbk-target')
      el.classList.add('fbk-target')
      outlined = el
    }
    const onMove = (e) => {
      px = e.clientX
      py = e.clientY
      const el = e.target
      if (el === hoverEl) return // still on the same element: the outline is already correct, do nothing
      if (badCheap(el) || (el.closest && el.closest('[data-fb]'))) {
        clearHover()
        return
      }
      hoverEl = el
      pending = el
      if (!rafId) rafId = requestAnimationFrame(paint)
    }
    const onClick = (e) => {
      if ((e.target.closest && e.target.closest('[data-fb]')) || badTarget(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      const el = e.target
      // drop our own highlight class BEFORE describing the element, or the generated css selector +
      // label would capture 'fbk-target' (the outline is otherwise only removed later, on teardown).
      if (outlined) { outlined.classList.remove('fbk-target'); outlined = null }
      el.classList.remove('fbk-target')
      targetRef.current = el
      const d = describe(el)
      const r = el.getBoundingClientRect()
      const top = Math.min(Math.max(r.top, 64), Math.max(64, innerHeight - 260))
      setArmed(false) // freeze hovering while the note is open
      setCompose({ desc: (d.section ? d.section + '  ' : '') + d.selector, top })
      setTimeout(() => taRef.current?.focus(), 30)
    }
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('click', onClick, true)
    window.addEventListener('scroll', clearHover, true)
    return () => {
      document.body.classList.remove('fbk-arming')
      if (rafId) cancelAnimationFrame(rafId)
      clearHover()
      document.removeEventListener('mousemove', onMove, true)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('scroll', clearHover, true)
    }
  }, [armed])

  const onComposeKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      saveComment()
    }
  }

  return (
    <>
      <button
        className={'fbk-launch' + (armed ? ' armed' : '')}
        data-fb
        aria-pressed={armed}
        aria-label={armed ? 'stop selecting an element to comment on (esc)' : 'comment on an element (c)'}
        onClick={() => (armed ? setArmed(false) : (setCompose(null), setArmed(true)))}
      >
        {armed ? (
          <>
            <Crosshair aria-hidden="true" /> selecting <span className="cnt">esc</span>
          </>
        ) : (
          <>
            <MessageSquarePlus aria-hidden="true" /> comment <span className="cnt">c</span>
          </>
        )}
      </button>

      <div ref={tagRef} className="fbk-tag" data-fb />

      {compose && (
        <div className="fbk-pop" data-fb style={{ top: compose.top }}>
          <div className="fbk-pop-h" data-fb>
            <span>
              <Crosshair aria-hidden="true" /> new comment
            </span>
            <button className="fbk-x" data-fb aria-label="cancel (esc)" onClick={endCompose}>
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="fbk-pop-b" data-fb>
            <div className="fbk-pop-tgt" data-fb>{compose.desc}</div>
            <textarea
              ref={taRef}
              className="input"
              data-fb
              rows={4}
              placeholder="what should change here?"
              onKeyDown={onComposeKey}
            />
          </div>
          <div className="fbk-pop-f" data-fb>
            <button className="btn btn-ghost btn-sm" data-fb onClick={endCompose}>
              cancel
            </button>
            <button className="btn btn-primary btn-sm" data-fb onClick={saveComment}>
              <Check aria-hidden="true" /> save <span className="fbk-kbd">⌘↵</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
