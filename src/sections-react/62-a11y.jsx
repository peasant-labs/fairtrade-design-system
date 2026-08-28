import { Check, ShieldCheck, X } from 'lucide-react'

/* 62-a11y: accessibility & neuroinclusive. a rules dtable + a do/don't cmp pair +
   a11y callout. icons (<i data-lucide>) -> lucide-react (CSS .lucide sizes them).
   the &#8805; (>=) glyphs and the literal inline styles are preserved verbatim. */
export function A11ySection() {
  return (
    <section className="band" id="a11y">
      <h2 className="label">accessibility &amp; neuroinclusive</h2>
      <div className="sub">readability ships in the tokens</div>
      <p className="prose">the product is data-heavy and our users include people who are dyslexic, have ADHD, or are autistic. designing for them by default makes every screen calmer to scan and less tiring to read, which is faster for everyone. so the rules below ship in the tokens and govern every component, with no toggle to find.</p>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead>
            <tr><th>rule</th><th>value</th><th>why</th></tr>
          </thead>
          <tbody>
            <tr>
              <td className="dt-name">text floor</td>
              <td className="dt-val tnum">16px</td>
              <td className="dt-role">below the critical font size reading rate collapses; gain density from row height, not smaller glyphs</td>
            </tr>
            <tr>
              <td className="dt-name">line-height</td>
              <td className="dt-val tnum">1.5</td>
              <td className="dt-role">prose leading; tight leading is for single-line headings only, never wrapping body copy</td>
            </tr>
            <tr>
              <td className="dt-name">prose measure</td>
              <td className="dt-val tnum">66ch</td>
              <td className="dt-role">caps line length so the return sweep lands on the right next line; tables and code are never capped</td>
            </tr>
            <tr>
              <td className="dt-name">functional borders</td>
              <td className="dt-val tnum">&#8805; 3:1</td>
              <td className="dt-role">in dense tables the structure is the information; gridlines and outlines must clear non-text contrast</td>
            </tr>
            <tr>
              <td className="dt-name">focus ring</td>
              <td className="dt-val">3px amber / near-black</td>
              <td className="dt-role">a global focus-visible ring on every control; never a bare outline:none</td>
            </tr>
            <tr>
              <td className="dt-name">hit target</td>
              <td className="dt-val tnum">&#8805; 24px (&#8805; 44 primary)</td>
              <td className="dt-role">the box is at least 24px even when the glyph stays at 14 to 16px</td>
            </tr>
            <tr>
              <td className="dt-name">numbers</td>
              <td className="dt-val">tabular</td>
              <td className="dt-role">counts, durations, and token values share a column width so they scan and compare</td>
            </tr>
            <tr>
              <td className="dt-name">motion</td>
              <td className="dt-val">static-first</td>
              <td className="dt-role">reduced-motion is the base; transitions are added only under no-preference and stay under 200ms</td>
            </tr>
            <tr>
              <td className="dt-name">meaning</td>
              <td className="dt-val">never color-only</td>
              <td className="dt-role">every status, diff, and required field pairs an icon or a label with its color</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="cmp">
        <div className="cmp-card cmp-do">
          <div className="cmp-tag"><Check aria-hidden="true" /> do</div>
          <div className="cmp-body">
            <p>warm-paper light and off-white on near-black, left-aligned with a ragged right edge.</p>
            <span className="chip chip-ok"><ShieldCheck aria-hidden="true" /> redacted</span>
          </div>
          <div className="cmp-note">a predictable left edge to return to; tuned ink that does not halo</div>
        </div>
        <div className="cmp-card cmp-dont">
          <div className="cmp-tag"><X aria-hidden="true" /> don't</div>
          <div className="cmp-body">
            <p style={{ textAlign: 'justify' }}>pure #fff on #000, justified into even blocks, with status carried by color alone.</p>
            <span className="chip" style={{ color: 'var(--clay)' }}>redacted</span>
          </div>
          <div className="cmp-note">halation and justified rivers disrupt tracking; color-only fails 1.4.1</div>
        </div>
      </div>
      <div className="callout" style={{ marginTop: 'var(--sp-6)' }}><ShieldCheck aria-hidden="true" /><div>these defaults live in the token layer and flow to peasant and village through one shared set of rules.</div></div>
    </section>
  )
}
