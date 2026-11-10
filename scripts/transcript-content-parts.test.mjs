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
import { loadFixturePair, withMountedSource, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/content-parts.yaml'
const MANIFEST = 'scripts/testdata/content-parts.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })

const report = createReport('transcript content parts')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ATTACHMENT_URL = 'data:image/png;base64,iVBORw0KGgo='

const payloadOf = (row) => ({
  id: 'content-parts',
  harness: 'claude-code',
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

  for (const row of fixture.cases) {
    if (row.kind === 'decode') {
      const cooked = adaptTranscript(payloadOf(row)).turns[0]
      report.check(same(cooked.contentParts ?? [], row.expected), `${row.name}: expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(cooked.contentParts ?? [])}`)
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
        attachmentUrl: () => ATTACHMENT_URL,
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
})

report.finish(`${fixture.cases.length} cases over ordered turn content parts.`)
