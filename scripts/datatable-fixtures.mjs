import { loadStrictYaml, assertExactNames } from './css-source.mjs'

/** @typedef {{name:string, props:Object, rows?:Object[], expectedTitles:string[], expectedCount:string}} TableCase */
/** Load named data-table cases and require the independent inventory before any test runs. */
export function loadDataTableFixtures() {
  const data = loadStrictYaml('scripts/testdata/datatable.yaml')
  const manifest = loadStrictYaml('scripts/testdata/datatable.manifest.yaml')
  for (const [key, required] of Object.entries({ cases: 'requiredCaseNames', actions: 'requiredActionNames', mountedRows: 'requiredMountedNames', mutations: 'requiredMutationNames', guardMutations: 'requiredGuardMutationNames', consumerRows: 'requiredConsumerNames', analyticsRows: 'requiredAnalyticsNames' })) {
    if (!Array.isArray(data[key])) throw new Error(`datatable.yaml: ${key} must be an array; restore the named fixture rows before running the table checks`)
    assertExactNames(data[key].map((r) => r.name), manifest[required], `datatable ${key}`)
  }
  for (const row of data.cases) {
    if (!row.props || !Array.isArray(row.expectedTitles) || typeof row.expectedCount !== 'string') throw new Error(`datatable.yaml: ${row.name} needs props, expectedTitles and expectedCount`)
  }
  for (const row of data.consumerRows) {
    if (typeof row.query !== 'string' || typeof row.count !== 'string') throw new Error(`datatable.yaml: ${row.name} needs a product query and exact host count`)
    if (row.filter !== undefined && (!row.filter || typeof row.filter.term !== 'string' || !row.filter.term.trim() || typeof row.filter.count !== 'string' || !row.filter.count.trim())) throw new Error(`datatable.yaml: ${row.name} filter needs non-empty term and count strings; restore the loaded-window interaction before running the consumer checks`)
  }
  for (const row of data.analyticsRows) {
    if (!Number.isInteger(row.width) || row.width < 320) throw new Error(`datatable.yaml: ${row.name} needs a supported contributor viewport width`)
  }
  if (!Array.isArray(data.consumerWidths) || !data.consumerWidths.every((width) => Number.isInteger(width) && width >= 320)) throw new Error('datatable.yaml: consumerWidths must list supported product viewport widths')
  return data
}
