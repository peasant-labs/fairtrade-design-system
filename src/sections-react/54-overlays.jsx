import { useState } from 'react'
import {
  ShieldCheck,
  Share2,
  Link,
  Copy,
  FilePen,
  Trash2,
  Archive,
  Search,
  Upload,
  Lock,
  FolderOpen,
  Settings,
  SearchX,
  ArrowUp,
  GitBranch,
  Check,
  X,
} from 'lucide-react'
import Menu from '../ui/Menu.jsx'

/* 54-overlays: floating surfaces. the dropdown-menu live specimen is the <Menu> component
   (extended with caption + separator support); the tooltip/popover, both command-palette
   previews, and the avatar/kbd/tag specimen stay static-faithful JSX. <i data-lucide> ->
   lucide-react (same .lucide class, CSS-sized). this replaces the [data-menu-trigger]
   useEffect in App.jsx, so that effect is now dead. */
export function OverlaysSection() {
  const [popOpen, setPopOpen] = useState(false)
  return (
    <section className="band" id="overlays">
      <h2 className="label">overlays</h2>
      <div className="sub">floating surfaces: tooltip, menu, command palette</div>
      <p className="prose">overlays sit above the page on an elevated surface with a hairline edge and square corners. each one opens on demand, is dismissible, keeps focus in view, and is reachable from the keyboard.</p>
      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>tooltip and popover</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="tip-demo">
            <div>
              <span className="label">tooltip (role=tooltip)</span>
              <div className="tip-anchor">
                <button className="btn btn-secondary btn-icon" aria-label="redaction status" aria-describedby="tip-redact"><ShieldCheck aria-hidden="true" /></button>
                <span className="tip-bubble" role="tooltip" id="tip-redact">scrubbed of secrets before publish</span>
              </div>
              <span className="tip-hint mono">hover or focus the button</span>
            </div>
            <div>
              <span className="label">popover card</span>
              <div className="tip-anchor">
                <button className="btn btn-secondary btn-sm" aria-expanded={popOpen} aria-controls="pop-share" onClick={() => setPopOpen((o) => !o)}><Share2 aria-hidden="true" /> share</button>
                {popOpen && (
                  <div className="pop-card" role="dialog" aria-label="share transcript" id="pop-share">
                    <div className="pop-head"><Link aria-hidden="true" /><span className="pop-title">share transcript</span></div>
                    <div className="pop-body">
                      <p>Anyone with the link can read this transcript. Token counts and turns stay visible.</p>
                      <div className="field input-ico" style={{ marginBottom: 0 }}><Link aria-hidden="true" /><input className="input" value="https://commons.example/t/9f3c" readOnly aria-label="share link" /></div>
                    </div>
                    <div className="pop-foot">
                      <button className="btn btn-ghost btn-sm" onClick={() => setPopOpen(false)}>cancel</button>
                      <button className="btn btn-primary btn-sm"><Copy aria-hidden="true" /> copy link</button>
                    </div>
                  </div>
                )}
              </div>
              <span className="tip-hint mono">click share to open</span>
            </div>
          </div>
        </div>
      </div>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>part</th><th>role</th><th>note</th></tr></thead>
          <tbody>
            <tr><td className="dt-name">tooltip</td><td className="dt-val">role=tooltip</td><td className="dt-role">trigger points to it via aria-describedby</td></tr>
            <tr><td className="dt-name">popover</td><td className="dt-val">role=dialog</td><td className="dt-role">trigger sets aria-expanded + aria-controls</td></tr>
            <tr><td className="dt-name">surface</td><td className="dt-val">--surface-elev</td><td className="dt-role">floats above the page on a hairline</td></tr>
            <tr><td className="dt-name">radius</td><td className="dt-val tnum">0</td><td className="dt-role">square, css-positioned pointer nub</td></tr>
          </tbody>
        </table>
      </div>
      <div className="callout" style={{ marginTop: 'var(--sp-5)' }}>
        <ShieldCheck aria-hidden="true" />
        <div>a tooltip only supplements a control that already has a name: the icon button carries aria-label, and the bubble it describes is reached with aria-describedby, never as the sole label. the popover is a real role=dialog the trigger toggles with aria-expanded, so the open state is announced, not just drawn.</div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>dropdown menu</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="menu-demo">
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>menu button (live)</span>
              <Menu
                caption="desert-archivists / run 18"
                label={<><FilePen aria-hidden="true" /> transcript actions</>}
                items={[
                  { label: 'rename transcript', icon: FilePen, kbd: 'F2' },
                  { label: 'duplicate', icon: Copy, kbd: '⌘D' },
                  { label: 'copy share link', icon: Share2, kbd: '⌘L' },
                  { label: 'archive', icon: Archive, kbd: '⌘E', disabled: true },
                  { separator: true },
                  { label: 'delete transcript', icon: Trash2, kbd: '⌫', danger: true },
                ]}
              />
            </div>
            <div className="note" style={{ maxWidth: '32ch' }}>click the button (or press down) to open. arrow keys move between items, esc closes and returns focus to the button, and a click outside dismisses. the archive item is disabled and skipped; delete stays clay.</div>
          </div>
        </div>
      </div>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>state</th><th>signal</th><th>note</th></tr></thead>
          <tbody>
            <tr><td className="dt-name">closed</td><td className="dt-val">aria-expanded="false"</td><td className="dt-role">trigger only, caret points down</td></tr>
            <tr><td className="dt-name">open</td><td className="dt-val">aria-expanded="true"</td><td className="dt-role">popout role="menu", caret flips</td></tr>
            <tr><td className="dt-name">item</td><td className="dt-val">role="menuitem"</td><td className="dt-role">icon, label, right-aligned shortcut</td></tr>
            <tr><td className="dt-name">disabled item</td><td className="dt-val">aria-disabled="true"</td><td className="dt-role">archive, not focusable as active</td></tr>
            <tr><td className="dt-name">destructive</td><td className="dt-val">.menu-danger</td><td className="dt-role">clay, keeps trash icon and label</td></tr>
            <tr><td className="dt-name">separator</td><td className="dt-val">role="separator"</td><td className="dt-role">hairline before delete</td></tr>
          </tbody>
        </table>
      </div>
      <div className="callout" style={{ marginTop: 'var(--sp-5)' }}>
        <ShieldCheck aria-hidden="true" />
        <div>the trigger declares aria-haspopup="menu" and aria-expanded so a screen reader announces the popout; the open list is role="menu" with role="menuitem" rows that each clear a 24px hit box. the destructive row stays clay and keeps both a trash icon and a label, never color alone. shortcut hints sit right-aligned in muted ink so they never compete with the action verb.</div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>command palette</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="cp-demo">
            <div className="cp-scrim" aria-hidden="true"></div>
            <div className="cp-panel" role="dialog" aria-modal="true" aria-label="command palette">
              <div className="cp-search">
                <Search aria-hidden="true" />
                <input className="cp-input" type="text" role="combobox" aria-expanded="true" aria-controls="cp-list" aria-activedescendant="cp-opt-redact" aria-label="search commands" placeholder="search commands or jump to..." defaultValue="red" />
                <span className="kbd">esc</span>
              </div>
              <ul className="cp-results" id="cp-list" role="listbox" aria-label="commands">
                <li className="cp-group" id="cp-grp-actions" role="presentation">actions</li>
                <li className="cp-row" id="cp-opt-redact" role="option" aria-selected="true">
                  <span className="cp-mark" aria-hidden="true">&gt;</span>
                  <ShieldCheck aria-hidden="true" />
                  <span className="cp-label">Redact &amp; publish transcript</span>
                  <span className="cp-meta tnum">&#8984; &#8629;</span>
                </li>
                <li className="cp-row" role="option" aria-selected="false">
                  <span className="cp-mark" aria-hidden="true">&gt;</span>
                  <Upload aria-hidden="true" />
                  <span className="cp-label">Contribute to the commons</span>
                  <span className="cp-meta tnum">&#8984;U</span>
                </li>
                <li className="cp-row" role="option" aria-selected="false" aria-disabled="true">
                  <span className="cp-mark" aria-hidden="true">&gt;</span>
                  <Lock aria-hidden="true" />
                  <span className="cp-label">Delete transcript</span>
                  <span className="cp-meta">verify first</span>
                </li>
                <li className="cp-group" role="presentation">navigate</li>
                <li className="cp-row" role="option" aria-selected="false">
                  <span className="cp-mark" aria-hidden="true">&gt;</span>
                  <FolderOpen aria-hidden="true" />
                  <span className="cp-label">Go to redacted drafts</span>
                  <span className="cp-meta">page</span>
                </li>
                <li className="cp-row" role="option" aria-selected="false">
                  <span className="cp-mark" aria-hidden="true">&gt;</span>
                  <Settings aria-hidden="true" />
                  <span className="cp-label">Open redaction settings</span>
                  <span className="cp-meta">page</span>
                </li>
              </ul>
              <div className="cp-foot">
                <span className="cp-count tnum" role="status" aria-live="polite">4 results</span>
                <span className="cp-keys">
                  <span><span className="kbd">&#8593;</span><span className="kbd">&#8595;</span> move</span>
                  <span><span className="kbd">&#8629;</span> run</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">empty</span></div>
        <div className="specimen-body">
          <div className="cp-demo" style={{ minHeight: '240px' }}>
            <div className="cp-scrim" aria-hidden="true"></div>
            <div className="cp-panel" role="dialog" aria-modal="true" aria-label="command palette">
              <div className="cp-search">
                <Search aria-hidden="true" />
                <input className="cp-input" type="text" role="combobox" aria-expanded="true" aria-controls="cp-list-2" aria-label="search commands" placeholder="search commands or jump to..." defaultValue="ledger" />
                <span className="kbd">esc</span>
              </div>
              <ul className="cp-results" id="cp-list-2" role="listbox" aria-label="commands">
                <li className="cp-empty" role="presentation">
                  <SearchX aria-hidden="true" />
                  <span className="cp-empty-t">no commands match "ledger"</span>
                  <span className="cp-empty-d">try a verb, a page name, or a transcript id</span>
                </li>
              </ul>
              <div className="cp-foot">
                <span className="cp-count tnum" role="status" aria-live="polite">0 results</span>
                <span className="cp-keys"><span><span className="kbd">esc</span> close</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>state</th><th>signal</th><th>cue</th></tr></thead>
          <tbody>
            <tr><td className="dt-name">active row</td><td className="dt-val">aria-selected="true"</td><td className="dt-role">amber marker, inset rail, aria-activedescendant on input</td></tr>
            <tr><td className="dt-name">unavailable</td><td className="dt-val">aria-disabled="true"</td><td className="dt-role">dimmed, lock icon, "verify first" reason, not color alone</td></tr>
            <tr><td className="dt-name">result count</td><td className="dt-val">aria-live="polite"</td><td className="dt-role">announced on filter, tabular</td></tr>
            <tr><td className="dt-name">no matches</td><td className="dt-val">empty list</td><td className="dt-role">labelled reason plus a recovery hint</td></tr>
          </tbody>
        </table>
      </div>
      <div className="callout" style={{ marginTop: 'var(--sp-5)' }}>
        <ShieldCheck aria-hidden="true" />
        <div>the input is a combobox; aria-activedescendant points at the highlighted option so arrow keys move selection without moving dom focus. the active row is named by aria-selected and an amber marker (the one allowed "&gt;" use), never color alone. an unavailable command stays in the list with aria-disabled, a lock icon, and a plain-text reason. result counts live in a polite status region and read tabular. chrome stays lowercase; the real command labels keep their sentence case.</div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>avatar, kbd key, and tag</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div className="cols cols-2">
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>avatar sizes</span>
              <div className="akt-row" style={{ marginBottom: 'var(--sp-5)' }}>
                <span className="avatar av-sm" aria-label="Veil Tinker">VT</span>
                <span className="avatar av-md" aria-label="Mara Solenne">MS</span>
                <span className="avatar av-lg av-img" role="img" aria-label="Otho Quill"><img src="/avatars/otho.jpg" alt="" /><span aria-hidden="true">OQ</span></span>
              </div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>group + overflow</span>
              <div className="av-group" role="group" aria-label="9 contributors">
                <span className="avatar av-md" aria-label="Veil Tinker">VT</span>
                <span className="avatar av-md" aria-label="Mara Solenne">MS</span>
                <span className="avatar av-md" aria-label="Otho Quill">OQ</span>
                <span className="avatar av-md" aria-label="Liss Marrow">LM</span>
                <span className="avatar av-md av-more" aria-label="5 more contributors">+5</span>
              </div>
            </div>
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>kbd keys</span>
              <div className="akt-row" style={{ marginBottom: 'var(--sp-3)' }}>
                <kbd className="kbd-key">A</kbd>
                <kbd className="kbd-key">esc</kbd>
                <kbd className="kbd-key"><ArrowUp aria-hidden="true" /></kbd>
                <kbd className="kbd-key">enter</kbd>
              </div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>chord</span>
              <div className="akt-row" style={{ marginBottom: 'var(--sp-5)' }}>
                <span className="kbd-chord" aria-label="command k">
                  <kbd className="kbd-key">cmd</kbd><span className="kbd-plus" aria-hidden="true">+</span><kbd className="kbd-key">K</kbd>
                </span>
                <span className="kbd-chord" aria-label="control shift p">
                  <kbd className="kbd-key">ctrl</kbd><span className="kbd-plus" aria-hidden="true">+</span><kbd className="kbd-key">shift</kbd><span className="kbd-plus" aria-hidden="true">+</span><kbd className="kbd-key">P</kbd>
                </span>
              </div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>tag</span>
              <div className="akt-row">
                <span className="tag"><span className="tag-dot" style={{ '--tag-c': 'var(--teal)' }}></span> archive</span>
                <span className="tag"><GitBranch aria-hidden="true" /> v2-draft</span>
                <span className="tag tag-on"><Check aria-hidden="true" /> verified</span>
                <span className="tag">redaction<button type="button" className="tag-x" aria-label="remove redaction tag"><X aria-hidden="true" /></button></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>primitive</th><th>value</th><th>note</th></tr></thead>
          <tbody>
            <tr><td className="dt-name">avatar sm / md / lg</td><td className="dt-val tnum">24 / 32 / 44px</td><td className="dt-role">base .avatar stays 18px for inline meta</td></tr>
            <tr><td className="dt-name">group overlap</td><td className="dt-val tnum">-6px</td><td className="dt-role">2px surface ring separates tiles</td></tr>
            <tr><td className="dt-name">overflow</td><td className="dt-val">+n</td><td className="dt-role">amber tile, aria-label names the count</td></tr>
            <tr><td className="dt-name">kbd key</td><td className="dt-val tnum">12px</td><td className="dt-role">real kbd element, 2px bottom edge</td></tr>
            <tr><td className="dt-name">chord joiner</td><td className="dt-val">+</td><td className="dt-role">aria-hidden, not a key; aria-label spells it</td></tr>
            <tr><td className="dt-name">tag remove</td><td className="dt-val tnum">24px min</td><td className="dt-role">real button, labelled, focus ring</td></tr>
          </tbody>
        </table>
      </div>
      <div className="callout"><ShieldCheck aria-hidden="true" /><div>menus use role menu and menuitem, tooltips use role tooltip with aria-describedby on the trigger, and every overlay is reachable and dismissible from the keyboard with focus kept visible.</div></div>
    </section>
  )
}
