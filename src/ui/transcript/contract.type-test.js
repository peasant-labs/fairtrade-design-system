// @ts-check
/* Contract type-test for the transcript integration spine. It imports the ACTUAL
   production sub-barrel (the surface every downstream lift + consumer imports)
   and asserts, at the type level, the load-bearing guarantees of the wire types
   + TranscriptViewModel. Enforced by:
     pnpm test:contract
   which runs: tsc -p tsconfig.contract.json (checkJs:true, strict:true,
   noImplicitAny:true, noEmit). This file is wired into `build:lib` so a
   contract leak FAILS the build gate. A red error here means the integration
   contract has drifted and must be fixed before the spine can unblock downstream
   component work. */

/** @typedef {import('./index.js').TranscriptWireInput} TranscriptWireInput */
/** @typedef {import('./index.js').SessionDetailPayload} SessionDetailPayload */
/** @typedef {import('./index.js').TranscriptViewModel} TranscriptViewModel */
/** @typedef {import('./index.js').ToolCallVM} ToolCallVM */
/** @typedef {import('./index.js').SessionVM} SessionVM */
/** @typedef {import('./index.js').TurnVM} TurnVM */
/** @typedef {import('./index.js').Role} Role */
/** @typedef {import('./index.js').DiffEntryVM} DiffEntryVM */
/** @typedef {import('./index.js').FileEntryVM} FileEntryVM */
/** @typedef {import('./index.js').TaskGroupVM} TaskGroupVM */
/** @typedef {import('./index.js').FilterIndexVM} FilterIndexVM */
/** @typedef {import('./index.js').AnnotationVM} AnnotationVM */

import { ROLES, TOOL_CALL_KINDS, TOOL_GROUPS, HARNESSES } from './index.js'

/* ── (1) enum-value arrays are genuine runtime exports ──────────────────────── */

/** @type {Role} */
const firstRole = ROLES[0]
void firstRole
void TOOL_CALL_KINDS
void TOOL_GROUPS
void HARNESSES

/* ── (2) POSITIVE: adapter input accepts FLAT Go wire shape ─────────────────── */
/* gitBranch + gitRemote as flat strings; NO gitContext. The real session_detail
   wire from the Go backend. */
/** @type {TranscriptWireInput} */
const flatWire = {
  id: 's1',
  harness: 'claude-code',
  startTime: '2026-06-24T00:00:00Z',
  endTime: '2026-06-24T00:10:00Z',
  durationMins: 10,
  totalTokens: 100,
  tokensIn: 60,
  tokensOut: 40,
  turnCount: 2,
  toolCallCount: 1,
  turns: [
    {
      index: 0,
      role: 'user',
      content: 'do the thing',
      timestamp: '2026-06-24T00:00:00Z',
      depth: 0,
      // parentIndex present-and-nullable on the Go wire; consumers MUST NOT rely on it — use depth
      parentIndex: null,
    },
    {
      index: 1,
      role: 'assistant',
      content: 'done',
      timestamp: '2026-06-24T00:01:00Z',
      depth: 0,
      entryType: 'text',
      toolCalls: [
        { id: 't1', name: 'Read', arguments: '{"file":"x"}', result: '"ok"', toolKind: 'read' },
      ],
    },
  ],
  gitBranch: 'main',
  gitRemote: 'origin',
}
void flatWire

/* ── (3) POSITIVE: adapter input ALSO accepts nested (drifted TS) shape ──────── */
/* gitContext only, no flat fields. The shape TB's sample fixtures hand-populate. */
/** @type {TranscriptWireInput} */
const nestedWire = {
  id: 's2',
  harness: 'codex',
  startTime: '2026-06-24T00:00:00Z',
  endTime: '2026-06-24T00:10:00Z',
  durationMins: 10,
  totalTokens: 0,
  tokensIn: 0,
  tokensOut: 0,
  turnCount: 0,
  toolCallCount: 0,
  turns: [],
  gitContext: {
    branch: 'feature',
    commits: [
      { hash: 'abc123', message: 'init', authorName: 'a', authorEmail: 'a@b.c', commitTime: 1, authorTime: 1 },
    ],
  },
}
void nestedWire

/* ── (4) POSITIVE: cooked VM exposes git ONLY via the optional session.git ────── */
/** @param {TranscriptViewModel} vm */
function readGitLikeAComponent(vm) {
  // allowed: cooked, optional
  const branch = vm.session.git?.branch
  // toolCallsById is a Map (parsed once)
  /** @type {ToolCallVM | undefined} */
  const tc = vm.toolCallsById.get('t1')
  // highlights backs the highlights tab (always present as an array)
  const hcount = vm.highlights.length
  // analytics is render-when-present
  const phases = vm.analytics?.phases?.length ?? 0
  return { branch, tc, hcount, phases }
}
void readGitLikeAComponent

/* ── (5) POSITIVE: diffs / files / tasks / filterIndex + turn.annotations are always present ──
   The contract guarantees these fields are NEVER undefined on a constructed VM, so components
   never branch on existence for the core surfaces. Each pin DEREFERENCES A MEMBER off a typed-VM
   parameter (`.length` for the arrays, `.totalTurns` for filterIndex): if a field becomes optional
   (?) on TranscriptViewModel, tsc surfaces TS18048 (object is possibly undefined) on that member
   access and the gate fails. A bare read (no member access) does NOT bite — strictNullChecks permits
   referencing a possibly-undefined value — so every pin reaches through a member. */

/**
 * @param {TranscriptViewModel} vm
 * @param {TurnVM} turn
 */
function _pinCoreArrays(vm, turn) {
  // Each of these dereferences a member, so it produces TS18048 if the field is made optional on TranscriptViewModel.
  return [
    vm.diffs.length,
    vm.files.length,
    vm.tasks.length,
    vm.filterIndex.totalTurns,
    vm.turns[0].annotations.length,
    // pin via the turn param too (turn.annotations is always present, never optional)
    turn.annotations.length,
  ]
}
void _pinCoreArrays

/* ── (6) NEGATIVE: git WIRE field must NOT exist on the cooked SessionVM ─────────
   Written as a typed-cast local (not a function param) so the check cannot
   fall back to implicit-any: `s` is pinned to SessionVM via the cast, and
   `s.gitBranch` must surface TS2339. */
{
  /** @type {SessionVM} */
  const s = /** @type {any} */ ({})
  // @ts-expect-error — gitBranch is a wire field; it must never exist on the cooked SessionVM
  void s.gitBranch
}

/* ── (7) NEGATIVE: raw JSON string must NOT exist on the cooked ToolCallVM ────────
   Same typed-cast-local pattern. The adapter parses arguments once into `args`;
   the raw `arguments` string is the wire shape and must not leak onto the VM. */
{
  /** @type {ToolCallVM} */
  const t = /** @type {any} */ ({})
  // @ts-expect-error — `arguments` is the raw wire JSON string; cooked VM exposes parsed `args`
  void t.arguments
}

/* ── (8) NEGATIVE: parentIndex must NOT exist on the cooked TurnVM ────────────────
   Consumers must key subagent nesting off `depth`, not parentIndex. The drifted
   TS wire shape omits parentIndex entirely; TurnVM follows that consumer contract. */
{
  /** @type {TurnVM} */
  const turn = /** @type {any} */ ({})
  // @ts-expect-error — parentIndex is a wire detail; cooked TurnVM exposes only `depth`
  void turn.parentIndex
}

/* ── (9) NEGATIVE: gitContext must NOT exist on the bare SessionDetailPayload ──────
   gitContext is the drifted TS shape. The REAL Go wire payload has only flat
   gitBranch/gitRemote. The TranscriptWireInput WIDENS for drift absorption;
   the bare payload must NOT carry gitContext so the one adapter is the sole seam. */
{
  /** @type {SessionDetailPayload} */
  const payload = /** @type {any} */ ({})
  // @ts-expect-error — gitContext is NOT on the bare payload; only on TranscriptWireInput (widened)
  void payload.gitContext
}
