import { useState } from 'react'
import YAML from 'yaml'
import source from '../../../scripts/testdata/village-observations.yaml?raw'
import VillageObservations from '../../ui/VillageObservations.jsx'

const fixture = YAML.parse(source, { merge: true })

export default function LocalVillage() {
  const scenario = new URLSearchParams(window.location.search).get('observations')
  const initial = scenario === fixture.scroll.name ? {...fixture.base, view:'history', categories:fixture.base.categories.map((category)=>({...category, rows:Array.from({length:fixture.scroll.rows}, (_,index)=>({...category.rows[0], id:`${category.id}-long-${index}`, title:`${category.label} retained evidence ${index + 1}`}))}))} : fixture.cases.find((row) => row.name === scenario)?.props ?? fixture.base
  const [data, setData] = useState(initial)
  const [status, setStatus] = useState(initial.status)
  const fetch = () => {
    setData((previous) => ({ ...previous, domains: fixture.update.domains,
      categories: fixture.update.order.map((id) => id === 'operation-diagnostics' ? fixture.update.diagnostic : previous.categories.find((category) => category.id === id)).filter(Boolean),
      collectives: previous.collectives.map((row) => row.id === 'platform' ? { ...row, name: 'Acme Platform Tools' } : row) }))
    setStatus('partial fetch: catalog updated; history retained; some associations retained')
  }
  const page = (id, next) => setData((previous) => ({ ...previous, categories: previous.categories.map((category) => category.id === id ? {
    ...category, page: next,
    rows: category.rows.map((row) => ({ ...row, id: `${id}-${next}`, title: `${category.label} saved item ${next}` })),
  } : category) }))
  const track = (id, tracking) => {
    setData((previous) => ({ ...previous, collectives: previous.collectives.map((row) => row.id === id ? {
      ...row, tracking,
      reasons: [...row.reasons.filter((reason) => reason !== 'explicit tracking'), ...(tracking ? ['explicit tracking'] : [])],
    } : row) }))
    setStatus(tracking ? 'tracking selected; no membership or publication changed' : 'tracking removed; dated observations retained')
  }
  const restart = (id) => setData((previous) => ({ ...previous, categories: previous.categories.map((category) => category.id === id ? {
    ...category, page: 1, conflict: false, issue: undefined,
    rows: fixture.base.categories.find((saved) => saved.id === id)?.rows ?? [],
  } : category) }))
  return <VillageObservations {...data} status={status} onFetch={fetch}
    onTrack={track} onPageChange={page} onRestart={restart}
    onViewChange={(view) => setData((previous) => ({ ...previous, view }))}
    onCategoryChange={(categoryId) => setData((previous) => ({ ...previous, categoryId }))} />
}
