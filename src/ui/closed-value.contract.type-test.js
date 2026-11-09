// @ts-check
/* Contract type-test for the shared closed-set factory (src/ui/closed-value.js).
   It imports the ACTUAL production module and asserts, at the type level, the
   load-bearing guarantees every closed set inherits:

     • `closed(wire, label)` returns `ClosedValue` parameterized by the exact
       literals, so `wire` and `toJSON()` keep the member's primitive type;
     • `wire` and `label` are readonly;
     • a member is not interchangeable with another member's wire.

   Enforced by `pnpm test:contract` (tsc -p tsconfig.contract.json, strict,
   noImplicitAny, noEmit). This file + closed-value.js are wired into that
   program, so a dropped generic or a widened property fails the gate. */

import { closed } from './closed-value.js'

/** @type {import('./closed-value.js').ClosedValue<'browse', 'browse'>} */
const browse = closed('browse', 'browse')
/** @type {'browse'} */
const browseWire = browse.wire
/** @type {'browse'} */
const browseLabel = browse.label
/** @type {string} */
const browseText = browse.String()
/** @type {string} */
const browseToString = browse.toString()
/** @type {'browse'} */
const browseJson = browse.toJSON()
void browseWire
void browseLabel
void browseText
void browseToString
void browseJson

/** @type {import('./closed-value.js').ClosedValue<25, '25'>} */
const pageSize = closed(25, '25')
/** @type {25} */
const pageSizeWire = pageSize.wire
/** @type {25} */
const pageSizeJson = pageSize.toJSON()
void pageSizeWire
void pageSizeJson

// @ts-expect-error — wire is readonly on a closed value
browse.wire = 'browse'

// @ts-expect-error — the wire type is the literal passed in, so 'browse' is not the numeric member 25
const notAPageSize = /** @type {25} */ (closed('browse', 'browse').wire)
void notAPageSize

// @ts-expect-error — a label is always a string, never the numeric wire
closed(25, 25)
