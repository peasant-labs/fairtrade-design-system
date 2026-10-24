// @ts-check
/* Type test for the BUILT share entry: what a TypeScript consumer of `@peasant-labs/fairtrade/share`
   sees, resolved through the package's own `exports` to dist/lib/types/share/index.d.ts. The
   JSDoc `import()` type below is the JS spelling of
   `import type { ShareCardData } from '@peasant-labs/fairtrade/share'`.
   Run after pnpm build:lib: pnpm test:share-types. */

/** @typedef {import('@peasant-labs/fairtrade/share').ShareCardData} ShareCardData */
/** @typedef {typeof import('@peasant-labs/fairtrade/share').SHARE_CARD_HEIGHTS} Heights */
/** @typedef {typeof import('@peasant-labs/fairtrade/share').shareCardFromPayload} FromPayload */

/** @type {ShareCardData} */
const card = {
  title: 'rewrite billing retries',
  harness: 'claude-code',
  brand: 'claude',
  chip: 'Claude Code (Opus 5.5)',
  firstPrompt: 'rewrite billing retries',
  figures: { prompts: 6, tokens: 84000 },
}

/** @type {ReturnType<FromPayload>} the data function returns the exported type */
const derived = card

/** the heights are the exact tuple, not number[] */
/** @param {Heights} heights @returns {readonly [600, 630]} */
const exact = (heights) => heights

/** @param {Heights} heights */
function heightsAreReadonly(heights) {
  // @ts-expect-error the heights are readonly
  heights[0] = 600
}

void derived
void exact
void heightsAreReadonly
