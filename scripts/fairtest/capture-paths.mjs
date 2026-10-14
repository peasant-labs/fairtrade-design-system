// @ts-check

// App-owned capture path helpers.
//
// One owner for the capture-root layout so the producer that writes a row
// artifact and the consumer that reads it back resolve the same path: a row
// artifact is `rows/<state>/<key>/<name>`, a shot is a capture-root-relative
// posix path, and a stray separator or parent segment fails closed with the
// repository's field / at path / repair diagnostic.

import { isAbsolute, join } from 'node:path'

/**
 * Assert a capture-root-relative posix path is safe to resolve under the root.
 * @param {unknown} relative candidate path
 * @param {string} path value path used in diagnostics
 * @returns {string}
 */
export function assertCaptureRelative(relative, path = 'captureRelative') {
  if (typeof relative !== 'string' || relative.length === 0) {
    throw new Error(`capture paths: invalid value ${JSON.stringify(relative)} for field "file" at path ${path}; repair: provide a non-empty capture-root-relative posix path.`)
  }
  if (relative.includes('\0')) {
    throw new Error(`capture paths: invalid value at field "file" at path ${path}; repair: remove the null byte from the capture-root-relative path.`)
  }
  if (relative.includes('\\')) {
    throw new Error(`capture paths: invalid value ${JSON.stringify(relative)} for field "file" at path ${path}; repair: use posix slashes in the capture-root-relative path.`)
  }
  if (isAbsolute(relative)) {
    throw new Error(`capture paths: invalid value ${JSON.stringify(relative)} for field "file" at path ${path}; repair: use a capture-root-relative path, not an absolute one.`)
  }
  for (const segment of relative.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new Error(`capture paths: invalid value ${JSON.stringify(relative)} for field "file" at path ${path}; repair: use a capture-root-relative path with no empty, current-directory, or parent-directory segments.`)
    }
  }
  return relative
}

/**
 * Resolve a capture-root-relative path under the capture root.
 * @param {string} outRoot capture root
 * @param {unknown} relative capture-root-relative posix path
 * @param {string} [path] value path used in diagnostics
 * @returns {string}
 */
export function captureRelativePath(outRoot, relative, path = 'captureRelative') {
  return join(outRoot, ...assertCaptureRelative(relative, path).split('/'))
}

/**
 * The directory one capture row's artifacts live in.
 * @param {string} outRoot capture root
 * @param {string} state state id
 * @param {string} key row key
 * @returns {string}
 */
export function captureRowDir(outRoot, state, key) {
  return join(outRoot, 'rows', state, key)
}

/**
 * One capture row artifact, resolved the same way for the writer and the
 * reader.
 * @param {string} outRoot capture root
 * @param {string} state state id
 * @param {string} key row key
 * @param {string} name artifact class name
 * @returns {string}
 */
export function captureRowArtifact(outRoot, state, key, name) {
  return join(captureRowDir(outRoot, state, key), name)
}
