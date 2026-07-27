import './timelinePrimitives.css'
import { INSIGHT_KIND_LABELS, INSIGHT_PROVENANCE_PRESENTATIONS, assertInsightContractValues } from './graphContractPolicy.js'

/* InsightPanel renders SessionInsight[] grouped by kind, with a provenance
   marker (mechanical vs mined glyph) and evidence links back into the
   session. Unknown kind/provenance fail closed (never silently dropped or
   relabeled) per the standing redaction/enum discipline. */

/** @typedef {import('@peasant-labs/schema').InsightKind} InsightKind */
/** @typedef {import('@peasant-labs/schema').InsightProvenance} InsightProvenance */

/**
 * @param {object} props
 * @param {Array<{kind:InsightKind, provenance:InsightProvenance, title:string, summary?:string, evidence:Array<{sessionId:string, file?:string}>, onOpenEvidence?: Function}>} props.insights
 * @param {(sessionId: string) => void} [props.onOpenEvidence]
 * @param {string} [props.className]
 */
export default function InsightPanel({ insights, onOpenEvidence, className = '', ...rest }) {
  assertInsightContractValues(insights)
  if (insights.length === 0) {
    return <p className={`tlp-insight-empty${className ? ` ${className}` : ''}`} {...rest}>no insights recorded for this node yet.</p>
  }
  const groups = new Map()
  for (const insight of insights) {
    const list = groups.get(insight.kind) ?? []
    list.push(insight)
    groups.set(insight.kind, list)
  }
  return (
    <div className={`tlp-insight-panel${className ? ` ${className}` : ''}`} {...rest}>
      {[...groups.entries()].map(([kind, group]) => (
        <section key={kind} className="tlp-insight-group" aria-label={INSIGHT_KIND_LABELS[kind]}>
          <h3 className="tlp-insight-group-title">{INSIGHT_KIND_LABELS[kind]}</h3>
          <ul className="tlp-insight-list">
            {group.map((insight, index) => (
              <li key={index} className="tlp-insight-item">
                <span className={`tlp-insight-provenance ${INSIGHT_PROVENANCE_PRESENTATIONS[insight.provenance].markerClass}`} aria-hidden="true" />
                <span className="tlp-insight-title">{insight.title}</span>
                {insight.summary && <span className="tlp-insight-summary">{insight.summary}</span>}
                <span className="tlp-insight-evidence">
                  {insight.evidence.map((item, evidenceIndex) => (
                    <button
                      key={evidenceIndex}
                      type="button"
                      className="tlp-insight-evidence-link"
                      onClick={() => onOpenEvidence?.(item.sessionId)}
                    >
                      {item.file || item.sessionId}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
