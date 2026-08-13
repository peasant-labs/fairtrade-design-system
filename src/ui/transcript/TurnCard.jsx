import { CornerDownRight, User, Wrench, Check, Link as LinkIcon, AlertTriangle, Coins } from 'lucide-react'
import ProviderIcon from '../ProviderIcon.jsx'
import { providerAccent, providerDisplayName } from '../provider-policy.js'
import Markdown from './Markdown.jsx'
import Thinking from './Thinking.jsx'
import ToolCall from './ToolCall.jsx'

/* TurnCard — one transcript turn, lifted verbatim from the canonical mockup
   (src/mockups/inuse/TranscriptApp.jsx:541). DUMB: it renders a cooked `TurnVM`
   (role / label / content / thinking / tool calls the adapter produced) and composes the
   lifted Markdown, Thinking, and ToolCall primitives. Every view-state input (active /
   open-tools / copied / saved label / compact / expand-all) is controllable with a sane
   default. It NEVER parses wire or reads a git field.

   Reconciliation note vs the mockup: the per-turn commit "checkpoint" marker is NOT drawn
   here. The cooked model relocates commits to the session-level `session.git.commits`
   (render-when-present), which the composite TranscriptViewer places between turns via the
   existing CheckpointMarker primitive. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/** compact token count, e.g. 1700 → "1.7k". @param {number} n @returns {string} */
const fmtTokens = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n))

/** Relative "Nm ago" from an RFC3339 timestamp — the fallback when no curated `time` is supplied
 *  (a real app derives the relative label from the wire timestamp; a static demo pins a stable
 *  `time` instead, since "ago" is non-deterministic). Returns the raw string if unparseable. */
function formatRelative(ts) {
  const t = ts ? Date.parse(ts) : NaN
  if (!Number.isFinite(t)) return ts || ''
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

/**
 * @param {object} props
 * @param {TurnVM} [props.turn]
 * @param {boolean} [props.active]
 * @param {Record<string, boolean>} [props.openTools]   tool id → open?
 * @param {(id: string) => void} [props.toggleTool]
 * @param {(turnIndex: number) => void} [props.onCopyAnchor]
 * @param {boolean} [props.copied]
 * @param {(turnIndex: number, el: HTMLElement | null) => void} [props.registerRef]
 * @param {(turnIndex: number) => void} [props.onLabel]   omit to hide the "label" affordance
 * @param {(turn: object) => unknown} [props.renderActions]  host-owned per-turn actions; replaces the built-in label button (hosts with their own label models render their own popover)
 * @param {{ outcome: string, flag?: string }} [props.savedLabel]
 * @param {boolean} [props.compact]
 * @param {boolean} [props.expandAll]
 */
export default function TurnCard({
  turn,
  active = false,
  openTools = {},
  toggleTool = () => {},
  onCopyAnchor = () => {},
  copied = false,
  registerRef = () => {},
  onLabel,
  renderActions,
  savedLabel,
  compact = false,
  expandAll = false,
}) {
  if (!turn) return null
  const isUser = turn.role === 'user'
  const isSub = !!turn.depth && turn.depth > 0
  // The assistant is the agent, so a present canonical provider selects its
  // accent. Curated turns may omit provider and use the neutral assistant
  // fallback; a present invalid value fails through providerAccent.
  const provider = turn.provider
  const providerLabel = provider === undefined ? undefined : providerDisplayName(provider)
  const roleLabel = isSub ? 'subagent' : turn.role
  const accentName = provider === undefined ? 'amber' : providerAccent(provider)
  const asstAccent = `var(--${accentName})`

  const head = (
    <div className="txn-turnhead">
      <span
        className="txn-rolelabel"
        style={turn.role === 'assistant' && !isSub ? { color: asstAccent } : undefined}
      >
        {turn.role === 'assistant' && !isSub && provider !== undefined ? (
          <ProviderIcon
            harness={provider}
            accent
            label={providerLabel}
          />
        ) : isSub ? (
          <CornerDownRight size={14} aria-hidden="true" />
        ) : isUser ? (
          <User size={14} aria-hidden="true" />
        ) : (
          <Wrench size={14} aria-hidden="true" />
        )}
        {roleLabel}
      </span>
      {turn.effectiveModel && <span className="txn-turnmodel mono">{turn.effectiveModel}</span>}
      {isSub && <span className="txn-depth tnum">depth {turn.depth}</span>}
      <span className="txn-turnnum tnum">#{turn.label}</span>
      {(turn.time || turn.timestamp) && (
        <span className="txn-turntime" title={turn.timeTitle ?? turn.timestamp}>
          {turn.time ?? formatRelative(turn.timestamp)}
        </span>
      )}
      <button
        type="button"
        className="txn-anchor"
        data-turn-control={turn.index}
        aria-label={'copy link to turn ' + turn.label}
        title="copy link to this turn"
        onClick={() => onCopyAnchor(turn.index)}
      >
        {copied ? <Check size={13} aria-hidden="true" /> : <LinkIcon size={13} aria-hidden="true" />}
      </button>
      {renderActions ? (
        renderActions(turn)
      ) : onLabel && (
        <button type="button" className="txn-labelbtn" onClick={() => onLabel(turn.index)}>
          label
        </button>
      )}
      {turn.isError && (
        <span className="chip chip-err txn-pill">
          <AlertTriangle size={12} aria-hidden="true" /> error
        </span>
      )}
      {turn.tokens && (
        <span
          className="txn-tokbadge tnum"
          title={fmtTokens(turn.tokens.in) + ' in · ' + fmtTokens(turn.tokens.out) + ' out'}
        >
          <Coins size={12} aria-hidden="true" /> {fmtTokens(turn.tokens.in + turn.tokens.out)}
        </span>
      )}
    </div>
  )

  const body = (
    <>
      {savedLabel && (
        <div className="txn-savedchips">
          <span
            className={
              'chip ' +
              (savedLabel.outcome === 'bad' ? 'chip-err' : savedLabel.outcome === 'good' ? 'chip-ok' : '')
            }
            title={'saved label · ' + savedLabel.outcome}
          >
            {savedLabel.outcome}
            {savedLabel.flag ? ' · ' + savedLabel.flag : ''}
          </span>
        </div>
      )}
      <Markdown text={turn.content} />
      {turn.thinking && <Thinking block={turn.thinking} />}
      {turn.toolCalls &&
        turn.toolCalls.map((t) => (
          <ToolCall
            key={t.id}
            tool={t}
            open={expandAll || !!openTools[t.id]}
            onToggle={() => toggleTool(t.id)}
          />
        ))}
    </>
  )

  const cardClass =
    'turn txn-turn ' +
    (isUser ? 'user' : isSub ? 'sub' : 'asst') +
    (active ? ' txn-active' : '') +
    (compact ? ' txn-compact' : '')

  return (
    <div
      className="txn-turnwrap"
      ref={(el) => registerRef(turn.index, el)}
      data-turn={turn.index}
      id={'turn-' + turn.index}
    >
      {turn.modelChangedFrom && turn.effectiveModel && (
        <div className="txn-modelchange mono" role="status">
          model changed: {turn.modelChangedFrom} -&gt; {turn.effectiveModel}
        </div>
      )}
      {isSub ? (
        <div className="subtask txn-subtask">
          <div className="subtask-head">
            <CornerDownRight size={13} aria-hidden="true" /> <span className="who">{turn.agentName}</span> subagent
          </div>
          <div className={cardClass}>
            {head}
            {body}
          </div>
          <div className="subtask-foot">
            <span className="elbow">
              <CornerDownRight size={13} aria-hidden="true" /> returned to claude
            </span>
          </div>
        </div>
      ) : (
        <div className={cardClass}>
          {head}
          {body}
        </div>
      )}
    </div>
  )
}
