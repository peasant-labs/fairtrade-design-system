import { ChevronRight, Check, ChevronLeft, Route } from 'lucide-react'
import Tabs from '../ui/Tabs.jsx'

/* 44-trails: breadcrumb + step wizard + tabs + pager specimen. the tabs+tabpanels
   are the <Tabs> src/ui component (it self-manages selection, so App.jsx's tablist
   useEffect is now dead). breadcrumb/steps/pager stay faithful plain JSX with
   lucide-react icons. */
export function TrailsSection() {
  return (
    <section className="band" id="trails">
      <h2 className="label">trails &amp; tabs</h2>
      <div className="sub">orientation lives here</div>
      <p className="prose">a breadcrumb names the path back, a step wizard marks progress through a flow, tabs split a view and count what is inside each, and a pager walks a long set. together they answer where am i and how do i move.</p>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="cols" style={{ gap: 'var(--sp-5)' }}>
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>breadcrumb</span>
              <div className="crumb">village <ChevronRight aria-hidden="true" /> vitor-hw <ChevronRight aria-hidden="true" /> <span className="cur">refactor ingest pipeline</span></div>
            </div>
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>step wizard</span>
              <div className="steps">
                <span className="step done"><span className="num"><Check aria-hidden="true" /></span> choose</span><span className="step-line"></span>
                <span className="step done"><span className="num"><Check aria-hidden="true" /></span> labels</span><span className="step-line"></span>
                <span className="step cur"><span className="num">3</span> redact</span><span className="step-line"></span>
                <span className="step"><span className="num">4</span> submit</span>
              </div>
            </div>
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>tabs + count</span>
              <Tabs
                aria-label="transcript views"
                tabs={[
                  { id: 'trace', label: 'trace', count: 214, content: '214 events: tool calls, thinking, and messages in order.' },
                  { id: 'hl', label: 'highlights', count: 7, content: '7 starred turns worth returning to.' },
                  { id: 'diffs', label: 'diffs', count: 12, content: '12 files changed across the session.' },
                  { id: 'files', label: 'files', count: 9, content: '9 files touched, 3 added.' },
                ]}
              />
            </div>
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>pager</span>
              <div className="pager"><button className="btn btn-secondary btn-sm btn-icon" aria-label="previous page"><ChevronLeft aria-hidden="true" /></button><span>page <span className="tnum">2</span> / <span className="tnum">9</span></span><button className="btn btn-secondary btn-sm btn-icon" aria-label="next page"><ChevronRight aria-hidden="true" /></button></div>
            </div>
          </div>
        </div>
      </div>
      <div className="callout"><Route aria-hidden="true" /><div>the active tab is marked by an underline and its count, so color is never the only signal. step state reads from its icon or number, and the current crumb is bold ink rather than a faint tint.</div></div>
    </section>
  )
}
