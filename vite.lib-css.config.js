import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// Second, CSS-only lib pass (the JS barrel is built by vite.lib.config.js).
// Vite library mode cannot emit a standalone stylesheet from a CSS entry alone,
// so we feed each CSS bundle through a throwaway JS entry: Vite emits the
// compiled, self-contained stylesheet AND a dummy <name>-entry.js that exists
// only to coax the CSS out. finalize-lib-build.mjs deletes those dummies (and the
// JS barrel's ui-imports.css) so only the explicit stylesheets ship.
//
// Three bundles are emitted, one per import surface:
//   src/lib-components.css -> components.css   (the shared component library)
//   src/lib-graph.css      -> graph.css        (the code-graph surfaces)
//   src/lib-commons.css    -> commons.css      (the village commons surfaces)
//   src/lib-analytics.css  -> analytics.css    (the analytics dashboard surface)
// The per-surface split is the HYBRID boundary's CSS half: an app importing
// ./graph.css never ships the village ./commons.css selectors and vice-versa.
export default defineConfig({
  publicDir: false,
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist/lib',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        components: 'src/lib-components.css',
        graph: 'src/lib-graph.css',
        commons: 'src/lib-commons.css',
        analytics: 'src/lib-analytics.css',
      },
      output: {
        // Map each compiled stylesheet to its published name. The asset name Vite
        // hands us is derived from the source basename (lib-components/lib-graph/
        // lib-commons); disambiguate on that so every surface gets a stable name.
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] ?? ''
          if (name.endsWith('.css')) {
            if (name.includes('analytics')) return 'analytics.css'
            if (name.includes('graph')) return 'graph.css'
            if (name.includes('commons')) return 'commons.css'
            return 'components.css'
          }
          return '[name]-[hash][extname]'
        },
        // dummy JS entries (components-entry.js / graph-entry.js / commons-entry.js)
        // — see the header comment; all deleted by finalize-lib-build.mjs.
        entryFileNames: '[name]-entry.js',
      },
    },
  },
})
