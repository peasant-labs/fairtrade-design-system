import {
  GraphTurnNode,
  GraphToolNode,
  GraphSubagentBranch,
  GraphLegend,
} from './index.js'

/* Graph node-VISUAL stories — the canonical SNAPSHOT-ORACLE anchor for the graph
   half of the lift (the graph oracle screenshots these, both themes, via
   the theme toolbar). LAYOUT IS CARVED OUT on purpose: these render the node
   visuals at their natural engine widths in a static column, NOT the @xyflow
   topology/positions (that logic lives in transcript-browser). So the oracle pins
   the AESTHETIC (the only thing fairtrade owns), free of engine layout drift.

   Every component is imported from the production sub-barrel (./index.js) — the
   exact surface transcript-browser + the mockup consume — so the stories cannot
   drift from the shipped contract. The nodes fill their container width, so each
   is wrapped at the width the engine assigns (turn 320, tool pill 200). */

/** Render a node at a fixed width, the way the engine host sizes it. */
function Slot({ w = 320, children }) {
  return <div style={{ width: w }}>{children}</div>
}

/** A labelled column of slots, so a snapshot reads top-to-bottom by state. */
function Stack({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>{children}</div>
}

const meta = {
  title: 'in use/transcript/GraphNodes',
  parameters: { layout: 'padded' },
}

export default meta

/* ── turn cards: every role + state the engine can hand the visual ─────────────── */
export const Turns = {
  render: () => (
    <Stack>
      <Slot>
        <GraphTurnNode
          role="user"
          turnNumber="1"
          contentPreview="add a snapshot oracle for the trajectory graph node visuals"
          toolCount={0}
          totalTokens={120}
        />
      </Slot>
      <Slot>
        <GraphTurnNode
          role="assistant"
          provider="claude-code"
          turnNumber="2"
          contentPreview="I'll lift the graph node visuals into fairtrade and rewire the @xyflow nodes."
          toolCount={3}
          totalTokens={1840}
          tokensIn={1200}
          tokensOut={640}
        />
      </Slot>
      <Slot>
        <GraphTurnNode
          role="assistant"
          provider="codex"
          turnNumber="3"
          contentPreview="provider accent follows PROVIDER_ACCENT — codex reads olive, not amber."
          toolCount={1}
          totalTokens={920}
        />
      </Slot>
      <Slot>
        <GraphTurnNode
          role="assistant"
          agentName="docs-writer"
          turnNumber="4a"
          contentPreview="subagent turn: mauve accent, agent name in the head."
          toolCount={2}
          totalTokens={530}
        />
      </Slot>
      <Slot>
        <GraphTurnNode
          role="assistant"
          provider="claude-code"
          turnNumber="5"
          contentPreview="typecheck failed: the edit left an unused import."
          toolCount={2}
          totalTokens={410}
          hasError
        />
      </Slot>
      <Slot>
        <GraphTurnNode
          role="assistant"
          provider="claude-code"
          turnNumber="6"
          contentPreview="retrying the same edit after the first attempt did not apply."
          toolCount={1}
          totalTokens={300}
          hasRetry
        />
      </Slot>
      <Slot>
        <GraphTurnNode
          role="assistant"
          provider="claude-code"
          turnNumber="7"
          contentPreview="reverting the earlier change and taking a different approach."
          toolCount={1}
          totalTokens={280}
          hasRevert
        />
      </Slot>
      <Slot>
        <GraphTurnNode
          role="assistant"
          provider="claude-code"
          turnNumber="8"
          contentPreview="this card is the selected node — amber selection ring."
          toolCount={0}
          totalTokens={150}
          isSelected
        />
      </Slot>
      <Slot>
        <GraphTurnNode
          role="user"
          turnNumber="9"
          contentPreview="this card is a search match — neutral ink ring."
          toolCount={0}
          totalTokens={90}
          isSearchMatch
        />
      </Slot>
      <Slot>
        <GraphTurnNode
          role="assistant"
          provider="claude-code"
          turnNumber="10"
          contentPreview="this card is filtered out — dimmed by an active filter."
          toolCount={2}
          totalTokens={640}
          isFilteredOut
        />
      </Slot>
    </Stack>
  ),
}

/* ── tool-cluster pills: cooked previews only (no wire JSON parsed here) ────────── */
export const Tools = {
  render: () => (
    <Stack>
      <Slot w={200}>
        <GraphToolNode
          tools={[{ id: 'a', name: 'Read', filePath: 'src/ui/transcript/graph/index.js' }]}
          totalDurationMs={120}
        />
      </Slot>
      <Slot w={200}>
        <GraphToolNode
          tools={[
            { id: 'a', name: 'Read', preview: 'turnsToFlow.ts' },
            { id: 'b', name: 'Edit', preview: 'TurnCardNode.tsx' },
            { id: 'c', name: 'Bash', preview: 'pnpm typecheck' },
          ]}
          totalDurationMs={2400}
        />
      </Slot>
      <Slot w={200}>
        <GraphToolNode
          tools={[
            { id: 'a', name: 'Bash', preview: 'pnpm build', isError: true, exitCode: 1 },
            { id: 'b', name: 'Read', preview: 'styles.css' },
          ]}
          totalDurationMs={1800}
          hasError
        />
      </Slot>
      <Slot w={200}>
        <GraphToolNode
          tools={[
            { id: 'a', name: 'Read', preview: 'a.ts' },
            { id: 'b', name: 'Read', preview: 'b.ts' },
            { id: 'c', name: 'Read', preview: 'c.ts' },
            { id: 'd', name: 'Read', preview: 'd.ts' },
            { id: 'e', name: 'Read', preview: 'e.ts' },
            { id: 'f', name: 'Read', preview: 'f.ts' },
          ]}
          totalDurationMs={900}
        />
      </Slot>
    </Stack>
  ),
}

/* ── subagent swimlane headers ──────────────────────────────────────────────────── */
export const SubagentLanes = {
  render: () => (
    <Stack>
      <GraphSubagentBranch agentName="docs-writer" depth={1} />
      <GraphSubagentBranch agentName="test-runner" depth={2} />
    </Stack>
  ),
}

/* ── legend: default canonical set + a provider-tinted variant ──────────────────── */
export const Legend = {
  render: () => (
    <Stack>
      <GraphLegend />
      <GraphLegend
        items={[
          { kind: 'user', label: 'you' },
          { kind: 'assistant', label: 'codex', provider: 'codex' },
          { kind: 'subagent', label: 'subagent' },
          { kind: 'tool', label: 'tool' },
          { kind: 'error', label: 'error' },
        ]}
      />
    </Stack>
  ),
}

/* ── the full catalog in one frame — the comprehensive anchor shot ──────────────── */
export const Catalog = {
  render: () => (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Slot>
          <GraphTurnNode role="user" turnNumber="1" contentPreview="kick off the session" toolCount={0} totalTokens={120} />
        </Slot>
        <Slot>
          <GraphTurnNode
            role="assistant"
            provider="claude-code"
            turnNumber="2"
            contentPreview="working on it — three tool calls this turn."
            toolCount={3}
            totalTokens={1840}
          />
        </Slot>
        <Slot>
          <GraphTurnNode role="assistant" agentName="docs-writer" turnNumber="3a" contentPreview="subagent lane" toolCount={1} totalTokens={300} />
        </Slot>
        <Slot>
          <GraphTurnNode role="assistant" provider="claude-code" turnNumber="4" contentPreview="typecheck failed" toolCount={1} totalTokens={200} hasError />
        </Slot>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Slot w={200}>
          <GraphToolNode
            tools={[
              { id: 'a', name: 'Read', preview: 'turnsToFlow.ts' },
              { id: 'b', name: 'Edit', preview: 'TurnCardNode.tsx' },
            ]}
            totalDurationMs={2400}
          />
        </Slot>
        <GraphSubagentBranch agentName="docs-writer" depth={1} />
        <GraphLegend />
      </div>
    </div>
  ),
}
