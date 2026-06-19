import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

// dev middleware: POST /feedback appends to feedback.md (replaces the old serve.py).
// the in-page feedback tool posts here so comments auto-save while you iterate.
function feedbackWriter() {
  return {
    name: 'feedback-writer',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0].replace(/\/$/, '')
        if (req.method !== 'POST' || url !== '/feedback') return next()
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const { markdown } = JSON.parse(body || '{}')
            if (markdown && markdown.trim()) {
              fs.appendFileSync(path.join(ROOT, 'feedback.md'), markdown.trim() + '\n\n')
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end('{"ok":true}')
          } catch (e) {
            res.statusCode = 400
            res.end('{"ok":false}')
          }
        })
      })
    },
  }
}

export default defineConfig({
  // root for dev/preview and most hosts; GitHub Pages project sites set
  // VITE_BASE=/peasant-design-system/ at build time (see .github/workflows/deploy.yml)
  base: process.env.VITE_BASE || '/',
  // dev defaults to 5180 (falls through to the next free port if taken) so it matches the docs and the
  // qa/screenshot scripts, which all target http://localhost:5180.
  server: { port: 5180 },
  plugins: [tailwindcss(), react(), feedbackWriter()],
})
