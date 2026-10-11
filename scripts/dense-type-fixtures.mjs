import { loadStrictYaml, assertExactNames } from './css-source.mjs'

/** @typedef {{name:string, query:string, selector:string, minimumPx:number, mutation:string, wrap?:boolean, reflow?:boolean, reflowMutation?:'zero-width'|'overlay', desktopOnly?:boolean, familyToken?:string, paragraphGap?:boolean, headingGap?:boolean}} Measurement */
/** @typedef {{name:string, file:string, selector:string, desktop:string, query:string, narrow:string}} Responsive */
/** @typedef {{name:string, query:string, width:number, readings:Array<{buttonText:string,selector:string,text:string,minimumPx:number}>}} ExpandedTools */
/** @typedef {{name:string, query:string, width:number, turn:number, otherTurn:number, text:string, count:string}} CollapsedSearch */
/** @typedef {{register:Record<string,{fontToken:string,familyToken:string,minimumPx:number}>, source:Array<{name:string,kind:string,mutation:string}>, deferredConsumers:string[], responsive:Responsive[], measurements:Measurement[], widths:number[], themes:string[], toolGroupLabels:string[], expandedTools:ExpandedTools, collapsedSearch:CollapsedSearch, case:{name:string,query:string,selector:string,text:string,mutation:string}, publishContract:object}} DenseTypeFixture */
export function loadDenseTypeFixtures() {
  const path = 'scripts/testdata/dense-type.yaml'
  const spec = /** @type {DenseTypeFixture} */ (loadStrictYaml(path))
  const manifest = loadStrictYaml('scripts/testdata/dense-type.manifest.yaml')
  assertExactNames(spec.source.map(r => r.name), manifest.requiredSourceNames, `${path} source`)
  assertExactNames(spec.responsive.map(r => r.name), manifest.requiredResponsiveNames, `${path} responsive`)
  assertExactNames(spec.measurements.map(r => r.name), manifest.requiredMeasurementNames, `${path} measurements`)
  assertExactNames([spec.case.name], manifest.requiredCaseNames, `${path} case`)
  assertExactNames([spec.expandedTools.name, spec.collapsedSearch.name], manifest.requiredInteractionNames, `${path} interactions`)
  for (const row of spec.measurements) {
    if (!row.selector || !row.query || !row.mutation || !Number.isFinite(row.minimumPx)) {
      throw new Error(`${path}: ${row.name} must name its mounted selector, query, size floor and mutation; restore the missing field before running the dense probes`)
    }
  }
  return spec
}
