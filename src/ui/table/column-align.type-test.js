// @ts-check
/* Contract type-test for the ColumnAlign closed set (src/ui/table/column-align.js).
   It imports the ACTUAL production module and asserts the bijection the set relies on:

     • `ColumnAlign` is the union of every member, each a `ClosedValue` whose wire
       and label are the alignment names;
     • `ALL_COLUMN_ALIGNS` lists every member, so `MissingColumnAlign` is `never`;
       adding a member without listing it fails this file;
     • `parseColumnAlign` returns the member type, never a bare string.

   The contract program must include this file (`tsconfig.contract.json`) together
   with the table's contract file; the assertions live here so the closed set
   cannot drift before that wiring lands. */

import { ALL_COLUMN_ALIGNS, ColumnAlign, parseColumnAlign } from './column-align.js'

/** @type {import('../closed-value.js').ClosedValue<'start', 'start'>} */
const start = ColumnAlign.Start
/** @type {'start'} */
const startWire = start.wire
/** @type {'start'} */
const startLabel = start.label
void startWire
void startLabel

/**
 * Every member must appear in `ALL_COLUMN_ALIGNS`.
 * @typedef {Exclude<ColumnAlign, (typeof ALL_COLUMN_ALIGNS)[number]>} MissingColumnAlign
 */
/** @type {MissingColumnAlign extends never ? true : never} */
const allColumnAlignsListed = true
void allColumnAlignsListed

/** @type {ColumnAlign} */
const parsedFromWire = parseColumnAlign('start')
/** @type {ColumnAlign} */
const parsedFromMember = parseColumnAlign(ColumnAlign.End)
void parsedFromWire
void parsedFromMember

// @ts-expect-error — a raw string is not a ColumnAlign; the set is nominal, not a literal union
const notAMember = /** @type {ColumnAlign} */ ('start')
void notAMember
