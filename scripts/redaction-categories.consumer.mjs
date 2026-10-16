// Runs only in the throwaway packed-package consumer, never against source files.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as ui from '@peasant-labs/fairtrade/ui'
import * as schema from '@peasant-labs/schema'

const fixture = JSON.parse(readFileSync(new URL('./redaction-categories.json', import.meta.url), 'utf8'))
for (const name of fixture.exports) assert.equal(ui[name], schema[name], `${name}: unchanged Schema re-export`)
for (const name of fixture.frozen) assert.ok(Object.isFrozen(ui[name]), `${name}: frozen runtime binding`)
assert.deepEqual([...ui.AllRedactionCategories].sort(), fixture.categories.map(row => row.category).sort())
assert.deepEqual([...ui.AllRedactionCategoryLabels].sort(), fixture.categories.map(row => row.label).sort())
for (const row of fixture.categories) {
  const category = ui.RedactionCategory[row.member]
  const label = ui.RedactionCategoryLabel[row.labelMember]
  assert.equal(category, row.category, `${row.name}: named category`)
  assert.equal(label, row.label, `${row.name}: named label`)
  assert.equal(ui.parseRedactionCategory(category), category)
  assert.equal(ui.parseRedactionCategoryLabel(label), label)
  assert.ok(ui.isRedactionCategory(category))
  assert.equal(ui.redactionCategoryLabel(category), label)
  assert.equal(ui.redactionCategoryFromLabel(label), category)
}
for (const row of fixture.unknown) {
  assert.equal(ui.isRedactionCategory(row.category), false, row.name)
  assert.throws(() => ui.parseRedactionCategory(row.category), TypeError, row.name)
  assert.throws(() => ui.redactionCategoryLabel(row.category), TypeError, row.name)
}
for (const row of fixture.invalidLabels) {
  assert.throws(() => ui.parseRedactionCategoryLabel(row.label), TypeError, row.name)
  assert.throws(() => ui.redactionCategoryFromLabel(row.label), TypeError, row.name)
}
console.log('packed /ui category bindings, inventories, parsers, converters and runtime refusal verified')
