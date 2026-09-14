import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import YAML from 'yaml'
import fixtureText from '../../../scripts/testdata/transcript_provenance_retention.yaml?raw'
import { buildContextFixture } from './context-fixture.js'
import { adaptTranscript } from '../../ui/transcript/adapter.js'
import TranscriptViewer from '../../ui/transcript/TranscriptViewer.jsx'

const fixture = YAML.parse(fixtureText)
const capabilities = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }

// A small host example of current-target navigation. The durable child fixture is
// never rewritten, and Back restores the reading state kept by this host.
export default function ContextTranscriptDemo({ theme }) {
  const params = new URLSearchParams(window.location.search)
  const [target, setTarget] = useState(params.get('contextTarget'))
  const [earlierOpen, setEarlierOpen] = useState({})
  const [openTools, setOpenTools] = useState({})
  const [search, setSearch] = useState('')
  const saved = useRef(new Map())
  const name = params.get('contextCase') ?? 'native-text-thinking-pair'
  const partition = params.get('contextPartition') ?? 'both'
  const navigationCase = fixture.navigationCases.find(item => item.name === params.get('contextNavigation'))
  const vm = useMemo(() => {
    const payload = buildContextFixture(fixture, name, partition)
    let navigation = structuredClone(fixture.navigation)
    if (navigationCase?.sameTarget) {
      payload.relationships[1].targetLocalId = payload.relationships[0].targetLocalId
      navigation[1].localId = navigation[0].localId
    }
    if (navigationCase?.revision) navigation[0].anchor.sourceRevisionRef = navigationCase.revision
    if (navigationCase?.status) navigation = navigation.map(item => ({ kind: item.kind, status: navigationCase.status }))
    if (navigationCase?.conflict) payload.relationships = payload.relationships.map(item => ({ kind: item.kind, targetState: 'conflicting_current_native_evidence', evidence: 'conflict' }))
    if (navigationCase?.omit) navigation = undefined
    const countCase = fixture.countCases.find(item => item.name === params.get('contextCount'))
    if (countCase?.absent) delete payload.inputSubmissionCount
    else if (countCase) payload.inputSubmissionCount = countCase.value
    if (target) {
      const source = fixture.sources[target]
      if (!source) throw new Error('Unknown current-source demo target; return to the child and use an authorized source control.')
      payload.id = target
      payload.turns = [{ ...fixture.turnDefaults, index: 0, depth: 0, role: 'assistant', content: source.content }]
      if (source.boundary) {
        payload.turns[0].index = 1
        payload.turns.unshift({ ...fixture.turnDefaults, index: 0, depth: 0, role: 'assistant', sourceEntryRef: source.entryRef, content: source.boundary })
      }
      payload.turnCount = payload.turns.length
      payload.toolCallCount = 0
      delete payload.earlierHistory
      delete payload.relationships
      delete payload.nativeMetadata
      delete payload.inputSubmissionCount
      const model = adaptTranscript(payload)
      model.session.title = source.title
      return model
    }
    return adaptTranscript(payload, undefined, undefined, { relationshipNavigation: navigation })
  }, [target, name, partition, navigationCase])

  useEffect(() => {
    const back = () => setTarget(new URLSearchParams(window.location.search).get('contextTarget'))
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [])

  useLayoutEffect(() => {
    const state = saved.current.get(target ?? 'child')
    setEarlierOpen(state?.earlierOpen ?? {})
    setOpenTools(state?.openTools ?? {})
    setSearch(state?.search ?? '')
    const frame = requestAnimationFrame(() => {
      const scroller = document.querySelector('.txn-stream')
      if (scroller) scroller.scrollTop = state?.scrollTop ?? 0
    })
    return () => cancelAnimationFrame(frame)
  }, [target])

  function navigate(navigation) {
    saved.current.set(target ?? 'child', { earlierOpen, openTools, search, scrollTop: document.querySelector('.txn-stream')?.scrollTop ?? 0 })
    const nextTarget = navigation.localId
    const url = new URL(window.location.href)
    url.searchParams.set('contextTarget', nextTarget)
    const source = fixture.sources[nextTarget]
    if (navigation.anchor?.sourceEntryRef === source?.entryRef && navigation.anchor?.sourceRevisionRef === source?.revisionRef && navigation.anchor) url.hash = 'turn-0'
    window.history.pushState(null, '', url)
    setTarget(nextTarget)
  }

  return <TranscriptViewer key={vm.session.id} viewModel={vm} capabilities={capabilities} theme={theme}
    initialPosition={saved.current.has(target ?? 'child') ? null : target && window.location.hash === '#turn-0' ? { kind: 'turn', turnIndex: 0 } : { kind: 'top' }}
    earlierHistoryOpen={earlierOpen} onEarlierHistoryOpenChange={setEarlierOpen}
    openTools={openTools} onOpenToolsChange={setOpenTools} search={search} onSearchChange={setSearch}
    callbacks={{ onNavigateRelationship: navigate }} />
}
