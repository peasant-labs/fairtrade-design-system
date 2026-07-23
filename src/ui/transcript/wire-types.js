// @ts-check
/* Canonical transcript wire types and enum values come from
   `@peasant-labs/schema`. Fairtrade owns only the deliberately narrow legacy
   compatibility shape accepted by adaptTranscript; components receive the
   cooked TranscriptViewModel and never bind to either wire shape directly. */

import {
  EntryType as SchemaEntryType,
  Harness as SchemaHarness,
  Role as SchemaRole,
  SessionOutcome as SchemaSessionOutcome,
  StopReason as SchemaStopReason,
  ToolCallKind as SchemaToolCallKind,
} from '@peasant-labs/schema'

/** @typedef {import('@peasant-labs/schema').Role} Role */
/** @typedef {import('@peasant-labs/schema').EntryType} EntryType */
/** @typedef {import('@peasant-labs/schema').ToolCallKind} ToolCallKind */
/** @typedef {import('@peasant-labs/schema').StopReason} StopReason */
/** @typedef {import('@peasant-labs/schema').SessionOutcome} SessionOutcome */
/** @typedef {import('@peasant-labs/schema').Harness} Harness */
/** @typedef {import('@peasant-labs/schema').ToolCallDetail} ToolCallDetail */
/** @typedef {import('@peasant-labs/schema').TurnDetail} TurnDetail */
/** @typedef {import('@peasant-labs/schema').ChildSessionRef} ChildSessionRef */
/** @typedef {import('@peasant-labs/schema').SessionScorecard} SessionScorecard */
/** @typedef {import('@peasant-labs/schema').CommitInfo} CommitInfo */
/** @typedef {import('@peasant-labs/schema').AnnotationSummary} AnnotationSummary */
/** @typedef {import('@peasant-labs/schema').SessionDetailPayload} SessionDetailPayload */

/** Canonical schema values exposed for compatibility with existing consumers. @type {readonly Role[]} */
export const ROLES = Object.freeze(Object.values(SchemaRole))

/** @type {readonly EntryType[]} */
export const ENTRY_TYPES = Object.freeze(Object.values(SchemaEntryType))

/** @type {readonly ToolCallKind[]} */
export const TOOL_CALL_KINDS = Object.freeze(Object.values(SchemaToolCallKind))

/** @type {readonly StopReason[]} */
export const STOP_REASONS = Object.freeze(Object.values(SchemaStopReason))

/** @type {readonly SessionOutcome[]} */
export const SESSION_OUTCOMES = Object.freeze(Object.values(SchemaSessionOutcome))

/* Harness is intentionally derived from the runtime object rather than
   AllHarnesses: schema supports antigravity even while its convenience list is
   narrower. */
/** @type {readonly Harness[]} */
export const HARNESSES = Object.freeze(Object.values(SchemaHarness))

/* These legacy types are intentionally local to Fairtrade's adapter boundary.
   They describe the retired nested shape emitted by older Peasant clients and
   must not become a second canonical wire contract. */

/**
 * @typedef {object} LegacyCommit
 * @property {string} hash
 * @property {string} message
 * @property {string} timestamp
 * @property {number} filesChanged
 * @property {number} insertions
 * @property {number} deletions
 * @property {boolean} [session]
 */

/**
 * @typedef {object} LegacyGitContext
 * @property {string | null} [branch]
 * @property {string | null} [remote]
 * @property {string} [user]
 * @property {string} [email]
 * @property {string} [workingDirectory]
 * @property {string} [startCommit]
 * @property {(CommitInfo | LegacyCommit)[]} [commits]
 */

/**
 * The one compatibility seam. Canonical flat fields always win when both
 * shapes are present; the adapter normalizes legacy workingDirectory here too.
 * @typedef {SessionDetailPayload & { gitContext?: LegacyGitContext }} TranscriptWireInput
 */

export {}
