import { ShieldCheck } from 'lucide-react'

/* 26-type: typography. two .face cards, the .type-scale rows (each .ts-sample keeps its
   inline font-size:var(--fs-*)), a font-families .dtable (no copy), and a callout. only
   icon was <i shield-check>. */
export function TypographySection() {
  return (
    <section className="band" id="typography">
      <h2 className="label">typography</h2>
      <div className="sub">two faces from the atkinson hyperlegible superfamily, one system</div>
      <p className="prose">one type split does all the work. the monospaced face carries every piece of chrome, code and display: headings, nav, labels, chips, buttons, breadcrumbs and code blocks, holding the terminal grid. the proportional sibling is used only for reading prose, where comfort beats the column. the same scale and tokens drive both.</p>

      <div className="type-faces">
        <div className="face">
          <div className="face-aa mono">Aa</div>
          <div className="face-meta">
            <h3>atkinson hyperlegible mono</h3>
            <div className="face-role">display, ui chrome &amp; code</div>
            <p>the monospaced voice of the system: every heading, label, button, badge, breadcrumb and code block. it carries the terminal and ascii identity.</p>
            <div className="face-glyphs mono">abcdefghijklmnopqrstuvwxyz 0123456789 &amp; * + = / ( ) [ ] {'{'} {'}'} # @ _ : ;</div>
          </div>
        </div>
        <div className="face">
          <div className="face-aa">Aa</div>
          <div className="face-meta">
            <h3>atkinson hyperlegible</h3>
            <div className="face-role">reading prose</div>
            <p>the proportional sibling, used only for long-form body text in transcripts and docs, where reading comfort beats the mono grid.</p>
            <div className="face-glyphs">abcdefghijklmnopqrstuvwxyz 0123456789 &amp; ? ! ( ) : ; ,</div>
          </div>
        </div>
      </div>

      <div className="type-scale">
        <div className="ts-row"><div className="ts-sample mono" style={{ fontSize: 'var(--fs-display)' }}>foundations</div><div className="ts-meta"><span className="ts-name">chapter</span><span className="ts-px tnum">52px</span><span className="ts-use">group openers</span></div></div>
        <div className="ts-row"><div className="ts-sample mono" style={{ fontSize: 'var(--fs-hero)' }}>kept low to the ground</div><div className="ts-meta"><span className="ts-name">display</span><span className="ts-px tnum">40px</span><span className="ts-use">hero headline</span></div></div>
        <div className="ts-row"><div className="ts-sample mono" style={{ fontSize: 'var(--fs-xl)' }}>a commons for transcripts</div><div className="ts-meta"><span className="ts-name">title</span><span className="ts-px tnum">28px</span><span className="ts-use">group &amp; section titles</span></div></div>
        <div className="ts-row"><div className="ts-sample mono" style={{ fontSize: 'var(--fs-lg)' }}>refactor ingest pipeline</div><div className="ts-meta"><span className="ts-name">heading</span><span className="ts-px tnum">22px</span><span className="ts-use">card &amp; dialog headings</span></div></div>
        <div className="ts-row"><div className="ts-sample mono" style={{ fontSize: 'var(--fs-md)' }}>a shared shelf, redacted</div><div className="ts-meta"><span className="ts-name">subhead</span><span className="ts-px tnum">18px</span><span className="ts-use">sub-headings, lead-ins</span></div></div>
        <div className="ts-row"><div className="ts-sample" style={{ fontSize: 'var(--fs-body)' }}>ingest your sessions locally, redact them, and share what is worth sharing.</div><div className="ts-meta"><span className="ts-name">body</span><span className="ts-px tnum">16px</span><span className="ts-use">paragraph prose</span></div></div>
        <div className="ts-row"><div className="ts-sample mono" style={{ fontSize: 'var(--fs-label)' }}>orientation lives here</div><div className="ts-meta"><span className="ts-name">label</span><span className="ts-px tnum">14px</span><span className="ts-use">labels, chrome, captions</span></div></div>
      </div>

      <h3 className="label">font families</h3>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead>
            <tr><th>token</th><th>face</th><th>role</th></tr>
          </thead>
          <tbody>
            <tr><td className="dt-name">--font-display</td><td className="dt-val">atkinson hyperlegible mono</td><td className="dt-role">group openers, section titles, hero</td></tr>
            <tr><td className="dt-name">--font-mono</td><td className="dt-val">atkinson hyperlegible mono</td><td className="dt-role">labels, chips, buttons, code, tabular data</td></tr>
            <tr><td className="dt-name">--font-body</td><td className="dt-val">atkinson hyperlegible</td><td className="dt-role">reading prose only</td></tr>
          </tbody>
        </table>
      </div>

      <div className="callout">
        <ShieldCheck aria-hidden="true" />
        <div>reading text never drops below 16px, with 1.5 line-height on prose. proportional prose gets 0.03em tracking; mono and tabular numbers keep letter-spacing 0 so columns stay aligned.</div>
      </div>
    </section>
  )
}
