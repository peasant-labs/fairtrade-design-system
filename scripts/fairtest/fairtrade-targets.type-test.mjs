// @ts-check

// Type-level pins for the app-owned proof builders. The builders return the
// shared per-kind resolution typedefs (routed through the sole
// scripts/fairtest-source.mjs type route), so a consumer reads the observed
// parts directly instead of an untyped object. The negative pins fail closed:
// if a builder regresses to a plain object, the `@ts-expect-error` directives
// become unused and the type program reports TS2578.

import { buildComponentProof } from './fairtrade-component-target.mjs'
import { buildProductProof } from './fairtrade-targets.mjs'

/** @type {import('../fairtest-source.mjs').ProductResolution} */
export const productProof = buildProductProof({
  rowTheme: 'dark',
  identity: { kind: 'product', id: 'fairtrade-graph-product', createdAtMs: 1000 },
  chrome: { observed: true, observedAtMs: 1 },
  body: { observed: true, observedAtMs: 1 },
  route: { observed: true, observedAtMs: 1 },
  activeSection: { observed: true, observedAtMs: 1 },
  view: { observed: true, observedAtMs: 1 },
  themeObservation: { expected: 'dark', observed: 'dark', source: 'type-test', observedAtMs: 1 },
  initialSection: 'analytics',
  activeSectionId: 'analytics',
})

/** @type {import('../fairtest-source.mjs').ComponentResolution} */
export const componentProof = buildComponentProof({
  rowTheme: 'dark',
  identity: { kind: 'component', id: 'fairtrade-sgd-story', createdAtMs: 1000 },
  root: { mounted: true, observedAtMs: 1 },
  themeObservation: { expected: 'dark', observed: 'dark', source: 'type-test', observedAtMs: 1 },
})

/** @type {import('../fairtest-source.mjs').ProductResolution['chrome']} */
export const productChrome = productProof.chrome

/** @type {import('../fairtest-source.mjs').ComponentResolution['root']} */
export const componentRoot = componentProof.root

// @ts-expect-error a product resolution has no mounted root
export const productRoot = productProof.root

// @ts-expect-error a component resolution has no product chrome
export const componentChrome = componentProof.chrome
