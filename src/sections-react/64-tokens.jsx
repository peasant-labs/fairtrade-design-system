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
  { c: '#0b0b0a', name: '--canvas', dark: '#0b0b0a', light: '#fbfaf7', role: 'page background', token: '--canvas' },
  { c: '#0b0b0a', name: '--surface', dark: '#0b0b0a', light: '#fbfaf7', role: 'panels and cards', token: '--surface' },
  { c: '#1c1b18', name: '--surface-2', dark: '#1c1b18', light: '#f1eee6', role: 'elevated, table head', token: '--surface-2' },
  { c: '#fbf8f1', name: '--ink-strong', dark: '#fbf8f1', light: '#0d0c09', role: 'headings, short emphasis', token: '--ink-strong' },
  { c: '#ece8df', name: '--ink', dark: '#ece8df', light: '#1f1c17', role: 'primary body text', token: '--ink' },
  { c: '#cdc8bb', name: '--ink-2', dark: '#cdc8bb', light: '#3d3932', role: 'secondary text', token: '--ink-2' },
  { c: '#b3ad9f', name: '--ink-3', dark: '#b3ad9f', light: '#4f4a41', role: 'tertiary, labels', token: '--ink-3' },
  { c: '#a19b8e', name: '--ink-4', dark: '#a19b8e', light: '#625c51', role: 'faint text: meta, counts, line numbers (>=4.5:1)', token: '--ink-4' },
  { c: '#615b50', name: '--ink-5', dark: '#615b50', light: '#837d72', role: 'decoration only: bullets, separators, faint glyphs', token: '--ink-5' },
  { c: '#4f4a40', name: '--rule', dark: '#4f4a40', light: '#b3ab96', role: 'structural divider, clears 2:1', token: '--rule' },
  { c: '#857f72', name: '--rule-strong', dark: '#857f72', light: '#7f7762', role: 'panel edge, control and input border, clears 4:1', token: '--rule-strong' },
  { c: '#d6ae66', name: '--amber', dark: '#d6ae66', light: '#8a5f1f', role: 'accent, focus, links, keywords', token: '--amber' },
  { c: '#ebc98c', name: '--amber-bright', dark: '#ebc98c', light: '#6e4c16', role: 'hover, highlight', token: '--amber-bright' },
  { c: '#937a45', name: '--amber-dim', dark: '#937a45', light: '#b09a63', role: 'focus border, marker', token: '--amber-dim' },
  { c: '#8fb6ac', name: '--teal', dark: '#8fb6ac', light: '#3a675e', role: 'user role, info', token: '--teal' },
  { c: '#a9b688', name: '--olive', dark: '#a9b688', light: '#586a3c', role: 'success, diff add', token: '--olive' },
  { c: '#d08f74', name: '--clay', dark: '#d08f74', light: '#974b32', role: 'danger, diff del', token: '--clay' },
  { c: '#ab9ec0', name: '--mauve', dark: '#ab9ec0', light: '#594e72', role: 'system, subagent', token: '--mauve' },
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
              <tr><td className="dt-name">--ease-out</td><td className="dt-val" style={{ width: '1%', whiteSpace: 'nowrap' }}>cubic-bezier(.23, 1, .32, 1) <CopyBtn token="--ease-out" style={{ marginLeft: 'var(--sp-2)' }} /></td><td className="dt-role">press and enter feedback, no overshoot</td></tr>
              <tr><td className="dt-name">--ease-in-out</td><td className="dt-val" style={{ width: '1%', whiteSpace: 'nowrap' }}>cubic-bezier(.77, 0, .175, 1) <CopyBtn token="--ease-in-out" style={{ marginLeft: 'var(--sp-2)' }} /></td><td className="dt-role">moving something already on screen</td></tr>
              <tr><td className="dt-name">--ease-spring</td><td className="dt-val" style={{ width: '1%', whiteSpace: 'nowrap' }}>cubic-bezier(.16, 1, .3, 1) <CopyBtn token="--ease-spring" style={{ marginLeft: 'var(--sp-2)' }} /></td><td className="dt-role">entrance easing without overshoot</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="callout" style={{ marginTop: 'var(--sp-5)' }}><ShieldCheck aria-hidden="true" /><div>token names are stable across both apps. only values and fonts change; rename nothing, fork nothing.</div></div>
    </section>
  )
}
