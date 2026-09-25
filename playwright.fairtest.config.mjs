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
 * do that. The fixed loopback port below is owned by this config and bound
 * to 127.0.0.1; the producer mirrors the same default.
 *
 * Scope: testDir and testMatch select ONLY the Fairtest product journey. The
 * broad scripts/journey catalog never runs under this config. Later work
 * widens the match to the component journey without adding a config.
 */
import { defineConfig } from '@playwright/test'

/* Fixed loopback port for the built app. Owned by this config. */
export const FAIRTEST_APP_PORT = Number(process.env.FAIRTEST_APP_PORT || 5189)
export const FAIRTEST_APP_HOST = '127.0.0.1'

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
    baseURL: `http://${FAIRTEST_APP_HOST}:${FAIRTEST_APP_PORT}`,
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'fairtest' }],
})
