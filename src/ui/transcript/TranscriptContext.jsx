import { ChevronDown, ChevronRight, Link as LinkIcon, History } from 'lucide-react'
import TurnCard from './TurnCard.jsx'
import { UsageScopes } from './UsageDisclosure.jsx'

/**
 * Current-source navigation and retained history use only cooked evidence.
 * No parent fetch occurs when a reader opens an earlier section.
 * @param {object} props
 * @param {import('./view-model.js').RelationshipVM[]} [props.relationships]
 * @param {import('./view-model.js').EarlierHistoryVM[]} [props.earlierHistory]
 * @param {import('./state-capabilities.js').ViewerCallbacks['onNavigateRelationship']} [props.onNavigate]
 * @param {Record<string, boolean>} props.open
 * @param {(id: string) => void} props.toggle
 * @param {Record<string, boolean>} props.openTools
 * @param {(id: string) => void} props.toggleTool
 */
export default function TranscriptContext({ relationships = [], earlierHistory = [], onNavigate, open, toggle, openTools, toggleTool }) {
  if (!relationships.length && !earlierHistory.length) return null
  return <section className="txn-context" aria-label="session context">
    {relationships.map(relation => <div className="txn-context-source" key={relation.kind}>
      <div className="txn-context-row">
        <LinkIcon aria-hidden="true" />
        <span>{relation.label}</span>
        {relation.navigation && onNavigate
          ? <button type="button" className="txn-context-link" onClick={() => onNavigate(relation.navigation)}>open current session</button>
          : <span className="txn-context-status">{relation.navigation ? 'navigation unavailable' : relation.statusLabel}</span>}
      </div>
      {relation.note && <p className="txn-context-note">{relation.note}</p>}
    </div>)}
    {earlierHistory.map(section => <section className="txn-earlier" key={section.id} data-earlier-section={section.id}>
      <button type="button" className="txn-earlier-toggle" aria-expanded={!!open[section.id]} aria-controls={`history-${section.id}`} onClick={() => toggle(section.id)}>
        {open[section.id] ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        <History aria-hidden="true" /> earlier history <span className="tnum">{section.turns.length}</span>
        <span className="txn-context-status">uncertain ownership</span>
      </button>
      <div id={`history-${section.id}`} hidden={!open[section.id]}>
        <p className="txn-context-note">{section.explanation}</p>
        <UsageScopes scopes={section.usageScopes} />
        {open[section.id] && section.turns.map(turn => <TurnCard key={turn.identity} turn={turn} openTools={openTools} toggleTool={toggleTool} />)}
      </div>
    </section>)}
  </section>
}
