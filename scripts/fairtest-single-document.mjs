#!/usr/bin/env node
// Shared strict single-document YAML loader for the S1 Fairtest guardrails.
//
// Parses exactly one YAML document: a legal leading `---` start marker is
// accepted, while any trailing document (`---` or `...` end-marker followed
// by more content) fails closed with an actionable path and repair hint.
// Browser-free: node builtins plus the declared yaml developer dependency.
import YAML from 'yaml'

/**
 * Parse `source` as exactly one YAML mapping document.
 * @param {string} source the YAML text to parse
 * @param {string} label the file label used in diagnostics
 * @returns {Record<string, unknown>} the parsed mapping root
 */
export function loadSingleDocument(source, label) {
  if (source.trim().length === 0) {
    throw new Error(`${label}: empty fixture source at path document; repair: restore the single YAML document in ${label}.`)
  }
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  if (documents.length !== 1) {
    throw new Error(`${label}: expected exactly one YAML document at path document[1]; repair: remove everything from the trailing --- marker so ${label} holds exactly one document.`)
  }
  const [document] = documents
  if (document.errors.length > 0) {
    throw new Error(`${label}: invalid YAML at path document; ${document.errors.map((entry) => entry.message).join('; ')}; repair: fix the YAML syntax in ${label}.`)
  }
  const value = document.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}: document root must be an object at path document; repair: restore the mapping root in ${label}.`)
  }
  return /** @type {Record<string, unknown>} */ (value)
}
