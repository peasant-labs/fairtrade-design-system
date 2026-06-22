import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import StepsWaterfall from './StepsWaterfall.jsx'
import { frame } from './story-frame.jsx'

/* StepsWaterfall story. CSF3 under 'in use/' — a per-task duration waterfall over a single agent
   session. Each row is a TASK (a user prompt + the work until the next) with a MONOCHROME duration
   bar sized by its share of the longest; the longest task carries the scarce amber emphasis and one
   task failed (clay marker + "error" word + icon — never colour alone). Prompts are USER CONTENT,
   so their case is preserved; only the chrome is lowercase. classes + tokens come from
   StepsWaterfall.css (imported by the component) and src/index.css via .storybook/preview.jsx; the
   theme toolbar flips data-theme. The Default play() clicks a row and asserts onJump fired. */

/* A worked session: six tasks of varied duration. "refactor the ingest loader" (134s) is the
   longest -> scarce amber; "wire the stream into the pipeline" carries the failure. */
const TASKS = [
  {
    id: 't1',
    index: 1,
    prompt: 'Refactor the ingest loader so it streams instead of buffering the whole file',
    durationMs: 134_000,
    turns: 9,
    outcome: 'ok',
  },
  {
    id: 't2',
    index: 2,
    prompt: 'Add a null-guard around the typecheck pass',
    durationMs: 22_000,
    turns: 2,
    outcome: 'ok',
  },
  {
    id: 't3',
    index: 3,
    prompt: 'Wire the stream into the pipeline and run the smoke test',
    durationMs: 88_000,
    turns: 6,
    outcome: 'error',
    error: 'test failed',
  },
  {
    id: 't4',
    index: 4,
    prompt: 'Back out the buffering path and re-run the smoke test',
    durationMs: 41_000,
    turns: 4,
    outcome: 'ok',
  },
  {
    id: 't5',
    index: 5,
    prompt: 'Add the sqlite pending store behind the loader',
    durationMs: 7_400,
    turns: 1,
    outcome: 'ok',
  },
  {
    id: 't6',
    index: 6,
    prompt: 'Write the changelog entry and bump the schema to v3',
    durationMs: 63_000,
    turns: 5,
    outcome: 'ok',
  },
]

/* Twelve short-to-long tasks to show the waterfall reading at density (intensity + width together). */
const DENSE = [
  { id: 'd1', prompt: 'Scaffold the worker queue module', durationMs: 31_000, tools: 4 },
  { id: 'd2', prompt: 'Add the retry backoff with jitter', durationMs: 18_500, tools: 3 },
  { id: 'd3', prompt: 'Extract the ingest interface from the loader', durationMs: 96_000, tools: 11 },
  { id: 'd4', prompt: 'Fix the flaky timeout in the queue test', durationMs: 54_000, tools: 7 },
  { id: 'd5', prompt: 'Add a null-guard around the typecheck pass', durationMs: 9_200, tools: 2 },
  { id: 'd6', prompt: 'Stream the ingest loader end to end', durationMs: 142_000, tools: 14 },
  { id: 'd7', prompt: 'Wire the worker queue into the dispatcher', durationMs: 27_000, tools: 5, outcome: 'error', error: 'lint error' },
  { id: 'd8', prompt: 'Tidy the config defaults on main', durationMs: 12_000, tools: 2 },
  { id: 'd9', prompt: 'Add sqlite pending store', durationMs: 38_000, tools: 6 },
  { id: 'd10', prompt: 'Bump the pipeline schema to v3', durationMs: 6_100, tools: 1 },
  { id: 'd11', prompt: 'Backfill the migration for the pending store', durationMs: 71_000, tools: 9 },
  { id: 'd12', prompt: 'Write the release notes for 1.4.0', durationMs: 21_000, tools: 3 },
]

/* A short session where the run ended on a failure — the error row is the focus. */
const WITH_ERROR = [
  { id: 'e1', index: 1, prompt: 'Add the new export format to the serializer', durationMs: 58_000, turns: 5, outcome: 'ok' },
  { id: 'e2', index: 2, prompt: 'Round-trip the export through the importer', durationMs: 33_000, turns: 4, outcome: 'ok' },
  { id: 'e3', index: 3, prompt: 'Deploy the serializer change to staging', durationMs: 112_000, turns: 8, outcome: 'error', error: 'deploy failed' },
]

const meta = {
  title: 'in use/StepsWaterfall',
  component: StepsWaterfall,
  decorators: frame('wide'),
  parameters: { layout: 'centered' },
  args: { onJump: fn() },
}

export default meta

export const Default = {
  args: { tasks: TASKS, totalMs: 372_000 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // The six rows are buttons named "step N: <prompt>, <duration>...".
    const row = canvas.getByRole('button', { name: /step 2: Add a null-guard/i })
    await userEvent.click(row)
    await waitFor(() => expect(args.onJump).toHaveBeenCalledWith('t2'))

    // The collapse-all toggle hides the rows.
    const toggle = canvas.getByRole('button', { name: /collapse all/i })
    await userEvent.click(toggle)
    await waitFor(() =>
      expect(canvas.queryByRole('button', { name: /step 2: Add a null-guard/i })).toBeNull(),
    )
  },
}

export const Dense = {
  args: { tasks: DENSE },
}

export const WithError = {
  args: { tasks: WITH_ERROR },
}

export const Collapsed = {
  args: { tasks: TASKS, totalMs: 372_000, defaultCollapsed: true },
}
