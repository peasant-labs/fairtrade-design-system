import { CornerDownRight, User, Wrench, Check, Link as LinkIcon, AlertTriangle, Coins } from 'lucide-react'
import { useId, useLayoutEffect, useState } from 'react'
import ProviderIcon from '../ProviderIcon.jsx'
import BrandMark from '../BrandMark.jsx'
import { providerAccent, providerDisplayName } from '../provider-policy.js'
import Markdown from './Markdown.jsx'
import Thinking from './Thinking.jsx'
import ToolCall from './ToolCall.jsx'
import TranscriptSystemRow from './SystemRow.jsx'
import TranscriptWorkGroup from './WorkGroup.jsx'
import UsageDisclosure from './UsageDisclosure.jsx'
import { Term } from '../Explainer.jsx'
import { formatRelative as formatRelativeTime, isKnownTime } from './time.js'
import { formatCount } from '../format.js'

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
/* a model id without its provider prefix: "anthropic/claude-fable-5" reads "claude-fable-5" */
const modelName = (id) => String(id ?? '').split('/').pop()

/** The turn's time label, the fallback when no curated `time` is supplied (a real app derives it
 *  from the wire timestamp; a static demo pins a stable `time`, since "ago" is non-deterministic).
 *  A recorded time reads relative, then as a date past a week; an unknown one (zero, epoch, Go
 *  zero-time) reads as nothing; an unparseable curated string passes through as written. */
function turnTimeLabel(ts) {
  if (!ts) return ''
  if (!Number.isFinite(Date.parse(ts))) return ts
  return isKnownTime(ts) ? formatRelativeTime(ts) : ''
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
 * @param {number} [props.revealRequest] explicit search navigation sequence
 * @param {number} [props.headingLevel=4] the turn heading's level: h4 under a viewer whose title is an h2, h3 under one
 *        whose title is the page's h1
 * @param {'classic' | 'ledger'} [props.presentation='classic'] chrome presentation. `ledger` leads with a
 *        square role well and the role word, groups the turn's tool calls into one work panel, and renders a
 *        system turn as a compact row; absent, the classic card renders exactly as before. In ledger the head
 *        carries only the role, the turn number, the time, and the copy anchor (plus the host's
 *        `renderActions`); the built-in collapse control, label affordance, model name, error chip, token
 *        badge, and saved-label chip are intentionally hidden there for now. The host's own per-turn
 *        `renderActions` and `renderTurnPanel` keep rendering on every role, so a host extension is never
 *        dropped by the presentation switch.
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
  revealRequest = 0,
  headingLevel = 4,
  presentation = 'classic',
}) {
  const TurnHeading = `h${Math.min(6, Math.max(1, headingLevel))}`
  const ledger = presentation === 'ledger'
  const [expanded, setExpanded] = useState(true)
  const bodyId = useId()
  const headingId = useId()
  useLayoutEffect(() => {
    if (revealRequest) setExpanded(true)
  }, [revealRequest])
  if (!turn) return null
  const isUser = turn.role === 'user'
  const isEarlier = !!turn.partition && turn.partition !== 'main'
  const timeLabel = turn.time || turnTimeLabel(turn.timestamp)
  const isSub = !!turn.depth && turn.depth > 0
  // The assistant is the agent, so a present canonical provider selects its
  // accent. Curated turns may omit provider and use the neutral assistant
  // fallback; a present invalid value fails through providerAccent.
  const provider = turn.provider
  const providerLabel = provider === undefined ? undefined : providerDisplayName(provider)
  const roleLabel = isSub ? 'subagent' : turn.role
  const accentName = provider === undefined ? 'amber' : providerAccent(provider)
  const asstAccent = `var(--${accentName})`

  const roleStyle = turn.role === 'assistant' && !isSub ? { color: asstAccent } : undefined
  const roleGlyph = turn.role === 'assistant' && !isSub && provider !== undefined ? (
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
  )
  const anchorButton = !isEarlier ? (
    <button
      type="button"
      className="txn-anchor"
      data-turn-control={turn.index}
      aria-label={'copy link to turn ' + turn.label}
      title="copy link to this turn"
      onClick={() => onCopyAnchor(turn.index)}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <LinkIcon size={14} aria-hidden="true" />}
    </button>
  ) : null

  const head = (
    <div className={'txn-turnhead' + (ledger ? ' txn-turnhead-ledger' : '')}>
      <TurnHeading id={headingId} className="txn-turn-heading">{roleLabel} turn {turn.label}</TurnHeading>
      {ledger ? (
        <>
          {/* the ledger head: the square role well and the role word, then the turn number, the
              time, and the copy anchor. The well is not aria-hidden so a provider mark keeps its
              accessible name; the role word beside it names the role either way. */}
          <span className="txn-roleico" style={roleStyle}>{roleGlyph}</span>
          <span className="txn-rolelabel" style={roleStyle}>{roleLabel}</span>
          <span className="txn-turnnum tnum">#{turn.label}</span>
          {timeLabel && (
            <Term className="txn-turntime" def={turn.timeTitle ?? turn.timestamp ?? turn.time}>
              {timeLabel}
            </Term>
          )}
          {anchorButton}
          {renderActions ? renderActions(turn) : null}
        </>
      ) : (
        <>
          <span className="txn-rolelabel" style={roleStyle}>
            {roleGlyph}
            {roleLabel}
          </span>
          {turn.effectiveModel && <span className="txn-turnmodel mono">{turn.effectiveModel}</span>}
          {isSub && <span className="txn-depth tnum">depth {turn.depth}</span>}
          <span className="txn-turnnum tnum">#{turn.label}</span>
          <button type="button" className="txn-turn-disclosure" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(value => !value)}>
            {expanded ? 'collapse' : 'expand'} turn {turn.label}
          </button>
          {timeLabel && (
            <Term className="txn-turntime" def={turn.timeTitle ?? turn.timestamp ?? turn.time}>
              {timeLabel}
            </Term>
          )}
          {anchorButton}
          {renderActions ? (
            renderActions(turn)
          ) : onLabel && (
            <button type="button" className="txn-labelbtn" onClick={() => onLabel(turn.index)}>
              label
            </button>
          )}
          {turn.isError && (
            <span className="chip chip-err txn-pill">
              <AlertTriangle size={14} aria-hidden="true" /> error
            </span>
          )}
          {turn.tokens && (
            <Term className="txn-tokbadge tnum" def={formatCount(turn.tokens.in) + ' input tokens, ' + formatCount(turn.tokens.out) + ' output tokens'}>
              <Coins size={14} aria-hidden="true" /> {formatCount(turn.tokens.in + turn.tokens.out)} tokens
            </Term>
          )}
        </>
      )}
    </div>
  )

  const body = (
    <>
      {savedLabel && !ledger && (
        <div className="txn-savedchips">
          <span
            className={
              'chip ' +
              (savedLabel.outcome === 'bad' ? 'chip-err' : savedLabel.outcome === 'good' ? 'chip-ok' : '')
            }
            title={'saved label, ' + savedLabel.outcome}
          >
            {savedLabel.outcome}
            {savedLabel.flag ? ', ' + savedLabel.flag : ''}
          </span>
        </div>
      )}
      <Markdown text={turn.displayContent ?? turn.content} />
      {turn.thinking && <Thinking block={turn.thinking} />}
      <UsageDisclosure usage={turn.usage} />
      {turn.toolCalls && (ledger ? (
        /* one grouped panel per turn: the computed summary above the same tool rows */
        <TranscriptWorkGroup
          tools={turn.toolCalls}
          openTools={openTools}
          onToggle={toggleTool}
          expandAll={expandAll}
        />
      ) : (
        turn.toolCalls.map((t) => (
          <ToolCall
            key={t.id}
            tool={t}
            open={expandAll || !!openTools[t.id]}
            onToggle={() => toggleTool(t.id)}
          />
        ))
      ))}
    </>
  )

  const cardClass =
    'turn txn-turn ' +
    (isUser ? 'user' : isSub ? 'sub' : turn.role === 'system' ? 'system' : 'asst') +
    (active ? ' txn-active' : '') +
    (compact ? ' txn-compact' : '') +
    (ledger ? ' txn-turn-ledger' : '')

  const wrapClass = 'txn-turnwrap' + (ledger ? ' txn-turnwrap-ledger' : '')

  /* a ledger system turn is one compact row, not a card: it renders inside the same article the
     other turns use (one anchor id, one registerRef, the partition data), with the hidden heading
     and the row as its children. The row keeps the same trailing cluster every ledger turn has:
     the copy anchor plus the host's own per-turn actions, so a host extension survives the role
     switch. */
  const systemRow = ledger && turn.role === 'system'

  return (
    <article
      className={wrapClass}
      aria-labelledby={headingId}
      ref={(el) => registerRef(turn.index, el)}
      data-turn={isEarlier ? undefined : turn.index}
      data-source-entry-ref={turn.sourceEntryRef}
      data-partition={turn.partition ?? 'main'}
      id={isEarlier ? `${turn.partition}-turn-${turn.index}` : 'turn-' + turn.index}
    >
      {systemRow ? (
        <>
          <TurnHeading id={headingId} className="txn-turn-heading">{roleLabel} turn {turn.label}</TurnHeading>
          <TranscriptSystemRow
            turn={turn}
            revealRequest={revealRequest}
            actions={<>{anchorButton}{renderActions ? renderActions(turn) : null}</>}
          />
        </>
      ) : (
        <>
          {turn.modelChangedFrom && turn.effectiveModel && (
            <div className="txn-modelchange mono">
              {/* the model names without their provider prefix; the arrow is drawn, the sentence reads "to" */}
              model changed: {modelName(turn.modelChangedFrom)} <span aria-hidden="true">→</span><span className="txn-sr"> to</span> {modelName(turn.effectiveModel)}
            </div>
          )}
          {isSub ? (
            <div className="subtask txn-subtask">
              <div className="subtask-head">
                <CornerDownRight size={14} aria-hidden="true" /> <span className="who">{turn.agentName}</span> subagent
              </div>
              <div className={cardClass}>
                {head}
                <div id={bodyId} hidden={!expanded}>{body}</div>
              </div>
              <div className="subtask-foot">
                <span className="elbow">
                  <CornerDownRight size={14} aria-hidden="true" /> returned to <BrandMark name="claude" /> claude
                </span>
              </div>
            </div>
          ) : (
            <div className={cardClass}>
              {head}
              <div id={bodyId} hidden={!expanded}>{body}</div>
            </div>
          )}
        </>
      )}
    </article>
  )
}
