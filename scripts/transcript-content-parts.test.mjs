#!/usr/bin/env node
/* Gate for ordered turn content parts: the adapter's decode of the producer's text/image blocks,
   their source order, the `content` fallback for a payload without parts, and the alt text an
   image carries.

   The regression this locks down: an image-bearing prompt used to be a turn with empty text, so
   the legacy prefilter dropped it and nothing rendered. Now every block keeps its order, an
   image-only turn survives, and a part the contract does not render is dropped rather than
   guessed at. The rendered order is asserted on the REAL TurnCard through vite, not on a copy.
   Cases: scripts/testdata/content-parts.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-content-parts */
import { assertFields, loadFixturePair, withMountedSource, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/content-parts.yaml'
const MANIFEST = 'scripts/testdata/content-parts.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames', resolverCases: 'requiredResolverCaseNames' })

const report = createReport('transcript content parts')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ATTACHMENT_URL = 'data:image/png;base64,iVBORw0KGgo='
const IMAGE_URL = 'data:image/png;base64,aW1hZ2U='
const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }

const payloadOf = (row) => ({
  id: 'content-parts',
  harness: row.harness ?? 'claude-code',
  turns: [{
    index: 0,
    role: 'user',
    content: row.content ?? '',
    depth: 0,
    ...(row.contentParts ? { contentParts: row.contentParts } : {}),
  }],
})

await withMountedSource(async ({ load, mount, React }) => {
  const { adaptTranscript, prefilterTurns } = await load('/src/ui/transcript/adapter.js')
  const { imageAltText } = await load('/src/ui/transcript/image-parts.js')
  const { default: TurnCard } = await load('/src/ui/transcript/TurnCard.jsx')
  const { default: TranscriptImageAttachment } = await load('/src/ui/transcript/ImageAttachment.jsx')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')

  for (const row of fixture.cases) {
    if (row.kind === 'decode') {
      const cooked = adaptTranscript(payloadOf(row)).turns[0]
      report.check(same(cooked.contentParts ?? [], row.expected), `${row.name}: expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(cooked.contentParts ?? [])}`)
      report.check(cooked.displayContent === row.displayContent, `${row.name}: the shown text must be ${JSON.stringify(row.displayContent)}, received ${JSON.stringify(cooked.displayContent)}`)
      if (row.retained) {
        const kept = prefilterTurns(payloadOf(row).turns)
        report.check(kept.length === 1, `${row.name}: the prefilter must keep an image-bearing turn even with no text`)
      }
    } else if (row.kind === 'fallback') {
      const cooked = adaptTranscript(payloadOf(row)).turns[0]
      report.check(cooked.contentParts === undefined, `${row.name}: a turn without parts must carry no cooked parts`)
      report.check(cooked.content === row.expectedContent, `${row.name}: the text fallback must stay the recorded content, received ${JSON.stringify(cooked.content)}`)
    } else if (row.kind === 'alt') {
      const actual = imageAltText(row.image, row.position, row.total)
      report.check(actual === row.expected, `${row.name}: expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
    } else if (row.kind === 'order') {
      const cooked = adaptTranscript(payloadOf(row)).turns[0]
      report.check((cooked.contentParts ?? []).map((part) => part.type).join(',') === row.expected.join(','), `${row.name}: the cooked parts must keep the recorded order`)
      const mounted = await mount(React.createElement(TurnCard, {
        turn: cooked,
        presentation: 'classic',
        imageUrl: () => IMAGE_URL,
      }))
      /* the body's direct children in order: a Markdown block for each text part and a figure
         for each image part. Read the rendered sequence, not the model. */
      /* the card holds the head and then the body; the body's children are the ordered parts */
      const card = mounted.container.querySelector('#turn-0 .txn-turn')
      const body = card?.lastElementChild
      const rendered = [...(body?.children ?? [])]
        .map((node) => (node.matches('.txn-image') ? 'image' : node.textContent.trim() !== '' ? 'text' : null))
        .filter(Boolean)
      report.check(same(rendered, row.expected), `${row.name}: the rendered body must follow the recorded order; expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(rendered)}`)
      await mounted.unmount()
    } else {
      throw new Error(`${FIXTURE}: unknown case kind ${row.kind}`)
    }
  }

  const viewModel = adaptTranscript(payloadOf(fixture.resolverInput))
  const turn = viewModel.turns[0]
  const imagePart = turn.contentParts[0]
  const ref = imagePart.image.ref
  const originalWarn = console.warn
  const originalFetch = globalThis.fetch
  const originalNodeEnv = process.env.NODE_ENV
  try {
    for (const row of fixture.resolverCases) {
      assertFields(row, ['name', 'component', 'imageUrl', 'attachmentUrl', 'expected', 'warnings'], `${FIXTURE} ${row.name}`, ['environment', 'imagePropNull', 'imageResult'])
      if (!['image', 'attachment', 'unavailable'].includes(row.expected)) throw new Error(`${FIXTURE}: unknown resolver expectation ${row.expected}`)
      process.env.NODE_ENV = row.environment ?? 'development'
      const calls = { image: [], attachment: [] }
      const warnings = []
      let fetches = 0
      console.warn = (...args) => warnings.push(args.map(String).join(' '))
      globalThis.fetch = (...args) => { fetches++; throw new Error(`${row.name}: unexpected fetch ${args[0]}`) }
      const resolveImage = value => {
        calls.image.push(value)
        if (row.imageResult === 'undefined') return undefined
        return 'imageResult' in row ? row.imageResult : IMAGE_URL
      }
      const props = {
        ...(row.imageUrl ? { imageUrl: resolveImage } : row.imagePropNull ? { imageUrl: null } : {}),
        ...(row.attachmentUrl ? { attachmentUrl: value => { calls.attachment.push(value); return ATTACHMENT_URL } } : {}),
      }
      let element
      if (row.component === 'viewer') element = React.createElement(TranscriptViewer, { viewModel, capabilities: CAPABILITIES, ...props })
      else if (row.component === 'turn') element = React.createElement(TurnCard, { turn, ...props })
      else if (row.component === 'image') element = React.createElement(TranscriptImageAttachment, { part: imagePart, ...props })
      else throw new Error(`${FIXTURE}: unknown resolver component ${row.component}`)
      const mounted = await mount(element)
      try {
        // A repeated render must not repeat the conflict warning or switch resolvers.
        await mounted.rerender(React.cloneElement(element))
        const img = mounted.container.querySelector('.txn-image-thumb')
        const expectedURL = row.expected === 'image' ? IMAGE_URL : row.expected === 'attachment' ? ATTACHMENT_URL : null
        report.check((img?.getAttribute('src') ?? null) === expectedURL, `${row.name}: expected img src ${JSON.stringify(expectedURL)}, received ${JSON.stringify(img?.getAttribute('src') ?? null)}`)
        report.check(expectedURL !== null || !!mounted.container.querySelector('[data-image-omitted="unavailable"]'), `${row.name}: an unresolved image must show the unavailable placeholder`)
        report.check(row.imageUrl ? calls.image.length > 0 && calls.image.every(value => value === ref) : calls.image.length === 0, `${row.name}: imageUrl must receive only the recorded ref`)
        report.check(row.attachmentUrl && !row.imageUrl ? calls.attachment.length > 0 && calls.attachment.every(value => value === ref) : calls.attachment.length === 0, `${row.name}: attachmentUrl must be called only as the fallback`)
        report.check(fetches === 0, `${row.name}: the viewer must not fetch image bytes itself`)
        report.check(warnings.length === row.warnings, `${row.name}: expected ${row.warnings} conflict warnings, received ${warnings.length}`)
        if (row.warnings) report.check(!!warnings[0]?.includes('imageUrl') && warnings[0].includes('attachmentUrl'), `${row.name}: the warning must name both props`)
      } finally {
        await mounted.unmount()
      }
    }
  } finally {
    console.warn = originalWarn
    globalThis.fetch = originalFetch
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
  }
})

report.finish(`${fixture.cases.length} content-part cases and ${fixture.resolverCases.length} resolver cases.`)
