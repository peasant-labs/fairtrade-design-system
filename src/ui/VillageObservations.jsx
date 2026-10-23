import { useState } from 'react'
import Button from './Button.jsx'
import Tabs from './Tabs.jsx'
import Pagination from './Pagination.jsx'

/** Cooked presentation models. Hosts own wire validation, scope, tokens and policy.
 * @typedef {{message:string,retry:string}} ObservationIssue
 * @typedef {{id:string,label:string,result:string,commit?:string,lastCompletedAt?:string,lastAttemptAt?:string,issue?:ObservationIssue}} ObservationDomain
 * @typedef {{id:string,name:string,description?:string,reasons:string[],observedAt?:string,state:string,policy?:string,tracking?:boolean}} ObservedCollective
 * @typedef {{id:string,title:string,description?:string,outcome:string,occurredAt?:string,details?:Array<{label:string,value:string}>}} ContributionEvidenceRow
 * @typedef {{id:string,label:string,rows:ContributionEvidenceRow[],page:number,pageCount:number,total:number,coverage:string,issue?:ObservationIssue,conflict?:boolean,loading?:boolean}} ContributionEvidenceCategory
 * @typedef {Object} VillageObservationsProps
 * @property {string} accountLabel
 * @property {string} villageLabel
 * @property {ObservationDomain[]} domains
 * @property {ObservedCollective[]} collectives
 * @property {ContributionEvidenceCategory[]} categories
 * @property {'catalog'|'history'} [view]
 * @property {string} [categoryId]
 * @property {boolean} [fetching]
 * @property {boolean} [fetchDisabled]
 * @property {string} [status]
 * @property {ObservationIssue} [issue]
 * @property {()=>void} [onFetch]
 * @property {(id:string,tracking:boolean)=>void} [onTrack]
 * @property {(view:'catalog'|'history')=>void} [onViewChange]
 * @property {(id:string)=>void} [onCategoryChange]
 * @property {(id:string,page:number)=>void} [onPageChange]
 * @property {(id:string)=>void} [onRestart]
 */

function ObservationDate({ value }) {
  return value ? <time className="tnum" dateTime={value}>{value}</time> : <>unknown</>
}

function Issue({ issue }) {
  return issue ? <div className="vobs-issue"><p>{issue.message}</p><p>{issue.retry}</p></div> : null
}

/** Metadata-only observation browsing. No effects, storage, routing or network requests.
 * @param {VillageObservationsProps} props
 */
export default function VillageObservations({
  accountLabel, villageLabel, domains, collectives, categories,
  view, categoryId, fetching = false, fetchDisabled = false, status, issue,
  onFetch, onTrack, onViewChange, onCategoryChange, onPageChange, onRestart,
}) {
  const [localView, setLocalView] = useState('catalog')
  const [localCategory, setLocalCategory] = useState(categories[0]?.id)
  const selectedView = view ?? localView
  const selectedCategory = categoryId ?? (categories.some((category) => category.id === localCategory) ? localCategory : categories[0]?.id)
  if (view !== undefined && view !== 'catalog' && view !== 'history') throw new Error('VillageObservations: controlled view must be catalog or history; supply a registered view or omit it for local selection.')
  if (categoryId !== undefined && !categories.some((category) => category.id === categoryId)) throw new Error('VillageObservations: controlled categoryId is not present in categories; supply the selected category or clear the controlled selection when changing scope.')
  const metadata = <>
    <p>Observations do not grant current permission. Earlier details remain dated evidence.</p>
    <div role="status" className="vobs-status">{status ?? (fetching ? 'fetching metadata' : '')}</div>
    <Issue issue={issue} />
    <dl className="vobs-domains">{domains.map((domain) => <div key={domain.id} data-domain={domain.id}>
      <dt>{domain.label}</dt><dd><p>{domain.result}{domain.commit ? `; ${domain.commit}` : ''}</p>
        <p>last completed: <ObservationDate value={domain.lastCompletedAt} /></p>
        <p>last attempt: <ObservationDate value={domain.lastAttemptAt} /></p><Issue issue={domain.issue} /></dd>
    </div>)}</dl>
  </>
  const catalog = <div className="vobs-catalog">
    {selectedView === 'catalog' && metadata}
    <p>Relevant collectives only. Tracking does not join a collective or grant access.</p>
    {collectives.length === 0 ? <p>No saved relevant collectives. Fetch metadata to check available sources.</p> :
      <ul className="vobs-list">{collectives.map((row) => <li key={row.id}>
        <div className="vobs-row-head"><strong>{row.name}</strong>{onTrack && typeof row.tracking === 'boolean' ?
          <Button onClick={() => onTrack(row.id, !row.tracking)}>{row.tracking ? 'untrack' : 'track'}<span className="sr-only"> {row.name}</span></Button> : null}</div>
        {row.description && <p>{row.description}</p>}
        <dl className="vobs-facts">
          <div><dt>evidence</dt><dd>{row.state}</dd></div>
          <div><dt>relevance</dt><dd>{row.reasons.join(', ') || 'no current relevance'}</dd></div>
          {row.policy && <div><dt>observed policy</dt><dd>{row.policy}</dd></div>}
          <div><dt>observed at</dt><dd><ObservationDate value={row.observedAt} /></dd></div>
        </dl>
      </li>)}</ul>}
  </div>
  const history = <div className="vobs-history">
    {categories.length ? <Tabs aria-label="history categories" value={selectedCategory} onChange={(id) => { setLocalCategory(id); onCategoryChange?.(id) }} tabs={categories.map((category) => ({
      id: category.id, label: category.label,
      content: <div aria-busy={category.loading || undefined}>
        {selectedView === 'history' && selectedCategory === category.id && metadata}
        <p>Saved evidence is dated. A confirmed receipt does not mean collective approval. Unknown coverage is not an empty history.</p>
        <p className="vobs-summary"><span className="tnum">{category.total}</span> saved items; coverage: {category.coverage}</p>
        <Issue issue={category.issue} />
        {category.conflict ? <Button disabled={!onRestart} onClick={() => onRestart?.(category.id)}>restart this category</Button> : <>
          {category.rows.length ? <ul className="vobs-list">{category.rows.map((row) => <li key={row.id} data-evidence-id={row.id}>
            <strong>{row.title}</strong><p>{row.outcome}</p>{row.description && <p>{row.description}</p>}
            <dl className="vobs-facts"><div><dt>recorded at</dt><dd><ObservationDate value={row.occurredAt} /></dd></div>
              {row.details?.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}
            </dl>
          </li>)}</ul> : <p>No saved items on this page.</p>}
          <div className="vobs-pager" inert={category.loading || !onPageChange ? true : undefined}>
            <Pagination label={`${category.label} pages`} page={category.page} total={category.pageCount} onChange={(page) => onPageChange?.(category.id, page)} />
          </div>
        </>}
      </div>,
    }))} /> : <p>No saved contribution evidence. Fetch metadata to check available history.</p>}
  </div>
  return <section className="vobs" aria-label="online observations">
    <header className="vobs-header"><div><h2>online</h2><p className="vobs-scope">{villageLabel}<br />{accountLabel}</p></div>
      <Button variant="primary" onClick={onFetch} disabled={fetchDisabled || fetching || !onFetch} loading={fetching}>fetch metadata</Button>
    </header>
    <Tabs aria-label="online views" value={view ?? localView} onChange={(id) => { const next = id === 'history' ? 'history' : 'catalog'; setLocalView(next); onViewChange?.(next) }} tabs={[
      { id: 'catalog', label: 'catalog', content: catalog },
      { id: 'history', label: 'history', content: history },
    ]} />
  </section>
}
