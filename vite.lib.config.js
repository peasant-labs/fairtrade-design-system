import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: 'dist/lib',
    emptyOutDir: true,
    lib: {
      entry: 'src/ui/index.js',
      formats: ['es'],
      fileName: () => 'ui.js',
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
