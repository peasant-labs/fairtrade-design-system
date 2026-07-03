/* commons sub-barrel — the single import surface for the village commons
   surfaces (Explore, Manage): their cooked prop-payload contracts plus (as they
   land) the lifted surface components.

   Consumed as `@peasant-labs/fairtrade/commons` — a per-surface entry point kept
   separate from `./graph` so a village app importing the commons surfaces never
   bundles the peasant graph surfaces (intra-package bundle isolation). The
   matching stylesheet ships as `@peasant-labs/fairtrade/commons.css`.

   What ships today (the contract seam): the surface payload typedefs + the
   canonical enum-value arrays consumers iterate (the runtime exports below pull
   types.js into the tsc declaration-emit program, so the contract lands in the
   published .d.ts). Lifted surface components are appended here as they are built.

   Mirrors the transcript sub-barrel pattern (src/ui/transcript/index.js). */

/* ── canonical enum-value arrays (runtime) ───────────────────────────────────── */
export {
  TRANSCRIPT_VISIBILITIES,
  ACCEPTANCE_MODES,
  DATA_ACCESS_POLICIES,
  TRANSCRIPT_DELETION_POLICIES,
  COLLECTIVE_ROLES,
} from './types.js'

/* ── enum types (JSDoc re-exports; erased at build) ──────────────────────────────
   The checkJs typedef-re-export pattern has no `export type` syntax in .js files,
   so each type downstream consumers import from the sub-barrel is listed here
   explicitly (same hand-maintained pattern as the transcript sub-barrel). */
/** @typedef {import('./types.js').TranscriptVisibility} TranscriptVisibility */
/** @typedef {import('./types.js').AcceptanceMode} AcceptanceMode */
/** @typedef {import('./types.js').DataAccessPolicy} DataAccessPolicy */
/** @typedef {import('./types.js').TranscriptDeletionPolicy} TranscriptDeletionPolicy */
/** @typedef {import('./types.js').CollectiveRole} CollectiveRole */
/** @typedef {import('./types.js').ViewerRole} ViewerRole */
/** @typedef {import('./types.js').ExploreSurfaceProps} ExploreSurfaceProps */

/* ── Explore surface payloads (JSDoc re-exports; erased at build) ─────────────── */
/** @typedef {import('./types.js').TagPayload} TagPayload */
/** @typedef {import('./types.js').ExploreOwnerPayload} ExploreOwnerPayload */
/** @typedef {import('./types.js').ExploreTranscriptPayload} ExploreTranscriptPayload */
/** @typedef {import('./types.js').ExploreTranscriptListPayload} ExploreTranscriptListPayload */
/** @typedef {import('./types.js').CollectiveResultPayload} CollectiveResultPayload */
/** @typedef {import('./types.js').PopularTagPayload} PopularTagPayload */
/** @typedef {import('./types.js').ExplorePayload} ExplorePayload */

/* ── Manage surface payloads (JSDoc re-exports; erased at build) ──────────────── */
/** @typedef {import('./types.js').CollectiveMemberPayload} CollectiveMemberPayload */
/** @typedef {import('./types.js').CollectiveTranscriptPayload} CollectiveTranscriptPayload */
/** @typedef {import('./types.js').CollectiveStatsPayload} CollectiveStatsPayload */
/** @typedef {import('./types.js').CollectiveModelBreakdownPayload} CollectiveModelBreakdownPayload */
/** @typedef {import('./types.js').CollectiveContributorPayload} CollectiveContributorPayload */
/** @typedef {import('./types.js').CollectivePayload} CollectivePayload */
/** @typedef {import('./types.js').ManagePayload} ManagePayload */

/* ── Explore surface component ─────────────────────────────────────────────── */
export { default as Explore } from './Explore.jsx'
/* Manage surface components. */
export { Manage } from './Manage.jsx'
export { PublishView, CollectivesView, CollectiveDetailView, CollectiveSettingsView, ContributeView } from './Manage.jsx'
