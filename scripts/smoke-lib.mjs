#!/usr/bin/env node
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as ui from '../dist/lib/ui.js'

const chartData = [{ label: 'a', count: 1 }, { label: 'b', count: 2 }]
const diffHunks = [
  {
    header: '@@ -1,1 +1,1 @@',
    lines: [
      { type: 'del', oldNo: 1, text: 'old line' },
      { type: 'add', newNo: 1, text: 'new line' },
    ],
  },
]
const commits = [{ id: 'abc123', lane: 0, message: 'initial package smoke', session: true, time: 'now' }]
const steps = [{ id: 'one', label: 'one' }, { id: 'two', label: 'two' }]
const timelineItem = { id: 't1', kind: 'turn', role: 'user', label: '1', body: 'hello' }
const timelineTool = { id: 'tool1', kind: 'read', name: 'Read', preview: 'src/index.css', path: 'src/index.css' }
const rendererTool = { kind: 'read', status: 'ok', args: { file: 'src/index.css', excerpt: ':root {}' }, durationMs: 1 }

const sampleProps = {
  ChartBar: { data: chartData, xKey: 'label', series: [{ key: 'count', name: 'count' }], title: 'bars' },
  ChartLine: { data: chartData, xKey: 'label', series: [{ key: 'count', name: 'count' }], title: 'line' },
  CommandPalette: {
    open: true,
    onClose: () => {},
    onTheme: () => {},
    sections: [{ id: 'tokens', label: 'tokens' }],
  },
  CommitGraph: { commits },
  DataTable: {
    columns: [{ key: 'name', label: 'name', sortable: true }],
    rows: [{ id: 'a', name: 'alpha' }],
    caption: 'sample table',
  },
  DiffView: { file: 'sample.diff', hunks: diffHunks },
  Field: { label: 'field', children: ({ id }) => React.createElement('input', { id }) },
  StepIndicator: { steps, current: 'one' },
  StepWizard: { steps, children: ['first', 'second'] },
  Tabs: { tabs: [{ id: 'a', label: 'alpha', content: 'alpha panel' }] },
  ThinkingBlock: { block: { words: 4, text: 'sample thought' } },
  TimelineItem: { item: timelineItem },
  Timeline: { items: [timelineItem] },
  ToolCall: { tool: timelineTool },
  ToolCallRenderer: { tool: rendererTool },
}

const expectedExports = [
  'Button',
  'Card',
  'BrandMark',
  'ProviderIcon',
  'DiffView',
  'CommitGraph',
  'ChartBar',
  'ChartLine',
  'DataTable',
  'Timeline',
  'ToolCallRenderer',
]

const failures = []
for (const name of expectedExports) {
  if (!(name in ui)) failures.push(`${name}: missing from dist/lib/ui.js`)
}

let rendered = 0
for (const [name, value] of Object.entries(ui)) {
  if (typeof value !== 'function' || !/^[A-Z]/.test(name)) continue
  try {
    const props = sampleProps[name] ?? {}
    renderToStaticMarkup(React.createElement(value, props))
    rendered += 1
  } catch (error) {
    failures.push(`${name}: ${error?.message?.split('\n')[0] ?? error}`)
  }
}

if (failures.length) {
  throw new Error(
    [
      'fairtrade smoke failed in scripts/smoke-lib.mjs after building dist/lib/ui.js.',
      'What went wrong: one or more documented UI exports are missing or failed server render.',
      'Why it matters: consumers importing @peasant-labs/fairtrade/ui could hit broken package exports.',
      'Fix: inspect the named export/component below, update sampleProps when a component requires new mandatory props, or repair the export/build.',
      '',
      failures.join('\n'),
    ].join('\n'),
  )
}

console.log(`fairtrade smoke: imported ${Object.keys(ui).length} symbols; rendered ${rendered} component exports`)
