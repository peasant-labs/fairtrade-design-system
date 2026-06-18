import { ChevronDown, Users, Check, Compass, Upload, ShieldCheck } from 'lucide-react'

/* 52-forms: forms, filters & empty states. value= inputs become defaultValue=,
   checked checkbox becomes defaultChecked (controlled-without-onChange gate). the two
   <i data-lucide="check" class="lucide"> keep their explicit className="lucide" verbatim.
   logo/brand svgs stay <use href="#..."/>. only icons moved to lucide-react. */
export function FormsSection() {
  return (
    <section className="band" id="forms">
      <h2 className="label">forms, filters &amp; empty states</h2>
      <div className="sub">low-traffic surfaces, left-aligned, the logo carries the imagery</div>
      <p className="prose">labels sit above their fields, every choice is reversible, and a view keeps to five actions at most.</p>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="cols cols-2">
            <div className="window framed">
              <div style={{ padding: 'var(--sp-4)', borderBottom: 'var(--bd)' }}>
                <svg className="logo" width="30" height="30" viewBox="0 0 32 32" style={{ color: 'var(--amber)', filter: 'drop-shadow(var(--glow-soft))', marginBottom: 'var(--sp-2)' }}><use href="#logo" /></svg>
                <div className="win-title" style={{ marginTop: 0 }}>create the <span className="hl">collective</span></div>
                <div className="label" style={{ marginTop: 'var(--sp-1)' }}>a shared shelf for redacted transcripts</div>
              </div>
              <div style={{ padding: 'var(--sp-4)' }}>
                <div className="field"><span className="label">name</span><input className="input" defaultValue="desert-archivists" /></div>
                <div className="field"><span className="label">acceptance mode</span><div className="select-wrap"><select className="select"><option>verified only</option><option>open</option></select><ChevronDown aria-hidden="true" /></div></div>
                <label className="check" style={{ marginBottom: 'var(--sp-4)' }}><input type="checkbox" className="check-box" defaultChecked /> require redaction review</label>
                <div className="btn-row"><button className="btn btn-primary"><Users aria-hidden="true" /> create the collective</button><button className="btn btn-secondary">cancel</button></div>
              </div>
            </div>
            <div>
              <div className="sidebar" style={{ marginBottom: 'var(--sp-4)' }}>
                <div className="sb-sec"><div className="sb-head">order</div>
                  <div className="sb-opt on"><span>most recent</span> <Check className="lucide" aria-hidden="true" /></div><div className="sb-opt"><span>most turns</span></div><div className="sb-opt"><span>most tokens</span></div></div>
                <div className="sb-sec"><div className="sb-head">provider</div>
                  <div className="sb-opt"><span><span className="g-claude"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-claude" /></svg></span> claude-code</span></div>
                  <div className="sb-opt on"><span><span className="g-gemini"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-gemini" /></svg></span> gemini-cli</span> <Check className="lucide" aria-hidden="true" /></div></div>
              </div>
              <div className="empty">
                <div className="ring"><Compass aria-hidden="true" /></div>
                <h3>the commons is quiet</h3>
                <p>no transcripts match these filters yet. broaden the search or be the first to contribute.</p>
                <button className="btn btn-secondary btn-sm"><Upload aria-hidden="true" /> publish a transcript</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="callout"><ShieldCheck aria-hidden="true" /><div>labels sit above their fields with a visible focus ring. required state reads from the label and its icon, never color alone, and every action stays reversible.</div></div>
    </section>
  )
}
