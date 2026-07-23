/* GraphTurnNode — the trajectory-graph turn card VISUAL (presentation-only).

   This is the aesthetic half of the graph split: fairtrade owns every graph
   AESTHETIC, transcript-browser owns the @xyflow ENGINE. The component renders a
   single turn as a compact card; it knows NOTHING about @xyflow, topology,
   layout, handles, pan/zoom or selection wiring — the transcript-browser engine host
   node) wraps this card with its own <Handle>s and feeds it cooked props.

   Props are a flat, engine-agnostic projection of the cooked TurnVM plus
   the engine's per-node display state (search/filter/selection + annotation
   flags). The projection — i.e. the seam contract — is:

     GraphTurnNodeProps  ⇐  TurnVM + engine state
       role          ⇐  TurnVM.role
       agentName?    ⇐  TurnVM.agentName        (present ⇒ render as a subagent)
       turnNumber    ⇐  TurnVM.label / index+1
       contentPreview⇐  one-line, pre-truncated TurnVM.content (caller truncates;
                        this component NEVER parses or truncates content itself)
       toolCount     ⇐  TurnVM.toolCalls.length
       totalTokens   ⇐  TurnVM.tokens.in + .out
       tokensIn/Out? ⇐  TurnVM.tokens.{in,out}
       hasError/Retry/Revert ⇐ derived from TurnVM.annotations (engine/analytics)
       isSearchMatch/isFilteredOut/isSelected ⇐ engine display state
       provider?     ⇐  the assistant's harness key (drives the accent colour)

   Role accents (a scarce left rule, the only hue on the card): you = teal,
   subagent = mauve, assistant = its provider accent (amber only when absent), error =
   clay (overrides). Everything else reads by ink weight + mono chrome, radius 0,
   hairline borders — the house style. */

import { providerAccent } from '../../provider-policy.js'

/**
 * @typedef {import('../wire-types.js').Role} Role
 */

/**
 * Cooked, engine-agnostic props for one trajectory-graph turn card. Every field
 * is a finished display value — the component does no parsing, truncation, or
 * data derivation beyond choosing the accent token and chrome label.
 *
 * @typedef {object} GraphTurnNodeProps
 * @property {Role} role                       canonical role; selects the chrome label + base accent
 * @property {string} [agentName]              subagent name; PRESENT ⇒ render as a subagent (mauve)
 * @property {string | number} turnNumber      the display number shown as "#…"
 * @property {string} contentPreview           one-line, already-truncated preview (may be empty)
 * @property {number} toolCount                tool-call count for the footer ("N tools")
 * @property {number} totalTokens              total tokens for the footer badge
 * @property {number} [tokensIn]               optional split, surfaced via title for hover detail
 * @property {number} [tokensOut]
 * @property {boolean} [hasError]              clay accent + error flag (highest-priority flag)
 * @property {boolean} [hasRetry]              "retry" flag (when not an error)
 * @property {boolean} [hasRevert]             "re-edit" flag (when not an error or retry)
 * @property {boolean} [isSearchMatch]         engine: highlighted as a search hit
 * @property {boolean} [isFilteredOut]         engine: dimmed because a filter excludes it
 * @property {boolean} [isSelected]            engine: the active/selected node
 * @property {import('@peasant-labs/schema').Harness} [provider] canonical harness → assistant accent
 * @property {string} [className]              extra classes appended after the base
 */

/** Compact token label, matched to the mockup's `fmtTokens` so the graph footer
 *  reads identically wherever a turn card renders (mockup SVG and transcript-browser @xyflow). */
function fmtTokens(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n)
}

/** The lowercase chrome label for the card head. User content (agent names) is
 *  rendered separately; this is pure chrome so it is always lowercase. */
function chromeRole(role, agentName) {
  if (role === 'user') return 'you'
  if (agentName) return 'subagent'
  if (role === 'assistant') return 'assistant'
  return role
}

/** Resolve the single accent token for the left rule. Error wins; then role;
 *  assistants take their provider accent (amber only when provider is absent). */
function accentToken({ role, agentName, provider, hasError }) {
  if (hasError) return 'clay'
  if (role === 'user') return 'teal'
  if (agentName) return 'mauve'
  if (role === 'assistant') return provider === undefined ? 'amber' : providerAccent(provider)
  return null
}

/**
 * The trajectory-graph turn card visual.
 * @param {GraphTurnNodeProps} props
 * @returns {JSX.Element}
 */
export function GraphTurnNode({
  role,
  agentName,
  turnNumber,
  contentPreview,
  toolCount,
  totalTokens,
  tokensIn,
  tokensOut,
  hasError = false,
  hasRetry = false,
  hasRevert = false,
  isSearchMatch = false,
  isFilteredOut = false,
  isSelected = false,
  provider,
  className = '',
}) {
  const accent = accentToken({ role, agentName, provider, hasError })
  const label = chromeRole(role, agentName)
  const flag = hasError ? 'error' : hasRetry ? 'retry' : hasRevert ? 're-edit' : null
  const tokenTitle =
    tokensIn != null || tokensOut != null
      ? `${tokensIn ?? 0} in · ${tokensOut ?? 0} out`
      : undefined

  const cls = [
    'ft-gnode',
    'ft-gnode-turn',
    accent && 'ft-gnode-accented',
    hasError && 'ft-gnode-error',
    isFilteredOut && 'ft-gnode-dimmed',
    isSearchMatch && 'ft-gnode-match',
    isSelected && 'ft-gnode-selected',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const style = accent ? { '--ft-gnode-accent': `var(--${accent})` } : undefined

  return (
    <div className={cls} style={style} data-role={label} data-turn={turnNumber}>
      <header className="ft-gnode-head">
        <span className="ft-gnode-role">{label}</span>
        {agentName && <span className="ft-gnode-agent">· {agentName}</span>}
        <span className="ft-gnode-num">#{turnNumber}</span>
        {flag && (
          <span className={`ft-gnode-flag ft-gnode-flag-${hasError ? 'err' : 'warn'}`}>{flag}</span>
        )}
      </header>

      {contentPreview && (
        <div className={`ft-gnode-prev${role === 'user' ? ' ft-gnode-prev-user' : ''}`}>
          {contentPreview}
        </div>
      )}

      <footer className="ft-gnode-meta">
        {toolCount > 0 && (
          <span className="ft-gnode-meta-tools">
            {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
          </span>
        )}
        {totalTokens > 0 && (
          <span className="ft-gnode-meta-tokens" title={tokenTitle}>
            {fmtTokens(totalTokens)}
          </span>
        )}
      </footer>
    </div>
  )
}

export default GraphTurnNode
