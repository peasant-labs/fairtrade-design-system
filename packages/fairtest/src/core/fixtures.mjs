// Strict single-document fixture helpers. Every fixture family is one YAML
// document with unique keys, an exact declared field set, and a required-name
// inventory held by a sibling manifest. Diagnostics name the field, the value
// path, and a repair hint so mutation checks stay executable. Uses the declared
// yaml dependency and language builtins only.

import YAML from 'yaml'

/**
 * Parse exactly one YAML document. Rejects trailing documents, syntax errors,
 * and non-record roots with actionable diagnostics.
 * @param {string} source raw YAML text
 * @param {string} label owning file used in diagnostics
 * @returns {Record<string, unknown>}
 */
export function loadSingleDocument(source, label) {
  if (typeof source !== 'string' || source.length === 0) {
    throw new Error(`${label}: empty fixture source at path document; repair: restore the single YAML document in ${label}.`)
  }
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  if (documents.length !== 1) {
    if (documents.length === 0) {
      throw new Error(`${label}: empty fixture source at path document; repair: restore the single YAML document in ${label}.`)
    }
    throw new Error(`${label}: trailing YAML document at path document[1]; repair: remove everything from the trailing --- marker so ${label} holds exactly one document.`)
  }
  const [parsed] = documents
  if (parsed.errors.length > 0) {
    throw new Error(`${label}: invalid YAML at path document; ${parsed.errors.map((entry) => entry.message).join('; ')}; repair: fix the YAML syntax in ${label}.`)
  }
  const value = parsed.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}: document root must be a record at path document; repair: restore the mapping root in ${label}.`)
  }
  return value
}

/**
 * Assert the record holds exactly the declared fields.
 * @param {unknown} value
 * @param {string[]} fields
 * @param {string} tag record description used in diagnostics
 * @param {string} label owning file used in diagnostics
 * @param {string} [path] value path used in diagnostics
 * @returns {void}
 */
export function checkKeys(value, fields, tag, label, path = '') {
  const where = path ? ` at path ${path}` : ''
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${tag}: record is missing or malformed${where} in ${label}; repair: restore the record with exactly: ${fields.join(', ')}.`)
  }
  for (const field of fields) {
    if (!(field in value)) {
      throw new Error(`${tag}: missing required field "${field}"${where} in ${label}; repair: restore "${field}" in ${label}.`)
    }
  }
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) {
      throw new Error(`${tag}: unknown field "${key}"${where} in ${label}; repair: remove "${key}" from ${label}.`)
    }
  }
}

/**
 * Assert the value is a non-empty trimmed string.
 * @param {unknown} value
 * @param {string} tag record description used in diagnostics
 * @param {string} field field name used in diagnostics
 * @param {string} path value path used in diagnostics
 * @param {string} repair repair hint appended to the diagnostic
 * @returns {void}
 */
export function checkText(value, tag, field, path, repair) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${tag}: missing or invalid field "${field}" at path ${path}; repair: ${repair}.`)
  }
}

/**
 * Assert the actual names match the required inventory exactly: no missing
 * names, no extra names, no duplicates on either side.
 * @param {string[]} actual
 * @param {string[]} required
 * @param {string} label owning file used in diagnostics
 * @returns {void}
 */
export function checkRequiredNames(actual, required, label) {
  const seenNames = new Set()
  for (const name of actual) {
    if (seenNames.has(name)) {
      throw new Error(`${label}: duplicate record name "${name}" at path records; repair: give every record a unique required name.`)
    }
    seenNames.add(name)
  }
  if (new Set(required).size !== required.length) {
    throw new Error(`${label}: required names must be unique at path manifest; repair: list every required name once.`)
  }
  for (const name of required) {
    if (!actual.includes(name)) {
      throw new Error(`${label}: required record inventory mismatch at path records; missing required record "${name}"; repair: restore the "${name}" record or update the manifest required names.`)
    }
  }
  for (const name of actual) {
    if (!required.includes(name)) {
      throw new Error(`${label}: required record inventory mismatch at path records; unknown record "${name}"; repair: remove the "${name}" record or register it in the manifest required names.`)
    }
  }
}
