import { loadStrictYaml, assertExactNames } from './css-source.mjs'

/** @typedef {{name:string, query:string, mounted:string, root:string, keyboard:'tree'|'drilldown'|'turn'|'settings', prose?:string[], outcomeSelector?:string, passiveStickySelector?:string}} Surface */
/** @typedef {{name:string, surface:string, selector:string, panel:string, item:string, fontToken:string, expectedPx:number, minimumLeading:number, tolerancePx:number}} InsightReading */
/** @typedef {{widths:number[], themes:string[], baseline:object[], surfaces:Surface[], insightReadings:InsightReading[], mutations:Array<{name:string,kind:string,violation?:string}>, targets:Array<{name:string,query:string,selector:string,desktopOnly?:boolean}>}} MountedAccessibility */
export function loadAccessibilityMountedFixtures() {
  const path = 'scripts/testdata/accessibility-mounted.yaml'
  const spec = /** @type {MountedAccessibility} */ (loadStrictYaml(path))
  const manifest = loadStrictYaml('scripts/testdata/accessibility-mounted.manifest.yaml')
  assertExactNames(spec.surfaces.map(row => row.name), manifest.requiredSurfaceNames, `${path} surfaces`)
  assertExactNames(spec.insightReadings.map(row => row.name), manifest.requiredInsightReadingNames, `${path} insight readings`)
  assertExactNames(spec.mutations.map(row => row.name), manifest.requiredMutationNames, `${path} mutations`)
  assertExactNames(spec.targets.map(row => row.name), manifest.requiredTargetNames, `${path} targets`)
  assertExactNames(spec.themes, ['dark', 'light'], `${path} themes`)
  assertExactNames(spec.widths.map(String), ['320', '390', '1440'], `${path} widths`)
  if (!Array.isArray(spec.baseline) || spec.baseline.length) throw new Error(`${path}: baseline must be empty; fix mounted accessibility violations instead of allowing them`)
  for (const row of spec.surfaces) {
    if (!row.root || !row.mounted || !row.query || !row.keyboard) throw new Error(`${path}: ${row.name} needs a route, scope, mounted selector and keyboard action; restore the missing field before scanning`)
  }
  for (const row of spec.insightReadings) {
    if (!spec.surfaces.some(surface => surface.name === row.surface) || !row.selector || !row.panel || !row.item || !row.fontToken || !Number.isFinite(row.expectedPx) || !Number.isFinite(row.minimumLeading) || !Number.isFinite(row.tolerancePx)) throw new Error(`${path}: ${row.name} needs mounted selectors, a known surface, token size, leading and geometry tolerance; restore these fields before measuring insight reflow`)
  }
  return spec
}
