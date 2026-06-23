import { ChevronRight, Clock, GitBranch, Hash, ShieldCheck, Flag, User, Brain, FileText, ChevronDown, GitFork, Search, SquarePen, Terminal, Check, GitCommitHorizontal, FileDiff, Share2, Upload, X } from 'lucide-react'

/* 48-conversation: the conversation-window specimen (role turns, thinking blocks,
   tool calls, subagents, diffs, checkpoint marker). uses the EXACT .dl/.rail/.gut/
   .sign/.t diff classes from the partial; brand svg keeps <use href="#b-claude" />. */
export function ConversationSection() {
  return (
    <section className="band" id="conversation">
      <h2 className="label">conversation window</h2>
      <div className="sub">the transcript reading view: phases, role-tinted turns, tool calls, subagents, checkpoints</div>
      <p className="prose">the reading surface for a recorded session. each turn leads with a role icon and label, runs at reading size in the proportional face, and never lowercases what was said. tool calls, thinking blocks and subagent threads collapse to a summary line and open on demand, so a long run scans quickly. a sticky header keeps the breadcrumb, title and run meta on screen while you read, and checkpoint markers tie the prose back to the commits it produced. reach for it whenever a transcript is read rather than skimmed.</p>
      <div className="window framed" style={{ marginTop: 'var(--sp-5)' }}>
        <div className="win-head">
          <div className="crumb">village <ChevronRight aria-hidden="true" /> vitor-hw <ChevronRight aria-hidden="true" /> <span className="cur">refactor ingest pipeline</span></div>
          <div className="win-title">refactor ingest pipeline to stream</div>
          <div className="win-meta">
            <span className="metaitem"><span className="g-claude"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-claude" /></svg></span> claude-code</span>
            <span className="metaitem"><Clock aria-hidden="true" /> <b className="tnum">2h 14m</b></span>
            <span className="metaitem"><GitBranch aria-hidden="true" /> <b className="tnum">18</b> turns</span>
            <span className="metaitem"><Hash aria-hidden="true" /> <b className="tnum">42,318</b> tokens</span>
            <span className="chip chip-ok" style={{ marginLeft: 'auto' }}><ShieldCheck aria-hidden="true" /> redacted</span>
          </div>
        </div>
        <div className="phase"><span className="lbl"><Flag aria-hidden="true" /> phase: streaming refactor</span><span className="rng">turns 1-8</span></div>
        <div className="turn user">
          <div className="turn-head"><User aria-hidden="true" /> user <span className="meta">turn 1</span></div>
          <div className="body">Can you refactor the ingest pipeline so it streams sessions instead of loading everything into memory? Keep the tests green.</div>
        </div>
        <div className="turn asst">
          <div className="turn-head"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-claude" /></svg> claude <span className="meta">turn 2</span></div>
          <div className="body">I'll convert <b>loadAll</b> into a streaming reader so sessions are processed one at a time. Let me map where it's used, then swap the eager load for a channel-backed stream.
            <div className="thinking"><Brain aria-hidden="true" /> thought for 6s, planning the stream boundary</div>
            <div className="toolcall"><div className="tc-head"><span className="kind"><FileText aria-hidden="true" /> read</span><span className="path">internal/ingest/pipeline.go</span><span className="right">240 lines <ChevronDown aria-hidden="true" /></span></div></div>
          </div>
        </div>
        <div className="subtask">
          <div className="subtask-head"><GitFork aria-hidden="true" /> <span className="who">task</span> explore loadAll call sites <span className="elbow">&#8627; spawned subagent</span></div>
          <div className="turn sub">
            <div className="turn-head"><GitFork aria-hidden="true" /> subagent <span className="meta">turn 3</span></div>
            <div className="body">Searched the pipeline for <b>loadAll</b>. Found 3 call sites, all reachable from <span className="mono">Run</span>. Safe to replace with a streaming reader.
              <div className="toolcall"><div className="tc-head"><span className="kind"><Search aria-hidden="true" /> grep</span><span className="path">loadAll in internal/ingest</span><span className="right">3 matches <ChevronDown aria-hidden="true" /></span></div></div>
            </div>
          </div>
          <div className="subtask-foot"><span className="elbow">&#9492; returned to claude</span></div>
        </div>
        <div className="turn asst">
          <div className="turn-head"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-claude" /></svg> claude <span className="meta">turn 4</span></div>
          <div className="body">Confirmed. Swapping the eager load for <b>openStream</b> and running the race detector.
            <div className="toolcall">
              <div className="tc-head"><span className="kind"><SquarePen aria-hidden="true" /> edit</span><span className="path">internal/ingest/pipeline.go</span><span className="right">+1 -1 <ChevronDown aria-hidden="true" /></span></div>
              <div className="diff">
                <div className="dl ctx"><span className="rail"></span><span className="gut">211</span><span className="sign"></span><span className="t">func (p *Pipeline) Run(ctx context.Context) error {'{'}</span></div>
                <div className="dl del"><span className="rail"></span><span className="gut">212</span><span className="sign">−</span><span className="t">  sessions, err := loadAll(ctx, p.src)</span></div>
                <div className="dl add"><span className="rail"></span><span className="gut">212</span><span className="sign">+</span><span className="t">  stream, err := openStream(ctx, p.src)</span></div>
                <div className="dl ctx"><span className="rail"></span><span className="gut">213</span><span className="sign"></span><span className="t">  if err != nil {'{'} return err {'}'}</span></div>
              </div>
            </div>
            <div className="toolcall"><div className="tc-head"><span className="kind"><Terminal aria-hidden="true" /> bash</span><span className="path">go test -race ./internal/ingest/</span><span className="right" style={{ color: 'var(--olive)' }}><Check aria-hidden="true" /> ok</span></div></div>
          </div>
        </div>
        <div className="marker"><span className="r"></span><span className="mkc"><GitCommitHorizontal aria-hidden="true" /> commit <span className="hash">a3f9c1</span> <span className="mkc-msg">stream ingest, constant memory</span></span><span className="r"></span></div>
        <div className="win-foot"><span className="chip chip-ok"><Check aria-hidden="true" /> tests green</span><span className="chip"><FileDiff aria-hidden="true" /> +1 -1 in 1 file</span><span style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--sp-3)' }}><button className="btn btn-secondary btn-sm"><Share2 aria-hidden="true" /> share</button><button className="btn btn-primary btn-sm"><Upload aria-hidden="true" /> contribute</button></span></div>
      </div>
      <div className="anatomy">
        <div className="anatomy-legend">
          <span className="anatomy-item"><span className="anatomy-num">1</span> sticky header: breadcrumb, title and run meta</span>
          <span className="anatomy-item"><span className="anatomy-num">2</span> phase divider with turn range</span>
          <span className="anatomy-item"><span className="anatomy-num">3</span> user turn, tinted teal</span>
          <span className="anatomy-item"><span className="anatomy-num">4</span> assistant turn, tinted amber</span>
          <span className="anatomy-item"><span className="anatomy-num">5</span> turn head: role icon, label and tabular turn number</span>
          <span className="anatomy-item"><span className="anatomy-num">6</span> thinking block</span>
          <span className="anatomy-item"><span className="anatomy-num">7</span> tool-call header: tool icon, target, result</span>
          <span className="anatomy-item"><span className="anatomy-num">8</span> subagent nested thread</span>
          <span className="anatomy-item"><span className="anatomy-num">9</span> unified diff: rail, gutter, sign</span>
          <span className="anatomy-item"><span className="anatomy-num">10</span> checkpoint marker</span>
          <span className="anatomy-item"><span className="anatomy-num">11</span> footer action bar</span>
        </div>
      </div>
      <div className="cmp">
        <div className="cmp-card cmp-do">
          <div className="cmp-tag"><Check aria-hidden="true" /> do</div>
          <div className="cmp-body">
            <div className="turn user">
              <div className="turn-head"><User aria-hidden="true" /> user <span className="meta">turn 7</span></div>
              <div className="body">Run the race detector before you commit.</div>
            </div>
          </div>
          <div className="cmp-note">lead every turn with a role icon and label, plus a tabular turn number.</div>
        </div>
        <div className="cmp-card cmp-dont">
          <div className="cmp-tag"><X aria-hidden="true" /> don't</div>
          <div className="cmp-body">
            <div className="turn user">
              <div className="body" style={{ textTransform: 'lowercase' }}>run the race detector before you commit.</div>
            </div>
          </div>
          <div className="cmp-note">don't lean on tint alone for role, or lowercase the transcript body or code.</div>
        </div>
      </div>
      <div className="callout"><ShieldCheck aria-hidden="true" /><div>role is carried by an icon and label, never tint alone. transcript bodies read in the proportional face, never below 16px, and keep their original case; code and hashes stay verbatim. turn numbers, durations and token counts are tabular. the sticky header is offset by --nav-h so an anchored turn clears the nav.</div></div>
    </section>
  )
}
