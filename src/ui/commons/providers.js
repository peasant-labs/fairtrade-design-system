// @ts-check

/* Leaf module — depends on nothing else in commons/, so both Manage.jsx (the shipped component)
   and mockups/inuse/CommonsManage.jsx (the demo) can import from here without creating an ESM
   cycle between those two files (Manage.jsx already re-exports the demo's views FROM
   CommonsManage.jsx at its bottom; CommonsManage.jsx importing back from Manage.jsx would close
   that into a real cycle -- order-fragile across downstream bundlers even when it happens to work
   today via definition-order + call-at-render-time). Single source of truth for provider display
   formatting; extracted out from Manage.jsx so both consumers point at the same leaf instead of
   one re-deriving it from the other. */

import { PROVIDER_DISPLAY_NAMES, providerDisplayName } from '../provider-policy.js'

/* Compatibility export for callers that previously read the commons table. The
   object is the schema-backed policy itself, not a second registry. */
export const PROVIDER_LABEL = PROVIDER_DISPLAY_NAMES

/** Format explicitly non-Harness prose. Never use this as a Harness fallback.
 * @param {unknown} provider
 */
export function formatProvider(provider) {
  return String(provider || 'unknown')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

/** @param {import('@peasant-labs/schema').Harness} provider */
export function providerLabel(provider) {
  return providerDisplayName(provider)
}
