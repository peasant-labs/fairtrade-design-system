/* Playwright journey harness for the fairtrade design system.
 *
 * Element journeys drive the built Storybook (storybook-static) the same way
 * sbsmoke.mjs does — one iframe per story, play() auto-runs — but through
 * Playwright's bundled Chromium, so no system Chrome, no setuid sandbox
 * helper, and no CHROME_PATH plumbing. Real user input (clicks are trusted
 * events) also absorbs what check-map-pointer.mjs proves separately.
 *
 * Boots storybook-static itself, so `pnpm journey` is the only command needed
 * after `pnpm build-storybook`. Artifacts land in scripts/journey/.artifacts
 * (gitignored): report.json, per-test screenshots, and the ARIA/axe evidence
 * each journey records.
 */
import { defineConfig } from '@playwright/test'

const SB_PORT = Number(process.env.JOURNEY_SB_PORT || 6017)
const SB_URL = `http://localhost:${SB_PORT}`
const APP_PORT = Number(process.env.JOURNEY_APP_PORT || 5180)
const APP_URL = `http://localhost:${APP_PORT}`
const ARTIFACTS = 'scripts/journey/.artifacts'

const [VIEWPORT_W, VIEWPORT_H] = (process.env.JOURNEY_VIEWPORT || '1280x720').split('x').map(Number)

const SCREENSHOT = process.env.JOURNEY_SCREENSHOT === 'off' ? 'only-on-failure' : 'on'
const TRACE = process.env.JOURNEY_TRACE === '1' ? 'on' : 'retain-on-failure'
const VIDEO = process.env.JOURNEY_VIDEO === '1' ? 'on' : 'retain-on-failure'
const HTML = process.env.JOURNEY_HTML !== '0'

export default defineConfig({
  testDir: './scripts/journey',
  testMatch: '**/*.journey.mjs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: `${ARTIFACTS}/results`,
  reporter: [
    ['list'],
    ...(HTML ? [['html', { outputFolder: `${ARTIFACTS}/html`, open: 'never' }]] : []),
    ['json', { outputFile: `${ARTIFACTS}/report.json` }],
  ],
  use: {
    baseURL: SB_URL,
    viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
    reducedMotion: 'reduce',
    trace: TRACE,
    video: VIDEO,
    screenshot: SCREENSHOT,
  },
  projects: [
    { name: 'dark', use: { colorScheme: 'dark' } },
    { name: 'light', use: { colorScheme: 'light' } },
  ],
  webServer: [
    {
      // storybook-static is built by `pnpm build-storybook` before the run;
      // serve it on the same fixed port sbsmoke.mjs uses so story URLs never drift.
      command: `pnpm exec http-server storybook-static -p ${SB_PORT} -a 127.0.0.1 --silent`,
      url: `${SB_URL}/index.json`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // dist/ is built by `pnpm build` before the run; the app-validate
      // journey drives it the way validate.mjs did (same port, same flags).
      command: `pnpm exec vite preview --port ${APP_PORT} --strictPort`,
      url: `${APP_URL}/?fb=off`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
})
