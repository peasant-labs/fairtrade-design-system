import { Search, GitBranch, ShieldCheck, FileText, Terminal, Users, Clock, Eye, SquarePen, Trash2, ChevronRight, Hash, SquareTerminal } from 'lucide-react'

/* 30-icons: iconography. an .icongrid of .icontile cells (lucide via lucide-react),
   provider marks (brand <use> svgs + a codex lucide fallback), a sizing dtable and a
   callout. <i data-lucide> -> lucide-react (same .lucide class, CSS-sized). */
export function IconsSection() {
  return (
    <section className="band" id="icons">
      <h2 className="label">iconography</h2>
      <div className="sub">vector only; one family, consistent stroke and size</div>
      <p className="prose" style={{ maxInlineSize: '60ch' }}>icons lead data so a dense screen stays scannable. lucide carries every ui, tool, status and nav glyph at one stroke weight in three sizes; provider brand marks are the real logos; their tint never carries meaning by itself. nothing on screen is hand-drawn ascii.</p>

      <div className="icongrid">
        <span className="icontile"><Search aria-hidden="true" /> search</span>
        <span className="icontile"><GitBranch aria-hidden="true" /> git-branch</span>
        <span className="icontile"><ShieldCheck aria-hidden="true" /> shield-check</span>
        <span className="icontile"><FileText aria-hidden="true" /> file-text</span>
        <span className="icontile"><Terminal aria-hidden="true" /> terminal</span>
        <span className="icontile"><Users aria-hidden="true" /> users</span>
        <span className="icontile"><Clock aria-hidden="true" /> clock</span>
        <span className="icontile"><Eye aria-hidden="true" /> eye</span>
        <span className="icontile"><SquarePen aria-hidden="true" /> square-pen</span>
        <span className="icontile"><Trash2 aria-hidden="true" /> trash-2</span>
        <span className="icontile"><ChevronRight aria-hidden="true" /> chevron-right</span>
        <span className="icontile"><Hash aria-hidden="true" /> hash</span>
      </div>

      <div style={{ marginTop: 'var(--sp-6)' }}>
        <span className="specimen-cap" style={{ display: 'block' }}>provider marks</span>
        <div className="icongrid" style={{ marginTop: 'var(--sp-3)' }}>
          <span className="icontile"><span className="g-claude"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-claude" /></svg></span> claude-code</span>
          <span className="icontile"><span className="g-gemini"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-gemini" /></svg></span> gemini-cli</span>
          <span className="icontile"><span className="g-opencode"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-opencode" /></svg></span> opencode</span>
          <span className="icontile"><span className="g-cursor"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-cursor" /></svg></span> cursor</span>
          <span className="icontile"><span className="g-codex"><SquareTerminal aria-hidden="true" /></span> codex</span>
        </div>
      </div>

      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>token</th><th>value</th><th>role</th></tr></thead>
          <tbody>
            <tr><td className="dt-name">--ic-sm</td><td className="dt-val tnum">14px</td><td className="dt-role">inline icons in chips, meta, tool calls</td></tr>
            <tr><td className="dt-name">--ic-md</td><td className="dt-val tnum">16px</td><td className="dt-role">default ui, buttons, icon tiles</td></tr>
            <tr><td className="dt-name">--ic-lg</td><td className="dt-val tnum">18px</td><td className="dt-role">principle tiles, empty-state rings</td></tr>
          </tbody>
        </table>
      </div>

      <div className="callout"><ShieldCheck aria-hidden="true" /><div>vector only, one lucide family, no hand-drawn ascii. every inline svg carries a viewBox plus width and height. codex has no official mark, so it falls back to a lucide glyph.</div></div>
    </section>
  )
}
