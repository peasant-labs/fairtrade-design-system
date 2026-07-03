import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  publicDir: false,
  plugins: [react()],
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
      external: [
        '@tanstack/react-table',
        'lucide-react',
        'react',
        'react-dom',
        'react/jsx-runtime',
        'recharts',
      ],
    },
  },
})
