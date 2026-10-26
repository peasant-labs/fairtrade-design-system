import { loadFixturePair, withMountedSource, createReport, click } from './mounted-parts.mjs'

/** @typedef {{name:string, component:string, selector:string, absent?:boolean, attribute?:string, expected?:string, reference?:string, documentReference?:string, text?:string, distinct?:boolean, click?:string, focus?:string, count?:number}} SemanticCase */
const { fixture } = loadFixturePair('scripts/testdata/accessibility-semantics.yaml', 'scripts/testdata/accessibility-semantics.manifest.yaml')
const report = createReport('accessibility semantics')
await withMountedSource(async ({ load, mount, React, window }) => {
  const el = React.createElement
  const input = fixture.input
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const cooked = adaptTranscript(input.viewer)
  const vm = { ...cooked, analytics: {...cooked.analytics, phases:input.phases} }
  const { SettingStatus, SettingRow } = await load('/src/ui/Settings.jsx')
  const components = {
    navigator: el((await load('/src/ui/graph/CodeMapNavigator.jsx')).default, input.navigator),
    commits: el((await load('/src/ui/CommitGraph.jsx')).default, input.commits),
    ranked: el((await load('/src/ui/graph/RankedRow.jsx')).default, input.ranked),
    session: el((await load('/src/ui/graph/SessionLane.jsx')).default, input.session),
    ghosts: el((await load('/src/ui/graph/GhostGroup.jsx')).default, input.ghosts),
    scent: el((await load('/src/ui/graph/ScentTag.jsx')).default, {...input.scent, onToggle() {}}),
    rank: el((await load('/src/ui/graph/RankModeControl.jsx')).default, {...input.rank, onChange() {}}),
    overflow: el((await load('/src/ui/graph/SessionOverflowDisclosure.jsx')).default, input.overflow),
    ghost: el((await load('/src/ui/graph/GhostCommitNode.jsx')).default, fixture.input.ghost),
    turn: el((await load('/src/ui/transcript/TurnCard.jsx')).default, {turn:fixture.input.turn}),
    systemrow: el((await load('/src/ui/transcript/SystemRow.jsx')).default, {turn:fixture.input.systemTurn}),
    workgroup: el((await load('/src/ui/transcript/WorkGroup.jsx')).default, {tools:fixture.input.workTools}),
    tool: el((await load('/src/ui/transcript/ToolBody.jsx')).default, {tool:fixture.input.tool}),
    task: el((await load('/src/ui/transcript/TaskBody.jsx')).default, {tool:fixture.input.task}),
    markdown: el((await load('/src/ui/transcript/Markdown.jsx')).default, {text:fixture.input.markdown}),
    context: el((await load('/src/ui/transcript/TranscriptContext.jsx')).default, {...input.context, onNavigate() {}}),
    usage: el((await load('/src/ui/transcript/UsageDisclosure.jsx')).UsageScopes, input.usage),
    viewer: el((await load('/src/ui/transcript/TranscriptViewer.jsx')).default, {viewModel:vm, capabilities:{}}),
    settings: el(SettingStatus, null, input.settings.map(props => el(SettingRow, {...props, key:props.label}))),
    facets: el((await load('/src/ui/FacetRail.jsx')).default, input.facets),
    insights: el((await load('/src/ui/graph/InsightPanel.jsx')).default, input.insights),
    outline: el((await load('/src/ui/transcript/OutlineRail.jsx')).default, {viewModel: {...vm, analytics:{...vm.analytics, patternAnnotations:input.annotations}}, tab:'annotations'}),
  }
  for (const row of /** @type {SemanticCase[]} */ (fixture.cases)) {
    const mounted = await mount(components[row.component])
    if (row.click) await mounted.act(() => click(window, mounted.container.querySelector(row.click)))
    if (row.focus) await mounted.act(() => mounted.container.querySelector(row.focus)?.focus())
    const nodes = [...mounted.container.querySelectorAll(row.selector)]
    if (row.absent) report.check(nodes.length === 0, row.name)
    else {
      report.check(nodes.length > 0, `${row.name}: production element is mounted`)
      if (row.count !== undefined) report.check(nodes.length === row.count, row.name)
      for (const node of nodes) {
        if (row.reference) report.check(node.querySelector(row.reference)?.id === node.getAttribute(row.attribute), row.name)
        else if (row.documentReference) report.check([...mounted.container.querySelectorAll(row.documentReference)].some(target => target.id === node.getAttribute(row.attribute)), row.name)
        else if (row.attribute) report.check(node.getAttribute(row.attribute) === row.expected, `${row.name}: ${node.getAttribute(row.attribute)}`)
        if (row.text) report.check(node.textContent.includes(row.text), row.name)
      }
      if (row.distinct) report.check(new Set(nodes.map(node => node.getAttribute('aria-label') || node.textContent)).size === nodes.length, row.name)
    }
    await mounted.unmount()
  }
})
report.finish('graph and transcript production semantics')
