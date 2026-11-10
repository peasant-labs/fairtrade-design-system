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
 * also reads to bind its static driver. This config declares no host, port, or
 * base URL and re-exports none; it reads only the worker budget and the render
 * viewport, so the declared owner is the one production code actually reads.
 *
 * Viewport ownership: the render viewport is a product-evidence parameter the
 * rendered-root predicate depends on, so it lives in the same runtime owner
 * and is read from there. The mounted row pins the page to it anyway, which is
 * why a viewport declared here could not silently drift into the evidence.
 *
 * Parallel rows: fullyParallel is on and each Playwright worker starts its own
 * adapter-managed static server on an OS-assigned loopback port, so two workers
 * never bind the same origin. Rows navigate by the driver's absolute base URL,
 * and the config deliberately declares no use.baseURL: a relative navigation
 * would otherwise attach to a fixed port that no worker owns. The run root is
 * still one immutable envelope:
 * every row writes a row-keyed producer directory, so a worker cannot overwrite
 * another worker's evidence subtree. The worker count and the parallel flag are
 * read from the runtime owner, and the `runner-config` cases in the product
 * fixture family pin them, so a second project, a webServer entry, a widened
 * glob, or a changed retry/worker/viewport budget turns them red.
 *
 * Scope: testDir and testMatch select ONLY the Fairtest product and component
 * journeys. The broad scripts/journey catalog never runs under this config. The
 * array form is deliberate: a glob would also collect the co-located
 * `*.test.mjs` fixtures and the broad story smoke.
 */
import { defineConfig } from '@playwright/test'
import { FAIRTEST_MOUNTED_WORKERS, PRODUCT_VIEWPORT } from './scripts/fairtest/fairtest-runtime.mjs'

const RUN_ROOT = process.env.FAIRTEST_RUN_ROOT || ''

export default defineConfig({
  testDir: './scripts/fairtest',
  testMatch: ['**/product.journey.mjs', '**/component.journey.mjs'],
  fullyParallel: true,
  workers: FAIRTEST_MOUNTED_WORKERS,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: RUN_ROOT
    ? `${RUN_ROOT}/producer/playwright-diagnostics`
    : './node_modules/.cache/fairtest-playwright',
  reporter: [['list']],
  use: {
    viewport: { ...PRODUCT_VIEWPORT },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'fairtest' }],
})
