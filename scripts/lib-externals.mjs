/* The library build's rollup `external` list — ONE definition, shared by the real
   build (vite.lib.config.js) and by every gate that re-bundles a library entry to
   test a mutant (timeline-a11y, timeline-ghosts, insight-panel).

   Keeping it in one place is load-bearing: a gate that re-bundles an entry with a
   STALE external list does not test the shipped bundle, it tests a different one.
   That already bites hardest for `@xyflow/react`, an OPTIONAL peer dependency —
   bundling it instead of externalizing it pulls its CommonJS internals into an ESM
   mutant and fails with an unrelated `require` error. */

/** @type {readonly string[]} */
export const LIB_EXTERNALS = Object.freeze([
  '@peasant-labs/schema',
  '@tanstack/react-table',
  '@xyflow/react',
  'lucide-react',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'recharts',
])
