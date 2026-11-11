import assert from 'node:assert/strict'
import { parseTranscriptContentText } from '@peasant-labs/schema'
import { loadStrictYaml, withMountedSource } from './mounted-parts.mjs'

const envelope = loadStrictYaml('scripts/testdata/transcript-published-images.yaml')
const detail = parseTranscriptContentText(JSON.stringify(envelope)).sessionDetail
assert.ok(detail, 'published envelope contains validated detail')

await withMountedSource(async ({ load, mount, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  assert.throws(() => adaptTranscript(detail), /validation/)
  assert.throws(() => adaptTranscript(detail, undefined, undefined, { payloadMode: 'local' }), /validation/)
  assert.throws(() => adaptTranscript(detail, undefined, undefined, { payloadMode: 'typo' }), /payloadMode/)
  const local = structuredClone(detail)
  local.turns[0].contentParts = local.turns[0].contentParts.filter(part => part.type !== 'image')
  assert.deepEqual(adaptTranscript(local), adaptTranscript(local, undefined, undefined, { payloadMode: 'local' }))
  const vm = adaptTranscript(detail, undefined, undefined, { payloadMode: 'published' })
  assert.equal(vm.turns[0].contentParts[1].image.omittedReason, 'not_published')
  assert.equal(vm.turns[0].identity, 'main:entry-image')
  const projected = adaptTranscript(detail, undefined, undefined, { payloadMode: 'published', visibleTurnIndices: [1] })
  assert.deepEqual(projected.turns.map(turn => turn.index), [1])
  let requests = 0
  const mounted = await mount(React.createElement(TranscriptViewer, {
    viewModel: vm,
    capabilities: { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false },
    attachmentUrl: () => { requests++; return '/attachment' },
  }))
  try {
    const card = mounted.container.querySelector('[data-image-omitted="not_published"]')
    assert.ok(card, 'published image omission renders in the viewer')
    assert.match(card.textContent, /image not published/)
    assert.equal(mounted.container.querySelectorAll('.txn-image-thumb').length, 0)
    assert.equal(requests, 0, 'omitted parts never resolve attachment URLs')
  } finally {
    await mounted.unmount()
  }
})
console.log('published transcript images: validated envelope, adaptation, projection and mounted viewer passed')
