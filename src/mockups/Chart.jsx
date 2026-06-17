import { useId, useMemo, useState } from 'react'
import { Hash, Wrench, FileSearch, Search, FilePen, Terminal } from 'lucide-react'

/* MOCKUP 3 - CHART. a hand-rolled svg session-metrics view in the house style:
   no chart library, square, hairline axes/gridlines via --rule / --ink-3, the
   primary series in scarce --amber, the secondary tool series in --teal/--olive.
   colours are token-driven inline so both themes re-theme for free. tabular-num
   labels, lowercase axis chrome, reduced-motion honoured (no tooltip transition).

   the two views:
   - "tokens per turn": a vertical bar chart, one bar per turn, hover/focus a bar
     to read its turn number + token count. every bar is a focusable point with an
     aria-label so the chart is operable from the keyboard.
   - "tool calls": a horizontal bar chart of Read/Grep/Edit/Bash tallies for the
     same session, the busiest tool in amber, the rest in the earth palette. */

/* one session, baked in. tokens is the per-turn count; tools is the running tally. */
const TURNS = [
  { n: 1, role: 'user', tokens: 1840 },
  { n: 2, role: 'asst', tokens: 6120 },
  { n: 3, role: 'asst', tokens: 9430 },
  { n: 4, role: 'user', tokens: 2210 },
  { n: 5, role: 'asst', tokens: 12850 },
  { n: 6, role: 'asst', tokens: 8470 },
  { n: 7, role: 'asst', tokens: 15320 },
  { n: 8, role: 'user', tokens: 1620 },
  { n: 9, role: 'asst', tokens: 7240 },
  { n: 10, role: 'asst', tokens: 11080 },
  { n: 11, role: 'asst', tokens: 18960 },
  { n: 12, role: 'asst', tokens: 6510 },
  { n: 13, role: 'user', tokens: 2040 },
  { n: 14, role: 'asst', tokens: 9870 },
  { n: 15, role: 'asst', tokens: 13420 },
  { n: 16, role: 'asst', tokens: 5180 },
  { n: 17, role: 'asst', tokens: 10260 },
  { n: 18, role: 'asst', tokens: 4290 },
]

const TOOLS = [
  { key: 'read', label: 'Read', count: 86, Icon: FileSearch, tone: 'var(--amber)' },
  { key: 'grep', label: 'Grep', count: 54, Icon: Search, tone: 'var(--teal)' },
  { key: 'edit', label: 'Edit', count: 41, Icon: FilePen, tone: 'var(--olive)' },
  { key: 'bash', label: 'Bash', count: 27, Icon: Terminal, tone: 'var(--mauve)' },
]

const fmt = (n) => n.toLocaleString('en-US')

export default function Chart() {
  const [view, setView] = useState('tokens') // 'tokens' | 'tools'
  const [hot, setHot] = useState(null) // hovered/focused turn index, or null
  const uid = useId()
  const tipId = uid + '-tip'

  /* tokens-per-turn geometry (viewBox units; the svg scales responsively) */
  const tk = useMemo(() => {
    const W = 760, H = 280
    const pad = { l: 56, r: 12, t: 16, b: 36 }
    const plotW = W - pad.l - pad.r
    const plotH = H - pad.t - pad.b
    const max = Math.max(...TURNS.map((t) => t.tokens))
    // round the axis ceiling up to a clean 5k step so gridlines land on round numbers
    const step = 5000
    const ceil = Math.ceil(max / step) * step
    const ticks = []
    for (let v = 0; v <= ceil; v += step) ticks.push(v)
    const gap = 4
    const bw = plotW / TURNS.length - gap
    const bars = TURNS.map((t, i) => {
      const h = (t.tokens / ceil) * plotH
      const x = pad.l + i * (plotW / TURNS.length) + gap / 2
      const y = pad.t + plotH - h
      return { ...t, i, x, y, w: Math.max(2, bw), h }
    })
    const total = TURNS.reduce((s, t) => s + t.tokens, 0)
    return { W, H, pad, plotW, plotH, ceil, ticks, bars, total, max }
  }, [])

  /* tool-call distribution geometry (horizontal bars) */
  const tl = useMemo(() => {
    const W = 760, H = 220
    const pad = { l: 96, r: 56, t: 12, b: 12 }
    const plotW = W - pad.l - pad.r
    const plotH = H - pad.t - pad.b
    const max = Math.max(...TOOLS.map((t) => t.count))
    const rowH = plotH / TOOLS.length
    const barH = Math.min(34, rowH - 14)
    const bars = TOOLS.map((t, i) => {
      const w = (t.count / max) * plotW
      const y = pad.t + i * rowH + (rowH - barH) / 2
      return { ...t, i, x: pad.l, y, w, h: barH }
    })
    const total = TOOLS.reduce((s, t) => s + t.count, 0)
    return { W, H, pad, plotW, plotH, max, bars, total }
  }, [])

  const hotTurn = hot != null ? tk.bars[hot] : null

  /* position the html tooltip over the hot bar, in % of the responsive svg box so
     it tracks the bar at any width (css centers it and lifts it above the bar) */
  const tip = hotTurn
    ? {
        leftPct: ((hotTurn.x + hotTurn.w / 2) / tk.W) * 100,
        topPct: (hotTurn.y / tk.H) * 100,
      }
    : null

  return (
    <section className="band" id="mock-chart">
      <h2 className="label">chart</h2>
      <div className="sub">session metrics drawn by hand, no chart library</div>
      <p className="prose">
        a small set of charts for reading a recorded run: tokens spent per turn, and how the tool
        calls split across read, grep, edit and bash. axes and gridlines are hairlines, the primary
        series carries the one amber accent, and every bar is a focusable point you can tab through
        to hear its turn and value.
      </p>

      <div className="specimen">
        <div className="specimen-bar">
          <span className="specimen-cap">example</span>
          <div className="mock-chart-toggle" role="group" aria-label="chart view">
            <button
              type="button"
              className="mock-chart-seg"
              aria-pressed={view === 'tokens'}
              onClick={() => { setView('tokens'); setHot(null) }}
            >
              <Hash size={14} aria-hidden="true" /> tokens per turn
            </button>
            <button
              type="button"
              className="mock-chart-seg"
              aria-pressed={view === 'tools'}
              onClick={() => { setView('tools'); setHot(null) }}
            >
              <Wrench size={14} aria-hidden="true" /> tool calls
            </button>
          </div>
        </div>

        <div className="specimen-body">
          {view === 'tokens' ? (
            <div className="mock-chart">
              <div className="mock-chart-head">
                <span className="mock-chart-title">tokens per turn</span>
                <span className="mock-chart-legend">
                  <span className="mock-chart-key">
                    <span className="mock-chart-swatch" style={{ background: 'var(--amber)' }} aria-hidden="true" />
                    assistant
                  </span>
                  <span className="mock-chart-key">
                    <span className="mock-chart-swatch" style={{ background: 'var(--teal)' }} aria-hidden="true" />
                    user
                  </span>
                  <span className="mock-chart-stat">
                    total <b className="tnum">{fmt(tk.total)}</b>
                  </span>
                  <span className="mock-chart-stat">
                    peak <b className="tnum">{fmt(tk.max)}</b>
                  </span>
                </span>
              </div>

              <div className="mock-chart-plot">
                <svg
                  className="mock-chart-svg"
                  viewBox={`0 0 ${tk.W} ${tk.H}`}
                  role="img"
                  aria-label={`tokens per turn across ${TURNS.length} turns, ${fmt(tk.total)} total`}
                >
                  {/* y gridlines. value labels are drawn as html below so type stays crisp at any scale */}
                  {tk.ticks.map((v) => {
                    const y = tk.pad.t + tk.plotH - (v / tk.ceil) * tk.plotH
                    return (
                      <line
                        key={v}
                        x1={tk.pad.l}
                        x2={tk.W - tk.pad.r}
                        y1={y}
                        y2={y}
                        stroke="var(--rule)"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    )
                  })}

                  {/* baseline axis (slightly stronger) */}
                  <line
                    x1={tk.pad.l}
                    x2={tk.W - tk.pad.r}
                    y1={tk.pad.t + tk.plotH}
                    y2={tk.pad.t + tk.plotH}
                    stroke="var(--ink-3)"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* bars: assistant in amber, user turns in teal so role reads without colour-only reliance (the legend names both) */}
                  {tk.bars.map((b) => {
                    const on = hot === b.i
                    const fill = b.role === 'user' ? 'var(--teal)' : 'var(--amber)'
                    return (
                      <rect
                        key={b.n}
                        x={b.x}
                        y={b.y}
                        width={b.w}
                        height={b.h}
                        fill={fill}
                        opacity={hot == null || on ? 1 : 0.42}
                        tabIndex={0}
                        role="img"
                        aria-label={`turn ${b.n}, ${b.role === 'user' ? 'user' : 'assistant'}, ${fmt(b.tokens)} tokens`}
                        className="mock-chart-bar"
                        onMouseEnter={() => setHot(b.i)}
                        onMouseLeave={() => setHot((h) => (h === b.i ? null : h))}
                        onFocus={() => setHot(b.i)}
                        onBlur={() => setHot((h) => (h === b.i ? null : h))}
                      />
                    )
                  })}
                </svg>

                {/* y axis value labels, drawn as html so the type stays crisp */}
                <div className="mock-chart-yaxis" aria-hidden="true" style={{ width: (tk.pad.l / tk.W) * 100 + '%' }}>
                  {tk.ticks.map((v) => (
                    <span
                      key={v}
                      className="mock-chart-ylab tnum"
                      style={{ top: ((tk.pad.t + tk.plotH - (v / tk.ceil) * tk.plotH) / tk.H) * 100 + '%' }}
                    >
                      {v === 0 ? '0' : v / 1000 + 'k'}
                    </span>
                  ))}
                </div>

                {/* x axis: turn numbers, lowercase chrome, tabular. drawn as html so the type
                    stays crisp and selectable rather than rasterised as svg text */}
                <div className="mock-chart-xaxis" aria-hidden="true">
                  {tk.bars.map((b) => (
                    <span
                      key={b.n}
                      className={'mock-chart-xlab tnum' + (hot === b.i ? ' is-hot' : '')}
                      style={{ left: ((b.x + b.w / 2) / tk.W) * 100 + '%' }}
                    >
                      {b.n}
                    </span>
                  ))}
                </div>

                {/* tooltip: html overlay so it inherits crisp type + tokens. no transition under reduced-motion (handled in css) */}
                {hotTurn && (
                  <div
                    id={tipId}
                    aria-hidden="true"
                    className="mock-chart-tip"
                    style={{
                      left: tip.leftPct + '%',
                      top: tip.topPct + '%',
                    }}
                  >
                    <span className="mock-chart-tip-k">turn {hotTurn.n}</span>
                    <span className="mock-chart-tip-v tnum">{fmt(hotTurn.tokens)} tokens</span>
                    <span className="mock-chart-tip-r">{hotTurn.role === 'user' ? 'user' : 'assistant'}</span>
                  </div>
                )}
              </div>
              <p className="mock-chart-foot">
                hover or tab a bar to read its turn and token count. assistant turns spend the most;
                turn <b className="tnum">11</b> is the peak at <b className="tnum">{fmt(18960)}</b>.
              </p>
            </div>
          ) : (
            <div className="mock-chart">
              <div className="mock-chart-head">
                <span className="mock-chart-title">tool-call distribution</span>
                <span className="mock-chart-legend">
                  <span className="mock-chart-stat">
                    calls <b className="tnum">{fmt(tl.total)}</b>
                  </span>
                </span>
              </div>

              <div className="mock-chart-plot mock-chart-plot--tools">
                <svg
                  className="mock-chart-svg"
                  viewBox={`0 0 ${tl.W} ${tl.H}`}
                  role="img"
                  aria-label={`tool-call distribution, ${fmt(tl.total)} calls total`}
                >
                  {/* x gridlines at clean steps */}
                  {[0, 20, 40, 60, 80].filter((v) => v <= tl.max + 1).map((v) => {
                    const x = tl.pad.l + (v / tl.max) * tl.plotW
                    return (
                      <line
                        key={v}
                        x1={x}
                        x2={x}
                        y1={tl.pad.t}
                        y2={tl.H - tl.pad.b}
                        stroke="var(--rule)"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    )
                  })}
                  {/* left axis */}
                  <line
                    x1={tl.pad.l}
                    x2={tl.pad.l}
                    y1={tl.pad.t}
                    y2={tl.H - tl.pad.b}
                    stroke="var(--ink-3)"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  {tl.bars.map((b) => (
                    <g key={b.key}>
                      <rect
                        x={b.x}
                        y={b.y}
                        width={Math.max(2, b.w)}
                        height={b.h}
                        fill={b.tone}
                        className="mock-chart-bar"
                        tabIndex={0}
                        role="img"
                        aria-label={`${b.label}, ${fmt(b.count)} calls`}
                      />
                    </g>
                  ))}
                </svg>

                {/* tool labels (left) + counts (right of each bar) as html for crisp type */}
                <div className="mock-chart-trows" aria-hidden="true">
                  {tl.bars.map((b) => (
                    <div
                      key={b.key}
                      className="mock-chart-trow"
                      style={{ top: (b.y / tl.H) * 100 + '%', height: (b.h / tl.H) * 100 + '%' }}
                    >
                      <span className="mock-chart-tname" style={{ width: (tl.pad.l / tl.W) * 100 + '%' }}>
                        <b.Icon size={14} aria-hidden="true" style={{ color: b.tone }} /> {b.label}
                      </span>
                      <span
                        className="mock-chart-tcount tnum"
                        style={{ left: ((b.x + b.w) / tl.W) * 100 + '%' }}
                      >
                        {fmt(b.count)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mock-chart-foot">
                <b>Read</b> leads at <b className="tnum">{fmt(86)}</b> calls, ahead of grep, edit and bash.
                the busiest tool carries the amber accent.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="callout">
        <Hash size={16} aria-hidden="true" />
        <div>
          one amber series at a time keeps the accent scarce; gridlines and axes stay hairline. bars
          are keyboard-focusable with spoken labels, counts and durations are tabular, and the
          tooltip never animates when reduced motion is set.
        </div>
      </div>
    </section>
  )
}
