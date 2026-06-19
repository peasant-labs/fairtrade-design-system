import { useRef, useState } from 'react'
import { Bell, BellOff, ExternalLink, Pencil, Download, Link, Archive, Eye, Users, Lock, ShieldCheck, TriangleAlert, ChevronDown, Info, Circle, CircleCheck, Loader, LoaderCircle, X, CircleX, CircleAlert, SearchX } from 'lucide-react'

/* 36-states: button / input / switch / feedback-surface state specimens + dtables + callouts.
   faithful port of src/sections/36-states.html. <i data-lucide> -> lucide-react (CSS-sized,
   aria-hidden). inputs with value= become defaultValue= unless readonly (then readOnly value=);
   checked radio -> defaultChecked. swatches: none here. no DOM wiring. */

/* interactive segmented control: single-select, roving focus + arrow keys.
   reuses the global .bs-seg / aria-pressed active state (no global css change). */
const SEG_OPTS = [
  { id: 'public', label: 'public', Icon: Eye },
  { id: 'collective', label: 'collective', Icon: Users },
  { id: 'private', label: 'private', Icon: Lock },
]
function VisibilitySeg() {
  const [active, setActive] = useState('public')
  const refs = useRef([])
  function onKeyDown(e, i) {
    let next = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % SEG_OPTS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + SEG_OPTS.length) % SEG_OPTS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = SEG_OPTS.length - 1
    else return
    e.preventDefault()
    setActive(SEG_OPTS[next].id)
    refs.current[next]?.focus()
  }
  return (
    <div className="bs-seg" role="group" aria-label="visibility">
      {SEG_OPTS.map(({ id, label, Icon }, i) => (
        <button
          key={id}
          ref={(el) => { refs.current[i] = el }}
          className="bs-seg-opt"
          aria-pressed={active === id}
          tabIndex={active === id ? 0 : -1}
          onClick={() => setActive(id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        ><Icon aria-hidden="true" /> {label}</button>
      ))}
    </div>
  )
}

export function StatesSection() {
  return (
    <section className="band" id="states">
      <h2 className="label">states</h2>
      <div className="sub">every control ships its full set: disabled, loading, error, selected</div>
      <p className="prose">state is shown, never implied. each control family carries a real disabled, busy and error state, and the loading, error and empty surfaces exist by default instead of being bolted on later. state never rides on color alone; it pairs an icon, a label or a shape.</p>
      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>button states</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>interactive states</span>
          <div className="bs-grid" style={{ marginBottom: 'var(--sp-6)' }}>
            <div className="bs-cell">
              <button className="btn btn-primary">publish transcript</button>
              <span className="bs-cap">default</span>
            </div>
            <div className="bs-cell">
              <button className="btn btn-primary" disabled>publish transcript</button>
              <span className="bs-cap">disabled (native attr)</span>
            </div>
            <div className="bs-cell">
              <button className="btn btn-primary" aria-busy="true" aria-label="publishing transcript" disabled><span className="bs-spin" aria-hidden="true"></span> publishing</button>
              <span className="bs-cap">loading (aria-busy)</span>
            </div>
          </div>

          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>toggle button (aria-pressed)</span>
          <div className="bs-grid" style={{ marginBottom: 'var(--sp-6)' }}>
            <div className="bs-cell">
              <button className="btn btn-secondary bs-toggle" aria-pressed="true"><Bell aria-hidden="true" /> notify on reply</button>
              <span className="bs-cap">on</span>
            </div>
            <div className="bs-cell">
              <button className="btn btn-secondary bs-toggle" aria-pressed="false"><BellOff aria-hidden="true" /> notify on reply</button>
              <span className="bs-cap">off</span>
            </div>
          </div>

          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>link-button + icon-button sizes</span>
          <div className="bs-grid">
            <div className="bs-cell">
              <a className="btn btn-secondary" href="https://github.com/peasant-labs/fairtrade-design-system" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /> open repository</a>
              <span className="bs-cap">link-button (real anchor)</span>
            </div>
            <div className="bs-cell">
              <button className="btn btn-secondary btn-icon" aria-label="edit transcript"><Pencil aria-hidden="true" /></button>
              <span className="bs-cap">icon, 36px</span>
            </div>
            <div className="bs-cell">
              <button className="btn btn-secondary btn-sm btn-icon" aria-label="edit transcript"><Pencil aria-hidden="true" /></button>
              <span className="bs-cap">icon, 28px</span>
            </div>
          </div>
        </div>
      </div>

      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">groups</span></div>
        <div className="specimen-body">
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>button-group (one action set, shared seams)</span>
          <div className="bs-group" role="group" aria-label="transcript actions" style={{ marginBottom: 'var(--sp-6)' }}>
            <button className="btn btn-secondary"><Download aria-hidden="true" /> export</button>
            <button className="btn btn-secondary"><Link aria-hidden="true" /> copy link</button>
            <button className="btn btn-secondary"><Archive aria-hidden="true" /> archive</button>
          </div>

          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>segmented control (aria-pressed marks the choice)</span>
          <VisibilitySeg />
        </div>
      </div>

      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>state</th><th>signal</th><th>cue beyond color</th></tr></thead>
          <tbody>
            <tr><td className="dt-name">disabled</td><td className="dt-val">:disabled (native attr)</td><td className="dt-role">no pointer events, dimmed, not focusable</td></tr>
            <tr><td className="dt-name">loading</td><td className="dt-val">aria-busy="true"</td><td className="dt-role">spinner glyph plus label, animates only under no-preference</td></tr>
            <tr><td className="dt-name">toggle</td><td className="dt-val">aria-pressed</td><td className="dt-role">bell / bell-off icon swap plus fill</td></tr>
            <tr><td className="dt-name">link-button</td><td className="dt-val"><a href=""></a></td><td className="dt-role">real navigation, external-link icon</td></tr>
            <tr><td className="dt-name">segmented</td><td className="dt-val">aria-pressed per option</td><td className="dt-role">icon per option plus amber fill on the selected one</td></tr>
          </tbody>
        </table>
      </div>

      <div className="callout" style={{ marginTop: 'var(--sp-5)' }}>
        <ShieldCheck aria-hidden="true" />
        <div>every state is real, not faked: disabled is the native attribute (focus skips it, pointer events stop), loading sets aria-busy and the spinner stays still under prefers-reduced-motion, and both the toggle and segmented control announce aria-pressed so the choice is never color alone. icon-buttons carry an aria-label and keep a 24px hit box at every size.</div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>input states</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="cols cols-2">
            <div>
              <div className="is-field">
                <span className="label">collective name</span>
                <input className="input is-input" defaultValue="desert-archivists" aria-describedby="is-hint-name" />
                <span className="is-hint" id="is-hint-name">lowercase, hyphens between words</span>
              </div>

              <div className="is-field">
                <span className="label">slug</span>
                <input className="input is-input" aria-invalid="true" defaultValue="Desert Archivists" aria-describedby="is-err-slug" />
                <span className="is-error" id="is-err-slug"><TriangleAlert aria-hidden="true" /> spaces and capitals are not allowed in a slug</span>
              </div>

              <div className="is-field">
                <span className="label">acceptance policy</span>
                <div className="select-wrap"><select className="select"><option>open: anyone may contribute</option><option>verified members only</option><option>invite only</option></select><ChevronDown aria-hidden="true" /></div>
                <span className="is-hint">controls who can publish a transcript here</span>
              </div>
            </div>

            <div>
              <div className="is-field">
                <span className="label"><span className="is-lk"><Lock aria-hidden="true" /> commons id</span></span>
                <input className="input is-input" value="cmns-4f19-archivists" readOnly aria-describedby="is-hint-id" />
                <span className="is-hint" id="is-hint-id">assigned on creation, cannot be edited</span>
              </div>

              <div className="is-field">
                <span className="label">stewards</span>
                <input className="input is-input" defaultValue="steward@desert-archivists.example" disabled aria-describedby="is-hint-disabled" />
                <span className="is-hint" id="is-hint-disabled">locked until your membership is verified</span>
              </div>

              <div className="is-field">
                <span className="label">charter</span>
                <textarea className="input is-input" rows="3" aria-describedby="is-hint-charter" placeholder="describe what this collective preserves"></textarea>
                <span className="is-hint" id="is-hint-charter">shown on the public collective page</span>
              </div>
            </div>
          </div>

          <fieldset className="is-field" style={{ border: 0, padding: 0, margin: 'var(--sp-5) 0 0' }}>
            <legend className="label" style={{ marginBottom: 'var(--sp-3)', padding: 0 }}>redaction review</legend>
            <div className="is-radios" role="radiogroup" aria-label="redaction review">
              <label className="is-radio"><input type="radio" name="is-redaction" className="is-radio-dot" defaultChecked /> review every transcript before it publishes</label>
              <label className="is-radio"><input type="radio" name="is-redaction" className="is-radio-dot" /> review only transcripts flagged by a member</label>
              <label className="is-radio"><input type="radio" name="is-redaction" className="is-radio-dot" /> publish without review</label>
              <label className="is-radio"><input type="radio" name="is-redaction" className="is-radio-dot" disabled /> auto-redact with model (needs verification)</label>
            </div>
          </fieldset>
        </div>
      </div>

      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>state</th><th>markup</th><th>cue</th></tr></thead>
          <tbody>
            <tr><td className="dt-name">default</td><td className="dt-val">value, no extra attrs</td><td className="dt-role">var(--rule-strong) border</td></tr>
            <tr><td className="dt-name">focus</td><td className="dt-val">:focus</td><td className="dt-role">border lifts to amber-dim</td></tr>
            <tr><td className="dt-name">error</td><td className="dt-val">aria-invalid="true"</td><td className="dt-role">clay border, icon + message, aria-describedby</td></tr>
            <tr><td className="dt-name">read-only</td><td className="dt-val">readonly</td><td className="dt-role">surface-2 fill, lock label, ink-2 text</td></tr>
            <tr><td className="dt-name">disabled</td><td className="dt-val">disabled</td><td className="dt-role">native dim, not editable, hint explains why</td></tr>
            <tr><td className="dt-name">radio group</td><td className="dt-val">type=radio name= + role=radiogroup</td><td className="dt-role">one choice, disabled option stays labelled</td></tr>
          </tbody>
        </table>
      </div>

      <div className="callout" style={{ marginTop: 'var(--sp-5)' }}>
        <Info aria-hidden="true" />
        <div>every field carries its label above the control and a hint or error below, wired with aria-describedby. error is never the red border alone: it pairs a triangle-alert icon with a plain-language message. read-only and disabled use the real readonly and disabled attributes, not an opacity hack, so keyboard and screen-reader behaviour is correct. radios are real inputs sharing one name, so only one is selectable.</div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>switch</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="sw-group" style={{ maxWidth: '340px' }}>
            <div className="sw-field">
              <button type="button" className="sw" role="switch" aria-checked="false" id="sw-redact"></button>
              <label className="sw-label" htmlFor="sw-redact">redaction review</label>
              <span className="sw-state"><Circle aria-hidden="true" /> off</span>
            </div>
            <div className="sw-field">
              <button type="button" className="sw" role="switch" aria-checked="true" id="sw-public"></button>
              <label className="sw-label" htmlFor="sw-public">public transcript</label>
              <span className="sw-state"><CircleCheck aria-hidden="true" /> on</span>
            </div>
            <div className="sw-field">
              <button type="button" className="sw" role="switch" aria-checked="false" disabled id="sw-lock-off"></button>
              <label className="sw-label" htmlFor="sw-lock-off">verified only</label>
              <span className="sw-state"><Lock aria-hidden="true" /> off, locked</span>
            </div>
            <div className="sw-field">
              <button type="button" className="sw" role="switch" aria-checked="true" disabled id="sw-lock-on"></button>
              <label className="sw-label" htmlFor="sw-lock-on">audit logging</label>
              <span className="sw-state"><Lock aria-hidden="true" /> on, locked</span>
            </div>
            <div className="sw-field">
              <button type="button" className="sw" role="switch" aria-checked="false" aria-busy="true" id="sw-sync"></button>
              <label className="sw-label" htmlFor="sw-sync">sync to commons</label>
              <span className="sw-state" aria-live="polite"><Loader className="sw-busy-spin" aria-hidden="true" /> saving</span>
            </div>
          </div>
        </div>
      </div>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>state</th><th>attribute</th><th>note</th></tr></thead>
          <tbody>
            <tr><td className="dt-name">off</td><td className="dt-val">aria-checked="false"</td><td className="dt-role">neutral track, thumb left</td></tr>
            <tr><td className="dt-name">on</td><td className="dt-val">aria-checked="true"</td><td className="dt-role">amber fill, thumb right</td></tr>
            <tr><td className="dt-name">disabled</td><td className="dt-val">disabled</td><td className="dt-role">real attribute, not opacity alone</td></tr>
            <tr><td className="dt-name">busy</td><td className="dt-val">aria-busy="true"</td><td className="dt-role">saving, paired with aria-live</td></tr>
            <tr><td className="dt-name">focus</td><td className="dt-val">:focus-visible</td><td className="dt-role">3px amber ring, never removed</td></tr>
          </tbody>
        </table>
      </div>
      <div className="callout" style={{ marginTop: 'var(--sp-5)' }}>
        <ShieldCheck aria-hidden="true" />
        <div>each switch is a real role="switch" button with aria-checked, so screen readers announce on and off; the thumb slides at most 160ms and only under prefers-reduced-motion no-preference. state never rides on the amber fill alone, an icon plus a lowercase on or off marker sits beside every label, and the hit box stays at least 24px tall.</div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>feedback surfaces</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="fb-grid" style={{ marginBottom: 'var(--sp-5)' }}>
            <div className="fb-cell">
              <span className="fb-cap">skeleton placeholder</span>
              <div className="fb-skel" role="status" aria-busy="true" aria-label="Loading transcript">
                <div className="fb-skel-row">
                  <span className="fb-skel-block fb-skel-av" aria-hidden="true"></span>
                  <span className="fb-skel-lines">
                    <span className="fb-skel-line w-40"></span>
                    <span className="fb-skel-line w-70"></span>
                  </span>
                </div>
                <span className="fb-skel-line w-90"></span>
                <span className="fb-skel-line w-70"></span>
              </div>
            </div>
            <div className="fb-cell">
              <span className="fb-cap">determinate progress</span>
              <div className="fb-prog">
                <div className="fb-prog-head"><span>uploading transcript</span><span className="fb-prog-pct tnum">62%</span></div>
                <div className="fb-prog-track" role="progressbar" aria-valuenow="62" aria-valuemin="0" aria-valuemax="100" aria-label="upload progress">
                  <div className="fb-prog-fill" style={{ width: '62%' }}></div>
                </div>
              </div>
              <div style={{ marginTop: 'var(--sp-5)' }}>
                <span className="fb-cap">inline spinner</span>
                <span className="fb-spin" role="status" aria-busy="true" aria-live="polite"><LoaderCircle aria-hidden="true" /> verifying redactions</span>
              </div>
            </div>
          </div>
          <span className="fb-cap">toast notification</span>
          <div aria-live="polite" aria-atomic="true" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
            <div className="fb-toast is-ok" role="status">
              <span className="fb-toast-ico"><CircleCheck aria-hidden="true" /></span>
              <div className="fb-toast-body">
                <div className="fb-toast-title">transcript published</div>
                <div className="fb-toast-msg">desert-archivists is now public. 18 turns, 42,318 tokens.</div>
              </div>
              <button className="fb-toast-x" type="button" aria-label="dismiss notification"><X aria-hidden="true" /></button>
            </div>
            <div className="fb-toast is-err" role="alert">
              <span className="fb-toast-ico"><CircleX aria-hidden="true" /></span>
              <div className="fb-toast-body">
                <div className="fb-toast-title">upload failed</div>
                <div className="fb-toast-msg">The connection dropped at 62%. Retry to resume from the last checkpoint.</div>
              </div>
              <button className="fb-toast-x" type="button" aria-label="dismiss notification"><X aria-hidden="true" /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">inline panels</span></div>
        <div className="specimen-body">
          <div className="fb-panels">
            <div className="fb-panel" role="status" aria-busy="true" aria-live="polite">
              <span className="fb-panel-ico"><LoaderCircle aria-hidden="true" /></span>
              <div className="fb-panel-title">loading</div>
              <p className="fb-panel-msg">Fetching transcripts from the commons.</p>
            </div>
            <div className="fb-panel is-err" role="alert">
              <span className="fb-panel-ico"><CircleAlert aria-hidden="true" /></span>
              <div className="fb-panel-title">error</div>
              <p className="fb-panel-msg">We could not reach the archive. Check your connection and try again.</p>
            </div>
            <div className="fb-panel">
              <span className="fb-panel-ico"><SearchX aria-hidden="true" /></span>
              <div className="fb-panel-title">no results</div>
              <p className="fb-panel-msg">No transcripts match desert-archivists. Try a broader search.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>surface</th><th>state hook</th><th>icon and note</th></tr></thead>
          <tbody>
            <tr><td className="dt-name">skeleton</td><td className="dt-val">aria-busy="true"</td><td className="dt-role">no icon; static blocks, shimmer only under no-preference</td></tr>
            <tr><td className="dt-name">progress</td><td className="dt-val">aria-valuenow</td><td className="dt-role">no icon; determinate, tabular percent</td></tr>
            <tr><td className="dt-name">spinner</td><td className="dt-val">aria-busy + aria-live</td><td className="dt-role">loader-circle; spins only under no-preference</td></tr>
            <tr><td className="dt-name">toast (ok)</td><td className="dt-val">role="status"</td><td className="dt-role">circle-check; inside an aria-live="polite" region</td></tr>
            <tr><td className="dt-name">toast (error)</td><td className="dt-val">role="alert"</td><td className="dt-role">circle-x; assertive, icon plus label, not color</td></tr>
            <tr><td className="dt-name">panel loading</td><td className="dt-val">aria-busy="true"</td><td className="dt-role">loader-circle; role="status"</td></tr>
            <tr><td className="dt-name">panel error</td><td className="dt-val">role="alert"</td><td className="dt-role">circle-alert; clay icon plus label</td></tr>
            <tr><td className="dt-name">panel empty</td><td className="dt-val">resolved</td><td className="dt-role">search-x; no-results, neutral</td></tr>
          </tbody>
        </table>
      </div>

      <div className="callout" style={{ marginTop: 'var(--sp-5)' }}>
        <ShieldCheck aria-hidden="true" />
        <div>every state pairs an icon with a label, never color alone: error carries circle-alert, success circle-check, empty search-x. busy surfaces announce through a live region (status for polite, alert for errors). motion is opt-in: the skeleton shimmer and both spinners stay static unless the visitor allows motion. counts and the progress percent are tabular.</div>
      </div>
    </section>
  )
}
