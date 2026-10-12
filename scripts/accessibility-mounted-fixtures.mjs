import { loadStrictYaml, assertExactNames } from './css-source.mjs'

/** @typedef {{name:string, query:string, mounted:string, root:string, keyboard:'tree'|'drilldown'|'turn'|'settings', prose?:string[], outcomeSelector?:string}} Surface */
/** @typedef {{widths:number[], themes:string[], baseline:object[], surfaces:Surface[], mutations:Array<{name:string,kind:string,violation?:string}>, targets:Array<{name:string,query:string,selector:string,desktopOnly?:boolean}>}} MountedAccessibility */
export function loadAccessibilityMountedFixtures() {
  const path = 'scripts/testdata/accessibility-mounted.yaml'
  const spec = /** @type {MountedAccessibility} */ (loadStrictYaml(path))
  const manifest = loadStrictYaml('scripts/testdata/accessibility-mounted.manifest.yaml')
  assertExactNames(spec.surfaces.map(row => row.name), manifest.requiredSurfaceNames, `${path} surfaces`)
  assertExactNames(spec.mutations.map(row => row.name), manifest.requiredMutationNames, `${path} mutations`)
  assertExactNames(spec.targets.map(row => row.name), manifest.requiredTargetNames, `${path} targets`)
  assertExactNames(spec.themes, ['dark', 'light'], `${path} themes`)
  assertExactNames(spec.widths.map(String), ['320', '390', '1440'], `${path} widths`)
  if (!Array.isArray(spec.baseline) || spec.baseline.length) throw new Error(`${path}: baseline must be empty; fix mounted accessibility violations instead of allowing them`)
  for (const row of spec.surfaces) {
    if (!row.root || !row.mounted || !row.query || !row.keyboard) throw new Error(`${path}: ${row.name} needs a route, scope, mounted selector and keyboard action; restore the missing field before scanning`)
  }
  return spec
}
