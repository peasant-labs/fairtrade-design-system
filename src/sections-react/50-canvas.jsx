import { Box, Folder, File, Plus, Minus, Maximize, Users, X, Eye, BoxSelect } from 'lucide-react'

/* 50-canvas: the map/graph surface + a live modal dialog. the trigger button keeps the
   literal data-open-dialog attribute so App.jsx's delegation opens the React <Dialog>
   and returns focus here. svg edges, nodes, controls, minimap, timestrip and the static
   dialog preview are converted verbatim. icons move from <i data-lucide> to lucide-react. */
export function CanvasSection() {
  return (
    <section className="band" id="canvas">
      <h2 className="label">canvas &amp; dialog</h2>
      <div className="sub">the map/graph surface and a modal window</div>
      <p className="prose">the canvas is the map of a repository or a collective: square nodes on a dot grid, wired by edges, with zoom controls, a minimap, and an activity strip kept on screen. the dialog is the one modal we use for a consequential, reversible choice.</p>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="cols cols-2">
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>graph canvas</span>
              <div className="canvas framed">
                <svg className="edges" width="100%" height="100%" viewBox="0 0 560 340" preserveAspectRatio="none">
                  <path d="M120 70 V150 H80 V196" fill="none" stroke="var(--rule-strong)" strokeWidth="1"/>
                  <path d="M120 70 V150 H250 V196" fill="none" stroke="var(--rule-strong)" strokeWidth="1"/>
                  <path d="M250 226 V270 H190" fill="none" stroke="var(--rule-strong)" strokeWidth="1"/>
                  <path d="M250 226 V270 H330" fill="none" stroke="var(--amber-dim)" strokeWidth="1.2" strokeDasharray="4 3"/>
                  <path d="M380 90 V150 H420 V196" fill="none" stroke="var(--rule-strong)" strokeWidth="1"/>
                </svg>
                <div className="node sel" style={{ top: '44px', left: '78px' }}><div className="nm"><Box aria-hidden="true" /> peasant</div><div className="ct">42 files</div><div className="eff" style={{ background: 'var(--amber)' }}></div></div>
                <div className="node hot" style={{ top: '172px', left: '36px' }}><div className="nm"><Folder aria-hidden="true" /> ingest</div><div className="ct">11 files</div><div className="eff"></div></div>
                <div className="node" style={{ top: '172px', left: '206px' }}><div className="nm"><Folder aria-hidden="true" /> store</div><div className="ct">8 files</div><div className="eff" style={{ height: '2px' }}></div></div>
                <div className="node" style={{ top: '248px', left: '146px' }}><div className="nm"><File aria-hidden="true" /> pipeline.go</div></div>
                <div className="node" style={{ top: '248px', left: '296px' }}><div className="nm"><File aria-hidden="true" /> stream.go</div></div>
                <div className="node" style={{ top: '172px', left: '372px' }}><div className="nm"><Folder aria-hidden="true" /> api</div><div className="ct">14 files</div><div className="eff" style={{ height: '2px' }}></div></div>
                <div className="canvas-ctrls"><button aria-label="zoom in"><Plus aria-hidden="true" /></button><button aria-label="zoom out"><Minus aria-hidden="true" /></button><button aria-label="fit to view"><Maximize aria-hidden="true" /></button></div>
                <div className="minimap"><i style={{ left: '8px', top: '8px', width: '18px', height: '10px' }}></i><i style={{ left: '14px', top: '34px', width: '30px', height: '8px' }}></i><i style={{ left: '60px', top: '24px', width: '22px', height: '8px' }}></i></div>
              </div>
              <div className="timestrip">
                <div className="bar" style={{ height: '30%' }}></div><div className="bar" style={{ height: '55%' }}></div><div className="bar" style={{ height: '20%' }}></div><div className="bar" style={{ height: '80%' }}></div><div className="bar" style={{ height: '65%' }}></div><div className="bar" style={{ height: '100%' }}></div><div className="bar" style={{ height: '45%' }}></div><div className="bar" style={{ height: '70%' }}></div><div className="bar" style={{ height: '35%' }}></div><div className="bar" style={{ height: '90%' }}></div><div className="bar" style={{ height: '25%' }}></div><div className="bar" style={{ height: '60%' }}></div>
              </div>
              <div className="note">structure edges are solid; activity edges are dashed. the selected node carries an amber border and a marker.</div>
            </div>
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>modal dialog (live)</span>
              <div className="btn-row" style={{ marginBottom: 'var(--sp-3)' }}><button className="btn btn-primary" data-open-dialog aria-haspopup="dialog"><Users aria-hidden="true" /> join collective</button></div>
              <div className="note" style={{ marginTop: 0, marginBottom: 'var(--sp-4)' }}>opens a real modal: focus stays trapped inside, esc and the scrim close it, and focus returns to this button.</div>
              <div className="dlg-demo">
                <div className="scrim"></div>
                <div className="dialog framed" role="dialog" aria-label="join collective, static preview">
                  <div className="dlg-head"><h3>join collective</h3><span className="btn btn-ghost btn-sm btn-icon" aria-hidden="true"><X aria-hidden="true" /></span></div>
                  <div className="dlg-body">
                    <div className="callout"><Eye aria-hidden="true" /><div>joining <b style={{ color: 'var(--ink-strong)' }}>desert-archivists</b> reveals your profile to its members. your shared transcripts stay redacted.</div></div>
                    <label className="check"><input type="checkbox" className="check-box" /> i understand and consent</label>
                  </div>
                  <div className="dlg-foot"><span className="btn btn-secondary btn-sm">cancel</span><span className="btn btn-primary btn-sm"><Users aria-hidden="true" /> reveal &amp; join</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="callout"><BoxSelect aria-hidden="true" /><div>selection is an amber border plus a marker, not color alone. canvas controls stay on screen and keep a target of at least 24px.</div></div>
    </section>
  )
}
