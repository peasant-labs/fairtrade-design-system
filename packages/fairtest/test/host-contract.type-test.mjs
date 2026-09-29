// @ts-check

// Type-level pins for the shared host-contract vocabulary and the resolution
// union. Each `@ts-expect-error` line is a deliberate negative pin: if the
// wrong literal or property starts compiling, the directive becomes unused and
// the type program reports TS2578, so the pin fails closed. No runtime
// assertions live here; the contract's behaviour is covered by
// host-contract.test.mjs and the app-side type-test pins the builders.

import { validateResolution } from '../src/host-contract/index.mjs'

/** @type {import('../src/host-contract/kinds.mjs').HostKind} */
export const productKind = 'product'

/** @type {import('../src/host-contract/kinds.mjs').HostKind} */
export let wrongKind

// @ts-expect-error a wrong host kind must fail to compile
wrongKind = 'widget'

/** @type {import('../src/host-contract/kinds.mjs').ThemeName} */
export const darkTheme = 'dark'

/** @type {import('../src/host-contract/kinds.mjs').ThemeName} */
export let wrongTheme

// @ts-expect-error a wrong theme name must fail to compile
wrongTheme = 'dusk'

/** @type {import('../src/host-contract/targets.mjs').ProductCapability} */
export const chromeCapability = 'observe-chrome'

/** @type {import('../src/host-contract/targets.mjs').ProductCapability} */
export let wrongCapability

// @ts-expect-error a capability outside the product vocabulary must fail to compile
wrongCapability = 'observe-screenshot'

/** @type {import('../src/host-contract/targets.mjs').TargetValue} */
export const targetValue = { kind: 'product', id: 'fairtrade-graph-product', capabilities: ['observe-chrome'], fixtures: ['product-theme-rows'], actions: [] }

/** @type {import('../src/host-contract/targets.mjs').TargetValue} */
export let wrongTargetValue

// @ts-expect-error a target value must declare a host kind
wrongTargetValue = { kind: 'widget', id: 'fairtrade-graph-product', capabilities: [], fixtures: ['product-theme-rows'], actions: [] }

/** @type {import('../src/host-contract/resolution.mjs').ProductResolution | import('../src/host-contract/resolution.mjs').ComponentResolution} */
export const resolution = validateResolution({}, 'type-test')

// The per-member literal kind makes the union discriminate: a product branch
// exposes chrome, a component branch exposes root, and the other side's fields
// are absent rather than widened to string.
if (resolution.kind === 'product') {
  /** @type {import('../src/host-contract/resolution.mjs').ObservedPart} */
  const chrome = resolution.chrome
  // @ts-expect-error a product resolution has no mounted root
  const root = resolution.root
} else {
  /** @type {import('../src/host-contract/resolution.mjs').MountedRoot} */
  const root = resolution.root
  // @ts-expect-error a component resolution has no product chrome
  const chrome = resolution.chrome
}
