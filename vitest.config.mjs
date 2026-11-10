import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/* Vitest pilot for the Fairtrade library gate.
 *
 * The pilot proves three things the existing shell chain could not show:
 * an ordinary Node test runs as a normal Vitest test, a mounted React
 * component runs against the Vitest jsdom environment through the same Vite
 * React transform the library build uses, and a mutation orchestrator can be
 * driven from Vitest without weakening its process isolation.
 *
 * Scope is deliberately narrow. The full library gate still runs through
 * scripts/run-test-lib.mjs, which includes `vitest run` as one lane. Moving the
 * remaining Node fixture scripts is a follow-up; most of them call
 * process.exit() and are spawned by the mutation orchestrators, so they must
 * keep their standalone entrypoints until the mutation harness itself moves.
 *
 * Workers are bounded to two forks because the mounted pilot and the mutation
 * pilot are heavier than an ordinary unit test. */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['vitest/**/*.test.{js,jsx,mjs}', 'src/ui/closed-value.test.js'],
    environment: 'node',
    globals: false,
    pool: 'forks',
    minWorkers: 1,
    maxWorkers: 2,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
