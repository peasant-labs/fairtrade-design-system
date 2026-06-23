import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

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
        entryFileNames: 'components-entry.js',
      },
    },
  },
})
