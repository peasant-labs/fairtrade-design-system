import { ShieldCheck, Gem, MapPin, Wrench, AlignLeft, Eye, BookOpen, Gauge, Check, X, BookMarked, Box, Users, FileText } from 'lucide-react'

/* roadmap #1 "one source of truth": the static src/sections/*.html partials, migrated to
   JSX (and src/ui components where the markup maps to one) so the page renders from
   components instead of injected raw html. each converted section preserves the EXACT
   class structure + id the partial emitted, so the layout, the scroll-spy
   (section[id] / .band > .label / .group[id]) and the feedback tool are unchanged.
   lucide icons move from <i data-lucide> to lucide-react (same .lucide class, CSS-sized);
   doc-primitives (.specimen/.dtable/.cmp/.callout/.anatomy) stay as plain JSX. converted
   safest-first; the DOM-wired partials (trails/overlays/canvas/nav) come last. */

/* a group divider opener (foundations / components / using). */
export function GroupOpener({ id, title, sub }) {
  return (
    <div className="group" id={id}>
      <h2>{title}</h2>
      <div className="gs">{sub}</div>
    </div>
  )
}

/* 10-start: the on-ramp (intro prose + three jump cards). zero wiring. */
export function StartSection() {
  return (
    <section className="band" id="start">
      <h2 className="label">start here</h2>
      <div className="sub">one identity across peasant, village and the transcript&nbsp;viewer</div>
      <p className="prose">fairtrade is the shared visual system for three sibling apps. it ships as design tokens, a component set, and the rules that keep every screen aligned, glanceable and readable. this page documents the foundations that everything is built from, the components we assemble, and how to build on the system without breaking it.</p>
      <div className="start-jump">
        <a className="start-card" href="#foundations"><span className="sc-k">foundations</span><span className="sc-d">principles, color, type, spacing, icons, motion, controls</span></a>
        <a className="start-card" href="#components"><span className="sc-k">components</span><span className="sc-d">badges, trails, cards, the conversation window, canvas, forms</span></a>
        <a className="start-card" href="#using"><span className="sc-k">using the system</span><span className="sc-d">accessibility, the token reference, the three apps</span></a>
      </div>
    </section>
  )
}

/* 32-motion: tokens dtable (no copy) + a11y callout. only icon was <i shield-check>. */
export function MotionSection() {
  const rows = [
    { name: '--motion-base', value: '0ms', tnum: true, role: 'default, no transition unless opted in' },
    { name: '--dur-1 / 2 / 3', value: '120 / 160 / 200ms', tnum: true, role: 'interaction transitions, only under no-preference' },
    { name: '--dur-entrance', value: '900ms', tnum: true, role: 'one-time hero + section reveal, off under reduced-motion' },
    { name: 'live dot', value: 'static', tnum: false, role: 'filled, never a pulse or blink' },
  ]
  return (
    <section className="band" id="motion">
      <h2 className="label">motion</h2>
      <div className="sub">static first; motion is added, never assumed</div>
      <p className="prose">reduced motion is the base state, not an opt-out. transitions exist only under a no-preference query and stay short. nothing loops, flashes or autoplays; the live indicator is a static filled dot, never a pulse.</p>

      <div className="dtable-wrap">
        <table className="dtable">
          <thead><tr><th>token</th><th>value</th><th>role</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="dt-name">{r.name}</td>
                <td className={'dt-val' + (r.tnum ? ' tnum' : '')}>{r.value}</td>
                <td className="dt-role">{r.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="callout"><ShieldCheck size={16} /><div>author static, then add motion inside <span className="mono">prefers-reduced-motion: no-preference</span>. interaction transitions stay at or under 200ms (--dur-1..3). one-time entrance motion (the hero resolve and section reveals) may run longer at --dur-entrance, but it fires once, never loops, and is fully disabled under reduced-motion. no parallax, no looping shimmer, no autoplay.</div></div>
    </section>
  )
}

/* 20-principles: seven icon tiles, mirroring the philosophy in llm/DESIGN.md.
   <i data-lucide> -> lucide-react; CSS (.pi .lucide) sizes them. */
export function PrinciplesSection() {
  const items = [
    { icon: Gem, h: 'styled, but functional', p: "craft serves use. every visual choice earns its place in legibility, orientation or speed. when in doubt, remove it." },
    { icon: MapPin, h: 'always know where you are', p: 'fixed nav, sticky section and conversation headers, and an origin-aware breadcrumb. back restores scroll and state.' },
    { icon: Wrench, h: 'tools stay on screen', p: "the controls for the current surface stay visible. action bars, rails and toolbars don't disappear on scroll." },
    { icon: AlignLeft, h: 'aligned, and left-aligned', p: 'one vertical axis. labels and values share a left edge, numbers are tabular, everything sits on the 4/8 grid.' },
    { icon: Eye, h: 'glanceable', p: 'providers, tools, states and nav all lead with a real vector icon, so a dense screen is scannable in a fraction of a second.' },
    { icon: BookOpen, h: 'readable first', p: 'calm contrast, generous line height, body type never below the 16px floor. monospace stays in code and chrome.' },
    { icon: Gauge, h: 'maximize usability', p: 'usability beats flourish at every fork. comfortable targets, obvious states, minimal motion, aa contrast in both themes.' },
  ]
  return (
    <section className="band" id="principles">
      <h2 className="label">principles</h2>
      <div className="sub">the rules every screen follows</div>
      <div className="principles">
        {items.map((it) => {
          const Icon = it.icon
          return (
            <div className="principle" key={it.h}>
              <span className="pi"><Icon /></span>
              <h3>{it.h}</h3>
              <p>{it.p}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* 22-voice: three do/don't comparison pairs + a11y callout. the "don't" card keeps the
   literal &middot; / &mdash; / &gt; / // as the anti-pattern being demonstrated. */
export function VoiceSection() {
  return (
    <section className="band" id="voice">
      <h2 className="label">voice</h2>
      <div className="sub">plain, declarative, lowercase for chrome</div>
      <p className="prose">copy is part of the system, not a layer on top of it. chrome stays lowercase mono and terse; reading prose stays sentence-case and literal. the rules below strip the tells that read as machine-written, so the writing matches the restraint of the interface.</p>

      <div className="cmp">
        <div className="cmp-card cmp-do">
          <div className="cmp-tag"><Check size={14} /> do</div>
          <div className="cmp-body">
            <p className="mono">export transcript</p>
            <p>publish to desert-archivists once redaction passes.</p>
          </div>
          <div className="cmp-note">verb first, literal, names the real thing.</div>
        </div>
        <div className="cmp-card cmp-dont">
          <div className="cmp-tag"><X size={14} /> don't</div>
          <div className="cmp-body">
            <p className="mono">seamlessly leverage your data</p>
            <p>it's not just a transcript, it's a journey.</p>
          </div>
          <div className="cmp-note">no buzzwords, no "not x but y".</div>
        </div>
      </div>

      <div className="cmp">
        <div className="cmp-card cmp-do">
          <div className="cmp-tag"><Check size={14} /> do</div>
          <div className="cmp-body">
            <p>redaction failed on 3 turns. review them, then retry the publish.</p>
          </div>
          <div className="cmp-note">says what happened and what to do next.</div>
        </div>
        <div className="cmp-card cmp-dont">
          <div className="cmp-tag"><X size={14} /> don't</div>
          <div className="cmp-body">
            <p>oops, something went wrong.</p>
          </div>
          <div className="cmp-note">vague and cute, leaves the user stuck.</div>
        </div>
      </div>

      <div className="cmp">
        <div className="cmp-card cmp-do">
          <div className="cmp-tag"><Check size={14} /> do</div>
          <div className="cmp-body">
            <p className="mono">claude-code / 18 turns / redacted</p>
            <p className="mono">filters: provider verified-only</p>
          </div>
          <div className="cmp-note">"/" or spaces separate; mono, lowercase.</div>
        </div>
        <div className="cmp-card cmp-dont">
          <div className="cmp-tag"><X size={14} /> don't</div>
          <div className="cmp-body">
            <p className="mono">claude-code &middot; 18 turns &mdash; redacted</p>
            <p className="mono">&gt; filters: provider // verified-only</p>
          </div>
          <div className="cmp-note">no middot, no em dash, no "&gt;" or "//" ornament.</div>
        </div>
      </div>

      <div className="callout" style={{ marginTop: 'var(--sp-6)' }}><ShieldCheck size={16} /><div>no em dashes, no middot separators, no buzzwords, no fake-terminal ornament. chrome is short and lowercase; literal multi-line copy may be sentence-case.</div></div>
    </section>
  )
}

/* 66-resources: a link list + closing prose. all static, no wiring. */
export function ResourcesSection() {
  return (
    <section className="band" id="resources">
      <h2 className="label">resources</h2>
      <div className="sub">one token layer, three apps</div>
      <div className="reslist">
        <a className="res" href="https://github.com/peasant-labs/peasant-design-system"><BookMarked /> <span className="res-k">repository</span> <span className="res-d">peasant-labs/peasant-design-system</span></a>
        <span className="res"><Box /> <span className="res-k">peasant</span> <span className="res-d">the local web app</span></span>
        <span className="res"><Users /> <span className="res-k">village</span> <span className="res-d">the commons</span></span>
        <span className="res"><FileText /> <span className="res-k">transcript-browser</span> <span className="res-d">the shared viewer</span></span>
      </div>
      <p className="prose">token names are preserved across the three apps, so only the values and fonts change between them. a component reflavors in place: the same <span className="mono">--ink</span>, <span className="mono">--rule</span>, and <span className="mono">--surface</span> resolve to each app's palette, and the markup never moves.</p>
    </section>
  )
}
