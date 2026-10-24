import { ShareCard, SHARE_CARD_WIDTH } from './ShareCard.jsx'

/* ShareCard stories. The card is the image a link preview shows for a village transcript; village
   draws it with satori on the server and a page can draw it in the DOM, as here. It is dark only
   (an image has one theme), so the theme toolbar does not change it. Each story shows the card
   at its full 1200 width and scaled to 318px, about the width X gives it on a phone timeline.
   The card data is what shareCardFromPayload returns for a session. */

const PUBLIC = {
  title: 'rewrite billing retries',
  harness: 'claude-code',
  brand: 'claude',
  chip: 'Claude Code (Opus 5.5)',
  firstPrompt: 'hey claude, run our billing retry suite against each model with the same seed, then write a table of pass rates and median latency per model',
  figures: { prompts: 6, tokens: 84000 },
}

const PHONE_W = 318

function Scaled({ card, height = 600 }) {
  const scale = PHONE_W / SHARE_CARD_WIDTH
  return (
    <div style={{ width: PHONE_W, height: height * scale, overflow: 'hidden' }}>
      <div style={{ width: SHARE_CARD_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <ShareCard card={card} height={height} />
      </div>
    </div>
  )
}

function Sizes({ card }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', alignItems: 'flex-start' }}>
      <ShareCard card={card} height={600} />
      <Scaled card={card} />
    </div>
  )
}

const meta = {
  title: 'in use/ShareCard',
  component: ShareCard,
  parameters: { layout: 'padded' },
}

export default meta

/** A public transcript: both figures, the chip with its brand mark, the first prompt cut to three lines. */
export const Public = {
  render: () => <Sizes card={PUBLIC} />,
}

/** A transcript without both figures: the stats column is dropped and the prompt takes the full width. */
export const NoFigures = {
  render: () => <Sizes card={{ ...PUBLIC, figures: null }} />,
}

/** A transcript that is not public: the generic card, which names nothing about it. */
export const Generic = {
  render: () => <Sizes card={null} />,
}

/** The 1200 x 630 size every platform but X uses: the same card with more background above and below. */
export const Public630 = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', alignItems: 'flex-start' }}>
      <ShareCard card={PUBLIC} height={630} />
      <Scaled card={PUBLIC} height={630} />
    </div>
  ),
}
