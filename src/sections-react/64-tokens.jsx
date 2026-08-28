import { ShieldCheck } from 'lucide-react'
import { TokenTable, Swatch, CopyBtn } from './_tokens.jsx'

/* 64-tokens: the canonical token reference — the largest copy-token cluster. five
   sub-tables (spacing / type / color / control & layout / motion), each a byte-faithful
   .dtable. the copy affordance is INLINE inside the value cell (data-copy preserved per row)
   so App.jsx's [data-copy] delegation copies the token + toasts; nothing here is themed.
   spacing/type/control&layout/motion go through the shared TokenTable (value column
   copyInline:true). the color table's copy sits in the DARK column only (light has none) and
   the motion table has one non-tnum row (cubic-bezier), so those two render explicitly. */

const spacingRows = [
  { name: '--sp-1', value: '4px', role: 'hairline gap', token: '--sp-1' },
  { name: '--sp-2', value: '8px', role: 'tight stack', token: '--sp-2' },
  { name: '--sp-3', value: '12px', role: 'control padding', token: '--sp-3' },
  { name: '--sp-4', value: '16px', role: 'card padding, default gap', token: '--sp-4' },
  { name: '--sp-5', value: '24px', role: 'block padding', token: '--sp-5' },
  { name: '--sp-6', value: '32px', role: 'section gutter', token: '--sp-6' },
  { name: '--sp-7', value: '40px', role: 'wide gap, subheading lead', token: '--sp-7' },
  { name: '--sp-8', value: '56px', role: 'band rhythm', token: '--sp-8' },
]

const typeRows = [
  { name: '--fs-label', value: '14px', role: 'chrome labels, chips, nav', token: '--fs-label' },
  { name: '--fs-sm', value: '14px', role: 'secondary text, table cells', token: '--fs-sm' },
  { name: '--fs-body', value: '16px', role: 'reading text floor', token: '--fs-body' },
  { name: '--fs-md', value: '18px', role: 'card and dialog titles', token: '--fs-md' },
  { name: '--fs-lg', value: '22px', role: 'window title', token: '--fs-lg' },
  { name: '--fs-xl', value: '28px', role: 'subsection heading', token: '--fs-xl' },
  { name: '--fs-hero', value: '40px', role: 'section band title', token: '--fs-hero' },
  { name: '--fs-display', value: '52px', role: 'group opener, splash', token: '--fs-display' },
  { name: '--lh-body', value: '1.5', role: 'prose line-height', token: '--lh-body' },
  { name: '--lh-mono', value: '1.4', role: 'code and transcript lines', token: '--lh-mono' },
]

const colorRows = [
  { c: '#070706', name: '--canvas', dark: '#070706', light: '#fbfaf7', role: 'page background', token: '--canvas' },
  { c: '#0e0e0c', name: '--surface', dark: '#0e0e0c', light: '#fdfcfa', role: 'panels and cards', token: '--surface' },
  { c: '#141413', name: '--surface-2', dark: '#141413', light: '#f4f2ec', role: 'elevated, table head', token: '--surface-2' },
  { c: '#f8f5ed', name: '--ink-strong', dark: '#f8f5ed', light: '#0d0c09', role: 'headings, short emphasis', token: '--ink-strong' },
  { c: '#e9e5db', name: '--ink', dark: '#e9e5db', light: '#27241f', role: 'primary body text', token: '--ink' },
  { c: '#b8b3a4', name: '--ink-2', dark: '#b8b3a4', light: '#4a463e', role: 'secondary text', token: '--ink-2' },
  { c: '#9a9488', name: '--ink-3', dark: '#9a9488', light: '#5c574d', role: 'tertiary, labels', token: '--ink-3' },
  { c: '#8a8478', name: '--ink-4', dark: '#8a8478', light: '#6f695e', role: 'faint text: meta, counts, line numbers (>=4.5:1)', token: '--ink-4' },
  { c: '#534e45', name: '--ink-5', dark: '#534e45', light: '#837d72', role: 'decoration only: bullets, separators, faint glyphs', token: '--ink-5' },
  { c: '#3c382f', name: '--rule', dark: '#3c382f', light: '#c4bca8', role: 'subtle structural divider', token: '--rule' },
  { c: '#6f6a5f', name: '--rule-strong', dark: '#6f6a5f', light: '#8b836d', role: 'control / input border, clears 3:1', token: '--rule-strong' },
  { c: '#cba35c', name: '--amber', dark: '#cba35c', light: '#8a5f1f', role: 'accent, focus, links, keywords', token: '--amber' },
  { c: '#e6c483', name: '--amber-bright', dark: '#e6c483', light: '#6e4c16', role: 'hover, highlight', token: '--amber-bright' },
  { c: '#937a45', name: '--amber-dim', dark: '#937a45', light: '#b09a63', role: 'focus border, marker', token: '--amber-dim' },
  { c: '#7ea69d', name: '--teal', dark: '#7ea69d', light: '#3a675e', role: 'user role, info', token: '--teal' },
  { c: '#9aa779', name: '--olive', dark: '#9aa779', light: '#586a3c', role: 'success, diff add', token: '--olive' },
  { c: '#c07f64', name: '--clay', dark: '#c07f64', light: '#974b32', role: 'danger, diff del', token: '--clay' },
  { c: '#9a8cae', name: '--mauve', dark: '#9a8cae', light: '#594e72', role: 'system, subagent', token: '--mauve' },
]

const controlRows = [
  { name: '--control-h', value: '36px', role: 'button and input height', token: '--control-h' },
  { name: '--control-h-sm', value: '28px', role: 'compact control, nav', token: '--control-h-sm' },
  { name: '--nav-h', value: '56px', role: 'sticky nav, scroll offset', token: '--nav-h' },
  { name: '--maxw', value: '1040px', role: 'centered content measure', token: '--maxw' },
  { name: '--gutter', value: '32px', role: 'page inset (= --sp-6)', token: '--gutter' },
  { name: '--target-min', value: '24px', role: 'minimum hit target', token: '--target-min' },
  { name: '--target-comfortable', value: '44px', role: 'primary hit target', token: '--target-comfortable' },
]

const valColumns = [
  { key: 'name', header: 'token', className: 'dt-name' },
  { key: 'value', header: 'value', className: 'dt-val', tnum: true, style: { width: '1%', whiteSpace: 'nowrap' }, copyInline: true },
  { key: 'role', header: 'role', className: 'dt-role' },
]

export function TokensSection() {
  return (
    <section className="band" id="tokens">
      <h2 className="label">tokens</h2>
      <div className="sub">the canonical reference; one layer is the source of truth</div>
      <p className="prose">one token layer drives peasant and village. the <span className="mono">names</span> are preserved across both apps, so only the values and fonts change between them and a component reflavors in place without a rewrite.</p>

      <div style={{ marginTop: 'var(--sp-7)' }}>
        <span className="label">spacing</span>
        <TokenTable columns={valColumns} rows={spacingRows} />
      </div>

      <div style={{ marginTop: 'var(--sp-7)' }}>
        <span className="label">type</span>
        <TokenTable columns={valColumns} rows={typeRows} />
      </div>

      <div style={{ marginTop: 'var(--sp-7)' }}>
        <span className="label">color</span>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr><th>token</th><th>dark</th><th>light</th><th>role</th></tr></thead>
            <tbody>
              {colorRows.map((r) => (
                <tr key={r.token}>
                  <td><Swatch c={r.c} /><span className="dt-name">{r.name}</span></td>
                  <td className="dt-val tnum" style={{ width: '1%', whiteSpace: 'nowrap' }}>{r.dark} <CopyBtn token={r.token} style={{ marginLeft: 'var(--sp-2)' }} /></td>
                  <td className="dt-val tnum" style={{ width: '1%', whiteSpace: 'nowrap' }}>{r.light}</td>
                  <td className="dt-role">{r.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 'var(--sp-7)' }}>
        <span className="label">control &amp; layout</span>
        <TokenTable columns={valColumns} rows={controlRows} />
      </div>

      <div style={{ marginTop: 'var(--sp-7)' }}>
        <span className="label">motion</span>
        <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr><th>token</th><th>value</th><th>role</th></tr></thead>
            <tbody>
              <tr><td className="dt-name">--motion-base</td><td className="dt-val tnum" style={{ width: '1%', whiteSpace: 'nowrap' }}>0ms <CopyBtn token="--motion-base" style={{ marginLeft: 'var(--sp-2)' }} /></td><td className="dt-role">static-first default</td></tr>
              <tr><td className="dt-name">--dur-1 / --dur-2 / --dur-3</td><td className="dt-val tnum" style={{ width: '1%', whiteSpace: 'nowrap' }}>120 / 160 / 200ms <CopyBtn token="--dur-2" style={{ marginLeft: 'var(--sp-2)' }} /></td><td className="dt-role">interaction transitions (no-preference only)</td></tr>
              <tr><td className="dt-name">--dur-entrance</td><td className="dt-val tnum" style={{ width: '1%', whiteSpace: 'nowrap' }}>900ms <CopyBtn token="--dur-entrance" style={{ marginLeft: 'var(--sp-2)' }} /></td><td className="dt-role">one-time hero + reveal; off under reduced-motion</td></tr>
              <tr><td className="dt-name">--ease-out / --ease-spring</td><td className="dt-val" style={{ width: '1%', whiteSpace: 'nowrap' }}>cubic-bezier <CopyBtn token="--ease-out" style={{ marginLeft: 'var(--sp-2)' }} /></td><td className="dt-role">entrance easing curves</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="callout" style={{ marginTop: 'var(--sp-5)' }}><ShieldCheck aria-hidden="true" /><div>token names are stable across both apps. only values and fonts change; rename nothing, fork nothing.</div></div>
    </section>
  )
}
