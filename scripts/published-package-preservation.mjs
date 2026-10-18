/* Optional published-baseline comparison inside the existing packed consumer roundtrip.
   Both subjects are extracted package bytes. Cases come from the canonical named fixtures. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadDataTableFixtures } from './datatable-fixtures.mjs'
import { loadFixturePair } from './mounted-parts.mjs'

function declarationNames(file) {
  const program = ts.createProgram([file], { noEmit:true, skipLibCheck:true, module:ts.ModuleKind.NodeNext, moduleResolution:ts.ModuleResolutionKind.NodeNext, target:ts.ScriptTarget.ES2020 })
  const source = program.getSourceFile(file)
  const checker = program.getTypeChecker()
  assert.ok(source, `packed declaration target missing: ${file}`)
  const symbol = checker.getSymbolAtLocation(source)
  assert.ok(symbol, `packed declaration module missing: ${file}`)
  return checker.getExportsOfModule(symbol).map((entry)=>entry.name).sort()
}

export async function assertPublishedPackagePreserved({tarball, integrity, candidateRoot, workRoot, externalsRoot}) {
  assert.ok(integrity?.startsWith('sha512-'), 'published package comparison requires explicit sha512 integrity from registry metadata')
  assert.equal('sha512-'+createHash('sha512').update(readFileSync(tarball)).digest('base64'), integrity, 'actual published tarball integrity')
  const publishedRoot = join(workRoot,'published','node_modules','@peasant-labs','fairtrade')
  mkdirSync(publishedRoot,{recursive:true})
  execFileSync('tar',['-xzf',resolve(tarball),'-C',publishedRoot,'--strip-components=1'],{stdio:'inherit',timeout:30_000})
  const published = JSON.parse(readFileSync(join(publishedRoot,'package.json'),'utf8'))
  const candidate = JSON.parse(readFileSync(join(candidateRoot,'package.json'),'utf8'))
  const nm = join(workRoot,'published','node_modules')
  for(const dependency of new Set([...Object.keys(published.dependencies??{}),...Object.keys(published.peerDependencies??{})])) {
    const target=join(nm,dependency)
    if(existsSync(join(externalsRoot,dependency))&&!existsSync(target)){mkdirSync(dirname(target),{recursive:true});symlinkSync(join(externalsRoot,dependency),target,'dir')}
  }
  const inventory = []
  let oldUi, nextUi
  for(const [subpath, entry] of Object.entries(published.exports)) {
    assert.ok(candidate.exports[subpath], `published package export ${subpath} removed`)
    if(typeof entry!=='object'||!entry.types)continue
    const oldModule=await import(pathToFileURL(join(publishedRoot,entry.import)).href)
    const nextModule=await import(pathToFileURL(join(candidateRoot,candidate.exports[subpath].import)).href)
    const oldRuntime=Object.keys(oldModule).sort(), nextRuntime=Object.keys(nextModule).sort()
    const oldTypes=declarationNames(join(publishedRoot,entry.types)), nextTypes=declarationNames(join(candidateRoot,candidate.exports[subpath].types))
    for(const name of oldRuntime){assert.ok(name in nextModule,`${subpath}: published runtime export ${name} removed`);assert.equal(typeof nextModule[name],typeof oldModule[name],`${subpath}: published runtime kind ${name}`)}
    for(const name of oldTypes)assert.ok(nextTypes.includes(name),`${subpath}: published declaration ${name} removed`)
    inventory.push({subpath,publishedRuntime:oldRuntime,candidateRuntime:nextRuntime,publishedDeclarations:oldTypes,candidateDeclarations:nextTypes})
    if(subpath==='./ui'){oldUi=oldModule;nextUi=nextModule}
  }
  const {fixture:categories}=loadFixturePair('scripts/testdata/redaction-labels.yaml','scripts/testdata/redaction-labels.manifest.yaml',{categories:'requiredCategoryNames',unknown:'requiredUnknownNames',invalidLabels:'requiredInvalidLabelNames'})
  for(const name of categories.exports)assert.equal(nextUi[name],oldUi[name],`packed engine-backed category export identity: ${name}`)
  for(const row of categories.categories){assert.equal(nextUi.redactionCategoryLabel(row.category),oldUi.redactionCategoryLabel(row.category),`${row.name}: published category conversion`);assert.equal(nextUi.redactionCategoryFromLabel(row.label),oldUi.redactionCategoryFromLabel(row.label),`${row.name}: published label conversion`)}
  const tables=loadDataTableFixtures()
  for(const row of tables.cases) {
    const render=(api)=>renderToStaticMarkup(React.createElement(api.DataTable,{columns:tables.columns,rows:row.rows??tables.rows,...row.props,...(row.controls===false?{}:{toolbar:(controls)=>React.createElement(api.DataTableToolbar,{...controls,...(row.searchOnly?{columnFilters:undefined}:{}),...(row.filtersOnly?{search:undefined}:{})},row.customAction?React.createElement('button',{type:'button'},row.customAction):null),footer:(controls)=>React.createElement(api.DataTablePaginationControls,controls)})}))
    assert.equal(render(nextUi),render(oldUi),`${row.name}: packed published table opt-in/natural-height behavior`)
  }
  const report={publishedVersion:published.version,candidateVersion:candidate.version,inventory,tableCases:tables.cases.map(row=>row.name),categoryCases:categories.categories.map(row=>row.name)}
  if(process.env.FAIRTRADE_PUBLISHED_REPORT)writeFileSync(process.env.FAIRTRADE_PUBLISHED_REPORT,JSON.stringify(report,null,2)+'\n')
  console.log('published package preservation: '+JSON.stringify({...report,inventory:inventory.map(row=>({subpath:row.subpath,publishedRuntime:row.publishedRuntime.length,candidateRuntime:row.candidateRuntime.length,publishedDeclarations:row.publishedDeclarations.length,candidateDeclarations:row.candidateDeclarations.length,runtimeAdditions:row.candidateRuntime.filter(name=>!row.publishedRuntime.includes(name)),declarationAdditions:row.candidateDeclarations.filter(name=>!row.publishedDeclarations.includes(name))}))}))
}
