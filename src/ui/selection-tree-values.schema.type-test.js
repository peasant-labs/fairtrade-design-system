// @ts-check
/* Both-ways contract assertions for the schema-owned selection node sets.

   This file replaced the earlier tripwire: fairtrade pinned a schema generation
   that did not export `LocalKickstartNodeKind` or `LocalKickstartNodeState`, and
   an unused `@ts-expect-error` was the signal that the export had landed. The
   kickstart contract is now published, so the tripwire has served its purpose and
   the real assertions below took its place.

   Two directions, as the skill requires:
   - every schema member is present on the client, so a schema addition fails here;
   - every client member is a legal schema value, so a client invention fails here.
   An unknown or missing member is never relabelled. */

import { ALL_SELECTION_NODE_KINDS, ALL_SELECTION_NODE_STATES } from './selection-tree-values.js'

/** @typedef {import('./selection-tree-values.js').SelectionNodeKind} SelectionNodeKind */
/** @typedef {import('./selection-tree-values.js').SelectionNodeState} SelectionNodeState */
/** @typedef {import('@peasant-labs/schema').LocalKickstartNodeKind} LocalKickstartNodeKind */
/** @typedef {import('@peasant-labs/schema').LocalKickstartNodeState} LocalKickstartNodeState */

/** @typedef {Exclude<LocalKickstartNodeKind, SelectionNodeKind['wire']>} KindMissingOnClient */
/** @typedef {Exclude<SelectionNodeKind['wire'], LocalKickstartNodeKind>} KindMissingInSchema */
/** @typedef {Exclude<LocalKickstartNodeState, SelectionNodeState['wire']>} StateMissingOnClient */
/** @typedef {Exclude<SelectionNodeState['wire'], LocalKickstartNodeState>} StateMissingInSchema */

/** @type {KindMissingOnClient extends never ? true : never} */
const kindCoversSchema = true
/** @type {KindMissingInSchema extends never ? true : never} */
const schemaCoversKind = true
/** @type {StateMissingOnClient extends never ? true : never} */
const stateCoversSchema = true
/** @type {StateMissingInSchema extends never ? true : never} */
const schemaCoversState = true

/** @type {readonly LocalKickstartNodeKind[]} */
const kindsAreLegal = ALL_SELECTION_NODE_KINDS.map((member) => member.wire)
/** @type {readonly LocalKickstartNodeState[]} */
const statesAreLegal = ALL_SELECTION_NODE_STATES.map((member) => member.wire)

void kindCoversSchema
void schemaCoversKind
void stateCoversSchema
void schemaCoversState
void kindsAreLegal
void statesAreLegal
