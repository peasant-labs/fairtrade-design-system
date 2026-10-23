import { TOKEN_FIELDS, COST_FIELDS } from './usage.js'
import { formatCost, formatInteger } from '../format.js'

/* a recorded figure in the shared number format; a field the harness did not report reads unknown */
const shownTokens = (value) => (value == null || value === 'unknown' ? 'unknown' : formatInteger(value))
const shownCost = (value) => (value == null || value === 'unknown' ? 'unknown' : formatCost(value))

/** @param {{usage?: import('@peasant-labs/schema').UsageDetail}} props */
export default function UsageDisclosure({ usage }) {
  if (!usage) return null
  return <details className="txn-usage">
    <summary>{usage.scope} usage: <span className="tnum">{shownTokens(usage.tokens?.totalTokens)}</span> tokens ({usage.completeness}){usage.cost ? ', recorded harness estimate available' : ''}</summary>
    <dl className="txn-usage-fields">
      {Object.entries(TOKEN_FIELDS).map(([key, label]) => <div key={key}><dt>{label}</dt><dd className="tnum">{shownTokens(usage.tokens?.[key])}</dd></div>)}
    </dl>
    <p className="txn-usage-note">recorded harness estimate, not verified billing</p>
    <dl className="txn-usage-fields">
      {Object.entries(COST_FIELDS).map(([key, label]) => <div key={key}><dt>{label} cost</dt><dd className="tnum">{shownCost(usage.cost?.[key])}</dd></div>)}
    </dl>
  </details>
}

/** @param {{scopes?: import('./view-model.js').UsageScopeVM[], label?: string}} props */
export function UsageScopes({ scopes, label = 'session usage by scope' }) {
  if (!scopes?.length) return null
  return <details className="txn-usage txn-usage-scopes">
    <summary>{label}</summary>
    <p className="txn-usage-note">known sums across all recorded owners; partial means some owners did not report the field. costs are recorded harness estimates, not verified billing.</p>
    {scopes.map(scope => <section key={scope.scope}>
      <p className="txn-usage-scope-label">{scope.scope} <span className="tnum">{scope.ownerCount}</span> {scope.ownerCount === 1 ? 'owner' : 'owners'}</p>
      <dl className="txn-usage-fields">{scope.tokens.map(field => <div key={field.label}><dt>{field.label}</dt><dd className="tnum">{shownTokens(field.value)} ({field.completeness})</dd></div>)}</dl>
      <dl className="txn-usage-fields">{scope.cost.map(field => <div key={field.label}><dt>{field.label} cost</dt><dd className="tnum">{shownCost(field.value)} ({field.completeness})</dd></div>)}</dl>
    </section>)}
  </details>
}
