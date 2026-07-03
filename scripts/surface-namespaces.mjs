// Single source of truth for the per-surface CSS class-name namespaces.
//
// The HYBRID package boundary ships each app's surfaces as a SEPARATE entry
// (`./graph` for the peasant code-graph surfaces, `./commons` for the village
// commons surfaces, `./analytics` for the shared analytics dashboard) so a
// consumer never bundles another app's surfaces. Every lifted surface
// namespaces its selectors with a short prefix; the build-time isolation guard
// (scripts/finalize-lib-build.mjs + scripts/assert-pack-contents.mjs) uses
// these sets to prove a surface bundle carries ONLY its own (and the shared
// shell's) namespaces — never another surface family's.
//
// `iu-` is the shared in-use shell chrome (app-switcher / subnav / stage),
// imported by multiple bundles, so it is exclusive to none.

/** Namespaces that belong ONLY to the graph (./graph) surface bundle. */
export const GRAPH_NAMESPACES = Object.freeze(['gmp-'])

/** Namespaces that belong ONLY to the commons (./commons) surface bundle. */
export const COMMONS_NAMESPACES = Object.freeze(['cex-', 'cmg-'])

/** Namespaces that belong ONLY to the analytics (./analytics) surface bundle. */
export const ANALYTICS_NAMESPACES = Object.freeze(['gan-'])

/** Shared shell chrome — permitted in every bundle, exclusive to none. */
export const SHARED_NAMESPACES = Object.freeze(['iu-'])

/**
 * Every lifted-surface namespace prefix (graph + commons + analytics + shared).
 * The CSS-tokenization lint scopes itself to rules under these prefixes.
 * @type {readonly string[]}
 */
export const ALL_SURFACE_NAMESPACES = Object.freeze([
  ...GRAPH_NAMESPACES,
  ...COMMONS_NAMESPACES,
  ...ANALYTICS_NAMESPACES,
  ...SHARED_NAMESPACES,
])

/**
 * The per-surface bundle isolation map: for each surface entry, the stylesheet +
 * JS bundle that must NOT carry the OTHER surface families' namespaces. The shared
 * `iu-` namespace is allowed everywhere, so it never appears as a "forbidden".
 * @type {ReadonlyArray<{ surface: string, css: string, js: string, forbidden: readonly string[] }>}
 */
export const SURFACE_BUNDLES = Object.freeze([
  {
    surface: 'graph',
    css: 'graph.css',
    js: 'graph.js',
    forbidden: Object.freeze([...COMMONS_NAMESPACES, ...ANALYTICS_NAMESPACES]),
  },
  {
    surface: 'commons',
    css: 'commons.css',
    js: 'commons.js',
    forbidden: Object.freeze([...GRAPH_NAMESPACES, ...ANALYTICS_NAMESPACES]),
  },
  {
    surface: 'analytics',
    css: 'analytics.css',
    js: 'analytics.js',
    forbidden: Object.freeze([...GRAPH_NAMESPACES, ...COMMONS_NAMESPACES]),
  },
])

/**
 * The pure isolation check, shared by the CSS guard (finalize-lib-build.mjs), the
 * JS guard (assert-pack-contents.mjs), and the gate teeth-test (gates.test.mjs):
 * given a surface bundle's content and the namespaces forbidden in it, return the
 * forbidden namespaces that LEAKED in (empty array = isolated). Extracted so the
 * guard logic has ONE directly unit-testable definition — a Vite/config change
 * can't silently break it without failing the test.
 *
 * @param {string} content   the bundle's text (CSS or JS)
 * @param {readonly string[]} forbidden  the other surface families' namespaces
 * @returns {string[]} the forbidden namespaces present in `content`
 */
export function findForeignNamespaces(content, forbidden) {
  return forbidden.filter((ns) => content.includes(ns))
}
