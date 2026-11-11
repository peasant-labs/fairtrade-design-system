import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const fixture = parse(readFileSync('scripts/testdata/journey-recording.yaml', 'utf8'))
const cases = fixture.cases
function assertRecordingRetry(config) {
  if (config.retries === 0) {
    assert.notEqual(config.trace, 'on-first-retry', 'trace on-first-retry records nothing with zero retries')
    assert.notEqual(config.video, 'on-first-retry', 'video on-first-retry records nothing with zero retries')
  }
}
test('both Playwright configs honor recording policy and overrides', () => {
  assert.deepEqual(cases.map((row) => row.name).sort(), ['default', 'forced-recording', 'forced-trace', 'forced-video'])
  assert.deepEqual(fixture.environments.map((row) => row.name).sort(), ['ci', 'local'])
  for (const row of cases) {
    for (const environment of fixture.environments) {
      for (const config of ['journey', 'fairtest']) {
        const source = `import('./playwright.${config}.config.mjs').then(({default:c})=>console.log(JSON.stringify({trace:c.use.trace,video:c.use.video,screenshot:c.use.screenshot,retries:c.retries})))`
        const env = { ...process.env, JOURNEY_TRACE: row.trace, JOURNEY_VIDEO: row.video, JOURNEY_SCREENSHOT: row.screenshot }
        if (environment.ci) env.CI = environment.ci
        else delete env.CI
        const result = spawnSync(process.execPath, ['-e', source], { encoding: 'utf8', env })
        assert.equal(result.status, 0, result.stderr)
        const observed = JSON.parse(result.stdout)
        assertRecordingRetry(observed)
        assert.equal(observed.trace, config === 'journey' ? (row.forceTrace ? 'on' : environment.expectedRecording) : row.fairtestTrace, `${row.name}: ${environment.name} ${config} trace`)
        assert.equal(observed.video, config === 'journey' ? (row.forceVideo ? 'on' : environment.expectedRecording) : row.fairtestVideo, `${row.name}: ${environment.name} ${config} video`)
        assert.equal(observed.screenshot, config === 'journey' ? row.expectedScreenshot : 'only-on-failure')
        assert.equal(observed.retries, config === 'journey' ? environment.expectedRetries : 0)
      }
    }
  }
})
test('zero-retry recording invariant rejects trace and video mutations', () => {
  assert.deepEqual(fixture.mutations.map((row) => row.name).sort(), ['zero-retry-trace', 'zero-retry-video'])
  for (const row of fixture.mutations) assert.throws(() => assertRecordingRetry({ retries: 0, trace: row.trace, video: row.video }), new RegExp(row.expected), row.name)
})
