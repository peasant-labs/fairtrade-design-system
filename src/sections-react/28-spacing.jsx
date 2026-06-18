import { ShieldCheck } from 'lucide-react'
import { CopyBtn } from './_tokens.jsx'

/* 28-spacing: the 4/8 ruler specimen + the layout-token .dtable (trailing copy) + a11y callout.
   the table is hand-rolled rather than via TokenTable so the `radius` row can copy '0' while
   keeping the partial's byte-exact aria-label="copy radius" (TokenTable's trailing CopyBtn only
   passes token, which would emit aria-label="copy 0"). every className, inline width on the
   ruler bars, and the callout's margin-top are verbatim from the partial. */
export function SpacingSection() {
  const rulers = [
    { k: '--sp-1', v: '4', w: '4px' },
    { k: '--sp-2', v: '8', w: '8px' },
    { k: '--sp-3', v: '12', w: '12px' },
    { k: '--sp-4', v: '16', w: '16px' },
    { k: '--sp-5', v: '24', w: '24px' },
    { k: '--sp-6', v: '32', w: '32px' },
    { k: '--sp-7', v: '40', w: '40px' },
    { k: '--sp-8', v: '56', w: '56px' },
  ]
  const rows = [
    { name: '--sp-1', value: '4px', role: 'hairline gap, icon-to-label', token: '--sp-1' },
    { name: '--sp-2', value: '8px', role: 'tight stack, chip padding', token: '--sp-2' },
    { name: '--sp-3', value: '12px', role: 'control padding, row gap', token: '--sp-3' },
    { name: '--sp-4', value: '16px', role: 'card padding, default gap', token: '--sp-4' },
    { name: '--sp-5', value: '24px', role: 'block padding, group gap', token: '--sp-5' },
    { name: '--sp-6', value: '32px', role: 'section gutter, column gap', token: '--sp-6' },
    { name: '--sp-7', value: '40px', role: 'subheading lead, wide gap', token: '--sp-7' },
    { name: '--sp-8', value: '56px', role: 'band rhythm, page breaks', token: '--sp-8' },
    { name: '--maxw', value: '1040px', role: 'centered content measure', token: '--maxw' },
    { name: '--gutter', value: '32px', role: 'left / right page inset (= --sp-6)', token: '--gutter' },
    { name: '--control-h', value: '36px', role: 'button and input height', token: '--control-h' },
    { name: '--control-h-sm', value: '28px', role: 'compact button and nav control', token: '--control-h-sm' },
    { name: '--nav-h', value: '56px', role: 'sticky nav height, scroll offset', token: '--nav-h' },
    { name: '--row-h-standard', value: '40px', role: 'default table row (compact 32 / comfortable 48)', token: '--row-h-standard' },
    { name: 'radius', value: '0', role: 'square, every corner, no exceptions', token: '0', aria: 'copy radius' },
  ]
  return (
    <section className="band" id="spacing">
      <h2 className="label">spacing &amp; layout</h2>
      <div className="sub">one 4 / 8 scale; every padding, margin and gap sits on the grid</div>
      <p className="prose">eight steps, doubling early then widening, cover every gap on the page. a builder never picks a raw pixel value; they reach for the nearest <span className="mono">--sp-*</span> token, so two screens built months apart still share one rhythm.</p>
      <div className="ruler">
        {rulers.map((r) => (
          <div className="ruler-row" key={r.k}>
            <span className="ruler-k">{r.k}</span>
            <span className="ruler-v tnum">{r.v}</span>
            <span className="ruler-bar" style={{ width: r.w }}></span>
          </div>
        ))}
      </div>

      <h3 className="label">layout tokens</h3>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>token</th><th>value</th><th>role</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="dt-name">{r.name}</td>
                <td className="dt-val tnum">{r.value}</td>
                <td className="dt-role">{r.role}</td>
                <td>{r.aria ? <CopyBtn token={r.token} aria-label={r.aria} /> : <CopyBtn token={r.token} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="callout" style={{ marginTop: 'var(--sp-5)' }}><ShieldCheck aria-hidden="true" /><div>every padding, margin and gap sits on the scale. radius is 0 everywhere; corners stay square and editorial.</div></div>
    </section>
  )
}
