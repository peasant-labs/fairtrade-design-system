import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// Second, CSS-only lib pass (the JS barrel is built by vite.lib.config.js).
// Vite library mode cannot emit a standalone stylesheet from a CSS entry alone,
// so we feed src/lib-components.css through a throwaway JS entry: Vite emits the
// compiled, self-contained components.css AND a dummy components-entry.js that
// exists only to coax the CSS out. finalize-lib-build.mjs deletes that dummy
// (and the JS barrel's ui-imports.css) so only components.css ships.
export default defineConfig({
  publicDir: false,
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist/lib',
    emptyOutDir: false,
    rollupOptions: {
      input: 'src/lib-components.css',
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'components.css'
          return '[name]-[hash][extname]'
        },
        // dummy JS entry — see the header comment; deleted by finalize-lib-build.mjs.
        entryFileNames: 'components-entry.js',
      },
    },
  },
})
