import { useEffect, useRef, useState } from 'react'
import { Copy, Link as LinkIcon } from 'lucide-react'
import { PublishBar, PublishDialog, PUBLISH_DIALOG_STATES, PUBLISH_STATES } from '../../ui'

/* The host side of the publish flow for the in-use transcript demo. It stands in for peasant: it
   owns the state, fakes the sign-in, the scan and the publish with short timers, and hands the
   controlled parts what they show. The parts themselves never advance.

   `?publish=<popup state>` opens the popup in that state and `?bar=<label state>` sets the bar, so
   every state can be reached directly. */

const SCAN = {
  total: 37,
  matches: [
    { id: 'm1', category: 'secrets', confidence: 0.99, before: 'AKIAIOSFODNN7EXAMPLE', after: '<AWS_ACCESS_KEY>' },
    { id: 'm2', category: 'pii', confidence: 0.97, before: 'alice@acme.dev', after: '<EMAIL>' },
    { id: 'm3', category: 'paths', confidence: 0.91, before: '/Users/alice/work/acme/ingest-api', after: '/Users/<USER>/work/acme/ingest-api' },
  ],
}
const SUGGESTED = [
  { id: 'platform', name: 'Acme Platform', members: 12, note: 'suggested · repo acme/ingest-api is linked' },
  { id: 'company', name: 'Acme Company', members: 87, note: 'suggested · github org acme' },
]
const OTHERS = [
  { id: 'ml', name: 'ML Reading Group', members: 21, note: 'curated · waits for the owner’s approval', curated: true },
]
const DONE = { url: 'https://village.peasantlabs.org/transcripts/3f9c0a17', pullRequest: { number: 42, branch: 'fix/flaky-ingest', href: '?app=commons&commons=pull-request#inuse' } }
const MORE_ITEMS = [
  { label: 'copy as markdown', icon: Copy },
  { label: 'copy link', icon: LinkIcon },
]

function initial() {
  const params = new URLSearchParams(window.location.search)
  const popup = params.get('publish')
  const bar = params.get('bar')
  return {
    popup: PUBLISH_DIALOG_STATES.includes(popup) ? popup : null,
    bar: PUBLISH_STATES.includes(bar) ? bar : 'not-published',
  }
}

/** returns the bar for the header row and the popup to render beside the viewer */
export function usePublishFlow() {
  const start = useRef(initial()).current
  const [bar, setBar] = useState(start.bar)
  const [popup, setPopup] = useState(start.popup)
  const [connected, setConnected] = useState(start.popup !== 'connect' && start.popup !== 'waiting-github')
  const [access, setAccess] = useState(SUGGESTED)
  const [query, setQuery] = useState('')
  const [auto, setAuto] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const later = (ms, next) => { clearTimeout(timer.current); timer.current = setTimeout(next, ms) }

  const published = bar === 'published' || bar === 'new-turns' || bar === 'auto-publish'
  const mode = published ? 'update' : 'publish'
  const scan = () => { setPopup('checking'); later(1200, () => setPopup('ready')) }
  const open = () => { if (!connected) setPopup('connect'); else scan() }
  const close = () => { clearTimeout(timer.current); setPopup(null) }
  const publish = () => {
    setPopup('publishing')
    setBar('publishing')
    later(1500, () => {
      const waiting = access.some((item) => item.pending === 'approval')
      setAccess((items) => items.filter((item) => item.pending !== 'removal').map((item) => (item.pending === 'adding' ? { ...item, pending: undefined } : item)))
      setBar('published')
      setPopup(waiting ? 'waits-approval' : 'done')
    })
  }
  const readers = access.filter((item) => item.pending !== 'removal' && item.pending !== 'approval').map((item) => item.name)
  const pending = access.filter((item) => item.pending === 'approval').map((item) => item.name)
  const suggestions = [...SUGGESTED, ...OTHERS]
    .filter((item) => !access.some((entry) => entry.id === item.id))
    .filter((item) => !query.trim() || item.name.toLowerCase().includes(query.trim().toLowerCase()))

  const barNode = (
    <PublishBar
      state={bar}
      collectives={readers.length}
      newTurns={6}
      collective="Acme Platform"
      onAction={open}
      moreItems={MORE_ITEMS}
    />
  )
  const dialogNode = (
    <PublishDialog
      open={popup != null}
      onClose={close}
      title="Port the transcript canvas into the shared package"
      mode={mode}
      state={popup ?? 'ready'}
      scan={SCAN}
      onRescan={scan}
      changes={{ summary: '6 new turns since you published · 1 new match, redacted' }}
      access={access}
      onRemove={(id) => setAccess((items) => (published
        ? items.map((item) => (item.id === id ? { ...item, pending: 'removal' } : item))
        : items.filter((item) => item.id !== id)))}
      onRestore={(id) => setAccess((items) => items.map((item) => (item.id === id ? { ...item, pending: undefined } : item)))}
      picker={{
        suggestions,
        query,
        onQueryChange: setQuery,
        onAdd: (id) => {
          const found = [...SUGGESTED, ...OTHERS].find((item) => item.id === id)
          if (found) setAccess((items) => [...items, { ...found, pending: found.curated ? 'approval' : published ? 'adding' : undefined }])
          setQuery('')
        },
      }}
      autoPublish={{ checked: auto, onChange: setAuto }}
      accessSummary={published ? summarizeChange(access) : undefined}
      onPublish={publish}
      onConnect={() => { setPopup('waiting-github'); later(1500, () => { setConnected(true); scan() }) }}
      joinHref="?app=commons&commons=collectives#inuse"
      stoppedAt="setting who can read it"
      onRetry={publish}
      done={{ ...DONE, collectives: readers, pending }}
    />
  )
  return { bar: barNode, dialog: dialogNode }
}

function summarizeChange(access) {
  const adds = access.filter((item) => item.pending === 'adding' || item.pending === 'approval').map((item) => item.name)
  const removes = access.filter((item) => item.pending === 'removal').map((item) => item.name)
  if (!adds.length && !removes.length) return 'leave access as it is and update just sends the new turns.'
  return `${adds.length ? `adds ${adds.join(', ')}` : 'adds nothing'} · ${removes.length ? `removes ${removes.join(', ')}` : 'removes nothing'}`
}
