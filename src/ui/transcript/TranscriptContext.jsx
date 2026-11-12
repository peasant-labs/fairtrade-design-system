import { useId } from 'react'
import { ChevronDown, ChevronRight, Link as LinkIcon, History } from 'lucide-react'
import TurnCard from './TurnCard.jsx'
import { UsageScopes } from './UsageDisclosure.jsx'
import { useImageUrl } from './image-url.js'

/**
 * Current-source navigation and retained history use only cooked evidence.
 * No parent fetch occurs when a reader opens an earlier section.
 * @typedef {object} TranscriptContextBaseProps
 * @property {import('./view-model.js').RelationshipVM[]} [relationships]
 * @property {import('./view-model.js').EarlierHistoryVM[]} [earlierHistory]
 * @property {import('./state-capabilities.js').ViewerCallbacks['onNavigateRelationship']} [onNavigate]
 * @property {Record<string, boolean>} open
 * @property {(id: string) => void} toggle
 * @property {Record<string, boolean>} openTools
 * @property {(id: string) => void} toggleTool
 */
/** @param {TranscriptContextBaseProps & import('./image-url.js').ImageUrlProps} props */
export default function TranscriptContext({ relationships = [], earlierHistory = [], onNavigate, open, toggle, openTools, toggleTool, imageUrl, attachmentUrl }) {
  const resolvedImageUrl = useImageUrl(imageUrl, attachmentUrl)
  const prefix = useId()
  if (!relationships.length && !earlierHistory.length) return null
  return <section className="txn-context" aria-label="session context">
    {relationships.map(relation => <div className="txn-context-source" key={relation.kind}>
      <div className="txn-context-row">
        <LinkIcon aria-hidden="true" />
        <span>{relation.label}</span>
        {relation.navigation && onNavigate
          ? <button type="button" className="txn-context-link" aria-label={`open current session: ${relation.label}`} onClick={() => onNavigate(relation.navigation)}>open current session</button>
          : <span className="txn-context-status">{relation.navigation ? 'navigation unavailable' : relation.statusLabel}</span>}
      </div>
      {relation.note && <p className="txn-context-note">{relation.note}</p>}
    </div>)}
    {earlierHistory.map(section => <section className="txn-earlier" key={section.id} data-earlier-section={section.id}>
      <button type="button" className="txn-earlier-toggle" aria-expanded={!!open[section.id]} aria-controls={`${prefix}-history-${section.id}`} onClick={() => toggle(section.id)}>
        {open[section.id] ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        <History aria-hidden="true" /> earlier history <span className="tnum">{section.turns.length}</span>
        <span className="txn-context-status">{section.state.label}</span>
      </button>
      <div id={`${prefix}-history-${section.id}`} hidden={!open[section.id]}>
        <p className="txn-context-note">{section.state.explanation}</p>
        <UsageScopes scopes={section.usageScopes} label="earlier history usage by scope" />
        {open[section.id] && section.turns.map(turn => <TurnCard key={turn.identity} turn={turn} openTools={openTools} toggleTool={toggleTool} imageUrl={resolvedImageUrl} />)}
      </div>
    </section>)}
  </section>
}
