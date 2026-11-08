import { loadFixturePair, assertFields } from './mounted-parts.mjs'

/** @typedef {{action: string, expect: string}} MountedTruthStep */
/** @typedef {{name: string, query: string, width: number, root: string, text: string[], absent?: string[], disabled?: string, marks?: string[], tabular?: string, action?: string, actionStatus?: string, focus?: string, steps?: MountedTruthStep[]}} MountedTruthRow */
/** @returns {{themes: string[], cases: MountedTruthRow[]}} */
export function loadDemoTruthMountedFixtures() {
  const { fixture } = loadFixturePair('scripts/testdata/demo-truth-mounted.yaml', 'scripts/testdata/demo-truth-mounted.manifest.yaml')
  if (JSON.stringify(fixture.themes) !== JSON.stringify(['dark', 'light'])) throw new Error('demo truth mounted: fixture must pin dark and light themes')
  for (const row of fixture.cases) {
    assertFields(row, ['name', 'query', 'width', 'root', 'text'], row.name, ['absent', 'disabled', 'marks', 'tabular', 'action', 'actionStatus', 'focus', 'steps'])
    if (!Number.isInteger(row.width) || row.width < 320 || !Array.isArray(row.text) || !row.text.length) throw new Error(`demo truth mounted: ${row.name}: expected a supported width and nonempty text probes`)
    if (row.actionStatus !== undefined && (typeof row.actionStatus !== 'string' || !row.actionStatus.trim() || typeof row.action !== 'string' || !row.action.trim())) throw new Error(`demo truth mounted: ${row.name}: actionStatus requires an action selector and nonempty expected status text`)
    if (row.steps !== undefined) {
      if (!Array.isArray(row.steps) || row.steps.length === 0) throw new Error(`demo truth mounted: ${row.name}: steps must be a nonempty staged probe list`)
      for (const step of row.steps) {
        assertFields(step, ['action', 'expect'], `${row.name} step`, [])
        if (typeof step.action !== 'string' || !step.action.trim() || typeof step.expect !== 'string' || !step.expect.trim()) throw new Error(`demo truth mounted: ${row.name}: every step names an action and what it must prove`)
      }
    }
  }
  return fixture
}
