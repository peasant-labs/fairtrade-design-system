// @ts-check

/* Cheap liveness check for the served Storybook that the story-URL journeys
 * navigate.
 *
 * Playwright starts the static server once, waits for its URL once, and never
 * restarts it. A server that dies mid-run therefore turns every later story
 * navigation into net::ERR_CONNECTION_REFUSED: a dozen opaque failures that
 * name story ids instead of the missing server, and no failure that names the
 * cause. The suites below call this before they navigate, so the run stops on
 * one actionable failure naming the server, its port, the likely mid-run death,
 * and where the supervised server left its output.
 *
 * The port mirrors playwright.journey.config.mjs, which owns the server
 * command; both read JOURNEY_SB_PORT, and the probe hits the same index.json the
 * config waits for at startup, so a server that answers the config answers
 * here.
 */

const SB_PORT = Number(process.env.JOURNEY_SB_PORT || 6017)

export const STORYBOOK_INDEX_URL = `http://localhost:${SB_PORT}/index.json`

/**
 * Fail with one actionable error when a journey webServer is not answering.
 * Resolves as soon as the server answers, so a healthy run only pays one small
 * GET.
 *
 * @param {{ url?: string, label?: string, timeoutMs?: number }} [server]
 * @returns {Promise<void>}
 */
export async function assertWebServerServing(server = {}) {
  const {
    url = STORYBOOK_INDEX_URL,
    label = 'storybook-static',
    timeoutMs = 5000,
  } = server
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } catch (error) {
    const port = new URL(url).port
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      [
        `${label} is not serving: GET ${url} failed (${detail}).`,
        `The webServer process on port ${port} died mid-run. Playwright starts each webServer once and never restarts it, and a test retry cannot reconnect, so every navigation to a story URL on port ${port} fails with net::ERR_CONNECTION_REFUSED.`,
        `The supervised server reported how it stopped, and where it kept its retained output (scripts/journey/.artifacts/), on the "${label}"-prefixed lines in the run output above.`,
        `how to fix: re-run the journey. If the server was killed with SIGKILL and wrote nothing, the cause is runner-side (out of memory or a stopped container), not a failure in the suite that was running.`,
      ].join('\n'),
    )
  }
}
