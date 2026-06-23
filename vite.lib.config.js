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
