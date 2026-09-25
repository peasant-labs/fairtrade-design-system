/* Fairtest one-project row-scoped Playwright config (base for product and component rows).
 *
 * Exactly ONE project named fairtest. Theme always comes from the explicit row
 * key (dark or light) through the row route and the normalized observation in
 * scripts/fairtest/fairtrade-targets.mjs, never from a project name. The
 * component producer lands under this same config without creating a second
 * project or a second config.
 *
 * Service ownership: the Fairtrade adapter owns the built-app service
 * lifecycle (start, readiness, exactly-once stop) through its injected
 * driver, so this config declares NO webServer entry. A webServer entry with
 * reuseExistingServer would silently attach to an unrelated already-running
 * server and hide a stale served build; adapter-managed targets must never
 * do that.
 *
 * Loopback origin ownership: the host, the port, and the base URL have ONE
 * owner, scripts/fairtest/fairtest-runtime.mjs, which the row-scoped producer
 * also reads to bind its static driver. This config re-exports those values
 * unchanged; it never declares a host, a port, or a base URL of its own, so
 * the declared owner is the one production code actually reads.
 *
 * Scope: testDir and testMatch select ONLY the Fairtest product journey. The
 * broad scripts/journey catalog never runs under this config. Later work
 * widens the match to the component journey without adding a config. The
 * `runner-config` cases in the product fixture family pin this shape, so a
 * second project, a webServer entry, or a changed retry/worker budget turns
 * them red.
 */
import { defineConfig } from '@playwright/test'
import { FAIRTEST_APP_BASE_URL, FAIRTEST_APP_HOST, FAIRTEST_APP_PORT } from './scripts/fairtest/fairtest-runtime.mjs'

/* Loopback host, port, and base URL, re-exported unchanged from their single
 * owner in scripts/fairtest/fairtest-runtime.mjs. Never a second declaration. */
export { FAIRTEST_APP_BASE_URL, FAIRTEST_APP_HOST, FAIRTEST_APP_PORT }

const RUN_ROOT = process.env.FAIRTEST_RUN_ROOT || ''

export default defineConfig({
  testDir: './scripts/fairtest',
  testMatch: '**/product.journey.mjs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: RUN_ROOT
    ? `${RUN_ROOT}/playwright-output`
    : './node_modules/.cache/fairtest-playwright',
  reporter: [['list']],
  use: {
    baseURL: FAIRTEST_APP_BASE_URL,
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'fairtest' }],
})
