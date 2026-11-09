#!/usr/bin/env node
/* Re-runnable behavioural test for the shared closed-set factory
   (src/ui/closed-value.js). Every other closed set in the package is built with
   `closed()`, so the guarantees it makes are load-bearing:

     • a member is a frozen value whose only keys are `wire`, `label`, `String`,
       `toString`, and `toJSON`;
     • `String()` / `toString()` derive their text from the wire, so template
       literals and `String(value)` agree with `wire`, and `toJSON()` makes
       `JSON.stringify(value)` serialize the wire itself;
     • a numeric wire and the string that spells it keep distinct wire values
       (`25` !== `'25'`), tested with one shared label so the wire axis is isolated;
     • an invalid wire or label is refused with an actionable TypeError.

   The member and refusal cases are named data in testdata/closed-value.yaml;
   the required-name manifest makes a deletion fail the suite. Run:
   `node --test src/ui/closed-value.test.js`. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { closed } from './closed-value.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = YAML.parse(readFileSync(join(HERE, 'testdata', 'closed-value.yaml'), 'utf8'))
const manifest = YAML.parse(readFileSync(join(HERE, 'testdata', 'closed-value.manifest.yaml'), 'utf8'))

/** Assert a family's names are exactly the manifest's names, with no duplicates. */
function assertExactNames(actual, required, family) {
  assert.equal(new Set(actual).size, actual.length, `${family}: fixture names must be unique`)
  assert.equal(new Set(required).size, required.length, `${family}: manifest names must be unique`)
  assert.deepEqual(
    [...actual].sort(),
    [...required].sort(),
    `${family}: the fixture names must exactly match the required-name manifest (no silent deletion or drift)`,
  )
}

assertExactNames(fixture.members.map((member) => member.name), manifest.requiredMemberNames, 'members')
assertExactNames(fixture.refusals.map((refusal) => refusal.name), manifest.requiredRefusalNames, 'refusals')

describe('closed-value members', () => {
  for (const member of fixture.members) {
    it(`${member.name}: frozen member with the Go-style conversion hooks`, () => {
      const value = closed(member.wire, member.label)

      assert.ok(Object.isFrozen(value), 'a closed member must be frozen')
      assert.deepEqual(
        Object.keys(value).sort(),
        ['String', 'label', 'toJSON', 'toString', 'wire'].sort(),
        'a closed member must carry exactly wire, label, String, toString, and toJSON',
      )

      assert.equal(value.wire, member.wire, 'wire must preserve the exact primitive')
      assert.equal(typeof value.wire, typeof member.wire, 'wire must preserve its primitive type')
      assert.equal(value.label, member.label, 'label must preserve the exact text')

      assert.equal(value.String(), String(member.wire), 'String() must derive its text from the wire')
      assert.equal(value.toString(), String(member.wire), 'toString() must derive its text from the wire')
      assert.equal(String(value), String(member.wire), 'String(value) and template literals must agree with the wire')
      assert.equal(value.toJSON(), member.wire, 'toJSON() must return the wire')
      assert.equal(JSON.stringify(value), JSON.stringify(member.wire), 'JSON.stringify must serialize the wire')

      assert.throws(
        () => {
          // @ts-expect-error — the frozen member refuses assignment at runtime too
          value.wire = 'mutated'
        },
        TypeError,
        'assigning to a frozen member must throw in strict mode',
      )
    })
  }
})

describe('closed-value wire distinctness', () => {
  it('a numeric wire and the string that spells it keep distinct wire values', () => {
    const numeric = closed(25, '25')
    const text = closed('25', '25')

    assert.equal(typeof numeric.wire, 'number')
    assert.equal(typeof text.wire, 'string')
    assert.notEqual(numeric.wire, text.wire, '25 and "25" must not alias')
    assert.equal(JSON.stringify(numeric), '25')
    assert.equal(JSON.stringify(text), '"25"')
  })
})

describe('closed-value refusals', () => {
  for (const refusal of fixture.refusals) {
    it(`${refusal.name}: refused with an actionable TypeError`, () => {
      assert.throws(
        () => closed(refusal.wire, refusal.label),
        (error) => {
          assert.ok(error instanceof TypeError, `expected a TypeError, got ${error?.constructor?.name}`)
          assert.ok(
            error.message.includes('src/ui/closed-value.js'),
            `the error must name where it failed, got "${error.message}"`,
          )
          assert.ok(
            error.message.includes(refusal.expectedError),
            `the error must explain the refusal ("${refusal.expectedError}"), got "${error.message}"`,
          )
          return true
        },
      )
    })
  }
})
