import { loadFixturePair, assertFields } from './mounted-parts.mjs'

/** @typedef {{name: string, query: string, width: number, root: string, text: string[], absent?: string[], disabled?: string, marks?: string[], tabular?: string, action?: string}} MountedTruthRow */
/** @returns {{themes: string[], cases: MountedTruthRow[]}} */
export function loadDemoTruthMountedFixtures() {
  const { fixture } = loadFixturePair('scripts/testdata/demo-truth-mounted.yaml', 'scripts/testdata/demo-truth-mounted.manifest.yaml')
  if (JSON.stringify(fixture.themes) !== JSON.stringify(['dark', 'light'])) throw new Error('demo truth mounted: fixture must pin dark and light themes')
  for (const row of fixture.cases) {
    assertFields(row, ['name', 'query', 'width', 'root', 'text'], row.name, ['absent', 'disabled', 'marks', 'tabular', 'action'])
    if (!Number.isInteger(row.width) || row.width < 320 || !Array.isArray(row.text) || !row.text.length) throw new Error(`demo truth mounted: ${row.name}: expected a supported width and nonempty text probes`)
  }
  return fixture
}
