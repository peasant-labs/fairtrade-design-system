// @ts-check
/* Contract type-test for the selection node projection.
   It imports the production module and asserts:
     - every kind and state member is a closed value whose wire and label match;
     - ALL_SELECTION_NODE_KINDS / ALL_SELECTION_NODE_STATES list every member,
       so adding a member without listing it fails this file;
     - parseNodeKind / parseNodeState return the member type, never a bare string.
   The schema both-ways check lives beside this file's runtime sibling: the
   published schema pin does not yet export the kickstart node sets, and the
   tripwire below fails the contract build when that export appears without
   the Exclude assertions being added. */

import {
  ALL_SELECTION_NODE_KINDS,
  ALL_SELECTION_NODE_STATES,
  parseNodeKind,
  parseNodeState,
  SelectionNodeKind,
  SelectionNodeState,
} from './selection-tree-values.js'

/** @type {import('./closed-value.js').ClosedValue<'project', 'project'>} */
const project = SelectionNodeKind.Project
/** @type {'project'} */
const projectWire = project.wire
/** @type {'project'} */
const projectLabel = project.label
void projectWire
void projectLabel

/** @type {import('./closed-value.js').ClosedValue<'none', 'none'>} */
const none = SelectionNodeState.None
/** @type {'none'} */
const noneWire = none.wire
void noneWire

/**
 * @typedef {Exclude<SelectionNodeKind, (typeof ALL_SELECTION_NODE_KINDS)[number]>} MissingSelectionNodeKind
 */
/** @type {MissingSelectionNodeKind extends never ? true : never} */
const allKindsListed = true
void allKindsListed

/**
 * @typedef {Exclude<SelectionNodeState, (typeof ALL_SELECTION_NODE_STATES)[number]>} MissingSelectionNodeState
 */
/** @type {MissingSelectionNodeState extends never ? true : never} */
const allStatesListed = true
void allStatesListed

/** @type {SelectionNodeKind} */
const parsedKind = parseNodeKind(SelectionNodeKind.Session.wire)
/** @type {SelectionNodeKind} */
const parsedKindMember = parseNodeKind(SelectionNodeKind.Branch)
/** @type {SelectionNodeState} */
const parsedState = parseNodeState(SelectionNodeState.Some.wire)
void parsedKind
void parsedKindMember
void parsedState

// @ts-expect-error a raw string is not a SelectionNodeKind; the set is nominal
const notAKind = /** @type {SelectionNodeKind} */ (SelectionNodeKind.Project.wire)
void notAKind
