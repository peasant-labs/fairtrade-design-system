// @ts-check
/* Tripwire for the schema-owned node sets.
   @peasant-labs/schema 0.42.0 does not export LocalKickstartNodeKind. The
   expect-error below is an error today. When the schema package exports the
   type, this directive becomes unused and the contract build fails. Replace
   this file with both-ways Exclude assertions against that export:
     type MissingOnClient = Exclude<SchemaKind, ClientKindWire>
     const coversSchema: MissingOnClient extends never ? true : never = true
     const clientIsLegal: readonly SchemaKind[] = ALL_SELECTION_NODE_KINDS.map(member => member.wire)
   Do not delete the check, and do not relabel an unknown member. */

import * as schema from '@peasant-labs/schema'

// @ts-expect-error the published schema pin does not export LocalKickstartNodeKind yet
const schemaKind = schema.LocalKickstartNodeKind
// @ts-expect-error the published schema pin does not export LocalKickstartNodeState yet
const schemaState = schema.LocalKickstartNodeState
void schemaKind
void schemaState
