import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { parse } from 'yaml'
import { makeRunnerFacts } from './runner-facts.mjs'

const fixture = parse(readFileSync('scripts/testdata/runner-facts.yaml', 'utf8'))
test('runner facts calculate queue time and reject missing identity', () => {
  assert.deepEqual(fixture.cases.map((entry) => entry.name).sort(), ['records-missing-reason', 'records-queue-time', 'rejects-missing-job'])
  for (const row of fixture.cases) {
    const input = { run: fixture.run, jobs: fixture.jobs, jobName: row.jobName, reason: row.reason, nproc: 4, cpuModel: 'test CPU', memoryBytes: 1024, loadAverage: [1, 2, 3] }
    if (row.error) assert.throws(() => makeRunnerFacts(input), new RegExp(row.error), row.name)
    else {
      const facts = makeRunnerFacts(input)
      assert.equal(facts.queueSeconds, row.queueSeconds)
      assert.deepEqual([facts.nproc, facts.cpuModel, facts.memoryBytes, facts.loadAverage, facts.routerReason], [4, 'test CPU', 1024, [1, 2, 3], row.reason || 'unavailable'])
    }
  }
})

test('capture and merge commands retain report data and bind the Actions timestamps', async () => {
  const root = mkdtempSync(join(tmpdir(), 'runner-facts-'))
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json')
    if (request.headers.authorization !== 'Bearer test-token') { response.writeHead(401); response.end('{}'); return }
    if (request.url === '/repos/owner/repo/actions/runs/123') response.end(JSON.stringify(fixture.run))
    else if (request.url === '/repos/owner/repo/actions/runs/123/attempts/1/jobs?per_page=100') response.end(JSON.stringify({ jobs: fixture.jobs }))
    else if (/^\/repos\/owner\/(no-start|full)\/actions\/runs\/123$/.test(request.url)) response.end(JSON.stringify(fixture.run))
    else if (request.url === '/repos/owner/no-start/actions/runs/123/attempts/1/jobs?per_page=100') response.end(JSON.stringify({ jobs: [{ name: fixture.jobs[0].name }] }))
    else if (request.url === '/repos/owner/full/actions/runs/123/attempts/1/jobs?per_page=100') response.end(JSON.stringify({ jobs: Array(100).fill(fixture.jobs[0]) }))
    else { response.writeHead(404); response.end('{}') }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const env = { ...process.env, GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`, GITHUB_REPOSITORY: 'owner/repo', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_TOKEN: 'test-token', RUNNER_JOB_NAME: fixture.jobs[0].name, ROUTER_REASON: 'pool', RUNNER_FACTS_PATH: join(root, 'facts.json') }
  const run = (args, extraEnv = {}) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/journey/runner-facts.mjs', ...args], { env: { ...env, ...extraEnv } })
    let output = ''
    child.stdout.on('data', (data) => { output += data })
    child.stderr.on('data', (data) => { output += data })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(output)))
  })
  try {
    const printed = await run(['capture'])
    assert.match(printed, /runner facts:/)
    const reportPath = join(root, 'report.json')
    writeFileSync(reportPath, JSON.stringify({ suites: [{ title: 'existing' }] }))
    await run(['merge', reportPath])
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    assert.equal(report.suites[0].title, 'existing')
    assert.equal(report.runnerFacts.queueSeconds, 90)
    assert.equal(report.runnerFacts.routerReason, 'pool')
    assert.ok(report.runnerFacts.nproc > 0 && report.runnerFacts.memoryBytes > 0)
    assert.deepEqual(fixture.degraded.map((row) => row.name).sort(), ['api-failure', 'missing-start', 'missing-token', 'truncated-page'])
    for (const row of fixture.degraded) {
      await run(['capture'], { GITHUB_REPOSITORY: row.repository, GITHUB_TOKEN: row.token })
      await run(['merge', reportPath])
      const facts = JSON.parse(readFileSync(reportPath, 'utf8')).runnerFacts
      assert.equal(facts.queueSeconds, null, row.name)
      assert.match(facts.apiError, new RegExp(row.expectedError), row.name)
      assert.ok(facts.nproc > 0 && facts.cpuModel && facts.memoryBytes > 0 && facts.loadAverage.length === 3)
      assert.equal(facts.routerReason, 'pool')
    }
    await run(['merge', reportPath], { RUNNER_FACTS_PATH: join(root, 'missing.json') })
    const missingCapture = JSON.parse(readFileSync(reportPath, 'utf8')).runnerFacts
    assert.equal(missingCapture.queueSeconds, null)
    assert.match(missingCapture.apiError, /capture unavailable/)
    writeFileSync(reportPath, '{invalid json')
    await run(['merge', reportPath], { RUNNER_FACTS_PATH: join(root, 'missing.json') })
    const malformedReport = JSON.parse(readFileSync(reportPath, 'utf8'))
    assert.match(malformedReport.reportError, /Playwright report unavailable/)
    assert.equal(malformedReport.runnerFacts.queueSeconds, null)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    rmSync(root, { recursive: true, force: true })
  }
})
