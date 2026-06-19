import { Check, X, ShieldCheck, EyeOff, CircleX } from 'lucide-react'
import { TokenTable } from './_tokens.jsx'

/* 24-color: the palette section. a .swatches grid (literal-hex --c per .swatch) then the
   token .dtable expressed via the shared TokenTable (token-swatch / dark / light / role +
   trailing copy). the cmp "do" carries a .chips row; the cmp "don't" keeps its literal
   inline-style amber panel verbatim (the anti-pattern being demonstrated). */
export function ColorSection() {
  return (
    <section className="band" id="color">
      <h2 className="label">color</h2>
      <div className="sub">desaturated earth, theme-aware, meaning never carried by hue alone</div>
      <p className="prose">a small palette built from a near-black canvas, a warm ink ramp, two border weights, and one scarce amber accent. teal, olive, clay and mauve are supporting tints for roles (user, add, del, system) and never stand in for an icon or a label. every token re-themes between dark and light; the table lists both the dark and light value of every token.</p>

      <div className="swatches">
        <div className="swatch" style={{ '--c': '#070706' }}><div className="swc"></div><div className="nm">canvas</div></div>
        <div className="swatch" style={{ '--c': '#0e0e0c' }}><div className="swc"></div><div className="nm">surface</div></div>
        <div className="swatch" style={{ '--c': '#e9e5db' }}><div className="swc"></div><div className="nm">ink</div></div>
        <div className="swatch" style={{ '--c': '#cba35c' }}><div className="swc"></div><div className="nm">amber</div></div>
        <div className="swatch" style={{ '--c': '#7ea69d' }}><div className="swc"></div><div className="nm">teal</div></div>
        <div className="swatch" style={{ '--c': '#9aa779' }}><div className="swc"></div><div className="nm">olive</div></div>
        <div className="swatch" style={{ '--c': '#c07f64' }}><div className="swc"></div><div className="nm">clay</div></div>
        <div className="swatch" style={{ '--c': '#9a8cae' }}><div className="swc"></div><div className="nm">mauve</div></div>
        <div className="swatch" style={{ '--c': '#b8b3a4' }}><div className="swc"></div><div className="nm">ink-2</div></div>
        <div className="swatch" style={{ '--c': '#9a9488' }}><div className="swc"></div><div className="nm">ink-3</div></div>
        <div className="swatch" style={{ '--c': '#3c382f' }}><div className="swc"></div><div className="nm">rule</div></div>
        <div className="swatch" style={{ '--c': '#e6c483' }}><div className="swc"></div><div className="nm">amber-bright</div></div>
      </div>

      <TokenTable
        copy="trailing"
        columns={[
          { key: 'name', header: 'token', swatch: true },
          { key: 'dark', header: 'dark', className: 'dt-val', tnum: true },
          { key: 'light', header: 'light', className: 'dt-val', tnum: true },
          { key: 'role', header: 'role', className: 'dt-role' },
        ]}
        rows={[
          { name: '--canvas', c: '#070706', dark: '#070706', light: '#fbfaf7', role: 'page background', token: '--canvas' },
          { name: '--surface', c: '#0e0e0c', dark: '#0e0e0c', light: '#fdfcfa', role: 'panels, cards, windows', token: '--surface' },
          { name: '--surface-2', c: '#141413', dark: '#141413', light: '#f4f2ec', role: 'elevated bars, headers, swatch chips', token: '--surface-2' },

          { name: '--ink-strong', c: '#f8f5ed', dark: '#f8f5ed', light: '#0d0c09', role: 'headings, short emphasis', token: '--ink-strong' },
          { name: '--ink', c: '#e9e5db', dark: '#e9e5db', light: '#27241f', role: 'primary body text', token: '--ink' },
          { name: '--ink-2', c: '#b8b3a4', dark: '#b8b3a4', light: '#4a463e', role: 'secondary text, metadata', token: '--ink-2' },
          { name: '--ink-3', c: '#9a9488', dark: '#9a9488', light: '#5c574d', role: 'tertiary, labels, captions', token: '--ink-3' },

          { name: '--rule', c: '#3c382f', dark: '#3c382f', light: '#c4bca8', role: 'subtle structural divider', token: '--rule' },
          { name: '--rule-strong', c: '#6f6a5f', dark: '#6f6a5f', light: '#8b836d', role: 'control / input border, clears 3:1', token: '--rule-strong' },

          { name: '--amber', c: '#cba35c', dark: '#cba35c', light: '#8a5f1f', role: 'accent, focus, links, keywords', token: '--amber' },
          { name: '--amber-bright', c: '#e6c483', dark: '#e6c483', light: '#6e4c16', role: 'hover, glow on bold', token: '--amber-bright' },
          { name: '--amber-dim', c: '#937a45', dark: '#937a45', light: '#b09a63', role: 'muted accent, the nav marker', token: '--amber-dim' },

          { name: '--teal', c: '#7ea69d', dark: '#7ea69d', light: '#3a675e', role: 'user role, info', token: '--teal' },
          { name: '--olive', c: '#9aa779', dark: '#9aa779', light: '#586a3c', role: 'success, diff add, the do tag', token: '--olive' },
          { name: '--clay', c: '#c07f64', dark: '#c07f64', light: '#974b32', role: 'danger, diff del, the don\'t tag', token: '--clay' },
          { name: '--mauve', c: '#9a8cae', dark: '#9a8cae', light: '#594e72', role: 'system, subagents', token: '--mauve' },
        ]}
      />

      <div className="cmp">
        <div className="cmp-card cmp-do">
          <div className="cmp-tag"><Check aria-hidden="true" /> do</div>
          <div className="cmp-body">
            <div className="chips">
              <span className="chip chip-ok"><ShieldCheck aria-hidden="true" /> redacted</span>
              <span className="chip chip-warn"><EyeOff aria-hidden="true" /> partial</span>
              <span className="chip chip-err"><CircleX aria-hidden="true" /> failed</span>
            </div>
          </div>
          <div className="cmp-note">amber stays scarce, as accent and focus. state color always pairs an icon and a label.</div>
        </div>
        <div className="cmp-card cmp-dont">
          <div className="cmp-tag"><X aria-hidden="true" /> don't</div>
          <div className="cmp-body">
            <div style={{ background: 'var(--amber)', color: 'var(--on-amber)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-label)', padding: 'var(--sp-3) var(--sp-4)' }}>redacted</div>
          </div>
          <div className="cmp-note">no big saturated amber panels, no color-only meaning. a status with no icon reads as decoration.</div>
        </div>
      </div>

      <div className="callout">
        <ShieldCheck aria-hidden="true" />
        <div>accents stay desaturated and earthy, and every text-on-surface pair clears AA in both themes. amber is reserved for small accents, focus, links, keywords and large or bold text, never small body text on the light theme.</div>
      </div>
    </section>
  )
}
