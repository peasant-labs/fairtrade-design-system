import { Trash2, Plus, Upload, Settings, Search, ChevronDown, Check, X, ShieldCheck } from 'lucide-react'
import { CopyBtn, Swatch } from './_tokens.jsx'

/* 34-controls: the button/input family section. live specimen rows, an anatomy specimen + legend,
   variants/states, a do/don't pair, then two .dtable blocks and an a11y callout.
   both tables are HAND-ROLLED rather than via TokenTable because each has per-row variation the
   single-column flags can't express:
     - specs table: the `border` row's value is a plain dt-val (no tnum) while its siblings are tnum.
     - tokens table: the `--rule-strong` row's value is a plain dt-val (no tnum) AND only the
       --amber / --on-amber / --rule-strong rows lead with a swatch, so neither tnum nor swatch is
       a whole-column property.
   every className, id, data-* attr, inline style and text (entities verbatim) mirrors the partial;
   inputs with value= and not readonly use defaultValue, the checked checkbox uses defaultChecked,
   and every copy button keeps data-copy for App.jsx's rootClick delegation. no new CSS. */
export function ControlsSection() {
  return (
    <section className="band" id="controls">
      <h2 className="label">controls</h2>
      <div className="sub">buttons and inputs share one height; one primary action per view</div>

      <p className="prose">buttons and inputs are the same component family: they sit on one shared height (36px, 28px when small) with identical padding, so a row of mixed controls keeps a single baseline. reach for a primary button for the one action a view is built around, secondary or ghost for everything else, and danger only when the action removes or destroys data.</p>

      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="cols cols-2">
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>default (36px)</span>
              <div className="btn-row" style={{ marginBottom: 'var(--sp-6)' }}>
                <button className="btn btn-primary">publish transcript</button>
                <button className="btn btn-secondary">save draft</button>
                <button className="btn btn-ghost">cancel</button>
                <button className="btn btn-danger"><Trash2 aria-hidden="true" /> delete</button>
                <button className="btn btn-secondary btn-icon" aria-label="add collective"><Plus aria-hidden="true" /></button>
              </div>
              <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>small (28px)</span>
              <div className="btn-row">
                <button className="btn btn-primary btn-sm"><Upload aria-hidden="true" /> contribute</button>
                <button className="btn btn-secondary btn-sm">share</button>
                <button className="btn btn-ghost btn-sm">dismiss</button>
                <button className="btn btn-secondary btn-sm btn-icon" aria-label="settings"><Settings aria-hidden="true" /></button>
              </div>
            </div>
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>inputs (36px)</span>
              <div className="field input-ico"><Search aria-hidden="true" /><input className="input" placeholder="search the commons" /></div>
              <div className="field"><div className="select-wrap"><select className="select"><option>acceptance: open</option><option>verified only</option></select><ChevronDown aria-hidden="true" /></div></div>
              <label className="check"><input type="checkbox" className="check-box" defaultChecked /> require redaction review</label>
            </div>
          </div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>anatomy</h3>
      <div className="anatomy">
        <div className="specimen">
          <div className="specimen-bar"><span className="specimen-cap">parts</span></div>
          <div className="specimen-body">
            <div className="btn-row">
              <button className="btn btn-primary"><Upload aria-hidden="true" /> contribute</button>
              <div className="field input-ico" style={{ marginBottom: 0, flex: 1, minInlineSize: 0, maxInlineSize: '240px' }}><Search aria-hidden="true" /><input className="input" placeholder="search the commons" /></div>
            </div>
          </div>
        </div>
        <div className="anatomy-legend">
          <span className="anatomy-item"><span className="anatomy-num tnum">1</span> lucide icon, 14-16px, leads the label</span>
          <span className="anatomy-item"><span className="anatomy-num tnum">2</span> label, lowercase mono, verb plus object</span>
          <span className="anatomy-item"><span className="anatomy-num tnum">3</span> box, 36px high, padding 0 16px</span>
          <span className="anatomy-item"><span className="anatomy-num tnum">4</span> hairline border, var(--bd-strong)</span>
          <span className="anatomy-item"><span className="anatomy-num tnum">5</span> focus ring, 3px amber on :focus-visible</span>
          <span className="anatomy-item"><span className="anatomy-num tnum">6</span> input shares the same 36px box</span>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>variants and states</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">states</span></div>
        <div className="specimen-body">
          <div className="cols cols-2">
            <div>
              <div className="btn-row" style={{ marginBottom: 'var(--sp-3)' }}>
                <button className="btn btn-primary">primary</button>
                <button className="btn btn-secondary">secondary</button>
                <button className="btn btn-ghost">ghost</button>
                <button className="btn btn-danger"><Trash2 aria-hidden="true" /> danger</button>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary" style={{ opacity: .5, pointerEvents: 'none' }} aria-disabled="true">disabled</button>
                <button className="btn btn-secondary" style={{ borderColor: 'var(--amber-dim)', color: 'var(--amber-bright)' }}>focus</button>
              </div>
            </div>
            <div>
              <div className="field input-ico" style={{ marginBottom: 'var(--sp-3)' }}><Search aria-hidden="true" /><input className="input" placeholder="default input" /></div>
              <div className="field input-ico" style={{ marginBottom: 0 }}><Search aria-hidden="true" /><input className="input" style={{ borderColor: 'var(--amber-dim)' }} defaultValue="desert-archivists" /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="cmp">
        <div className="cmp-card cmp-do">
          <div className="cmp-tag"><Check aria-hidden="true" /> do</div>
          <div className="cmp-body">
            <div className="btn-row">
              <button className="btn btn-primary btn-sm"><Upload aria-hidden="true" /> contribute</button>
              <button className="btn btn-secondary btn-sm">share</button>
              <button className="btn btn-danger btn-sm"><Trash2 aria-hidden="true" /> delete</button>
            </div>
          </div>
          <div className="cmp-note">pair a destructive action with an icon and a label; keep a row to 5 actions or fewer.</div>
        </div>
        <div className="cmp-card cmp-dont">
          <div className="cmp-tag"><X aria-hidden="true" /> don't</div>
          <div className="cmp-body">
            <div className="btn-row">
              <button className="btn btn-secondary btn-sm">share</button>
              <button className="btn btn-secondary btn-sm">export</button>
              <button className="btn btn-secondary btn-sm">pin</button>
              <button className="btn btn-secondary btn-sm">archive</button>
              <button className="btn btn-secondary btn-sm">flag</button>
              <button className="btn btn-secondary btn-sm" style={{ color: 'var(--clay)' }}>delete</button>
            </div>
          </div>
          <div className="cmp-note">a row past 5 buttons, or a danger button carried by color alone with no icon or label.</div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>specs</h3>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>property</th><th>value</th><th>note</th></tr></thead>
          <tbody>
            <tr><td className="dt-name">height</td><td className="dt-val tnum">36px</td><td className="dt-role">shared with inputs and select</td></tr>
            <tr><td className="dt-name">height (small)</td><td className="dt-val tnum">28px</td><td className="dt-role">dense rows, toolbars</td></tr>
            <tr><td className="dt-name">padding</td><td className="dt-val tnum">0 16px</td><td className="dt-role">0 12px on small</td></tr>
            <tr><td className="dt-name">radius</td><td className="dt-val tnum">0</td><td className="dt-role">square everywhere</td></tr>
            <tr><td className="dt-name">border</td><td className="dt-val">var(--bd-strong)</td><td className="dt-role">secondary, danger, inputs</td></tr>
            <tr><td className="dt-name">min target</td><td className="dt-val tnum">44px</td><td className="dt-role">primary action</td></tr>
            <tr><td className="dt-name">icon</td><td className="dt-val tnum">14-16px</td><td className="dt-role">box stays full height</td></tr>
          </tbody>
        </table>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>tokens</h3>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>token</th><th>value</th><th>role</th><th></th></tr></thead>
          <tbody>
            <tr><td className="dt-name">--control-h</td><td className="dt-val tnum">36px</td><td className="dt-role">button and input height</td><td><CopyBtn token="--control-h" /></td></tr>
            <tr><td className="dt-name">--control-h-sm</td><td className="dt-val tnum">28px</td><td className="dt-role">small variant height</td><td><CopyBtn token="--control-h-sm" /></td></tr>
            <tr><td><Swatch c="#cba35c" /><span className="dt-name">--amber</span></td><td className="dt-val tnum">#cba35c</td><td className="dt-role">primary fill, focus ring</td><td><CopyBtn token="--amber" /></td></tr>
            <tr><td><Swatch c="#141003" /><span className="dt-name">--on-amber</span></td><td className="dt-val tnum">#141003</td><td className="dt-role">label on primary fill</td><td><CopyBtn token="--on-amber" /></td></tr>
            <tr><td><Swatch c="#6f6a5f" /><span className="dt-name">--rule-strong</span></td><td className="dt-val">var(--bd-strong)</td><td className="dt-role">control border, clears 3:1</td><td><CopyBtn token="--rule-strong" /></td></tr>
          </tbody>
        </table>
      </div>

      <div className="callout" style={{ marginTop: 'var(--sp-5)' }}>
        <ShieldCheck aria-hidden="true" />
        <div>every control keeps a hit box of at least 24px even when the glyph is 14-16px; focus is a visible 3px amber ring, never removed. danger always carries an icon and a label, never color alone. lowercase labels are chrome; the real button text stays a descriptive verb plus object (publish transcript, not ok).</div>
      </div>
    </section>
  )
}
