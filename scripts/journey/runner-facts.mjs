// Browser-free measurement of the runner assigned to a browser job.
import { availableParallelism, cpus, loadavg, totalmem } from 'node:os'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const factsPath = process.env.RUNNER_FACTS_PATH || '/tmp/fairtrade-runner-facts.json'

export function makeRunnerFacts({ run, jobs, jobName, reason, nproc, cpuModel, memoryBytes, loadAverage }) {
  const matches = jobs.filter((job) => job.name === jobName)
  if (matches.length !== 1) throw new Error(`runner facts: expected one job named ${JSON.stringify(jobName)}, found ${matches.length}`)
  const created = Date.parse(run.created_at)
  const started = Date.parse(matches[0].started_at)
  if (!Number.isFinite(created) || !Number.isFinite(started) || started < created) throw new Error('runner facts: invalid run created_at or job started_at; cannot calculate queue time')
  return { nproc, cpuModel, memoryBytes, loadAverage, routerReason: reason || 'unavailable', runCreatedAt: run.created_at, jobStartedAt: matches[0].started_at, queueSeconds: (started - created) / 1000, apiError: null }
}

function localFacts(reason, apiError) {
  let count
  try { count = Number(execFileSync('nproc', { encoding: 'utf8' }).trim()) } catch { count = availableParallelism() }
  return { nproc: count || availableParallelism(), cpuModel: cpus()[0]?.model || 'unknown', memoryBytes: totalmem(), loadAverage: loadavg(), routerReason: reason || 'unavailable', runCreatedAt: null, jobStartedAt: null, queueSeconds: null, apiError }
}

async function api(path, token) {
  const response = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}${path}`, { signal: AbortSignal.timeout(8000), headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' } })
  if (!response.ok) throw new Error(`runner facts: GitHub API ${path} returned ${response.status}`)
  return response.json()
}

async function capture() {
  const { GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: attempt, GITHUB_TOKEN: token, RUNNER_JOB_NAME: jobName, ROUTER_REASON: reason } = process.env
  let facts = localFacts(reason, null)
  try {
    if (!repo || !runId || !attempt || !token || !jobName) throw new Error('runner facts: GitHub repository, run id, attempt, token and job name are required')
    const root = `/repos/${repo}/actions/runs/${runId}`
    const [run, page] = await Promise.all([api(root, token), api(`${root}/attempts/${attempt}/jobs?per_page=100`, token)])
    if (!Array.isArray(page.jobs) || page.jobs.length >= 100) throw new Error('runner facts: invalid or truncated jobs response')
    facts = makeRunnerFacts({ ...facts, run, jobs: page.jobs, jobName, reason })
  } catch (error) {
    facts.apiError = error instanceof Error ? error.message : String(error)
  }
  writeFileSync(factsPath, `${JSON.stringify(facts, null, 2)}\n`)
  console.log('runner facts:', JSON.stringify(facts))
}

function merge(path) {
  let facts
  try { facts = JSON.parse(readFileSync(factsPath, 'utf8')) } catch (error) { facts = localFacts(process.env.ROUTER_REASON, `capture unavailable: ${error.message}`) }
  let report = {}
  if (existsSync(path)) {
    try {
      report = JSON.parse(readFileSync(path, 'utf8'))
      if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('expected a JSON object')
    } catch (error) {
      report = { reportError: `Playwright report unavailable: ${error.message}` }
    }
  }
  report.runnerFacts = facts
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] === 'capture') await capture()
    else if (process.argv[2] === 'merge' && process.argv[3]) merge(process.argv[3])
    else throw new Error('usage: node scripts/journey/runner-facts.mjs capture | merge <report.json>')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
