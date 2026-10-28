// JSON is a YAML subset: the browser and strict node fixture loader share these bytes.
import source from '../../../scripts/testdata/transcript-reading-browser.yaml?raw'
const spec = JSON.parse(source)
export const readingUnverifiedPull = spec.unverified

export function readingPayload({ short = false, taskCount = short ? spec.shortTaskCount : spec.taskCount, disclosure = false } = {}) {
  const tool = (id, durationMs = 1000) => ({ id, name: 'Bash', arguments: JSON.stringify({ command: `printf ${id}` }), result: `${id}-output`, durationMs })
  const turns = [
    { index: 0, role: 'user', content: 'Reading request 0' },
    { index: 1, role: 'assistant', content: `First response owns the action list.\n\n\`\`\`text\n${spec.longCode}_${spec.searchHorizontal}\n\`\`\``, toolCalls: Array.from({ length: short ? spec.shortLeadingActions : spec.leadingActions }, (_, n) => tool(`leading-${n}`, spec.toolDurations[n % spec.toolDurations.length].ms)) },
    { index: 2, role: 'assistant', content: `Later distinct prose target\n\n${spec.searchSourceOnly}\n\n${spec.searchMixed.text}`, toolCalls: [tool('target-beta')] },
    { index: 3, role: 'assistant', content: '', toolCalls: [tool('target-gamma'), { ...tool(spec.searchNested.id), result: `${'output line\n'.repeat(spec.searchNested.lines)}${'long_prefix_'.repeat(spec.searchNested.prefixRepeat)}${spec.searchNested.query}` }] },
    { index: 4, role: 'assistant', entryType: 'thinking', content: 'target thinking evidence, kept with its original source identity.' },
  ]
  if (disclosure) {
    const body = Array.from({ length: spec.disclosureLineCount }, (_, index) => `${spec.disclosureLinePrefix} ${index + 1}`).join('\n')
    turns[1].toolCalls = [
      { id: 'large-shell', name: 'Bash', arguments: JSON.stringify({ command: 'printf large-shell' }), result: body, durationMs: 1000 },
      { id: 'large-write', name: 'Write', arguments: JSON.stringify({ file_path: 'src/large-example.js', content: body }), result: 'ok', durationMs: 1000 },
    ]
  }
  for (let task = 1; task < taskCount; task++) {
    turns.push({ index: turns.length, role: 'user', content: `Reading request ${task}` })
    const paragraphs = task === taskCount - 1 ? spec.lastResponseParagraphs : 1
    turns.push({ index: turns.length, role: 'assistant', content: Array.from({ length: paragraphs }, (_, paragraph) => `Response for reading request ${task}, paragraph ${paragraph + 1}. This distinct response keeps the real transcript long enough to read and navigate in both directions.${task === taskCount - 1 && spec.searchRepeated.paragraphs.includes(paragraph + 1) ? ` ${spec.searchRepeated.query}` : ''}${task === taskCount - 1 && paragraph === paragraphs - 1 ? ` ${(spec.searchFrequent.query + ' ').repeat(spec.searchFrequent.repeat)}` : ''}`).join('\n\n') })
  }
  return { id: 'reading-destinations', title: spec.longTitle, harness: 'claude-code', turns }
}
export function longReadingPayload() { return readingPayload({ taskCount: spec.longTaskCount }) }
