import YAML from 'yaml'
import source from '../../scripts/testdata/village-observations.yaml?raw'
import VillageObservations from './VillageObservations.jsx'
import { frame } from './story-frame.jsx'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'

const fixture = YAML.parse(source, { merge: true })
export default { title: 'in use/Village observations', component: VillageObservations, decorators: frame('wide') }
export const IndependentResults = {
  args: fixture.base,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: 'history', exact: true }))
    await expect(canvas.getByText('Historical Collective')).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'confirmed receipts' }))
    await expect(canvas.getByText('submitted; approval not confirmed')).toBeVisible()
  },
}
export const NeverFetched = { args: fixture.cases.find((row) => row.name === 'never-fetched').props }
export const HiddenEvidence = { args: fixture.cases.find((row) => row.name === 'hidden-dated-evidence').props }
export const LongContent = { args: fixture.cases.find((row) => row.name === 'long-content').props }
export const PagingConflict = { args: fixture.cases.find((row) => row.name === 'selected-page-conflict').props }

function ContractHost({ caseName }) {
  const controlled = fixture.controlledCases.find((row)=>row.name===caseName)
  const activation = fixture.activationCases.find((row)=>row.name===caseName)
  const fetchCase = fixture.fetchCases.find((row)=>row.name===caseName)
  const [calls, setCalls] = useState([])
  const [pending, setPending] = useState(null)
  const [data, setData] = useState(()=>({...fixture.base, view:'history',
    ...(controlled ? {[controlled.control]:controlled.initial} : {}),
    categories:fixture.base.categories.map((category)=>({...category, loading:activation?.loading, page:caseName===fixture.update.name ? fixture.update.beforePages[category.id] : category.page})),
    ...(caseName===fixture.update.name ? {categoryId:fixture.update.selected} : {}),
  }))
  const record = (kind, ...args) => setCalls((previous)=>[...previous,[kind,...args]])
  const change = (kind, id) => { record(kind,id); setPending(kind==='view' ? {view:id} : {categoryId:id}) }
  return <>
    <output aria-label="host callbacks">{JSON.stringify(calls)}</output>
    <button onClick={()=>{setData((previous)=>({...previous,...pending}));setPending(null)}}>apply host selection</button>
    <button onClick={()=>setData((previous)=>({...previous,domains:fixture.update.domains,categories:fixture.update.order.map((id)=>id==='operation-diagnostics' ? fixture.update.diagnostic : previous.categories.find((category)=>category.id===id))}))}>apply evidence update</button>
    <VillageObservations {...data} onViewChange={(id)=>change('view',id)} onCategoryChange={(id)=>change('category',id)}
      onFetch={fetchCase?.handler===false ? undefined : ()=>record('fetch')} fetching={fetchCase?.fetching} fetchDisabled={fetchCase?.disabled}
      onPageChange={activation?.handler===false ? undefined : (id,page)=>record('page',id,page)} onRestart={(id)=>record('restart',id)} />
  </>
}
export const HostContract = { args:{caseName:'controlled-view-host-rerender'}, render:(args)=><ContractHost key={args.caseName} {...args} /> }
