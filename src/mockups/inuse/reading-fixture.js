// JSON is a YAML subset: the browser and strict node fixture loader share these bytes.
import source from '../../../scripts/testdata/transcript-reading-browser.yaml?raw'
const spec = JSON.parse(source)

export function readingPayload() {
  const tool = (id) => ({ id, name: 'Bash', arguments: JSON.stringify({ command: `printf ${id}` }), result: `${id}-output`, durationMs: 1000 })
  const turns = [
    { index: 0, role: 'user', content: 'Reading request 0' },
    { index: 1, role: 'assistant', content: 'First response owns the action list.', toolCalls: Array.from({ length: spec.leadingActions }, (_, n) => tool(`leading-${n}`)) },
    { index: 2, role: 'assistant', content: 'Later distinct prose target', toolCalls: [tool('target-beta')] },
    { index: 3, role: 'assistant', content: '', toolCalls: [tool('target-gamma')] },
    { index: 4, role: 'assistant', entryType: 'thinking', content: 'target thinking evidence, kept with its original source identity.' },
  ]
  for (let task = 1; task < spec.taskCount; task++) {
    turns.push({ index: turns.length, role: 'user', content: `Reading request ${task}` })
    const paragraphs = task === spec.taskCount - 1 ? spec.lastResponseParagraphs : 1
    turns.push({ index: turns.length, role: 'assistant', content: Array.from({ length: paragraphs }, (_, paragraph) => `Response for reading request ${task}, paragraph ${paragraph + 1}. This distinct response keeps the real transcript long enough to read and navigate in both directions.`).join('\n\n') })
  }
  return { id: 'reading-destinations', harness: 'claude-code', turns }
}
