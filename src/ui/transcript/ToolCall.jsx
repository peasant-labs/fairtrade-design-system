import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  BookOpen,
  Pencil,
  FilePlus2,
  Terminal,
  Search,
  Globe,
  ListChecks,
  Wrench,
} from 'lucide-react'
import { MemoToolBody as ToolBody } from './ToolBody.jsx'
import UsageDisclosure from './UsageDisclosure.jsx'
import { formatDurationMs } from './time.js'
import Collapsible from './Collapsible.jsx'

/* ToolCall — the collapsible tool-call disclosure row, lifted verbatim from the canonical
   mockup (src/mockups/inuse/TranscriptApp.jsx:514). Controlled: `open` / `onToggle` are owned
   by the parent TurnCard (matching the mockup), so a transcript can expand/collapse every tool
   from one place. DUMB: it renders the cooked `ToolCallVM` (icon by group, name, one-line
   preview, duration, a bash failure pill) and reveals <ToolBody> when open. NEVER parses wire. */

/** @typedef {import('./view-model.js').ToolCallVM} ToolCallVM */

/** cooked ToolGroup → collapsed-row icon. @type {Record<string, typeof Wrench>} */
const GROUP_ICON = {
  read: BookOpen,
  edits: Pencil,
  bash: Terminal,
  search: Search,
  fetch: Globe,
  tasks: ListChecks,
  other: Wrench,
}

/** a tool's duration in the one transcript format ("820ms", "1.4s", "1m 15s"); zero reads as nothing */
const fmtDuration = formatDurationMs

/**
 * @param {object} props
 * @param {ToolCallVM} [props.tool]
 * @param {boolean} [props.open]
 * @param {() => void} [props.onToggle]
 */
export default function ToolCall({ tool, open = false, onToggle, showChevron = true, actionRef }) {
  if (!tool) return null
  // a write keeps the new-file glyph even though it cooks to the `edits` group (like the mockup).
  const isWrite = tool.group === 'edits' && /^write$/i.test(tool.name)
  const Icon = isWrite ? FilePlus2 : GROUP_ICON[tool.group] || Wrench
  const failed = tool.isError || (tool.group === 'bash' && tool.exitCode != null && tool.exitCode !== 0)
  const duration = fmtDuration(tool.durationMs)
  return (
    <div className="toolcall txn-toolcall" ref={actionRef}>
      <button type="button" className="tc-head txn-tc-head" aria-expanded={open} onClick={onToggle}>
        {showChevron && (open ? (
          <ChevronDown size={14} aria-hidden="true" className="txn-tc-chev" />
        ) : (
          <ChevronRight size={14} aria-hidden="true" className="txn-tc-chev" />
        ))}
        <span className="kind">
          <Icon size={14} aria-hidden="true" />
          {tool.namespace !== undefined && (
            <span className="txn-tool-namespace"><span className="txn-tool-namespace-label">namespace</span> <span className="mono">{tool.namespace || '(empty)'}</span></span>
          )}
          <span>{tool.name}</span>
        </span>
        <span className="path mono">{tool.preview}</span>
        <span className="right">
          {tool.pending && <span className="txn-tc-dur">pending</span>}
          {duration && <span className="tnum txn-tc-dur">{duration}</span>}
          {failed && (
            <span className="chip chip-err txn-pill">
              <AlertTriangle size={14} aria-hidden="true" /> {tool.exitCode != null ? `exit ${tool.exitCode}` : 'error'}
            </span>
          )}
        </span>
      </button>
      <Collapsible open={open} startOnFrame><ToolBody tool={tool} /><UsageDisclosure usage={tool.usage} /></Collapsible>
    </div>
  )
}
