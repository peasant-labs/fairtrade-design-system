// @ts-check
/* transcript library grouping — the one place a page becomes groups.

   The host owns the rows, the group keys, and the page. This module turns one
   page of rows into the ordered groups the table renders:

     • a host returns BARE keys (`[row.projectHash]`); this module qualifies every
       group id as `${groupBy.wire}:${key}` exactly once;
     • a row that names two groups renders in both; the page still counts the
       transcript once;
     • groups are ordered by first appearance on the page;
     • `nextGroupKeys` marks a group that has rows on the next page; the helper
       never fetches anything;
     • `continuedGroupKeys` marks a group that began on the previous page. `null`
       means the host cannot know (a first page, a cold direct jump, a complete
       list), so every group keeps its full header.

   `groupKeysFor` builds both key unions from rows the host already holds. It
   returns bare keys, de-duplicated in first-appearance order; callers hand those
   back to `groupPageRows` (directly or through the table's props). */

/**
 * One rendered group.
 *
 * - `id` is `${groupBy.wire}:${key}`, or `''` for rows that name no group.
 * - `label` is what `groupLabel(id)` returned; `''` for the ungrouped bucket.
 * - `continued` means this group began on the previous page.
 * - `continues` means this group has rows on the next page.
 *
 * @template Row
 * @typedef {object} TranscriptLibraryGroup
 * @property {string} id
 * @property {string} label
 * @property {readonly Row[]} rows
 * @property {boolean} continued
 * @property {boolean} continues
 */

/**
 * Group one page of rows.
 *
 * @template Row
 * @template {import('./closed-value.js').ClosedValue<string, string>} GroupBy
 * @param {readonly Row[]} rows - the host's page rows, in display order.
 * @param {GroupBy} groupBy - the host's grouping member; only `.wire` is read.
 * @param {(row: Row) => readonly string[]} groupKeys - bare group keys for a row.
 * @param {(groupId: string) => string} groupLabel - label for a qualified group id.
 * @param {readonly string[] | null} nextGroupKeys - bare keys of `page.nextItems`, or null.
 * @param {readonly string[] | null} [continuedGroupKeys] - bare keys of the previous page, or null.
 * @returns {readonly TranscriptLibraryGroup<Row>[]}
 */
export function groupPageRows(rows, groupBy, groupKeys, groupLabel, nextGroupKeys, continuedGroupKeys = null) {
  assertRows(rows)
  const wire = assertGroupBy(groupBy)
  if (typeof groupKeys !== 'function') throw refuseFunction('groupKeys')
  if (typeof groupLabel !== 'function') throw refuseFunction('groupLabel')
  const next = qualify(wire, nextGroupKeys)
  const continued = qualify(wire, continuedGroupKeys)

  /** @type {Map<string, { id: string, label: string, rows: Row[] }>} */
  const groups = new Map()
  for (const row of rows) {
    const keys = groupKeys(row)
    if (!Array.isArray(keys)) throw refuseKeys(row)
    if (keys.length === 0) {
      const ungrouped = groups.get('')
      if (ungrouped) ungrouped.rows.push(row)
      else groups.set('', { id: '', label: '', rows: [row] })
      continue
    }
    /** @type {Set<string>} */
    const seen = new Set()
    for (const key of keys) {
      if (typeof key !== 'string' || key.length === 0) throw refuseKey(key)
      if (seen.has(key)) continue
      seen.add(key)
      const id = `${wire}:${key}`
      let group = groups.get(id)
      if (!group) {
        const label = groupLabel(id)
        if (typeof label !== 'string') throw refuseLabel(id)
        group = { id, label, rows: [] }
        groups.set(id, group)
      }
      group.rows.push(row)
    }
  }

  return [...groups.values()].map((group) => ({
    id: group.id,
    label: group.label,
    rows: group.rows,
    continued: group.id !== '' && continued.has(group.id),
    continues: group.id !== '' && next.has(group.id),
  }))
}

/**
 * The union of every row's bare group keys, de-duplicated in first-appearance
 * order. A host uses it for `nextGroupKeys` (over `page.nextItems`) and for
 * `continuedGroupKeys` (over the previous page it holds).
 *
 * @template Row
 * @param {readonly Row[]} rows
 * @param {(row: Row) => readonly string[]} groupKeys
 * @returns {readonly string[]}
 */
export function groupKeysFor(rows, groupKeys) {
  assertRows(rows)
  if (typeof groupKeys !== 'function') throw refuseFunction('groupKeys')
  /** @type {Set<string>} */
  const seen = new Set()
  /** @type {string[]} */
  const keys = []
  for (const row of rows) {
    const rowKeys = groupKeys(row)
    if (!Array.isArray(rowKeys)) throw refuseKeys(row)
    for (const key of rowKeys) {
      if (typeof key !== 'string' || key.length === 0) throw refuseKey(key)
      if (seen.has(key)) continue
      seen.add(key)
      keys.push(key)
    }
  }
  return keys
}

/**
 * Qualify each bare key with the group-by wire. A `null`/undefined list means
 * "the host cannot know", which yields an empty set rather than a wildcard.
 *
 * @param {string} wire
 * @param {readonly string[] | null | undefined} keys
 * @returns {ReadonlySet<string>}
 */
function qualify(wire, keys) {
  if (keys == null) return new Set()
  if (!Array.isArray(keys)) throw refuseKeys(keys)
  /** @type {Set<string>} */
  const qualified = new Set()
  for (const key of keys) {
    if (typeof key !== 'string' || key.length === 0) throw refuseKey(key)
    qualified.add(`${wire}:${key}`)
  }
  return qualified
}

/**
 * @param {unknown} rows
 * @returns {asserts rows is readonly unknown[]}
 */
function assertRows(rows) {
  if (Array.isArray(rows)) return
  throw new TypeError(
    'groupPageRows/groupKeysFor failed in src/ui/groupPageRows.js: rows must be an array. ' +
      'Both helpers walk the page rows the host already holds; a non-array cannot be grouped or unioned. ' +
      'Pass the page rows (or `page.nextItems`) as an array.',
  )
}

/**
 * @param {unknown} groupBy
 * @returns {string}
 */
function assertGroupBy(groupBy) {
  if (typeof groupBy === 'object' && groupBy !== null && 'wire' in groupBy && typeof groupBy.wire === 'string' && groupBy.wire.length > 0) {
    return groupBy.wire
  }
  throw new TypeError(
    'groupPageRows failed in src/ui/groupPageRows.js: groupBy must be a closed-set member with a non-empty string `wire`. ' +
      'The table forms every group id as `${groupBy.wire}:${key}` and never parses it back, so the wire is the only identity it reads. ' +
      'Pass the host GroupBy member (for example a member created with `closed(...)`).',
  )
}

/**
 * @param {string} name
 * @returns {TypeError}
 */
function refuseFunction(name) {
  return new TypeError(
    `groupPageRows/groupKeysFor failed in src/ui/groupPageRows.js: ${name} must be a function. ` +
      `The helper calls ${name} for every row, so a missing function would otherwise throw an opaque error mid-page. ` +
      `Pass ${name} as a function.`,
  )
}

/**
 * @param {unknown} row
 * @returns {TypeError}
 */
function refuseKeys(row) {
  return new TypeError(
    `groupPageRows/groupKeysFor failed in src/ui/groupPageRows.js: groupKeys(row) must return an array of bare keys; received ${describe(row)}. ` +
      'A bare key is the group identity without a prefix (for example `[row.projectHash]`). ' +
      'Return `[]` for a row in no group; never return undefined or a qualified id.',
  )
}

/**
 * @param {unknown} key
 * @returns {TypeError}
 */
function refuseKey(key) {
  return new TypeError(
    `groupPageRows/groupKeysFor failed in src/ui/groupPageRows.js: a group key must be a non-empty string, received ${describe(key)}. ` +
      'The table qualifies each key with `groupBy.wire` and passes the result to `groupLabel`; an empty key would create a bare `${wire}:` id. ' +
      'Return the bare key value (for example the project hash) for every grouped row.',
  )
}

/**
 * @param {string} id
 * @returns {TypeError}
 */
function refuseLabel(id) {
  return new TypeError(
    `groupPageRows failed in src/ui/groupPageRows.js: groupLabel(${JSON.stringify(id)}) must return a string, received ${describe(id)}. ` +
      'The label is the only text the group header shows, so a missing label would render a blank header. ' +
      'Return the host label for the qualified id, or the id itself as a fallback.',
  )
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function describe(value) {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return `a ${typeof value}`
}
