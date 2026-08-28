import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { globSync } from 'node:fs'
import { LIB_EXTERNALS } from './scripts/lib-externals.mjs'

/* react-markdown's character-reference helper publishes a browser-only DOM entry. Keep the
   published library importable in SSR/package smokes by selecting its environment-neutral entry;
   app and Storybook builds retain Vite's normal browser resolution. */
const decodeNamedCharacterReference = globSync('node_modules/.pnpm/decode-named-character-reference@*/node_modules/decode-named-character-reference/index.js', { absolute: true })[0]

export default defineConfig({
  publicDir: false,
  plugins: [
    react(),
    {
      name: 'fairtrade-node-safe-character-reference',
      enforce: 'pre',
      resolveId(source) {
        if (source !== 'decode-named-character-reference') return null
        return decodeNamedCharacterReference ?? null
      },
    },
  ],
  build: {
    outDir: 'dist/lib',
    emptyOutDir: true,
    lib: {
      entry: {
        ui: 'src/ui/index.js',
        // ./icons passthrough — re-exports lucide-react (kept external below),
        // so consumers tree-shake named icons from the shared fairtrade copy.
        icons: 'src/icons.js',
        // Per-surface entry points (HYBRID boundary): each app imports only its
        // own surface bundle, so a peasant app importing ./graph never pulls in
        // the village ./commons surfaces (intra-package bundle isolation). As
        // separate Rollup entries these code-split cleanly; the isolation guard
        // (scripts/assert-pack-contents.mjs) asserts the split holds.
        graph: 'src/ui/graph/index.js',
        commons: 'src/ui/commons/index.js',
        analytics: 'src/ui/analytics/index.js',
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: 'ui-imports',
    },
    rollupOptions: {
      external: [...LIB_EXTERNALS],
    },
  },
})
