import { useState } from 'react'
import { SquareTerminal, ShieldCheck, TriangleAlert, CircleX, Hash, Clock, GitBranch, Eye, X, Check, Filter, Bell, Inbox } from 'lucide-react'

/* 42-badges: chips (.chip variants), status dots, count badges; each state pairs an
   icon + label. provider marks use brand <svg><use href="#b-*"/> (NOT lucide) and stay
   as raw svg; all other glyphs were <i data-lucide> -> lucide-react. swatch-like
   .chipx-dot keeps its literal --c var. dtable keeps the literal ">=24px" cue text. */

/* interactive filter chips: each is an independent toggle. reuses the global
   .chip-toggle aria-pressed active style (amber fill); the tick / filter glyph is
   swapped in jsx, so no global chip css is touched. */
const FILTER_CHIPS = [
  { id: 'verified', label: 'verified', on: true },
  { id: 'public', label: 'public', on: true },
  { id: 'has-subagents', label: 'has-subagents', on: false },
  { id: 'long-running', label: 'long-running', on: false },
]
function FilterChips() {
  const [pressed, setPressed] = useState(() =>
    Object.fromEntries(FILTER_CHIPS.map((c) => [c.id, c.on]))
  )
  return (
    <div className="chips" style={{ marginBottom: 'var(--sp-6)' }}>
      {FILTER_CHIPS.map(({ id, label }) => {
        const isOn = pressed[id]
        return (
          <button
            key={id}
            className="chip chip-toggle"
            type="button"
            aria-pressed={isOn}
            onClick={() => setPressed((p) => ({ ...p, [id]: !p[id] }))}
          >
            {isOn
              ? <Check className="chipx-tick" aria-hidden="true" />
              : <Filter aria-hidden="true" />} {label}
          </button>
        )
      })}
    </div>
  )
}

export function BadgesSection() {
  return (
    <section className="band" id="badges">
      <h2 className="label">badges, providers &amp; states</h2>
      <div className="sub">icons carry meaning at a glance</div>
      <p className="prose">a badge reads in one pass: an icon names the thing, a short label confirms it, and color reinforces. provider marks tag where a transcript came from; state and metric chips report its outcome and size. state is never carried by color alone.</p>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>providers</span>
          <div className="chips" style={{ marginBottom: 'var(--sp-6)' }}>
            <span className="chip"><span className="g-claude"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-claude" /></svg></span> claude-code</span>
            <span className="chip"><span className="g-gemini"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-gemini" /></svg></span> gemini-cli</span>
            <span className="chip"><span className="g-opencode"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-opencode" /></svg></span> opencode</span>
            <span className="chip"><span className="g-cursor"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-cursor" /></svg></span> cursor</span>
            <span className="chip"><span className="g-codex"><SquareTerminal aria-hidden="true" /></span> codex</span>
          </div>
          <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>states</span>
          <div className="chips" style={{ marginBottom: 'var(--sp-6)' }}>
            <span className="chip chip-ok"><ShieldCheck aria-hidden="true" /> redacted</span>
            <span className="chip chip-warn"><TriangleAlert aria-hidden="true" /> partial</span>
            <span className="chip chip-err"><CircleX aria-hidden="true" /> failed</span>
          </div>
          <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>metrics</span>
          <div className="chips">
            <span className="chip"><Hash aria-hidden="true" /> <b className="tnum" style={{ color: 'var(--ink)' }}>42,318</b> tokens</span>
            <span className="chip"><Clock aria-hidden="true" /> <span className="tnum">2h 14m</span></span>
            <span className="chip"><GitBranch aria-hidden="true" /> <span className="tnum">18</span> turns</span>
            <span className="chip"><Eye aria-hidden="true" /> public</span>
          </div>
        </div>
      </div>
      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>chip depth: removable, filter, status, counts</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>removable (real x button)</span>
          <div className="chips" style={{ marginBottom: 'var(--sp-6)' }}>
            <span className="chip chip-removable">desert-archivists <button className="chipx-x" type="button" aria-label="remove desert-archivists"><X aria-hidden="true" /></button></span>
            <span className="chip chip-removable">redacted-only <button className="chipx-x" type="button" aria-label="remove redacted-only"><X aria-hidden="true" /></button></span>
            <span className="chip chip-removable chip-sm">claude-code <button className="chipx-x" type="button" aria-label="remove claude-code"><X aria-hidden="true" /></button></span>
          </div>

          <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>filter / toggle (aria-pressed)</span>
          <FilterChips />

          <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>status dot + label</span>
          <div className="chips" style={{ marginBottom: 'var(--sp-6)' }}>
            <span className="chip"><span className="chipx-dot" style={{ '--c': 'var(--olive)' }}></span> live</span>
            <span className="chip"><span className="chipx-dot" style={{ '--c': 'var(--amber)' }}></span> indexing</span>
            <span className="chip"><span className="chipx-dot" style={{ '--c': 'var(--clay)' }}></span> stalled</span>
            <span className="chip"><span className="chipx-dot" style={{ '--c': 'var(--ink-3)' }}></span> archived</span>
          </div>

          <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>notification count + size variants</span>
          <div className="chips">
            <span className="chip"><Bell aria-hidden="true" /> review queue <span className="chipx-count unread tnum">12</span></span>
            <span className="chip"><GitBranch aria-hidden="true" /> branches <span className="chipx-count tnum">7</span></span>
            <span className="chip chip-sm"><Bell aria-hidden="true" /> mentions <span className="chipx-count unread tnum">3</span></span>
            <span className="chip chip-sm"><Inbox aria-hidden="true" /> drafts <span className="chipx-count tnum">0</span></span>
          </div>
        </div>
      </div>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>variant</th><th>state</th><th>cue beyond color</th></tr></thead>
          <tbody>
            <tr><td className="dt-name">removable</td><td className="dt-val">button aria-label="remove ..."</td><td className="dt-role">x icon, own &gt;=24px hit box</td></tr>
            <tr><td className="dt-name">toggle selected</td><td className="dt-val">aria-pressed="true"</td><td className="dt-role">check icon + amber fill</td></tr>
            <tr><td className="dt-name">toggle unselected</td><td className="dt-val">aria-pressed="false"</td><td className="dt-role">filter icon + outline</td></tr>
            <tr><td className="dt-name">status dot</td><td className="dt-val">label always present</td><td className="dt-role">word names the state</td></tr>
            <tr><td className="dt-name">count</td><td className="dt-val">.unread vs neutral</td><td className="dt-role">tabular digits, leading icon</td></tr>
            <tr><td className="dt-name">size</td><td className="dt-val">.chip-sm</td><td className="dt-role">24px box, 13px glyphs</td></tr>
          </tbody>
        </table>
      </div>
      <div className="callout" style={{ marginTop: 'var(--sp-6)' }}><ShieldCheck aria-hidden="true" /><div>state never rides on color alone: redacted carries shield-check, partial a triangle, failed a circle-x. counts and durations are tabular.</div></div>
    </section>
  )
}
